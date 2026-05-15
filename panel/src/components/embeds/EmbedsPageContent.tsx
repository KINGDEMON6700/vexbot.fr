import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  createEmbedTemplate,
  deleteEmbedTemplate,
  fetchEmbedTemplates,
  fetchGuildMembersForMention,
  fetchGuildMentionMeta,
  fetchGuildThreads,
  fetchGuildTextChannels,
  sendEmbedTemplateToChannel,
  updateEmbedTemplate,
} from "../../lib/embedsApi.js";
import { fetchGuildOverview } from "../../lib/overviewApi.js";
import type { EmbedTemplate } from "../../types/embedTemplate.js";
import {
  defaultTemplateDraft,
  templateDraftMessagesToApiPayload,
  templateDraftToApiPayload,
  templateToDraft,
  type TemplateDraft,
} from "./embedDraft.js";
import { DiscohookEmbedEditor } from "./DiscohookEmbedEditor.js";
import { DiscordEmbedPreview, type MessageAuthorPreview } from "./DiscordEmbedPreview.js";
import { EmbedModelPicker } from "./EmbedModelPicker.js";
import { ModalShell } from "../ui/ModalShell.js";
import { EmbedsPageSkeleton } from "../ui/PageSkeleton.js";
import { createPageCache } from "../../lib/pageDataCache.js";
import { SaveChangesBar, SAVE_BAR_PAGE_PADDING } from "../ui/SaveChangesBar.js";
import type { MentionLookup } from "./DiscordRenderedText.js";
import {
  defaultJsonExportFilename,
  downloadTextAsFile,
  exportTemplateDraftToJsonString,
  importTemplateDraftFromJson,
} from "./embedTemplateJson.js";

type Props = {
  discordGuildId: string;
};

const embedListCache = createPageCache<EmbedTemplate[]>();

type FormatActionId =
  | "bold"
  | "italic"
  | "underline"
  | "strike"
  | "inlineCode"
  | "codeBlock"
  | "spoiler"
  | "quote"
  | "link"
  | "mentionChannel"
  | "mentionRole"
  | "mentionUser";

type ImmediateFormatActionId = Exclude<FormatActionId, "link" | "mentionChannel" | "mentionRole" | "mentionUser">;

const CONTEXT_FORMAT_SECTIONS: Array<{ title: string; items: Array<{ id: FormatActionId; label: string }> }> = [
  {
    title: "Mise en forme",
    items: [
      { id: "bold", label: "Gras" },
      { id: "italic", label: "Italique" },
      { id: "underline", label: "Souligné" },
      { id: "strike", label: "Barré" },
    ],
  },
  {
    title: "Code et blocs",
    items: [
      { id: "inlineCode", label: "Code" },
      { id: "codeBlock", label: "Bloc de code" },
      { id: "spoiler", label: "Spoiler" },
      { id: "quote", label: "Citation" },
    ],
  },
  {
    title: "Liens et mentions",
    items: [
      { id: "link", label: "Lien" },
      { id: "mentionChannel", label: "Ping salon" },
      { id: "mentionRole", label: "Ping rôle" },
      { id: "mentionUser", label: "Ping utilisateur" },
    ],
  },
];

type TextTarget = HTMLInputElement | HTMLTextAreaElement;

type ContextMenuState = { x: number; y: number; pick?: "channel" | "role" | "user" | "link" };

export function EmbedsPageContent({ discordGuildId }: Props) {
  const initialDraft = useMemo(() => defaultTemplateDraft(), []);
  const [list, setList] = useState<EmbedTemplate[]>(() => embedListCache.get(discordGuildId) ?? []);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(() => !(embedListCache.get(discordGuildId)?.length));

  const [selectedId, setSelectedId] = useState<string | "new" | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ id: string; name: string } | null>(null);
  const [draft, setDraft] = useState<TemplateDraft>(initialDraft);
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(initialDraft));
  /** Après import JSON, force l’affichage « modifié » (évite l’égalité stringify import / brouillon déjà enregistré). */
  const [jsonImportPending, setJsonImportPending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [sendChannels, setSendChannels] = useState<Array<{ id: string; name: string }>>([]);
  const [threadOptions, setThreadOptions] = useState<Array<{ id: string; name: string }>>([]);
  /** Salon texte ou fil (les deux utilisent un ID de « salon » côté API Discord). */
  const [sendTarget, setSendTarget] = useState<{ kind: "channel" | "thread"; id: string } | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [mentionPickerFilter, setMentionPickerFilter] = useState("");
  const [memberPickRows, setMemberPickRows] = useState<
    Array<{ id: string; displayName: string; username: string }>
  >([]);
  const [memberPickLoading, setMemberPickLoading] = useState(false);
  const [memberPickError, setMemberPickError] = useState<string | null>(null);
  const [userNamesForPreview, setUserNamesForPreview] = useState<Record<string, string>>({});
  const [linkPickUrl, setLinkPickUrl] = useState("https://");
  const [linkPickLabel, setLinkPickLabel] = useState("Mon lien");
  const [linkPickError, setLinkPickError] = useState<string | null>(null);

  const [mentionMeta, setMentionMeta] = useState<Awaited<ReturnType<typeof fetchGuildMentionMeta>>>(null);
  const [messageAuthor, setMessageAuthor] = useState<MessageAuthorPreview | null>(null);
  const contextTargetRef = useRef<{ el: TextTarget; start: number; end: number } | null>(null);
  const editorRootRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const importJsonInputRef = useRef<HTMLInputElement>(null);

  const mentionLookup: MentionLookup = useMemo(
    () => ({
      channelNames: Object.fromEntries((mentionMeta?.channels ?? []).map((c) => [c.id, c.name])),
      roleNames: Object.fromEntries((mentionMeta?.roles ?? []).map((r) => [r.id, r.name])),
      userNames: userNamesForPreview,
    }),
    [mentionMeta, userNamesForPreview],
  );

  const mentionPickerChannels = useMemo(() => {
    const q = mentionPickerFilter.trim().toLowerCase();
    const list = [...(mentionMeta?.channels ?? [])].sort((a, b) =>
      a.name.localeCompare(b.name, "fr", { sensitivity: "base" }),
    );
    if (!q) return list;
    return list.filter((c) => c.name.toLowerCase().includes(q) || c.id.includes(q));
  }, [mentionMeta, mentionPickerFilter]);

  const mentionPickerRoles = useMemo(() => {
    const q = mentionPickerFilter.trim().toLowerCase();
    const list = [...(mentionMeta?.roles ?? [])].sort((a, b) =>
      a.name.localeCompare(b.name, "fr", { sensitivity: "base" }),
    );
    if (!q) return list;
    return list.filter((r) => r.name.toLowerCase().includes(q) || r.id.includes(q));
  }, [mentionMeta, mentionPickerFilter]);
  const isDirty = useMemo(
    () => jsonImportPending || JSON.stringify(draft) !== savedSnapshot,
    [draft, savedSnapshot, jsonImportPending],
  );
  const isDirtyRef = useRef(isDirty);
  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);
  const showSaveMenu = isDirty || selectedId === "new";

  const setNativeInputValue = (el: TextTarget, value: string) => {
    const proto = Object.getPrototypeOf(el) as object;
    const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
    descriptor?.set?.call(el, value);
  };

  const wrapSelectionReplacement = (value: string, start: number, end: number, before: string, after: string) => {
    const selected = value.slice(start, end);
    const content = selected || "texte";
    const replacement = `${before}${content}${after}`;
    return {
      replacement,
      selStart: start + before.length,
      selEnd: start + before.length + content.length,
    };
  };

  /** Utilise insertText quand c’est possible pour que Ctrl+Z / Ctrl+Y gardent l’historique natif du champ. */
  const applyReplacementToField = (
    el: TextTarget,
    value: string,
    start: number,
    end: number,
    replacement: string,
    selectionAfter: { start: number; end: number },
  ) => {
    el.focus();
    try {
      el.setSelectionRange(start, end);
    } catch {
      // ignore
    }
    const execOk =
      typeof document.execCommand === "function" && document.execCommand("insertText", false, replacement);

    if (!execOk) {
      const nextValue = value.slice(0, start) + replacement + value.slice(end);
      setNativeInputValue(el, nextValue);
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    requestAnimationFrame(() => {
      try {
        const len = el.value.length;
        const s = Math.min(selectionAfter.start, len);
        const e = Math.min(selectionAfter.end, len);
        el.setSelectionRange(s, e);
      } catch {
        // ignore
      }
    });
    setContextMenu(null);
  };

  const applyContextFormat = (action: ImmediateFormatActionId) => {
    const target = contextTargetRef.current;
    if (!target) return;
    if (!editorRootRef.current?.contains(target.el)) return;

    const el = target.el;
    const value = el.value;
    const start = Math.max(0, target.start);
    const end = Math.max(start, target.end);
    const selected = value.slice(start, end);

    let replacement: string;
    let selStart: number;
    let selEnd: number;

    if (action === "bold") {
      const r = wrapSelectionReplacement(value, start, end, "**", "**");
      replacement = r.replacement;
      selStart = r.selStart;
      selEnd = r.selEnd;
    } else if (action === "italic") {
      const r = wrapSelectionReplacement(value, start, end, "*", "*");
      replacement = r.replacement;
      selStart = r.selStart;
      selEnd = r.selEnd;
    } else if (action === "underline") {
      const r = wrapSelectionReplacement(value, start, end, "__", "__");
      replacement = r.replacement;
      selStart = r.selStart;
      selEnd = r.selEnd;
    } else if (action === "strike") {
      const r = wrapSelectionReplacement(value, start, end, "~~", "~~");
      replacement = r.replacement;
      selStart = r.selStart;
      selEnd = r.selEnd;
    } else if (action === "inlineCode") {
      const r = wrapSelectionReplacement(value, start, end, "`", "`");
      replacement = r.replacement;
      selStart = r.selStart;
      selEnd = r.selEnd;
    } else if (action === "codeBlock") {
      const content = selected || "console.log('Salut')";
      replacement = `\`\`\`js\n${content}\n\`\`\``;
      selStart = start + 6;
      selEnd = selStart + content.length;
    } else if (action === "spoiler") {
      const r = wrapSelectionReplacement(value, start, end, "||", "||");
      replacement = r.replacement;
      selStart = r.selStart;
      selEnd = r.selEnd;
    } else if (action === "quote") {
      const content = selected || "texte cité";
      replacement = content
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");
      selStart = start;
      selEnd = start + replacement.length;
    } else {
      return;
    }

    applyReplacementToField(el, value, start, end, replacement, { start: selStart, end: selEnd });
  };

  const insertPickedLink = () => {
    const target = contextTargetRef.current;
    if (!target || !editorRootRef.current?.contains(target.el)) {
      setContextMenu(null);
      return;
    }
    const urlRaw = linkPickUrl.trim();
    if (!urlRaw) {
      setLinkPickError("Indique une adresse (URL).");
      return;
    }
    let href = urlRaw;
    if (!/^https?:\/\//i.test(href) && /^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(href)) {
      href = `https://${href}`;
    }
    try {
      const u = new URL(href);
      if (u.protocol !== "http:" && u.protocol !== "https:") {
        setLinkPickError("Utilise une adresse en http:// ou https://.");
        return;
      }
    } catch {
      setLinkPickError("Adresse invalide.");
      return;
    }
    setLinkPickError(null);
    const text = linkPickLabel.trim() || "Mon lien";
    const el = target.el;
    const value = el.value;
    const start = Math.max(0, target.start);
    const end = Math.max(start, target.end);
    const replacement = `[${text}](${href})`;
    const selStart = start + 1;
    const selEnd = selStart + text.length;
    applyReplacementToField(el, value, start, end, replacement, { start: selStart, end: selEnd });
  };

  const insertPickedUserMention = (userId: string, displayLabel: string) => {
    const target = contextTargetRef.current;
    if (!target || !editorRootRef.current?.contains(target.el)) {
      setContextMenu(null);
      return;
    }
    const trimmed = userId.trim();
    if (!trimmed) {
      setContextMenu(null);
      return;
    }
    const label = displayLabel.trim() || trimmed;
    setUserNamesForPreview((prev) => ({ ...prev, [trimmed]: label }));
    const el = target.el;
    const value = el.value;
    const start = Math.max(0, target.start);
    const end = Math.max(start, target.end);
    const replacement = `<@${trimmed}>`;
    const selStart = start + 2;
    const selEnd = selStart + trimmed.length;
    applyReplacementToField(el, value, start, end, replacement, { start: selStart, end: selEnd });
  };

  const insertPickedChannelMention = (channelId: string) => {
    const target = contextTargetRef.current;
    if (!target || !editorRootRef.current?.contains(target.el)) {
      setContextMenu(null);
      return;
    }
    const trimmed = channelId.trim();
    if (!trimmed) {
      setContextMenu(null);
      return;
    }
    const el = target.el;
    const value = el.value;
    const start = Math.max(0, target.start);
    const end = Math.max(start, target.end);
    const replacement = `<#${trimmed}>`;
    const selStart = start + 2;
    const selEnd = selStart + trimmed.length;
    applyReplacementToField(el, value, start, end, replacement, { start: selStart, end: selEnd });
  };

  const insertPickedRoleMention = (roleId: string) => {
    const target = contextTargetRef.current;
    if (!target || !editorRootRef.current?.contains(target.el)) {
      setContextMenu(null);
      return;
    }
    const trimmed = roleId.trim();
    if (!trimmed) {
      setContextMenu(null);
      return;
    }
    const el = target.el;
    const value = el.value;
    const start = Math.max(0, target.start);
    const end = Math.max(start, target.end);
    const replacement = `<@&${trimmed}>`;
    const selStart = start + 3;
    const selEnd = selStart + trimmed.length;
    applyReplacementToField(el, value, start, end, replacement, { start: selStart, end: selEnd });
  };

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    if (!isDirty) return;

    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;

      const nextUrl = new URL(anchor.href, window.location.href);
      const currentUrl = new URL(window.location.href);
      if (nextUrl.href === currentUrl.href) return;
      if (nextUrl.origin !== currentUrl.origin) return;

      const leave = window.confirm(
        "Vous avez des modifications non enregistrées. Quitter la page et perdre ces changements ?",
      );
      if (!leave) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    document.addEventListener("click", onDocumentClick, true);
    return () => document.removeEventListener("click", onDocumentClick, true);
  }, [isDirty]);

  useEffect(() => {
    if (!contextMenu) return;
    const closeMenu = () => setContextMenu(null);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };
    const onMouseDownCapture = (event: MouseEvent) => {
      const el = contextMenuRef.current;
      const target = event.target as Node | null;
      if (el && target && el.contains(target)) return;
      closeMenu();
    };
    const onWindowScroll = () => closeMenu();
    document.addEventListener("mousedown", onMouseDownCapture, true);
    window.addEventListener("scroll", onWindowScroll);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDownCapture, true);
      window.removeEventListener("scroll", onWindowScroll);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (!contextMenu) {
      setMentionPickerFilter("");
      setMemberPickRows([]);
      setMemberPickError(null);
      setMemberPickLoading(false);
      setLinkPickUrl("https://");
      setLinkPickLabel("Mon lien");
      setLinkPickError(null);
    }
  }, [contextMenu]);

  useEffect(() => {
    setUserNamesForPreview({});
  }, [discordGuildId]);

  useEffect(() => {
    if (contextMenu?.pick !== "user") return;

    let cancelled = false;
    const q = mentionPickerFilter.trim();
    const delay = q ? 250 : 0;

    const run = () => {
      setMemberPickLoading(true);
      setMemberPickError(null);
      void fetchGuildMembersForMention(discordGuildId, {
        q: q || undefined,
        limit: q ? 100 : 200,
      })
        .then((members) => {
          if (cancelled) return;
          setMemberPickRows(members);
          setUserNamesForPreview((prev) => {
            const next = { ...prev };
            for (const m of members) next[m.id] = m.displayName;
            return next;
          });
        })
        .catch((e: unknown) => {
          if (cancelled) return;
          setMemberPickRows([]);
          setMemberPickError(e instanceof Error ? e.message : "Erreur");
        })
        .finally(() => {
          if (!cancelled) setMemberPickLoading(false);
        });
    };

    const tid = window.setTimeout(run, delay);
    return () => {
      cancelled = true;
      window.clearTimeout(tid);
    };
  }, [contextMenu?.pick, mentionPickerFilter, discordGuildId]);

  const handleDiscardChanges = () => {
    try {
      const restored = JSON.parse(savedSnapshot) as TemplateDraft;
      setDraft(restored);
      setJsonImportPending(false);
      setMessage("Modifications annulées.");
    } catch {
      setMessage("Impossible de restaurer les modifications.");
    }
  };

  const load = useCallback(async () => {
    setLoadError(false);
    if (!embedListCache.get(discordGuildId)?.length) setLoading(true);
    try {
      const embeds = await fetchEmbedTemplates(discordGuildId);
      embedListCache.set(discordGuildId, embeds);
      setList(embeds);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [discordGuildId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const m = await fetchGuildMentionMeta(discordGuildId);
        if (!cancelled) {
          setMentionMeta(m);
        }
      } catch {
        if (!cancelled) {
          setMentionMeta(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [discordGuildId]);

  useEffect(() => {
    let cancelled = false;
    setSendChannels([]);
    setThreadOptions([]);
    setSendTarget(null);
    void (async () => {
      try {
        const [channels, threads] = await Promise.all([
          fetchGuildTextChannels(discordGuildId),
          fetchGuildThreads(discordGuildId),
        ]);
        if (cancelled) return;
        setSendChannels(channels);
        setThreadOptions(threads);

        setSendTarget((prev) => {
          const pickFirst = (): { kind: "channel" | "thread"; id: string } | null => {
            if (channels[0]) return { kind: "channel", id: channels[0].id };
            if (threads[0]) return { kind: "thread", id: threads[0].id };
            return null;
          };
          const stillThere = (t: { kind: "channel" | "thread"; id: string }) =>
            t.kind === "channel"
              ? channels.some((c) => c.id === t.id)
              : threads.some((th) => th.id === t.id);

          if (prev && stillThere(prev)) return prev;
          return pickFirst();
        });
      } catch {
        if (!cancelled) {
          setSendChannels([]);
          setThreadOptions([]);
          setSendTarget(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [discordGuildId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const o = await fetchGuildOverview(discordGuildId);
        if (cancelled) return;
        if (o.botPresent && o.bot) {
          setMessageAuthor({
            displayName: (o.bot.nickname ?? o.bot.accountUsername).slice(0, 32),
            avatarUrl: o.bot.guildAvatarUrl ?? o.bot.defaultAvatarUrl,
          });
        } else {
          setMessageAuthor(null);
        }
      } catch {
        if (!cancelled) setMessageAuthor(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [discordGuildId]);

  const confirmDiscardIfNeeded = (nextId: string | "new" | null): boolean => {
    if (!isDirty) return true;
    if (nextId === selectedId) return true;
    return window.confirm("Vous avez des modifications non enregistrées. Les ignorer et changer de modèle ?");
  };

  const applyDraftSelection = (id: string | "new" | null, nextDraft: TemplateDraft) => {
    setMessage(null);
    setDeleteModal(null);
    setJsonImportPending(false);
    setSelectedId(id);
    setDraft(nextDraft);
    setSavedSnapshot(JSON.stringify(nextDraft));
  };

  const selectTemplate = (id: string | "new" | null) => {
    if (!confirmDiscardIfNeeded(id)) return;
    if (id === "new") {
      applyDraftSelection("new", defaultTemplateDraft());
      return;
    }
    if (id === null) {
      applyDraftSelection(null, defaultTemplateDraft());
      return;
    }
    const t = list.find((e) => e.id === id);
    if (t) {
      applyDraftSelection(id, templateToDraft(t));
    }
  };

  useEffect(() => {
    if (loading) return;
    if (list.length === 0) {
      if (selectedId === null) {
        const nextDraft = defaultTemplateDraft();
        setSelectedId("new");
        setDraft(nextDraft);
        setSavedSnapshot(JSON.stringify(nextDraft));
        setJsonImportPending(false);
      }
      return;
    }
    if (selectedId === null) {
      const first = list[0];
      if (first) {
        const nextDraft = templateToDraft(first);
        setSelectedId(first.id);
        setDraft(nextDraft);
        setSavedSnapshot(JSON.stringify(nextDraft));
        setJsonImportPending(false);
      }
    }
  }, [loading, list, selectedId]);

  const handleSave = async () => {
    setMessage(null);
    const buildUniqueName = (baseName: string) => {
      const existing = new Set(list.map((t) => t.name.trim().toLowerCase()));
      const base = baseName.trim() || "Exemple";
      if (!existing.has(base.toLowerCase())) return base;
      let i = 2;
      while (existing.has(`${base} ${i}`.toLowerCase())) i += 1;
      return `${base} ${i}`;
    };
    const nextName =
      selectedId === "new" || selectedId === null
        ? buildUniqueName(draft.name.trim() || "Exemple")
        : draft.name.trim() || `Modèle ${new Date().toLocaleDateString("fr-FR")} ${Date.now().toString().slice(-4)}`;
    const draftToSave = { ...draft, name: nextName };
    let payload;
    try {
      payload = templateDraftToApiPayload(draftToSave);
    } catch (err) {
      setMessage("Pour une date fixe, choisissez une date et une heure.");
      return;
    }

    setSaving(true);
    try {
      if (selectedId === "new" || selectedId === null) {
        const created = await createEmbedTemplate(discordGuildId, payload);
        const nextDraft = templateToDraft(created);
        setList((prev) => [created, ...prev.filter((e) => e.id !== created.id)]);
        setSelectedId(created.id);
        setDraft(nextDraft);
        setSavedSnapshot(JSON.stringify(nextDraft));
        setJsonImportPending(false);
        setMessage("C’est enregistré.");
      } else {
        const updated = await updateEmbedTemplate(discordGuildId, selectedId, payload);
        const nextDraft = templateToDraft(updated);
        setList((prev) => {
          const i = prev.findIndex((e) => e.id === updated.id);
          if (i < 0) return [updated, ...prev];
          const next = [...prev];
          next[i] = updated;
          return next;
        });
        setDraft(nextDraft);
        setSavedSnapshot(JSON.stringify(nextDraft));
        setJsonImportPending(false);
        setMessage("C’est enregistré.");
      }
    } catch (e: unknown) {
      const err = e as Error & { status?: number; code?: string };
      if (err.status === 409) {
        setMessage("Vous avez déjà un modèle avec ce nom. Choisissez un autre nom.");
      } else if (err.message) {
        setMessage(err.message);
      } else {
        setMessage("Impossible d’enregistrer. Réessayez dans un instant.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    setMessage(null);
    setSaving(true);
    try {
      const id = deleteModal.id;
      await deleteEmbedTemplate(discordGuildId, id);
      const nextList = list.filter((e) => e.id !== id);
      setList(nextList);
      setDeleteModal(null);
      if (nextList.length === 0) {
        const nextDraft = defaultTemplateDraft();
        setSelectedId("new");
        setDraft(nextDraft);
        setSavedSnapshot(JSON.stringify(nextDraft));
        setJsonImportPending(false);
      } else {
        const nextDraft = templateToDraft(nextList[0]);
        setSelectedId(nextList[0].id);
        setDraft(nextDraft);
        setSavedSnapshot(JSON.stringify(nextDraft));
        setJsonImportPending(false);
      }
      setMessage("Modèle supprimé.");
    } catch {
      setMessage("Impossible de supprimer. Réessayez plus tard.");
    } finally {
      setSaving(false);
    }
  };

  const openDeleteModal = (id: string) => {
    const t = list.find((x) => x.id === id);
    if (!t) return;
    setDeleteModal({ id, name: t.name });
  };

  const handleUpdateTemplateListMeta = async (
    id: string,
    meta: {
      name: string;
      listAccentColor: number | null;
      listIconColor: number | null;
      listIconKey: string | null;
    },
  ) => {
    const newName = meta.name.trim();
    if (!newName) {
      setMessage("Le nom ne peut pas être vide.");
      return;
    }
    const t = list.find((x) => x.id === id);
    if (!t) return;
    setSaving(true);
    setMessage(null);
    try {
      const updated = await updateEmbedTemplate(discordGuildId, t.id, {
        ...templateDraftToApiPayload(templateToDraft(t)),
        name: newName,
        listAccentColor: meta.listAccentColor,
        listIconColor: meta.listIconColor,
        listIconKey: meta.listIconKey,
      });
      setList((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      if (selectedId === updated.id) {
        const nextDraft = templateToDraft(updated);
        setDraft(nextDraft);
        setSavedSnapshot(JSON.stringify(nextDraft));
      }
      setMessage("Modèle mis à jour (nom, couleur ou icône).");
    } catch {
      setMessage("Impossible d’enregistrer les modifications du modèle.");
    } finally {
      setSaving(false);
    }
  };

  const sendTargetKey = sendTarget ? `${sendTarget.kind}:${sendTarget.id}` : "";

  const handleExportJson = () => {
    setMessage(null);
    try {
      const json = exportTemplateDraftToJsonString(draft);
      downloadTextAsFile(defaultJsonExportFilename(draft.name), json);
      setMessage("Fichier JSON téléchargé.");
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Impossible d’exporter.");
    }
  };

  const handleImportJsonFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setMessage(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? "");
        if (isDirtyRef.current) {
          const ok = window.confirm(
            "Vous avez des modifications non enregistrées. Les remplacer par le contenu du fichier JSON ?",
          );
          if (!ok) return;
        }
        const next = importTemplateDraftFromJson(text);
        setDeleteModal(null);
        setDraft(next);
        setJsonImportPending(true);
        setMessage("Modèle importé depuis le fichier. Pensez à l’enregistrer si vous veux le garder sur ce serveur.");
      } catch (e: unknown) {
        setMessage(e instanceof Error ? e.message : "Import impossible.");
      }
    };
    reader.onerror = () => {
      setMessage("Impossible de lire ce fichier.");
    };
    reader.readAsText(file, "UTF-8");
  };

  const handleSendTestDiscord = async () => {
    setMessage(null);
    if (!sendTarget) {
      setMessage("Aucun salon ou fil disponible pour l’envoi.");
      return;
    }
    setSending(true);
    try {
      const result = await sendEmbedTemplateToChannel(discordGuildId, {
        channelId: sendTarget.id,
        messages: templateDraftMessagesToApiPayload(draft),
      });
      const plural = result.sent > 1 ? "messages envoyés" : "message envoyé";
      setMessage(`${result.sent} ${plural}.`);
    } catch (e: unknown) {
      const err = e as Error & { status?: number };
      if (err.message) {
        setMessage(err.message);
      } else {
        setMessage("Impossible d’envoyer. Réessayez dans un instant.");
      }
    } finally {
      setSending(false);
    }
  };

  if (loadError) {
    return (
      <div className="ui-card-muted px-6 py-10 text-center text-sm text-zinc-400">
        Impossible de charger vos modèles. Réessayez dans un instant.
      </div>
    );
  }

  if (loading && list.length === 0) {
    return <EmbedsPageSkeleton />;
  }

  return (
    <div
      className={`flex flex-col gap-6 ${showSaveMenu ? SAVE_BAR_PAGE_PADDING : ""}`}
    >
      <div className="flex flex-col gap-4">
        <div className="min-w-0 rounded-xl border border-vex-border bg-vex-surface/70 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
            <div className="min-w-0 flex-1 flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-500" htmlFor="send-destination">
                Envoyer sur Discord
              </label>
              <select
                id="send-destination"
                value={sendTargetKey}
                onChange={(e) => {
                  const v = e.target.value;
                  const i = v.indexOf(":");
                  if (i <= 0) return;
                  const kind = v.slice(0, i) as "channel" | "thread";
                  const id = v.slice(i + 1);
                  if ((kind === "channel" || kind === "thread") && id) {
                    setSendTarget({ kind, id });
                  }
                }}
                disabled={sending || (sendChannels.length === 0 && threadOptions.length === 0)}
                className="ui-input min-h-[42px]"
              >
                {sendChannels.length === 0 && threadOptions.length === 0 ? (
                  <option value="">Aucun salon ni fil (ajoutez le bot au serveur)</option>
                ) : (
                  <>
                    {sendChannels.length > 0 ? (
                      <optgroup label="Salons texte">
                        {sendChannels.map((ch) => (
                          <option key={ch.id} value={`channel:${ch.id}`}>
                            {ch.name}
                          </option>
                        ))}
                      </optgroup>
                    ) : null}
                    {threadOptions.length > 0 ? (
                      <optgroup label="Fils">
                        {threadOptions.map((th) => (
                          <option key={th.id} value={`thread:${th.id}`}>
                            {th.name}
                          </option>
                        ))}
                      </optgroup>
                    ) : null}
                  </>
                )}
              </select>
            </div>
            <button
              type="button"
              onClick={() => void handleSendTestDiscord()}
              disabled={sending || !sendTarget}
              className="ui-btn-primary shrink-0 px-4 py-2 font-medium"
            >
              {sending ? "Envoi…" : "Envoyer"}
            </button>
          </div>
        </div>

        <div className="min-w-0 rounded-xl border border-vex-border bg-vex-surface/70 p-4">
          <input
            ref={importJsonInputRef}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            tabIndex={-1}
            aria-label="Choisir un fichier JSON à importer"
            onChange={handleImportJsonFile}
          />
          <EmbedModelPicker
            templates={list}
            selectedId={selectedId}
            onSelect={selectTemplate}
            onUpdateTemplateListMeta={(id, meta) => void handleUpdateTemplateListMeta(id, meta)}
            onDeleteTemplate={openDeleteModal}
            disabled={saving || sending}
            toolbarRight={
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  title="Télécharger ce modèle au format JSON"
                  aria-label="Exporter le modèle en JSON"
                  onClick={handleExportJson}
                  disabled={saving || sending}
                  className="inline-flex items-center gap-1 rounded-md border border-zinc-600/45 bg-zinc-900/35 px-2 py-0.5 text-[11px] font-medium leading-none text-zinc-300 transition hover:border-zinc-500/60 hover:bg-zinc-800/50 hover:text-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span className="fa-solid fa-file-arrow-down text-[10px] opacity-90" aria-hidden />
                  Exporter
                </button>
                <button
                  type="button"
                  title="Charger un fichier JSON dans l’éditeur"
                  aria-label="Importer un fichier JSON"
                  onClick={() => importJsonInputRef.current?.click()}
                  disabled={saving || sending}
                  className="inline-flex items-center gap-1 rounded-md border border-zinc-600/45 bg-zinc-900/35 px-2 py-0.5 text-[11px] font-medium leading-none text-zinc-300 transition hover:border-zinc-500/60 hover:bg-zinc-800/50 hover:text-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span className="fa-solid fa-file-arrow-up text-[10px] opacity-90" aria-hidden />
                  Importer
                </button>
              </span>
            }
          />

          <ModalShell
            open={deleteModal != null}
            onClose={() => {
              if (!saving) setDeleteModal(null);
            }}
            title="Supprimer ce modèle ?"
          >
            {deleteModal ? (
              <>
                <p className="text-sm text-zinc-300">
                  Supprimer « {deleteModal.name} » ? Cette action est définitive.
                </p>
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <button type="button" onClick={() => setDeleteModal(null)} disabled={saving} className="ui-btn-secondary">
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete()}
                    disabled={saving}
                    className="rounded-lg border border-red-800/70 bg-red-900/50 px-3 py-2 text-sm font-medium text-amber-50 hover:bg-red-900/70 disabled:opacity-50"
                  >
                    Oui, supprimer
                  </button>
                </div>
              </>
            ) : null}
          </ModalShell>

          {isDirty ? (
            <p className="mt-3 text-xs text-amber-300">Modifications non enregistrées.</p>
          ) : (
            <p className="mt-3 text-xs text-zinc-500">Tout est enregistré.</p>
          )}

          <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,400px)] lg:items-start">
            <div
              ref={editorRootRef}
              className="min-w-0 space-y-4"
              onContextMenu={(event) => {
                const target = event.target as HTMLElement | null;
                if (!target) return;
                const field = target.closest("textarea, input[type='text'], input[type='url']") as TextTarget | null;
                if (!field || field.disabled || field.readOnly) return;
                event.preventDefault();
                contextTargetRef.current = {
                  el: field,
                  start: field.selectionStart ?? 0,
                  end: field.selectionEnd ?? 0,
                };
                setContextMenu({ x: event.clientX, y: event.clientY });
              }}
            >
              <DiscohookEmbedEditor draft={draft} setDraft={setDraft} />
            </div>
            <div className="space-y-4 lg:sticky lg:top-4">
              <DiscordEmbedPreview draft={draft} mentionLookup={mentionLookup} messageAuthor={messageAuthor} />
            </div>
          </div>
        </div>
      </div>

      {message ? (
        <p className="text-sm text-zinc-400" role="status">
          {message}
        </p>
      ) : null}

      <SaveChangesBar
        visible={showSaveMenu}
        saving={saving}
        onSave={() => void handleSave()}
        onDiscard={handleDiscardChanges}
      />

      {contextMenu ? (
        <div
          ref={contextMenuRef}
          className={`fixed z-[120] flex max-h-[min(22rem,calc(100vh-1rem))] flex-col overflow-hidden rounded-lg border border-vex-border bg-vex-surface shadow-2xl ${
            contextMenu.pick ? "w-[min(22rem,calc(100vw-1.5rem))]" : "w-60"
          }`}
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseDown={(event) => event.stopPropagation()}
          onWheel={(event) => event.stopPropagation()}
        >
          {contextMenu.pick ? (
            <>
              <div className="flex shrink-0 items-center gap-2 border-b border-vex-border/80 px-2 py-2">
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => setContextMenu((prev) => (prev ? { x: prev.x, y: prev.y } : null))}
                  className="rounded-md px-2 py-1 text-xs font-medium text-zinc-300 transition hover:bg-vex-bg/70 hover:text-zinc-50"
                >
                  ← Retour
                </button>
                <span className="text-xs font-medium text-zinc-400">
                  {contextMenu.pick === "channel"
                    ? "Choisir un salon"
                    : contextMenu.pick === "role"
                      ? "Choisir un rôle"
                      : contextMenu.pick === "user"
                        ? "Choisir un membre"
                        : "Insérer un lien"}
                </span>
              </div>
              {contextMenu.pick === "link" ? (
                <div className="shrink-0 space-y-2 border-b border-vex-border/60 px-2 py-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-medium uppercase tracking-wide text-zinc-500" htmlFor="ctx-link-url">
                      Adresse (URL)
                    </label>
                    <input
                      id="ctx-link-url"
                      type="text"
                      inputMode="url"
                      autoComplete="url"
                      value={linkPickUrl}
                      onChange={(e) => {
                        setLinkPickUrl(e.target.value);
                        if (linkPickError) setLinkPickError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          insertPickedLink();
                        }
                      }}
                      placeholder="https://…"
                      className="ui-input w-full py-1.5 text-sm"
                      autoFocus
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-medium uppercase tracking-wide text-zinc-500" htmlFor="ctx-link-label">
                      Texte affiché
                    </label>
                    <input
                      id="ctx-link-label"
                      type="text"
                      value={linkPickLabel}
                      onChange={(e) => setLinkPickLabel(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          insertPickedLink();
                        }
                      }}
                      placeholder="Mon lien"
                      className="ui-input w-full py-1.5 text-sm"
                    />
                  </div>
                  {linkPickError ? <p className="text-xs text-amber-200/90">{linkPickError}</p> : null}
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => insertPickedLink()}
                    className="ui-btn-primary w-full py-2 text-sm font-medium"
                  >
                    Insérer le lien
                  </button>
                </div>
              ) : (
                <div className="shrink-0 border-b border-vex-border/60 px-2 py-2">
                  <input
                    type="search"
                    value={mentionPickerFilter}
                    onChange={(e) => setMentionPickerFilter(e.target.value)}
                    placeholder={
                      contextMenu.pick === "channel"
                        ? "Rechercher un salon…"
                        : contextMenu.pick === "role"
                          ? "Rechercher un rôle…"
                          : "Pseudo ou surnom (recherche Discord)…"
                    }
                    className="ui-input w-full py-1.5 text-sm"
                    autoFocus
                  />
                </div>
              )}
              {contextMenu.pick !== "link" ? (
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain py-1">
                {contextMenu.pick === "user" ? (
                  memberPickLoading ? (
                    <p className="px-3 py-4 text-sm text-zinc-400">Chargement…</p>
                  ) : memberPickError ? (
                    <p className="px-3 py-4 text-sm text-amber-200/90">{memberPickError}</p>
                  ) : memberPickRows.length === 0 ? (
                    <p className="px-3 py-4 text-sm text-zinc-400">
                      {mentionPickerFilter.trim()
                        ? "Aucun membre ne correspond à cette recherche."
                        : "Aucun membre renvoyé. Sur un gros serveur, tape les premières lettres du pseudo pour chercher."}
                    </p>
                  ) : (
                    memberPickRows.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => insertPickedUserMention(m.id, m.displayName)}
                        className="flex w-full flex-col items-stretch gap-0.5 px-3 py-2 text-left text-sm text-zinc-100 transition hover:bg-vex-bg/70 sm:flex-row sm:items-center sm:gap-2"
                      >
                        <span className="min-w-0 flex-1 truncate font-medium" title={m.displayName}>
                          {m.displayName}
                        </span>
                        <span className="shrink-0 truncate text-[11px] text-zinc-500">@{m.username}</span>
                        <span className="shrink-0 font-mono text-[10px] text-zinc-500 sm:ml-auto">{m.id}</span>
                      </button>
                    ))
                  )
                ) : contextMenu.pick === "channel" ? (
                  mentionPickerChannels.length === 0 ? (
                    <p className="px-3 py-4 text-sm text-zinc-400">
                      {mentionMeta?.channels?.length
                        ? "Aucun salon ne correspond à votre recherche."
                        : "Aucun salon chargé. Vérifie que le bot est bien sur le serveur."}
                    </p>
                  ) : (
                    mentionPickerChannels.map((ch) => (
                      <button
                        key={ch.id}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => insertPickedChannelMention(ch.id)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-100 transition hover:bg-vex-bg/70"
                      >
                        <span className="min-w-0 flex-1 truncate" title={ch.name}>
                          #{ch.name}
                        </span>
                        <span className="shrink-0 font-mono text-[10px] text-zinc-500">{ch.id}</span>
                      </button>
                    ))
                  )
                ) : mentionPickerRoles.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-zinc-400">
                    {mentionMeta?.roles?.length
                      ? "Aucun rôle ne correspond à votre recherche."
                      : "Aucun rôle chargé. Vérifie que le bot est bien sur le serveur."}
                  </p>
                ) : (
                  mentionPickerRoles.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => insertPickedRoleMention(r.id)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-100 transition hover:bg-vex-bg/70"
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full border border-zinc-600/60"
                        style={{ backgroundColor: r.color ? `#${r.color.toString(16).padStart(6, "0")}` : "#71717a" }}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate" title={r.name}>
                        @{r.name}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] text-zinc-500">{r.id}</span>
                    </button>
                  ))
                )}
              </div>
              ) : null}
            </>
          ) : (
            <>
              <div className="shrink-0 border-b border-vex-border/80 px-3 py-2 text-xs font-medium text-zinc-400">
                Formatage du texte
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain py-1">
                {CONTEXT_FORMAT_SECTIONS.map((section, si) => (
                  <div key={section.title}>
                    {si > 0 ? <div className="my-1 h-px bg-vex-border/70" aria-hidden /> : null}
                    <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                      {section.title}
                    </p>
                    {section.items.map((action) => (
                      <button
                        key={action.id}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          if (action.id === "link") {
                            const t = contextTargetRef.current;
                            const selectedText = t ? t.el.value.slice(t.start, t.end).trim() : "";
                            setLinkPickUrl("https://");
                            setLinkPickLabel(selectedText || "Mon lien");
                            setLinkPickError(null);
                            setContextMenu((prev) => (prev ? { ...prev, pick: "link" } : null));
                            return;
                          }
                          if (action.id === "mentionChannel") {
                            setMentionPickerFilter("");
                            setContextMenu((prev) => (prev ? { ...prev, pick: "channel" } : null));
                            return;
                          }
                          if (action.id === "mentionRole") {
                            setMentionPickerFilter("");
                            setContextMenu((prev) => (prev ? { ...prev, pick: "role" } : null));
                            return;
                          }
                          if (action.id === "mentionUser") {
                            setMentionPickerFilter("");
                            setMemberPickRows([]);
                            setMemberPickError(null);
                            setContextMenu((prev) => (prev ? { ...prev, pick: "user" } : null));
                            return;
                          }
                          applyContextFormat(action.id);
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-zinc-100 transition hover:bg-vex-bg/70"
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      ) : null}

    </div>
  );
}
