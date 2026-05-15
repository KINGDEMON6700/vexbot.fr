import type { EmbedTemplate } from "../../types/embedTemplate.js";
import { templateDraftToApiPayload, templateToDraft, type TemplateDraft } from "./embedDraft.js";
import { EMBED_TEMPLATE_LIST_ICON_KEYS } from "./embedListIcons.js";

export const VEX_EMBED_JSON_VERSION = 1 as const;

export type VexEmbedTemplateJsonFile = {
  v: typeof VEX_EMBED_JSON_VERSION;
  name: string;
  messages: EmbedTemplate["messages"];
  listAccentColor?: number | null;
  listIconColor?: number | null;
  listIconKey?: string | null;
};

function slugifyFilename(name: string): string {
  const s = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]+/g, "")
    .slice(0, 60);
  return s || "modele";
}

export function defaultJsonExportFilename(draftName: string): string {
  return `vex-embed-${slugifyFilename(draftName || "modele")}.json`;
}

/** Export JSON (indenté) : version + même forme que l’enregistrement API. */
export function exportTemplateDraftToJsonString(d: TemplateDraft): string {
  let payload: ReturnType<typeof templateDraftToApiPayload>;
  try {
    payload = templateDraftToApiPayload(d);
  } catch (e) {
    if (e instanceof Error) {
      if (e.message === "name") {
        throw new Error("Donnez un nom au modèle avant d’exporter.");
      }
      if (e.message === "fixed") {
        throw new Error("Pour une date d’horodatage fixe, choisis une date et une heure complètes avant d’exporter.");
      }
    }
    throw new Error("Impossible de préparer l’export. Vérifie le contenu du modèle.");
  }
  const file: VexEmbedTemplateJsonFile = {
    v: VEX_EMBED_JSON_VERSION,
    name: payload.name,
    messages: payload.messages as EmbedTemplate["messages"],
    ...(payload.listAccentColor != null ? { listAccentColor: payload.listAccentColor } : {}),
    ...(payload.listIconColor != null ? { listIconColor: payload.listIconColor } : {}),
    ...(payload.listIconKey != null ? { listIconKey: payload.listIconKey } : {}),
  };
  return JSON.stringify(file, null, 2);
}

/**
 * Import : accepte `{ v, name, messages }` ou `{ name, messages }` (sans version).
 */
export function importTemplateDraftFromJson(text: string): TemplateDraft {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Ce fichier n’est pas un JSON valide.");
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Format invalide : un objet avec « name » et « messages » est attendu.");
  }
  const o = data as Record<string, unknown>;

  const ver = o.v;
  if (ver !== undefined && ver !== VEX_EMBED_JSON_VERSION) {
    throw new Error("Version d’export non reconnue. Utilise un fichier exporté depuis le panel Vex.");
  }

  const name = typeof o.name === "string" ? o.name.trim() : "";
  const messages = o.messages;
  if (!name) {
    throw new Error("Le nom du modèle est obligatoire dans le fichier.");
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error("Le fichier doit contenir au moins un message (« messages »).");
  }
  if (messages.length > 10) {
    throw new Error("Trop de messages (Discord autorise au plus 10 par modèle).");
  }

  let listAccentColor: number | null = null;
  if (typeof o.listAccentColor === "number" && Number.isFinite(o.listAccentColor)) {
    const c = Math.round(o.listAccentColor);
    if (c >= 0 && c <= 0xffffff) listAccentColor = c;
  }
  let listIconColor: number | null = null;
  if (typeof o.listIconColor === "number" && Number.isFinite(o.listIconColor)) {
    const c = Math.round(o.listIconColor);
    if (c >= 0 && c <= 0xffffff) listIconColor = c;
  }
  const rawIcon = typeof o.listIconKey === "string" ? o.listIconKey.trim() : "";
  const listIconKey =
    rawIcon && (EMBED_TEMPLATE_LIST_ICON_KEYS as readonly string[]).includes(rawIcon) ? rawIcon : null;

  const synthetic: EmbedTemplate = {
    id: "__import__",
    name,
    listAccentColor,
    listIconColor,
    listIconKey,
    messages: messages as EmbedTemplate["messages"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  try {
    return templateToDraft(synthetic);
  } catch {
    throw new Error(
      "La structure du JSON ne correspond pas à un modèle Vex (champs manquants ou types incorrects).",
    );
  }
}

export function downloadTextAsFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.click();
  URL.revokeObjectURL(url);
}
