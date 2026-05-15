import { apiFetch } from "./api.js";
import type {
  CustomCommand,
  CustomCommandInput,
  NativeCommandSetting,
} from "../types/commands.js";

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

export async function fetchNativeCommands(
  discordGuildId: string,
): Promise<NativeCommandSetting[]> {
  const res = await apiFetch(
    `/api/guilds/${encodeURIComponent(discordGuildId)}/commands/native`,
  );
  if (!res.ok) throw await readApiError(res);
  const data = (await res.json()) as { commands: NativeCommandSetting[] };
  return data.commands;
}

export async function updateNativeCommand(
  discordGuildId: string,
  commandName: string,
  body: Partial<Pick<NativeCommandSetting, "enabled" | "allowedRoleIds" | "allowedChannelIds">>,
): Promise<NativeCommandSetting> {
  const res = await apiFetch(
    `/api/guilds/${encodeURIComponent(discordGuildId)}/commands/native/${encodeURIComponent(commandName)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) throw await readApiError(res);
  const data = (await res.json()) as { command: NativeCommandSetting };
  return data.command;
}

export async function fetchCustomCommands(discordGuildId: string): Promise<CustomCommand[]> {
  const res = await apiFetch(
    `/api/guilds/${encodeURIComponent(discordGuildId)}/commands/custom`,
  );
  if (!res.ok) throw await readApiError(res);
  const data = (await res.json()) as { commands: CustomCommand[] };
  return data.commands;
}

export async function createCustomCommand(
  discordGuildId: string,
  body: CustomCommandInput,
): Promise<CustomCommand> {
  const res = await apiFetch(
    `/api/guilds/${encodeURIComponent(discordGuildId)}/commands/custom`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) throw await readApiError(res);
  const data = (await res.json()) as { command: CustomCommand };
  return data.command;
}

export async function updateCustomCommand(
  discordGuildId: string,
  commandId: string,
  body: Partial<CustomCommandInput>,
): Promise<CustomCommand> {
  const res = await apiFetch(
    `/api/guilds/${encodeURIComponent(discordGuildId)}/commands/custom/${encodeURIComponent(commandId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) throw await readApiError(res);
  const data = (await res.json()) as { command: CustomCommand };
  return data.command;
}

export async function deleteCustomCommand(
  discordGuildId: string,
  commandId: string,
): Promise<void> {
  const res = await apiFetch(
    `/api/guilds/${encodeURIComponent(discordGuildId)}/commands/custom/${encodeURIComponent(commandId)}`,
    { method: "DELETE" },
  );
  if (!res.ok) throw await readApiError(res);
}
