/**
 * Aperçus tickets — mêmes règles que l’API (`api/src/lib/vexTicketDefaultBranding.ts`).
 * Les messages tickets par défaut (panneau et accueil) sont sans pied de page.
 */

import { defaultEmbedDraft, intToHex, type EmbedDraft } from "../components/embeds/embedDraft.js";

const COLOR_PANEL = 0x5865f2;
const COLOR_WELCOME = 0x3ba55c;

export function defaultTicketPanelEmbedDraft(): EmbedDraft {
  return {
    ...defaultEmbedDraft(),
    title: "💬 Tickets",
    description:
      "**Besoin d’aide ?**\nUtilisez le **bouton/menu** ci-dessous. Un salon privé sera ouvert pour échanger avec l’équipe du serveur.",
    colorHex: intToHex(COLOR_PANEL),
    footerText: "",
    footerIconUrl: "",
  };
}

/** Texte d’accueil sans la ligne sur les boutons (ajoutée seulement s’il y a des boutons sur le message). */
export const DEFAULT_TICKET_WELCOME_DESCRIPTION_BASE =
  "Bonjour <@123456789012345678>, un membre du staff va te répondre.";

export const DEFAULT_TICKET_WELCOME_BUTTONS_HINT = "Utilise les boutons ci-dessous pour gérer ton ticket.";

export function defaultTicketWelcomeEmbedDraft(): EmbedDraft {
  return {
    ...defaultEmbedDraft(),
    title: "🎫 Ticket ouvert",
    description: DEFAULT_TICKET_WELCOME_DESCRIPTION_BASE,
    colorHex: intToHex(COLOR_WELCOME),
    footerText: "",
    footerIconUrl: "",
  };
}
