import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type TextChannel,
} from "discord.js";
import { TICKET_WELCOME_MEMBER_CLOSE_CUSTOM_ID } from "./ticketMemberClose.js";
import { TICKET_WELCOME_MEMBER_ADD_CUSTOM_ID } from "./ticketWelcomeMemberAdd.js";
import {
  DEFAULT_TICKET_WELCOME_ADD_EMOJI,
  DEFAULT_TICKET_WELCOME_CLOSE_EMOJI,
  parseTicketWelcomeButtonEmojiForDiscord,
} from "../lib/ticketWelcomeButtonEmoji.js";

type PanelButtonStyle = "primary" | "secondary" | "success" | "danger";

function toDiscordButtonStyle(s: PanelButtonStyle): ButtonStyle {
  switch (s) {
    case "secondary":
      return ButtonStyle.Secondary;
    case "success":
      return ButtonStyle.Success;
    case "danger":
      return ButtonStyle.Danger;
    default:
      return ButtonStyle.Primary;
  }
}

const WELCOME_COLOR = 0x3ba55c;

/**
 * Message d’accueil quand aucun modèle Embeds n’est choisi (aligné sur le texte par défaut du panel Vex).
 */
export async function sendBuiltInTicketWelcome(
  channel: TextChannel,
  openerId: string,
  opts: {
    closeButton: boolean;
    closeStyle: PanelButtonStyle;
    closeEmoji?: string | null;
    addButton: boolean;
    addStyle: PanelButtonStyle;
    addEmoji?: string | null;
  },
): Promise<void> {
  const base = `Bonjour <@${openerId}>, un membre du staff va te répondre.`;
  const withButtons = opts.closeButton || opts.addButton;
  const description = withButtons
    ? `${base}\n\nUtilise les boutons ci-dessous pour gérer ton ticket.`
    : base;

  const embed = new EmbedBuilder().setTitle("🎫 Ticket ouvert").setDescription(description).setColor(WELCOME_COLOR);

  const components: ActionRowBuilder<ButtonBuilder>[] = [];
  if (withButtons) {
    const row = new ActionRowBuilder<ButtonBuilder>();
    if (opts.closeButton) {
      const em = parseTicketWelcomeButtonEmojiForDiscord(opts.closeEmoji, DEFAULT_TICKET_WELCOME_CLOSE_EMOJI);
      const b = new ButtonBuilder()
        .setCustomId(TICKET_WELCOME_MEMBER_CLOSE_CUSTOM_ID)
        .setLabel("Fermer ce ticket")
        .setStyle(toDiscordButtonStyle(opts.closeStyle));
      if ("id" in em) b.setEmoji({ id: em.id, name: em.name, animated: em.animated });
      else b.setEmoji(em.name);
      row.addComponents(b);
    }
    if (opts.addButton) {
      const em = parseTicketWelcomeButtonEmojiForDiscord(opts.addEmoji, DEFAULT_TICKET_WELCOME_ADD_EMOJI);
      const b = new ButtonBuilder()
        .setCustomId(TICKET_WELCOME_MEMBER_ADD_CUSTOM_ID)
        .setLabel("Ajouter au ticket")
        .setStyle(toDiscordButtonStyle(opts.addStyle));
      if ("id" in em) b.setEmoji({ id: em.id, name: em.name, animated: em.animated });
      else b.setEmoji(em.name);
      row.addComponents(b);
    }
    components.push(row);
  }

  await channel.send({
    embeds: [embed],
    components: components.length > 0 ? components : undefined,
  });
}
