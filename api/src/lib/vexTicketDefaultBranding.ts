/**
 * Messages tickets par défaut (embed Discord) — alignés avec le panel (`vexTicketDefaultBranding.ts`).
 * Panneau et accueil type sont sans pied de page.
 */

const COLOR_PANEL = 0x5865f2;
const COLOR_WELCOME = 0x3ba55c;

/** Embed du panneau (salon public) quand aucun modèle n’est choisi, ou repli si le modèle est vide. */
export function defaultTicketPanelDiscordEmbed() {
  return {
    title: "💬 Tickets",
    description:
      "**Besoin d’aide ?**\nUtilisez le **bouton/menu** ci-dessous. Un salon privé sera ouvert pour échanger avec l’équipe du serveur.",
    color: COLOR_PANEL,
  };
}

/** Texte d’accueil sans la ligne sur les boutons (ajoutée seulement s’il y a des boutons sur le message). */
export const DEFAULT_TICKET_WELCOME_DESCRIPTION_BASE =
  "Bonjour <@123456789012345678>, un membre du staff va te répondre.";

export const DEFAULT_TICKET_WELCOME_BUTTONS_HINT = "Utilise les boutons ci-dessous pour gérer ton ticket.";

/**
 * Message d’accueil type (aperçu panel / cohérence textes). L’envoi réel utilise le modèle choisi en base.
 * @param includeButtonsHint — si vrai, ajoute la phrase sur les boutons (à utiliser quand le message en comporte).
 */
export function defaultTicketWelcomeDiscordEmbed(opts?: { includeButtonsHint?: boolean }) {
  const include = opts?.includeButtonsHint === true;
  const description = include
    ? `${DEFAULT_TICKET_WELCOME_DESCRIPTION_BASE}\n\n${DEFAULT_TICKET_WELCOME_BUTTONS_HINT}`
    : DEFAULT_TICKET_WELCOME_DESCRIPTION_BASE;
  return {
    title: "🎫 Ticket ouvert",
    description,
    color: COLOR_WELCOME,
  };
}
