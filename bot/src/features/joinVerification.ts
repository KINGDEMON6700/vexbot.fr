import {
  type ButtonInteraction,
  GuildMember,
  type Message,
} from "discord.js";
import { loadEnv } from "../config/env.js";
import { vexInternalGetJson, vexInternalPostJson } from "../lib/vexApi.js";
import { runJoinAutoRolesForMember } from "./joinAutoRoles.js";

export const JOIN_VERIFY_BUTTON_CUSTOM_ID = "vex_join_verify";

export type JoinVerificationSettingsPayload = {
  moduleEnabled: boolean;
  mode: "CAPTCHA" | "BUTTON";
  channelId: string | null;
  unverifiedRoleId: string | null;
  panelMessageId: string | null;
  buttonLabel: string | null;
};

const settingsCache = new Map<string, { at: number; value: JoinVerificationSettingsPayload | null }>();
const SETTINGS_TTL_MS = 8000;

async function fetchJoinVerificationSettings(
  guildId: string,
): Promise<JoinVerificationSettingsPayload | null> {
  const now = Date.now();
  const hit = settingsCache.get(guildId);
  if (hit && now - hit.at < SETTINGS_TTL_MS) {
    return hit.value;
  }

  const env = loadEnv();
  const res = await vexInternalGetJson<{ settings: JoinVerificationSettingsPayload }>(
    env,
    `/join-verification/${guildId}`,
  );
  const value = res.ok ? res.data.settings : null;
  settingsCache.set(guildId, { at: now, value });
  return value;
}

function invalidateJoinVerificationSettingsCache(guildId: string): void {
  settingsCache.delete(guildId);
}

function isGateActive(s: JoinVerificationSettingsPayload | null): s is JoinVerificationSettingsPayload {
  return Boolean(
    s?.moduleEnabled && s.channelId && s.unverifiedRoleId && (s.mode === "CAPTCHA" || s.mode === "BUTTON"),
  );
}

/**
 * Si la vérification est active et correctement configurée : attribue le rôle « non vérifié »
 * et (mode captcha) envoie le code en message privé. Les rôles d’arrivée habituels ne doivent pas
 * être appliqués avant la vérification.
 */
export async function runJoinVerificationOnJoin(member: GuildMember): Promise<boolean> {
  if (member.user.bot) return false;

  const settings = await fetchJoinVerificationSettings(member.guild.id);
  if (!isGateActive(settings)) return false;

  const everyone = member.guild.id;
  if (settings.unverifiedRoleId === everyone) return false;

  const rid = settings.unverifiedRoleId;
  if (!rid) return false;

  await member.roles.add(rid).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[join-verification] impossible d’ajouter le rôle non vérifié", msg);
  });

  if (settings.mode === "CAPTCHA") {
    const env = loadEnv();
    const issued = await vexInternalPostJson<{ code: string }>(env, "/join-verification/issue-captcha", {
      discordGuildId: member.guild.id,
      discordUserId: member.id,
    });
    if (!issued.ok || !issued.data?.code) {
      console.error("[join-verification] émission captcha", issued.ok ? JSON.stringify(issued.data) : issued.message);
      return true;
    }
    const code = issued.data.code;
    const dmText = [
      "Bienvenue ! Pour finir d’accéder au serveur, **copie-colle ce code** dans le salon de vérification :",
      "",
      `**${code}**`,
      "",
      "Il expire dans environ 15 minutes. (Si tu ne vois pas le salon, vérifie les rôles sur Discord.)",
    ].join("\n");

    await member.send({ content: dmText }).catch(() => {
      console.warn("[join-verification] impossible d’envoyer le code en message privé (DM fermés ?)", member.id);
    });
  }

  return true;
}

/** Après captcha ou bouton : retire le rôle non vérifié et applique les rôles d’arrivée habituels. */
export async function applyJoinVerificationSuccess(member: GuildMember): Promise<void> {
  if (member.user.bot) return;

  const settings = await fetchJoinVerificationSettings(member.guild.id);
  if (!settings?.unverifiedRoleId) return;

  if (member.roles.cache.has(settings.unverifiedRoleId)) {
    await member.roles.remove(settings.unverifiedRoleId).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[join-verification] impossible de retirer le rôle non vérifié", msg);
    });
  }

  await runJoinAutoRolesForMember(member, {
    excludeRoleIds: settings.unverifiedRoleId ? [settings.unverifiedRoleId] : undefined,
  });
  invalidateJoinVerificationSettingsCache(member.guild.id);
}

export async function handleJoinVerifyButton(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.guild || !interaction.member || !interaction.isButton()) return;

  const guildMember =
    interaction.member instanceof GuildMember
      ? interaction.member
      : await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  if (!guildMember || guildMember.user.bot) {
    await interaction.reply({ content: "Action impossible ici.", ephemeral: true });
    return;
  }

  const settings = await fetchJoinVerificationSettings(interaction.guild.id);
  if (!isGateActive(settings) || settings.mode !== "BUTTON") {
    await interaction.reply({ content: "La vérification par bouton n’est pas active sur ce serveur.", ephemeral: true });
    return;
  }

  if (!guildMember.roles.cache.has(settings.unverifiedRoleId!)) {
    await interaction.reply({
      content: "Tu n’as pas besoin de cliquer ici (tu es déjà vérifié ou ce bouton ne te concerne pas).",
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  await applyJoinVerificationSuccess(guildMember);
  await interaction.editReply({ content: "Merci, c’est bon ! Tu as accès au reste du serveur." });
}

export async function handleJoinVerifyCaptchaMessage(message: Message): Promise<void> {
  if (!message.guild || !message.channel?.isTextBased() || message.channel.isDMBased()) return;
  if (message.author.bot) return;

  const settings = await fetchJoinVerificationSettings(message.guild.id);
  if (!isGateActive(settings) || settings.mode !== "CAPTCHA") return;
  if (message.channel.id !== settings.channelId) return;

  const member = message.member ?? (await message.guild.members.fetch(message.author.id).catch(() => null));
  if (!member || member.user.bot) return;
  if (!member.roles.cache.has(settings.unverifiedRoleId!)) return;

  const submitted = message.content.trim();
  if (!submitted) return;

  const env = loadEnv();
  const check = await vexInternalPostJson<{ ok: boolean }>(env, "/join-verification/check-captcha", {
    discordGuildId: message.guild.id,
    discordUserId: message.author.id,
    code: submitted,
  });

  if (!check.ok || !check.data) {
    return;
  }

  if (!check.data.ok) {
    await message.delete().catch(() => {});
    await member
      .send({ content: "Ce n’est pas le bon code. Réessaie en recopiant le code reçu en message privé." })
      .catch(() => {});
    return;
  }

  await message.delete().catch(() => {});
  await applyJoinVerificationSuccess(member);
  await member.send({ content: "Parfait, tu es vérifié·e ! Bienvenue sur le serveur." }).catch(() => {});
}
