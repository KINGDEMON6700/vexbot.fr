import { useState } from "react";

type Props = {
  busy: boolean;
  onCancel: () => void;
  onSubmit: (values: { name: string; description: string }) => Promise<void>;
};

export function CreateCustomCommandModal({ busy, onCancel, onSubmit }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const trimmed = name.trim();
  const trimmedDesc = description.trim();
  const nameValid = /^[a-z0-9][a-z0-9_-]*$/.test(trimmed) && trimmed.length <= 32;
  const descValid = trimmedDesc.length >= 1 && trimmedDesc.length <= 100;
  const canSubmit = nameValid && descValid && !busy;

  async function handleSubmit() {
    if (!canSubmit) return;
    setError(null);
    try {
      await onSubmit({ name: trimmed, description: trimmedDesc });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div
        className="ui-card w-full max-w-md p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-zinc-100">Nouvelle commande personnalisée</h3>
        <p className="mt-1 text-xs text-zinc-500">
          On commence par le nom et la description. Vous pourrez configurer la réponse juste après.
        </p>

        {error ? (
          <p className="mt-3 rounded-md border border-amber-700/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
            {error}
          </p>
        ) : null}

        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-[11px] uppercase tracking-wide text-zinc-500">Nom (sans le /)</span>
            <input
              type="text"
              className="ui-input mt-1 w-full"
              value={name}
              onChange={(e) => setName(e.target.value.toLowerCase().slice(0, 32))}
              placeholder="viking"
              maxLength={32}
              disabled={busy}
              autoFocus
            />
            {!nameValid && trimmed.length > 0 ? (
              <span className="mt-1 block text-[10px] text-amber-300/90">
                Lettres minuscules, chiffres, tiret ou underscore uniquement. 1-32 caractères.
              </span>
            ) : (
              <span className="mt-1 block text-[10px] text-zinc-500">
                Lettres minuscules, chiffres, tiret ou underscore. 1 à 32 caractères.
              </span>
            )}
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wide text-zinc-500">Description</span>
            <input
              type="text"
              className="ui-input mt-1 w-full"
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 100))}
              placeholder="Que fait cette commande ?"
              maxLength={100}
              disabled={busy}
            />
            <span className="mt-1 block text-[10px] text-zinc-500">{description.length}/100</span>
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
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
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
          >
            {busy ? "Création…" : "Créer la commande"}
          </button>
        </div>
      </div>
    </div>
  );
}
