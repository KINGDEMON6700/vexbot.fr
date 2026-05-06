import type { NextFunction, Request, Response } from "express";
import type { DiscordGuild } from "../types/discord.js";
import { AppError } from "../lib/AppError.js";
import { isGuildEligibleForPanel } from "../services/eligibleGuilds.js";

declare module "express-serve-static-core" {
  interface Request {
    discordGuildAccess?: DiscordGuild;
  }
}

export function requireGuildAccess(req: Request, _res: Response, next: NextFunction) {
  const discordGuildId = req.params.discordGuildId;
  if (!discordGuildId) {
    next(new AppError(400, "Identifiant de serveur manquant", "BAD_REQUEST"));
    return;
  }

  const guilds = req.session.discordGuilds ?? [];
  const guild = guilds.find((g) => g.id === discordGuildId);

  if (!guild || !isGuildEligibleForPanel(guild)) {
    next(new AppError(403, "Tu n’as pas accès à ce serveur depuis ce compte.", "FORBIDDEN"));
    return;
  }

  req.discordGuildAccess = guild;
  next();
}
