import { useEffect, useState } from "react";

type Props = {
  busy: boolean;
  initialName: string;
  initialDescription: string | null;
  onCancel: () => void;
  onSubmit: (values: { name: string; description: string | null }) => void;
};

export function RenameServerTemplateModal({
  busy,
  initialName,
  initialDescription,
  onCancel,
  onSubmit,
}: Props) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription ?? "");

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

  const trimmedName = name.trim();
  const trimmedDesc = description.trim();
  const hasChange =
    trimmedName !== initialName.trim() || (trimmedDesc || null) !== (initialDescription || null);
  const canSubmit = trimmedName.length >= 2 && hasChange && !busy;

  function submit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!canSubmit) return;
    onSubmit({ name: trimmedName, description: trimmedDesc || null });
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
        aria-labelledby="rename-template-title"
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <h3 id="rename-template-title" className="text-base font-semibold text-zinc-100">
          Modifier le template
        </h3>

        <label className="mt-4 block text-xs font-medium text-zinc-400">
          Nom
          <input
            type="text"
            className="ui-input mt-1.5 w-full"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            autoFocus
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
            {busy ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </form>
    </div>
  );
}
