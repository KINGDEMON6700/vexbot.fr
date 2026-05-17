import { Router } from "express";
import { loadEnv } from "../config/env.js";
import { prisma } from "../db.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { AppError } from "../lib/AppError.js";
import { requireSession } from "../middleware/requireSession.js";
import { isGuildEligibleForPanel } from "../services/eligibleGuilds.js";
import { businessEventMetadata, networkMetadataFromRequest, recordProductEvent } from "../services/metricsService.js";
import { trackingFromRequest } from "../lib/trackingCookies.js";

export const accountRouter = Router();

const DISCORD_API = "https://discord.com/api/v10";

type LeaveGuildResult =
  | { id: string; name: string; status: "left" }
  | { id: string; name: string; status: "not_present" }
  | { id: string; name: string; status: "failed"; code: number };

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function leaveDiscordGuildWithRetry(
  guild: { id: string; name: string },
  botToken: string,
): Promise<LeaveGuildResult> {
  let lastStatus = 0;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const discordRes = await fetch(`${DISCORD_API}/users/@me/guilds/${encodeURIComponent(guild.id)}`, {
      method: "DELETE",
      headers: { Authorization: `Bot ${botToken}` },
    });

    if (discordRes.status === 204) {
      return { id: guild.id, name: guild.name, status: "left" };
    }
    if (discordRes.status === 404) {
      return { id: guild.id, name: guild.name, status: "not_present" };
    }

    lastStatus = discordRes.status;

    if (discordRes.status === 429) {
      const retryAfter = Number.parseFloat(discordRes.headers.get("retry-after") ?? "");
      await wait(Number.isFinite(retryAfter) ? Math.ceil(retryAfter * 1000) : 1500);
      continue;
    }

    if (discordRes.status >= 500) {
      await wait(1000 * (attempt + 1));
      continue;
    }

    break;
  }

  return { id: guild.id, name: guild.name, status: "failed", code: lastStatus };
}

accountRouter.post(
  "/reset",
  requireSession,
  asyncHandler(async (req, res) => {
    const body = req.body as { confirmation?: unknown };
    if (body.confirmation !== "RESET") {
      throw new AppError(400, "Écris RESET pour confirmer la réinitialisation.", "RESET_CONFIRMATION_REQUIRED");
    }

    const user = req.session.discordUser!;
    const guildDiscordIds = (req.session.discordGuilds ?? [])
      .filter(isGuildEligibleForPanel)
      .map((guild) => guild.id);

    await prisma.$transaction([
      prisma.marketplaceTemplateLike.deleteMany({ where: { discordUserId: user.id } }),
      prisma.marketplaceTemplateComment.deleteMany({ where: { discordUserId: user.id } }),
      prisma.marketplacePublication.deleteMany({ where: { discordUserId: user.id } }),
      prisma.joinVerificationCaptcha.deleteMany({ where: { discordUserId: user.id } }),
      prisma.guild.deleteMany({ where: { discordId: { in: guildDiscordIds } } }),
    ]);

    const tracking = trackingFromRequest(req);
    await recordProductEvent(prisma, {
      type: "account_reset_confirmed",
      source: "panel",
      visitorId: tracking.visitorId,
      sessionId: tracking.sessionId,
      discordUserId: user.id,
      metadata: {
        ...businessEventMetadata({
          entity: "account",
          action: "delete",
          name: user.username,
          target: "Données panel du compte",
          affectedGuildCount: guildDiscordIds.length,
        }),
        network: networkMetadataFromRequest(req),
      },
    });

    await new Promise<void>((resolve, reject) => {
      req.session.destroy((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    res.status(204).end();
  }),
);

accountRouter.post(
  "/bot/leave-accessible-guilds",
  requireSession,
  asyncHandler(async (req, res) => {
    const body = req.body as { confirmation?: unknown };
    if (body.confirmation !== "QUITTER") {
      throw new AppError(400, "Écris QUITTER pour confirmer le retrait du bot.", "LEAVE_CONFIRMATION_REQUIRED");
    }

    const env = loadEnv();
    const eligibleGuilds = (req.session.discordGuilds ?? []).filter(isGuildEligibleForPanel);

    const results: LeaveGuildResult[] = [];
    for (const guild of eligibleGuilds) {
      results.push(await leaveDiscordGuildWithRetry(guild, env.DISCORD_BOT_TOKEN));
    }

    const left = results.filter((r) => r.status === "left").length;
    const notPresent = results.filter((r) => r.status === "not_present").length;
    const failed = results.filter((r) => r.status === "failed").length;
    const tracking = trackingFromRequest(req);

    await recordProductEvent(prisma, {
      type: "bot_left_accessible_guilds",
      source: "panel",
      visitorId: tracking.visitorId,
      sessionId: tracking.sessionId,
      discordUserId: req.session.discordUser?.id,
      metadata: {
        ...businessEventMetadata({
          entity: "bot",
          action: "delete",
          name: "Retrait du bot",
          target: "Serveurs accessibles",
          success: failed === 0,
          after: { left, notPresent, failed },
        }),
        network: networkMetadataFromRequest(req),
      },
    });

    res.json({ left, notPresent, failed, results });
  }),
);
