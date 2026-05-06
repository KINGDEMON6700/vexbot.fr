import cors from "cors";
import type { Env } from "../config/env.js";

export function createCorsMiddleware(env: Env) {
  return cors({
    origin: env.FRONTEND_URL,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });
}
