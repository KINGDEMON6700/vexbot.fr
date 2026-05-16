import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import type { EmbedTemplate } from "../../types/embedTemplate.js";
import type { GuildTextChannelOption } from "../../lib/embedsApi.js";
import type {
  DiscordTicketPanelButtonStyle,
  TicketDetailResponse,
  TicketListItem,
  TicketPanelOpenConfig,
  TicketSettings,
} from "../../types/ticket.js";
import { DISCORD_TICKET_PANEL_BUTTON_SWATCHES } from "../../lib/discordTicketPanelButtonSwatches.js";
import {
  DEFAULT_TICKET_WELCOME_ADD_EMOJI,
  DEFAULT_TICKET_WELCOME_CLOSE_EMOJI,
} from "../../lib/ticketWelcomeButtonEmoji.js";
import {
  fetchGuildCategories,
  fetchGuildTextChannels,
  fetchEmbedTemplates,
  fetchTicketDetail,
  fetchTicketLiveMessages,
  fetchTicketSettings,
  fetchTicketsList,
  patchTicketSettings,
  type LiveChannelMessage,
} from "../../lib/ticketsApi.js";
import { TicketsPageSkeleton, TicketListRowsSkeleton } from "../ui/PageSkeleton.js";
import { createPageCache } from "../../lib/pageDataCache.js";
import { SaveChangesBar, SAVE_BAR_PAGE_PADDING } from "../ui/SaveChangesBar.js";
import { UiToggle } from "../ui/UiToggle.js";
import { discordUserAvatarUrl } from "../../lib/discordCdn.js";
import { DiscordRenderedText, type MentionLookup } from "../embeds/DiscordRenderedText.js";
import "../embeds/discordEmbedMd.css";
import { TicketEmbedPreviewModal } from "./TicketEmbedPreviewModal.js";
import {
  defaultTicketPanelOpen,
  normalizePanelOpenConfig,
  TicketPanelOpenSection,
} from "./TicketPanelOpenSection.js";

const emptyMentionLookup: MentionLookup = { channelNames: {}, roleNames: {} };
const TICKET_EMOJI_PICKER_STORAGE_KEY = "vex-ticket-emoji-picker-custom";
const DEFAULT_TICKET_EMOJI_CHOICES = ["🔒", "✅", "❌", "➕", "👤", "🎫"];

function readStoredTicketEmojis(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(TICKET_EMOJI_PICKER_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  } catch {
    return [];
  }
}

function saveStoredTicketEmojis(emojis: string[]) {
  try {
    window.localStorage.setItem(TICKET_EMOJI_PICKER_STORAGE_KEY, JSON.stringify(emojis));
  } catch {
    // Si le navigateur bloque le stockage, le choix reste disponible pendant la session.
  }
}

function uniqueTicketEmojis(emojis: string[]): string[] {
  return Array.from(new Set(emojis.map((emoji) => emoji.trim()).filter(Boolean)));
}

function discordAvatarHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) {
    h = name.charCodeAt(i) + ((h << 5) - h);
  }
  return Math.abs(h) % 360;
}

function discordAvatarInitial(name: string): string {
  const t = name.trim();
  if (!t) return "?";
  const c = t[0];
  if (/[\p{L}\p{N}]/u.test(c)) return c.toUpperCase();
  return "?";
}

function ticketListRowTitle(t: TicketListItem): string {
  const salonName = t.channelDiscordName?.trim();
  const salon = salonName ? `#${salonName}` : `<#${t.channelId}>`;
  const openerName = t.openerDisplayName?.trim();
  const opener = openerName || "(non disponible)";
  return `ID: #${t.ticketNumber} — Salon: ${salon} — Ouvert par: ${opener}`;
}

function discordChannelUrl(guildDiscordId: string, channelId: string): string {
  return `https://discord.com/channels/${guildDiscordId}/${channelId}`;
}

function copyTextLegacyExecCommand(text: string): boolean {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "0";
    ta.style.top = "0";
    ta.style.width = "1px";
    ta.style.height = "1px";
    ta.style.padding = "0";
    ta.style.border = "none";
    ta.style.opacity = "0";
    ta.style.pointerEvents = "none";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

async function copyTextToClipboardRobust(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && typeof navigator.clipboard?.writeText === "function") {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* API refusée ou contexte non sécurisé */
    }
  }
  return copyTextLegacyExecCommand(text);
}

function ChevronTicketRow({ expanded }: { expanded: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 text-zinc-500 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
      aria-hidden
    >
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
        <path
          fillRule="evenodd"
          d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
          clipRule="evenodd"
        />
      </svg>
    </span>
  );
}

type TicketListRowBarProps = {
  t: TicketListItem;
  discordGuildId: string;
  expanded: boolean;
  onToggleExpand: () => void;
  onCopyFeedback: (message: string) => void;
};

function TicketListRowBar({ t, discordGuildId, expanded, onToggleExpand, onCopyFeedback }: TicketListRowBarProps) {
  const salonName = t.channelDiscordName?.trim();
  const salonLabel = salonName ? `#${salonName}` : `<#${t.channelId}>`;
  const openerName = t.openerDisplayName?.trim();
  const openerLabel = openerName || "(non disponible)";

  const copySalonLink = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    void (async () => {
      const ok = await copyTextToClipboardRobust(discordChannelUrl(discordGuildId, t.channelId));
      onCopyFeedback(ok ? "Lien du salon copié." : "Copie impossible (navigateur).");
    })();
  };

  const copyOpenerId = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    void (async () => {
      const ok = await copyTextToClipboardRobust(t.openerId);
      onCopyFeedback(ok ? "Identifiant du membre copié." : "Copie impossible (navigateur).");
    })();
  };

  const onRowKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onToggleExpand();
    }
  };

  return (
    <div
      tabIndex={0}
      aria-expanded={expanded}
      aria-label={`${ticketListRowTitle(t)}. Appuyez sur Entrée ou Espace pour ${expanded ? "replier" : "développer"}.`}
      className={`flex w-full cursor-pointer flex-nowrap items-center gap-2 px-4 py-3 text-left text-sm transition hover:bg-vex-bg/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-vex-accent/50 ${
        expanded ? "bg-vex-accent/10 ring-inset ring-1 ring-vex-accent/25" : ""
      }`}
      onClick={onToggleExpand}
      onKeyDown={onRowKeyDown}
    >
      <ChevronTicketRow expanded={expanded} />
      <div className="min-w-0 flex-1 truncate">
        <span className="text-zinc-400">ID: </span>
        <span className="text-zinc-200">#{t.ticketNumber}</span>
        <span className="text-zinc-600"> — </span>
        <span className="text-zinc-400">Salon: </span>
        <button
          type="button"
          title="Copier le lien du salon Discord"
          className="font-medium text-vex-accent underline decoration-dotted underline-offset-2 hover:text-vex-accent/90"
          onClick={copySalonLink}
        >
          {salonLabel}
        </button>
        <span className="text-zinc-600"> — </span>
        <span className="text-zinc-400">Ouvert par: </span>
        <button
          type="button"
          title="Copier l’identifiant Discord du membre"
          className="font-medium text-vex-accent underline decoration-dotted underline-offset-2 hover:text-vex-accent/90"
          onClick={copyOpenerId}
        >
          {openerLabel}
        </button>
      </div>
      <span className="shrink-0 whitespace-nowrap text-xs text-zinc-500">
        {new Date(t.createdAt).toLocaleString("fr-FR")}
      </span>
    </div>
  );
}

type ConversationLine = {
  id: string;
  authorName: string;
  content: string;
  createdAtLabel: string;
  authorDiscordId: string | null;
  authorAvatarHash: string | null;
};

function discordAuthorKey(name: string): string {
  const t = name.trim().toLowerCase();
  const hash = t.lastIndexOf("#");
  if (hash >= 0) return t.slice(0, hash);
  return t;
}

/** Libellé auteur dans un vieux transcript (ex. « Nom APP » côté Discord). */
function discordAuthorKeyForBotMatch(name: string): string {
  return discordAuthorKey(name.replace(/\s*APP\s*$/i, "").trim());
}

/** Hash d’avatar Discord (hex, optionnel préfixe a_ pour GIF). */
function parseDiscordAvatarHash(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  return /^(a_)?[0-9a-fA-F]+$/i.test(s) ? s : null;
}

/**
 * Complète les lignes sans data-author-id (vieux transcripts) : ouvreur du ticket, puis messages du bot Vex.
 */
function enrichArchivedConversationLines(
  lines: ConversationLine[],
  ctx: {
    openerId: string;
    openerDisplayName: string | null;
    openerDiscordUsername: string | null;
    openerAvatarHash: string | null;
    bot: {
      id: string;
      username: string;
      globalName: string | null;
      avatarHash: string | null;
    } | null;
  },
): ConversationLine[] {
  const openerOk = /^\d{5,25}$/.test(ctx.openerId);
  const displayKey =
    openerOk && ctx.openerDisplayName ? discordAuthorKey(ctx.openerDisplayName) : "";
  const userKey =
    openerOk && ctx.openerDiscordUsername ? discordAuthorKey(ctx.openerDiscordUsername) : "";

  const botKeys = new Set<string>();
  if (ctx.bot && /^\d{5,25}$/.test(ctx.bot.id)) {
    botKeys.add(discordAuthorKey(ctx.bot.username));
    if (ctx.bot.globalName) {
      botKeys.add(discordAuthorKey(ctx.bot.globalName));
    }
  }

  return lines.map((line) => {
    if (line.authorDiscordId) {
      return line;
    }
    const lineKey = discordAuthorKey(line.authorName);
    const lineKeyForBot = discordAuthorKeyForBotMatch(line.authorName);

    if (openerOk) {
      const matchUser = userKey.length > 0 && lineKey === userKey;
      const matchDisplay = displayKey.length > 0 && lineKey === displayKey;
      const matchExactDisplay =
        !!ctx.openerDisplayName && line.authorName.trim() === ctx.openerDisplayName.trim();
      if (matchUser || matchDisplay || matchExactDisplay) {
        return {
          ...line,
          authorDiscordId: ctx.openerId,
          authorAvatarHash: line.authorAvatarHash ?? ctx.openerAvatarHash,
        };
      }
    }

    if (ctx.bot && /^\d{5,25}$/.test(ctx.bot.id)) {
      if (botKeys.has(lineKeyForBot)) {
        return {
          ...line,
          authorDiscordId: ctx.bot.id,
          authorAvatarHash: line.authorAvatarHash ?? ctx.bot.avatarHash,
        };
      }
      const low = line.authorName.trim().toLowerCase();
      const bu = ctx.bot.username.toLowerCase();
      const bg = ctx.bot.globalName?.trim().toLowerCase() ?? "";
      if (low === bu || (bg && low === bg) || low.startsWith(`${bu}#`) || (bg && low.startsWith(`${bg}#`))) {
        return {
          ...line,
          authorDiscordId: ctx.bot.id,
          authorAvatarHash: line.authorAvatarHash ?? ctx.bot.avatarHash,
        };
      }
    }

    return line;
  });
}

/** Transcript HTML produit par le bot à la fermeture (`ticket.ts` → `buildHtmlTranscript`). */
function parseTranscriptToConversationLines(
  transcript: NonNullable<TicketDetailResponse["transcript"]>,
): ConversationLine[] {
  const fmt = String(transcript.format ?? "").toUpperCase();
  if (fmt === "HTML") {
    try {
      const doc = new DOMParser().parseFromString(transcript.content, "text/html");
      let blocks = doc.querySelectorAll("[data-author-id]");
      if (blocks.length === 0) {
        blocks = doc.querySelectorAll("div.m");
      }
      const out: ConversationLine[] = [];
      blocks.forEach((el, i) => {
        const row = el as HTMLElement;
        const timeRaw = row.querySelector("span.t")?.textContent?.trim() ?? "";
        const author = row.querySelector("b")?.textContent?.trim() ?? "?";
        const content = row.querySelector("span.c")?.textContent ?? "";
        let createdAtLabel = timeRaw;
        const d = new Date(timeRaw);
        if (!Number.isNaN(d.getTime())) {
          createdAtLabel = d.toLocaleString("fr-FR");
        }
        const rawId = (row.dataset.authorId ?? row.getAttribute("data-author-id") ?? "").trim();
        const rawAv = (row.dataset.authorAvatar ?? row.getAttribute("data-author-avatar") ?? "").trim();
        const authorDiscordId = /^\d{5,25}$/.test(rawId) ? rawId : null;
        const authorAvatarHash = parseDiscordAvatarHash(rawAv);
        out.push({
          id: `arch-${i}`,
          authorName: author,
          content,
          createdAtLabel,
          authorDiscordId,
          authorAvatarHash,
        });
      });
      if (out.length > 0) {
        return out;
      }
    } catch {
      /* fallback plain */
    }
  }
  const plain = transcript.content.trim();
  if (!plain) {
    return [];
  }
  return [
    {
      id: "arch-0",
      authorName: "Historique",
      content: plain,
      createdAtLabel: "",
      authorDiscordId: null,
      authorAvatarHash: null,
    },
  ];
}

/**
 * Même enveloppe visuelle que `DiscordEmbedPreview` (page Embeds) : fond #313338, ombre intérieure, typo Discord.
 */
function ConversationLinesList({ lines }: { lines: ConversationLine[] }) {
  return (
    <div
      className="max-h-72 overflow-y-auto overflow-x-hidden rounded-xl border border-vex-border p-2.5 shadow-inner sm:max-h-80"
      style={{ backgroundColor: "#313338", fontFamily: "var(--font-discord-body)" }}
    >
      <p
        className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wide"
        style={{ color: "#949ba4" }}
      >
        Aperçu Discord
      </p>
      <div className="mx-auto max-w-[min(100%,420px)]">
        {lines.map((m, mi) => {
          const avatarUrl = discordUserAvatarUrl(m.authorDiscordId, m.authorAvatarHash, 64);
          const hue = discordAvatarHue(m.authorName);
          return (
            <div key={m.id} className={mi > 0 ? "mt-3 border-t border-zinc-600/30 pt-3" : ""}>
              <div className="flex gap-2.5">
                <div className="w-8 shrink-0 self-start pt-px">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" loading="lazy" />
                  ) : (
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
                      style={{ backgroundColor: `hsl(${hue} 42% 48%)` }}
                    >
                      {discordAvatarInitial(m.authorName)}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 leading-tight">
                    <span className="text-sm font-medium" style={{ color: "#f2f3f5" }}>
                      {m.authorName}
                    </span>
                    {m.createdAtLabel ? (
                      <time className="text-[10px] font-medium" style={{ color: "#949ba4" }}>
                        {m.createdAtLabel}
                      </time>
                    ) : null}
                  </div>
                  {m.content.trim() ? (
                    <div className="mt-0.5 text-[13px] leading-snug [&_.discord-md-root]:text-[13px] [&_.discord-md-root]:leading-snug">
                      <DiscordRenderedText text={m.content} lookup={emptyMentionLookup} />
                    </div>
                  ) : (
                    <p className="mt-0.5 text-[13px] italic" style={{ color: "#949ba4" }}>
                      —
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type TicketDetailContentProps = {
  forTicketId: string;
  detail: TicketDetailResponse | null;
  detailLoading: boolean;
  liveMessages: LiveChannelMessage[] | null;
  liveLoading: boolean;
  liveError: boolean;
};

function TicketDetailContent({
  forTicketId,
  detail,
  detailLoading,
  liveMessages,
  liveLoading,
  liveError,
}: TicketDetailContentProps) {
  if (detailLoading) {
    return <p className="text-sm text-zinc-500">Chargement…</p>;
  }
  if (!detail || detail.ticket.id !== forTicketId) {
    return <p className="text-sm text-amber-200/90">Impossible d’afficher ce ticket.</p>;
  }

  const archivedLinesRaw =
    detail.ticket.status !== "OPEN" && detail.transcript
      ? parseTranscriptToConversationLines(detail.transcript)
      : [];
  const archivedLines = enrichArchivedConversationLines(archivedLinesRaw, {
    openerId: detail.ticket.openerId,
    openerDisplayName: detail.ticket.openerDisplayName ?? null,
    openerDiscordUsername: detail.ticket.openerDiscordUsername ?? null,
    openerAvatarHash: detail.ticket.openerAvatarHash ?? null,
    bot: detail.discordBotProfile
      ? {
          id: detail.discordBotProfile.id,
          username: detail.discordBotProfile.username,
          globalName: detail.discordBotProfile.globalName,
          avatarHash: detail.discordBotProfile.avatarHash,
        }
      : null,
  });

  const liveLines: ConversationLine[] =
    liveMessages?.map((m) => ({
      id: m.id,
      authorName: m.authorName,
      content: m.content,
      createdAtLabel: new Date(m.createdAt).toLocaleString("fr-FR"),
      authorDiscordId: /^\d{5,25}$/.test(m.authorId) ? m.authorId : null,
      authorAvatarHash: m.authorAvatarHash ?? null,
    })) ?? [];

  return (
    <div className="flex flex-col gap-3 text-sm text-zinc-400">
      {detail.ticket.closedAt ? (
        <p>Fermé le : {new Date(detail.ticket.closedAt).toLocaleString("fr-FR")}</p>
      ) : null}
      <div className="mt-2">
        <p className="mb-2 font-medium text-zinc-200">Conversations</p>
        {detail.ticket.status === "OPEN" && liveLoading ? (
          <p className="text-sm text-zinc-500">Chargement des messages…</p>
        ) : liveLines.length > 0 ? (
          <ConversationLinesList lines={liveLines} />
        ) : archivedLines.length > 0 ? (
          <ConversationLinesList lines={archivedLines} />
        ) : detail.ticket.status !== "OPEN" ? (
          <p className="text-sm text-zinc-500">
            Aucun enregistrement de conversation pour ce ticket fermé (pas de transcript à l’époque de la fermeture).
          </p>
        ) : liveError ? (
          <p className="text-sm text-amber-200/90">
            Impossible de charger les messages. Réessayez dans un instant.
          </p>
        ) : (
          <p className="text-sm text-zinc-500">Aucun message pour l’instant.</p>
        )}
      </div>
    </div>
  );
}

type TicketConfigSnapshot = {
  panelChannelId: string;
  ticketCategoryId: string;
  welcomeEmbedId: string;
  panelEmbedId: string;
  panelOpenConfig: TicketPanelOpenConfig;
  welcomeMemberCloseButton: boolean;
  welcomeMemberCloseButtonStyle: DiscordTicketPanelButtonStyle;
  welcomeMemberAddButton: boolean;
  welcomeMemberAddButtonStyle: DiscordTicketPanelButtonStyle;
  welcomeMemberCloseButtonEmoji: string;
  welcomeMemberAddButtonEmoji: string;
  maxOpenTicketsPerOpener: number;
};

function snapshotFromSettings(s: TicketSettings): string {
  return JSON.stringify({
    panelChannelId: s.panelChannelId ?? "",
    ticketCategoryId: s.ticketCategoryId ?? "",
    welcomeEmbedId: s.welcomeEmbedId ?? "",
    panelEmbedId: s.panelEmbedId ?? "",
    panelOpenConfig: normalizePanelOpenConfig(s.panelOpenConfig ?? defaultTicketPanelOpen()),
    welcomeMemberCloseButton: s.welcomeMemberCloseButton ?? false,
    welcomeMemberCloseButtonStyle: s.welcomeMemberCloseButtonStyle ?? "danger",
    welcomeMemberAddButton: s.welcomeMemberAddButton ?? false,
    welcomeMemberAddButtonStyle: s.welcomeMemberAddButtonStyle ?? "primary",
    welcomeMemberCloseButtonEmoji: s.welcomeMemberCloseButtonEmoji ?? "",
    welcomeMemberAddButtonEmoji: s.welcomeMemberAddButtonEmoji ?? "",
    maxOpenTicketsPerOpener: Math.min(25, Math.max(1, Math.trunc(s.maxOpenTicketsPerOpener ?? 1))),
  });
}

function buildSnapshot(args: TicketConfigSnapshot): string {
  return JSON.stringify(args);
}

type Tab = "OPEN" | "CLOSED";

type Props = {
  discordGuildId: string;
};

type TicketMetaBundle = {
  settings: TicketSettings;
  textChannels: GuildTextChannelOption[];
  categories: GuildTextChannelOption[];
  embeds: EmbedTemplate[];
};

const ticketMetaCache = createPageCache<TicketMetaBundle>();

export function TicketsPageContent({ discordGuildId }: Props) {
  const [settings, setSettings] = useState<TicketSettings | null>(() => ticketMetaCache.get(discordGuildId)?.settings ?? null);
  const [textChannels, setTextChannels] = useState<GuildTextChannelOption[]>(() => ticketMetaCache.get(discordGuildId)?.textChannels ?? []);
  const [categories, setCategories] = useState<GuildTextChannelOption[]>(() => ticketMetaCache.get(discordGuildId)?.categories ?? []);
  const [embeds, setEmbeds] = useState<EmbedTemplate[]>(() => ticketMetaCache.get(discordGuildId)?.embeds ?? []);
  const [metaError, setMetaError] = useState(false);

  const [draftPanel, setDraftPanel] = useState("");
  const [draftCategory, setDraftCategory] = useState("");
  const [draftWelcome, setDraftWelcome] = useState("");
  const [draftPanelEmbed, setDraftPanelEmbed] = useState("");
  const [draftWelcomeMemberClose, setDraftWelcomeMemberClose] = useState(false);
  const [draftWelcomeMemberCloseStyle, setDraftWelcomeMemberCloseStyle] =
    useState<DiscordTicketPanelButtonStyle>("danger");
  const [draftWelcomeMemberAdd, setDraftWelcomeMemberAdd] = useState(false);
  const [draftWelcomeMemberAddStyle, setDraftWelcomeMemberAddStyle] =
    useState<DiscordTicketPanelButtonStyle>("primary");
  const [draftWelcomeMemberCloseEmoji, setDraftWelcomeMemberCloseEmoji] = useState("");
  const [draftWelcomeMemberAddEmoji, setDraftWelcomeMemberAddEmoji] = useState("");
  const [customTicketEmojis, setCustomTicketEmojis] = useState<string[]>(() => readStoredTicketEmojis());
  const [openEmojiPicker, setOpenEmojiPicker] = useState<"close" | "add" | null>(null);
  const [welcomeCloseDetailsOpen, setWelcomeCloseDetailsOpen] = useState(true);
  const [welcomeAddDetailsOpen, setWelcomeAddDetailsOpen] = useState(true);
  const [draftMaxOpenTicketsPerOpener, setDraftMaxOpenTicketsPerOpener] = useState(1);
  const [draftPanelOpen, setDraftPanelOpen] = useState<TicketPanelOpenConfig>(() => defaultTicketPanelOpen());
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "ok" | "err">("idle");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  /** Incrémenté à chaque échec d’enregistrement pour rejouer l’animation sur la barre du bas. */
  const [saveBarShakeTick, setSaveBarShakeTick] = useState(0);
  const saveFeedbackRef = useRef<HTMLDivElement | null>(null);

  const [tab, setTab] = useState<Tab>("OPEN");
  const [tickets, setTickets] = useState<TicketListItem[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TicketDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [liveMessages, setLiveMessages] = useState<LiveChannelMessage[] | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState(false);
  const [embedPreview, setEmbedPreview] = useState<null | "welcome" | "panel">(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const copyFeedbackTimerRef = useRef<number | null>(null);

  const reportCopyFeedback = useCallback((message: string) => {
    setCopyFeedback(message);
    if (copyFeedbackTimerRef.current != null) {
      window.clearTimeout(copyFeedbackTimerRef.current);
    }
    copyFeedbackTimerRef.current = window.setTimeout(() => {
      setCopyFeedback(null);
      copyFeedbackTimerRef.current = null;
    }, 2500);
  }, []);

  const ticketEmojiChoices = useMemo(
    () =>
      uniqueTicketEmojis([
        ...DEFAULT_TICKET_EMOJI_CHOICES,
        draftWelcomeMemberCloseEmoji,
        draftWelcomeMemberAddEmoji,
        ...customTicketEmojis,
      ]),
    [customTicketEmojis, draftWelcomeMemberAddEmoji, draftWelcomeMemberCloseEmoji],
  );

  const addCustomTicketEmoji = useCallback(() => {
    const value = window.prompt("Emoji à ajouter");
    const emoji = value?.trim();
    if (!emoji) return;

    setCustomTicketEmojis((prev) => {
      const next = uniqueTicketEmojis([...prev, emoji]);
      saveStoredTicketEmojis(next);
      return next;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (copyFeedbackTimerRef.current != null) {
        window.clearTimeout(copyFeedbackTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!openEmojiPicker) return;

    const closePicker = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-ticket-emoji-picker]")) return;
      setOpenEmojiPicker(null);
    };

    window.addEventListener("pointerdown", closePicker);
    return () => window.removeEventListener("pointerdown", closePicker);
  }, [openEmojiPicker]);

  const loadMeta = useCallback(async () => {
    setMetaError(false);
    try {
      const [s, ch, cat, emb] = await Promise.all([
        fetchTicketSettings(discordGuildId),
        fetchGuildTextChannels(discordGuildId),
        fetchGuildCategories(discordGuildId),
        fetchEmbedTemplates(discordGuildId),
      ]);
      setSettings(s);
      setDraftPanel(s.panelChannelId ?? "");
      setDraftCategory(s.ticketCategoryId ?? "");
      setDraftWelcome(s.welcomeEmbedId ?? "");
      setDraftPanelEmbed(s.panelEmbedId ?? "");
      setDraftWelcomeMemberClose(s.welcomeMemberCloseButton ?? false);
      setDraftWelcomeMemberCloseStyle(s.welcomeMemberCloseButtonStyle ?? "danger");
      setDraftWelcomeMemberAdd(s.welcomeMemberAddButton ?? false);
      setDraftWelcomeMemberAddStyle(s.welcomeMemberAddButtonStyle ?? "primary");
      setDraftWelcomeMemberCloseEmoji(s.welcomeMemberCloseButtonEmoji ?? "");
      setDraftWelcomeMemberAddEmoji(s.welcomeMemberAddButtonEmoji ?? "");
      setDraftMaxOpenTicketsPerOpener(Math.min(25, Math.max(1, Math.trunc(s.maxOpenTicketsPerOpener ?? 1))));
      setDraftPanelOpen(normalizePanelOpenConfig(s.panelOpenConfig ?? defaultTicketPanelOpen()));
      setSavedSnapshot(snapshotFromSettings(s));
      setTextChannels(ch);
      setCategories(cat);
      setEmbeds(emb);
      ticketMetaCache.set(discordGuildId, { settings: s, textChannels: ch, categories: cat, embeds: emb });
    } catch {
      setMetaError(true);
    }
  }, [discordGuildId]);

  const loadList = useCallback(async () => {
    setListError(false);
    setListLoading(true);
    try {
      const list = await fetchTicketsList(discordGuildId, tab);
      setTickets(list);
    } catch {
      setListError(true);
      setTickets([]);
    } finally {
      setListLoading(false);
    }
  }, [discordGuildId, tab]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setLiveMessages(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    void fetchTicketDetail(discordGuildId, selectedId)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [discordGuildId, selectedId]);

  useEffect(() => {
    if (!selectedId || !detail || detail.ticket.id !== selectedId) {
      setLiveMessages(null);
      setLiveError(false);
      setLiveLoading(false);
      return;
    }
    if (detail.ticket.status !== "OPEN") {
      setLiveMessages(null);
      setLiveError(false);
      setLiveLoading(false);
      return;
    }
    let cancelled = false;
    setLiveLoading(true);
    setLiveError(false);
    void fetchTicketLiveMessages(discordGuildId, selectedId)
      .then((msgs) => {
        if (!cancelled) setLiveMessages(msgs);
      })
      .catch(() => {
        if (!cancelled) {
          setLiveMessages(null);
          setLiveError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLiveLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [discordGuildId, selectedId, detail?.ticket.id, detail?.ticket.status]);

  const currentSnapshot = useMemo(
    () =>
      buildSnapshot({
        panelChannelId: draftPanel,
        ticketCategoryId: draftCategory,
        welcomeEmbedId: draftWelcome,
        panelEmbedId: draftPanelEmbed,
        panelOpenConfig: normalizePanelOpenConfig(draftPanelOpen),
        welcomeMemberCloseButton: draftWelcomeMemberClose,
        welcomeMemberCloseButtonStyle: draftWelcomeMemberCloseStyle,
        welcomeMemberAddButton: draftWelcomeMemberAdd,
        welcomeMemberAddButtonStyle: draftWelcomeMemberAddStyle,
        welcomeMemberCloseButtonEmoji: draftWelcomeMemberCloseEmoji,
        welcomeMemberAddButtonEmoji: draftWelcomeMemberAddEmoji,
        maxOpenTicketsPerOpener: draftMaxOpenTicketsPerOpener,
      }),
    [
      draftCategory,
      draftPanel,
      draftPanelEmbed,
      draftPanelOpen,
      draftWelcome,
      draftWelcomeMemberClose,
      draftWelcomeMemberCloseStyle,
      draftWelcomeMemberCloseEmoji,
      draftWelcomeMemberAdd,
      draftWelcomeMemberAddStyle,
      draftWelcomeMemberAddEmoji,
      draftMaxOpenTicketsPerOpener,
    ],
  );

  const isDirty = Boolean(savedSnapshot) && currentSnapshot !== savedSnapshot;

  useEffect(() => {
    if (!isDirty || saveState !== "ok") return;
    setSaveMessage(null);
    setSaveState("idle");
  }, [isDirty, saveState]);

  /** Remonter le message d’erreur au-dessus de la barre fixe « Enregistrer ». */
  useEffect(() => {
    if (saveState !== "err" || !saveMessage) return;
    const el = saveFeedbackRef.current;
    if (!el) return;
    const id = window.requestAnimationFrame(() => {
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(id);
  }, [saveState, saveMessage]);

  function handleDiscardChanges() {
    try {
      const restored = JSON.parse(savedSnapshot) as TicketConfigSnapshot;
      setDraftPanel(restored.panelChannelId);
      setDraftCategory(restored.ticketCategoryId);
      setDraftWelcome(restored.welcomeEmbedId);
      setDraftPanelEmbed(restored.panelEmbedId);
      setDraftPanelOpen(normalizePanelOpenConfig(restored.panelOpenConfig));
      setDraftWelcomeMemberClose(restored.welcomeMemberCloseButton ?? false);
      setDraftWelcomeMemberCloseStyle(restored.welcomeMemberCloseButtonStyle ?? "danger");
      setDraftWelcomeMemberAdd(restored.welcomeMemberAddButton ?? false);
      setDraftWelcomeMemberAddStyle(restored.welcomeMemberAddButtonStyle ?? "primary");
      setDraftWelcomeMemberCloseEmoji(restored.welcomeMemberCloseButtonEmoji ?? "");
      setDraftWelcomeMemberAddEmoji(restored.welcomeMemberAddButtonEmoji ?? "");
      setDraftMaxOpenTicketsPerOpener(
        Math.min(25, Math.max(1, Math.trunc(restored.maxOpenTicketsPerOpener ?? 1))),
      );
      setSaveState("idle");
      setSaveMessage("Modifications annulées.");
    } catch {
      setSaveState("idle");
      setSaveMessage("Impossible de restaurer les réglages.");
    }
  }

  function validatePanelOpen(c: TicketPanelOpenConfig): string | null {
    const n = normalizePanelOpenConfig(c);
    if (n.style === "button") {
      if (!n.buttonLabel.trim()) {
        return "Bouton : indiquez le libellé du bouton d’ouverture (il ne peut pas être vide).";
      }
      if (n.requireModal) {
        if (!n.modalTitle?.trim() || !n.modalInputLabel?.trim()) {
          return "Saisie activée (bouton) : indiquez le titre de la fenêtre et la question au-dessus du champ.";
        }
      }
      return null;
    }
    if (!n.selectPlaceholder.trim()) {
      return "Liste : indiquez le texte invitant dans la liste (grisé) — il ne peut pas être vide pour l’enregistrement.";
    }
    if (n.options.length < 1) return "Liste : ajoutez au moins une option au menu.";
    for (const o of n.options) {
      if (!o.label.trim()) return "Chaque option du menu doit avoir un nom visible.";
      if (o.requireModal && (!o.modalTitle.trim() || !o.modalInputLabel.trim())) {
        return "Pour une option avec saisie activée, indiquez le titre de la fenêtre et la question au-dessus du champ.";
      }
    }
    return null;
  }

  async function onSaveSettings() {
    setSaveState("saving");
    setSaveMessage(null);
    const openErr = validatePanelOpen(draftPanelOpen);
    if (openErr) {
      setSaveState("err");
      setSaveMessage(openErr);
      setSaveBarShakeTick((n) => n + 1);
      return;
    }
    try {
      const body = {
        panelChannelId: draftPanel || null,
        ticketCategoryId: draftCategory || null,
        welcomeEmbedId: draftWelcome || null,
        panelEmbedId: draftPanelEmbed || null,
        panelOpenConfig: normalizePanelOpenConfig(draftPanelOpen),
        welcomeMemberCloseButton: draftWelcomeMemberClose,
        welcomeMemberCloseButtonStyle: draftWelcomeMemberCloseStyle,
        welcomeMemberAddButton: draftWelcomeMemberAdd,
        welcomeMemberAddButtonStyle: draftWelcomeMemberAddStyle,
        welcomeMemberCloseButtonEmoji: draftWelcomeMemberCloseEmoji.trim() || null,
        welcomeMemberAddButtonEmoji: draftWelcomeMemberAddEmoji.trim() || null,
        maxOpenTicketsPerOpener: Math.min(25, Math.max(1, Math.trunc(draftMaxOpenTicketsPerOpener))),
      };
      const { settings: next, panelSyncWarning } = await patchTicketSettings(discordGuildId, body);
      setSettings(next);
      setDraftPanel(next.panelChannelId ?? "");
      setDraftCategory(next.ticketCategoryId ?? "");
      setDraftWelcome(next.welcomeEmbedId ?? "");
      setDraftPanelEmbed(next.panelEmbedId ?? "");
      setDraftPanelOpen(
        normalizePanelOpenConfig(next.panelOpenConfig ?? defaultTicketPanelOpen()),
      );
      setDraftWelcomeMemberClose(next.welcomeMemberCloseButton ?? false);
      setDraftWelcomeMemberCloseStyle(next.welcomeMemberCloseButtonStyle ?? "danger");
      setDraftWelcomeMemberAdd(next.welcomeMemberAddButton ?? false);
      setDraftWelcomeMemberAddStyle(next.welcomeMemberAddButtonStyle ?? "primary");
      setDraftWelcomeMemberCloseEmoji(next.welcomeMemberCloseButtonEmoji ?? "");
      setDraftWelcomeMemberAddEmoji(next.welcomeMemberAddButtonEmoji ?? "");
      setDraftMaxOpenTicketsPerOpener(Math.min(25, Math.max(1, Math.trunc(next.maxOpenTicketsPerOpener ?? 1))));
      setSavedSnapshot(snapshotFromSettings(next));
      setSaveState("ok");
      setSaveBarShakeTick(0);
      if (panelSyncWarning) {
        setSaveMessage(
          `Le message panneau sur Discord n’a pas pu être mis à jour : ${panelSyncWarning}`,
        );
      } else {
        setSaveMessage(null);
      }
    } catch (e) {
      setSaveState("err");
      setSaveMessage(e instanceof Error ? e.message : "Impossible d’enregistrer.");
      setSaveBarShakeTick((n) => n + 1);
    }
  }

  if (metaError) {
    return (
      <div className="rounded-xl border border-vex-border bg-vex-surface/50 px-6 py-10 text-center text-sm text-zinc-400">
        Impossible de charger vos Tickets. Réessayez dans un instant.
      </div>
    );
  }

  if (!settings) {
    return <TicketsPageSkeleton />;
  }

  return (
    <div
      className={`flex flex-col gap-6 ${isDirty || saveState === "ok" ? SAVE_BAR_PAGE_PADDING : ""}`}
    >
      <section className="overflow-hidden rounded-xl border border-vex-border bg-vex-surface/70">
        <div className="flex flex-col gap-3 border-b border-vex-border/80 bg-vex-bg/25 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">Liste des tickets</h2>
            <p className="mt-1 text-sm text-zinc-500">Cliquez sur une ligne pour afficher le détail.</p>
          </div>
          <div
            className="inline-flex shrink-0 rounded-lg border border-vex-border/80 bg-vex-bg/50 p-1"
            role="tablist"
            aria-label="Filtrer les tickets ouverts ou fermés"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === "OPEN"}
              className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                tab === "OPEN"
                  ? "bg-vex-accent/15 text-zinc-100 ring-1 ring-vex-accent/30"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
              onClick={() => {
                setTab("OPEN");
                setSelectedId(null);
              }}
            >
              Ouvert
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "CLOSED"}
              className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                tab === "CLOSED"
                  ? "bg-vex-accent/15 text-zinc-100 ring-1 ring-vex-accent/30"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
              onClick={() => {
                setTab("CLOSED");
                setSelectedId(null);
              }}
            >
              Fermer
            </button>
          </div>
        </div>

        {listError ? (
          <div className="ui-empty-state mx-5 my-6 sm:mx-6">Impossible de charger la liste.</div>
        ) : listLoading ? (
          <TicketListRowsSkeleton />
        ) : tickets.length === 0 ? (
          <div className="ui-empty-state mx-5 my-6 sm:mx-6">Aucun ticket dans cette catégorie.</div>
        ) : (
          <>
            {copyFeedback ? (
              <div
                className={`border-b border-vex-border/80 bg-vex-bg/30 px-4 py-2 text-center text-xs ${
                  copyFeedback.includes("impossible") ? "text-amber-200/90" : "text-emerald-300/90"
                }`}
                role="status"
                aria-live="polite"
              >
                {copyFeedback}
              </div>
            ) : null}
            <ul className="divide-y divide-vex-border border-t border-vex-border bg-vex-bg/40">
              {tickets.map((t) => (
                <li key={t.id}>
                  <TicketListRowBar
                    t={t}
                    discordGuildId={discordGuildId}
                    expanded={selectedId === t.id}
                    onToggleExpand={() => setSelectedId(selectedId === t.id ? null : t.id)}
                    onCopyFeedback={reportCopyFeedback}
                  />
                  {tab === "OPEN" && selectedId === t.id ? (
                    <div className="border-t border-vex-border bg-vex-bg/50 px-4 py-4">
                      <TicketDetailContent
                        forTicketId={t.id}
                        detail={detail}
                        detailLoading={detailLoading}
                        liveMessages={liveMessages}
                        liveLoading={liveLoading}
                        liveError={liveError}
                      />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        )}

        {tab === "CLOSED" && selectedId ? (
          <div className="rounded-lg border border-vex-border/80 bg-vex-bg/50 p-4 sm:p-5 mx-5 mb-5 sm:mx-6 sm:mb-6">
            <h3 className="text-sm font-semibold text-zinc-300">Détail</h3>
            <div className="mt-3">
              <TicketDetailContent
                forTicketId={selectedId}
                detail={detail}
                detailLoading={detailLoading}
                liveMessages={liveMessages}
                liveLoading={liveLoading}
                liveError={liveError}
              />
            </div>
          </div>
        ) : null}
      </section>

      <div className="flex flex-col gap-6">
        <section className="rounded-xl border border-vex-border bg-vex-surface/70 p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-zinc-100">Configuration</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Choisissez le salon du panneau et la catégorie où les salons ticket sont créés. En dessous, le contenu affiché
            sur Discord pour le panneau et l’accueil.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-zinc-400">Salon du panneau</span>
              <select
                className="ui-input"
                value={draftPanel}
                onChange={(e) => setDraftPanel(e.target.value)}
              >
                <option value="">— Choisir —</option>
                {textChannels.map((c) => (
                  <option key={c.id} value={c.id}>
                    #{c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-zinc-400">Catégorie des tickets</span>
              <select
                className="ui-input"
                value={draftCategory}
                onChange={(e) => setDraftCategory(e.target.value)}
              >
                <option value="">— Choisir —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
              <span className="text-zinc-400">Tickets ouverts max. par personne</span>
              <input
                type="number"
                min={1}
                max={25}
                inputMode="numeric"
                className="ui-input max-w-[10rem]"
                value={draftMaxOpenTicketsPerOpener}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  setDraftMaxOpenTicketsPerOpener(
                    Number.isNaN(v) ? 1 : Math.min(25, Math.max(1, Math.trunc(v))),
                  );
                }}
              />
              <span className="text-[11px] text-zinc-600">
                Une même personne ne pourra pas dépasser ce nombre de tickets encore ouverts en même temps (entre 1
                et 25). Par défaut : 1.
              </span>
            </label>
          </div>

          <div className="mt-8 border-t border-vex-border/80 pt-6">
            <h3 className="text-base font-semibold text-zinc-100">Panel ticket et message d&apos;accueil</h3>
            <p className="mt-1 text-xs text-zinc-500">
              Panel dans le salon public ; message d&apos;accueil dans le salon du ticket.
            </p>

            <div className="mt-5 grid gap-6 lg:grid-cols-2 lg:items-start">
            <div className="space-y-4 rounded-lg border border-vex-border/80 border-l-2 border-l-vex-accent/45 bg-vex-bg/40 p-4 pl-4 sm:p-5">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-vex-accent/35 bg-vex-accent/10 text-xs font-semibold text-vex-accent">
                1
              </span>
              <h4 className="text-sm font-semibold text-zinc-300">Panel ticket</h4>
            </div>
            <label className="flex flex-col gap-1.5 text-sm sm:max-w-xl">
              <span className="text-zinc-400">Modèle du message</span>
              <div className="flex gap-2">
                <select
                  className="ui-input min-w-0 flex-1"
                  value={draftPanelEmbed}
                  onChange={(e) => setDraftPanelEmbed(e.target.value)}
                >
                  <option value="">Sans modèle (texte par défaut)</option>
                  {embeds.map((em) => (
                    <option key={`panel-${em.id}`} value={em.id}>
                      {em.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="ui-btn-secondary shrink-0 px-3 py-2 text-sm whitespace-nowrap"
                  aria-label="Aperçu du message du Panel ticket avec ouverture de ticket"
                  onClick={() => setEmbedPreview("panel")}
                >
                  Aperçu
                </button>
              </div>
            </label>
            <div className="mt-4 border-t border-vex-border/80 pt-4">
              <TicketPanelOpenSection value={draftPanelOpen} onChange={setDraftPanelOpen} />
            </div>
          </div>

          <div className="space-y-4 rounded-lg border border-vex-border/80 border-l-2 border-l-vex-accent/45 bg-vex-bg/40 p-4 pl-4 sm:p-5">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-vex-accent/35 bg-vex-accent/10 text-xs font-semibold text-vex-accent">
                2
              </span>
              <h4 className="text-sm font-semibold text-zinc-300">Message d’accueil</h4>
            </div>
            <label className="flex flex-col gap-1.5 text-sm sm:max-w-xl">
              <span className="text-zinc-400">Modèle du message</span>
              <div className="flex gap-2">
                <select
                  className="ui-input min-w-0 flex-1"
                  value={draftWelcome}
                  onChange={(e) => setDraftWelcome(e.target.value)}
                >
                  <option value="">Sans modèle (texte par défaut)</option>
                  {embeds.map((em) => (
                    <option key={em.id} value={em.id}>
                      {em.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="ui-btn-secondary shrink-0 px-3 py-2 text-sm whitespace-nowrap"
                  aria-label="Aperçu du message d’accueil dans le salon du ticket"
                  onClick={() => setEmbedPreview("welcome")}
                >
                  Aperçu
                </button>
              </div>
            </label>
            <div className="mt-4 sm:max-w-xl">
              <UiToggle
                title="Bouton pour fermer le ticket"
                hint="Sous le message d'accueil"
                active={draftWelcomeMemberClose}
                detailsExpanded={welcomeCloseDetailsOpen}
                onToggleDetails={() => setWelcomeCloseDetailsOpen((v) => !v)}
                onToggle={() => {
                  setDraftWelcomeMemberClose((v) => {
                    const next = !v;
                    if (next) setWelcomeCloseDetailsOpen(true);
                    return next;
                  });
                }}
              />
              {draftWelcomeMemberClose && welcomeCloseDetailsOpen ? (
                <div className="mt-3 flex flex-col gap-2 rounded-md border border-vex-border/50 bg-vex-surface/30 px-3 py-2.5">
                  <span className="text-sm text-zinc-400" id="ticket-close-btn-color-label">
                    Couleur du bouton sur Discord
                  </span>
                  <div
                    className="flex flex-wrap items-center gap-3"
                    role="radiogroup"
                    aria-labelledby="ticket-close-btn-color-label"
                  >
                    {DISCORD_TICKET_PANEL_BUTTON_SWATCHES.map((sw) => {
                      const selected = draftWelcomeMemberCloseStyle === sw.value;
                      return (
                        <button
                          key={sw.value}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          title={sw.label}
                          aria-label={`${sw.label}${selected ? ", sélectionné" : ""}`}
                          onClick={() => setDraftWelcomeMemberCloseStyle(sw.value)}
                          className={`h-10 w-10 shrink-0 rounded-full border-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-vex-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-vex-bg ${
                            selected
                              ? "border-zinc-100 ring-2 ring-zinc-200/90 ring-offset-2 ring-offset-vex-bg"
                              : "border-zinc-600/70 opacity-90 hover:border-zinc-400 hover:opacity-100"
                          }`}
                          style={{ backgroundColor: sw.hex }}
                        />
                      );
                    })}
                  </div>
                  <div className="relative mt-3 block text-xs font-medium text-zinc-400" data-ticket-emoji-picker>
                    <label htmlFor="ticket-close-emoji">Emoji</label>
                    <input
                      id="ticket-close-emoji"
                      type="text"
                      className="ui-input mt-1.5 w-full text-sm"
                      value={draftWelcomeMemberCloseEmoji}
                      onChange={(e) => setDraftWelcomeMemberCloseEmoji(e.target.value)}
                      onClick={() => setOpenEmojiPicker("close")}
                      onFocus={() => setOpenEmojiPicker("close")}
                      maxLength={100}
                      placeholder={DEFAULT_TICKET_WELCOME_CLOSE_EMOJI}
                      title="Emoji simple, ou emoji du serveur au format <:nom:id>"
                      disabled={!draftWelcomeMemberClose}
                    />
                    {openEmojiPicker === "close" ? (
                      <div className="absolute left-0 top-full z-30 mt-2 flex max-w-xs flex-wrap gap-1.5 rounded-xl border border-vex-border bg-vex-surface p-2 shadow-xl shadow-black/30">
                        {ticketEmojiChoices.map((emoji) => (
                          <button
                            key={`close-${emoji}`}
                            type="button"
                            className="rounded-md border border-vex-border/70 bg-vex-bg/70 px-2.5 py-1.5 text-base hover:border-vex-accent/70 hover:bg-vex-accent/10"
                            onClick={() => {
                              setDraftWelcomeMemberCloseEmoji(emoji);
                              setOpenEmojiPicker(null);
                            }}
                          >
                            {emoji}
                          </button>
                        ))}
                        <button
                          type="button"
                          className="rounded-md border border-dashed border-vex-accent/60 bg-vex-accent/10 px-2.5 py-1.5 text-sm text-vex-accent hover:bg-vex-accent/15"
                          onClick={addCustomTicketEmoji}
                        >
                          +
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
              <UiToggle
                className="mt-4"
                title="Bouton pour ajouter quelqu’un au ticket"
                hint="Ouvre une fenêtre pour coller l’identifiant d'un membre Discord"
                active={draftWelcomeMemberAdd}
                detailsExpanded={welcomeAddDetailsOpen}
                onToggleDetails={() => setWelcomeAddDetailsOpen((v) => !v)}
                onToggle={() => {
                  setDraftWelcomeMemberAdd((v) => {
                    const next = !v;
                    if (next) setWelcomeAddDetailsOpen(true);
                    return next;
                  });
                }}
              />
              {draftWelcomeMemberAdd && welcomeAddDetailsOpen ? (
                <div className="mt-3 flex flex-col gap-2 rounded-md border border-vex-border/50 bg-vex-surface/30 px-3 py-2.5">
                  <span className="text-sm text-zinc-400" id="ticket-add-btn-color-label">
                    Couleur du bouton « Ajouter » sur Discord
                  </span>
                  <div
                    className="flex flex-wrap items-center gap-3"
                    role="radiogroup"
                    aria-labelledby="ticket-add-btn-color-label"
                  >
                    {DISCORD_TICKET_PANEL_BUTTON_SWATCHES.map((sw) => {
                      const selected = draftWelcomeMemberAddStyle === sw.value;
                      return (
                        <button
                          key={sw.value}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          title={sw.label}
                          aria-label={`Ajouter : ${sw.label}${selected ? ", sélectionné" : ""}`}
                          onClick={() => setDraftWelcomeMemberAddStyle(sw.value)}
                          className={`h-10 w-10 shrink-0 rounded-full border-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-vex-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-vex-bg ${
                            selected
                              ? "border-zinc-100 ring-2 ring-zinc-200/90 ring-offset-2 ring-offset-vex-bg"
                              : "border-zinc-600/70 opacity-90 hover:border-zinc-400 hover:opacity-100"
                          }`}
                          style={{ backgroundColor: sw.hex }}
                        />
                      );
                    })}
                  </div>
                  <div className="relative mt-3 block text-xs font-medium text-zinc-400" data-ticket-emoji-picker>
                    <label htmlFor="ticket-add-emoji">Emoji devant « Ajouter au ticket »</label>
                    <input
                      id="ticket-add-emoji"
                      type="text"
                      className="ui-input mt-1.5 w-full text-sm"
                      value={draftWelcomeMemberAddEmoji}
                      onChange={(e) => setDraftWelcomeMemberAddEmoji(e.target.value)}
                      onClick={() => setOpenEmojiPicker("add")}
                      onFocus={() => setOpenEmojiPicker("add")}
                      maxLength={100}
                      placeholder={DEFAULT_TICKET_WELCOME_ADD_EMOJI}
                      title="Emoji simple, ou emoji du serveur au format <:nom:id>"
                      disabled={!draftWelcomeMemberAdd}
                    />
                    {openEmojiPicker === "add" ? (
                      <div className="absolute left-0 top-full z-30 mt-2 flex max-w-xs flex-wrap gap-1.5 rounded-xl border border-vex-border bg-vex-surface p-2 shadow-xl shadow-black/30">
                        {ticketEmojiChoices.map((emoji) => (
                          <button
                            key={`add-${emoji}`}
                            type="button"
                            className="rounded-md border border-vex-border/70 bg-vex-bg/70 px-2.5 py-1.5 text-base hover:border-vex-accent/70 hover:bg-vex-accent/10"
                            onClick={() => {
                              setDraftWelcomeMemberAddEmoji(emoji);
                              setOpenEmojiPicker(null);
                            }}
                          >
                            {emoji}
                          </button>
                        ))}
                        <button
                          type="button"
                          className="rounded-md border border-dashed border-vex-accent/60 bg-vex-accent/10 px-2.5 py-1.5 text-sm text-vex-accent hover:bg-vex-accent/15"
                          onClick={addCustomTicketEmoji}
                        >
                          +
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
            </div>
          </div>

          <div
            ref={saveFeedbackRef}
            className="mt-6 border-t border-vex-border/80 pt-4"
            style={
              isDirty
                ? { scrollMarginBottom: "calc(6.5rem + env(safe-area-inset-bottom, 0px))" }
                : undefined
            }
          >
            {saveMessage ? (
              <p
                className={`text-sm ${saveState === "err" ? "text-amber-200/90" : saveState === "ok" ? "text-amber-200/90" : "text-zinc-400"}`}
                role="status"
              >
                {saveMessage}
              </p>
            ) : null}
          </div>
        </section>
      </div>

      <SaveChangesBar
        visible={isDirty || saveState === "ok"}
        saving={saveState === "saving"}
        status={saveState === "ok" && !isDirty ? "saved" : "dirty"}
        shakeKey={saveBarShakeTick}
        zIndexClass="z-50"
        onSave={() => void onSaveSettings()}
        onDiscard={handleDiscardChanges}
      />

      <TicketEmbedPreviewModal
        preview={embedPreview}
        onClose={() => setEmbedPreview(null)}
        discordGuildId={discordGuildId}
        embeds={embeds}
        welcomeEmbedId={draftWelcome}
        panelEmbedId={draftPanelEmbed}
        panelOpen={draftPanelOpen}
        welcomeMemberCloseButton={draftWelcomeMemberClose}
        welcomeMemberCloseButtonStyle={draftWelcomeMemberCloseStyle}
        welcomeMemberAddButton={draftWelcomeMemberAdd}
        welcomeMemberAddButtonStyle={draftWelcomeMemberAddStyle}
        welcomeMemberCloseButtonEmoji={draftWelcomeMemberCloseEmoji}
        welcomeMemberAddButtonEmoji={draftWelcomeMemberAddEmoji}
      />
    </div>
  );
}
