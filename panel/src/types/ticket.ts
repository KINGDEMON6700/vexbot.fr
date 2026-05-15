export type TicketPanelOpenOption = {
  label: string;
  description?: string | null;
  /** Saisie texte (fenêtre Discord) après ce choix dans la liste. */
  requireModal: boolean;
  modalTitle: string;
  modalInputLabel: string;
  modalInputPlaceholder?: string | null;
  modalInputStyle: "short" | "paragraph";
};

/** Couleurs de bouton imposées par Discord (REST). */
export type DiscordTicketPanelButtonStyle = "primary" | "secondary" | "success" | "danger";

/** Configurable dans le panel : libellé du bouton, ou menu + formulaire par type. */
export type TicketPanelOpenConfig =
  | {
      v: 1;
      style: "button";
      buttonLabel: string;
      /** Style visuel du bouton sur le message Discord (pas de couleur personnalisée). */
      discordButtonStyle: DiscordTicketPanelButtonStyle;
      requireModal: boolean;
      modalTitle?: string | null;
      modalInputLabel?: string | null;
      modalInputPlaceholder?: string | null;
      modalInputStyle?: "short" | "paragraph" | null;
    }
  | {
      v: 1;
      style: "select";
      selectPlaceholder: string;
      options: TicketPanelOpenOption[];
    };

export type TicketSettings = {
  panelChannelId: string | null;
  panelMessageId: string | null;
  ticketCategoryId: string | null;
  welcomeEmbedId: string | null;
  panelEmbedId: string | null;
  /** null = texte et bouton par défaut (sans formulaire). */
  panelOpenConfig: TicketPanelOpenConfig | null;
  /** Bouton « fermer » sous le message d’accueil (auteur ou équipe avec « Gérer les salons »). */
  welcomeMemberCloseButton: boolean;
  /** Couleur Discord du bouton « fermer le ticket ». */
  welcomeMemberCloseButtonStyle: DiscordTicketPanelButtonStyle;
  /** Bouton « ajouter » : fenêtre pour coller l’ID du membre (auteur ou équipe). */
  welcomeMemberAddButton: boolean;
  welcomeMemberAddButtonStyle: DiscordTicketPanelButtonStyle;
  /** Texte ou `<:nom:id>` ; vide en base = emoji par défaut 🔒 / 👥 à l’affichage. */
  welcomeMemberCloseButtonEmoji: string | null;
  welcomeMemberAddButtonEmoji: string | null;
  /** Combien de tickets encore ouverts un même membre peut avoir (1–25). */
  maxOpenTicketsPerOpener: number;
};

export type TicketListItem = {
  id: string;
  ticketNumber: number;
  channelId: string;
  openerId: string;
  status: string;
  createdAt: string;
  closedAt: string | null;
  subject: string | null;
  channelDiscordName: string | null;
  openerDisplayName: string | null;
};

export type TicketDetailResponse = {
  ticket: TicketListItem & {
    closedById: string | null;
    closeReason: string | null;
    embedId: string | null;
    openerAvatarHash: string | null;
    openerDiscordUsername: string | null;
  };
  transcript: {
    format: string;
    content: string;
    messageCount: number | null;
    generatedAt: string;
  } | null;
  discordBotProfile: {
    id: string;
    username: string;
    globalName: string | null;
    avatarHash: string | null;
  } | null;
};
