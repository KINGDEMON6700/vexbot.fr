import { z } from "zod";

const optionSchema = z.object({
  label: z.string().min(1).max(100),
  description: z.string().max(100).nullable().optional(),
  /** Saisie texte (fenêtre Discord) après ce choix dans la liste. */
  requireModal: z.boolean().default(true),
  modalTitle: z.string().min(1).max(45),
  modalInputLabel: z.string().min(1).max(45),
  modalInputPlaceholder: z.string().max(100).optional().nullable(),
  modalInputStyle: z.enum(["short", "paragraph"]),
});

/** Couleurs imposées par Discord pour les boutons (pas de couleur libre). */
const discordButtonStyleSchema = z.enum(["primary", "secondary", "success", "danger"]);

const buttonSchema = z.object({
  v: z.literal(1),
  style: z.literal("button"),
  buttonLabel: z.string().min(1).max(80),
  discordButtonStyle: discordButtonStyleSchema.default("primary"),
  requireModal: z.boolean(),
  modalTitle: z.string().max(45).nullable().optional(),
  modalInputLabel: z.string().max(45).nullable().optional(),
  modalInputPlaceholder: z.string().max(100).nullable().optional(),
  modalInputStyle: z.enum(["short", "paragraph"]).nullable().optional(),
});

const selectSchema = z.object({
  v: z.literal(1),
  style: z.literal("select"),
  selectPlaceholder: z.string().min(1).max(150),
  options: z.array(optionSchema).min(1).max(25),
});

export const panelOpenConfigSchema = z.discriminatedUnion("style", [buttonSchema, selectSchema]);

/** Ancienne config : `requireModal` au niveau du menu → recopié sur chaque option puis retiré. */
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

export type TicketPanelOpenConfig = z.infer<typeof panelOpenConfigSchema>;

export type DiscordTicketPanelButtonStyle = z.infer<typeof discordButtonStyleSchema>;

/** Comportement historique si aucune config n’est enregistrée. */
export const DEFAULT_TICKET_PANEL_OPEN_CONFIG: Extract<TicketPanelOpenConfig, { style: "button" }> = {
  v: 1,
  style: "button",
  buttonLabel: "Ouvrir un ticket",
  discordButtonStyle: "primary",
  requireModal: false,
  modalTitle: null,
  modalInputLabel: null,
  modalInputPlaceholder: null,
  modalInputStyle: "paragraph",
};

export function parseTicketPanelOpenConfig(raw: unknown): TicketPanelOpenConfig | null {
  const coerced = migrateSelectConfigFromStorage(raw);
  const r = panelOpenConfigSchema.safeParse(coerced);
  if (!r.success) return null;
  const d = r.data;
  if (d.style === "button" && d.requireModal) {
    if (!d.modalTitle?.trim() || !d.modalInputLabel?.trim()) return null;
  }
  if (d.style === "select") {
    for (const o of d.options) {
      if (o.requireModal && (!o.modalTitle?.trim() || !o.modalInputLabel?.trim())) return null;
    }
  }
  return r.data;
}

/** Config affichée / utilisée par le panneau Discord (jamais null : retombe sur les défauts). */
export function resolveTicketPanelOpenConfig(raw: unknown): TicketPanelOpenConfig {
  const p = parseTicketPanelOpenConfig(raw);
  if (p) return p;
  return DEFAULT_TICKET_PANEL_OPEN_CONFIG;
}

export function validateTicketPanelOpenConfigBody(raw: unknown): TicketPanelOpenConfig {
  const coerced = migrateSelectConfigFromStorage(raw);
  const r = panelOpenConfigSchema.safeParse(coerced);
  if (!r.success) {
    const msg = r.error.issues.map((e) => e.message).join(", ") || "Configuration d’ouverture invalide.";
    throw new Error(msg);
  }
  const d = r.data;
  if (d.style === "button" && d.requireModal) {
    if (!d.modalTitle?.trim() || !d.modalInputLabel?.trim()) {
      throw new Error("Avec un formulaire, le titre et le libellé du champ sont obligatoires.");
    }
  }
  if (d.style === "select") {
    for (const o of d.options) {
      if (o.requireModal && (!o.modalTitle?.trim() || !o.modalInputLabel?.trim())) {
        throw new Error(
          "Pour une option avec saisie activée, indiquez le titre de la fenêtre et la question au-dessus du champ.",
        );
      }
    }
  }
  return d;
}
