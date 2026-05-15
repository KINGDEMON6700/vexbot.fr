import { useState } from "react";

export type MultiPickerOption = {
  id: string;
  label: string;
  /** Optionnel : couleur d'accent (ex: pour les rôles). */
  color?: number | null;
};

type Props = {
  options: MultiPickerOption[];
  selectedIds: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  emptyHint?: string;
  /** Texte affiché à la place du label en l'absence de sélection (et `emptyHint` non utilisé). */
  noneLabel?: string;
  disabled?: boolean;
};

function colorToHex(c: number | null | undefined): string | null {
  if (c === null || c === undefined || c === 0) return null;
  return `#${c.toString(16).padStart(6, "0")}`;
}

/**
 * Sélecteur multiple compact : input filtre + liste cliquable de chips.
 * Quand la liste est vide, le texte `noneLabel` (fourni par l’écran) décrit l’effet (rôles vs salons, etc.).
 */
export function MultiPicker({
  options,
  selectedIds,
  onChange,
  placeholder,
  emptyHint,
  noneLabel,
  disabled,
}: Props) {
  const [query, setQuery] = useState("");
  const filtered = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  const selectedSet = new Set(selectedIds);

  function toggle(id: string) {
    if (disabled) return;
    if (selectedSet.has(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  }

  const selectedOptions = options.filter((o) => selectedSet.has(o.id));

  return (
    <div className="space-y-2">
      {selectedOptions.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selectedOptions.map((o) => {
            const hex = colorToHex(o.color);
            return (
              <button
                type="button"
                key={o.id}
                onClick={() => toggle(o.id)}
                disabled={disabled}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-vex-border/60 bg-vex-surface/60 px-2 py-0.5 text-left text-[11px] text-zinc-200 transition hover:bg-vex-surface disabled:opacity-50"
                title={disabled ? undefined : `Retirer : ${o.label}`}
              >
                {hex ? (
                  <span
                    className="inline-block h-2 w-2 shrink-0 rounded-full"
                    style={{ background: hex }}
                    aria-hidden
                  />
                ) : null}
                <span className="min-w-0 max-w-full break-words">{o.label}</span>
                <span className="fa-solid fa-xmark shrink-0 text-[9px] text-zinc-500" aria-hidden />
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-[11px] text-zinc-500">
          {noneLabel ?? "Aucune sélection — l'option par défaut s'applique."}
        </p>
      )}

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder ?? "Rechercher…"}
        className="ui-input w-full text-xs"
        disabled={disabled}
      />

      <div className="vex-scrollbar max-h-36 overflow-y-auto rounded-md border border-vex-border/40 bg-vex-bg/40 p-1">
        {filtered.length === 0 ? (
          <p className="px-2 py-2 text-center text-[11px] text-zinc-500">
            {emptyHint ?? "Aucun résultat."}
          </p>
        ) : (
          filtered.map((o) => {
            const checked = selectedSet.has(o.id);
            const hex = colorToHex(o.color);
            return (
              <label
                key={o.id}
                className={[
                  "flex min-w-0 cursor-pointer items-start gap-2 rounded-sm px-2 py-1 text-xs transition",
                  checked
                    ? "bg-vex-accent/10 text-zinc-100"
                    : "text-zinc-300 hover:bg-vex-surface/60",
                ].join(" ")}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(o.id)}
                  className="accent-vex-accent mt-0.5 shrink-0"
                  disabled={disabled}
                />
                {hex ? (
                  <span
                    className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full"
                    style={{ background: hex }}
                    aria-hidden
                  />
                ) : null}
                <span className="min-w-0 flex-1 break-words leading-snug">{o.label}</span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}
