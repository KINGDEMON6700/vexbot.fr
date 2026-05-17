import cors from "cors";
import type { Env } from "../config/env.js";

export function createCorsMiddleware(env: Env) {
  const allowedOrigins = new Set([env.FRONTEND_URL, env.LANDING_URL]);
  return cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, origin ?? env.FRONTEND_URL);
        return;
      }
      callback(null, env.FRONTEND_URL);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });
}
