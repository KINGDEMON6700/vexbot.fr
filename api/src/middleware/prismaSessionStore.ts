import session from "express-session";
import type { PrismaClient } from "@prisma/client";

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export class PrismaSessionStore extends session.Store {
  constructor(private readonly prisma: PrismaClient) {
    super();
  }

  get(sid: string, callback: (err: unknown, session?: session.SessionData | null) => void): void {
    this.prisma.panelSession
      .findUnique({ where: { sid } })
      .then((row) => {
        if (!row || row.expiresAt.getTime() <= Date.now()) {
          callback(null, null);
          return;
        }
        callback(null, row.data as unknown as session.SessionData);
      })
      .catch((err) => callback(err));
  }

  set(sid: string, sess: session.SessionData, callback?: (err?: unknown) => void): void {
    const expiresAt =
      sess.cookie?.expires instanceof Date ? sess.cookie.expires : new Date(Date.now() + DEFAULT_TTL_MS);

    this.prisma.panelSession
      .upsert({
        where: { sid },
        create: { sid, data: sess as object, expiresAt },
        update: { data: sess as object, expiresAt },
      })
      .then(() => callback?.())
      .catch((err) => callback?.(err));
  }

  destroy(sid: string, callback?: (err?: unknown) => void): void {
    this.prisma.panelSession
      .delete({ where: { sid } })
      .catch(() => null)
      .then(() => callback?.())
      .catch((err) => callback?.(err));
  }

  touch(sid: string, sess: session.SessionData, callback?: (err?: unknown) => void): void {
    const expiresAt =
      sess.cookie?.expires instanceof Date ? sess.cookie.expires : new Date(Date.now() + DEFAULT_TTL_MS);
    this.prisma.panelSession
      .update({ where: { sid }, data: { expiresAt } })
      .catch(() => null)
      .then(() => callback?.())
      .catch((err) => callback?.(err));
  }
}
