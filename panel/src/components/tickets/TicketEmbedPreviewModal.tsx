import { useEffect, useMemo, useState } from "react";
import type { EmbedTemplate } from "../../types/embedTemplate.js";
import type { DiscordTicketPanelButtonStyle, TicketPanelOpenConfig } from "../../types/ticket.js";
import { discordTicketPanelButtonPreviewHex } from "../../lib/discordTicketPanelButtonSwatches.js";
import { normalizePanelOpenConfig } from "./TicketPanelOpenSection.js";
import { fetchGuildMentionMeta } from "../../lib/embedsApi.js";
import { DiscordEmbedPreview } from "../embeds/DiscordEmbedPreview.js";
import type { MentionLookup } from "../embeds/DiscordRenderedText.js";
import {
  defaultSingleMessageDraft,
  templateToDraft,
  type TemplateDraft,
} from "../embeds/embedDraft.js";
import {
  DEFAULT_TICKET_WELCOME_ADD_EMOJI,
  DEFAULT_TICKET_WELCOME_CLOSE_EMOJI,
  parseTicketWelcomeButtonEmojiForDiscord,
} from "../../lib/ticketWelcomeButtonEmoji.js";
import {
  DEFAULT_TICKET_WELCOME_BUTTONS_HINT,
  defaultTicketPanelEmbedDraft,
  defaultTicketWelcomeEmbedDraft,
} from "../../lib/vexTicketDefaultBranding.js";

const emptyLookup: MentionLookup = { channelNames: {}, roleNames: {} };

function cloneDraft(d: TemplateDraft): TemplateDraft {
  return JSON.parse(JSON.stringify(d)) as TemplateDraft;
}

/** Le panneau Discord n’utilisez que le premier message du modèle. */
function firstMessageOnlyDraft(d: TemplateDraft): TemplateDraft {
  const copy = cloneDraft(d);
  if (copy.messages.length === 0) {
    copy.messages = [defaultSingleMessageDraft()];
  } else {
    copy.messages = [copy.messages[0]];
  }
  return copy;
}

/** Ajoute (sans muter) les boutons d’accueil sur le premier message du modèle, comme l’API le fait. */
function appendWelcomeAccueilButtons(
  d: TemplateDraft,
  close: boolean,
  closeStyle: DiscordTicketPanelButtonStyle,
  add: boolean,
  addStyle: DiscordTicketPanelButtonStyle,
  closeEmojiInput: string,
  addEmojiInput: string,
): TemplateDraft {
  if (!close && !add) return d;
  const copy = cloneDraft(d);
  const first = copy.messages[0];
  if (!first) return copy;
  let totalRows = 0;
  for (const b of first.componentBlocks) totalRows += b.rows.length;
  if (totalRows >= 5) return copy;
  const components: Array<{
    type: "button";
    label: string;
    style: DiscordTicketPanelButtonStyle;
    customId: string;
    emoji: ReturnType<typeof parseTicketWelcomeButtonEmojiForDiscord>;
  }> = [];
  if (close) {
    components.push({
      type: "button",
      label: "Fermer ce ticket",
      style: closeStyle,
      customId: "vex_ticket_welcome_close_preview",
      emoji: parseTicketWelcomeButtonEmojiForDiscord(
        closeEmojiInput.trim() || null,
        DEFAULT_TICKET_WELCOME_CLOSE_EMOJI,
      ),
    });
  }
  if (add) {
    components.push({
      type: "button",
      label: "Ajouter au ticket",
      style: addStyle,
      customId: "vex_ticket_welcome_add_preview",
      emoji: parseTicketWelcomeButtonEmojiForDiscord(
        addEmojiInput.trim() || null,
        DEFAULT_TICKET_WELCOME_ADD_EMOJI,
      ),
    });
  }
  first.componentBlocks = [
    ...first.componentBlocks,
    {
      rows: [{ components }],
    },
  ];
  return copy;
}

/** Même limite que l’API : lignes de composants du modèle avant la ligne « ouvrir ticket ». */
function sliceFirstMessageComponentRows(d: TemplateDraft, maxRows: number): TemplateDraft {
  const copy = cloneDraft(d);
  const m = copy.messages[0];
  if (!m) return copy;
  const flat = m.componentBlocks.flatMap((b) => b.rows);
  const sliced = flat.slice(0, maxRows);
  m.componentBlocks = sliced.length > 0 ? [{ rows: sliced }] : [];
  return copy;
}

function countFirstMessageComponentRows(d: TemplateDraft): number {
  const first = d.messages[0];
  if (!first) return 0;
  return first.componentBlocks.reduce((acc, b) => acc + b.rows.length, 0);
}

/** Modèle d’accueil par défaut : n’ajoute la phrase sur les boutons que si le message en affiche. */
function applyDefaultWelcomeButtonsHintLine(draft: TemplateDraft, isDefaultWelcome: boolean): TemplateDraft {
  if (!isDefaultWelcome) return draft;
  const rows = countFirstMessageComponentRows(draft);
  if (rows === 0) return draft;
  const copy = cloneDraft(draft);
  const m0 = copy.messages[0];
  const emb = m0?.embeds[0];
  if (!emb) return copy;
  const desc = (emb.description ?? "").trimEnd();
  if (desc.includes(DEFAULT_TICKET_WELCOME_BUTTONS_HINT)) return copy;
  emb.description = `${desc}\n\n${DEFAULT_TICKET_WELCOME_BUTTONS_HINT}`;
  return copy;
}

function buildWelcomePreviewDraft(embeds: EmbedTemplate[], welcomeEmbedId: string): TemplateDraft {
  if (!welcomeEmbedId.trim()) {
    return {
      name: "Accueil",
      listAccentColor: null,
      listIconColor: null,
      listIconKey: null,
      messages: [
        {
          ...defaultSingleMessageDraft(),
          messageContent: "",
          embeds: [defaultTicketWelcomeEmbedDraft()],
          componentBlocks: [],
        },
      ],
    };
  }
  const t = embeds.find((e) => e.id === welcomeEmbedId);
  if (!t) {
    return {
      name: "Accueil",
      listAccentColor: null,
      listIconColor: null,
      listIconKey: null,
      messages: [
        {
          ...defaultSingleMessageDraft(),
          messageContent: "Modèle introuvable ou supprimé.",
          embeds: [],
          componentBlocks: [],
        },
      ],
    };
  }
  return templateToDraft(t);
}

function buildPanelMessagePreviewDraft(embeds: EmbedTemplate[], panelEmbedId: string): TemplateDraft {
  if (!panelEmbedId.trim()) {
    return {
      name: "Panneau",
      listAccentColor: null,
      listIconColor: null,
      listIconKey: null,
      messages: [
        {
          ...defaultSingleMessageDraft(),
          messageContent: "",
          embeds: [defaultTicketPanelEmbedDraft()],
          componentBlocks: [],
        },
      ],
    };
  }
  const t = embeds.find((e) => e.id === panelEmbedId);
  if (!t) {
    return {
      name: "Panneau",
      listAccentColor: null,
      listIconColor: null,
      listIconKey: null,
      messages: [
        {
          ...defaultSingleMessageDraft(),
          messageContent: "Modèle introuvable ou supprimé.",
          embeds: [],
          componentBlocks: [],
        },
      ],
    };
  }
  const full = templateToDraft(t);
  return firstMessageOnlyDraft(full);
}

function TicketPanelOpenRowPreview({ config }: { config: TicketPanelOpenConfig }) {
  const cfg = normalizePanelOpenConfig(config);
  if (cfg.style === "select") {
    return (
      <div className="mt-2 max-w-[432px]">
        <div
          className="flex min-h-[40px] w-full max-w-full cursor-default items-center justify-between gap-2 rounded px-3 py-2 text-left text-sm"
          style={{ backgroundColor: "#1e1f22", color: "#dbdee1", border: "1px solid #1e1f22" }}
        >
          <span className="truncate" style={{ color: "#949ba4" }}>
            {cfg.selectPlaceholder || "Choisir une option"}
          </span>
          <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4 shrink-0" style={{ color: "#949ba4" }} fill="currentColor">
            <path d="M7 10l5 5 5-5H7z" />
          </svg>
        </div>
        <p className="mt-1.5 text-[11px]" style={{ color: "#949ba4" }}>
          {cfg.options.some((o) => o.requireModal)
            ? "Menu déroulant (aperçu) — selon l’option, une fenêtre peut demander le détail (comme sur Discord)."
            : "Menu déroulant (aperçu) — pour chaque option configurée sans saisie, le ticket s’ouvre tout de suite après le choix."}
        </p>
      </div>
    );
  }
  const label = (cfg.buttonLabel || "Ouvrir un ticket").slice(0, 80);
  const previewBg = discordTicketPanelButtonPreviewHex(cfg.discordButtonStyle);
  return (
    <div className="relative z-[1] mt-2 flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled
          className="inline-flex max-h-10 min-h-[32px] max-w-full min-w-[60px] cursor-default items-center justify-center rounded-[3px] px-3 py-1.5 text-sm font-medium text-white opacity-95"
          style={{ backgroundColor: previewBg }}
        >
          {label}
        </button>
      </div>
      {cfg.requireModal ? (
        <p className="text-[11px]" style={{ color: "#949ba4" }}>
          Après ce clic, Discord ouvre une fenêtre pour saisir le détail de la demande (aperçu non interactif).
        </p>
      ) : null}
    </div>
  );
}

export type TicketEmbedPreviewTarget = "welcome" | "panel";

type Props = {
  /** `null` = modale fermée. */
  preview: TicketEmbedPreviewTarget | null;
  onClose: () => void;
  discordGuildId: string;
  embeds: EmbedTemplate[];
  welcomeEmbedId: string;
  panelEmbedId: string;
  panelOpen: TicketPanelOpenConfig;
  welcomeMemberCloseButton: boolean;
  welcomeMemberCloseButtonStyle: DiscordTicketPanelButtonStyle;
  welcomeMemberAddButton: boolean;
  welcomeMemberAddButtonStyle: DiscordTicketPanelButtonStyle;
  welcomeMemberCloseButtonEmoji: string;
  welcomeMemberAddButtonEmoji: string;
};

export function TicketEmbedPreviewModal({
  preview,
  onClose,
  discordGuildId,
  embeds,
  welcomeEmbedId,
  panelEmbedId,
  panelOpen,
  welcomeMemberCloseButton,
  welcomeMemberCloseButtonStyle,
  welcomeMemberAddButton,
  welcomeMemberAddButtonStyle,
  welcomeMemberCloseButtonEmoji,
  welcomeMemberAddButtonEmoji,
}: Props) {
  const [mentionLookup, setMentionLookup] = useState<MentionLookup>(emptyLookup);
  const open = preview !== null;
  const welcomeDraft = useMemo(
    () => {
      const base = buildWelcomePreviewDraft(embeds, welcomeEmbedId);
      const withButtons = appendWelcomeAccueilButtons(
        base,
        welcomeMemberCloseButton,
        welcomeMemberCloseButtonStyle,
        welcomeMemberAddButton,
        welcomeMemberAddButtonStyle,
        welcomeMemberCloseButtonEmoji,
        welcomeMemberAddButtonEmoji,
      );
      return applyDefaultWelcomeButtonsHintLine(withButtons, !welcomeEmbedId.trim());
    },
    [
      embeds,
      welcomeEmbedId,
      welcomeMemberCloseButton,
      welcomeMemberCloseButtonStyle,
      welcomeMemberAddButton,
      welcomeMemberAddButtonStyle,
      welcomeMemberCloseButtonEmoji,
      welcomeMemberAddButtonEmoji,
    ],
  );

  const panelDraft = useMemo(() => {
    const base = buildPanelMessagePreviewDraft(embeds, panelEmbedId);
    const maxRows = panelOpen.style === "select" ? 3 : 4;
    return sliceFirstMessageComponentRows(base, maxRows);
  }, [embeds, panelEmbedId, panelOpen]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void fetchGuildMentionMeta(discordGuildId)
      .then((meta) => {
        if (cancelled || !meta) return;
        setMentionLookup({
          channelNames: Object.fromEntries((meta.channels ?? []).map((c) => [c.id, c.name])),
          roleNames: Object.fromEntries((meta.roles ?? []).map((r) => [r.id, r.name])),
        });
      })
      .catch(() => {
        if (!cancelled) setMentionLookup(emptyLookup);
      });
    return () => {
      cancelled = true;
    };
  }, [open, discordGuildId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (preview === null) return null;

  const titleId = preview === "welcome" ? "ticket-preview-welcome-title" : "ticket-preview-panel-title";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/65 p-2 py-4 sm:p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="ui-card max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto p-3 shadow-2xl sm:max-h-[min(90vh,52rem)] sm:p-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-vex-border pb-4">
          <div>
            {preview === "welcome" ? (
              <>
                <h2 id={titleId} className="text-lg font-semibold text-zinc-100">
                  Aperçu — message d’accueil
                </h2>
                <p className="mt-1 max-w-xl text-sm text-zinc-500">
                  Rendu proche de Discord. Tout le modèle peut être envoyé en plusieurs messages, dans l’ordre défini dans
                  Embeds.
                </p>
              </>
            ) : (
              <>
                <h2 id={titleId} className="text-lg font-semibold text-zinc-100">
                  Aperçu — Panel ticket
                </h2>
                <p className="mt-1 max-w-xl text-sm text-zinc-500">
                  Un seul message sur Discord : le premier du modèle. Les boutons du modèle sont limités comme à
                  l’enregistrement ; en dessous, le bouton ou le menu pour ouvrir un ticket.
                </p>
              </>
            )}
          </div>
          <button type="button" className="ui-btn-secondary shrink-0" onClick={onClose}>
            Fermer
          </button>
        </div>

        {preview === "welcome" ? (
          <div className="mt-5">
            <DiscordEmbedPreview draft={welcomeDraft} mentionLookup={mentionLookup} compact />
          </div>
        ) : (
          <div
            className="mt-5 overflow-hidden rounded-xl border border-vex-border"
            style={{ backgroundColor: "#313338", fontFamily: "var(--font-discord-body)" }}
          >
            <DiscordEmbedPreview
              draft={panelDraft}
              mentionLookup={mentionLookup}
              compact
              className="rounded-none border-0 p-3 shadow-none"
            />
            <div className="px-3 pb-3">
              <div className="mx-auto max-w-full pl-10 sm:max-w-[480px] sm:pl-14">
                <TicketPanelOpenRowPreview config={panelOpen} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
