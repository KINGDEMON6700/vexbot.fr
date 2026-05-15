import { Router } from "express";
import { loadEnv } from "../config/env.js";
import { prisma } from "../db.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { AppError } from "../lib/AppError.js";
import { requireGuildAccess } from "../middleware/requireGuildAccess.js";
import { requireSession } from "../middleware/requireSession.js";
import { buildEligibleGuildList } from "../services/eligibleGuilds.js";
import {
  buildGuildOverview,
  patchBotGuildMember,
  patchBotNickname,
  type PatchBotGuildMemberInput,
} from "../services/guildOverview.js";
import {
  createEmbedTemplate,
  deleteEmbedTemplate,
  listEmbedTemplates,
  updateEmbedTemplate,
} from "../services/embedTemplateService.js";
import {
  getGuildCategories,
  getGuildChannelsAndRoles,
  getGuildMembersForPanel,
  getGuildTextChannels,
  getGuildThreads,
} from "../services/discordGuildMeta.js";
import { sendTemplateMessagesToChannel } from "../services/embedSendService.js";
import { fetchTicketChannelMessages } from "../services/ticketChannelMessages.js";
import { syncTicketPanelMessageDiscord } from "../services/ticketPanelDiscordService.js";
import {
  getGuildTicketSettingsDto,
  getTicketDetailForGuild,
  listTicketsForGuild,
  upsertGuildTicketSettings,
} from "../services/ticketService.js";
import {
  createServerTemplateFromGuild,
  deleteServerTemplate,
  getServerTemplateDetail,
  listServerTemplates,
  previewServerTemplateApply,
  updateServerTemplate,
} from "../services/serverTemplateService.js";
import {
  getOrRefreshGuildStructure,
  invalidateGuildStructureCache,
} from "../services/guildStructureCacheService.js";
import { applyServerTemplate } from "../services/serverTemplateApply.js";
import {
  botPermissionsErrorMessage,
  checkBotPermissionsOnGuild,
} from "../services/botPermissionsCheck.js";
import { buildApplyPlan } from "../services/serverTemplateDiff.js";
import { getDiscordBotSelfCached } from "../services/ticketDetailDiscordResolve.js";
import {
  listNativeCommandSettings,
  updateNativeCommandSetting,
} from "../services/nativeCommandSettingsService.js";
import {
  createCustomSlashCommand,
  deleteCustomSlashCommand,
  getCustomSlashCommand,
  listCustomSlashCommands,
  updateCustomSlashCommand,
} from "../services/customSlashCommandService.js";
import {
  getWelcomeGoodbyeSettings,
  upsertWelcomeGoodbyeSettings,
} from "../services/welcomeGoodbyeService.js";
import {
  getJoinAutoRoleSettings,
  upsertJoinAutoRoleSettings,
} from "../services/joinAutoRoleSettingsService.js";
import {
  getJoinVerificationSettings,
  upsertJoinVerificationSettings,
} from "../services/joinVerificationSettingsService.js";
import { syncJoinVerificationPanelDiscord } from "../services/joinVerificationPanelDiscordService.js";

export const guildsRouter = Router();

guildsRouter.get(
  "/eligible",
  requireSession,
  asyncHandler(async (req, res) => {
    const env = loadEnv();
    const guilds = req.session.discordGuilds ?? [];
    const list = await buildEligibleGuildList(guilds, env.DISCORD_CLIENT_ID, env.DISCORD_BOT_TOKEN);
    res.json({ guilds: list });
  }),
);

guildsRouter.get(
  "/:discordGuildId/overview",
  requireSession,
  requireGuildAccess,
  asyncHandler(async (req, res) => {
    const env = loadEnv();
    const guild = req.discordGuildAccess!;
    const data = await buildGuildOverview(
      prisma,
      req.params.discordGuildId,
      guild,
      env.DISCORD_BOT_TOKEN,
      env.DISCORD_CLIENT_ID,
    );
    res.json(data);
  }),
);

guildsRouter.patch(
  "/:discordGuildId/bot/member",
  requireSession,
  requireGuildAccess,
  asyncHandler(async (req, res) => {
    const env = loadEnv();
    const raw = req.body as Record<string, unknown>;
    const patch: PatchBotGuildMemberInput = {};

    if (Object.prototype.hasOwnProperty.call(raw, "nickname")) {
      const v = raw.nickname;
      if (v === null) {
        patch.nick = null;
      } else if (typeof v === "string") {
        patch.nick = v;
      } else {
        throw new AppError(400, "Format du surnom invalide.", "INVALID_BODY");
      }
    }

    if (Object.prototype.hasOwnProperty.call(raw, "avatar")) {
      const v = raw.avatar;
      if (v === null) {
        patch.avatar = null;
      } else if (typeof v === "string") {
        patch.avatar = v;
      } else {
        throw new AppError(400, "Format de la photo invalide.", "INVALID_BODY");
      }
    }

    if (Object.prototype.hasOwnProperty.call(raw, "banner")) {
      const v = raw.banner;
      if (v === null) {
        patch.banner = null;
      } else if (typeof v === "string") {
        patch.banner = v;
      } else {
        throw new AppError(400, "Format de la bannière invalide.", "INVALID_BODY");
      }
    }

    if (Object.keys(patch).length === 0) {
      throw new AppError(400, "Aucune modification à enregistrer.", "EMPTY_BODY");
    }

    try {
      await patchBotGuildMember(req.params.discordGuildId, env.DISCORD_BOT_TOKEN, patch);
    } catch (e) {
      if (e instanceof Error) {
        if (e.message === "BOT_NOT_IN_GUILD") {
          throw new AppError(400, "Le bot doit être sur le serveur pour modifier l’apparence.", "BOT_ABSENT");
        }
        if (e.message === "INVALID_IMAGE") {
          throw new AppError(400, "Image non reconnue (PNG, JPEG, GIF ou WebP).", "INVALID_IMAGE");
        }
        if (e.message === "IMAGE_TOO_LARGE") {
          throw new AppError(400, "Image trop lourde (max. 8 Mo).", "IMAGE_TOO_LARGE");
        }
        if (e.message === "EMPTY_PATCH") {
          throw new AppError(400, "Aucune modification à enregistrer.", "EMPTY_PATCH");
        }
        if (e.message.startsWith("DISCORD_")) {
          throw new AppError(
            400,
            "Discord a refusé la modification. Vérifie les droits du bot, le format des images, ou si le serveur autorise les bannières de profil.",
            "DISCORD_ERROR",
          );
        }
      }
      throw e;
    }

    res.status(204).end();
  }),
);

guildsRouter.patch(
  "/:discordGuildId/bot/nickname",
  requireSession,
  requireGuildAccess,
  asyncHandler(async (req, res) => {
    const env = loadEnv();
    const raw = req.body as { nickname?: unknown };
    let nickname: string | null = null;
    if (raw.nickname === null || raw.nickname === undefined) {
      nickname = null;
    } else if (typeof raw.nickname === "string") {
      nickname = raw.nickname;
    } else {
      throw new AppError(400, "Format du surnom invalide", "INVALID_BODY");
    }

    try {
      await patchBotNickname(req.params.discordGuildId, nickname, env.DISCORD_BOT_TOKEN);
    } catch (e) {
      if (e instanceof Error && e.message === "BOT_NOT_IN_GUILD") {
        throw new AppError(400, "Le bot doit être sur le serveur pour changer le surnom.", "BOT_ABSENT");
      }
      throw new AppError(500, "Discord a refusé la modification du surnom.", "DISCORD_ERROR");
    }

    res.status(204).end();
  }),
);

guildsRouter.get(
  "/:discordGuildId/meta/mentions",
  requireSession,
  requireGuildAccess,
  asyncHandler(async (req, res) => {
    const env = loadEnv();
    try {
      const data = await getGuildChannelsAndRoles(req.params.discordGuildId, env.DISCORD_BOT_TOKEN);
      res.json(data);
    } catch (e) {
      if (e instanceof Error && e.message === "BOT_OR_GUILD_MISSING") {
        throw new AppError(
          400,
          "Ajoute le bot sur ce serveur pour charger les salons et les rôles.",
          "BOT_REQUIRED",
        );
      }
      throw new AppError(
        503,
        "Impossible de joindre Discord pour les salons et les rôles. Réessaie dans un instant.",
        "DISCORD_UNAVAILABLE",
      );
    }
  }),
);

guildsRouter.get(
  "/:discordGuildId/meta/members",
  requireSession,
  requireGuildAccess,
  asyncHandler(async (req, res) => {
    const env = loadEnv();
    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    const limitRaw =
      typeof req.query.limit === "string" ? Number.parseInt(req.query.limit, 10) : Number.NaN;
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 1000) : undefined;
    try {
      const members = await getGuildMembersForPanel(req.params.discordGuildId, env.DISCORD_BOT_TOKEN, {
        query: q,
        limit,
      });
      res.json({ members });
    } catch (e) {
      if (e instanceof Error && e.message === "BOT_OR_GUILD_MISSING") {
        throw new AppError(
          400,
          "Ajoute le bot sur ce serveur pour charger les membres.",
          "BOT_REQUIRED",
        );
      }
      if (e instanceof Error && e.message === "MEMBERS_LIST_FORBIDDEN") {
        throw new AppError(
          400,
          "Impossible de lister les membres : active l’intent « Server Members Intent » pour l’application du bot sur le portail Discord développeur, puis réinvite le bot si besoin.",
          "MEMBERS_NOT_ALLOWED",
        );
      }
      throw new AppError(
        503,
        "Impossible de joindre Discord pour les membres. Réessaie dans un instant.",
        "DISCORD_UNAVAILABLE",
      );
    }
  }),
);

guildsRouter.get(
  "/:discordGuildId/meta/categories",
  requireSession,
  requireGuildAccess,
  asyncHandler(async (req, res) => {
    const env = loadEnv();
    try {
      const categories = await getGuildCategories(req.params.discordGuildId, env.DISCORD_BOT_TOKEN);
      res.json({ categories });
    } catch (e) {
      if (e instanceof Error && e.message === "BOT_OR_GUILD_MISSING") {
        throw new AppError(400, "Ajoute le bot sur ce serveur pour charger les catégories.", "BOT_REQUIRED");
      }
      throw new AppError(
        503,
        "Impossible de joindre Discord pour les catégories. Réessaie dans un instant.",
        "DISCORD_UNAVAILABLE",
      );
    }
  }),
);

guildsRouter.get(
  "/:discordGuildId/meta/text-channels",
  requireSession,
  requireGuildAccess,
  asyncHandler(async (req, res) => {
    const env = loadEnv();
    try {
      const channels = await getGuildTextChannels(req.params.discordGuildId, env.DISCORD_BOT_TOKEN);
      res.json({ channels });
    } catch (e) {
      if (e instanceof Error && e.message === "BOT_OR_GUILD_MISSING") {
        throw new AppError(400, "Ajoute le bot sur ce serveur pour charger les salons texte.", "BOT_REQUIRED");
      }
      throw new AppError(
        503,
        "Impossible de joindre Discord pour charger les salons texte. Réessaie dans un instant.",
        "DISCORD_UNAVAILABLE",
      );
    }
  }),
);

guildsRouter.get(
  "/:discordGuildId/meta/threads",
  requireSession,
  requireGuildAccess,
  asyncHandler(async (req, res) => {
    const env = loadEnv();
    try {
      const threads = await getGuildThreads(req.params.discordGuildId, env.DISCORD_BOT_TOKEN);
      res.json({ threads });
    } catch (e) {
      if (e instanceof Error && e.message === "BOT_OR_GUILD_MISSING") {
        throw new AppError(400, "Ajoute le bot sur ce serveur pour charger les fils.", "BOT_REQUIRED");
      }
      throw new AppError(
        503,
        "Impossible de joindre Discord pour charger les fils. Réessaie dans un instant.",
        "DISCORD_UNAVAILABLE",
      );
    }
  }),
);

guildsRouter.get(
  "/:discordGuildId/embeds",
  requireSession,
  requireGuildAccess,
  asyncHandler(async (req, res) => {
    const list = await listEmbedTemplates(
      prisma,
      req.params.discordGuildId,
      req.discordGuildAccess?.name,
    );
    res.json({ embeds: list });
  }),
);

guildsRouter.post(
  "/:discordGuildId/embeds",
  requireSession,
  requireGuildAccess,
  asyncHandler(async (req, res) => {
    const created = await createEmbedTemplate(
      prisma,
      req.params.discordGuildId,
      req.discordGuildAccess?.name,
      req.body,
    );
    res.status(201).json({ embed: created });
  }),
);

guildsRouter.patch(
  "/:discordGuildId/embeds/:embedId",
  requireSession,
  requireGuildAccess,
  asyncHandler(async (req, res) => {
    const updated = await updateEmbedTemplate(
      prisma,
      req.params.discordGuildId,
      req.discordGuildAccess?.name,
      req.params.embedId,
      req.body,
    );
    res.json({ embed: updated });
  }),
);

guildsRouter.delete(
  "/:discordGuildId/embeds/:embedId",
  requireSession,
  requireGuildAccess,
  asyncHandler(async (req, res) => {
    await deleteEmbedTemplate(
      prisma,
      req.params.discordGuildId,
      req.discordGuildAccess?.name,
      req.params.embedId,
    );
    res.status(204).end();
  }),
);

guildsRouter.post(
  "/:discordGuildId/embeds/send",
  requireSession,
  requireGuildAccess,
  asyncHandler(async (req, res) => {
    const env = loadEnv();
    const result = await sendTemplateMessagesToChannel(req.params.discordGuildId, env.DISCORD_BOT_TOKEN, req.body);
    res.status(201).json(result);
  }),
);

guildsRouter.get(
  "/:discordGuildId/ticket-settings",
  requireSession,
  requireGuildAccess,
  asyncHandler(async (req, res) => {
    const settings = await getGuildTicketSettingsDto(prisma, req.params.discordGuildId);
    res.json({ settings: settings ?? null });
  }),
);

guildsRouter.patch(
  "/:discordGuildId/ticket-settings",
  requireSession,
  requireGuildAccess,
  asyncHandler(async (req, res) => {
    const env = loadEnv();
    const updated = await upsertGuildTicketSettings(
      prisma,
      req.params.discordGuildId,
      req.discordGuildAccess?.name,
      req.body,
    );
    const panelSync = await syncTicketPanelMessageDiscord(prisma, req.params.discordGuildId, env.DISCORD_BOT_TOKEN);
    res.json({
      settings: updated,
      panelSyncWarning: panelSync.ok ? null : panelSync.message,
    });
  }),
);

guildsRouter.get(
  "/:discordGuildId/modules/welcome-goodbye",
  requireSession,
  requireGuildAccess,
  asyncHandler(async (req, res) => {
    const settings = await getWelcomeGoodbyeSettings(prisma, req.params.discordGuildId);
    res.json({ settings });
  }),
);

guildsRouter.patch(
  "/:discordGuildId/modules/welcome-goodbye",
  requireSession,
  requireGuildAccess,
  asyncHandler(async (req, res) => {
    const updated = await upsertWelcomeGoodbyeSettings(
      prisma,
      req.params.discordGuildId,
      req.discordGuildAccess?.name ?? null,
      req.body,
    );
    res.json({ settings: updated });
  }),
);

guildsRouter.get(
  "/:discordGuildId/modules/join-auto-roles",
  requireSession,
  requireGuildAccess,
  asyncHandler(async (req, res) => {
    const settings = await getJoinAutoRoleSettings(prisma, req.params.discordGuildId);
    res.json({ settings });
  }),
);

guildsRouter.patch(
  "/:discordGuildId/modules/join-auto-roles",
  requireSession,
  requireGuildAccess,
  asyncHandler(async (req, res) => {
    const updated = await upsertJoinAutoRoleSettings(
      prisma,
      req.params.discordGuildId,
      req.discordGuildAccess?.name ?? null,
      req.body,
    );
    res.json({ settings: updated });
  }),
);

guildsRouter.get(
  "/:discordGuildId/modules/join-verification",
  requireSession,
  requireGuildAccess,
  asyncHandler(async (req, res) => {
    const settings = await getJoinVerificationSettings(prisma, req.params.discordGuildId);
    res.json({ settings });
  }),
);

guildsRouter.patch(
  "/:discordGuildId/modules/join-verification",
  requireSession,
  requireGuildAccess,
  asyncHandler(async (req, res) => {
    const env = loadEnv();
    const updated = await upsertJoinVerificationSettings(
      prisma,
      req.params.discordGuildId,
      req.discordGuildAccess?.name ?? null,
      req.body,
    );
    const panelSync = await syncJoinVerificationPanelDiscord(
      prisma,
      req.params.discordGuildId,
      env.DISCORD_BOT_TOKEN,
    );
    res.json({
      settings: updated,
      panelSyncWarning: panelSync.ok ? null : panelSync.message,
    });
  }),
);

guildsRouter.get(
  "/:discordGuildId/tickets",
  requireSession,
  requireGuildAccess,
  asyncHandler(async (req, res) => {
    const status = String(req.query.status ?? "").toUpperCase();
    if (status !== "OPEN" && status !== "CLOSED" && status !== "ARCHIVED") {
      throw new AppError(400, "Paramètre status invalide (OPEN, CLOSED ou ARCHIVED).", "INVALID_QUERY");
    }
    const env = loadEnv();
    const tickets = await listTicketsForGuild(
      prisma,
      req.params.discordGuildId,
      status as "OPEN" | "CLOSED" | "ARCHIVED",
      env.DISCORD_BOT_TOKEN,
    );
    res.json({ tickets });
  }),
);

guildsRouter.get(
  "/:discordGuildId/tickets/:ticketId",
  requireSession,
  requireGuildAccess,
  asyncHandler(async (req, res) => {
    const env = loadEnv();
    const detail = await getTicketDetailForGuild(
      prisma,
      req.params.discordGuildId,
      req.params.ticketId,
      env.DISCORD_BOT_TOKEN,
    );
    if (!detail) {
      throw new AppError(404, "Ticket introuvable.", "NOT_FOUND");
    }
    res.json(detail);
  }),
);

guildsRouter.get(
  "/:discordGuildId/tickets/:ticketId/live-messages",
  requireSession,
  requireGuildAccess,
  asyncHandler(async (req, res) => {
    const env = loadEnv();
    const messages = await fetchTicketChannelMessages(
      prisma,
      req.params.discordGuildId,
      req.params.ticketId,
      env.DISCORD_BOT_TOKEN,
    );
    res.json({ messages });
  }),
);

guildsRouter.get(
  "/:discordGuildId/structure",
  requireSession,
  requireGuildAccess,
  asyncHandler(async (req, res) => {
    const env = loadEnv();
    const refresh = String(req.query.refresh ?? "") === "1" || String(req.query.refresh ?? "") === "true";
    const result = await getOrRefreshGuildStructure(
      prisma,
      req.params.discordGuildId,
      req.discordGuildAccess?.name,
      env.DISCORD_BOT_TOKEN,
      refresh,
    );
    res.json(result);
  }),
);

guildsRouter.get(
  "/:discordGuildId/server-templates",
  requireSession,
  requireGuildAccess,
  asyncHandler(async (req, res) => {
    const list = await listServerTemplates(prisma, req.params.discordGuildId);
    res.json({ templates: list });
  }),
);

guildsRouter.post(
  "/:discordGuildId/server-templates",
  requireSession,
  requireGuildAccess,
  asyncHandler(async (req, res) => {
    const env = loadEnv();
    const user = req.session.discordUser!;
    const created = await createServerTemplateFromGuild(
      prisma,
      req.params.discordGuildId,
      req.discordGuildAccess?.name,
      user,
      env.DISCORD_BOT_TOKEN,
      req.body,
    );
    res.status(201).json({ template: created });
  }),
);

guildsRouter.get(
  "/:discordGuildId/server-templates/:templateId",
  requireSession,
  requireGuildAccess,
  asyncHandler(async (req, res) => {
    const detail = await getServerTemplateDetail(
      prisma,
      req.params.discordGuildId,
      req.params.templateId,
    );
    res.json({ template: detail });
  }),
);

guildsRouter.patch(
  "/:discordGuildId/server-templates/:templateId",
  requireSession,
  requireGuildAccess,
  asyncHandler(async (req, res) => {
    const updated = await updateServerTemplate(
      prisma,
      req.params.discordGuildId,
      req.params.templateId,
      req.body,
    );
    res.json({ template: updated });
  }),
);

guildsRouter.delete(
  "/:discordGuildId/server-templates/:templateId",
  requireSession,
  requireGuildAccess,
  asyncHandler(async (req, res) => {
    await deleteServerTemplate(prisma, req.params.discordGuildId, req.params.templateId);
    res.status(204).end();
  }),
);

guildsRouter.post(
  "/:discordGuildId/server-templates/:templateId/preview",
  requireSession,
  requireGuildAccess,
  asyncHandler(async (req, res) => {
    const env = loadEnv();
    const result = await previewServerTemplateApply(
      prisma,
      req.params.discordGuildId,
      req.discordGuildAccess?.name,
      env.DISCORD_BOT_TOKEN,
      req.params.templateId,
    );
    res.json(result);
  }),
);

// Stream SSE pour appliquer un template — chaque opération émet un événement de progression.
guildsRouter.post(
  "/:discordGuildId/server-templates/:templateId/apply",
  requireSession,
  requireGuildAccess,
  asyncHandler(async (req, res) => {
    const env = loadEnv();
    const discordGuildId = req.params.discordGuildId;
    const templateId = req.params.templateId;

    // Vérification permissions du bot avant tout.
    const botSelf = await getDiscordBotSelfCached(env.DISCORD_BOT_TOKEN);
    if (!botSelf) {
      throw new AppError(500, "Impossible de récupérer le profil du bot.", "BOT_SELF_UNKNOWN");
    }
    const perms = await checkBotPermissionsOnGuild(
      discordGuildId,
      env.DISCORD_BOT_TOKEN,
      botSelf.id,
    );
    const permsError = botPermissionsErrorMessage(perms);
    if (permsError) {
      throw new AppError(403, permsError, "BOT_MISSING_PERMISSIONS");
    }

    // Récupérer template + structure actuelle (force refresh pour avoir les vrais IDs Discord).
    const detail = await getServerTemplateDetail(prisma, discordGuildId, templateId);
    const current = await getOrRefreshGuildStructure(
      prisma,
      discordGuildId,
      req.discordGuildAccess?.name,
      env.DISCORD_BOT_TOKEN,
      true,
    );
    const plan = buildApplyPlan(current.snapshot, detail.snapshot);

    // SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    const send = (event: unknown) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    try {
      for await (const ev of applyServerTemplate(
        discordGuildId,
        env.DISCORD_BOT_TOKEN,
        plan,
        current.snapshot,
        detail.snapshot,
      )) {
        send(ev);
      }
    } catch (err) {
      send({
        type: "fatal",
        error: err instanceof Error ? err.message : "Erreur inattendue.",
      });
    } finally {
      await invalidateGuildStructureCache(prisma, discordGuildId);
      res.end();
    }
  }),
);

// ---------------------------------------------------------------------------
// Page « Commandes » : commandes natives (settings par serveur) et commandes
// personnalisées (CRUD + synchronisation Discord).
// ---------------------------------------------------------------------------

guildsRouter.get(
  "/:discordGuildId/commands/native",
  requireSession,
  requireGuildAccess,
  asyncHandler(async (req, res) => {
    const list = await listNativeCommandSettings(
      prisma,
      req.params.discordGuildId,
      req.discordGuildAccess?.name ?? null,
    );
    res.json({ commands: list });
  }),
);

guildsRouter.patch(
  "/:discordGuildId/commands/native/:commandName",
  requireSession,
  requireGuildAccess,
  asyncHandler(async (req, res) => {
    const updated = await updateNativeCommandSetting(
      prisma,
      req.params.discordGuildId,
      req.discordGuildAccess?.name ?? null,
      req.params.commandName,
      req.body,
    );
    res.json({ command: updated });
  }),
);

guildsRouter.get(
  "/:discordGuildId/commands/custom",
  requireSession,
  requireGuildAccess,
  asyncHandler(async (req, res) => {
    const list = await listCustomSlashCommands(
      prisma,
      req.params.discordGuildId,
      req.discordGuildAccess?.name ?? null,
    );
    res.json({ commands: list });
  }),
);

guildsRouter.post(
  "/:discordGuildId/commands/custom",
  requireSession,
  requireGuildAccess,
  asyncHandler(async (req, res) => {
    const env = loadEnv();
    const created = await createCustomSlashCommand(
      prisma,
      req.params.discordGuildId,
      req.discordGuildAccess?.name ?? null,
      req.body,
      env.DISCORD_CLIENT_ID,
      env.DISCORD_BOT_TOKEN,
    );
    res.status(201).json({ command: created });
  }),
);

guildsRouter.get(
  "/:discordGuildId/commands/custom/:commandId",
  requireSession,
  requireGuildAccess,
  asyncHandler(async (req, res) => {
    const cmd = await getCustomSlashCommand(
      prisma,
      req.params.discordGuildId,
      req.params.commandId,
    );
    res.json({ command: cmd });
  }),
);

guildsRouter.patch(
  "/:discordGuildId/commands/custom/:commandId",
  requireSession,
  requireGuildAccess,
  asyncHandler(async (req, res) => {
    const env = loadEnv();
    const updated = await updateCustomSlashCommand(
      prisma,
      req.params.discordGuildId,
      req.params.commandId,
      req.body,
      env.DISCORD_CLIENT_ID,
      env.DISCORD_BOT_TOKEN,
    );
    res.json({ command: updated });
  }),
);

guildsRouter.delete(
  "/:discordGuildId/commands/custom/:commandId",
  requireSession,
  requireGuildAccess,
  asyncHandler(async (req, res) => {
    const env = loadEnv();
    await deleteCustomSlashCommand(
      prisma,
      req.params.discordGuildId,
      req.params.commandId,
      env.DISCORD_CLIENT_ID,
      env.DISCORD_BOT_TOKEN,
    );
    res.status(204).end();
  }),
);
