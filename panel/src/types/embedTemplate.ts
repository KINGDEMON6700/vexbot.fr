export type EmbedTimestampMode = "NONE" | "NOW" | "FIXED";

export type EmbedFieldRow = {
  name: string;
  value: string;
  inline: boolean;
};

export type ButtonStyleTemplate = "primary" | "secondary" | "success" | "danger";

export type DiscordButtonEmojiTemplate =
  | { name: string }
  | { id: string; name?: string; animated?: boolean };

/** Un composant sous le message : uniquement bouton ou bouton lien (pas de menus). */
export type MessageComponentTemplate =
  | {
      type: "button";
      label: string;
      style: ButtonStyleTemplate;
      customId: string;
      disabled?: boolean;
      emoji?: DiscordButtonEmojiTemplate;
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
  threadMode: "NONE" | "CREATE_NEW" | "EXISTING";
  threadName: string | null;
  threadTargetId: string | null;
  threadAutoArchiveDuration: 60 | 1440 | 4320 | 10080 | null;
  threadType: "PUBLIC" | "PRIVATE" | null;
  embeds: EmbedBlockTemplate[];
  componentBlocks: ComponentBlockTemplate[];
};

/** Modèle enregistré : nom + un ou plusieurs messages. */
export type EmbedTemplate = {
  id: string;
  name: string;
  /** Couleur du badge dans la liste des modèles (0xRRGGBB), null = style par défaut. */
  listAccentColor: number | null;
  /** Couleur de l’icône dans ce badge, null = automatique (blanc sur fond coloré, sinon thème). */
  listIconColor: number | null;
  /** Clé d’icône pour le badge (voir liste côté panel), null = icône par défaut. */
  listIconKey: string | null;
  messages: TemplateMessageTemplate[];
  createdAt: string;
  updatedAt: string;
};
