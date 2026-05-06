export type EmbedTimestampMode = "NONE" | "NOW" | "FIXED";

export type EmbedFieldRow = {
  name: string;
  value: string;
  inline: boolean;
};

export type ButtonStyleTemplate = "primary" | "secondary" | "success" | "danger";

/** Un composant sous le message : uniquement bouton ou bouton lien (pas de menus). */
export type MessageComponentTemplate =
  | {
      type: "button";
      label: string;
      style: ButtonStyleTemplate;
      customId: string;
      disabled?: boolean;
    }
  | {
      type: "link_button";
      label: string;
      url: string;
      disabled?: boolean;
    };

export type ComponentRowTemplate = {
  components: MessageComponentTemplate[];
};

/** Groupe « Composants 1 », « Composants 2 », … */
export type ComponentBlockTemplate = {
  rows: ComponentRowTemplate[];
};

/** Un bloc embed (sans nom de modèle). */
export type EmbedBlockTemplate = {
  title: string | null;
  description: string | null;
  color: number | null;
  url: string | null;
  thumbnailUrl: string | null;
  imageUrl: string | null;
  authorName: string | null;
  authorUrl: string | null;
  authorIconUrl: string | null;
  footerText: string | null;
  footerIconUrl: string | null;
  fields: EmbedFieldRow[];
  timestampMode: EmbedTimestampMode;
  fixedAt: string | null;
};

/** Un message Discord dans le modèle (texte + embeds + groupes de composants). */
export type TemplateMessageTemplate = {
  messageContent: string | null;
  /** Nom affiché à la place du bot pour ce message (optionnel). */
  profileDisplayName: string | null;
  /** URL de l’avatar à la place du bot pour ce message (optionnel). */
  profileAvatarUrl: string | null;
  embeds: EmbedBlockTemplate[];
  componentBlocks: ComponentBlockTemplate[];
};

/** Modèle enregistré : nom + un ou plusieurs messages. */
export type EmbedTemplate = {
  id: string;
  name: string;
  messages: TemplateMessageTemplate[];
  createdAt: string;
  updatedAt: string;
};
