import type { BotEnv } from "../config/env.js";

type ApiErrorJson = { error?: { message?: string; code?: string } };

export async function vexInternalPostJson<T>(
  env: BotEnv,
  path: string,
  body: unknown,
): Promise<{ ok: true; data: T } | { ok: false; kind: "config" | "network" | "http"; message?: string; status?: number }> {
  if (!env.API_BASE_URL || !env.VEX_BOT_API_SECRET) {
    return { ok: false, kind: "config" };
  }
  const base = env.API_BASE_URL.replace(/\/+$/, "");
  const url = `${base}/api/bot-internal${path.startsWith("/") ? path : `/${path}`}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-vex-bot-key": env.VEX_BOT_API_SECRET,
      },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, kind: "network" };
  }
  if (res.status === 204) {
    return { ok: true, data: undefined as T };
  }
  if (!res.ok) {
    let message = "Requête API refusée.";
    try {
      const j = (await res.json()) as ApiErrorJson;
      if (j.error?.message) message = j.error.message;
    } catch {
      // ignore
    }
    return { ok: false, kind: "http", status: res.status, message };
  }
  try {
    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch {
    return { ok: false, kind: "http", status: res.status, message: "Réponse invalide." };
  }
}

export async function vexInternalGetJson<T>(
  env: BotEnv,
  pathWithQuery: string,
): Promise<{ ok: true; data: T } | { ok: false; kind: "config" | "network" | "http"; message?: string; status?: number }> {
  if (!env.API_BASE_URL || !env.VEX_BOT_API_SECRET) {
    return { ok: false, kind: "config" };
  }
  const base = env.API_BASE_URL.replace(/\/+$/, "");
  const url = `${base}/api/bot-internal${pathWithQuery.startsWith("/") ? pathWithQuery : `/${pathWithQuery}`}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: { "x-vex-bot-key": env.VEX_BOT_API_SECRET },
    });
  } catch {
    return { ok: false, kind: "network" };
  }
  if (!res.ok) {
    let message = "Requête API refusée.";
    try {
      const j = (await res.json()) as ApiErrorJson;
      if (j.error?.message) message = j.error.message;
    } catch {
      // ignore
    }
    return { ok: false, kind: "http", status: res.status, message };
  }
  try {
    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch {
    return { ok: false, kind: "http", status: res.status, message: "Réponse invalide." };
  }
}

export async function vexInternalPatchJson(
  env: BotEnv,
  path: string,
  body: unknown,
): Promise<{ ok: true } | { ok: false; kind: "config" | "network" | "http"; message?: string; status?: number }> {
  if (!env.API_BASE_URL || !env.VEX_BOT_API_SECRET) {
    return { ok: false, kind: "config" };
  }
  const base = env.API_BASE_URL.replace(/\/+$/, "");
  const url = `${base}/api/bot-internal${path.startsWith("/") ? path : `/${path}`}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-vex-bot-key": env.VEX_BOT_API_SECRET,
      },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, kind: "network" };
  }
  if (res.status === 204) {
    return { ok: true };
  }
  if (!res.ok) {
    let message = "Requête API refusée.";
    try {
      const j = (await res.json()) as ApiErrorJson;
      if (j.error?.message) message = j.error.message;
    } catch {
      // ignore
    }
    return { ok: false, kind: "http", status: res.status, message };
  }
  return { ok: true };
}
