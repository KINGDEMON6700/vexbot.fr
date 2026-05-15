import { useEffect, useState } from "react";
import type { EmbedTemplate } from "../../types/embedTemplate.js";
import type { MarketplaceTemplateKind } from "../../types/marketplace.js";
import {
  createMarketplacePublication,
  deleteMarketplacePublication,
  type MarketplacePublicationDto,
  updateMarketplacePublication,
} from "../../lib/marketplaceApi.js";
import { fetchServerTemplateDetail, fetchServerTemplates } from "../../lib/serverTemplatesApi.js";
import { isServerTemplateMarketplaceSnapshot } from "../../lib/marketplaceServerLayouts.js";
import type { ServerTemplateSummary } from "../../types/serverTemplate.js";

type Props = {
  open: boolean;
  publicationToEdit: MarketplacePublicationDto | null;
  /** Serveur actif du panel (liste des templates sauvegardés). */
  discordGuildId: string;
  /** Ouverture depuis la page Templates : préremplit le type « template serveur ». */
  initialServerTemplateId: string | null;
  onClose: () => void;
  embedTemplates: EmbedTemplate[];
  embedsLoading: boolean;
  onPublished: () => void;
  onToast: (message: string) => void;
  onPublicationDeleted?: () => void;
};

export function PublishTemplateModal({
  open,
  publicationToEdit,
  discordGuildId,
  initialServerTemplateId,
  onClose,
  embedTemplates,
  embedsLoading,
  onPublished,
  onToast,
  onPublicationDeleted,
}: Props) {
  const [kind, setKind] = useState<MarketplaceTemplateKind>("embed");
  const [embedId, setEmbedId] = useState("");
  const [serverTemplateId, setServerTemplateId] = useState("");
  const [serverTemplates, setServerTemplates] = useState<ServerTemplateSummary[]>([]);
  const [serverTemplatesLoading, setServerTemplatesLoading] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const isEdit = Boolean(publicationToEdit);

  useEffect(() => {
    if (!open) return;
    if (publicationToEdit) {
      setKind(publicationToEdit.kind);
      setName(publicationToEdit.name);
      setDescription(publicationToEdit.shortDescription);
      setEmbedId(publicationToEdit.sourceEmbedTemplateId ?? "");
      setServerTemplateId(publicationToEdit.sourceServerTemplateId ?? "");
      setSubmitting(false);
      return;
    }
    setKind("embed");
    setEmbedId("");
    setServerTemplateId("");
    setName("");
    setDescription("");
    setSubmitting(false);
  }, [open, publicationToEdit]);

  useEffect(() => {
    if (!open || publicationToEdit) return;
    if (!initialServerTemplateId) return;
    setKind("server");
    setServerTemplateId(initialServerTemplateId);
  }, [open, publicationToEdit, initialServerTemplateId]);

  useEffect(() => {
    if (!open || !discordGuildId) return;
    let cancelled = false;
    setServerTemplatesLoading(true);
    void fetchServerTemplates(discordGuildId)
      .then((list) => {
        if (!cancelled) setServerTemplates(list);
      })
      .catch(() => {
        if (!cancelled) setServerTemplates([]);
      })
      .finally(() => {
        if (!cancelled) setServerTemplatesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, discordGuildId]);

  useEffect(() => {
    if (!open || kind !== "server" || !discordGuildId || !serverTemplateId.trim() || isEdit) return;
    let cancelled = false;
    void fetchServerTemplateDetail(discordGuildId, serverTemplateId)
      .then((d) => {
        if (cancelled) return;
        setName((prev) => (prev.trim() ? prev : d.name));
        setDescription((prev) => (prev.trim() ? prev : d.description ?? ""));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, kind, discordGuildId, serverTemplateId, isEdit]);

  useEffect(() => {
    if (!open || !publicationToEdit || publicationToEdit.kind !== "embed") return;
    const sid = publicationToEdit.sourceEmbedTemplateId ?? "";
    if (!sid || embedsLoading) return;
    if (embedTemplates.length === 0) return;
    if (!embedTemplates.some((t) => t.id === sid)) {
      setEmbedId("");
    }
  }, [open, publicationToEdit, embedTemplates, embedsLoading]);

  useEffect(() => {
    if (!open || !isEdit || publicationToEdit?.kind !== "server") return;
    const tid = publicationToEdit.sourceServerTemplateId ?? "";
    if (!tid || serverTemplatesLoading) return;
    if (serverTemplates.length === 0) return;
    if (!serverTemplates.some((t) => t.id === tid)) {
      setServerTemplateId("");
    }
  }, [open, isEdit, publicationToEdit, serverTemplates, serverTemplatesLoading]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const submit = async () => {
    const n = name.trim();
    const d = description.trim();
    if (!n || !d) {
      onToast("Renseigne un nom et une description.");
      return;
    }
    if (kind === "embed") {
      if (!isEdit && !embedId.trim()) {
        onToast("Choisis un modèle d’embed à publier.");
        return;
      }
      let messages = publicationToEdit?.messages as EmbedTemplate["messages"] | undefined;
      if (embedId.trim()) {
        const tmpl = embedTemplates.find((e) => e.id === embedId);
        if (!tmpl) {
          onToast("Modèle introuvable.");
          return;
        }
        messages = tmpl.messages;
      } else if (isEdit) {
        messages = publicationToEdit?.messages as EmbedTemplate["messages"] | undefined;
      }
      if (!messages?.length) {
        onToast("Choisis un modèle d’embed (ou change de modèle) : aucun contenu à enregistrer.");
        return;
      }
      setSubmitting(true);
      try {
        if (isEdit && publicationToEdit) {
          const patch: {
            name: string;
            shortDescription: string;
            messages?: typeof messages;
            sourceEmbedTemplateId?: string | null;
          } = { name: n, shortDescription: d };
          if (embedId.trim()) {
            patch.messages = messages;
            patch.sourceEmbedTemplateId = embedId;
          }
          await updateMarketplacePublication(publicationToEdit.id, patch);
          onToast("Publication mise à jour.");
        } else {
          await createMarketplacePublication({
            kind: "embed",
            name: n,
            shortDescription: d,
            messages,
            sourceEmbedTemplateId: embedId,
          });
          onToast("Template publié sur le marketplace.");
        }
        onPublished();
        onClose();
      } catch (e) {
        onToast(e instanceof Error ? e.message : "Enregistrement impossible.");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!serverTemplateId.trim()) {
      if (
        isEdit &&
        publicationToEdit?.messages &&
        isServerTemplateMarketplaceSnapshot(publicationToEdit.messages)
      ) {
        setSubmitting(true);
        try {
          await updateMarketplacePublication(publicationToEdit.id, {
            name: n,
            shortDescription: d,
          });
          onToast("Publication mise à jour.");
          onPublished();
          onClose();
        } catch (e) {
          onToast(e instanceof Error ? e.message : "Enregistrement impossible.");
        } finally {
          setSubmitting(false);
        }
        return;
      }
      onToast("Choisis un template sauvegardé dans l’onglet Templates.");
      return;
    }

    setSubmitting(true);
    try {
      const detail = await fetchServerTemplateDetail(discordGuildId, serverTemplateId);
      if (isEdit && publicationToEdit) {
        await updateMarketplacePublication(publicationToEdit.id, {
          name: n,
          shortDescription: d,
          messages: detail.snapshot,
          sourceServerTemplateId: serverTemplateId,
        });
        onToast("Publication mise à jour.");
      } else {
        await createMarketplacePublication({
          kind: "server",
          name: n,
          shortDescription: d,
          messages: detail.snapshot,
          sourceServerTemplateId: serverTemplateId,
        });
        onToast("Template de structure publié sur le marketplace.");
      }
      onPublished();
      onClose();
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePublication = async () => {
    if (!publicationToEdit) return;
    if (
      !window.confirm(
        "Supprimer cette publication ? Elle disparaîtra du marketplace pour tout le monde. Cette action est définitive.",
      )
    ) {
      return;
    }
    setDeleteBusy(true);
    try {
      await deleteMarketplacePublication(publicationToEdit.id);
      onPublished();
      onToast("Publication supprimée.");
      onPublicationDeleted?.();
      onClose();
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Suppression impossible.");
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/65 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="ui-card w-full max-w-lg p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="marketplace-publish-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="border-b border-vex-border pb-4">
          <h2 id="marketplace-publish-title" className="text-lg font-semibold text-zinc-100">
            {isEdit ? "Gérer ta publication" : "Publier un template"}
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            {isEdit
              ? "Modifie les infos ci-dessous ou supprime la publication."
              : "Renseigne les champs pour ajouter ta template à la liste du marketplace."}
          </p>
        </div>

        <div className="mt-5 flex flex-col gap-4">
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium text-zinc-300">Type</span>
            <select
              className="ui-input"
              value={kind}
              onChange={(e) => setKind(e.target.value as MarketplaceTemplateKind)}
              disabled={isEdit}
            >
              <option value="embed">Embed</option>
              <option value="server">Template de structure</option>
            </select>
          </label>

          {kind === "embed" ? (
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-zinc-300">Modèle d’embed (serveur actif)</span>
              <select
                className="ui-input"
                value={embedId}
                onChange={(e) => setEmbedId(e.target.value)}
                disabled={embedsLoading}
              >
                <option value="">
                  {embedsLoading ? "Chargement…" : isEdit ? "— Garder l’embed actuel —" : "— Choisir un modèle —"}
                </option>
                {embedTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              {embedTemplates.length === 0 && !embedsLoading ? (
                <p className="mt-1 text-xs text-zinc-500">Crée d’abord un modèle dans l’onglet Embeds.</p>
              ) : null}
            </label>
          ) : (
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-zinc-300">Template sauvegardé (page Templates)</span>
              <select
                className="ui-input"
                value={serverTemplateId}
                onChange={(e) => setServerTemplateId(e.target.value)}
                disabled={serverTemplatesLoading}
              >
                <option value="">
                  {serverTemplatesLoading
                    ? "Chargement…"
                    : isEdit
                      ? "— Garder la structure actuelle —"
                      : "— Choisir un template —"}
                </option>
                {serverTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              {serverTemplates.length === 0 && !serverTemplatesLoading ? (
                <p className="mt-1 text-xs text-zinc-500">
                  Sauvegarde d’abord un template dans l’onglet Templates.
                </p>
              ) : null}
            </label>
          )}

          <label className="block text-sm">
            <span className="mb-1.5 block font-medium text-zinc-300">Nom du template</span>
            <input
              className="ui-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex. Accueil minimal"
              maxLength={120}
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1.5 block font-medium text-zinc-300">Description</span>
            <textarea
              className="ui-input min-h-[100px] resize-y"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Décris ce que contient le template…"
              maxLength={2000}
            />
          </label>

          {isEdit && publicationToEdit ? (
            <div className="rounded-lg border border-red-500/35 bg-red-500/10 p-4">
              <p className="text-sm font-medium text-red-200">Supprimer du marketplace</p>
              <p className="mt-1 text-xs text-zinc-500">
                La fiche disparaît pour tout le monde. Les j’aime et commentaires liés à cette fiche peuvent rester pour
                l’instant.
              </p>
              <button
                type="button"
                className="ui-btn-secondary mt-3 w-full border border-red-500/50 text-sm text-red-200 hover:bg-red-500/10"
                disabled={submitting || deleteBusy}
                onClick={() => void handleDeletePublication()}
              >
                {deleteBusy ? "Suppression…" : "Supprimer définitivement"}
              </button>
            </div>
          ) : null}

          <div className="flex justify-end gap-2 border-t border-vex-border pt-4">
            <button type="button" className="ui-btn-secondary" onClick={onClose} disabled={submitting || deleteBusy}>
              Fermer
            </button>
            <button
              type="button"
              className="ui-btn-primary"
              onClick={() => void submit()}
              disabled={submitting || deleteBusy}
            >
              {submitting ? "Enregistrement…" : isEdit ? "Enregistrer" : "Publier"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
