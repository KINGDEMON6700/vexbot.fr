import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/AppError.js";
import type { Env } from "../config/env.js";

export function errorHandler(env: Env) {
  return (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const isProd = env.NODE_ENV === "production";

    if (err instanceof AppError) {
      res.status(err.statusCode).json({
        error: {
          message: err.message,
          code: err.code ?? "ERROR",
        },
      });
      return;
    }

    console.error(err);

    res.status(500).json({
      error: {
        message: isProd ? "Erreur interne" : String(err instanceof Error ? err.message : err),
        code: "INTERNAL_ERROR",
      },
    });
  };
}
