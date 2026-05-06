import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/AppError.js";

export function requireSession(req: Request, _res: Response, next: NextFunction) {
  if (!req.session.discordUser) {
    next(new AppError(401, "Non connecté", "UNAUTHORIZED"));
    return;
  }
  next();
}
