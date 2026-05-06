import { z } from "zod";

/** Format stocké côté API / panel : uniquement boutons classiques et boutons lien (pas de menus). */

const buttonSchema = z.object({
  type: z.literal("button"),
  label: z.string().min(1).max(80),
  style: z.enum(["primary", "secondary", "success", "danger"]),
  customId: z.string().min(1).max(100),
  disabled: z.boolean().optional(),
});

const linkButtonSchema = z.object({
  type: z.literal("link_button"),
  label: z.string().min(1).max(80),
  url: z.string().url().max(2048),
  disabled: z.boolean().optional(),
});

export const messageComponentSchema = z.union([buttonSchema, linkButtonSchema]);

export type MessageComponentInput = z.infer<typeof messageComponentSchema>;

/** À la lecture des anciens modèles : ne garde que bouton / bouton lien (ignore menus, etc.). */
export function sanitizeStoredComponent(raw: unknown): MessageComponentInput | null {
  const b = buttonSchema.safeParse(raw);
  if (b.success) return b.data;
  const l = linkButtonSchema.safeParse(raw);
  if (l.success) return l.data;
  return null;
}

export const componentRowSchema = z.object({
  components: z.array(messageComponentSchema).min(1).max(5),
});

export const componentRowsSchema = z.array(componentRowSchema).max(5);

/** Groupe « Composants 1 », « Composants 2 », … — contient des lignes d’action. */
export const componentBlockSchema = z.object({
  rows: componentRowsSchema,
});

export type ComponentRowInput = z.infer<typeof componentRowSchema>;
export type ComponentBlockInput = z.infer<typeof componentBlockSchema>;
