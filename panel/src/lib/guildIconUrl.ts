/**
 * Discord n’accepte pour `?size=` que des puissances de 2 entre 16 et 4096.
 * Une valeur type 72 (36×2) peut renvoyer une image incorrecte ou cassée.
 */
const CDN_SIZES = [16, 32, 64, 128, 256, 512, 1024, 2048, 4096] as const;

function clampDiscordCdnSize(px: number): number {
  const n = Math.max(16, Math.min(4096, Math.round(px)));
  return CDN_SIZES.reduce((best, x) => (Math.abs(x - n) <= Math.abs(best - n) ? x : best));
}

/** URL de l’icône d’un serveur Discord (hash renvoyé par l’API). */
export function guildIconUrl(guildId: string, icon: string | null, pixelHint = 64): string | null {
  if (icon == null || typeof icon !== "string") return null;
  const trimmed = icon.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  const ext = trimmed.startsWith("a_") ? "gif" : "png";
  const size = clampDiscordCdnSize(pixelHint);
  return `https://cdn.discordapp.com/icons/${guildId}/${trimmed}.${ext}?size=${size}`;
}
