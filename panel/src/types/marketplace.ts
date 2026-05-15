export type MarketplaceTemplateKind = "embed" | "server";

/** Entrée affichée dans la grille (publications marketplace depuis l’API). */
export type MarketplaceListItem = {
  id: string;
  kind: MarketplaceTemplateKind;
  name: string;
  shortDescription: string;
  authorDiscordId: string;
  authorDisplayName: string;
  authorAvatar: string | null;
  /** Logo statique (ex. templates officiels VexBot) — prioritaire sur l’avatar Discord. */
  authorLogoUrl?: string | null;
  likes: number;
  downloads: number;
  createdAt: string;
  /** Contenu : messages embed OU snapshot structure (kind server). */
  messages?: unknown;
  /** Métadonnées d’affichage (serveur d’origine du snapshot). */
  serverGuildId?: string;
  serverGuildName?: string;
  /** Id du template sauvegardé (page Templates), si connu. */
  sourceServerTemplateId?: string;
};

export type MarketplaceSortId = "popular" | "recent";

export type MarketplaceTypeFilterId = "all" | "embed" | "server";
