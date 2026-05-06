import { z } from "zod";

/** Chaîne vide dans le .env → traitée comme « non défini ». */
const optionalId = z.preprocess((v: unknown) => {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s === "" ? undefined : s;
}, z.string().min(1).optional());

const optionalUrl = z.preprocess((v: unknown) => {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s === "" ? undefined : s;
}, z.string().url().optional());

const optionalSecret = z.preprocess((v: unknown) => {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s === "" ? undefined : s;
}, z.string().min(16).optional());

const schema = z.object({
  DISCORD_BOT_TOKEN: z.string().min(1),
  DISCORD_CLIENT_ID: optionalId,
  DISCORD_GUILD_ID: optionalId,
  /** Requis pour /sendembed (même valeur que côté API). */
  API_BASE_URL: optionalUrl,
  VEX_BOT_API_SECRET: optionalSecret,
});

export type BotEnv = z.infer<typeof schema>;

let cached: BotEnv | null = null;

export function loadEnv(): BotEnv {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Variables d'environnement invalides : ${msg}`);
  }
  cached = parsed.data;
  return cached;
}

/** Pour le script de déploiement des slash (client + token obligatoires). */
export function loadDeployEnv(): Required<Pick<BotEnv, "DISCORD_BOT_TOKEN" | "DISCORD_CLIENT_ID">> &
  Pick<BotEnv, "DISCORD_GUILD_ID"> {
  const env = loadEnv();
  if (!env.DISCORD_CLIENT_ID) {
    throw new Error("DISCORD_CLIENT_ID est requis pour enregistrer les commandes slash.");
  }
  return {
    DISCORD_BOT_TOKEN: env.DISCORD_BOT_TOKEN,
    DISCORD_CLIENT_ID: env.DISCORD_CLIENT_ID,
    DISCORD_GUILD_ID: env.DISCORD_GUILD_ID,
  };
}
