const DISCORD_API = "https://discord.com/api/v10";

function displayFromUser(user: { username: string; global_name?: string | null }): string {
  const g = user.global_name?.trim();
  if (g) return g;
  return user.username;
}

type DiscordChannelJson = { name?: string; guild_id?: string | null };

type DiscordMemberJson = {
  nick?: string | null;
  user?: { username: string; global_name?: string | null; avatar?: string | null };
};

type DiscordUserJson = { username: string; global_name?: string | null; avatar?: string | null };

type DiscordMeJson = {
  id: string;
  username: string;
  global_name?: string | null;
  avatar: string | null;
  bot?: boolean;
};

let cachedBotSelf: DiscordMeJson | null | undefined;

/**
 * Profil du compte bot (token courant). Mis en cache pour ne pas surcharger l’API Discord.
 */
export async function getDiscordBotSelfCached(botToken: string): Promise<DiscordMeJson | null> {
  if (cachedBotSelf !== undefined) {
    return cachedBotSelf;
  }
  const headers = botHeaders(botToken);
  const res = await fetch(`${DISCORD_API}/users/@me`, { headers });
  if (!res.ok) {
    cachedBotSelf = null;
    return null;
  }
  const j = (await res.json()) as DiscordMeJson;
  cachedBotSelf = j;
  return j;
}

function botHeaders(botToken: string): Record<string, string> {
  return { Authorization: `Bot ${botToken}` };
}

async function fetchChannelNameInGuild(
  channelId: string,
  guildDiscordId: string,
  botToken: string,
): Promise<string | null> {
  const headers = botHeaders(botToken);
  const chRes = await fetch(`${DISCORD_API}/channels/${encodeURIComponent(channelId)}`, { headers });
  if (!chRes.ok) return null;
  const ch = (await chRes.json()) as DiscordChannelJson;
  if (typeof ch.name !== "string" || !ch.name.trim()) return null;
  if (ch.guild_id && ch.guild_id !== guildDiscordId) return null;
  return ch.name.trim();
}

type OpenerDiscordProfile = {
  displayName: string | null;
  avatarHash: string | null;
  /** Identifiant @username (pour rapprocher des vieux transcripts HTML sans data-author-id). */
  discordUsername: string | null;
};

async function fetchOpenerDiscordProfile(
  guildDiscordId: string,
  openerUserId: string,
  botToken: string,
): Promise<OpenerDiscordProfile> {
  const headers = botHeaders(botToken);
  const memRes = await fetch(
    `${DISCORD_API}/guilds/${encodeURIComponent(guildDiscordId)}/members/${encodeURIComponent(openerUserId)}`,
    { headers },
  );
  if (memRes.ok) {
    const mem = (await memRes.json()) as DiscordMemberJson;
    if (mem.user) {
      const base = displayFromUser(mem.user);
      const name = mem.nick?.trim() ? mem.nick.trim() : base;
      const un = mem.user.username?.trim() ?? null;
      return {
        displayName: name,
        avatarHash: mem.user.avatar ?? null,
        discordUsername: un,
      };
    }
    return { displayName: null, avatarHash: null, discordUsername: null };
  }
  const uRes = await fetch(`${DISCORD_API}/users/${encodeURIComponent(openerUserId)}`, { headers });
  if (!uRes.ok) return { displayName: null, avatarHash: null, discordUsername: null };
  const u = (await uRes.json()) as DiscordUserJson;
  return {
    displayName: displayFromUser(u),
    avatarHash: u.avatar ?? null,
    discordUsername: u.username?.trim() ?? null,
  };
}

async function fetchOpenerDisplayName(
  guildDiscordId: string,
  openerUserId: string,
  botToken: string,
): Promise<string | null> {
  const p = await fetchOpenerDiscordProfile(guildDiscordId, openerUserId, botToken);
  return p.displayName;
}

export type TicketListDiscordRow = {
  channelId: string;
  openerId: string;
  channelDiscordName: string | null;
  openerDisplayName: string | null;
};

/**
 * Remplit channelDiscordName / openerDisplayName pour une liste (requêtes Discord dédoublonnées).
 */
export async function enrichTicketListWithDiscord(
  guildDiscordId: string,
  rows: TicketListDiscordRow[],
  botToken: string,
): Promise<void> {
  if (rows.length === 0) return;
  const uniqCh = [...new Set(rows.map((r) => r.channelId))];
  const uniqOp = [...new Set(rows.map((r) => r.openerId))];
  const [chMap, opMap] = await Promise.all([
    (async () => {
      const entries = await Promise.all(
        uniqCh.map(async (channelId) => {
          const name = await fetchChannelNameInGuild(channelId, guildDiscordId, botToken);
          return [channelId, name] as const;
        }),
      );
      return new Map(entries);
    })(),
    (async () => {
      const entries = await Promise.all(
        uniqOp.map(async (openerId) => {
          const name = await fetchOpenerDisplayName(guildDiscordId, openerId, botToken);
          return [openerId, name] as const;
        }),
      );
      return new Map(entries);
    })(),
  ]);
  for (const r of rows) {
    r.channelDiscordName = chMap.get(r.channelId) ?? null;
    r.openerDisplayName = opMap.get(r.openerId) ?? null;
  }
}

/**
 * Résout noms affichables pour le détail ticket (API Discord, token bot).
 */
export async function resolveTicketDiscordDisplay(
  guildDiscordId: string,
  channelId: string,
  openerUserId: string,
  botToken: string,
): Promise<{
  channelDiscordName: string | null;
  openerDisplayName: string | null;
  openerAvatarHash: string | null;
  openerDiscordUsername: string | null;
}> {
  const [channelDiscordName, profile] = await Promise.all([
    fetchChannelNameInGuild(channelId, guildDiscordId, botToken),
    fetchOpenerDiscordProfile(guildDiscordId, openerUserId, botToken),
  ]);
  return {
    channelDiscordName,
    openerDisplayName: profile.displayName,
    openerAvatarHash: profile.avatarHash,
    openerDiscordUsername: profile.discordUsername,
  };
}
