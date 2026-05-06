import type { DiscordGuild, DiscordUser } from "../types/discord.js";
import { loadEnv } from "../config/env.js";

const AUTH_BASE = "https://discord.com/api/oauth2/authorize";
const TOKEN_URL = "https://discord.com/api/oauth2/token";
const API = "https://discord.com/api";

const SCOPES = ["identify", "guilds"] as const;

export function buildAuthorizeUrl(state: string, redirectUri: string): string {
  const { DISCORD_CLIENT_ID } = loadEnv();
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    state,
  });
  return `${AUTH_BASE}?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string, redirectUri: string): Promise<string> {
  const { DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET } = loadEnv();
  const body = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    client_secret: DISCORD_CLIENT_SECRET,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Échec échange token Discord (${res.status}) : ${text}`);
  }

  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error("Réponse Discord sans access_token");
  }
  return data.access_token;
}

async function discordApi<T>(path: string, accessToken: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord API ${path} (${res.status}) : ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchDiscordUser(accessToken: string): Promise<DiscordUser> {
  return discordApi<DiscordUser>("/users/@me", accessToken);
}

export async function fetchDiscordGuilds(accessToken: string): Promise<DiscordGuild[]> {
  return discordApi<DiscordGuild[]>("/users/@me/guilds", accessToken);
}
