import { useMemo } from "react";
import type { EmbedTimestampMode, ComponentRowTemplate, MessageComponentTemplate } from "../../types/embedTemplate.js";
import type { TemplateDraft } from "./embedDraft.js";
import { DiscordRenderedText, type MentionLookup } from "./DiscordRenderedText.js";
import "./discordEmbedMd.css";

function safeExternalHref(url: string): string {
  try {
    const u = new URL(url);
    if (u.protocol === "http:" || u.protocol === "https:") return url;
  } catch {
    /* ignore */
  }
  return "#";
}

function hexToRgb(hex: string): string {
  const n = parseInt(hex.replace(/^#/, ""), 16);
  if (Number.isNaN(n)) return "rgb(30, 31, 34)";
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgb(${r}, ${g}, ${b})`;
}

function formatPreviewTime(mode: EmbedTimestampMode, fixedLocal: string): string {
  if (mode === "NONE") return "";
  if (mode === "NOW") {
    return new Date().toLocaleString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  if (!fixedLocal) return "";
  return new Date(fixedLocal).toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const emptyLookup: MentionLookup = { channelNames: {}, roleNames: {} };

function buttonStyleBg(style: "primary" | "secondary" | "success" | "danger"): string {
  switch (style) {
    case "primary":
      return "#5865F2";
    case "secondary":
      return "#4E5058";
    case "success":
      return "#248046";
    case "danger":
      return "#DA373C";
  }
}

function ExternalLinkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5 shrink-0 fill-current opacity-90">
      <path d="M14 3a1 1 0 1 0 0 2h3.586l-7.293 7.293a1 1 0 1 0 1.414 1.414L19 6.414V10a1 1 0 1 0 2 0V4a1 1 0 0 0-1-1h-6z" />
      <path d="M5 5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5a1 1 0 1 0-2 0v5H5V7h5a1 1 0 1 0 0-2H5z" />
    </svg>
  );
}

function InteractiveButtonPreview({ c }: { c: MessageComponentTemplate }) {
  if (c.type === "link_button") {
    const href = safeExternalHref(c.url);
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex max-h-10 min-h-[32px] max-w-full min-w-[60px] cursor-pointer items-center justify-center gap-1.5 rounded-[3px] px-3 py-1.5 text-sm font-medium text-white no-underline transition hover:brightness-110 active:translate-y-px"
        style={{ backgroundColor: "#4E5058" }}
        title={c.url}
        onClick={(e) => {
          if (href === "#") e.preventDefault();
        }}
      >
        {c.label || "Lien"}
        <ExternalLinkIcon />
      </a>
    );
  }
  return (
    <button
      type="button"
      disabled={c.disabled}
      className="inline-flex max-h-10 min-h-[32px] max-w-full min-w-[60px] cursor-pointer items-center justify-center rounded-[3px] px-3 py-1.5 text-sm font-medium text-white transition hover:brightness-110 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
      style={{ backgroundColor: buttonStyleBg(c.style) }}
    >
      {c.label || "Bouton"}
    </button>
  );
}

function ComponentRowPreview({ row }: { row: ComponentRowTemplate }) {
  if (row.components.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {row.components.map((c, i) => (
        <InteractiveButtonPreview key={i} c={c} />
      ))}
    </div>
  );
}

export type MessageAuthorPreview = {
  displayName: string;
  avatarUrl: string | null;
};

type Props = {
  draft: TemplateDraft;
  mentionLookup?: MentionLookup;
  messageAuthor?: MessageAuthorPreview | null;
};

function formatMessageHeaderTime(): string {
  return new Date().toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SingleEmbedCard({
  block,
  mentionLookup,
}: {
  block: TemplateDraft["messages"][number]["embeds"][number];
  mentionLookup: MentionLookup;
}) {
  const borderColor = useMemo(() => hexToRgb(block.colorHex), [block.colorHex]);
  const ts = useMemo(
    () => formatPreviewTime(block.timestampMode, block.fixedAtLocal),
    [block.timestampMode, block.fixedAtLocal],
  );

  const title = block.title.trim();
  const desc = block.description;
  const foot = block.footerText.trim();
  const embedAuthor = block.authorName.trim();
  const url = block.url.trim();
  const embedAuthorUrl = block.authorUrl.trim();

  return (
    <div
      className="mt-2 max-w-[432px] overflow-hidden rounded-[4px] first:mt-0"
      style={{
        backgroundColor: "#2b2d31",
        borderLeftWidth: 4,
        borderLeftStyle: "solid",
        borderLeftColor: borderColor,
        textAlign: "left",
      }}
    >
      <div className="px-3 pb-3 pt-2">
        <div className="flex gap-3">
          <div className="min-w-0 flex-1">
            {embedAuthor || block.authorIconUrl.trim() ? (
              <div className="mb-2 flex items-center gap-2">
                {block.authorIconUrl.trim() ? (
                  <img
                    src={block.authorIconUrl.trim()}
                    alt=""
                    className="h-5 w-5 shrink-0 rounded-full object-cover"
                  />
                ) : null}
                {embedAuthor ? (
                  embedAuthorUrl ? (
                    <a
                      href={embedAuthorUrl}
                      className="truncate text-xs font-medium hover:underline"
                      style={{ color: "#f2f3f5", fontWeight: 500 }}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {embedAuthor}
                    </a>
                  ) : (
                    <span className="text-xs" style={{ color: "#f2f3f5", fontWeight: 500 }}>
                      {embedAuthor}
                    </span>
                  )
                ) : null}
              </div>
            ) : null}

            {title ? (
              <div className="mb-1.5">
                {url ? (
                  <a
                    href={url}
                    className="text-base font-semibold hover:underline"
                    style={{ color: "#00a8fc", fontWeight: 600 }}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {title}
                  </a>
                ) : (
                  <p className="text-base font-semibold" style={{ color: "#f2f3f5", fontWeight: 600 }}>
                    {title}
                  </p>
                )}
              </div>
            ) : null}

            {desc.trim() ? <DiscordRenderedText text={desc} lookup={mentionLookup} /> : null}

            {block.fields.length > 0 ? (
              <div className="mt-3 grid gap-x-3 gap-y-2 sm:grid-cols-2">
                {block.fields.map((f, i) => {
                  if (!f.name.trim() && !f.value.trim()) return null;
                  return (
                    <div
                      key={i}
                      className={`min-w-0 ${f.inline ? "" : "sm:col-span-2"}`}
                    >
                      <p className="text-[12px] font-semibold leading-tight" style={{ color: "#f2f3f5", fontWeight: 600 }}>
                        {f.name || "\u00a0"}
                      </p>
                      <div className="mt-0.5 text-[13px] leading-[1.25]">
                        <DiscordRenderedText text={f.value} lookup={mentionLookup} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>

          {block.thumbnailUrl.trim() ? (
            <img
              src={block.thumbnailUrl.trim()}
              alt=""
              className="h-20 w-20 shrink-0 rounded object-cover"
            />
          ) : null}
        </div>

        {block.imageUrl.trim() ? (
          <img
            src={block.imageUrl.trim()}
            alt=""
            className="mt-3 max-h-48 w-full rounded object-cover"
          />
        ) : null}

        {foot || block.footerIconUrl.trim() || ts ? (
          <div className="mt-2.5 flex items-center gap-2">
            {block.footerIconUrl.trim() ? (
              <img src={block.footerIconUrl.trim()} alt="" className="h-5 w-5 rounded-full object-cover" />
            ) : null}
            <div className="min-w-0 text-xs" style={{ color: "#dbdee1" }}>
              {foot ? <span>{foot}</span> : null}
              {foot && ts ? <span style={{ color: "#949ba4" }}> • </span> : null}
              {ts ? <span style={{ color: "#949ba4" }}>{ts}</span> : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function flattenComponentRowsForPreview(m: TemplateDraft["messages"][number]): ComponentRowTemplate[] {
  return m.componentBlocks.flatMap((b) => b.rows);
}

/** Aperçu : un ou plusieurs messages Discord (texte + embeds + composants). */
export function DiscordEmbedPreview({ draft, mentionLookup = emptyLookup, messageAuthor }: Props) {
  const baseAuthor = messageAuthor ?? {
    displayName: "Vex",
    avatarUrl: null,
  };
  const headerTime = useMemo(() => formatMessageHeaderTime(), []);

  return (
    <div
      className="rounded-xl border border-vex-border p-4 shadow-inner"
      style={{ backgroundColor: "#313338", fontFamily: "var(--font-discord-body)" }}
    >
      <p
        className="mb-3 text-center text-[11px] font-semibold uppercase tracking-wide"
        style={{ color: "#949ba4" }}
      >
        Aperçu Discord
      </p>

      <div className="mx-auto max-w-[480px]">
        {draft.messages.map((singleMsg, mi) => {
          const nameOverride = singleMsg.profileDisplayName.trim();
          const avatarOverride = singleMsg.profileAvatarUrl.trim();
          const lineAuthor: MessageAuthorPreview = {
            displayName: nameOverride || baseAuthor.displayName,
            avatarUrl: avatarOverride ? avatarOverride : baseAuthor.avatarUrl,
          };
          const rowsFlat = flattenComponentRowsForPreview(singleMsg);
          const msgText = singleMsg.messageContent.trim();
          return (
            <div
              key={mi}
              className={mi > 0 ? "mt-6 border-t border-zinc-600/40 pt-6" : ""}
            >
              {draft.messages.length > 1 ? (
                <p
                  className="mb-3 text-center text-[10px] font-semibold uppercase tracking-wide"
                  style={{ color: "#949ba4" }}
                >
                  Message {mi + 1}
                </p>
              ) : null}
              <div className="flex gap-4">
                <div className="w-10 shrink-0 pt-0.5">
                  {lineAuthor.avatarUrl ? (
                    <img
                      src={lineAuthor.avatarUrl}
                      alt=""
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white"
                      style={{ backgroundColor: "#5865f2" }}
                    >
                      {lineAuthor.displayName.slice(0, 1).toUpperCase() || "?"}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 leading-snug">
                    <span className="text-base font-medium" style={{ color: "#f2f3f5" }}>
                      {lineAuthor.displayName}
                    </span>
                    <span
                      className="rounded px-1 py-px text-[10px] font-semibold uppercase leading-none text-white"
                      style={{ backgroundColor: "#5865f2" }}
                    >
                      Bot
                    </span>
                    <time className="text-xs font-medium" style={{ color: "#949ba4" }}>
                      {headerTime}
                    </time>
                  </div>

                  {msgText ? (
                    <div className="mt-1.5 text-[15px] leading-snug">
                      <DiscordRenderedText text={singleMsg.messageContent} lookup={mentionLookup} />
                    </div>
                  ) : null}

                  {singleMsg.embeds.map((block, i) => (
                    <SingleEmbedCard key={i} block={block} mentionLookup={mentionLookup} />
                  ))}

                  {rowsFlat.length > 0 ? (
                    <div className="relative z-[1] mt-2 flex flex-col gap-2 overflow-visible">
                      {rowsFlat.map((row, i) => (
                        <ComponentRowPreview key={i} row={row} />
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
