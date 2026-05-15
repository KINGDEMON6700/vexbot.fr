import {
  PermissionFlagsBits,
  PermissionsBitField,
  type APIInteractionGuildMember,
  type GuildMember,
} from "discord.js";

export function memberHasManageChannels(
  member: GuildMember | APIInteractionGuildMember | null,
): boolean {
  if (!member || !("permissions" in member)) return false;
  const p = member.permissions;
  if (p == null) return false;
  if (typeof p === "string") {
    try {
      return new PermissionsBitField(BigInt(p)).has(PermissionFlagsBits.ManageChannels);
    } catch {
      return false;
    }
  }
  return p.has(PermissionFlagsBits.ManageChannels);
}

/**
 * Boutons sous le message d’accueil : auteur du ticket, ou membre avec « Gérer les salons » (comme /ticket).
 */
export function canUseTicketWelcomeControls(
  userId: string,
  openerId: string | null | undefined,
  member: GuildMember | APIInteractionGuildMember | null,
): boolean {
  if (!openerId) return false;
  if (userId === openerId) return true;
  return memberHasManageChannels(member);
}
