import type { DiscordGuild } from "../types/discord.js";
import { BOT_INVITE_PERMISSIONS } from "../constants/botInvitePermissions.js";

const DISCORD_API = "https://discord.com/api/v10";

/** Propriétaire ou permission Administrateur uniquement. */
export function isGuildEligibleForPanel(guild: DiscordGuild): boolean {
  if (guild.owner) return true;
  try {
    const perms = BigInt(guild.permissions);
    const administrator = 1n << 3n;
    return (perms & administrator) === administrator;
  } catch {
    return false;
  }
}

/** Infos serveur si le bot y est membre (GET /guilds/:id avec token bot). Sinon null (404). */
export async function fetchGuildIfBotIsMember(
  guildId: string,
  botToken: string,
): Promise<{ name: string; icon: string | null } | null> {
  const res = await fetch(`${DISCORD_API}/guilds/${guildId}`, {
    headers: { Authorization: `Bot ${botToken}` },
  });
  if (res.status === 200) {
    const j = (await res.json()) as { name?: string; icon?: string | null };
    return {
      name: typeof j.name === "string" ? j.name : "",
      icon: j.icon ?? null,
    };
  }
  if (res.status === 404) return null;
  throw new Error(`Discord a répondu ${res.status} pour la guild ${guildId}`);
}

export async function isBotMemberOfGuild(guildId: string, botToken: string): Promise<boolean> {
  const snap = await fetchGuildIfBotIsMember(guildId, botToken);
  return snap !== null;
}

export function buildDiscordBotInviteUrl(clientId: string, guildId?: string | null): string {
  const params = new URLSearchParams({
    client_id: clientId,
    permissions: BOT_INVITE_PERMISSIONS.toString(),
    scope: "bot applications.commands",
  });
  if (guildId) {
    params.set("guild_id", guildId);
    params.set("disable_guild_select", "true");
  }
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

export function buildBotInviteUrl(frontendUrl: string, guildId: string, source = "panel_guild_selector"): string {
  const base = frontendUrl.replace(/\/$/, "");
  const params = new URLSearchParams({
    source,
    guildId,
  });
  return `${base}/api/public/bot-invite?${params.toString()}`;
}

export type EligibleGuildPayload = {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  botPresent: boolean;
  inviteUrl: string | null;
};

export async function buildEligibleGuildList(
  guilds: DiscordGuild[],
  clientId: string,
  botToken: string,
  frontendUrl: string,
): Promise<EligibleGuildPayload[]> {
  const filtered = guilds.filter(isGuildEligibleForPanel);

  const results = await Promise.all(
    filtered.map(async (g) => {
      let botPresent = false;
      let name = g.name;
      let icon = g.icon;
      try {
        const snap = await fetchGuildIfBotIsMember(g.id, botToken);
        if (snap) {
          botPresent = true;
          name = snap.name.trim() ? snap.name : g.name;
          icon = snap.icon;
        }
      } catch {
        botPresent = false;
      }
      const inviteUrl = botPresent ? null : buildBotInviteUrl(frontendUrl, g.id);
      return {
        id: g.id,
        name,
        icon,
        owner: g.owner,
        botPresent,
        inviteUrl,
      } satisfies EligibleGuildPayload;
    }),
  );

  return results.sort((a, b) => {
    if (a.botPresent !== b.botPresent) {
      return a.botPresent ? -1 : 1;
    }
    return a.name.localeCompare(b.name, "fr");
  });
}
