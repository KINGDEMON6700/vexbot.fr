import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(16, "SESSION_SECRET doit faire au moins 16 caractères"),
  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_CLIENT_SECRET: z.string().min(1),
  /** Si vide : l’URL de callback est calculée à partir du Host de la requête (LAN / IP publique). */
  DISCORD_REDIRECT_URI: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : v),
    z.string().url().optional(),
  ),
  FRONTEND_URL: z.string().url(),
  /** Même application que le bot : sert à vérifier la présence du bot sur un serveur. */
  DISCORD_BOT_TOKEN: z.string().min(1),
  /** Secret partagé bot ↔ API (commandes internes, ex. /sendembed). Min. 16 caractères. */
  VEX_BOT_API_SECRET: z.string().min(16, "VEX_BOT_API_SECRET doit faire au moins 16 caractères"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function loadEnv(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Variables d'environnement invalides : ${msg}`);
  }
  cached = parsed.data;
  return cached;
}
