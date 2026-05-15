import { AppError } from "../lib/AppError.js";

const DISCORD_API = "https://discord.com/api/v10";

/** Bitfield des permissions Discord (https://discord.com/developers/docs/topics/permissions). */
const PERM_ADMINISTRATOR = 1n << 3n;
const PERM_MANAGE_CHANNELS = 1n << 4n;
const PERM_MANAGE_ROLES = 1n << 28n;

export type RequiredBotPermissions = {
  manageChannels: boolean;
  manageRoles: boolean;
  /** Administrateur accordé → on considère tout présent. */
  administrator: boolean;
};

type GuildApi = { id: string; owner_id: string };
type RoleApi = { id: string; permissions: string };
type GuildMemberApi = { roles: string[]; user?: { id: string } };

/**
 * Vérifie que le bot a au minimum "Gérer les salons" et "Gérer les rôles" sur le serveur.
 * Ne renvoie pas une erreur 403 ; renvoie le détail pour que le panel affiche un message clair.
 */
export async function checkBotPermissionsOnGuild(
  discordGuildId: string,
  botToken: string,
  botUserId: string,
): Promise<RequiredBotPermissions> {
  const [guildRes, rolesRes, memberRes] = await Promise.all([
    fetch(`${DISCORD_API}/guilds/${discordGuildId}`, {
      headers: { Authorization: `Bot ${botToken}` },
    }),
    fetch(`${DISCORD_API}/guilds/${discordGuildId}/roles`, {
      headers: { Authorization: `Bot ${botToken}` },
    }),
    fetch(`${DISCORD_API}/guilds/${discordGuildId}/members/${botUserId}`, {
      headers: { Authorization: `Bot ${botToken}` },
    }),
  ]);

  if (guildRes.status === 404 || memberRes.status === 404) {
    throw new AppError(
      404,
      "Le bot n’est pas sur ce serveur Discord.",
      "BOT_NOT_IN_GUILD",
    );
  }
  if (!guildRes.ok || !rolesRes.ok || !memberRes.ok) {
    throw new AppError(
      502,
      "Discord n’a pas pu nous renvoyer les permissions du bot.",
      "DISCORD_ERROR",
    );
  }

  const guild = (await guildRes.json()) as GuildApi;
  const roles = (await rolesRes.json()) as RoleApi[];
  const member = (await memberRes.json()) as GuildMemberApi;

  // Owner → toutes permissions.
  if (guild.owner_id === botUserId) {
    return { manageChannels: true, manageRoles: true, administrator: true };
  }

  const myRoleIds = new Set(member.roles ?? []);
  let combined = 0n;
  for (const r of roles) {
    if (myRoleIds.has(r.id) || r.id === guild.id /* @everyone */) {
      try {
        combined |= BigInt(r.permissions);
      } catch {
        /* ignore */
      }
    }
  }

  const isAdmin = (combined & PERM_ADMINISTRATOR) === PERM_ADMINISTRATOR;
  return {
    administrator: isAdmin,
    manageChannels: isAdmin || (combined & PERM_MANAGE_CHANNELS) === PERM_MANAGE_CHANNELS,
    manageRoles: isAdmin || (combined & PERM_MANAGE_ROLES) === PERM_MANAGE_ROLES,
  };
}

export function botPermissionsErrorMessage(perms: RequiredBotPermissions): string | null {
  if (perms.manageChannels && perms.manageRoles) return null;
  const missing: string[] = [];
  if (!perms.manageChannels) missing.push("Gérer les salons");
  if (!perms.manageRoles) missing.push("Gérer les rôles");
  return `Le bot n’a pas la permission « ${missing.join(" » et « ")} » sur ce serveur. Réinvite-le avec les bonnes permissions, ou ajoute-les manuellement à son rôle.`;
}
