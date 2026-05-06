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
import { getGuildChannelsAndRoles, getGuildTextChannels } from "../services/discordGuildMeta.js";
import { sendTemplateMessagesToChannel } from "../services/embedSendService.js";

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
