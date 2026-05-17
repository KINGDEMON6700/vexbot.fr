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
  findEmbedTemplateDtoById,
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
import { businessEventMetadata, networkMetadataFromRequest, recordProductEvent } from "../services/metricsService.js";
import { trackingFromRequest } from "../lib/trackingCookies.js";

export const guildsRouter = Router();

async function trackPanelAction(req: import("express").Request, event: Parameters<typeof recordProductEvent>[1] & { type: string }) {
  const tracking = trackingFromRequest(req);
  await recordProductEvent(prisma, {
    ...event,
    source: "panel",
    visitorId: tracking.visitorId,
    sessionId: tracking.sessionId,
    discordUserId: req.session.discordUser?.id,
    metadata: {
      ...(event.metadata && typeof event.metadata === "object" ? event.metadata as Record<string, unknown> : {}),
      network: networkMetadataFromRequest(req),
    },
  });
}

guildsRouter.get(
  "/eligible",
  requireSession,
  asyncHandler(async (req, res) => {
    const env = loadEnv();
    const guilds = req.session.discordGuilds ?? [];
    const list = await buildEligibleGuildList(
      guilds,
      env.DISCORD_CLIENT_ID,
      env.DISCORD_BOT_TOKEN,
      env.FRONTEND_URL,
    );
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
      env.FRONTEND_URL,
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

    await trackPanelAction(req, {
      type: "bot_profile_updated",
      discordUserId: req.session.discordUser?.id,
      discordGuildId: req.params.discordGuildId,
      metadata: businessEventMetadata({
        entity: "bot",
        action: "update",
        name: "Apparence du bot",
        target: req.discordGuildAccess?.name ?? req.params.discordGuildId,
        after: {
          nicknameChanged: Object.prototype.hasOwnProperty.call(raw, "nickname"),
          avatarChanged: Object.prototype.hasOwnProperty.call(raw, "avatar"),
          bannerChanged: Object.prototype.hasOwnProperty.call(raw, "banner"),
        },
      }),
    });

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

    await trackPanelAction(req, {
      type: "bot_nickname_updated",
      discordUserId: req.session.discordUser?.id,
      discordGuildId: req.params.discordGuildId,
      metadata: businessEventMetadata({
        entity: "bot",
        action: "update",
        name: "Pseudo du bot",
        target: nickname ?? "Pseudo retiré",
        after: { nickname },
      }),
    });

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
    await trackPanelAction(req, {
      type: "embed_created",
      discordUserId: req.session.discordUser?.id,
      discordGuildId: req.params.discordGuildId,
      metadata: businessEventMetadata({
        entity: "embed",
        action: "create",
        name: created.name,
        target: req.discordGuildAccess?.name ?? req.params.discordGuildId,
        embedId: created.id,
        messagesCount: created.messages.length,
      }),
    });
    res.status(201).json({ embed: created });
  }),
);

guildsRouter.patch(
  "/:discordGuildId/embeds/:embedId",
  requireSession,
  requireGuildAccess,
  asyncHandler(async (req, res) => {
    const before = await findEmbedTemplateDtoById(prisma, req.params.discordGuildId, req.params.embedId);
    const updated = await updateEmbedTemplate(
      prisma,
      req.params.discordGuildId,
      req.discordGuildAccess?.name,
      req.params.embedId,
      req.body,
    );
    await trackPanelAction(req, {
      type: "embed_updated",
      discordUserId: req.session.discordUser?.id,
      discordGuildId: req.params.discordGuildId,
      metadata: businessEventMetadata({
        entity: "embed",
        action: "update",
        name: updated.name,
        target: req.discordGuildAccess?.name ?? req.params.discordGuildId,
        embedId: updated.id,
        before: before ? { name: before.name, messagesCount: before.messages.length } : undefined,
        after: { name: updated.name, messagesCount: updated.messages.length },
      }),
    });
    res.json({ embed: updated });
  }),
);

guildsRouter.delete(
  "/:discordGuildId/embeds/:embedId",
  requireSession,
  requireGuildAccess,
  asyncHandler(async (req, res) => {
    const before = await findEmbedTemplateDtoById(prisma, req.params.discordGuildId, req.params.embedId);
    await deleteEmbedTemplate(
      prisma,
      req.params.discordGuildId,
      req.discordGuildAccess?.name,
      req.params.embedId,
    );
    await trackPanelAction(req, {
      type: "embed_deleted",
      discordUserId: req.session.discordUser?.id,
      discordGuildId: req.params.discordGuildId,
      metadata: businessEventMetadata({
        entity: "embed",
        action: "delete",
        name: before?.name ?? req.params.embedId,
        target: req.discordGuildAccess?.name ?? req.params.discordGuildId,
        embedId: req.params.embedId,
        before: before ? { name: before.name, messagesCount: before.messages.length } : undefined,
      }),
    });
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
    const body = req.body as { embedId?: unknown; templateName?: unknown; channelId?: unknown; threadId?: unknown };
    const embedId = typeof body.embedId === "string" ? body.embedId : null;
    const template = embedId ? await findEmbedTemplateDtoById(prisma, req.params.discordGuildId, embedId) : null;
    await trackPanelAction(req, {
      type: "embed_sent",
      discordUserId: req.session.discordUser?.id,
      discordGuildId: req.params.discordGuildId,
      metadata: businessEventMetadata({
        entity: "embed",
        action: "send",
        name: template?.name ?? (typeof body.templateName === "string" ? body.templateName : "Embed"),
        target: typeof body.channelId === "string" ? body.channelId : typeof body.threadId === "string" ? body.threadId : null,
        embedId,
        sentCount: (result as { sent?: unknown }).sent,
      }),
    });
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
    const before = await getGuildTicketSettingsDto(prisma, req.params.discordGuildId);
    const updated = await upsertGuildTicketSettings(
      prisma,
      req.params.discordGuildId,
      req.discordGuildAccess?.name,
      req.body,
    );
    await trackPanelAction(req, {
      type: "ticket_settings_updated",
      discordUserId: req.session.discordUser?.id,
      discordGuildId: req.params.discordGuildId,
      metadata: businessEventMetadata({
        entity: "ticket",
        action: "configure",
        name: "Réglages tickets",
        target: req.discordGuildAccess?.name ?? req.params.discordGuildId,
        before: before
          ? {
              panelChannelId: before.panelChannelId,
              ticketCategoryId: before.ticketCategoryId,
              panelEmbedId: before.panelEmbedId,
              welcomeEmbedId: before.welcomeEmbedId,
              maxOpenTicketsPerOpener: before.maxOpenTicketsPerOpener,
            }
          : undefined,
        after: {
          panelChannelId: updated.panelChannelId,
          ticketCategoryId: updated.ticketCategoryId,
          panelEmbedId: updated.panelEmbedId,
          welcomeEmbedId: updated.welcomeEmbedId,
          maxOpenTicketsPerOpener: updated.maxOpenTicketsPerOpener,
        },
      }),
    });
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
    await trackPanelAction(req, {
      type: "welcome_module_updated",
      discordUserId: req.session.discordUser?.id,
      discordGuildId: req.params.discordGuildId,
      metadata: businessEventMetadata({
        entity: "module",
        action: "configure",
        name: "Arrivées et départs",
        target: req.discordGuildAccess?.name ?? req.params.discordGuildId,
        after: updated,
      }),
    });
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
    await trackPanelAction(req, {
      type: "autorole_module_updated",
      discordUserId: req.session.discordUser?.id,
      discordGuildId: req.params.discordGuildId,
      metadata: businessEventMetadata({
        entity: "module",
        action: "configure",
        name: "Rôles auto",
        target: req.discordGuildAccess?.name ?? req.params.discordGuildId,
        after: updated,
      }),
    });
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
    await trackPanelAction(req, {
      type: "verification_module_updated",
      discordUserId: req.session.discordUser?.id,
      discordGuildId: req.params.discordGuildId,
      metadata: businessEventMetadata({
        entity: "module",
        action: "configure",
        name: "Vérification",
        target: req.discordGuildAccess?.name ?? req.params.discordGuildId,
        after: updated,
      }),
    });
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
    await trackPanelAction(req, {
      type: "ticket_viewed",
      discordUserId: req.session.discordUser?.id,
      discordGuildId: req.params.discordGuildId,
      metadata: businessEventMetadata({
        entity: "ticket",
        action: "view",
        name: `Ticket ${(detail as { ticketNumber?: unknown }).ticketNumber ?? req.params.ticketId}`,
        target: (detail as { channelId?: string }).channelId ?? null,
        ticketId: req.params.ticketId,
        status: (detail as { status?: unknown }).status,
      }),
    });
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
    await trackPanelAction(req, {
      type: "server_template_created",
      discordUserId: req.session.discordUser?.id,
      discordGuildId: req.params.discordGuildId,
      metadata: businessEventMetadata({
        entity: "template",
        action: "create",
        name: created.name,
        target: req.discordGuildAccess?.name ?? req.params.discordGuildId,
        templateId: created.id,
        after: {
          rolesCount: created.rolesCount,
          channelsCount: created.channelsCount,
          categoriesCount: created.categoriesCount,
        },
      }),
    });
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
    const before = await getServerTemplateDetail(prisma, req.params.discordGuildId, req.params.templateId);
    const updated = await updateServerTemplate(
      prisma,
      req.params.discordGuildId,
      req.params.templateId,
      req.body,
    );
    await trackPanelAction(req, {
      type: "server_template_updated",
      discordUserId: req.session.discordUser?.id,
      discordGuildId: req.params.discordGuildId,
      metadata: businessEventMetadata({
        entity: "template",
        action: "update",
        name: updated.name,
        target: req.discordGuildAccess?.name ?? req.params.discordGuildId,
        templateId: updated.id,
        before: { name: before.name, description: before.description },
        after: { name: updated.name, description: updated.description },
      }),
    });
    res.json({ template: updated });
  }),
);

guildsRouter.delete(
  "/:discordGuildId/server-templates/:templateId",
  requireSession,
  requireGuildAccess,
  asyncHandler(async (req, res) => {
    const before = await getServerTemplateDetail(prisma, req.params.discordGuildId, req.params.templateId);
    await deleteServerTemplate(prisma, req.params.discordGuildId, req.params.templateId);
    await trackPanelAction(req, {
      type: "server_template_deleted",
      discordUserId: req.session.discordUser?.id,
      discordGuildId: req.params.discordGuildId,
      metadata: businessEventMetadata({
        entity: "template",
        action: "delete",
        name: before.name,
        target: req.discordGuildAccess?.name ?? req.params.discordGuildId,
        templateId: req.params.templateId,
        before: {
          rolesCount: before.rolesCount,
          channelsCount: before.channelsCount,
          categoriesCount: before.categoriesCount,
        },
      }),
    });
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
    await trackPanelAction(req, {
      type: "server_template_apply_previewed",
      discordUserId: req.session.discordUser?.id,
      discordGuildId: req.params.discordGuildId,
      metadata: businessEventMetadata({
        entity: "template",
        action: "preview",
        name: (result as { templateName?: string }).templateName ?? req.params.templateId,
        target: req.discordGuildAccess?.name ?? req.params.discordGuildId,
        templateId: req.params.templateId,
      }),
    });
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
    await trackPanelAction(req, {
      type: "server_template_apply_started",
      discordUserId: req.session.discordUser?.id,
      discordGuildId,
      metadata: businessEventMetadata({
        entity: "template",
        action: "apply",
        name: detail.name,
        target: req.discordGuildAccess?.name ?? discordGuildId,
        templateId,
        success: true,
      }),
    });

    // SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    const send = (event: unknown) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    let failed = false;
    try {
      for await (const ev of applyServerTemplate(
        discordGuildId,
        env.DISCORD_BOT_TOKEN,
        plan,
        current.snapshot,
        detail.snapshot,
      )) {
        if ((ev as { type?: unknown }).type === "fatal") failed = true;
        send(ev);
      }
    } catch (err) {
      failed = true;
      send({
        type: "fatal",
        error: err instanceof Error ? err.message : "Erreur inattendue.",
      });
    } finally {
      await invalidateGuildStructureCache(prisma, discordGuildId);
      await trackPanelAction(req, {
        type: failed ? "server_template_apply_failed" : "server_template_apply_finished",
        discordUserId: req.session.discordUser?.id,
        discordGuildId,
        metadata: businessEventMetadata({
          entity: "template",
          action: "apply",
          name: detail.name,
          target: req.discordGuildAccess?.name ?? discordGuildId,
          templateId,
          success: !failed,
        }),
      });
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
    await trackPanelAction(req, {
      type: "native_command_updated",
      discordUserId: req.session.discordUser?.id,
      discordGuildId: req.params.discordGuildId,
      metadata: businessEventMetadata({
        entity: "command",
        action: "configure",
        name: `/${updated.commandName}`,
        target: req.discordGuildAccess?.name ?? req.params.discordGuildId,
        after: {
          enabled: updated.enabled,
          allowedRoleCount: updated.allowedRoleIds.length,
          allowedChannelCount: updated.allowedChannelIds.length,
        },
      }),
    });
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
    await trackPanelAction(req, {
      type: "custom_command_created",
      discordUserId: req.session.discordUser?.id,
      discordGuildId: req.params.discordGuildId,
      metadata: businessEventMetadata({
        entity: "command",
        action: "create",
        name: `/${created.name}`,
        target: req.discordGuildAccess?.name ?? req.params.discordGuildId,
        commandId: created.id,
        after: {
          responseType: created.responseType,
          enabled: created.enabled,
          ephemeral: created.ephemeral,
        },
      }),
    });
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
    const before = await getCustomSlashCommand(prisma, req.params.discordGuildId, req.params.commandId);
    const updated = await updateCustomSlashCommand(
      prisma,
      req.params.discordGuildId,
      req.params.commandId,
      req.body,
      env.DISCORD_CLIENT_ID,
      env.DISCORD_BOT_TOKEN,
    );
    await trackPanelAction(req, {
      type: "custom_command_updated",
      discordUserId: req.session.discordUser?.id,
      discordGuildId: req.params.discordGuildId,
      metadata: businessEventMetadata({
        entity: "command",
        action: "update",
        name: `/${updated.name}`,
        target: req.discordGuildAccess?.name ?? req.params.discordGuildId,
        commandId: updated.id,
        before: { name: before.name, enabled: before.enabled, responseType: before.responseType },
        after: { name: updated.name, enabled: updated.enabled, responseType: updated.responseType },
      }),
    });
    res.json({ command: updated });
  }),
);

guildsRouter.delete(
  "/:discordGuildId/commands/custom/:commandId",
  requireSession,
  requireGuildAccess,
  asyncHandler(async (req, res) => {
    const env = loadEnv();
    const before = await getCustomSlashCommand(prisma, req.params.discordGuildId, req.params.commandId);
    await deleteCustomSlashCommand(
      prisma,
      req.params.discordGuildId,
      req.params.commandId,
      env.DISCORD_CLIENT_ID,
      env.DISCORD_BOT_TOKEN,
    );
    await trackPanelAction(req, {
      type: "custom_command_deleted",
      discordUserId: req.session.discordUser?.id,
      discordGuildId: req.params.discordGuildId,
      metadata: businessEventMetadata({
        entity: "command",
        action: "delete",
        name: `/${before.name}`,
        target: req.discordGuildAccess?.name ?? req.params.discordGuildId,
        commandId: req.params.commandId,
        before: { name: before.name, responseType: before.responseType },
      }),
    });
    res.status(204).end();
  }),
);
