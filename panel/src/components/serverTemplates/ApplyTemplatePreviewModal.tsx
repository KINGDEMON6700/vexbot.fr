import { useEffect } from "react";
import type {
  ApplyPlan,
  ChannelPlanItem,
  RolePlanItem,
  ServerTemplateChannelType,
} from "../../types/serverTemplate.js";

type Props = {
  templateName: string;
  plan: ApplyPlan;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

function channelTypeLabel(t: ServerTemplateChannelType): string {
  switch (t) {
    case "text":
      return "Texte";
    case "voice":
      return "Vocal";
    case "announcement":
      return "Annonces";
    case "stage":
      return "Stage";
    case "forum":
      return "Forum";
    case "media":
      return "Médias";
    case "category":
      return "Catégorie";
  }
}

function ActionBadge({ kind }: { kind: "create" | "modify" | "delete" | "skip" }) {
  const map: Record<typeof kind, { className: string; label: string }> = {
    create: {
      className: "border-emerald-500/40 bg-emerald-900/30 text-emerald-200",
      label: "Créer",
    },
    modify: {
      className: "border-amber-500/40 bg-amber-900/30 text-amber-200",
      label: "Modifier",
    },
    delete: {
      className: "border-red-500/40 bg-red-900/30 text-red-200",
      label: "Supprimer",
    },
    skip: {
      className: "border-zinc-500/30 bg-zinc-800/40 text-zinc-400",
      label: "Ignoré",
    },
  };
  const cfg = map[kind];
  return (
    <span
      className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${cfg.className}`}
    >
      {cfg.label}
    </span>
  );
}

function RoleLine({ item }: { item: RolePlanItem }) {
  if (item.kind === "create") {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5">
        <ActionBadge kind="create" />
        <span className="truncate text-xs text-zinc-200">{item.templateRole.name}</span>
        <span className="ml-auto shrink-0 text-[10px] text-zinc-500">Rôle</span>
      </div>
    );
  }
  if (item.kind === "modify") {
    return (
      <div className="flex items-start gap-2 px-2 py-1.5">
        <ActionBadge kind="modify" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-zinc-200">{item.templateRole.name}</p>
          <p className="text-[10px] text-zinc-500">{item.changes.join(", ")}</p>
        </div>
        <span className="ml-auto shrink-0 text-[10px] text-zinc-500">Rôle</span>
      </div>
    );
  }
  if (item.kind === "delete") {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5">
        <ActionBadge kind="delete" />
        <span className="truncate text-xs text-zinc-200">{item.currentRole.name}</span>
        <span className="ml-auto shrink-0 text-[10px] text-zinc-500">Rôle</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 px-2 py-1.5">
      <ActionBadge kind="skip" />
      <span className="truncate text-xs text-zinc-300">
        {item.currentRole?.name ?? item.templateRole?.name ?? "—"}
      </span>
      <span className="ml-auto shrink-0 text-[10px] text-zinc-500" title={item.reason}>
        {item.reason}
      </span>
    </div>
  );
}

function ChannelLine({ item }: { item: ChannelPlanItem }) {
  if (item.kind === "create") {
    return (
      <div className="flex items-start gap-2 px-2 py-1.5">
        <ActionBadge kind="create" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-zinc-200">{item.templateChannel.name}</p>
          {item.parentNameInTemplate ? (
            <p className="text-[10px] text-zinc-500">dans « {item.parentNameInTemplate} »</p>
          ) : null}
        </div>
        <span className="ml-auto shrink-0 text-[10px] text-zinc-500">
          {channelTypeLabel(item.templateChannel.type)}
        </span>
      </div>
    );
  }
  if (item.kind === "modify") {
    return (
      <div className="flex items-start gap-2 px-2 py-1.5">
        <ActionBadge kind="modify" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-zinc-200">{item.templateChannel.name}</p>
          <p className="text-[10px] text-zinc-500">{item.changes.join(", ")}</p>
        </div>
        <span className="ml-auto shrink-0 text-[10px] text-zinc-500">
          {channelTypeLabel(item.templateChannel.type)}
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 px-2 py-1.5">
      <ActionBadge kind="delete" />
      <span className="truncate text-xs text-zinc-200">{item.currentChannel.name}</span>
      <span className="ml-auto shrink-0 text-[10px] text-zinc-500">
        {channelTypeLabel(item.currentChannel.type)}
      </span>
    </div>
  );
}

export function ApplyTemplatePreviewModal({
  templateName,
  plan,
  busy,
  onCancel,
  onConfirm,
}: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [busy, onCancel]);

  const nothingToDo =
    plan.summary.rolesToCreate +
      plan.summary.rolesToModify +
      plan.summary.rolesToDelete +
      plan.summary.channelsToCreate +
      plan.summary.channelsToModify +
      plan.summary.channelsToDelete ===
    0;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/65 p-2 py-4 sm:p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div
        className="ui-card flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col p-4 shadow-2xl sm:max-h-[90vh] sm:p-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="apply-preview-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="border-b border-vex-border pb-3">
          <h2 id="apply-preview-title" className="text-base font-semibold text-zinc-100">
            Aperçu des changements
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Voici tout ce que le bot va faire si vous appliques le template{" "}
            <strong className="text-zinc-300">{templateName}</strong> sur ce serveur.
          </p>
        </header>

        <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
          <span className="rounded-full border border-emerald-500/40 bg-emerald-900/30 px-2 py-0.5 text-emerald-200">
            🟢 {plan.summary.rolesToCreate + plan.summary.channelsToCreate} à créer
          </span>
          <span className="rounded-full border border-amber-500/40 bg-amber-900/30 px-2 py-0.5 text-amber-200">
            🟡 {plan.summary.rolesToModify + plan.summary.channelsToModify} à modifier
          </span>
          <span className="rounded-full border border-red-500/40 bg-red-900/30 px-2 py-0.5 text-red-200">
            🔴 {plan.summary.rolesToDelete + plan.summary.channelsToDelete} à supprimer
          </span>
        </div>

        {plan.warnings.length > 0 ? (
          <ul className="mt-3 space-y-1.5 rounded-md border border-amber-500/30 bg-amber-950/30 p-3 text-xs text-amber-100/95">
            {plan.warnings.map((w, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-0.5 fa-solid fa-triangle-exclamation" aria-hidden />
                <span>{w}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-4 grid min-h-0 flex-1 gap-4 overflow-y-auto pr-1 xl:grid-cols-2">
          <section className="rounded-lg border border-vex-border/60 bg-vex-surface/30 p-2">
            <header className="px-2 pb-1.5 pt-1">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Rôles ({plan.rolesPlan.length})
              </h3>
            </header>
            <div className="space-y-1">
              {plan.rolesPlan.length === 0 ? (
                <p className="px-2 py-3 text-center text-[11px] text-zinc-500">
                  Aucun changement de rôle.
                </p>
              ) : (
                plan.rolesPlan.map((p, i) => (
                  <div key={i} className="rounded border border-vex-border/40 bg-vex-bg/30">
                    <RoleLine item={p} />
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-lg border border-vex-border/60 bg-vex-surface/30 p-2">
            <header className="px-2 pb-1.5 pt-1">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Salons &amp; catégories ({plan.channelsPlan.length})
              </h3>
            </header>
            <div className="space-y-1">
              {plan.channelsPlan.length === 0 ? (
                <p className="px-2 py-3 text-center text-[11px] text-zinc-500">
                  Aucun changement de salon.
                </p>
              ) : (
                plan.channelsPlan.map((p, i) => (
                  <div key={i} className="rounded border border-vex-border/40 bg-vex-bg/30">
                    <ChannelLine item={p} />
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <footer className="mt-4 flex flex-col-reverse justify-end gap-2 border-t border-vex-border pt-3 sm:flex-row">
          <button
            type="button"
            className="ui-btn-secondary text-sm"
            onClick={onCancel}
            disabled={busy}
          >
            Annuler
          </button>
          <button
            type="button"
            className="ui-btn-primary text-sm"
            onClick={onConfirm}
            disabled={busy || nothingToDo}
            title={nothingToDo ? "Le serveur est déjà identique au template" : undefined}
          >
            <span className="fa-solid fa-arrow-right mr-2" aria-hidden />
            Continuer
          </button>
        </footer>
      </div>
    </div>
  );
}
