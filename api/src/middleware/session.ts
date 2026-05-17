import session from "express-session";
import type { Env } from "../config/env.js";
import { prisma } from "../db.js";
import { PrismaSessionStore } from "./prismaSessionStore.js";

export function createSessionMiddleware(env: Env) {
  const isProd = env.NODE_ENV === "production";

  return session({
    name: "vex.sid",
    store: new PrismaSessionStore(prisma),
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  });
}
