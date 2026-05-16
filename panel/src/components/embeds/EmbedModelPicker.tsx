import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { EmbedTemplate } from "../../types/embedTemplate.js";
import { hexToInt, intToHex } from "./embedDraft.js";
import {
  EMBED_TEMPLATE_LIST_ICON_KEYS,
  embedTemplateListIconClass,
} from "./embedListIcons.js";

/** Teinte proposée par défaut dans le nuancier ; si elle est conservée, on enregistre null (fond = style du thème). */
const DEFAULT_LIST_BADGE_BG = 0x27272a;
const DEFAULT_LIST_BADGE_BG_HEX = intToHex(DEFAULT_LIST_BADGE_BG);

type ListMeta = {
  name: string;
  listAccentColor: number | null;
  listIconColor: number | null;
  listIconKey: string | null;
};

type Props = {
  templates: EmbedTemplate[];
  selectedId: string | "new" | null;
  onSelect: (id: string | "new" | null) => void;
  onUpdateTemplateListMeta: (id: string, meta: ListMeta) => void;
  onDeleteTemplate: (id: string) => void;
  disabled?: boolean;
  /** Actions discrètes en haut à droite, sur la ligne du titre « Modèle » (ex. import / export JSON). */
  toolbarRight?: ReactNode;
};

function badgeStyle(accent: number | null): React.CSSProperties | undefined {
  if (accent == null) return undefined;
  return { backgroundColor: intToHex(accent) };
}

function iconColorStyle(iconColor: number | null): React.CSSProperties | undefined {
  if (iconColor == null) return undefined;
  return { color: intToHex(iconColor) };
}

function iconFallbackClass(
  listAccentColor: number | null,
  listIconColor: number | null,
  variant: "trigger" | "row",
): string {
  if (listIconColor != null) return "";
  if (listAccentColor != null) return "text-white";
  return variant === "trigger" ? "text-vex-accent" : "text-zinc-400";
}

export function EmbedModelPicker({
  templates,
  selectedId,
  onSelect,
  onUpdateTemplateListMeta,
  onDeleteTemplate,
  disabled,
  toolbarRight,
}: Props) {
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColorHex, setEditColorHex] = useState(DEFAULT_LIST_BADGE_BG_HEX);
  const [editIconColorHex, setEditIconColorHex] = useState("#ffffff");
  const [editIconKey, setEditIconKey] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const triggerId = useId();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open && !editId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (editId) setEditId(null);
        else setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, editId]);

  const ariaCurrentName = selectedId ?? "sans selection";
  const selectedTemplate =
    selectedId && selectedId !== "new" ? templates.find((t) => t.id === selectedId) : undefined;
  const selectedTemplateName =
    selectedId === "new"
      ? "Nouveau modèle"
      : selectedTemplate?.name ?? "Choisir un modèle";

  const toggle = () => {
    if (disabled) return;
    setOpen((v) => !v);
  };

  const pick = (id: string | "new" | null) => {
    onSelect(id);
    setOpen(false);
  };

  const openEditModal = (id: string) => {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setOpen(false);
    setEditId(id);
    setEditName(t.name);
    setEditColorHex(t.listAccentColor != null ? intToHex(t.listAccentColor) : DEFAULT_LIST_BADGE_BG_HEX);
    setEditIconColorHex(t.listIconColor != null ? intToHex(t.listIconColor) : "#ffffff");
    setEditIconKey(t.listIconKey);
  };

  const closeEditModal = () => setEditId(null);

  const submitEditModal = () => {
    if (!editId) return;
    const name = editName.trim();
    if (!name) return;
    const bgParsed = hexToInt(editColorHex);
    const listAccentColor =
      bgParsed != null && bgParsed !== DEFAULT_LIST_BADGE_BG ? bgParsed : null;
    const iconParsed = hexToInt(editIconColorHex);
    const listIconColor: number | null = iconParsed != null ? iconParsed : null;
    onUpdateTemplateListMeta(editId, {
      name,
      listAccentColor,
      listIconColor,
      listIconKey: editIconKey,
    });
    closeEditModal();
  };

  const templateBeingEdited = editId ? templates.find((x) => x.id === editId) : undefined;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-zinc-500">Modèle</p>
        {toolbarRight ? (
          <div className="flex shrink-0 items-center gap-0.5">{toolbarRight}</div>
        ) : null}
      </div>

      <div className="relative" ref={rootRef}>
        <button
          type="button"
          id={triggerId}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-label={`Changer de modèle — actuellement : ${ariaCurrentName}`}
          disabled={disabled}
          onClick={toggle}
          className="flex w-full min-w-0 items-center gap-2 rounded-lg border border-vex-border bg-vex-bg px-3 py-2.5 text-left text-sm text-zinc-100 outline-none transition hover:bg-vex-surface/80 focus:border-vex-accent focus:ring-1 focus:ring-vex-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm ${
              selectedTemplate?.listAccentColor == null ? "bg-vex-surface" : ""
            }`}
            style={badgeStyle(selectedTemplate?.listAccentColor ?? null)}
            aria-hidden
          >
            <span
              className={`${embedTemplateListIconClass(selectedTemplate?.listIconKey)} ${iconFallbackClass(
                selectedTemplate?.listAccentColor ?? null,
                selectedTemplate?.listIconColor ?? null,
                "trigger",
              )}`}
              style={iconColorStyle(selectedTemplate?.listIconColor ?? null)}
              aria-hidden
            />
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-200">
            {selectedTemplateName}
          </span>
          <span
            className={`fa-solid fa-chevron-down shrink-0 text-xs text-zinc-500 transition ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>

        {open ? (
          <ul
            id={listboxId}
            role="listbox"
            aria-labelledby={triggerId}
            className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-vex-border bg-vex-surface py-1 shadow-xl ring-1 ring-black/20"
          >
            {templates.map((t) => {
              const isActive = t.id === selectedId;
              return (
                <li key={t.id} role="presentation">
                  <div
                    className={`flex items-center gap-2 px-3 py-2.5 text-sm transition hover:bg-vex-bg/60 ${
                      isActive ? "bg-vex-bg/50" : ""
                    }`}
                  >
                    <button
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      onClick={() => pick(t.id)}
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs ${
                          t.listAccentColor == null ? "bg-vex-bg" : ""
                        }`}
                        style={badgeStyle(t.listAccentColor)}
                      >
                        <span
                          className={`${embedTemplateListIconClass(t.listIconKey)} ${iconFallbackClass(
                            t.listAccentColor,
                            t.listIconColor,
                            "row",
                          )}`}
                          style={iconColorStyle(t.listIconColor)}
                          aria-hidden
                        />
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium text-zinc-100">{t.name}</span>
                      {isActive ? (
                        <span className="fa-solid fa-check shrink-0 text-xs text-vex-accent" aria-hidden />
                      ) : null}
                    </button>
                    <button
                      type="button"
                      className="ui-btn-secondary px-2 py-1 text-xs"
                      title="Modifier nom, couleur et icône"
                      aria-label="Modifier nom, couleur et icône"
                      onClick={() => openEditModal(t.id)}
                    >
                      <span className="fa-solid fa-pen" aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-red-900/50 bg-red-950/25 px-2 py-1 text-xs text-red-200/95 transition hover:bg-red-950/45"
                      title="Supprimer"
                      aria-label="Supprimer"
                      onClick={() => {
                        setOpen(false);
                        onDeleteTemplate(t.id);
                      }}
                    >
                      <span className="fa-solid fa-trash" aria-hidden />
                    </button>
                  </div>
                </li>
              );
            })}

            {templates.length > 0 ? (
              <li className="my-1 h-px bg-vex-border/80" role="presentation" aria-hidden />
            ) : null}

            <li role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={selectedId === "new"}
                className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition hover:bg-vex-bg/60 ${
                  selectedId === "new" ? "bg-indigo-500/10" : ""
                }`}
                onClick={() => pick("new")}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-dashed border-vex-accent/50 bg-vex-accent/10 text-vex-accent">
                  <span className="fa-solid fa-plus text-xs" aria-hidden />
                </span>
                <span className="min-w-0 flex-1 font-medium text-zinc-100">Créer un modèle vide</span>
                {selectedId === "new" ? (
                  <span className="fa-solid fa-check shrink-0 text-xs text-vex-accent" aria-hidden />
                ) : null}
              </button>
            </li>
          </ul>
        ) : null}
      </div>

      {editId && templateBeingEdited ? (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/60 p-2 py-4 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="embed-model-edit-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeEditModal();
          }}
        >
          <div
            className="w-full max-w-md rounded-xl border border-vex-border bg-vex-surface p-4 shadow-2xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2 id="embed-model-edit-title" className="text-base font-semibold text-zinc-100">
              Modifier le modèle
            </h2>
            <p className="mt-1 text-xs text-zinc-500">Ces réglages concernent uniquement la liste des modèles.</p>

            <label className="mt-4 block text-xs font-medium text-zinc-400">
              Nom
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="ui-input mt-1 w-full"
                maxLength={100}
                autoFocus
              />
            </label>

            <label className="mt-4 block text-xs font-medium text-zinc-400">
              Couleur du fond du badge
              <input
                type="color"
                value={editColorHex.startsWith("#") ? editColorHex : `#${editColorHex}`}
                onChange={(e) => setEditColorHex(e.target.value)}
                className="mt-3 h-10 w-full max-w-[8rem] cursor-pointer rounded border border-vex-border bg-vex-bg"
              />
            </label>

            <label className="mt-4 block text-xs font-medium text-zinc-400">
              Couleur de l’icône
              <input
                type="color"
                value={editIconColorHex.startsWith("#") ? editIconColorHex : `#${editIconColorHex}`}
                onChange={(e) => setEditIconColorHex(e.target.value)}
                className="mt-3 h-10 w-full max-w-[8rem] cursor-pointer rounded border border-vex-border bg-vex-bg"
              />
            </label>

            <div className="mt-4">
              <p className="text-xs font-medium text-zinc-400">Icône</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  title="Par défaut"
                  onClick={() => setEditIconKey(null)}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg border text-sm transition ${
                    editIconKey == null
                      ? "border-vex-accent bg-vex-accent/15 text-vex-accent"
                      : "border-vex-border bg-vex-bg text-zinc-400 hover:bg-vex-bg/80"
                  }`}
                >
                  <span className="fa-solid fa-file-lines" aria-hidden />
                </button>
                {EMBED_TEMPLATE_LIST_ICON_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    title={key}
                    onClick={() => setEditIconKey(key)}
                    className={`flex h-9 w-9 items-center justify-center rounded-lg border text-sm transition ${
                      editIconKey === key
                        ? "border-vex-accent bg-vex-accent/15 text-vex-accent"
                        : "border-vex-border bg-vex-bg text-zinc-400 hover:bg-vex-bg/80"
                    }`}
                  >
                    <span className={embedTemplateListIconClass(key)} aria-hidden />
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="ui-btn-secondary px-4 py-2 text-sm" onClick={closeEditModal}>
                Annuler
              </button>
              <button
                type="button"
                className="ui-btn-primary px-4 py-2 text-sm"
                onClick={submitEditModal}
                disabled={!editName.trim()}
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
