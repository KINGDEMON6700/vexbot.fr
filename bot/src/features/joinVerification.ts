import {
  ActionRowBuilder,
  AttachmentBuilder,
  type ButtonInteraction,
  ButtonBuilder,
  ButtonStyle,
  GuildMember,
  MessageFlags,
  ModalBuilder,
  type ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { loadEnv } from "../config/env.js";
import { renderCaptchaImagePng } from "./captchaImage.js";
import { vexInternalGetJson, vexInternalPostJson } from "../lib/vexApi.js";
import { runJoinAutoRolesForMember } from "./joinAutoRoles.js";

export const JOIN_VERIFY_BUTTON_CUSTOM_ID = "vex_join_verify";
/** Réponse après le clic sur « Vérifier » : permet d’ouvrir la saisie du code image. */
export const JOIN_VERIFY_OPEN_MODAL_CUSTOM_ID = "vex_join_verify_open_modal";
export const JOIN_VERIFY_MODAL_CUSTOM_ID = "vex_join_verify_modal";
export const JOIN_VERIFY_MODAL_CODE_FIELD = "vex_join_verify_code";

export type JoinVerificationSettingsPayload = {
  moduleEnabled: boolean;
  channelId: string | null;
  unverifiedRoleId: string | null;
  panelMessageId: string | null;
  panelContent: string | null;
  panelUseEmbed: boolean;
  panelEmbedColor: number | null;
  panelEmbedId: string | null;
  buttonLabel: string | null;
  verifiedRoleIds: string[];
};

function normalizeIncomingSettings(raw: JoinVerificationSettingsPayload): JoinVerificationSettingsPayload {
  const ids = Array.isArray(raw.verifiedRoleIds)
    ? raw.verifiedRoleIds.filter((x): x is string => typeof x === "string" && /^\d{5,25}$/.test(x.trim()))
    : [];
  return { ...raw, verifiedRoleIds: [...new Set(ids)] };
}

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
  const value = res.ok ? normalizeIncomingSettings(res.data.settings) : null;
  if (res.ok) {
    settingsCache.set(guildId, { at: now, value });
  }
  return value;
}

function invalidateJoinVerificationSettingsCache(guildId: string): void {
  settingsCache.delete(guildId);
}

function isGateActive(s: JoinVerificationSettingsPayload | null): s is JoinVerificationSettingsPayload {
  return Boolean(s?.moduleEnabled && s.channelId && s.unverifiedRoleId);
}

function isInteractionAlreadyAcknowledged(e: unknown): boolean {
  if (typeof e !== "object" || e === null) return false;
  if ("code" in e && (e as { code: unknown }).code === 40060) return true;
  const raw = (e as { rawError?: { code?: unknown } }).rawError?.code;
  return raw === 40060;
}

function isUnknownInteractionError(e: unknown): boolean {
  if (typeof e !== "object" || e === null) return false;
  if ("code" in e && (e as { code: unknown }).code === 10062) return true;
  const raw = (e as { rawError?: { code?: unknown } }).rawError?.code;
  return raw === 10062;
}

/** Interaction expirée (~3 s) ou déjà traitée — inutile de journaliser en erreur. */
export function isBenignInteractionConsumeError(e: unknown): boolean {
  return isInteractionAlreadyAcknowledged(e) || isUnknownInteractionError(e);
}

/**
 * À l’arrivée : attribue le rôle « non vérifié ». La personne passe par le bouton du panneau + captcha avant d’être débloquée.
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

  return true;
}

/** Après bon captcha : retire le non vérifié, attribue les rôles configurés puis le module « Rôles à l’arrivée » si besoin. */
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

  const everyoneId = member.guild.id;
  const extra = settings.verifiedRoleIds ?? [];
  for (const roleId of extra) {
    if (!roleId || roleId === everyoneId) continue;
    if (roleId === settings.unverifiedRoleId) continue;
    if (member.roles.cache.has(roleId)) continue;
    await member.roles.add(roleId).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[join-verification] impossible d’ajouter un rôle après vérif.", roleId, msg);
    });
  }

  await runJoinAutoRolesForMember(member, {
    excludeRoleIds: settings.unverifiedRoleId ? [settings.unverifiedRoleId] : undefined,
  });
  invalidateJoinVerificationSettingsCache(member.guild.id);
}

export async function handleJoinVerifyButton(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.guild || !interaction.isButton() || !interaction.user) return;

  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }
  } catch (e: unknown) {
    if (isBenignInteractionConsumeError(e)) return;
    throw e;
  }

  const guildMember =
    interaction.member instanceof GuildMember
      ? interaction.member
      : await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  if (!guildMember || guildMember.user.bot) {
    await interaction.editReply({ content: "Action impossible ici." }).catch(() => {});
    return;
  }

  const settings = await fetchJoinVerificationSettings(interaction.guild.id);
  if (!isGateActive(settings)) {
    await interaction
      .editReply({
        content:
          "La vérification à l’arrivée n’est pas active ou pas complètement configurée sur ce serveur. Vérifiez le panneau Vex et republic le message si besoin.",
      })
      .catch(() => {});
    return;
  }

  if (!guildMember.roles.cache.has(settings.unverifiedRoleId!)) {
    await interaction.editReply({
      content:
        "Tu n’as pas besoin de cliquer ici (tu es déjà vérifié ou ce bouton ne te concerne pas).",
    }).catch(() => {});
    return;
  }

  const env = loadEnv();
  const issued = await vexInternalPostJson<{ code: string }>(env, "/join-verification/issue-captcha", {
    discordGuildId: interaction.guild.id,
    discordUserId: interaction.user.id,
  });

  if (!issued.ok || !issued.data?.code) {
    await interaction
      .editReply({
        content:
          "Impossible de préparer la vérification pour le moment. Réessaie dans un instant ou demande à un modérateur.",
      })
      .catch(() => {});
    return;
  }

  let png: Buffer;
  try {
    png = renderCaptchaImagePng(issued.data.code);
  } catch {
    await interaction
      .editReply({
        content:
          "Le captcha graphique est indisponible sur cette machine ; contactez les administrateurs Vex.",
      })
      .catch(() => {});
    return;
  }

  const attachment = new AttachmentBuilder(png, { name: "verification.png" });
  await interaction
    .editReply({
      content:
        "Tu es la seule personne à voir ce message ici.\n\n" +
          "**D’après l’image ci-dessous**, clique sur **Saisir le code**, puis retape les caractères **exactement** comme sur l’image (majuscules, sans espace). " +
          "Tu as environ 15 minutes avant expiration.",
      files: [attachment],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(JOIN_VERIFY_OPEN_MODAL_CUSTOM_ID)
            .setLabel("Saisir le code")
            .setStyle(ButtonStyle.Primary),
        ),
      ],
    })
    .catch(() => {});
}

export async function handleJoinVerifyOpenModal(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.isButton()) return;

  await interaction.showModal(
    new ModalBuilder()
      .setCustomId(JOIN_VERIFY_MODAL_CUSTOM_ID)
      .setTitle("Code sur l’image")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId(JOIN_VERIFY_MODAL_CODE_FIELD)
            .setLabel("Retape les 6 caractères visibles")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("Exemple : XY4Z92")
            .setRequired(true)
            .setMinLength(6)
            .setMaxLength(6),
        ),
      ),
  );
}

export async function handleJoinVerifyCaptchaModal(interaction: ModalSubmitInteraction): Promise<void> {
  if (!interaction.guild || !interaction.user) return;

  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }
  } catch (e: unknown) {
    if (isBenignInteractionConsumeError(e)) return;
    throw e;
  }

  const guildMember =
    interaction.member instanceof GuildMember
      ? interaction.member
      : await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  if (!guildMember || guildMember.user.bot) {
    await interaction.editReply({ content: "Action impossible ici." }).catch(() => {});
    return;
  }

  const settings = await fetchJoinVerificationSettings(interaction.guild.id);
  if (!isGateActive(settings)) {
    await interaction
      .editReply({ content: "La vérification à l’arrivée n’est pas active sur ce serveur." })
      .catch(() => {});
    return;
  }

  if (!guildMember.roles.cache.has(settings.unverifiedRoleId!)) {
    await interaction.editReply({ content: "Tu n’as plus besoin de vérifier." }).catch(() => {});
    return;
  }

  const raw = interaction.fields.getTextInputValue(JOIN_VERIFY_MODAL_CODE_FIELD).trim();
  if (!raw || raw.length !== 6) {
    await interaction
      .editReply({ content: "Le code doit comporter exactement 6 caractères (comme sur l’image)." })
      .catch(() => {});
    return;
  }

  const env = loadEnv();
  const check = await vexInternalPostJson<{ ok: boolean }>(env, "/join-verification/check-captcha", {
    discordGuildId: interaction.guild.id,
    discordUserId: interaction.user.id,
    code: raw,
  });

  if (!check.ok || check.data === undefined) {
    await interaction
      .editReply({ content: "Impossible de contrôler ton code ; réessaie dans un instant." })
      .catch(() => {});
    return;
  }

  if (!check.data.ok) {
    await interaction
      .editReply({
        content:
          "Ce n’est pas le bon code. Rouvre « Saisir le code » sur le même message avec l’image, ou reclique sur le bouton principal du panneau pour avoir une nouvelle image.",
      })
      .catch(() => {});
    return;
  }

  await applyJoinVerificationSuccess(guildMember);
  await interaction
    .editReply({ content: "Merci, tout est bon : tu as désormais accès au serveur." })
    .catch(() => {});
}
