import { randomBytes } from "node:crypto";
import { Router } from "express";
import { loadEnv } from "../config/env.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { AppError } from "../lib/AppError.js";
import { requireSession } from "../middleware/requireSession.js";
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

    res.redirect(`${env.FRONTEND_URL.replace(/\/$/, "")}/`);
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
  "/me",
  requireSession,
  asyncHandler(async (req, res) => {
    res.json({
      user: req.session.discordUser,
      guilds: req.session.discordGuilds ?? [],
    });
  }),
);
