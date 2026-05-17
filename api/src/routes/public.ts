import { Router } from "express";
import { z } from "zod";
import { loadEnv } from "../config/env.js";
import { prisma } from "../db.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { trackingFromRequest } from "../lib/trackingCookies.js";
import { hashIp, networkMetadataFromRequest, recordBotInviteClick, recordProductEvent } from "../services/metricsService.js";
import { buildDiscordBotInviteUrl } from "../services/eligibleGuilds.js";

export const publicRouter = Router();

const eventSchema = z.object({
  type: z.string().min(1).max(80),
  source: z.string().max(80).optional(),
  path: z.string().max(300).optional(),
  referrer: z.string().max(500).optional(),
  visitorId: z.string().max(100).optional(),
  sessionId: z.string().max(100).optional(),
  discordGuildId: z.string().max(32).optional(),
  metadata: z.unknown().optional(),
});

publicRouter.post(
  "/events",
  asyncHandler(async (req, res) => {
    const parsed = eventSchema.safeParse(req.body);
    if (parsed.success) {
      const tracking = trackingFromRequest(req);
      const source = parsed.data.source ?? "";
      const isPanelEvent = source === "panel" || source.startsWith("panel_");
      await recordProductEvent(prisma, {
        ...parsed.data,
        visitorId: parsed.data.visitorId ?? tracking.visitorId,
        sessionId: parsed.data.sessionId ?? tracking.sessionId,
        discordUserId: isPanelEvent ? req.session.discordUser?.id : null,
        metadata: {
          ...(parsed.data.metadata && typeof parsed.data.metadata === "object" ? parsed.data.metadata as Record<string, unknown> : {}),
          network: networkMetadataFromRequest(req),
        },
      });
    }
    res.status(204).end();
  }),
);

publicRouter.get(
  "/bot-invite",
  asyncHandler(async (req, res) => {
    const env = loadEnv();
    const source = typeof req.query.source === "string" ? req.query.source : "unknown";
    const guildId = typeof req.query.guildId === "string" ? req.query.guildId : null;
    const tracking = trackingFromRequest(req);

    await recordBotInviteClick(prisma, {
      source,
      discordGuildId: guildId,
      visitorId: tracking.visitorId,
      sessionId: tracking.sessionId,
      userAgent: req.get("user-agent"),
      ipHash: hashIp(req.ip),
    });
    await recordProductEvent(prisma, {
      type: "bot_invite_click",
      source,
      path: "/api/public/bot-invite",
      visitorId: tracking.visitorId,
      sessionId: tracking.sessionId,
      discordGuildId: guildId,
      metadata: { network: networkMetadataFromRequest(req) },
    });

    res.redirect(buildDiscordBotInviteUrl(env.DISCORD_CLIENT_ID, guildId));
  }),
);
