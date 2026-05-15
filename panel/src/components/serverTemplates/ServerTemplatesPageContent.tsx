import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useGuild } from "../../contexts/GuildContext.js";
import { guildIconUrl } from "../../lib/guildIconUrl.js";
import {
  createServerTemplate,
  deleteServerTemplate,
  fetchGuildStructure,
  fetchServerTemplateDetail,
  fetchServerTemplates,
  previewServerTemplateApply,
  updateServerTemplate,
  type GuildStructureResult,
} from "../../lib/serverTemplatesApi.js";
import {
  buildServerTemplateExportPayload,
  parseServerTemplateImportFile,
} from "../../lib/serverTemplateImportExport.js";
import type {
  ServerTemplateDetail,
  ServerTemplatePreviewResult,
  ServerTemplateSnapshot,
  ServerTemplateSummary,
} from "../../types/serverTemplate.js";
import { DiscordServerStructurePreview } from "../marketplace/DiscordServerStructurePreview.js";
import { SaveServerTemplateModal } from "./SaveServerTemplateModal.js";
import { RenameServerTemplateModal } from "./RenameServerTemplateModal.js";
import { ApplyTemplatePreviewModal } from "./ApplyTemplatePreviewModal.js";
import { ApplyTemplateRunModal } from "./ApplyTemplateRunModal.js";
import { ImportServerTemplateModal } from "./ImportServerTemplateModal.js";
import { TemplateDrawer } from "./TemplateDrawer.js";

type Props = {
  discordGuildId: string;
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function snapshotSummaryLine(snapshot: ServerTemplateSnapshot): string {
  const categoriesCount = snapshot.channels.filter((c) => c.type === "category").length;
  const channelsCount = snapshot.channels.filter((c) => c.type !== "category").length;
  return `${snapshot.roles.length} rôles · ${channelsCount} salons · ${categoriesCount} catégories — « ${snapshot.guildName} »`;
}

function slugForFilename(name: string, fallback: string): string {
  const t = name
    .trim()
    .replace(/["*/:<>?\\|]+/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 48);
  return t || fallback;
}

function triggerJsonDownload(filename: string, payload: unknown) {
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function ServerTemplatesPageContent({ discordGuildId }: Props) {
  const { selectedGuild } = useGuild();

  const currentGuildIconUrl =
    selectedGuild?.icon && selectedGuild.id === discordGuildId
      ? guildIconUrl(selectedGuild.id, selectedGuild.icon, 128)
      : null;

  // Structure actuelle (cache en base)
  const [structure, setStructure] = useState<GuildStructureResult | null>(null);
  const [structureLoading, setStructureLoading] = useState(true);
  const [structureRefreshing, setStructureRefreshing] = useState(false);
  const [structureError, setStructureError] = useState<string | null>(null);

  // Liste des templates
  const [list, setList] = useState<ServerTemplateSummary[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  // Drawer (template sélectionné)
  const [drawerTemplateId, setDrawerTemplateId] = useState<string | null>(null);
  const [drawerDetail, setDrawerDetail] = useState<ServerTemplateDetail | null>(null);
  const [drawerDetailLoading, setDrawerDetailLoading] = useState(false);
  const [drawerDetailError, setDrawerDetailError] = useState<string | null>(null);

  // Modales et actions
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Apply flow
  const [applyPreview, setApplyPreview] = useState<{
    templateId: string;
    templateName: string;
    result: ServerTemplatePreviewResult;
  } | null>(null);
  const [applyPreviewLoading, setApplyPreviewLoading] = useState(false);
  const [applyPreviewError, setApplyPreviewError] = useState<string | null>(null);
  const [applyRun, setApplyRun] = useState<{ templateId: string; templateName: string } | null>(
    null,
  );

  const importFileRef = useRef<HTMLInputElement>(null);
  type ImportDraftState = {
    initialName: string;
    initialDescription: string | null;
    snapshot: ServerTemplateSnapshot;
    snapshotSummary: string;
  };
  const [importDraft, setImportDraft] = useState<ImportDraftState | null>(null);

  const loadStructure = useCallback(
    async (refresh: boolean) => {
      if (refresh) setStructureRefreshing(true);
      else setStructureLoading(true);
      setStructureError(null);
      try {
        const next = await fetchGuildStructure(discordGuildId, { refresh });
        setStructure(next);
      } catch (e) {
        setStructureError(e instanceof Error ? e.message : "Erreur de chargement.");
      } finally {
        setStructureLoading(false);
        setStructureRefreshing(false);
      }
    },
    [discordGuildId],
  );

  const loadList = useCallback(async () => {
    setListError(null);
    setListLoading(true);
    try {
      const next = await fetchServerTemplates(discordGuildId);
      setList(next);
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Erreur de chargement.");
    } finally {
      setListLoading(false);
    }
  }, [discordGuildId]);

  useEffect(() => {
    void loadStructure(false);
    void loadList();
  }, [loadStructure, loadList]);

  useEffect(() => {
    if (!drawerTemplateId) {
      setDrawerDetail(null);
      return;
    }
    let cancelled = false;
    setDrawerDetailLoading(true);
    setDrawerDetailError(null);
    void fetchServerTemplateDetail(discordGuildId, drawerTemplateId)
      .then((d) => {
        if (!cancelled) setDrawerDetail(d);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setDrawerDetail(null);
          setDrawerDetailError(e instanceof Error ? e.message : "Erreur de chargement.");
        }
      })
      .finally(() => {
        if (!cancelled) setDrawerDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [discordGuildId, drawerTemplateId]);

  const drawerSummary = useMemo(
    () => (drawerTemplateId ? list.find((t) => t.id === drawerTemplateId) ?? null : null),
    [list, drawerTemplateId],
  );

  const drawerPreviewIconUrl = useMemo(() => {
    if (!selectedGuild?.icon || selectedGuild.id !== discordGuildId) return null;
    if (!drawerDetail?.snapshot || drawerDetail.snapshot.sourceGuildId !== discordGuildId) return null;
    return guildIconUrl(selectedGuild.id, selectedGuild.icon, 128);
  }, [drawerDetail, discordGuildId, selectedGuild]);

  // « Faux » détail à partir de la structure actuelle (même forme qu’un template en base).
  const currentAsDetail: ServerTemplateDetail | null = useMemo(() => {
    if (!structure) return null;
    const categoriesCount = structure.snapshot.channels.filter((c) => c.type === "category").length;
    const channelsCount = structure.snapshot.channels.filter((c) => c.type !== "category").length;
    return {
      id: "__current",
      name: structure.snapshot.guildName || "Serveur actuel",
      description: null,
      createdByDiscordUserId: "",
      rolesCount: structure.snapshot.roles.length,
      channelsCount,
      categoriesCount,
      sourceGuildName: structure.snapshot.guildName,
      createdAt: structure.capturedAt,
      updatedAt: structure.capturedAt,
      snapshot: structure.snapshot,
    };
  }, [structure]);

  async function handleSaveSubmit(values: { name: string; description: string | null }) {
    setActionBusy(true);
    setActionMessage(null);
    try {
      const created = await createServerTemplate(discordGuildId, values);
      setSaveModalOpen(false);
      await loadList();
      setDrawerTemplateId(created.id);
      setDrawerDetail(created);
      setActionMessage("Template sauvegardé.");
    } catch (e) {
      setActionMessage(e instanceof Error ? e.message : "Échec de la sauvegarde.");
    } finally {
      setActionBusy(false);
    }
  }

  async function handleRenameSubmit(values: { name: string; description: string | null }) {
    if (!drawerTemplateId) return;
    setActionBusy(true);
    setActionMessage(null);
    try {
      await updateServerTemplate(discordGuildId, drawerTemplateId, values);
      setRenameModalOpen(false);
      await loadList();
      const refreshed = await fetchServerTemplateDetail(discordGuildId, drawerTemplateId);
      setDrawerDetail(refreshed);
      setActionMessage("Template mis à jour.");
    } catch (e) {
      setActionMessage(e instanceof Error ? e.message : "Échec de la mise à jour.");
    } finally {
      setActionBusy(false);
    }
  }

  async function handleDelete() {
    if (!drawerTemplateId) return;
    setActionBusy(true);
    setActionMessage(null);
    try {
      await deleteServerTemplate(discordGuildId, drawerTemplateId);
      setConfirmDelete(false);
      setDrawerTemplateId(null);
      setDrawerDetail(null);
      await loadList();
      setActionMessage("Template supprimé.");
    } catch (e) {
      setActionMessage(e instanceof Error ? e.message : "Échec de la suppression.");
    } finally {
      setActionBusy(false);
    }
  }

  async function openApplyPreview() {
    if (!drawerSummary) return;
    setApplyPreviewLoading(true);
    setApplyPreviewError(null);
    try {
      const result = await previewServerTemplateApply(discordGuildId, drawerSummary.id);
      setApplyPreview({
        templateId: drawerSummary.id,
        templateName: drawerSummary.name,
        result,
      });
    } catch (e) {
      setApplyPreviewError(e instanceof Error ? e.message : "Erreur lors de l’aperçu.");
    } finally {
      setApplyPreviewLoading(false);
    }
  }

  function confirmApply() {
    if (!applyPreview) return;
    setApplyRun({
      templateId: applyPreview.templateId,
      templateName: applyPreview.templateName,
    });
    setApplyPreview(null);
  }

  async function handleRunClose(didApply: boolean) {
    setApplyRun(null);
    if (didApply) {
      setActionMessage("Template appliqué. La structure du serveur a été actualisée.");
      await loadStructure(true);
    }
  }

  function handleExportDrawerJson() {
    if (!drawerDetail) return;
    const payload = buildServerTemplateExportPayload({
      name: drawerDetail.name,
      description: drawerDetail.description,
      snapshot: drawerDetail.snapshot,
    });
    triggerJsonDownload(
      `vex-template-${slugForFilename(drawerDetail.name, "template")}.json`,
      payload,
    );
  }

  function handleExportCurrentStructureJson() {
    if (!structure) return;
    const label = structure.snapshot.guildName?.trim() || "structure";
    const payload = buildServerTemplateExportPayload({
      name: label,
      description: null,
      snapshot: structure.snapshot,
    });
    triggerJsonDownload(`vex-structure-${slugForFilename(label, "serveur")}.json`, payload);
  }

  async function handleImportFileSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setActionMessage(null);
    try {
      const text = await file.text();
      const parsed = parseServerTemplateImportFile(text);
      let initialName = parsed.name.trim();
      if (initialName.length < 2) {
        initialName = parsed.snapshot.guildName?.trim() || "Import";
      }
      if (initialName.length < 2) initialName = "Import";
      setImportDraft({
        initialName,
        initialDescription: parsed.description,
        snapshot: parsed.snapshot,
        snapshotSummary: snapshotSummaryLine(parsed.snapshot),
      });
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Import impossible.");
    }
  }

  async function handleImportFromJsonSubmit(values: { name: string; description: string | null }) {
    if (!importDraft) return;
    setActionBusy(true);
    setActionMessage(null);
    try {
      const created = await createServerTemplate(discordGuildId, {
        name: values.name,
        description: values.description,
        snapshot: importDraft.snapshot,
      });
      setImportDraft(null);
      await loadList();
      setDrawerTemplateId(created.id);
      setDrawerDetail(created);
      setActionMessage("Template importé depuis le fichier JSON.");
    } catch (e) {
      setActionMessage(e instanceof Error ? e.message : "Échec de l’import.");
    } finally {
      setActionBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {actionMessage ? (
        <div className="ui-card p-3 text-sm text-zinc-300">{actionMessage}</div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Colonne principale : structure actuelle + drawer du template sélectionné en superposition */}
        <div className="relative">
          <div className="ui-card p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-vex-border pb-3">
            <div>
              <h2 className="text-base font-semibold text-zinc-100">
                <span className="fa-solid fa-server mr-2 text-zinc-500" aria-hidden />
                Structure actuelle du serveur
              </h2>
              <p className="mt-1 text-[11px] text-zinc-500">
                {structure
                  ? `Lue le ${formatDate(structure.capturedAt)} — cliquez sur Actualiser si vous as changé des choses sur Discord depuis.`
                  : "Lecture en cours…"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                className="ui-btn-secondary text-xs"
                onClick={() => void loadStructure(true)}
                disabled={structureLoading || structureRefreshing}
                title="Re-lire la structure du serveur depuis Discord"
              >
                <span
                  className={`fa-solid fa-arrows-rotate mr-1.5 ${structureRefreshing ? "animate-spin" : ""}`}
                  aria-hidden
                />
                {structureRefreshing ? "Actualisation…" : "Actualiser"}
              </button>
              <button
                type="button"
                className="ui-btn-secondary text-xs"
                onClick={() => void handleExportCurrentStructureJson()}
                disabled={!structure || structureLoading}
                title="Télécharger la structure actuelle du serveur au format JSON"
              >
                <span className="fa-solid fa-file-arrow-down mr-1.5" aria-hidden />
                Exporter JSON
              </button>
              <button
                type="button"
                className="ui-btn-primary text-sm"
                onClick={() => setSaveModalOpen(true)}
                disabled={!structure || structureLoading}
              >
                <span className="fa-solid fa-floppy-disk mr-2" aria-hidden />
                Sauvegarder en template
              </button>
            </div>
          </div>

          <div className="mt-4">
            {structureLoading ? (
              <p className="py-8 text-center text-sm text-zinc-500">
                Lecture de la structure du serveur…
              </p>
            ) : structureError ? (
              <div className="py-6 text-center text-sm text-amber-300/90">
                <p>{structureError}</p>
                <button
                  type="button"
                  className="ui-btn-secondary mt-3 text-xs"
                  onClick={() => void loadStructure(true)}
                >
                  Réessayer
                </button>
              </div>
            ) : currentAsDetail ? (
              <DiscordServerStructurePreview
                serverName={currentAsDetail.snapshot.guildName?.trim() || currentAsDetail.name}
                iconUrl={currentGuildIconUrl}
                categories={[]}
                snapshot={currentAsDetail.snapshot}
              />
            ) : null}
          </div>
          </div>

          <TemplateDrawer
            open={drawerTemplateId !== null}
            summary={drawerSummary}
            detail={drawerDetail}
            detailLoading={drawerDetailLoading}
            detailError={drawerDetailError}
            previewGuildIconUrl={drawerPreviewIconUrl}
            actionBusy={actionBusy}
            applyBusy={applyPreviewLoading}
            onClose={() => setDrawerTemplateId(null)}
            onApply={() => void openApplyPreview()}
            onRename={() => setRenameModalOpen(true)}
            onDelete={() => setConfirmDelete(true)}
            onExportJson={handleExportDrawerJson}
          />
        </div>

        {/* Colonne droite : liste des templates */}
        <aside className="ui-card flex h-fit flex-col p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-200">Mes templates</h3>
            {list.length > 0 ? (
              <span className="text-[11px] text-zinc-500">{list.length}</span>
            ) : null}
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">
            Cliquez sur un template pour l’ouvrir ; recliquez sur le même pour le fermer.
          </p>

          <input
            ref={importFileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => void handleImportFileSelected(e)}
          />
          <button
            type="button"
            className="ui-btn-secondary mt-3 w-full text-xs"
            onClick={() => importFileRef.current?.click()}
          >
            <span className="fa-solid fa-file-import mr-1.5" aria-hidden />
            Importer un fichier JSON
          </button>

          <div className="vex-scrollbar mt-3 max-h-[480px] space-y-1.5 overflow-y-auto pr-1">
            {listLoading ? (
              <p className="px-2 py-3 text-center text-xs text-zinc-500">Chargement…</p>
            ) : listError ? (
              <p className="px-2 py-3 text-center text-xs text-amber-300/90">{listError}</p>
            ) : list.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-zinc-500">
                Aucun template pour l’instant.
              </p>
            ) : (
              list.map((t) => {
                const active = t.id === drawerTemplateId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() =>
                      setDrawerTemplateId((cur) => (cur === t.id ? null : t.id))
                    }
                    className={[
                      "w-full rounded-md border px-2.5 py-2 text-left transition",
                      active
                        ? "border-vex-accent/70 bg-vex-accent/10 text-zinc-100"
                        : "border-vex-border/50 bg-vex-bg/30 text-zinc-300 hover:border-vex-border hover:bg-vex-bg/50",
                    ].join(" ")}
                  >
                    <span className="block truncate text-sm font-medium">{t.name}</span>
                    <span className="mt-0.5 block text-[11px] text-zinc-500">
                      {t.categoriesCount} cat. · {t.channelsCount} salons · {t.rolesCount} rôles
                    </span>
                    <span className="mt-0.5 block text-[10px] text-zinc-600">
                      {formatDate(t.createdAt)}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </aside>
      </div>

      {applyPreviewError ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-4"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setApplyPreviewError(null);
          }}
        >
          <div
            className="ui-card w-full max-w-md p-5 shadow-2xl"
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-zinc-100">
              Impossible d’appliquer ce template
            </h3>
            <p className="mt-2 whitespace-pre-line text-sm text-amber-200/95">
              {applyPreviewError}
            </p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                className="ui-btn-secondary text-sm"
                onClick={() => setApplyPreviewError(null)}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {applyPreview ? (
        <ApplyTemplatePreviewModal
          templateName={applyPreview.templateName}
          plan={applyPreview.result.plan}
          busy={false}
          onCancel={() => setApplyPreview(null)}
          onConfirm={confirmApply}
        />
      ) : null}

      {applyRun ? (
        <ApplyTemplateRunModal
          discordGuildId={discordGuildId}
          templateId={applyRun.templateId}
          templateName={applyRun.templateName}
          onClose={(didApply) => void handleRunClose(didApply)}
        />
      ) : null}

      {saveModalOpen ? (
        <SaveServerTemplateModal
          busy={actionBusy}
          onCancel={() => (actionBusy ? null : setSaveModalOpen(false))}
          onSubmit={handleSaveSubmit}
        />
      ) : null}

      {importDraft ? (
        <ImportServerTemplateModal
          busy={actionBusy}
          initialName={importDraft.initialName}
          initialDescription={importDraft.initialDescription}
          snapshotSummary={importDraft.snapshotSummary}
          onCancel={() => (actionBusy ? null : setImportDraft(null))}
          onSubmit={(v) => void handleImportFromJsonSubmit(v)}
        />
      ) : null}

      {renameModalOpen && drawerSummary ? (
        <RenameServerTemplateModal
          busy={actionBusy}
          initialName={drawerSummary.name}
          initialDescription={drawerSummary.description}
          onCancel={() => (actionBusy ? null : setRenameModalOpen(false))}
          onSubmit={handleRenameSubmit}
        />
      ) : null}

      {confirmDelete && drawerSummary ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-4"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !actionBusy) setConfirmDelete(false);
          }}
        >
          <div
            className="ui-card w-full max-w-md p-5 shadow-2xl"
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-zinc-100">
              Supprimer ce template ?
            </h3>
            <p className="mt-2 text-sm text-zinc-400">
              Cette action supprime définitivement le template{" "}
              <strong>{drawerSummary.name}</strong> du panel. Le serveur Discord d’origine n’est
              pas touché.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="ui-btn-secondary text-sm"
                onClick={() => setConfirmDelete(false)}
                disabled={actionBusy}
              >
                Annuler
              </button>
              <button
                type="button"
                className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-1.5 text-sm text-red-100 transition hover:bg-red-950/60 disabled:opacity-50"
                onClick={() => void handleDelete()}
                disabled={actionBusy}
              >
                {actionBusy ? "Suppression…" : "Supprimer définitivement"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
