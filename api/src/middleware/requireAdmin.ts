import type { NextFunction, Request, Response } from "express";
import { loadEnv } from "../config/env.js";
import { AppError } from "../lib/AppError.js";

function adminIds(): Set<string> {
  return new Set(
    loadEnv()
      .ADMIN_DISCORD_USER_IDS.split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  );
}

export function isAdminDiscordUser(discordUserId: string | undefined): boolean {
  if (!discordUserId) return false;
  return adminIds().has(discordUserId);
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!isAdminDiscordUser(req.session.discordUser?.id)) {
    next(new AppError(403, "Accès administrateur requis.", "ADMIN_REQUIRED"));
    return;
  }
  next();
}
