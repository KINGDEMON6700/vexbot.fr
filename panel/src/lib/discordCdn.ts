/** URL d’avatar utilisateur Discord (hash ou avatar par défaut selon l’id). */
export function discordUserAvatarUrl(
  userId: string | null | undefined,
  avatarHash: string | null | undefined,
  size = 80,
): string | null {
  if (!userId || !/^\d{5,25}$/.test(userId)) {
    return null;
  }
  if (avatarHash && /^[\w]+$/.test(avatarHash)) {
    const ext = avatarHash.startsWith("a_") ? "gif" : "webp";
    return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.${ext}?size=${size}`;
  }
  try {
    const idx = Number((BigInt(userId) >> 22n) % 6n);
    return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
  } catch {
    return null;
  }
}
