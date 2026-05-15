import {
  ActionRowBuilder,
  ChannelType,
  ModalBuilder,
  type ModalSubmitInteraction,
  OverwriteType,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type Guild,
  type OverwriteResolvable,
  type StringSelectMenuInteraction,
  type TextChannel,
} from "discord.js";
import { loadEnv } from "../config/env.js";
import { vexInternalPostJson, vexInternalGetJson } from "../lib/vexApi.js";
import { sendBuiltInTicketWelcome } from "./ticketDefaultWelcomeSend.js";

export const TICKET_OPEN_BUTTON_CUSTOM_ID = "vex_ticket_open";
export const TICKET_OPEN_SELECT_CUSTOM_ID = "vex_ticket_open_sel";

const MODAL_PREFIX = "vex_tkm:";
const MODAL_BODY_FIELD = "vex_ticket_body";

type TicketPanelOpenConfig =
  | {
      v: 1;
      style: "button";
      buttonLabel: string;
      /** Style REST Discord (1–4) ; défaut côté API si absent en base. */
      discordButtonStyle?: "primary" | "secondary" | "success" | "danger";
      requireModal: boolean;
      modalTitle: string | null;
      modalInputLabel: string | null;
      modalInputPlaceholder: string | null;
      modalInputStyle: "short" | "paragraph" | null;
    }
  | {
      v: 1;
      style: "select";
      selectPlaceholder: string;
      options: Array<{
        label: string;
        description?: string | null;
        requireModal: boolean;
        modalTitle: string;
        modalInputLabel: string;
        modalInputPlaceholder?: string | null;
        modalInputStyle: "short" | "paragraph";
      }>;
    };

type TicketSettingsResponse = {
  settings: {
    ticketCategoryId: string;
    welcomeEmbedId: string | null;
    panelChannelId: string | null;
    panelMessageId: string | null;
    panelOpenConfig: TicketPanelOpenConfig | null;
    welcomeMemberCloseButton?: boolean;
    welcomeMemberCloseButtonStyle?: "primary" | "secondary" | "success" | "danger";
    welcomeMemberCloseButtonEmoji?: string | null;
    welcomeMemberAddButton?: boolean;
    welcomeMemberAddButtonStyle?: "primary" | "secondary" | "success" | "danger";
    welcomeMemberAddButtonEmoji?: string | null;
    maxOpenTicketsPerOpener?: number;
  };
};

type RegisterOpenResponse = {
  ticketId: string;
  ticketNumber: number;
  welcomeEmbedId: string | null;
};

function migrateSelectConfigFromStorage(raw: unknown): unknown {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const o = raw as Record<string, unknown>;
  if (o.style !== "select" || !Array.isArray(o.options)) return raw;
  const parentRm = typeof o.requireModal === "boolean" ? o.requireModal : true;
  const options = o.options.map((opt: unknown) => {
    if (!opt || typeof opt !== "object" || Array.isArray(opt)) return opt;
    const op = opt as Record<string, unknown>;
    if (typeof op.requireModal === "boolean") return opt;
    return { ...op, requireModal: parentRm };
  });
  const { requireModal: _drop, ...rest } = o;
  return { ...rest, options };
}

function resolveConfig(raw: unknown): TicketPanelOpenConfig {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    if (o.style === "select" && Array.isArray(o.options) && o.options.length > 0) {
      return migrateSelectConfigFromStorage(raw) as TicketPanelOpenConfig;
    }
    if (o.style === "button") {
      return raw as TicketPanelOpenConfig;
    }
  }
  return {
    v: 1,
    style: "button",
    buttonLabel: "Ouvrir un ticket",
    requireModal: false,
    modalTitle: null,
    modalInputLabel: null,
    modalInputPlaceholder: null,
    modalInputStyle: "paragraph",
  };
}

function modalIdButton(guildId: string): string {
  return `${MODAL_PREFIX}${guildId}:b`;
}

function modalIdSelect(guildId: string, optionIndex: number): string {
  return `${MODAL_PREFIX}${guildId}:s:${optionIndex}`;
}

function parseModalCustomId(customId: string): { guildId: string; kind: "b" } | { guildId: string; kind: "s"; idx: number } | null {
  if (!customId.startsWith(MODAL_PREFIX)) return null;
  const rest = customId.slice(MODAL_PREFIX.length);
  const i = rest.indexOf(":");
  if (i === -1) return null;
  const guildId = rest.slice(0, i);
  const tail = rest.slice(i + 1);
  if (!/^\d{5,32}$/.test(guildId)) return null;
  if (tail === "b") return { guildId, kind: "b" };
  const sm = /^s:(\d+)$/.exec(tail);
  if (sm) return { guildId, kind: "s", idx: parseInt(sm[1], 10) };
  return null;
}

function textInputStyleFromConfig(s: "short" | "paragraph" | null | undefined): TextInputStyle {
  return s === "short" ? TextInputStyle.Short : TextInputStyle.Paragraph;
}

function buildModalForButton(guildId: string, cfg: Extract<TicketPanelOpenConfig, { style: "button" }>): ModalBuilder {
  const title = (cfg.modalTitle ?? "Ticket").slice(0, 45);
  const label = (cfg.modalInputLabel ?? "Ta demande").slice(0, 45);
  const placeholder = (cfg.modalInputPlaceholder ?? "").slice(0, 100);
  const input = new TextInputBuilder()
    .setCustomId(MODAL_BODY_FIELD)
    .setLabel(label)
    .setStyle(textInputStyleFromConfig(cfg.modalInputStyle))
    .setRequired(true);
  if (placeholder) input.setPlaceholder(placeholder);
  return new ModalBuilder()
    .setCustomId(modalIdButton(guildId))
    .setTitle(title)
    .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
}

type SelectOptionCfg = {
  label: string;
  description?: string | null;
  modalTitle: string;
  modalInputLabel: string;
  modalInputPlaceholder?: string | null;
  modalInputStyle: "short" | "paragraph";
};

function buildModalForSelectOption(guildId: string, optionIndex: number, opt: SelectOptionCfg): ModalBuilder {
  const title = opt.modalTitle.slice(0, 45);
  const label = opt.modalInputLabel.slice(0, 45);
  const placeholder = (opt.modalInputPlaceholder ?? "").slice(0, 100);
  const input = new TextInputBuilder()
    .setCustomId(MODAL_BODY_FIELD)
    .setLabel(label)
    .setStyle(textInputStyleFromConfig(opt.modalInputStyle))
    .setRequired(true);
  if (placeholder) input.setPlaceholder(placeholder);
  return new ModalBuilder()
    .setCustomId(modalIdSelect(guildId, optionIndex))
    .setTitle(title)
    .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
}

/** Portion du nom de salon à partir du pseudo / nom affiché (Discord limite la longueur du salon). */
function slugFromUserDisplay(user: { username: string; globalName: string | null }): string {
  const raw = (user.globalName ?? user.username).trim() || "membre";
  let slug = raw
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "membre";
  if (slug.length > 80) slug = slug.slice(0, 80);
  return slug;
}

const DISCORD_CHANNEL_NAME_MAX = 100;

/**
 * Premier nom libre dans la catégorie : `ticket-slug`, puis `ticket-slug2`, `ticket-slug3`, …
 * (Discord autorise des noms identiques sur un serveur, mais on garde des noms distincts pour s’y retrouver.)
 */
function allocateTicketChannelName(guild: Guild, parentId: string, slug: string): string {
  let base = `ticket-${slug}`.toLowerCase();
  if (base.length > DISCORD_CHANNEL_NAME_MAX - 4) {
    base = base.slice(0, DISCORD_CHANNEL_NAME_MAX - 4);
  }

  const taken = new Set<string>();
  const parent = guild.channels.cache.get(parentId);
  if (parent?.type === ChannelType.GuildCategory) {
    for (const ch of parent.children.cache.values()) {
      if (ch.isTextBased()) taken.add(ch.name);
    }
  } else {
    for (const ch of guild.channels.cache.values()) {
      if (ch.parentId === parentId && ch.type === ChannelType.GuildText) {
        taken.add(ch.name);
      }
    }
  }

  let candidate = base;
  let n = 2;
  while (taken.has(candidate)) {
    candidate = `${base}${n}`.slice(0, DISCORD_CHANNEL_NAME_MAX);
    n += 1;
    if (n > 9999) break;
  }
  return candidate;
}

export async function handleTicketOpenSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  if (!interaction.guild || !interaction.guildId) {
    await interaction.reply({ content: "Ce menu doit être utilisé sur un serveur.", ephemeral: true });
    return;
  }
  if (interaction.customId !== TICKET_OPEN_SELECT_CUSTOM_ID) return;

  const env = loadEnv();
  if (!env.API_BASE_URL || !env.VEX_BOT_API_SECRET) {
    await interaction.reply({
      content: "Ce bot n’est pas correctement relié au service Vex (configuration côté hébergeur).",
      ephemeral: true,
    });
    return;
  }

  const settingsRes = await vexInternalGetJson<TicketSettingsResponse>(
    env,
    `/ticket-settings?discordGuildId=${encodeURIComponent(interaction.guildId)}`,
  );
  if (!settingsRes.ok) {
    await interaction.reply({
      content:
        settingsRes.kind === "config"
          ? "Service temporairement indisponible."
          : (settingsRes.message ?? "Impossible de charger la configuration des tickets."),
      ephemeral: true,
    });
    return;
  }

  const cfg = resolveConfig(settingsRes.data.settings.panelOpenConfig);
  if (cfg.style !== "select") {
    await interaction.reply({ content: "Ce menu n’est plus valide. Demandez à un admin de republicar le panneau.", ephemeral: true });
    return;
  }

  const idx = parseInt(interaction.values[0] ?? "", 10);
  const opt = cfg.options[idx];
  if (!opt) {
    await interaction.reply({ content: "Option inconnue. Réessaie ou contacte un administrateur.", ephemeral: true });
    return;
  }

  if (opt.requireModal) {
    const modal = buildModalForSelectOption(interaction.guildId, idx, opt);
    await interaction.showModal(modal);
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  await runTicketCreationAfterChecks(interaction, `(${opt.label})`);
}

export async function handleTicketOpenButton(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.guild || !interaction.guildId) {
    await interaction.reply({ content: "Ce bouton doit être utilisé sur un serveur.", ephemeral: true });
    return;
  }

  if (interaction.customId !== TICKET_OPEN_BUTTON_CUSTOM_ID) return;

  const env = loadEnv();
  if (!env.API_BASE_URL || !env.VEX_BOT_API_SECRET) {
    await interaction.reply({
      content: "Ce bot n’est pas correctement relié au service Vex (configuration côté hébergeur).",
      ephemeral: true,
    });
    return;
  }

  const settingsRes = await vexInternalGetJson<TicketSettingsResponse>(
    env,
    `/ticket-settings?discordGuildId=${encodeURIComponent(interaction.guildId)}`,
  );
  if (!settingsRes.ok) {
    const msg =
      settingsRes.kind === "config"
        ? "Service temporairement indisponible."
        : settingsRes.message ?? "Impossible de charger la configuration des tickets.";
    await interaction.reply({ content: msg, ephemeral: true });
    return;
  }

  const cfg = resolveConfig(settingsRes.data.settings.panelOpenConfig);
  if (cfg.style === "select") {
    await interaction.reply({
      content: "Ce serveur utilise un menu déroulant. Utilise la liste sur le panneau.",
      ephemeral: true,
    });
    return;
  }

  if (cfg.requireModal) {
    const modal = buildModalForButton(interaction.guildId, cfg);
    await interaction.showModal(modal);
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  await runTicketCreationAfterChecks(interaction, null);
}

export async function handleTicketOpenModal(interaction: ModalSubmitInteraction): Promise<void> {
  const parsed = parseModalCustomId(interaction.customId);
  if (!parsed) return;

  if (!interaction.guild || !interaction.guildId) {
    await interaction.reply({ content: "Ce formulaire doit être utilisé sur un serveur.", ephemeral: true });
    return;
  }

  if (interaction.guildId !== parsed.guildId) {
    await interaction.reply({ content: "Requête invalide.", ephemeral: true });
    return;
  }

  const env = loadEnv();
  if (!env.API_BASE_URL || !env.VEX_BOT_API_SECRET) {
    await interaction.reply({
      content: "Ce bot n’est pas correctement relié au service Vex (configuration côté hébergeur).",
      ephemeral: true,
    });
    return;
  }

  const settingsRes = await vexInternalGetJson<TicketSettingsResponse>(
    env,
    `/ticket-settings?discordGuildId=${encodeURIComponent(interaction.guildId)}`,
  );
  if (!settingsRes.ok) {
    await interaction.reply({
      content: settingsRes.message ?? "Impossible de charger la configuration des tickets.",
      ephemeral: true,
    });
    return;
  }

  const cfg = resolveConfig(settingsRes.data.settings.panelOpenConfig);
  let subject: string;

  if (parsed.kind === "b") {
    if (cfg.style !== "button" || !cfg.requireModal) {
      await interaction.reply({ content: "Ce formulaire n’est plus valide. Récupère le panneau à jour.", ephemeral: true });
      return;
    }
    subject = interaction.fields.getTextInputValue(MODAL_BODY_FIELD).trim();
  } else {
    if (cfg.style !== "select" || !cfg.options[parsed.idx]) {
      await interaction.reply({ content: "Cette option n’est plus valide. Récupère le panneau à jour.", ephemeral: true });
      return;
    }
    const selOpt = cfg.options[parsed.idx];
    if (!selOpt.requireModal) {
      await interaction.reply({
        content: "Ce formulaire n’est plus utilisé sur ce serveur. Demandez à un admin de republicar le panneau.",
        ephemeral: true,
      });
      return;
    }
    subject = interaction.fields.getTextInputValue(MODAL_BODY_FIELD).trim();
    const optLabel = selOpt.label;
    subject = `(${optLabel}) ${subject}`.slice(0, 500);
  }

  if (!subject) {
    await interaction.reply({ content: "Merci de remplir le champ.", ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  await runTicketCreationAfterChecks(interaction, subject);
}

async function runTicketCreationAfterChecks(
  interaction: ButtonInteraction | ModalSubmitInteraction | StringSelectMenuInteraction,
  subject: string | null,
): Promise<void> {
  const env = loadEnv();
  const guild = interaction.guild!;
  const gid = interaction.guildId!;
  const openerId = interaction.user.id;

  const settingsRes = await vexInternalGetJson<TicketSettingsResponse>(
    env,
    `/ticket-settings?discordGuildId=${encodeURIComponent(gid)}`,
  );
  if (!settingsRes.ok) {
    const msg =
      settingsRes.kind === "config"
        ? "Service temporairement indisponible."
        : settingsRes.message ?? "Impossible de charger la configuration des tickets.";
    await interaction.editReply({ content: msg });
    return;
  }

  const {
    ticketCategoryId,
    welcomeMemberCloseButton = false,
    welcomeMemberCloseButtonStyle = "danger",
    welcomeMemberCloseButtonEmoji = null,
    welcomeMemberAddButton = false,
    welcomeMemberAddButtonStyle = "primary",
    welcomeMemberAddButtonEmoji = null,
    maxOpenTicketsPerOpener = 1,
  } = settingsRes.data.settings;

  const maxOpen = Math.max(1, Math.min(25, Math.trunc(maxOpenTicketsPerOpener)));

  const countRes = await vexInternalPostJson<{ count: number; channelId: string | null }>(
    env,
    "/tickets/count-open-for-opener",
    {
      discordGuildId: gid,
      openerDiscordId: openerId,
    },
  );
  if (!countRes.ok) {
    await interaction.editReply({
      content: countRes.message ?? "Impossible de vérifier si un ticket est déjà ouvert.",
    });
    return;
  }
  if (countRes.data.count >= maxOpen) {
    const ch = countRes.data.channelId;
    const content =
      maxOpen <= 1
        ? ch
          ? `Tu as déjà un ticket ouvert : <#${ch}>`
          : "Tu as déjà un ticket ouvert sur ce serveur."
        : `Tu as déjà ${String(countRes.data.count)} ticket(s) ouvert(s) sur ce serveur. La limite est de ${String(maxOpen)}. Ferme-en un avant d’en ouvrir un nouveau.`;
    await interaction.editReply({ content });
    return;
  }

  const category = await guild.channels.fetch(ticketCategoryId).catch(() => null);
  if (!category || category.type !== ChannelType.GuildCategory) {
    await interaction.editReply({
      content:
        "La configuration des tickets sur ce serveur est incomplète ou obsolète. Un administrateur doit vérifier la page Tickets du panel.",
    });
    return;
  }

  const me = guild.members.me;
  if (!me) {
    await interaction.editReply({ content: "Le bot n’est pas prêt sur ce serveur. Veuillez réessayer dans un instant." });
    return;
  }

  const overwrites: OverwriteResolvable[] = [
    {
      id: guild.id,
      type: OverwriteType.Role,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: openerId,
      type: OverwriteType.Member,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
      ],
    },
    {
      id: me.id,
      type: OverwriteType.Member,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
      ],
    },
  ];

  let staffRows = 0;
  const maxStaffOverwrites = 35;
  for (const role of guild.roles.cache.values()) {
    if (role.id === guild.id) continue;
    if (
      role.permissions.has(PermissionFlagsBits.Administrator) ||
      role.permissions.has(PermissionFlagsBits.ManageChannels)
    ) {
      if (staffRows >= maxStaffOverwrites) break;
      overwrites.push({
        id: role.id,
        type: OverwriteType.Role,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.ManageMessages,
        ],
      });
      staffRows += 1;
    }
  }

  const slug = slugFromUserDisplay(interaction.user);
  const channelName = allocateTicketChannelName(guild, ticketCategoryId, slug);

  let createdId: string | null = null;
  try {
    const ch = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: ticketCategoryId,
      permissionOverwrites: overwrites,
      reason: `Ticket ouvert par ${interaction.user.tag}`,
    });
    createdId = ch.id;

    const reg = await vexInternalPostJson<RegisterOpenResponse>(env, "/tickets/register-open", {
      discordGuildId: gid,
      channelId: ch.id,
      openerDiscordId: openerId,
      subject: subject ?? null,
    });
    if (!reg.ok) {
      await ch.delete("Échec enregistrement ticket").catch(() => {});
      await interaction.editReply({
        content: reg.message ?? "Impossible d’enregistrer le ticket.",
      });
      return;
    }

    const regWelcomeId = reg.data.welcomeEmbedId;
    if (regWelcomeId) {
      const send = await vexInternalPostJson<{ ok: boolean; sent: number }>(env, "/send-embed-template-by-id", {
        discordGuildId: gid,
        channelId: ch.id,
        embedId: regWelcomeId,
      });
      if (!send.ok || !send.data?.ok) {
        await vexInternalPostJson(env, "/tickets/revert-open", {
          discordGuildId: gid,
          channelId: ch.id,
        });
        await ch.delete("Échec envoi message d’accueil").catch(() => {});
        const sendErr = !send.ok ? send.message : "Impossible d’envoyer le message d’accueil du ticket.";
        await interaction.editReply({
          content: sendErr ?? "Impossible d’envoyer le message d’accueil du ticket.",
        });
        return;
      }
    } else {
      try {
        await sendBuiltInTicketWelcome(ch as TextChannel, openerId, {
          closeButton: welcomeMemberCloseButton,
          closeStyle: welcomeMemberCloseButtonStyle,
          closeEmoji: welcomeMemberCloseButtonEmoji,
          addButton: welcomeMemberAddButton,
          addStyle: welcomeMemberAddButtonStyle,
          addEmoji: welcomeMemberAddButtonEmoji,
        });
      } catch (sendErr) {
        console.error("[ticket-open] accueil intégré", sendErr);
        await vexInternalPostJson(env, "/tickets/revert-open", {
          discordGuildId: gid,
          channelId: ch.id,
        });
        await ch.delete("Échec envoi message d’accueil").catch(() => {});
        await interaction.editReply({
          content: "Impossible d’envoyer le message d’accueil du ticket.",
        });
        return;
      }
    }

    if (subject?.trim()) {
      const chunk = `**Demande :** ${subject.trim()}`.slice(0, 2000);
      await ch.send({ content: chunk }).catch(() => {});
    }

    await interaction.editReply({
      content: `Le ticket est prêt : ${ch}`,
    });
  } catch (err) {
    console.error("[ticket-open]", err);
    if (createdId) {
      await vexInternalPostJson(env, "/tickets/revert-open", {
        discordGuildId: gid,
        channelId: createdId,
      }).catch(() => {});
      const ch = await guild.channels.fetch(createdId).catch(() => null);
      if (ch?.isTextBased()) await ch.delete("Erreur ouverture ticket").catch(() => {});
    }
    await interaction.editReply({
      content:
        "Une erreur s’est produite lors de la création du ticket. Veuillez réessayer ou contacter un administrateur du serveur.",
    });
  }
}
