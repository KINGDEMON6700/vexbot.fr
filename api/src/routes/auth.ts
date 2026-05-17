import { randomBytes } from "node:crypto";
import { Router } from "express";
import { loadEnv } from "../config/env.js";
import { prisma } from "../db.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { AppError } from "../lib/AppError.js";
import { trackingFromRequest } from "../lib/trackingCookies.js";
import { requireSession } from "../middleware/requireSession.js";
import { ensureCsrfToken } from "../middleware/csrf.js";
import { isAdminDiscordUser } from "../middleware/requireAdmin.js";
import { networkMetadataFromRequest, recordPanelLogin, recordProductEvent } from "../services/metricsService.js";
import {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  fetchDiscordGuilds,
  fetchDiscordUser,
} from "../services/discordOAuth.js";
import { resolveOAuthRedirectUriFromRequest } from "../lib/oauthRedirectUri.js";

function oauthRedirectUri(req: Parameters<typeof resolveOAuthRedirectUriFromRequest>[0]): string {
  const env = loadEnv();
  return env.DISCORD_REDIRECT_URI ?? resolveOAuthRedirectUriFromRequest(req);
}

export const authRouter = Router();

authRouter.get(
  "/discord",
  asyncHandler(async (req, res) => {
    const state = randomBytes(24).toString("hex");
    req.session.oauthState = state;
    const redirectUri = oauthRedirectUri(req);
    const url = buildAuthorizeUrl(state, redirectUri);
    const tracking = trackingFromRequest(req);
    await recordProductEvent(prisma, {
      type: "discord_login_started",
      source: "panel",
      path: "/api/auth/discord",
      visitorId: tracking.visitorId,
      sessionId: tracking.sessionId,
      metadata: { network: networkMetadataFromRequest(req) },
    });
    res.redirect(url);
  }),
);

authRouter.get(
  "/callback",
  asyncHandler(async (req, res) => {
    const env = loadEnv();
    const code = typeof req.query.code === "string" ? req.query.code : null;
    const state = typeof req.query.state === "string" ? req.query.state : null;
    const oauthError = typeof req.query.error === "string" ? req.query.error : null;

    if (oauthError) {
      const desc =
        typeof req.query.error_description === "string" ? req.query.error_description : oauthError;
      throw new AppError(400, `Connexion Discord refusée : ${desc}`, "OAUTH_DENIED");
    }

    if (!code || !state) {
      throw new AppError(400, "Paramètres OAuth manquants", "OAUTH_INVALID");
    }

    if (!req.session.oauthState || req.session.oauthState !== state) {
      throw new AppError(400, "État OAuth invalide (CSRF)", "OAUTH_STATE");
    }

    req.session.oauthState = undefined;

    const redirectUri = oauthRedirectUri(req);
    const accessToken = await exchangeCodeForToken(code, redirectUri);
    const [user, guilds] = await Promise.all([
      fetchDiscordUser(accessToken),
      fetchDiscordGuilds(accessToken),
    ]);

    req.session.discordAccessToken = accessToken;
    req.session.discordUser = user;
    req.session.discordGuilds = guilds;
    ensureCsrfToken(req);
    const tracking = trackingFromRequest(req);
    await recordPanelLogin(prisma, user, tracking);
    await recordProductEvent(prisma, {
      type: "panel_login",
      source: "discord_oauth",
      path: "/api/auth/callback",
      visitorId: tracking.visitorId,
      sessionId: tracking.sessionId,
      discordUserId: user.id,
      metadata: { username: user.username, globalName: user.global_name, network: networkMetadataFromRequest(req) },
    });

    res.redirect(`${env.FRONTEND_URL.replace(/\/$/, "")}/select-server`);
  }),
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    await new Promise<void>((resolve, reject) => {
      req.session.destroy((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    res.status(204).end();
  }),
);

authRouter.get(
  "/csrf",
  requireSession,
  asyncHandler(async (req, res) => {
    res.json({ csrfToken: ensureCsrfToken(req) });
  }),
);

authRouter.get(
  "/me",
  requireSession,
  asyncHandler(async (req, res) => {
    res.json({
      user: req.session.discordUser,
      guilds: req.session.discordGuilds ?? [],
      isAdmin: isAdminDiscordUser(req.session.discordUser?.id),
    });
  }),
);
