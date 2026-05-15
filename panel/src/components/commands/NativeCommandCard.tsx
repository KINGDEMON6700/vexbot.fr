import { useEffect, useState } from "react";
import type { NativeCommandSetting } from "../../types/commands.js";
import type { GuildMentionMeta } from "../../types/guildMeta.js";
import { MultiPicker, type MultiPickerOption } from "./MultiPicker.js";

type Props = {
  command: NativeCommandSetting;
  meta: GuildMentionMeta | null;
  onChange: (next: Partial<Pick<NativeCommandSetting, "enabled" | "allowedRoleIds" | "allowedChannelIds">>) => Promise<void>;
};

export function NativeCommandCard({ command, meta, onChange }: Props) {
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [draftRoles, setDraftRoles] = useState<string[]>(command.allowedRoleIds);
  const [draftChannels, setDraftChannels] = useState<string[]>(command.allowedChannelIds);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setDraftRoles(command.allowedRoleIds);
    setDraftChannels(command.allowedChannelIds);
    setDirty(false);
  }, [command.allowedRoleIds, command.allowedChannelIds]);

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
    setBusy(true);
    try {
      await onChange({ enabled: !command.enabled });
    } finally {
      setBusy(false);
    }
  }

  async function handleSavePermissions() {
    if (busy || !dirty) return;
    setBusy(true);
    try {
      await onChange({ allowedRoleIds: draftRoles, allowedChannelIds: draftChannels });
      setDirty(false);
    } finally {
      setBusy(false);
    }
  }

  function setRoles(next: string[]) {
    setDraftRoles(next);
    setDirty(true);
  }
  function setChannels(next: string[]) {
    setDraftChannels(next);
    setDirty(true);
  }

  return (
    <div
      className={[
        "ui-card-interactive min-w-0 overflow-hidden",
        command.enabled ? "opacity-100" : "opacity-70",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-start justify-between gap-2 p-3 sm:gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-2 sm:gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-500/25">
            <span className={`fa-solid fa-${command.icon}`} aria-hidden />
          </div>
          <div className="min-w-0">
            <h3 className="line-clamp-2 text-sm font-semibold text-zinc-100">
              {command.displayName}
            </h3>
            <p className="mt-1 line-clamp-3 text-xs text-zinc-400">{command.description}</p>
          </div>
        </div>
        <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-2 sm:w-auto sm:justify-start">
          <label
            className={[
              "inline-flex cursor-pointer items-center gap-2 rounded-full px-2 py-1 text-[11px] font-medium transition",
              command.enabled
                ? "bg-emerald-500/15 text-emerald-300"
                : "bg-zinc-700/40 text-zinc-400",
              busy ? "opacity-60" : "",
            ].join(" ")}
          >
            <input
              type="checkbox"
              className="hidden"
              checked={command.enabled}
              onChange={() => void handleToggleEnabled()}
              disabled={busy}
            />
            <span
              className={[
                "relative inline-block h-3.5 w-7 rounded-full transition",
                command.enabled ? "bg-emerald-500/70" : "bg-zinc-600",
              ].join(" ")}
            >
              <span
                className={[
                  "absolute top-0.5 inline-block h-2.5 w-2.5 rounded-full bg-white transition",
                  command.enabled ? "left-3.5" : "left-0.5",
                ].join(" ")}
              />
            </span>
            {command.enabled ? "Activée" : "Désactivée"}
          </label>
        </div>
      </div>

      {command.enabled ? (
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
              <div className="md:col-span-2 flex justify-end">
                <button
                  type="button"
                  className="ui-btn-primary text-xs"
                  onClick={() => void handleSavePermissions()}
                  disabled={!dirty || busy}
                >
                  {busy ? "Enregistrement…" : "Enregistrer les restrictions"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
