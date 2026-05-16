import { useEffect, useState } from "react";

type Props = {
  busy: boolean;
  onCancel: () => void;
  onSubmit: (values: { name: string; description: string | null }) => void;
};

export function SaveServerTemplateModal({ busy, onCancel, onSubmit }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

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
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/65 p-2 py-4 sm:p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <form
        className="ui-card w-full max-w-md p-4 shadow-2xl sm:p-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-template-title"
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <h3 id="save-template-title" className="text-base font-semibold text-zinc-100">
          Sauvegarder la structure du serveur
        </h3>
        <p className="mt-1 text-xs text-zinc-500">
          Le bot va lire toutes les catégories, salons, rôles et permissions de ce serveur Discord
          puis enregistrer une copie dans le panel.
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
            placeholder="Ex. : Mon serveur communauté"
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
            placeholder="À quoi sert ce template ? Quels rôles ou salons importants ?"
            disabled={busy}
          />
          <span className="mt-1 block text-[10px] text-zinc-600">{description.length}/500</span>
        </label>

        <div className="mt-5 flex flex-col-reverse justify-end gap-2 sm:flex-row">
          <button
            type="button"
            className="ui-btn-secondary text-sm"
            onClick={onCancel}
            disabled={busy}
          >
            Annuler
          </button>
          <button type="submit" className="ui-btn-primary text-sm" disabled={!canSubmit}>
            {busy ? "Sauvegarde…" : "Sauvegarder"}
          </button>
        </div>
      </form>
    </div>
  );
}
