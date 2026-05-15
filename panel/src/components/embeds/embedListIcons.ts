/** Icônes proposées pour le badge du modèle dans la liste (Font Awesome solid). */
export const EMBED_TEMPLATE_LIST_ICON_KEYS = [
  "file-lines",
  "layer-group",
  "bell",
  "star",
  "heart",
  "ticket",
  "shield-halved",
  "flag",
  "bolt",
  "gift",
  "gear",
  "envelope",
  "users",
  "calendar-days",
  "megaphone",
  "house",
] as const;

export type EmbedTemplateListIconKey = (typeof EMBED_TEMPLATE_LIST_ICON_KEYS)[number];

const ICON_CLASS: Record<EmbedTemplateListIconKey, string> = {
  "file-lines": "fa-solid fa-file-lines",
  "layer-group": "fa-solid fa-layer-group",
  bell: "fa-solid fa-bell",
  star: "fa-solid fa-star",
  heart: "fa-solid fa-heart",
  ticket: "fa-solid fa-ticket",
  "shield-halved": "fa-solid fa-shield-halved",
  flag: "fa-solid fa-flag",
  bolt: "fa-solid fa-bolt",
  gift: "fa-solid fa-gift",
  gear: "fa-solid fa-gear",
  envelope: "fa-solid fa-envelope",
  users: "fa-solid fa-users",
  "calendar-days": "fa-solid fa-calendar-days",
  megaphone: "fa-solid fa-bullhorn",
  house: "fa-solid fa-house",
};

export function embedTemplateListIconClass(key: string | null | undefined): string {
  if (!key) return ICON_CLASS["file-lines"];
  return ICON_CLASS[key as EmbedTemplateListIconKey] ?? ICON_CLASS["file-lines"];
}
