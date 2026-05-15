import { useEffect, useMemo, useState } from "react";
import type { CustomCommand, CustomCommandInput } from "../../types/commands.js";
import type { GuildMentionMeta } from "../../types/guildMeta.js";
import type { EmbedTemplate } from "../../types/embedTemplate.js";
import { MultiPicker, type MultiPickerOption } from "./MultiPicker.js";

type Props = {
  command: CustomCommand;
  meta: GuildMentionMeta | null;
  embedTemplates: EmbedTemplate[];
  onSave: (body: Partial<CustomCommandInput>) => Promise<void>;
  onDelete: () => Promise<void>;
};

const VARIABLE_HINTS = [
  { token: "{user}", desc: "mentionne l'utilisateur" },
  { token: "{user.name}", desc: "son pseudo" },
  { token: "{server}", desc: "nom du serveur" },
  { token: "{channel}", desc: "mentionne le salon courant" },
] as const;

function commandToSnapshot(c: CustomCommand): string {
  return JSON.stringify({
    name: c.name,
    description: c.description,
    responseType: c.responseType,
    responseText: c.responseText ?? "",
    embedId: c.embedId,
    ephemeral: c.ephemeral,
    enabled: c.enabled,
    allowedRoleIds: [...c.allowedRoleIds].sort(),
    allowedChannelIds: [...c.allowedChannelIds].sort(),
  });
}

export function CustomCommandEditor({
  command,
  meta,
  embedTemplates,
  onSave,
  onDelete,
}: Props) {
  const [name, setName] = useState(command.name);
  const [description, setDescription] = useState(command.description);
  const [responseType, setResponseType] = useState(command.responseType);
  const [responseText, setResponseText] = useState(command.responseText ?? "");
  const [embedId, setEmbedId] = useState<string | null>(command.embedId);
  const [ephemeral, setEphemeral] = useState(command.ephemeral);
  const [enabled, setEnabled] = useState(command.enabled);
  const [allowedRoleIds, setAllowedRoleIds] = useState<string[]>(command.allowedRoleIds);
  const [allowedChannelIds, setAllowedChannelIds] = useState<string[]>(command.allowedChannelIds);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState(() => commandToSnapshot(command));

  useEffect(() => {
    setName(command.name);
    setDescription(command.description);
    setResponseType(command.responseType);
    setResponseText(command.responseText ?? "");
    setEmbedId(command.embedId);
    setEphemeral(command.ephemeral);
    setEnabled(command.enabled);
    setAllowedRoleIds(command.allowedRoleIds);
    setAllowedChannelIds(command.allowedChannelIds);
    setSavedSnapshot(commandToSnapshot(command));
    setError(null);
    setConfirmDelete(false);
  }, [command.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const draftSnapshot = useMemo(
    () =>
      JSON.stringify({
        name,
        description,
        responseType,
        responseText,
        embedId,
        ephemeral,
        enabled,
        allowedRoleIds: [...allowedRoleIds].sort(),
        allowedChannelIds: [...allowedChannelIds].sort(),
      }),
    [
      name,
      description,
      responseType,
      responseText,
      embedId,
      ephemeral,
      enabled,
      allowedRoleIds,
      allowedChannelIds,
    ],
  );

  const isDirty = draftSnapshot !== savedSnapshot;

  function handleDiscardChanges() {
    try {
      const d = JSON.parse(savedSnapshot) as {
        name: string;
        description: string;
        responseType: CustomCommand["responseType"];
        responseText: string;
        embedId: string | null;
        ephemeral: boolean;
        enabled: boolean;
        allowedRoleIds: string[];
        allowedChannelIds: string[];
      };
      setName(d.name);
      setDescription(d.description);
      setResponseType(d.responseType);
      setResponseText(d.responseText ?? "");
      setEmbedId(d.embedId);
      setEphemeral(d.ephemeral);
      setEnabled(d.enabled);
      setAllowedRoleIds(d.allowedRoleIds);
      setAllowedChannelIds(d.allowedChannelIds);
    } catch {
      setName(command.name);
      setDescription(command.description);
      setResponseType(command.responseType);
      setResponseText(command.responseText ?? "");
      setEmbedId(command.embedId);
      setEphemeral(command.ephemeral);
      setEnabled(command.enabled);
      setAllowedRoleIds(command.allowedRoleIds);
      setAllowedChannelIds(command.allowedChannelIds);
      setSavedSnapshot(commandToSnapshot(command));
    }
  }

  const roleOptions: MultiPickerOption[] = (meta?.roles ?? []).map((r) => ({
    id: r.id,
    label: r.name,
    color: r.color,
  }));
  const channelOptions: MultiPickerOption[] = (meta?.channels ?? []).map((c) => ({
    id: c.id,
    label: `# ${c.name}`,
  }));

  async function handleSave() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSave({
        name,
        description,
        responseType,
        responseText: responseType === "PLAIN_TEXT" ? responseText : null,
        embedId: responseType === "EMBED_TEMPLATE" ? embedId : null,
        ephemeral,
        enabled,
        allowedRoleIds,
        allowedChannelIds,
      });
      setSavedSnapshot(draftSnapshot);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onDelete();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
      setBusy(false);
    }
  }

  return (
    <>
    <div className="space-y-4">
      {error ? (
        <div className="rounded-md border border-amber-700/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide text-zinc-500">Nom (sans le /)</span>
          <input
            type="text"
            className="ui-input mt-1 w-full"
            value={name}
            onChange={(e) => setName(e.target.value.toLowerCase().slice(0, 32))}
            placeholder="viking"
            maxLength={32}
            disabled={busy}
          />
          <span className="mt-1 block text-[10px] text-zinc-500">
            Lettres minuscules, chiffres, tiret ou underscore. 1 à 32 caractères.
          </span>
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide text-zinc-500">Description</span>
          <input
            type="text"
            className="ui-input mt-1 w-full"
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 100))}
            placeholder="Que fait cette commande ?"
            maxLength={100}
            disabled={busy}
          />
          <span className="mt-1 block text-[10px] text-zinc-500">{description.length}/100 caractères.</span>
        </label>
      </div>

      <div>
        <span className="text-[11px] uppercase tracking-wide text-zinc-500">Type de réponse</span>
        <div className="mt-1 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setResponseType("PLAIN_TEXT")}
            disabled={busy}
            className={[
              "rounded-md border px-3 py-2 text-left text-sm transition",
              responseType === "PLAIN_TEXT"
                ? "border-vex-accent/70 bg-vex-accent/10 text-zinc-100"
                : "border-vex-border bg-vex-bg/30 text-zinc-300 hover:bg-vex-bg/50",
            ].join(" ")}
          >
            <span className="block font-medium">Texte simple</span>
            <span className="block text-[11px] text-zinc-500">Une réponse écrite, avec variables.</span>
          </button>
          <button
            type="button"
            onClick={() => setResponseType("EMBED_TEMPLATE")}
            disabled={busy}
            className={[
              "rounded-md border px-3 py-2 text-left text-sm transition",
              responseType === "EMBED_TEMPLATE"
                ? "border-vex-accent/70 bg-vex-accent/10 text-zinc-100"
                : "border-vex-border bg-vex-bg/30 text-zinc-300 hover:bg-vex-bg/50",
            ].join(" ")}
          >
            <span className="block font-medium">Modèle d'embed</span>
            <span className="block text-[11px] text-zinc-500">Choisis un modèle créé dans « Embeds ».</span>
          </button>
        </div>
      </div>

      {responseType === "PLAIN_TEXT" ? (
        <div>
          <span className="text-[11px] uppercase tracking-wide text-zinc-500">Texte de réponse</span>
          <textarea
            className="ui-input mt-1 w-full font-mono text-xs"
            rows={5}
            value={responseText}
            onChange={(e) => setResponseText(e.target.value.slice(0, 2000))}
            placeholder="Vous êtes un viking, {user} !"
            maxLength={2000}
            disabled={busy}
          />
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[10px]">
            <div className="flex flex-wrap gap-1.5">
              {VARIABLE_HINTS.map((v) => (
                <button
                  type="button"
                  key={v.token}
                  onClick={() => setResponseText((cur) => `${cur}${v.token}`)}
                  className="rounded border border-vex-border/50 bg-vex-surface/40 px-1.5 py-0.5 text-zinc-400 transition hover:text-zinc-200"
                  title={v.desc}
                >
                  {v.token}
                </button>
              ))}
            </div>
            <span className="text-zinc-600">{responseText.length}/2000</span>
          </div>
        </div>
      ) : (
        <div>
          <span className="text-[11px] uppercase tracking-wide text-zinc-500">Modèle d'embed</span>
          {embedTemplates.length === 0 ? (
            <p className="mt-1 text-xs text-amber-300/90">
              Tu n'as encore aucun modèle d'embed. Crée-en un dans la page « Embeds » puis reviens ici.
            </p>
          ) : (
            <select
              className="ui-input mt-1 w-full"
              value={embedId ?? ""}
              onChange={(e) => setEmbedId(e.target.value || null)}
              disabled={busy}
            >
              <option value="">— Choisis un modèle —</option>
              {embedTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="ui-card flex cursor-pointer items-center justify-between gap-3 p-3 text-sm">
          <div>
            <span className="block font-medium text-zinc-200">Commande activée</span>
            <span className="block text-[11px] text-zinc-500">
              Si désactivée, elle disparaît de Discord.
            </span>
          </div>
          <input
            type="checkbox"
            className="accent-vex-accent"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            disabled={busy}
          />
        </label>
        <label className="ui-card flex cursor-pointer items-center justify-between gap-3 p-3 text-sm">
          <div>
            <span className="block font-medium text-zinc-200">Réponse privée</span>
            <span className="block text-[11px] text-zinc-500">
              Visible uniquement par la personne qui a tapé la commande.
            </span>
          </div>
          <input
            type="checkbox"
            className="accent-vex-accent"
            checked={ephemeral}
            onChange={(e) => setEphemeral(e.target.checked)}
            disabled={busy}
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h4 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            Rôles autorisés
          </h4>
          <MultiPicker
            options={roleOptions}
            selectedIds={allowedRoleIds}
            onChange={setAllowedRoleIds}
            placeholder="Filtrer les rôles…"
            noneLabel="Aucun rôle sélectionné — personne ne peut utiliser la commande. Ajoute au moins un rôle."
            disabled={busy}
          />
        </div>
        <div>
          <h4 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            Salons autorisés
          </h4>
          <MultiPicker
            options={channelOptions}
            selectedIds={allowedChannelIds}
            onChange={setAllowedChannelIds}
            placeholder="Filtrer les salons…"
            noneLabel="Aucun salon sélectionné — la commande fonctionne partout."
            disabled={busy}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-vex-border/60 pt-3">
        {confirmDelete ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-zinc-400">Vraiment supprimer cette commande ?</span>
            <button
              type="button"
              className="ui-btn-secondary text-xs"
              onClick={() => setConfirmDelete(false)}
              disabled={busy}
            >
              Annuler
            </button>
            <button
              type="button"
              className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-1.5 text-xs text-red-100 transition hover:bg-red-950/60 disabled:opacity-50"
              onClick={() => void handleDelete()}
              disabled={busy}
            >
              {busy ? "Suppression…" : "Confirmer la suppression"}
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="rounded-lg border border-red-900/50 bg-red-950/25 px-3 py-1.5 text-xs text-red-200/95 transition hover:bg-red-950/45 disabled:opacity-50"
            onClick={() => setConfirmDelete(true)}
            disabled={busy}
          >
            <span className="fa-solid fa-trash mr-1.5" aria-hidden />
            Supprimer
          </button>
        )}
      </div>
    </div>

      {isDirty ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
          <div className="pointer-events-auto ui-card flex items-center gap-2 px-3 py-2 shadow-xl">
            <button
              type="button"
              className="ui-btn-primary"
              onClick={() => void handleSave()}
              disabled={busy}
            >
              {busy ? "Enregistrement…" : "Enregistrer"}
            </button>
            <button
              type="button"
              className="ui-btn-secondary"
              onClick={handleDiscardChanges}
              disabled={busy}
            >
              Ne pas enregistrer
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
