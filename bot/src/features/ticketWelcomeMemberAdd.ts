import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
  type ButtonInteraction,
  type GuildMember,
  type ModalSubmitInteraction,
  type TextChannel,
  type UserSelectMenuInteraction,
} from "discord.js";
import { loadEnv } from "../config/env.js";
import { canUseTicketWelcomeControls } from "../lib/ticketWelcomeMemberPermission.js";
import { vexInternalGetJson } from "../lib/vexApi.js";

export const TICKET_WELCOME_MEMBER_ADD_CUSTOM_ID = "vex_ticket_welcome_add";

/** Préfixe + id du salon ticket : `vex_tkw_add_usr:<channelId>` */
export const TICKET_WELCOME_ADD_USER_SELECT_PREFIX = "vex_tkw_add_usr:";
/** Bouton « coller l’ID » : `vex_tkw_add_id:<channelId>` */
export const TICKET_WELCOME_ADD_ID_BTN_PREFIX = "vex_tkw_add_id:";
/** Modal : `vex_tkw_add_m:<channelId>` */
export const TICKET_WELCOME_ADD_MODAL_PREFIX = "vex_tkw_add_m:";

const ADD_FIELD_USER_ID = "vex_tkw_uid";

type OpenByChannelResponse = {
  open: boolean;
  ticketId: string | null;
  openerId: string | null;
  welcomeMemberAddButton?: boolean;
};

type Env = ReturnType<typeof loadEnv>;

async function loadOpenTicketContext(
  env: Env,
  guildId: string,
  textCh: TextChannel,
): Promise<{ ok: true; data: OpenByChannelResponse } | { ok: false; message: string }> {
  const q = new URLSearchParams({ discordGuildId: guildId, channelId: textCh.id });
  const openRes = await vexInternalGetJson<OpenByChannelResponse>(
    env,
    `/tickets/open-by-channel?${q.toString()}`,
  );
  if (!openRes.ok) {
    return { ok: false, message: openRes.message ?? "Impossible de vérifier ce ticket." };
  }
  if (!openRes.data.open || !openRes.data.openerId) {
    return { ok: false, message: "Ce salon ne correspond pas à un ticket ouvert." };
  }
  if (!openRes.data.welcomeMemberAddButton) {
    return {
      ok: false,
      message: "L’ajout via ce bouton n’est plus activé sur ce serveur (réglages Vex).",
    };
  }
  return { ok: true, data: openRes.data };
}

async function addMemberToTicketChannel(
  textCh: TextChannel,
  member: GuildMember,
): Promise<{ ok: true; tag: string } | { ok: false; message: string }> {
  try {
    await textCh.permissionOverwrites.edit(member.id, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
      AttachFiles: true,
      EmbedLinks: true,
    });
    return { ok: true, tag: member.user.tag };
  } catch (e) {
    console.error("[ticket welcome add]", e);
    return {
      ok: false,
      message:
        "Impossible d’ajouter ce membre (permissions Discord). Vérifiez que le bot est au-dessus du rôle du membre dans la liste des rôles du serveur.",
    };
  }
}

export async function handleTicketWelcomeAddButton(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.guild || !interaction.guildId) {
    await interaction.reply({ content: "Ce bouton doit être utilisé sur un serveur.", ephemeral: true });
    return;
  }
  if (interaction.customId !== TICKET_WELCOME_MEMBER_ADD_CUSTOM_ID) return;

  const env = loadEnv();
  if (!env.API_BASE_URL || !env.VEX_BOT_API_SECRET) {
    await interaction.reply({
      content: "Ce bot n’est pas correctement relié au service Vex (configuration côté hébergeur).",
      ephemeral: true,
    });
    return;
  }

  const channel = interaction.channel;
  if (!channel || !channel.isTextBased() || channel.isDMBased()) {
    await interaction.reply({ content: "Ce bouton doit être utilisé dans le salon du ticket.", ephemeral: true });
    return;
  }
  const textCh = channel as TextChannel;

  const ctx = await loadOpenTicketContext(env, interaction.guildId, textCh);
  if (!ctx.ok) {
    await interaction.reply({ content: ctx.message, ephemeral: true });
    return;
  }

  if (!canUseTicketWelcomeControls(interaction.user.id, ctx.data.openerId, interaction.member)) {
    await interaction.reply({
      content: "Seul l’auteur du ticket ou un modérateur avec « Gérer les salons » peut utiliser ce bouton.",
      ephemeral: true,
    });
    return;
  }

  const ticketChannelId = textCh.id;
  const selectRow = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
    new UserSelectMenuBuilder()
      .setCustomId(`${TICKET_WELCOME_ADD_USER_SELECT_PREFIX}${ticketChannelId}`)
      .setPlaceholder("Choisir un membre du serveur")
      .setMinValues(1)
      .setMaxValues(1),
  );
  const idBtnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${TICKET_WELCOME_ADD_ID_BTN_PREFIX}${ticketChannelId}`)
      .setLabel("Coller l’ID à la place")
      .setStyle(ButtonStyle.Secondary),
  );

  await interaction.reply({
    content:
      "Choisis la personne à ajouter au ticket (menu ci-dessous). Tu peux aussi coller son ID Discord si tu préfères.",
    components: [selectRow, idBtnRow],
    ephemeral: true,
  });
}

export async function handleTicketWelcomeAddUserSelect(interaction: UserSelectMenuInteraction): Promise<void> {
  if (!interaction.guild || !interaction.guildId) return;
  if (!interaction.customId.startsWith(TICKET_WELCOME_ADD_USER_SELECT_PREFIX)) return;

  const ticketChannelId = interaction.customId.slice(TICKET_WELCOME_ADD_USER_SELECT_PREFIX.length);
  const env = loadEnv();
  if (!env.API_BASE_URL || !env.VEX_BOT_API_SECRET) {
    await interaction.reply({
      content: "Ce bot n’est pas correctement relié au service Vex (configuration côté hébergeur).",
      ephemeral: true,
    });
    return;
  }

  const textCh = (await interaction.guild.channels.fetch(ticketChannelId).catch(() => null)) as TextChannel | null;
  if (!textCh?.isTextBased() || textCh.isDMBased()) {
    await interaction.reply({ content: "Salon du ticket introuvable.", ephemeral: true });
    return;
  }

  const ctx = await loadOpenTicketContext(env, interaction.guildId, textCh);
  if (!ctx.ok) {
    await interaction.reply({ content: ctx.message, ephemeral: true });
    return;
  }
  if (!canUseTicketWelcomeControls(interaction.user.id, ctx.data.openerId, interaction.member)) {
    await interaction.reply({
      content: "Tu n’as pas la permission d’ajouter quelqu’un à ce ticket.",
      ephemeral: true,
    });
    return;
  }

  const userId = interaction.values[0];
  const member = await interaction.guild.members.fetch(userId).catch(() => null);
  if (!member) {
    await interaction.reply({ content: "Membre introuvable sur ce serveur.", ephemeral: true });
    return;
  }

  await interaction.deferUpdate();
  const result = await addMemberToTicketChannel(textCh, member);
  if (result.ok) {
    await interaction.editReply({
      content: `${result.tag} a été ajouté au ticket (accès au salon).`,
      components: [],
    });
  } else {
    await interaction.editReply({ content: result.message, components: [] });
  }
}

/** Bouton « Coller l’ID » : ouvre le modal avec le salon encodé. */
export async function handleTicketWelcomeAddIdButton(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.guild || !interaction.guildId) return;
  if (!interaction.customId.startsWith(TICKET_WELCOME_ADD_ID_BTN_PREFIX)) return;

  const ticketChannelId = interaction.customId.slice(TICKET_WELCOME_ADD_ID_BTN_PREFIX.length);
  const env = loadEnv();
  if (!env.API_BASE_URL || !env.VEX_BOT_API_SECRET) {
    await interaction.reply({
      content: "Ce bot n’est pas correctement relié au service Vex (configuration côté hébergeur).",
      ephemeral: true,
    });
    return;
  }

  const textCh = (await interaction.guild.channels.fetch(ticketChannelId).catch(() => null)) as TextChannel | null;
  if (!textCh?.isTextBased() || textCh.isDMBased()) {
    await interaction.reply({ content: "Salon du ticket introuvable.", ephemeral: true });
    return;
  }

  const ctx = await loadOpenTicketContext(env, interaction.guildId, textCh);
  if (!ctx.ok) {
    await interaction.reply({ content: ctx.message, ephemeral: true });
    return;
  }
  if (!canUseTicketWelcomeControls(interaction.user.id, ctx.data.openerId, interaction.member)) {
    await interaction.reply({
      content: "Tu n’as pas la permission d’ajouter quelqu’un à ce ticket.",
      ephemeral: true,
    });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(`${TICKET_WELCOME_ADD_MODAL_PREFIX}${ticketChannelId}`)
    .setTitle("Ajouter un membre");
  const input = new TextInputBuilder()
    .setCustomId(ADD_FIELD_USER_ID)
    .setLabel("ID du membre (17 à 22 chiffres)")
    .setStyle(TextInputStyle.Short)
    .setMinLength(17)
    .setMaxLength(22)
    .setRequired(true);
  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
  await interaction.showModal(modal);
}

export async function handleTicketWelcomeAddModal(interaction: ModalSubmitInteraction): Promise<void> {
  if (!interaction.guild || !interaction.guildId) return;
  if (!interaction.customId.startsWith(TICKET_WELCOME_ADD_MODAL_PREFIX)) return;

  const ticketChannelId = interaction.customId.slice(TICKET_WELCOME_ADD_MODAL_PREFIX.length);
  const env = loadEnv();
  if (!env.API_BASE_URL || !env.VEX_BOT_API_SECRET) {
    await interaction.reply({
      content: "Ce bot n’est pas correctement relié au service Vex (configuration côté hébergeur).",
      ephemeral: true,
    });
    return;
  }

  const textCh = (await interaction.guild.channels.fetch(ticketChannelId).catch(() => null)) as TextChannel | null;
  if (!textCh?.isTextBased() || textCh.isDMBased()) {
    await interaction.reply({ content: "Salon du ticket introuvable.", ephemeral: true });
    return;
  }

  const ctx = await loadOpenTicketContext(env, interaction.guildId, textCh);
  if (!ctx.ok) {
    await interaction.reply({ content: ctx.message, ephemeral: true });
    return;
  }
  if (!canUseTicketWelcomeControls(interaction.user.id, ctx.data.openerId, interaction.member)) {
    await interaction.reply({
      content: "Tu n’as pas la permission d’ajouter quelqu’un à ce ticket.",
      ephemeral: true,
    });
    return;
  }

  const rawId = interaction.fields.getTextInputValue(ADD_FIELD_USER_ID).trim();
  await interaction.deferReply({ ephemeral: true });

  if (!/^\d{17,22}$/.test(rawId)) {
    await interaction.editReply({
      content: "L’identifiant doit être une suite de 17 à 22 chiffres (ID Discord du membre).",
    });
    return;
  }

  const member = await interaction.guild.members.fetch(rawId).catch(() => null);
  if (!member) {
    await interaction.editReply({
      content:
        "Aucun membre avec cet ID sur ce serveur (ou le bot ne peut pas voir ce membre). La personne doit avoir déjà rejoint le serveur.",
    });
    return;
  }

  const result = await addMemberToTicketChannel(textCh, member);
  if (result.ok) {
    await interaction.editReply({
      content: `${result.tag} a été ajouté au ticket (accès au salon).`,
    });
  } else {
    await interaction.editReply({ content: result.message });
  }
}
