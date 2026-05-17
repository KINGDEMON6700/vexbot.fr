import { timingSafeEqual } from "node:crypto";
import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import type { Env } from "../config/env.js";
import {
  findEmbedTemplateDtoById,
  findEmbedTemplateDtoByNameCaseInsensitive,
} from "../services/embedTemplateService.js";
import { sendTemplateMessagesToChannel } from "../services/embedSendService.js";
import { buildTicketPanelDiscordJsonBody } from "../services/ticketPanelDiscordService.js";
import {
  closeTicketWithTranscriptInternal,
  openTicketsSummaryForOpener,
  deleteOpenTicketByChannelInternal,
  findOpenTicketByChannel,
  getGuildTicketSettingsDto,
  listGuildTicketSettingsForBotSync,
  registerTicketOpenInternal,
  updatePanelMessageIdInternal,
} from "../services/ticketService.js";
import { mergeWelcomeTicketButtonsIntoFirstMessage } from "../services/ticketWelcomeEmbedSendMerge.js";
import { evaluateNativeCommandAccess } from "../services/nativeCommandSettingsService.js";
import { resolveCustomCommandForBot } from "../services/customSlashCommandService.js";
import { getWelcomeGoodbyeSettings } from "../services/welcomeGoodbyeService.js";
import { getJoinAutoRoleSettings } from "../services/joinAutoRoleSettingsService.js";
import { ensureGuildForDiscord } from "../services/ensureGuild.js";
import { businessEventMetadata, recordProductEvent } from "../services/metricsService.js";
import {
  consumeJoinVerificationCaptcha,
  issueJoinVerificationCaptcha,
  getJoinVerificationSettings,
} from "../services/joinVerificationSettingsService.js";
import { applyWelcomePlaceholdersToTemplateMessages } from "../lib/welcomeTemplatePlaceholders.js";

const sendEmbedBodySchema = z.object({
  discordGuildId: z.string().min(1).max(32),
  channelId: z.string().min(1).max(32),
  templateName: z.string().min(1).max(100),
});

const welcomePlaceholderContextSchema = z.object({
  userId: z.string().min(1).max(32),
  userName: z.string().max(100),
  displayName: z.string().max(100),
  serverName: z.string().max(100),
  memberCount: z.number().int().min(0).max(10_000_000),
});

const sendEmbedByIdBodySchema = z.object({
  discordGuildId: z.string().min(1).max(32),
  channelId: z.string().min(1).max(32),
  embedId: z.string().min(1).max(40),
  /** Si présent : remplace {user}, {server}, etc. dans le modèle avant envoi (arrivées / départs). */
  placeholderContext: welcomePlaceholderContextSchema.optional(),
});

const registerTicketOpenBodySchema = z.object({
  discordGuildId: z.string().min(1).max(32),
  channelId: z.string().min(1).max(32),
  openerDiscordId: z.string().min(1).max(32),
  subject: z.string().max(500).nullable().optional(),
});

const revertTicketOpenBodySchema = z.object({
  discordGuildId: z.string().min(1).max(32),
  channelId: z.string().min(1).max(32),
});

const countOpenBodySchema = z.object({
  discordGuildId: z.string().min(1).max(32),
  openerDiscordId: z.string().min(1).max(32),
});

const closeTicketBodySchema = z.object({
  discordGuildId: z.string().min(1).max(32),
  channelId: z.string().min(1).max(32),
  closedByDiscordId: z.string().min(1).max(32),
  transcriptContent: z.string().min(1).max(500_000),
  format: z.enum(["PLAIN", "HTML", "JSON"]).default("HTML"),
  messageCount: z.number().int().min(0).max(10_000),
  closeReason: z.enum(["RESOLVED", "DUPLICATE", "INVALID", "OTHER"]).default("RESOLVED"),
  memberSelfClose: z.boolean().optional(),
  /** Fermeture via le bouton d’accueil par un modérateur (le bot a vérifié « Gérer les salons »). */
  welcomeCloseByStaff: z.boolean().optional(),
});

const panelMessageBodySchema = z.object({
  discordGuildId: z.string().min(1).max(32),
  panelMessageId: z.string().min(1).max(32).nullable(),
});

const ticketPanelRenderBodySchema = z.object({
  discordGuildId: z.string().regex(/^\d{5,25}$/),
});

const botGuildEventSchema = z.object({
  discordGuildId: z.preprocess((value) => String(value ?? "").trim(), z.string().regex(/^\d{5,25}$/)),
  name: z.preprocess((value) => {
    if (value === undefined || value === null) return null;
    return String(value).trim().slice(0, 100) || null;
  }, z.string().nullable()).optional(),
});

function timingSafeStringEqual(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

export function createBotInternalRouter(env: Env) {
  const router = Router();

  router.post(
    "/guild-installed",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const provided = req.get("x-vex-bot-key") ?? "";
        if (!timingSafeStringEqual(provided, env.VEX_BOT_API_SECRET)) {
          res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Clé invalide." } });
          return;
        }
        const parsed = botGuildEventSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({
            error: {
              code: "INVALID_BODY",
              message: "Requête invalide.",
              details: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
            },
          });
          return;
        }
        await ensureGuildForDiscord(prisma, parsed.data.discordGuildId, parsed.data.name ?? null);
        await recordProductEvent(prisma, {
          type: "bot_installed",
          source: "discord_guild_create",
          discordGuildId: parsed.data.discordGuildId,
          metadata: businessEventMetadata({
            entity: "bot",
            action: "install",
            name: parsed.data.name ?? parsed.data.discordGuildId,
            target: parsed.data.discordGuildId,
          }),
        });
        res.status(204).end();
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    "/send-embed-template",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const provided = req.get("x-vex-bot-key") ?? "";
        if (!timingSafeStringEqual(provided, env.VEX_BOT_API_SECRET)) {
          res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Clé invalide." } });
          return;
        }

        const parsed = sendEmbedBodySchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({ error: { code: "INVALID_BODY", message: "Requête invalide." } });
          return;
        }

        const { discordGuildId, channelId, templateName } = parsed.data;
        const template = await findEmbedTemplateDtoByNameCaseInsensitive(
          prisma,
          discordGuildId,
          templateName,
        );
        if (!template) {
          res.status(404).json({
            error: { code: "TEMPLATE_NOT_FOUND", message: "Modèle introuvable pour ce serveur." },
          });
          return;
        }

        const result = await sendTemplateMessagesToChannel(discordGuildId, env.DISCORD_BOT_TOKEN, {
          channelId,
          messages: template.messages.map((m) => ({
            messageContent: m.messageContent,
            embeds: m.embeds,
            componentBlocks: m.componentBlocks,
          })),
        });

        res.json({ ok: true, sent: result.sent });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    "/send-embed-template-by-id",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const provided = req.get("x-vex-bot-key") ?? "";
        if (!timingSafeStringEqual(provided, env.VEX_BOT_API_SECRET)) {
          res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Clé invalide." } });
          return;
        }
        const parsed = sendEmbedByIdBodySchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({ error: { code: "INVALID_BODY", message: "Requête invalide." } });
          return;
        }
        const { discordGuildId, channelId, embedId, placeholderContext } = parsed.data;
        const template = await findEmbedTemplateDtoById(prisma, discordGuildId, embedId);
        if (!template) {
          res.status(404).json({
            error: { code: "TEMPLATE_NOT_FOUND", message: "Modèle introuvable pour ce serveur." },
          });
          return;
        }
        const ticketSettings = await getGuildTicketSettingsDto(prisma, discordGuildId);
        const attachWelcomeButtons =
          (Boolean(ticketSettings?.welcomeMemberCloseButton) ||
            Boolean(ticketSettings?.welcomeMemberAddButton)) &&
          ticketSettings?.welcomeEmbedId === embedId;

        let messagesToSend = attachWelcomeButtons
          ? mergeWelcomeTicketButtonsIntoFirstMessage(template.messages, {
              close: {
                enabled: Boolean(ticketSettings?.welcomeMemberCloseButton),
                style: ticketSettings?.welcomeMemberCloseButtonStyle ?? "danger",
                emoji: ticketSettings?.welcomeMemberCloseButtonEmoji ?? null,
              },
              add: {
                enabled: Boolean(ticketSettings?.welcomeMemberAddButton),
                style: ticketSettings?.welcomeMemberAddButtonStyle ?? "primary",
                emoji: ticketSettings?.welcomeMemberAddButtonEmoji ?? null,
              },
            })
          : template.messages;

        if (placeholderContext) {
          messagesToSend = applyWelcomePlaceholdersToTemplateMessages(messagesToSend, placeholderContext);
        }

        const result = await sendTemplateMessagesToChannel(discordGuildId, env.DISCORD_BOT_TOKEN, {
          channelId,
          messages: messagesToSend.map((m) => ({
            messageContent: m.messageContent,
            embeds: m.embeds,
            componentBlocks: m.componentBlocks,
          })),
        });
        res.json({ ok: true, sent: result.sent });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    "/ticket-settings",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const provided = req.get("x-vex-bot-key") ?? "";
        if (!timingSafeStringEqual(provided, env.VEX_BOT_API_SECRET)) {
          res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Clé invalide." } });
          return;
        }
        const discordGuildId = typeof req.query.discordGuildId === "string" ? req.query.discordGuildId.trim() : "";
        if (!/^\d{5,32}$/.test(discordGuildId)) {
          res.status(400).json({ error: { code: "INVALID_QUERY", message: "discordGuildId invalide." } });
          return;
        }
        const settings = await getGuildTicketSettingsDto(prisma, discordGuildId);
        if (!settings?.ticketCategoryId) {
          res.status(404).json({
            error: { code: "TICKET_SETTINGS_INCOMPLETE", message: "Configuration tickets incomplète pour ce serveur." },
          });
          return;
        }
        res.json({ settings });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    "/ticket-settings-bulk",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const provided = req.get("x-vex-bot-key") ?? "";
        if (!timingSafeStringEqual(provided, env.VEX_BOT_API_SECRET)) {
          res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Clé invalide." } });
          return;
        }
        const rows = await listGuildTicketSettingsForBotSync(prisma);
        res.json({ guilds: rows });
      } catch (err) {
        next(err);
      }
    },
  );

  router.patch(
    "/ticket-settings/panel-message",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const provided = req.get("x-vex-bot-key") ?? "";
        if (!timingSafeStringEqual(provided, env.VEX_BOT_API_SECRET)) {
          res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Clé invalide." } });
          return;
        }
        const parsed = panelMessageBodySchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({ error: { code: "INVALID_BODY", message: "Requête invalide." } });
          return;
        }
        await updatePanelMessageIdInternal(
          prisma,
          parsed.data.discordGuildId,
          parsed.data.panelMessageId,
        );
        await recordProductEvent(prisma, {
          type: "ticket_panel_message_synced",
          source: "bot_internal",
          discordGuildId: parsed.data.discordGuildId,
          metadata: businessEventMetadata({
            entity: "ticket",
            action: "sync",
            name: "Panneau ticket",
            target: parsed.data.panelMessageId,
          }),
        });
        res.status(204).end();
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    "/tickets/count-open-for-opener",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const provided = req.get("x-vex-bot-key") ?? "";
        if (!timingSafeStringEqual(provided, env.VEX_BOT_API_SECRET)) {
          res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Clé invalide." } });
          return;
        }
        const parsed = countOpenBodySchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({ error: { code: "INVALID_BODY", message: "Requête invalide." } });
          return;
        }
        const summary = await openTicketsSummaryForOpener(
          prisma,
          parsed.data.discordGuildId,
          parsed.data.openerDiscordId,
        );
        res.json({ count: summary.count, channelId: summary.channelId });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    "/tickets/revert-open",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const provided = req.get("x-vex-bot-key") ?? "";
        if (!timingSafeStringEqual(provided, env.VEX_BOT_API_SECRET)) {
          res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Clé invalide." } });
          return;
        }
        const parsed = revertTicketOpenBodySchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({ error: { code: "INVALID_BODY", message: "Requête invalide." } });
          return;
        }
        await deleteOpenTicketByChannelInternal(
          prisma,
          parsed.data.discordGuildId,
          parsed.data.channelId,
        );
        await recordProductEvent(prisma, {
          type: "ticket_open_reverted",
          source: "bot_internal",
          discordGuildId: parsed.data.discordGuildId,
          metadata: businessEventMetadata({
            entity: "ticket",
            action: "delete",
            name: "Ticket annulé",
            target: parsed.data.channelId,
          }),
        });
        res.status(204).end();
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    "/tickets/register-open",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const provided = req.get("x-vex-bot-key") ?? "";
        if (!timingSafeStringEqual(provided, env.VEX_BOT_API_SECRET)) {
          res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Clé invalide." } });
          return;
        }
        const parsed = registerTicketOpenBodySchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({ error: { code: "INVALID_BODY", message: "Requête invalide." } });
          return;
        }
        const out = await registerTicketOpenInternal(
          prisma,
          parsed.data.discordGuildId,
          parsed.data.channelId,
          parsed.data.openerDiscordId,
          parsed.data.subject,
        );
        await recordProductEvent(prisma, {
          type: "ticket_open_registered",
          source: "bot_internal",
          discordGuildId: parsed.data.discordGuildId,
          metadata: businessEventMetadata({
            entity: "ticket",
            action: "create",
            name: `Ticket ${(out as { ticketNumber?: unknown }).ticketNumber ?? ""}`.trim(),
            target: parsed.data.channelId,
            openerDiscordId: parsed.data.openerDiscordId,
            subject: parsed.data.subject ?? null,
            after: out,
          }),
        });
        res.status(201).json(out);
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    "/ticket-panel-render",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const provided = req.get("x-vex-bot-key") ?? "";
        if (!timingSafeStringEqual(provided, env.VEX_BOT_API_SECRET)) {
          res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Clé invalide." } });
          return;
        }
        const parsed = ticketPanelRenderBodySchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({ error: { code: "INVALID_BODY", message: "Requête invalide." } });
          return;
        }
        const body = await buildTicketPanelDiscordJsonBody(prisma, parsed.data.discordGuildId);
        if (!body) {
          res.status(404).json({
            error: { code: "NO_PANEL", message: "Aucun salon panneau configuré pour ce serveur." },
          });
          return;
        }
        res.json({ body });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    "/tickets/open-by-channel",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const provided = req.get("x-vex-bot-key") ?? "";
        if (!timingSafeStringEqual(provided, env.VEX_BOT_API_SECRET)) {
          res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Clé invalide." } });
          return;
        }
        const discordGuildId = typeof req.query.discordGuildId === "string" ? req.query.discordGuildId.trim() : "";
        const channelId = typeof req.query.channelId === "string" ? req.query.channelId.trim() : "";
        if (!/^\d{5,25}$/.test(discordGuildId) || !/^\d{5,25}$/.test(channelId)) {
          res.status(400).json({ error: { code: "INVALID_QUERY", message: "Paramètres invalides." } });
          return;
        }
        const found = await findOpenTicketByChannel(prisma, discordGuildId, channelId);
        res.json({
          open: Boolean(found),
          ticketId: found?.id ?? null,
          openerId: found?.openerId ?? null,
          welcomeMemberAddButton: found?.welcomeMemberAddButton ?? false,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    "/tickets/close",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const provided = req.get("x-vex-bot-key") ?? "";
        if (!timingSafeStringEqual(provided, env.VEX_BOT_API_SECRET)) {
          res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Clé invalide." } });
          return;
        }
        const parsed = closeTicketBodySchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({ error: { code: "INVALID_BODY", message: "Requête invalide." } });
          return;
        }
        const d = parsed.data;
        const result = await closeTicketWithTranscriptInternal(prisma, d.discordGuildId, d.channelId, d.closedByDiscordId, {
          transcriptContent: d.transcriptContent,
          format: d.format,
          messageCount: d.messageCount,
          closeReason: d.closeReason,
          memberSelfClose: d.memberSelfClose,
          welcomeCloseByStaff: d.welcomeCloseByStaff,
        });
        await recordProductEvent(prisma, {
          type: "ticket_closed",
          source: "bot_internal",
          discordGuildId: d.discordGuildId,
          metadata: businessEventMetadata({
            entity: "ticket",
            action: "close",
            name: "Ticket fermé",
            target: d.channelId,
            success: true,
            closedByDiscordId: d.closedByDiscordId,
            after: {
              closeReason: d.closeReason,
              messageCount: d.messageCount,
              format: d.format,
              memberSelfClose: d.memberSelfClose ?? false,
              welcomeCloseByStaff: d.welcomeCloseByStaff ?? false,
            },
          }),
        });
        res.json({ ok: true, ...result });
      } catch (err) {
        next(err);
      }
    },
  );

  // ---------------------------------------------------------------------------
  // Commandes : évaluation des droits et résolution des commandes custom.
  // Le bot consomme ces endpoints à chaque interaction.
  // ---------------------------------------------------------------------------

  const commandEvalSchema = z.object({
    discordGuildId: z.string().min(1).max(32),
    commandName: z.string().min(1).max(64),
    memberRoleIds: z.array(z.string().min(1).max(32)).max(250),
    channelId: z.string().min(1).max(32).nullable().optional(),
  });

  router.post(
    "/commands/evaluate-native",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const provided = req.get("x-vex-bot-key") ?? "";
        if (!timingSafeStringEqual(provided, env.VEX_BOT_API_SECRET)) {
          res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Clé invalide." } });
          return;
        }
        const parsed = commandEvalSchema.safeParse(req.body);
        if (!parsed.success) {
          res
            .status(400)
            .json({ error: { code: "INVALID_BODY", message: "Requête invalide." } });
          return;
        }
        const { discordGuildId, commandName, memberRoleIds, channelId } = parsed.data;
        const result = await evaluateNativeCommandAccess(
          prisma,
          discordGuildId,
          commandName,
          memberRoleIds,
          channelId ?? null,
        );
        res.json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    "/commands/resolve-custom",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const provided = req.get("x-vex-bot-key") ?? "";
        if (!timingSafeStringEqual(provided, env.VEX_BOT_API_SECRET)) {
          res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Clé invalide." } });
          return;
        }
        const parsed = commandEvalSchema.safeParse(req.body);
        if (!parsed.success) {
          res
            .status(400)
            .json({ error: { code: "INVALID_BODY", message: "Requête invalide." } });
          return;
        }
        const { discordGuildId, commandName, memberRoleIds, channelId } = parsed.data;
        const result = await resolveCustomCommandForBot(
          prisma,
          discordGuildId,
          commandName,
          memberRoleIds,
          channelId ?? null,
        );

        // Si on a une réponse embed depuis un modèle, charge le DTO pour le bot.
        if (result.ok && result.responseType === "EMBED_TEMPLATE" && result.embedId) {
          const template = await findEmbedTemplateDtoById(prisma, discordGuildId, result.embedId);
          res.json({ ...result, template });
          return;
        }
        res.json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    "/welcome-goodbye/:discordGuildId",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const provided = req.get("x-vex-bot-key") ?? "";
        if (!timingSafeStringEqual(provided, env.VEX_BOT_API_SECRET)) {
          res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Clé invalide." } });
          return;
        }
        const discordGuildId = req.params.discordGuildId;
        if (!/^\d{5,25}$/.test(discordGuildId)) {
          res.status(400).json({ error: { code: "INVALID_ID", message: "Identifiant de serveur invalide." } });
          return;
        }
        const settings = await getWelcomeGoodbyeSettings(prisma, discordGuildId);
        res.json({ settings });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    "/join-auto-roles/:discordGuildId",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const provided = req.get("x-vex-bot-key") ?? "";
        if (!timingSafeStringEqual(provided, env.VEX_BOT_API_SECRET)) {
          res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Clé invalide." } });
          return;
        }
        const discordGuildId = req.params.discordGuildId;
        if (!/^\d{5,25}$/.test(discordGuildId)) {
          res.status(400).json({ error: { code: "INVALID_ID", message: "Identifiant de serveur invalide." } });
          return;
        }
        const settings = await getJoinAutoRoleSettings(prisma, discordGuildId);
        res.json({ settings });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    "/join-verification/:discordGuildId",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const provided = req.get("x-vex-bot-key") ?? "";
        if (!timingSafeStringEqual(provided, env.VEX_BOT_API_SECRET)) {
          res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Clé invalide." } });
          return;
        }
        const discordGuildId = req.params.discordGuildId;
        if (!/^\d{5,25}$/.test(discordGuildId)) {
          res.status(400).json({ error: { code: "INVALID_ID", message: "Identifiant de serveur invalide." } });
          return;
        }
        const settings = await getJoinVerificationSettings(prisma, discordGuildId);
        res.json({ settings });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    "/join-verification/issue-captcha",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const provided = req.get("x-vex-bot-key") ?? "";
        if (!timingSafeStringEqual(provided, env.VEX_BOT_API_SECRET)) {
          res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Clé invalide." } });
          return;
        }
        const body = req.body as { discordGuildId?: unknown; discordUserId?: unknown };
        const discordGuildId = typeof body.discordGuildId === "string" ? body.discordGuildId.trim() : "";
        const discordUserId = typeof body.discordUserId === "string" ? body.discordUserId.trim() : "";
        if (!/^\d{5,25}$/.test(discordGuildId) || !/^\d{5,25}$/.test(discordUserId)) {
          res.status(400).json({ error: { code: "INVALID_ID", message: "Identifiants invalides." } });
          return;
        }
        const result = await issueJoinVerificationCaptcha(prisma, discordGuildId, discordUserId);
        if (!result.ok) {
          await recordProductEvent(prisma, {
            type: "join_verification_captcha_issued",
            source: "bot_internal",
            discordGuildId,
            discordUserId,
            metadata: businessEventMetadata({
              entity: "module",
              action: "captcha_issue",
              name: "Vérification",
              target: discordUserId,
              success: false,
              reason: result.reason,
            }),
          });
          res.status(400).json({ error: { code: "ISSUE_FAILED", message: result.reason } });
          return;
        }
        await recordProductEvent(prisma, {
          type: "join_verification_captcha_issued",
          source: "bot_internal",
          discordGuildId,
          discordUserId,
          metadata: businessEventMetadata({
            entity: "module",
            action: "captcha_issue",
            name: "Vérification",
            target: discordUserId,
          }),
        });
        res.json({ code: result.code });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    "/join-verification/check-captcha",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const provided = req.get("x-vex-bot-key") ?? "";
        if (!timingSafeStringEqual(provided, env.VEX_BOT_API_SECRET)) {
          res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Clé invalide." } });
          return;
        }
        const body = req.body as { discordGuildId?: unknown; discordUserId?: unknown; code?: unknown };
        const discordGuildId = typeof body.discordGuildId === "string" ? body.discordGuildId.trim() : "";
        const discordUserId = typeof body.discordUserId === "string" ? body.discordUserId.trim() : "";
        const code = typeof body.code === "string" ? body.code : "";
        if (!/^\d{5,25}$/.test(discordGuildId) || !/^\d{5,25}$/.test(discordUserId)) {
          res.status(400).json({ error: { code: "INVALID_ID", message: "Identifiants invalides." } });
          return;
        }
        const { ok } = await consumeJoinVerificationCaptcha(prisma, discordGuildId, discordUserId, code);
        await recordProductEvent(prisma, {
          type: "join_verification_captcha_checked",
          source: "bot_internal",
          discordGuildId,
          discordUserId,
          metadata: businessEventMetadata({
            entity: "module",
            action: "captcha_check",
            name: "Vérification",
            target: discordUserId,
            success: ok,
          }),
        });
        res.json({ ok });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
