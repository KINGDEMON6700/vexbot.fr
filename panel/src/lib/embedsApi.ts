import { apiFetch } from "./api.js";
import type { EmbedTemplate } from "../types/embedTemplate.js";
import type { GuildMentionMeta } from "../types/guildMeta.js";

/** Salons et rôles pour mentions. `null` si le bot n’est pas sur le serveur. */
export async function fetchGuildMentionMeta(discordGuildId: string): Promise<GuildMentionMeta | null> {
  const res = await apiFetch(`/api/guilds/${encodeURIComponent(discordGuildId)}/meta/mentions`);
  if (res.status === 400) return null;
  if (!res.ok) throw new Error("meta");
  return res.json() as Promise<GuildMentionMeta>;
}

export type GuildTextChannelOption = {
  id: string;
  name: string;
};

export async function fetchGuildTextChannels(discordGuildId: string): Promise<GuildTextChannelOption[]> {
  const res = await apiFetch(`/api/guilds/${encodeURIComponent(discordGuildId)}/meta/text-channels`);
  if (!res.ok) throw new Error("text_channels");
  const data = (await res.json()) as { channels: GuildTextChannelOption[] };
  return data.channels;
}

export async function fetchEmbedTemplates(discordGuildId: string): Promise<EmbedTemplate[]> {
  const res = await apiFetch(`/api/guilds/${encodeURIComponent(discordGuildId)}/embeds`);
  if (!res.ok) throw new Error("list");
  const data = (await res.json()) as { embeds: EmbedTemplate[] };
  return data.embeds;
}

export type SaveEmbedPayload = {
  name: string;
  messages: EmbedTemplate["messages"];
};

export async function createEmbedTemplate(
  discordGuildId: string,
  body: SaveEmbedPayload,
): Promise<EmbedTemplate> {
  const res = await apiFetch(`/api/guilds/${encodeURIComponent(discordGuildId)}/embeds`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await readApiError(res);
    throw err;
  }
  const data = (await res.json()) as { embed: EmbedTemplate };
  return data.embed;
}

export async function updateEmbedTemplate(
  discordGuildId: string,
  embedId: string,
  body: SaveEmbedPayload,
): Promise<EmbedTemplate> {
  const res = await apiFetch(
    `/api/guilds/${encodeURIComponent(discordGuildId)}/embeds/${encodeURIComponent(embedId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const err = await readApiError(res);
    throw err;
  }
  const data = (await res.json()) as { embed: EmbedTemplate };
  return data.embed;
}

export async function deleteEmbedTemplate(discordGuildId: string, embedId: string): Promise<void> {
  const res = await apiFetch(
    `/api/guilds/${encodeURIComponent(discordGuildId)}/embeds/${encodeURIComponent(embedId)}`,
    { method: "DELETE" },
  );
  if (!res.ok) throw new Error("delete");
}

export async function sendEmbedTemplateToChannel(
  discordGuildId: string,
  body: { channelId: string; messages: EmbedTemplate["messages"] },
): Promise<{ sent: number }> {
  const res = await apiFetch(`/api/guilds/${encodeURIComponent(discordGuildId)}/embeds/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await readApiError(res);
    throw err;
  }
  return (await res.json()) as { sent: number };
}

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
