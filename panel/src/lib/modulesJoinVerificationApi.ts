import { apiFetch } from "./api.js";
import type { JoinVerificationSettings } from "../types/joinVerification.js";

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

export async function fetchJoinVerificationSettings(
  discordGuildId: string,
): Promise<JoinVerificationSettings> {
  const res = await apiFetch(
    `/api/guilds/${encodeURIComponent(discordGuildId)}/modules/join-verification`,
  );
  if (!res.ok) throw await readApiError(res);
  const data = (await res.json()) as { settings: JoinVerificationSettings };
  return data.settings;
}

export async function patchJoinVerificationSettings(
  discordGuildId: string,
  body: Partial<JoinVerificationSettings>,
): Promise<{ settings: JoinVerificationSettings; panelSyncWarning: string | null }> {
  const res = await apiFetch(
    `/api/guilds/${encodeURIComponent(discordGuildId)}/modules/join-verification`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) throw await readApiError(res);
  return (await res.json()) as { settings: JoinVerificationSettings; panelSyncWarning: string | null };
}
