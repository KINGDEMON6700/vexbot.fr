import type { ButtonInteraction, TextChannel } from "discord.js";
import { loadEnv } from "../config/env.js";
import { buildHtmlTranscript } from "../lib/ticketTranscriptHtml.js";
import {
  canUseTicketWelcomeControls,
  memberHasManageChannels,
} from "../lib/ticketWelcomeMemberPermission.js";
import { vexInternalGetJson, vexInternalPostJson } from "../lib/vexApi.js";

export const TICKET_WELCOME_MEMBER_CLOSE_CUSTOM_ID = "vex_ticket_welcome_close";

type OpenByChannelResponse = {
  open: boolean;
  ticketId: string | null;
  openerId: string | null;
  welcomeMemberAddButton?: boolean;
};

export async function handleTicketWelcomeMemberClose(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.guild || !interaction.guildId) {
    await interaction.reply({ content: "Ce bouton doit être utilisé sur un serveur.", ephemeral: true });
    return;
  }
  if (interaction.customId !== TICKET_WELCOME_MEMBER_CLOSE_CUSTOM_ID) return;

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

  const q = new URLSearchParams({
    discordGuildId: interaction.guildId,
    channelId: textCh.id,
  });
  const openRes = await vexInternalGetJson<OpenByChannelResponse>(
    env,
    `/tickets/open-by-channel?${q.toString()}`,
  );
  if (!openRes.ok) {
    await interaction.reply({
      content: openRes.message ?? "Impossible de vérifier ce ticket.",
      ephemeral: true,
    });
    return;
  }
  if (!openRes.data.open || !openRes.data.openerId) {
    await interaction.reply({
      content: "Ce salon ne correspond pas à un ticket ouvert.",
      ephemeral: true,
    });
    return;
  }
  if (!canUseTicketWelcomeControls(interaction.user.id, openRes.data.openerId, interaction.member)) {
    await interaction.reply({
      content:
        "Seul l’auteur du ticket ou un modérateur avec « Gérer les salons » peut fermer le ticket avec ce bouton.",
      ephemeral: true,
    });
    return;
  }

  const isOpener = interaction.user.id === openRes.data.openerId;
  const welcomeCloseByStaff = !isOpener && memberHasManageChannels(interaction.member);

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
      closeReason: "OTHER",
      memberSelfClose: true,
      ...(welcomeCloseByStaff ? { welcomeCloseByStaff: true } : {}),
    },
  );

  if (!close.ok) {
    const msg =
      close.status === 403
        ? (close.message ?? "Tu ne peux pas fermer ce ticket ainsi.")
        : close.status === 404
          ? "Ce salon ne correspond pas à un ticket ouvert enregistré par Vex."
          : (close.message ?? "Impossible de fermer le ticket côté serveur.");
    await interaction.editReply({ content: msg });
    return;
  }
  if (!close.data.ok) {
    await interaction.editReply({ content: "Impossible de fermer le ticket côté serveur." });
    return;
  }

  const num = close.data.ticketNumber;
  await interaction.editReply({
    content: `Ticket #${num ?? "?"} fermé. Merci !`,
  });

  await textCh.delete(isOpener ? "Ticket fermé par le membre" : "Ticket fermé par l’équipe").catch(() => {});
}
