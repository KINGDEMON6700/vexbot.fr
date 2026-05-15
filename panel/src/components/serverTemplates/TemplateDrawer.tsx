import { useEffect } from "react";
import type {
  ServerTemplateDetail,
  ServerTemplateSummary,
} from "../../types/serverTemplate.js";
import { DiscordServerStructurePreview } from "../marketplace/DiscordServerStructurePreview.js";

type Props = {
  open: boolean;
  summary: ServerTemplateSummary | null;
  detail: ServerTemplateDetail | null;
  detailLoading: boolean;
  detailError: string | null;
  /** Icône du serveur sélectionné si le template vient de ce même serveur. */
  previewGuildIconUrl?: string | null;
  actionBusy: boolean;
  applyBusy: boolean;
  onClose: () => void;
  onApply: () => void;
  onRename: () => void;
  onDelete: () => void;
  /** Télécharge le template au format JSON (désactivé tant que le détail n’est pas chargé). */
  onExportJson?: () => void;
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

/**
 * Drawer "in-pane" : se positionne en absolu à l'intérieur d'un conteneur parent
 * marqué `relative`. Il glisse depuis la droite et recouvre uniquement la colonne
 * principale (structure actuelle), laissant la liste de templates accessible.
 */
export function TemplateDrawer({
  open,
  summary,
  detail,
  detailLoading,
  detailError,
  previewGuildIconUrl = null,
  actionBusy,
  applyBusy,
  onClose,
  onApply,
  onRename,
  onDelete,
  onExportJson,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !actionBusy && !applyBusy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, actionBusy, applyBusy, onClose]);

  return (
    <div
      className={[
        "pointer-events-none absolute inset-0 z-30 overflow-hidden rounded-2xl",
        open ? "" : "invisible",
      ].join(" ")}
      aria-hidden={!open}
    >
      <div
        className={[
          "absolute inset-0 bg-black/45 backdrop-blur-[1px] transition-opacity duration-150",
          open ? "pointer-events-auto opacity-100" : "opacity-0",
        ].join(" ")}
        onMouseDown={() => {
          if (!actionBusy && !applyBusy) onClose();
        }}
      />
      <aside
        className={[
          "absolute inset-y-0 right-0 flex w-full flex-col overflow-hidden border-l border-vex-border bg-vex-bg shadow-2xl transition-transform duration-200",
          open ? "pointer-events-auto translate-x-0" : "translate-x-full",
        ].join(" ")}
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-drawer-title"
      >
        {summary ? (
          <>
            <header className="flex items-start justify-between gap-3 border-b border-vex-border p-4">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-zinc-500">
                  Template sélectionné
                </p>
                <h2
                  id="template-drawer-title"
                  className="mt-0.5 truncate text-base font-semibold text-zinc-100"
                >
                  {summary.name}
                </h2>
                {summary.description ? (
                  <p className="mt-1 whitespace-pre-wrap text-xs text-zinc-400">
                    {summary.description}
                  </p>
                ) : null}
                <p className="mt-1 text-[11px] text-zinc-500">
                  Sauvegardé le {formatDate(summary.createdAt)} · source :{" "}
                  {summary.sourceGuildName || "—"}
                </p>
              </div>
              <button
                type="button"
                className="shrink-0 rounded-md p-1.5 text-zinc-400 transition hover:bg-vex-surface/60 hover:text-zinc-100"
                aria-label="Fermer"
                onClick={() => onClose()}
                disabled={actionBusy || applyBusy}
              >
                <span className="fa-solid fa-xmark" aria-hidden />
              </button>
            </header>

            <div className="flex flex-wrap gap-2 border-b border-vex-border bg-vex-surface/30 p-3">
              <button
                type="button"
                className="ui-btn-primary text-sm"
                onClick={onApply}
                disabled={actionBusy || applyBusy}
              >
                <span className="fa-solid fa-play mr-2" aria-hidden />
                {applyBusy ? "Préparation…" : "Appliquer sur ce serveur"}
              </button>
              <button
                type="button"
                className="ui-btn-secondary text-sm"
                onClick={onRename}
                disabled={actionBusy || applyBusy}
              >
                <span className="fa-solid fa-pen mr-1.5" aria-hidden />
                Modifier
              </button>
              {onExportJson ? (
                <button
                  type="button"
                  className="ui-btn-secondary text-sm"
                  onClick={onExportJson}
                  disabled={
                    actionBusy || applyBusy || detailLoading || Boolean(detailError) || !detail
                  }
                  title={
                    !detail && !detailLoading
                      ? "Charge le contenu du template pour pouvoir l’exporter"
                      : undefined
                  }
                >
                  <span className="fa-solid fa-file-arrow-down mr-1.5" aria-hidden />
                  Exporter JSON
                </button>
              ) : null}
              <button
                type="button"
                className="rounded-lg border border-red-900/50 bg-red-950/25 px-3 py-1.5 text-sm text-red-200/95 transition hover:bg-red-950/45 disabled:opacity-50"
                onClick={onDelete}
                disabled={actionBusy || applyBusy}
              >
                <span className="fa-solid fa-trash mr-1.5" aria-hidden />
                Supprimer
              </button>
            </div>

            <div className="vex-scrollbar flex-1 overflow-y-auto p-4">
              {detailLoading ? (
                <p className="py-8 text-center text-sm text-zinc-500">Chargement…</p>
              ) : detailError ? (
                <p className="py-6 text-center text-sm text-amber-300/90">{detailError}</p>
              ) : detail ? (
                <DiscordServerStructurePreview
                  serverName={detail.snapshot.guildName?.trim() || detail.name}
                  iconUrl={previewGuildIconUrl}
                  categories={[]}
                  snapshot={detail.snapshot}
                />
              ) : null}
            </div>
          </>
        ) : null}
      </aside>
    </div>
  );
}
