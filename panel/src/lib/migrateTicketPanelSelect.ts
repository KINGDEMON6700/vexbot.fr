import type { TicketPanelOpenConfig } from "../types/ticket.js";

/** Ancienne config : `requireModal` sur tout le menu → copié sur chaque option (aligné sur l’API). */
export function migrateSelectConfigFromStorage(raw: unknown): unknown {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const o = raw as Record<string, unknown>;
  if (o.style !== "select" || !Array.isArray(o.options)) return raw;
  const parentRm = typeof o.requireModal === "boolean" ? o.requireModal : true;
  const options = o.options.map((opt: unknown) => {
    if (!opt || typeof opt !== "object" || Array.isArray(opt)) return opt;
    const op = opt as Record<string, unknown>;
    if (typeof op.requireModal === "boolean") return opt;
    return { ...op, requireModal: parentRm };
  });
  const { requireModal: _drop, ...rest } = o;
  return { ...rest, options };
}

export function normalizeSelectConfigClient(c: TicketPanelOpenConfig): TicketPanelOpenConfig {
  if (c.style !== "select") return c;
  return migrateSelectConfigFromStorage(c) as TicketPanelOpenConfig;
}
