import { apiFetch } from "./api.js";
import type { JoinAutoRoleSettings } from "../types/joinAutoRoles.js";

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

export async function fetchJoinAutoRoleSettings(discordGuildId: string): Promise<JoinAutoRoleSettings> {
  const res = await apiFetch(
    `/api/guilds/${encodeURIComponent(discordGuildId)}/modules/join-auto-roles`,
  );
  if (!res.ok) throw await readApiError(res);
  const data = (await res.json()) as { settings: JoinAutoRoleSettings };
  return data.settings;
}

export async function patchJoinAutoRoleSettings(
  discordGuildId: string,
  body: Partial<JoinAutoRoleSettings>,
): Promise<JoinAutoRoleSettings> {
  const res = await apiFetch(
    `/api/guilds/${encodeURIComponent(discordGuildId)}/modules/join-auto-roles`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) throw await readApiError(res);
  const data = (await res.json()) as { settings: JoinAutoRoleSettings };
  return data.settings;
}
