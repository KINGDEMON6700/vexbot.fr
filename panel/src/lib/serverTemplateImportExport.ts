import type { ServerTemplateSnapshot } from "../types/serverTemplate.js";

export const SERVER_TEMPLATE_EXPORT_FORMAT = "vex-server-template" as const;
export const SERVER_TEMPLATE_EXPORT_VERSION = 1 as const;

export type ServerTemplateExportFile = {
  format: typeof SERVER_TEMPLATE_EXPORT_FORMAT;
  version: typeof SERVER_TEMPLATE_EXPORT_VERSION;
  exportedAt: string;
  name: string;
  description: string | null;
  snapshot: ServerTemplateSnapshot;
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return Boolean(x) && typeof x === "object" && !Array.isArray(x);
}

/** Contrôle minimal aligné sur l’API (snapshot v1). */
export function isClientSnapshotOk(raw: unknown): raw is ServerTemplateSnapshot {
  if (!isRecord(raw)) return false;
  if (raw.v !== 1) return false;
  if (typeof raw.guildName !== "string") return false;
  if (typeof raw.sourceGuildId !== "string") return false;
  if (!Array.isArray(raw.roles)) return false;
  if (!Array.isArray(raw.channels)) return false;
  return true;
}

export function buildServerTemplateExportPayload(input: {
  name: string;
  description: string | null;
  snapshot: ServerTemplateSnapshot;
}): ServerTemplateExportFile {
  return {
    format: SERVER_TEMPLATE_EXPORT_FORMAT,
    version: SERVER_TEMPLATE_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    name: input.name,
    description: input.description,
    snapshot: input.snapshot,
  };
}

export function parseServerTemplateImportFile(text: string): {
  name: string;
  description: string | null;
  snapshot: ServerTemplateSnapshot;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new Error("Ce fichier n’est pas un JSON valide.");
  }
  if (!isRecord(parsed)) {
    throw new Error("Le fichier doit contenir un objet JSON (pas une liste seule).");
  }

  let name: string;
  let description: string | null;
  let snapshot: unknown;

  if (
    parsed.format === SERVER_TEMPLATE_EXPORT_FORMAT &&
    parsed.version === SERVER_TEMPLATE_EXPORT_VERSION
  ) {
    name = typeof parsed.name === "string" ? parsed.name : "";
    if (parsed.description === null || parsed.description === undefined) {
      description = null;
    } else if (typeof parsed.description === "string") {
      const t = parsed.description.trim();
      description = t ? t : null;
    } else {
      description = null;
    }
    snapshot = parsed.snapshot;
  } else if ("snapshot" in parsed) {
    name = typeof parsed.name === "string" ? parsed.name : "";
    if (parsed.description === null || parsed.description === undefined) {
      description = null;
    } else if (typeof parsed.description === "string") {
      const t = parsed.description.trim();
      description = t ? t : null;
    } else {
      description = null;
    }
    snapshot = parsed.snapshot;
  } else {
    throw new Error(
      "Fichier non reconnu : il faut un export Vex (champs format + version) ou au minimum un objet avec « snapshot ».",
    );
  }

  if (!isClientSnapshotOk(snapshot)) {
    throw new Error(
      "Le contenu du template est invalide (version ou structure des rôles / salons).",
    );
  }

  return { name, description, snapshot };
}
