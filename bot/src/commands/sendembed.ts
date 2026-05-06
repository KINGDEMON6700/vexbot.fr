import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import type { SlashCommandModule } from "../types/command.js";
import { loadEnv } from "../config/env.js";

type ApiErrorJson = { error?: { message?: string; code?: string } };

async function requestSendEmbedTemplate(args: {
  apiBaseUrl: string;
  botSecret: string;
  discordGuildId: string;
  channelId: string;
  templateName: string;
}): Promise<
  | { ok: true; sent: number }
  | { ok: false; kind: "network" }
  | { ok: false; kind: "http"; status: number; message: string }
> {
  const base = args.apiBaseUrl.replace(/\/+$/, "");
  const url = `${base}/api/bot-internal/send-embed-template`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-vex-bot-key": args.botSecret,
      },
      body: JSON.stringify({
        discordGuildId: args.discordGuildId,
        channelId: args.channelId,
        templateName: args.templateName,
      }),
    });
  } catch {
    return { ok: false, kind: "network" };
  }

  if (!res.ok) {
    let message = "Impossible d’envoyer le modèle pour le moment.";
    try {
      const j = (await res.json()) as ApiErrorJson;
      if (j.error?.message) message = j.error.message;
    } catch {
      // ignore
    }
    return { ok: false, kind: "http", status: res.status, message };
  }

  const data = (await res.json()) as { ok?: boolean; sent?: number };
  if (data.ok !== true || typeof data.sent !== "number") {
    return { ok: false, kind: "http", status: res.status, message: "Réponse inattendue du serveur." };
  }
  return { ok: true, sent: data.sent };
}

const data = new SlashCommandBuilder()
  .setName("sendembed")
  .setDescription("Envoie un modèle Embeds du panel dans ce salon.")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setDMPermission(false)
  .addStringOption((opt) =>
    opt
      .setName("modele")
      .setDescription("Nom du modèle (page Embeds du panel)")
      .setRequired(true)
      .setMaxLength(100),
  );

const command: SlashCommandModule = {
  data,
  async execute(interaction) {
    if (!interaction.guildId) {
      await interaction.reply({
        content: "Utilise cette commande sur un serveur.",
        ephemeral: true,
      });
      return;
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({
        content: "Réservé aux membres avec la permission Administrateur.",
        ephemeral: true,
      });
      return;
    }

    const channel = interaction.channel;
    if (!channel || !channel.isTextBased() || channel.isDMBased()) {
      await interaction.reply({
        content: "Utilise cette commande dans un salon texte du serveur.",
        ephemeral: true,
      });
      return;
    }

    const env = loadEnv();
    if (!env.API_BASE_URL || !env.VEX_BOT_API_SECRET) {
      await interaction.reply({
        content:
          "Cette commande n’est pas disponible ici : il manque l’adresse de l’API ou la clé partagée dans la configuration du bot.",
        ephemeral: true,
      });
      return;
    }

    const modele = interaction.options.getString("modele", true).trim();
    if (!modele) {
      await interaction.reply({ content: "Indique le nom du modèle.", ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const result = await requestSendEmbedTemplate({
      apiBaseUrl: env.API_BASE_URL,
      botSecret: env.VEX_BOT_API_SECRET,
      discordGuildId: interaction.guildId,
      channelId: channel.id,
      templateName: modele,
    });

    if (!result.ok) {
      if (result.kind === "network") {
        await interaction.editReply({
          content:
            "Je n’arrive pas à joindre l’API Vex. Vérifie qu’elle tourne et que l’adresse dans la configuration du bot est correcte.",
        });
        return;
      }
      if (result.status === 404) {
        await interaction.editReply({
          content: "Aucun modèle ne correspond à ce nom sur ce serveur (sans tenir compte des majuscules).",
        });
        return;
      }
      await interaction.editReply({ content: result.message });
      return;
    }

    await interaction.editReply({
      content:
        result.sent > 1
          ? `C’est envoyé : ${result.sent} messages ont été postés dans ce salon.`
          : "C’est envoyé dans ce salon.",
    });
  },
};

export default command;
