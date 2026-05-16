import { useEffect, useRef, useState } from "react";
import type { NativeCommandSetting } from "../../types/commands.js";
import type { GuildMentionMeta } from "../../types/guildMeta.js";
import { MultiPicker, type MultiPickerOption } from "./MultiPicker.js";

type Props = {
  command: NativeCommandSetting;
  meta: GuildMentionMeta | null;
  onChange: (next: Partial<Pick<NativeCommandSetting, "enabled" | "allowedRoleIds" | "allowedChannelIds">>) => Promise<void>;
  /** Réinitialise le brouillon des restrictions (barre « Ne pas enregistrer » globale). */
  discardSignal?: number;
  onPermissionsDirty?: (
    dirty: boolean,
    payload: { enabled: boolean; allowedRoleIds: string[]; allowedChannelIds: string[] } | null,
  ) => void;
};

function sameIds(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  return a.every((id, i) => id === b[i]);
}

export function NativeCommandCard({ command, meta, onChange, discardSignal = 0, onPermissionsDirty }: Props) {
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [draftEnabled, setDraftEnabled] = useState(command.enabled);
  const [draftRoles, setDraftRoles] = useState<string[]>(command.allowedRoleIds);
  const [draftChannels, setDraftChannels] = useState<string[]>(command.allowedChannelIds);
  const isDirty =
    draftEnabled !== command.enabled ||
    !sameIds(draftRoles, command.allowedRoleIds) ||
    !sameIds(draftChannels, command.allowedChannelIds);

  useEffect(() => {
    setDraftEnabled(command.enabled);
    setDraftRoles(command.allowedRoleIds);
    setDraftChannels(command.allowedChannelIds);
  }, [command.enabled, command.allowedRoleIds, command.allowedChannelIds, discardSignal]);

  useEffect(() => {
    if (!draftEnabled) setExpanded(false);
  }, [draftEnabled]);

  const onPermissionsDirtyRef = useRef(onPermissionsDirty);
  onPermissionsDirtyRef.current = onPermissionsDirty;

  useEffect(() => {
    const notify = onPermissionsDirtyRef.current;
    if (!notify) return;
    if (!isDirty) {
      notify(false, null);
      return;
    }
    notify(true, { enabled: draftEnabled, allowedRoleIds: draftRoles, allowedChannelIds: draftChannels });
  }, [draftChannels, draftEnabled, draftRoles, isDirty]);

  const roleOptions: MultiPickerOption[] = (meta?.roles ?? []).map((r) => ({
    id: r.id,
    label: r.name,
    color: r.color,
  }));
  const channelOptions: MultiPickerOption[] = (meta?.channels ?? []).map((c) => ({
    id: c.id,
    label: `# ${c.name}`,
  }));

  async function handleToggleEnabled() {
    if (busy) return;
    if (onPermissionsDirty) {
      setDraftEnabled((v) => !v);
      return;
    }
    setBusy(true);
    try {
      await onChange({ enabled: !draftEnabled });
    } finally {
      setBusy(false);
    }
  }

  async function handleSavePermissions() {
    if (busy || !isDirty) return;
    setBusy(true);
    try {
      await onChange({ enabled: draftEnabled, allowedRoleIds: draftRoles, allowedChannelIds: draftChannels });
    } finally {
      setBusy(false);
    }
  }

  function setRoles(next: string[]) {
    setDraftRoles(next);
  }
  function setChannels(next: string[]) {
    setDraftChannels(next);
  }

  return (
    <div
      className={[
        "ui-card-interactive min-w-0 overflow-hidden",
        draftEnabled ? "opacity-100" : "opacity-70",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2 p-3 sm:gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-2 sm:gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-500/25">
            <span className={`fa-solid fa-${command.icon}`} aria-hidden />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-zinc-100">
              {command.displayName}
            </h3>
            <p className="mt-1 line-clamp-3 text-xs text-zinc-400">{command.description}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center justify-end gap-2">
          <label
            className={[
              "inline-flex cursor-pointer items-center gap-2 rounded-full px-2 py-1 text-[11px] font-medium transition",
              draftEnabled
                ? "bg-emerald-500/15 text-emerald-300"
                : "bg-zinc-700/40 text-zinc-400",
              busy ? "opacity-60" : "",
            ].join(" ")}
          >
            <input
              type="checkbox"
              className="hidden"
              checked={draftEnabled}
              onChange={() => void handleToggleEnabled()}
              disabled={busy}
            />
            <span
              className={[
                "relative inline-block h-3.5 w-7 rounded-full transition",
                draftEnabled ? "bg-emerald-500/70" : "bg-zinc-600",
              ].join(" ")}
            >
              <span
                className={[
                  "absolute top-0.5 inline-block h-2.5 w-2.5 rounded-full bg-white transition",
                  draftEnabled ? "left-3.5" : "left-0.5",
                ].join(" ")}
              />
            </span>
            {draftEnabled ? "Activée" : "Désactivée"}
          </label>
        </div>
      </div>

      {draftEnabled ? (
        <div className="border-t border-vex-border/60 bg-vex-surface/20">
          <button
            type="button"
            className="flex w-full items-center justify-between px-3 py-2 text-left text-xs text-zinc-400 transition hover:bg-vex-surface/40 sm:px-4"
            onClick={() => setExpanded((v) => !v)}
          >
            <span>
              Restreindre l'accès
              {(command.allowedRoleIds.length > 0 || command.allowedChannelIds.length > 0) && !expanded ? (
                <span className="ml-2 rounded bg-vex-accent/15 px-1.5 py-0.5 text-[10px] text-vex-accent">
                  {command.allowedRoleIds.length} rôle(s), {command.allowedChannelIds.length} salon(s)
                </span>
              ) : null}
            </span>
            <span
              className={`fa-solid fa-chevron-down text-[10px] transition ${expanded ? "rotate-180" : ""}`}
              aria-hidden
            />
          </button>
          {expanded ? (
            <div className="grid gap-4 border-t border-vex-border/40 p-3 sm:p-4 md:grid-cols-2">
              <div>
                <h4 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                  Rôles autorisés
                </h4>
                <MultiPicker
                  options={roleOptions}
                  selectedIds={draftRoles}
                  onChange={setRoles}
                  placeholder="Filtrer les rôles…"
                  emptyHint="Pas de rôles trouvés."
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
                  selectedIds={draftChannels}
                  onChange={setChannels}
                  placeholder="Filtrer les salons…"
                  emptyHint="Pas de salons trouvés."
                  noneLabel="Aucun salon sélectionné — la commande fonctionne partout."
                  disabled={busy}
                />
              </div>
              {onPermissionsDirty ? (
                <p className="md:col-span-2 text-[11px] text-zinc-500">
                  Utilise la barre « Enregistrer » en bas de la page pour sauvegarder les changements.
                </p>
              ) : (
                <div className="md:col-span-2 flex justify-end">
                  <button
                    type="button"
                    className="ui-btn-primary text-xs"
                    onClick={() => void handleSavePermissions()}
                    disabled={!isDirty || busy}
                  >
                    {busy ? "Enregistrement…" : "Enregistrer les restrictions"}
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
