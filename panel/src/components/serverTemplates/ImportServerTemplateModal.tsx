import { useEffect, useState } from "react";

type Props = {
  busy: boolean;
  initialName: string;
  initialDescription: string | null;
  snapshotSummary: string;
  onCancel: () => void;
  onSubmit: (values: { name: string; description: string | null }) => void;
};

export function ImportServerTemplateModal({
  busy,
  initialName,
  initialDescription,
  snapshotSummary,
  onCancel,
  onSubmit,
}: Props) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription ?? "");

  useEffect(() => {
    setName(initialName);
    setDescription(initialDescription ?? "");
  }, [initialName, initialDescription]);

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

  const canSubmit = name.trim().length >= 2 && !busy;

  function submit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!canSubmit) return;
    onSubmit({ name: name.trim(), description: description.trim() || null });
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <form
        className="ui-card w-full max-w-md p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-template-title"
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <h3 id="import-template-title" className="text-base font-semibold text-zinc-100">
          Importer un template (JSON)
        </h3>
        <p className="mt-1 text-xs text-zinc-500">
          Le fichier contient une copie de la structure (rôles, salons, permissions). Vous pouvez
          ajuster le nom avant de l’enregistrer sur ce serveur.
        </p>
        <p className="mt-2 rounded-md border border-vex-border/80 bg-vex-bg/50 px-2.5 py-2 text-[11px] text-zinc-400">
          {snapshotSummary}
        </p>

        <label className="mt-4 block text-xs font-medium text-zinc-400">
          Nom du template
          <input
            type="text"
            className="ui-input mt-1.5 w-full"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            autoFocus
            placeholder="Au moins 2 caractères"
            disabled={busy}
          />
        </label>

        <label className="mt-4 block text-xs font-medium text-zinc-400">
          Description (optionnelle)
          <textarea
            className="ui-input mt-1.5 min-h-[72px] w-full resize-y"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            placeholder="À quoi sert ce template ?"
            disabled={busy}
          />
          <span className="mt-1 block text-[10px] text-zinc-600">{description.length}/500</span>
        </label>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="ui-btn-secondary text-sm"
            onClick={onCancel}
            disabled={busy}
          >
            Annuler
          </button>
          <button type="submit" className="ui-btn-primary text-sm" disabled={!canSubmit}>
            {busy ? "Import…" : "Importer"}
          </button>
        </div>
      </form>
    </div>
  );
}
