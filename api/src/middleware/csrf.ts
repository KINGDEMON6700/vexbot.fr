import { randomBytes, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/AppError.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function ensureCsrfToken(req: Request): string {
  if (!req.session.csrfToken) {
    req.session.csrfToken = randomBytes(32).toString("hex");
  }
  return req.session.csrfToken;
}

export function csrfProtection(req: Request, _res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  if (req.path.startsWith("/api/bot-internal/") || req.path.startsWith("/api/public/")) {
    next();
    return;
  }

  const expected = req.session.csrfToken;
  const provided = req.get("x-csrf-token") ?? "";
  if (!expected || !provided || !safeEqual(expected, provided)) {
    next(new AppError(403, "Protection CSRF invalide.", "CSRF_INVALID"));
    return;
  }

  next();
}
