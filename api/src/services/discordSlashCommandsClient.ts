/**
 * Client minimal pour gérer les guild slash commands d'une application Discord.
 *
 * Doc Discord :
 *   - POST /applications/{app}/guilds/{guild}/commands
 *   - PATCH /applications/{app}/guilds/{guild}/commands/{cmd}
 *   - DELETE /applications/{app}/guilds/{guild}/commands/{cmd}
 *
 * Les commandes natives du bot sont déjà déclarées via `deploy-commands.ts` côté bot.
 * Ici on gère uniquement les commandes custom créées depuis le panel.
 */

import { AppError } from "../lib/AppError.js";

const DISCORD_API_BASE = "https://discord.com/api/v10";

export type DiscordSlashCommandPayload = {
  name: string;
  description: string;
  /** Type 1 = CHAT_INPUT (commande slash classique). */
  type?: number;
  /** Sera ignoré ici (pas d'options pour les commandes custom simples). */
  options?: unknown[];
};

async function discordRequest<T = unknown>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  url: string,
  botToken: string,
  body?: unknown,
): Promise<T | null> {
  const res = await fetch(`${DISCORD_API_BASE}${url}`, {
    method,
    headers: {
      Authorization: `Bot ${botToken}`,
      "Content-Type": "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;

  if (!res.ok) {
    let detail = "";
    try {
      const j = (await res.json()) as { message?: string; code?: number };
      detail = j.message ? `${j.message}${j.code ? ` (code ${j.code})` : ""}` : "";
    } catch {
      // ignore
    }
    throw new AppError(
      res.status === 403 ? 403 : 502,
      `Discord a refusé l'opération sur les commandes (${res.status}). ${detail}`.trim(),
      "DISCORD_COMMAND_HTTP",
    );
  }

  return (await res.json()) as T;
}

export async function createGuildSlashCommand(
  applicationId: string,
  guildDiscordId: string,
  botToken: string,
  payload: DiscordSlashCommandPayload,
): Promise<{ id: string }> {
  const data = await discordRequest<{ id: string }>(
    "POST",
    `/applications/${applicationId}/guilds/${guildDiscordId}/commands`,
    botToken,
    { type: 1, ...payload },
  );
  if (!data || !data.id) {
    throw new AppError(502, "Discord n'a pas retourné l'identifiant de la commande.", "DISCORD_NO_ID");
  }
  return { id: data.id };
}

export async function patchGuildSlashCommand(
  applicationId: string,
  guildDiscordId: string,
  botToken: string,
  commandId: string,
  payload: Partial<DiscordSlashCommandPayload>,
): Promise<void> {
  await discordRequest(
    "PATCH",
    `/applications/${applicationId}/guilds/${guildDiscordId}/commands/${commandId}`,
    botToken,
    payload,
  );
}

export async function deleteGuildSlashCommand(
  applicationId: string,
  guildDiscordId: string,
  botToken: string,
  commandId: string,
): Promise<void> {
  try {
    await discordRequest(
      "DELETE",
      `/applications/${applicationId}/guilds/${guildDiscordId}/commands/${commandId}`,
      botToken,
    );
  } catch (e) {
    // Si la commande n'existe plus côté Discord (404), on considère que c'est OK.
    if (e instanceof AppError && e.statusCode === 404) return;
    if (e instanceof AppError && e.message.includes("(404)")) return;
    throw e;
  }
}
