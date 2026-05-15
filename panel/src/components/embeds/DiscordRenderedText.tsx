import DOMPurify from "dompurify";
import { useMemo } from "react";
import { toHTML } from "discord-markdown";

export type MentionLookup = {
  channelNames: Record<string, string>;
  roleNames: Record<string, string>;
  /** Noms affichés pour les mentions &lt;@id&gt; (aperçu). */
  userNames?: Record<string, string>;
};

type Props = {
  text: string;
  lookup: MentionLookup;
  className?: string;
};

function escapeForCallback(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Rendu markdown façon Discord (gras, italique, codes, liens, spoilers, mentions).
 * Le HTML est sanitizé avant affichage.
 */
export function DiscordRenderedText({ text, lookup, className }: Props) {
  const safeHtml = useMemo(() => {
    if (!text.trim()) return "";
    const raw = toHTML(text, {
      embed: true,
      escapeHTML: true,
      discordCallback: {
        channel: (node) => `#${escapeForCallback(lookup.channelNames[node.id] ?? "salon")}`,
        role: (node) => `@${escapeForCallback(lookup.roleNames[node.id] ?? "rôle")}`,
        user: (node: { id: string }) =>
          `@${escapeForCallback(lookup.userNames?.[node.id] ?? "membre")}`,
        everyone: () => "@everyone",
        here: () => "@here",
      },
    });
    return DOMPurify.sanitize(raw, {
      ALLOWED_TAGS: [
        "a",
        "blockquote",
        "br",
        "code",
        "del",
        "div",
        "em",
        "img",
        "li",
        "ol",
        "p",
        "pre",
        "s",
        "span",
        "strong",
        "ul",
        "u",
      ],
      ALLOWED_ATTR: ["class", "href", "target", "rel", "src", "alt"],
    });
  }, [text, lookup]);

  if (!safeHtml) return null;

  return (
    <div
      className={className ?? "discord-md-root"}
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}
