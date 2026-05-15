import type { GuildMember } from "discord.js";
import { loadEnv } from "../config/env.js";
import { vexInternalGetJson } from "../lib/vexApi.js";

export type JoinAutoRoleSettingsPayload = {
  moduleEnabled: boolean;
  discordRoleIds: string[];
};

async function fetchSettings(guildId: string): Promise<JoinAutoRoleSettingsPayload | null> {
  const env = loadEnv();
  const res = await vexInternalGetJson<{ settings: JoinAutoRoleSettingsPayload }>(
    env,
    `/join-auto-roles/${guildId}`,
  );
  if (!res.ok) return null;
  return res.data.settings;
}

/** Ajoute les rôles configurés pour ce serveur (si le module est activé). */
export async function runJoinAutoRolesForMember(
  member: GuildMember,
  options?: { excludeRoleIds?: string[] },
): Promise<void> {
  if (member.user.bot) return;

  const settings = await fetchSettings(member.guild.id);
  if (!settings?.moduleEnabled || settings.discordRoleIds.length === 0) return;

  const exclude = new Set(options?.excludeRoleIds ?? []);
  const everyoneId = member.guild.id;
  for (const roleId of settings.discordRoleIds) {
    if (exclude.has(roleId)) continue;
    if (roleId === everyoneId) continue;
    if (member.roles.cache.has(roleId)) continue;
    await member.roles.add(roleId).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[join-auto-roles] impossible d’ajouter le rôle", roleId, msg);
    });
  }
}
