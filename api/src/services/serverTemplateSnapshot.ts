import { AppError } from "../lib/AppError.js";

const DISCORD_API = "https://discord.com/api/v10";

/** Version actuelle du snapshot. À incrémenter si on change la structure JSON. */
export const SERVER_TEMPLATE_SNAPSHOT_VERSION = 1 as const;

/** Types de salons Discord qu’on capture dans le snapshot. */
const SNAPSHOTTED_CHANNEL_TYPES = new Set([
  0, // GUILD_TEXT
  2, // GUILD_VOICE
  4, // GUILD_CATEGORY
  5, // GUILD_ANNOUNCEMENT
  13, // GUILD_STAGE_VOICE
  15, // GUILD_FORUM
  16, // GUILD_MEDIA
]);

export type ServerTemplateChannelType =
  | "text"
  | "voice"
  | "category"
  | "announcement"
  | "stage"
  | "forum"
  | "media";

function channelTypeFromDiscord(t: number): ServerTemplateChannelType | null {
  switch (t) {
    case 0:
      return "text";
    case 2:
      return "voice";
    case 4:
      return "category";
    case 5:
      return "announcement";
    case 13:
      return "stage";
    case 15:
      return "forum";
    case 16:
      return "media";
    default:
      return null;
  }
}

export type SnapshotRole = {
  /** Id Discord d'origine, utilisé uniquement comme clé pour relier les permission overwrites. */
  sourceId: string;
  name: string;
  /** Couleur Discord (entier RGB). 0 = aucune. */
  color: number;
  /** Bitfield Discord (string décimal car > 32 bits). */
  permissions: string;
  hoist: boolean;
  mentionable: boolean;
  position: number;
  /** Indique un rôle géré par Discord/une intégration (booster, bot…) : on l’enregistre mais on ne le recréera pas en Phase 3. */
  managed: boolean;
  /** Emoji unicode (rare) — null si pas défini. */
  unicodeEmoji: string | null;
  /** Hash d’icône de rôle Discord — null si pas défini. */
  icon: string | null;
};

export type SnapshotPermissionOverwrite = {
  /** "role" ou "member" — pour le moment on ne capture que "role". */
  kind: "role";
  /** Référence le sourceId d’un rôle du snapshot. */
  roleSourceId: string;
  allow: string;
  deny: string;
};

export type SnapshotChannel = {
  sourceId: string;
  name: string;
  type: ServerTemplateChannelType;
  /** sourceId de la catégorie parente, null si aucune. */
  parentSourceId: string | null;
  position: number;
  topic: string | null;
  nsfw: boolean;
  /** Slowmode en secondes (texte/forum/media). */
  rateLimitPerUser: number | null;
  /** Bitrate (vocal/stage), en bps. */
  bitrate: number | null;
  /** Limite d’utilisateurs (vocal/stage). 0 = illimité. */
  userLimit: number | null;
  /** Région vocale forcée. null = auto. */
  rtcRegion: string | null;
  /** Durée d’auto-archivage par défaut des threads (en minutes). */
  defaultAutoArchiveDuration: number | null;
  permissionOverwrites: SnapshotPermissionOverwrite[];
};

export type ServerTemplateSnapshot = {
  v: typeof SERVER_TEMPLATE_SNAPSHOT_VERSION;
  /** Nom du serveur au moment du snapshot (informatif). */
  guildName: string;
  /** Id Discord du serveur d’origine (informatif). */
  sourceGuildId: string;
  capturedAt: string;
  roles: SnapshotRole[];
  channels: SnapshotChannel[];
};

type DiscordRoleApi = {
  id: string;
  name: string;
  color: number;
  hoist: boolean;
  mentionable: boolean;
  managed: boolean;
  permissions: string;
  position: number;
  unicode_emoji?: string | null;
  icon?: string | null;
};

type DiscordChannelApi = {
  id: string;
  name: string;
  type: number;
  position: number;
  parent_id: string | null;
  topic?: string | null;
  nsfw?: boolean;
  rate_limit_per_user?: number;
  bitrate?: number;
  user_limit?: number;
  rtc_region?: string | null;
  default_auto_archive_duration?: number | null;
  permission_overwrites?: Array<{
    id: string;
    type: 0 | 1;
    allow: string;
    deny: string;
  }>;
};

type DiscordGuildApi = {
  id: string;
  name: string;
};

async function discordFetch<T>(url: string, botToken: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Authorization: `Bot ${botToken}` },
  });
  if (res.status === 401 || res.status === 403) {
    throw new AppError(
      403,
      "Le bot n’a pas accès à ce serveur (permissions manquantes ou bot absent).",
      "DISCORD_FORBIDDEN",
    );
  }
  if (res.status === 404) {
    throw new AppError(
      404,
      "Serveur introuvable côté Discord (le bot n’y est peut-être plus).",
      "DISCORD_NOT_FOUND",
    );
  }
  if (res.status === 429) {
    throw new AppError(
      503,
      "Discord nous a rate-limités, réessaie dans quelques secondes.",
      "DISCORD_RATE_LIMITED",
    );
  }
  if (!res.ok) {
    throw new AppError(
      502,
      `Discord a renvoyé une erreur inattendue (HTTP ${res.status}).`,
      "DISCORD_ERROR",
    );
  }
  return (await res.json()) as T;
}

/**
 * Récupère la structure complète d’un serveur Discord et la convertit dans notre format snapshot.
 * Garantit que `permissionOverwrites` ne référence que des rôles présents dans `roles` (sourceId).
 */
export async function buildServerTemplateSnapshot(
  discordGuildId: string,
  botToken: string,
): Promise<ServerTemplateSnapshot> {
  const [guild, roles, channels] = await Promise.all([
    discordFetch<DiscordGuildApi>(`${DISCORD_API}/guilds/${discordGuildId}`, botToken),
    discordFetch<DiscordRoleApi[]>(`${DISCORD_API}/guilds/${discordGuildId}/roles`, botToken),
    discordFetch<DiscordChannelApi[]>(`${DISCORD_API}/guilds/${discordGuildId}/channels`, botToken),
  ]);

  const knownRoleIds = new Set(roles.map((r) => r.id));

  const snapshotRoles: SnapshotRole[] = roles
    .slice()
    .sort((a, b) => b.position - a.position)
    .map((r) => ({
      sourceId: r.id,
      name: r.name,
      color: r.color ?? 0,
      permissions: r.permissions ?? "0",
      hoist: Boolean(r.hoist),
      mentionable: Boolean(r.mentionable),
      position: r.position ?? 0,
      managed: Boolean(r.managed),
      unicodeEmoji: r.unicode_emoji ?? null,
      icon: r.icon ?? null,
    }));

  const snapshotChannels: SnapshotChannel[] = channels
    .filter((c) => SNAPSHOTTED_CHANNEL_TYPES.has(c.type))
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((c) => {
      const t = channelTypeFromDiscord(c.type);
      if (!t) {
        throw new AppError(500, "Type de salon Discord inattendu.", "INTERNAL_TYPE");
      }
      const overwrites: SnapshotPermissionOverwrite[] = (c.permission_overwrites ?? [])
        // type === 0 = rôle, type === 1 = utilisateur. On garde uniquement les rôles.
        .filter((o) => o.type === 0 && knownRoleIds.has(o.id))
        .map((o) => ({
          kind: "role" as const,
          roleSourceId: o.id,
          allow: o.allow ?? "0",
          deny: o.deny ?? "0",
        }));
      return {
        sourceId: c.id,
        name: c.name,
        type: t,
        parentSourceId: c.parent_id ?? null,
        position: c.position ?? 0,
        topic: c.topic ?? null,
        nsfw: Boolean(c.nsfw),
        rateLimitPerUser:
          typeof c.rate_limit_per_user === "number" ? c.rate_limit_per_user : null,
        bitrate: typeof c.bitrate === "number" ? c.bitrate : null,
        userLimit: typeof c.user_limit === "number" ? c.user_limit : null,
        rtcRegion: c.rtc_region ?? null,
        defaultAutoArchiveDuration:
          typeof c.default_auto_archive_duration === "number"
            ? c.default_auto_archive_duration
            : null,
        permissionOverwrites: overwrites,
      };
    });

  return {
    v: SERVER_TEMPLATE_SNAPSHOT_VERSION,
    guildName: guild.name,
    sourceGuildId: guild.id,
    capturedAt: new Date().toISOString(),
    roles: snapshotRoles,
    channels: snapshotChannels,
  };
}

/** Valide la forme minimale d’un snapshot stocké pour pouvoir l’afficher. */
export function isValidStoredSnapshot(raw: unknown): raw is ServerTemplateSnapshot {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as Record<string, unknown>;
  if (o.v !== SERVER_TEMPLATE_SNAPSHOT_VERSION) return false;
  if (typeof o.guildName !== "string") return false;
  if (typeof o.sourceGuildId !== "string") return false;
  if (!Array.isArray(o.roles)) return false;
  if (!Array.isArray(o.channels)) return false;
  return true;
}
