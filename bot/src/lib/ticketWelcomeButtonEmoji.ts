/** Aligné sur `api/src/lib/ticketWelcomeButtonEmoji.ts` (même logique pour le message d’accueil intégré). */
export const DEFAULT_TICKET_WELCOME_CLOSE_EMOJI = "🔒";
export const DEFAULT_TICKET_WELCOME_ADD_EMOJI = "👥";

export type DiscordButtonEmojiPayload =
  | { name: string }
  | { id: string; name: string; animated?: boolean };

export function parseTicketWelcomeButtonEmojiForDiscord(
  raw: string | null | undefined,
  fallbackUnicode: string,
): DiscordButtonEmojiPayload {
  const t = typeof raw === "string" ? raw.trim() : "";
  if (!t) return { name: fallbackUnicode };
  const m = /^<(a)?:(\w+):(\d{5,25})>$/.exec(t);
  if (m) {
    const animated = Boolean(m[1]);
    const name = m[2] || "emoji";
    const id = m[3];
    return { id, name, animated };
  }
  if (t.length > 80) return { name: t.slice(0, 80) };
  return { name: t };
}
