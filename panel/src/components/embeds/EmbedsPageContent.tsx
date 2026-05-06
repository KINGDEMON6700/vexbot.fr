import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createEmbedTemplate,
  deleteEmbedTemplate,
  fetchEmbedTemplates,
  fetchGuildMentionMeta,
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
import type { MentionLookup } from "./DiscordRenderedText.js";

type Props = {
  discordGuildId: string;
};

const MARKDOWN_HELP_ROWS: Array<{ format: string; example: string }> = [
  { format: "Gras", example: "**texte**" },
  { format: "Italique", example: "*texte*" },
  { format: "Souligné", example: "__texte__" },
  { format: "Barré", example: "~~texte~~" },
  { format: "Code", example: "`texte`" },
  { format: "Bloc de code", example: "```js\nconsole.log('Salut')\n```" },
  { format: "Spoiler", example: "||texte caché||" },
  { format: "Citation", example: "> texte cité" },
  { format: "Lien", example: "[Mon lien](https://exemple.com)" },
  { format: "Ping salon", example: "<#ID_DU_SALON>" },
  { format: "Ping rôle", example: "<@&ID_DU_ROLE>" },
  { format: "Ping utilisateur", example: "<@ID_UTILISATEUR>" },
];

export function EmbedsPageContent({ discordGuildId }: Props) {
  const initialDraft = useMemo(() => defaultTemplateDraft(), []);
  const [list, setList] = useState<EmbedTemplate[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);

  const [selectedId, setSelectedId] = useState<string | "new" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [draft, setDraft] = useState<TemplateDraft>(initialDraft);
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(initialDraft));
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [sendChannels, setSendChannels] = useState<Array<{ id: string; name: string }>>([]);
  const [sendChannelId, setSendChannelId] = useState("");

  const [mentionMeta, setMentionMeta] = useState<Awaited<ReturnType<typeof fetchGuildMentionMeta>>>(null);
  const [messageAuthor, setMessageAuthor] = useState<MessageAuthorPreview | null>(null);

  const mentionLookup: MentionLookup = useMemo(
    () => ({
      channelNames: Object.fromEntries((mentionMeta?.channels ?? []).map((c) => [c.id, c.name])),
      roleNames: Object.fromEntries((mentionMeta?.roles ?? []).map((r) => [r.id, r.name])),
    }),
    [mentionMeta],
  );
  const isDirty = useMemo(() => JSON.stringify(draft) !== savedSnapshot, [draft, savedSnapshot]);

  const load = useCallback(async () => {
    setLoadError(false);
    setLoading(true);
    try {
      const embeds = await fetchEmbedTemplates(discordGuildId);
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
    setSendChannelId("");
    void (async () => {
      try {
        const channels = await fetchGuildTextChannels(discordGuildId);
        if (cancelled) return;
        setSendChannels(channels);
        setSendChannelId((prev) => {
          if (prev && channels.some((c) => c.id === prev)) return prev;
          return channels[0]?.id ?? "";
        });
      } catch {
        if (!cancelled) {
          setSendChannels([]);
          setSendChannelId("");
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
    return window.confirm("Tu as des modifications non enregistrées. Les ignorer et changer de modèle ?");
  };

  const applyDraftSelection = (id: string | "new" | null, nextDraft: TemplateDraft) => {
    setMessage(null);
    setConfirmDelete(false);
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
      }
    }
  }, [loading, list, selectedId]);

  const handleSave = async () => {
    setMessage(null);
    const name = draft.name.trim();
    if (!name) {
      setMessage("Donne un nom à ton modèle (en haut du formulaire).");
      return;
    }
    let payload;
    try {
      payload = templateDraftToApiPayload(draft);
    } catch (err) {
      if (err instanceof Error && err.message === "name") {
        setMessage("Donne un nom à ton modèle.");
        return;
      }
      setMessage("Pour une date fixe, choisis une date et une heure.");
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
        setMessage("C’est enregistré.");
      }
    } catch (e: unknown) {
      const err = e as Error & { status?: number; code?: string };
      if (err.status === 409) {
        setMessage("Tu as déjà un modèle avec ce nom. Choisis un autre nom.");
      } else if (err.message) {
        setMessage(err.message);
      } else {
        setMessage("Impossible d’enregistrer. Réessaie dans un instant.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (selectedId === "new" || selectedId === null) return;
    setConfirmDelete(false);
    setMessage(null);
    setSaving(true);
    try {
      const id = selectedId;
      await deleteEmbedTemplate(discordGuildId, id);
      const nextList = list.filter((e) => e.id !== id);
      setList(nextList);
      if (nextList.length === 0) {
        const nextDraft = defaultTemplateDraft();
        setSelectedId("new");
        setDraft(nextDraft);
        setSavedSnapshot(JSON.stringify(nextDraft));
      } else {
        const nextDraft = templateToDraft(nextList[0]);
        setSelectedId(nextList[0].id);
        setDraft(nextDraft);
        setSavedSnapshot(JSON.stringify(nextDraft));
      }
      setMessage("Modèle supprimé.");
    } catch {
      setMessage("Impossible de supprimer. Réessaie plus tard.");
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async () => {
    setMessage(null);
    if (!sendChannelId) {
      setMessage("Choisis un salon texte avant d’envoyer.");
      return;
    }
    setSending(true);
    try {
      const result = await sendEmbedTemplateToChannel(discordGuildId, {
        channelId: sendChannelId,
        messages: templateDraftMessagesToApiPayload(draft),
      });
      const plural = result.sent > 1 ? "messages envoyés" : "message envoyé";
      setMessage(`${result.sent} ${plural}.`);
    } catch (e: unknown) {
      const err = e as Error & { status?: number };
      if (err.message) {
        setMessage(err.message);
      } else {
        setMessage("Impossible d’envoyer. Réessaie dans un instant.");
      }
    } finally {
      setSending(false);
    }
  };

  if (loadError) {
    return (
      <div className="rounded-xl border border-vex-border bg-vex-surface/50 px-6 py-10 text-center text-sm text-zinc-400">
        Impossible de charger tes modèles. Réessaie dans un instant.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-vex-border bg-vex-surface/50 px-6 py-10 text-center text-sm text-zinc-500">
        Chargement…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch lg:justify-between lg:gap-6">
        <div className="min-w-0 flex-1 rounded-xl border border-vex-border bg-vex-surface/70 p-4">
          <EmbedModelPicker
            templates={list}
            selectedId={selectedId}
            name={draft.name}
            onNameChange={(next) => setDraft((d) => ({ ...d, name: next }))}
            onSelect={selectTemplate}
            disabled={saving || sending}
          />

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-vex-border/60 pt-4">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || sending}
              className="rounded-lg bg-vex-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
            {selectedId && selectedId !== "new" ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                disabled={saving || confirmDelete}
                className="inline-flex items-center gap-2 rounded-lg border border-red-900/50 bg-red-950/25 px-3 py-2 text-sm font-medium text-red-200/95 transition hover:bg-red-950/45 disabled:opacity-50"
              >
                <span className="fa-solid fa-trash-can text-xs" aria-hidden />
                Supprimer ce modèle
              </button>
            ) : null}
          </div>

          {confirmDelete && selectedId && selectedId !== "new" ? (
            <div className="mt-4 rounded-lg border border-red-900/55 bg-red-950/25 p-3">
              <p className="text-sm text-zinc-200">Tu confirmes ? On ne pourra pas revenir en arrière.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleDelete()}
                  disabled={saving}
                  className="rounded-lg border border-red-800/70 bg-red-900/50 px-3 py-2 text-sm font-medium text-amber-50 transition hover:bg-red-900/70 disabled:opacity-50"
                >
                  Oui, supprimer
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  disabled={saving}
                  className="rounded-lg border border-vex-border px-3 py-2 text-sm text-zinc-300 transition hover:bg-vex-bg/50 disabled:opacity-50"
                >
                  Annuler
                </button>
              </div>
            </div>
          ) : null}

          {isDirty ? (
            <p className="mt-3 text-xs text-amber-300">Modifications non enregistrées.</p>
          ) : (
            <p className="mt-3 text-xs text-zinc-500">Tout est enregistré.</p>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-2 rounded-xl border border-vex-border bg-vex-surface/50 p-4 lg:w-[min(100%,20rem)]">
          <span className="text-xs font-medium text-zinc-500">Tester sur Discord</span>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch lg:flex-col">
            <select
              value={sendChannelId}
              onChange={(e) => setSendChannelId(e.target.value)}
              disabled={sending || sendChannels.length === 0}
              aria-label="Salon pour l’envoi test"
              className="min-h-[42px] w-full rounded-lg border border-vex-border bg-vex-bg px-3 py-2 text-sm text-zinc-100 focus:border-vex-accent focus:outline-none focus:ring-1 focus:ring-vex-accent disabled:opacity-50"
            >
              {sendChannels.length === 0 ? (
                <option value="">Aucun salon texte</option>
              ) : (
                sendChannels.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.name}
                  </option>
                ))
              )}
            </select>
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={sending || sendChannels.length === 0 || !sendChannelId}
              className="rounded-lg border border-vex-border px-4 py-2 text-sm font-medium text-zinc-100 transition hover:bg-vex-surface disabled:opacity-50"
            >
              {sending ? "Envoi…" : "Envoyer dans ce salon"}
            </button>
          </div>
        </div>
      </div>

      {message ? (
        <p className="text-sm text-zinc-400" role="status">
          {message}
        </p>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,400px)] lg:items-start">
        <div className="min-w-0 space-y-4">
          <DiscohookEmbedEditor draft={draft} setDraft={setDraft} />
        </div>
        <div className="space-y-4 lg:sticky lg:top-4">
          <DiscordEmbedPreview draft={draft} mentionLookup={mentionLookup} messageAuthor={messageAuthor} />
          <div className="rounded-xl border border-vex-border bg-vex-surface/70 p-4">
            <p className="mb-3 text-sm font-semibold text-zinc-200">Formatage du texte</p>
            <div className="overflow-x-auto rounded-lg border border-vex-border/80">
              <table className="min-w-full border-collapse text-left text-xs text-zinc-300">
                <thead className="bg-vex-bg/50 text-zinc-400">
                  <tr>
                    <th className="border-b border-vex-border px-3 py-2 font-medium">Format</th>
                    <th className="border-b border-vex-border px-3 py-2 font-medium">Ce que tu écris</th>
                  </tr>
                </thead>
                <tbody>
                  {MARKDOWN_HELP_ROWS.map((row) => (
                    <tr key={row.format} className="odd:bg-vex-bg/20">
                      <td className="border-b border-vex-border/60 px-3 py-2 align-top">{row.format}</td>
                      <td className="border-b border-vex-border/60 px-3 py-2">
                        <code className="rounded bg-vex-bg/60 px-1.5 py-0.5 text-zinc-200">{row.example}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
