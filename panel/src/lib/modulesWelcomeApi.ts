import { apiFetch } from "./api.js";
import type { WelcomeGoodbyeSettings } from "../types/welcomeGoodbye.js";

type ApiErrorShape = { error?: { message?: string; code?: string } };

async function readApiError(res: Response): Promise<Error & { status: number; code?: string }> {
  let message = "Erreur";
  let code: string | undefined;
  try {
    const j = (await res.json()) as ApiErrorShape;
    if (j.error?.message) message = j.error.message;
    code = j.error?.code;
  } catch {
    /* ignore */
  }
  const e = new Error(message) as Error & { status: number; code?: string };
  e.status = res.status;
  e.code = code;
  return e;
}

export async function fetchWelcomeGoodbyeSettings(
  discordGuildId: string,
): Promise<WelcomeGoodbyeSettings> {
  const res = await apiFetch(
    `/api/guilds/${encodeURIComponent(discordGuildId)}/modules/welcome-goodbye`,
  );
  if (!res.ok) throw await readApiError(res);
  const data = (await res.json()) as { settings: WelcomeGoodbyeSettings };
  return data.settings;
}

export async function patchWelcomeGoodbyeSettings(
  discordGuildId: string,
  body: Partial<WelcomeGoodbyeSettings>,
): Promise<WelcomeGoodbyeSettings> {
  const res = await apiFetch(
    `/api/guilds/${encodeURIComponent(discordGuildId)}/modules/welcome-goodbye`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) throw await readApiError(res);
  const data = (await res.json()) as { settings: WelcomeGoodbyeSettings };
  return data.settings;
}
