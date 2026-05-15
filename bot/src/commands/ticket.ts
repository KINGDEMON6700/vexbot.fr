import { SlashCommandBuilder, PermissionFlagsBits, type TextChannel } from "discord.js";
import type { SlashCommandModule } from "../types/command.js";
import { loadEnv } from "../config/env.js";
import { buildHtmlTranscript } from "../lib/ticketTranscriptHtml.js";
import { vexInternalGetJson, vexInternalPostJson } from "../lib/vexApi.js";

async function fetchOpenTicketChannel(
  env: ReturnType<typeof loadEnv>,
  guildId: string,
  channelId: string,
): Promise<{ open: boolean; openerId: string | null }> {
  const q = new URLSearchParams({ discordGuildId: guildId, channelId });
  const res = await vexInternalGetJson<{ open: boolean; openerId: string | null }>(
    env,
    `/tickets/open-by-channel?${q.toString()}`,
  );
  if (!res.ok) return { open: false, openerId: null };
  return { open: res.data.open, openerId: res.data.openerId ?? null };
}

const data = new SlashCommandBuilder()
  .setName("ticket")
  .setDescription("Gestion des tickets (équipe)")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .setDMPermission(false)
  .addSubcommand((sub) =>
    sub
      .setName("close")
      .setDescription("Fermer le ticket de ce salon et enregistrer le transcript.")
      .addStringOption((o) =>
        o
          .setName("raison")
          .setDescription("Résolu, doublon, invalide ou autre")
          .setRequired(false)
          .addChoices(
            { name: "Résolu", value: "RESOLVED" },
            { name: "Doublon", value: "DUPLICATE" },
            { name: "Invalide", value: "INVALID" },
            { name: "Autre", value: "OTHER" },
          ),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("add")
      .setDescription("Ajouter un membre au ticket (accès au salon).")
      .addStringOption((o) =>
        o
          .setName("identifiant")
          .setDescription("ID Discord du membre (menu Activité du serveur → clic droit sur le profil → Copier l’identifiant)")
          .setRequired(true)
          .setMinLength(17)
          .setMaxLength(22),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("kick")
      .setDescription("Retirer un membre du ticket (accès au salon).")
      .addStringOption((o) =>
        o
          .setName("identifiant")
          .setDescription("ID Discord du membre à retirer du salon de ticket")
          .setRequired(true)
          .setMinLength(17)
          .setMaxLength(22),
      ),
  );

const command: SlashCommandModule = {
  data,
  async execute(interaction) {
    if (!interaction.guildId || !interaction.guild) {
      await interaction.reply({ content: "Cette commande doit être utilisée sur un serveur.", ephemeral: true });
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

    const channel = interaction.channel;
    if (!channel || !channel.isTextBased() || channel.isDMBased()) {
      await interaction.reply({
        content: "Utilisez cette commande dans le salon du ticket concerné.",
        ephemeral: true,
      });
      return;
    }

    const textCh = channel as TextChannel;
    const sub = interaction.options.getSubcommand(true);

    if (sub === "add") {
      const rawId = interaction.options.getString("identifiant", true).trim();
      await interaction.deferReply({ ephemeral: true });

      if (!/^\d{17,22}$/.test(rawId)) {
        await interaction.editReply({
          content: "L’identifiant doit être une suite de 17 à 22 chiffres (ID Discord du membre).",
        });
        return;
      }

      const { open } = await fetchOpenTicketChannel(env, interaction.guildId, textCh.id);
      if (!open) {
        await interaction.editReply({
          content: "Ce salon ne correspond pas à un ticket ouvert enregistré par Vex.",
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

      try {
        await textCh.permissionOverwrites.edit(member.id, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
          AttachFiles: true,
          EmbedLinks: true,
        });
        await interaction.editReply({
          content: `${member.user.tag} a été ajouté au ticket (accès au salon).`,
        });
      } catch (e) {
        console.error("[ticket add]", e);
        await interaction.editReply({
          content:
            "Impossible d’ajouter ce membre (permissions Discord). Vérifiez que le bot est au-dessus du rôle du membre dans la liste des rôles du serveur.",
        });
      }
      return;
    }

    if (sub === "kick") {
      const rawId = interaction.options.getString("identifiant", true).trim();
      await interaction.deferReply({ ephemeral: true });

      if (!/^\d{17,22}$/.test(rawId)) {
        await interaction.editReply({
          content: "L’identifiant doit être une suite de 17 à 22 chiffres (ID Discord du membre).",
        });
        return;
      }

      const { open, openerId } = await fetchOpenTicketChannel(env, interaction.guildId, textCh.id);
      if (!open) {
        await interaction.editReply({
          content: "Ce salon ne correspond pas à un ticket ouvert enregistré par Vex.",
        });
        return;
      }

      if (openerId && rawId === openerId) {
        await interaction.editReply({
          content: "Tu ne peux pas retirer l’auteur du ticket du salon (ferme le ticket si besoin).",
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

      try {
        await textCh.permissionOverwrites.delete(rawId);
        await interaction.editReply({
          content: `${member.user.tag} a été retiré du ticket (plus d’accès à ce salon).`,
        });
      } catch (e) {
        console.error("[ticket kick]", e);
        await interaction.editReply({
          content:
            "Impossible de retirer ce membre (permissions Discord, ou aucun accès spécifique à enlever pour cette personne).",
        });
      }
      return;
    }

    if (sub !== "close") {
      await interaction.reply({ content: "Sous-commande inconnue.", ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const fetched = await textCh.messages.fetch({ limit: 100 }).catch(() => null);
    if (!fetched) {
      await interaction.editReply({ content: "Impossible de lire les messages de ce salon." });
      return;
    }

    const sorted = [...fetched.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
    const payload = sorted.map((m) => ({
      id: m.id,
      authorId: m.author?.id ?? "?",
      authorTag: m.author?.tag ?? m.author?.id ?? "?",
      authorAvatar: m.author?.avatar ?? null,
      createdAt: m.createdAt.toISOString(),
      content: m.cleanContent?.slice(0, 3500) ?? "",
    }));

    const html = buildHtmlTranscript(payload);
    const reasonRaw = interaction.options.getString("raison");
    const closeReason = (reasonRaw ?? "RESOLVED") as "RESOLVED" | "DUPLICATE" | "INVALID" | "OTHER";

    const close = await vexInternalPostJson<{ ok: boolean; ticketId?: string; ticketNumber?: number }>(
      env,
      "/tickets/close",
      {
        discordGuildId: interaction.guildId,
        channelId: textCh.id,
        closedByDiscordId: interaction.user.id,
        transcriptContent: html,
        format: "HTML",
        messageCount: sorted.length,
        closeReason,
      },
    );

    if (!close.ok) {
      await interaction.editReply({
        content:
          close.status === 404
            ? "Ce salon ne correspond pas à un ticket ouvert enregistré par Vex."
            : (close.message ?? "Impossible de fermer le ticket côté serveur."),
      });
      return;
    }
    if (!close.data.ok) {
      await interaction.editReply({ content: "Impossible de fermer le ticket côté serveur." });
      return;
    }

    const num = close.data.ticketNumber;
    await interaction.editReply({
      content: `Ticket #${num ?? "?"} fermé et transcript enregistré.`,
    });

    await textCh.delete("Ticket fermé").catch(() => {});
  },
};

export default command;
