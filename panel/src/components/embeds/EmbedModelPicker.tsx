import { useEffect, useId, useRef, useState } from "react";
import type { EmbedTemplate } from "../../types/embedTemplate.js";

type Props = {
  templates: EmbedTemplate[];
  selectedId: string | "new" | null;
  name: string;
  onNameChange: (name: string) => void;
  onSelect: (id: string | "new" | null) => void;
  disabled?: boolean;
};

export function EmbedModelPicker({
  templates,
  selectedId,
  name,
  onNameChange,
  onSelect,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const triggerId = useId();
  const nameFieldId = useId();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const nameTrimmed = name.trim();
  const ariaCurrentName = nameTrimmed || "sans nom encore";

  const toggle = () => {
    if (disabled) return;
    setOpen((v) => !v);
  };

  const pick = (id: string | "new" | null) => {
    onSelect(id);
    setOpen(false);
  };

  return (
    <div className="space-y-3">
      <div className="min-w-0 space-y-2">
        <p className="text-xs font-medium text-zinc-500">Modèle</p>
        <label htmlFor={nameFieldId} className="sr-only">
          Nom du modèle
        </label>
        <input
          id={nameFieldId}
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          disabled={disabled}
          placeholder="Ex. : Annonce bienvenue"
          autoComplete="off"
          className="w-full rounded-lg border border-vex-border bg-vex-bg px-3 py-2.5 text-base font-semibold tracking-tight text-zinc-100 placeholder:font-normal placeholder:text-zinc-600 focus:border-vex-accent focus:outline-none focus:ring-1 focus:ring-vex-accent disabled:cursor-not-allowed disabled:opacity-50"
        />
        <p className="text-xs text-zinc-500">Pour te repérer dans la liste.</p>
        {selectedId === "new" && !nameTrimmed ? (
          <p className="text-xs text-amber-300/90">Indique un nom pour pouvoir enregistrer.</p>
        ) : null}
        {selectedId === "new" && nameTrimmed ? (
          <p className="text-xs text-zinc-500">Pas encore enregistré sur le serveur.</p>
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
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-vex-surface text-vex-accent"
            aria-hidden
          >
            <span className="fa-solid fa-layer-group text-sm" />
          </span>
          <span className="min-w-0 flex-1 text-sm font-medium text-zinc-200">Changer de modèle</span>
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
                  <button
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition hover:bg-vex-bg/60 ${
                      isActive ? "bg-vex-bg/50" : ""
                    }`}
                    onClick={() => pick(t.id)}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-vex-bg text-zinc-400">
                      <span className="fa-solid fa-file-lines text-xs" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium text-zinc-100">{t.name}</span>
                    {isActive ? (
                      <span className="fa-solid fa-check shrink-0 text-xs text-vex-accent" aria-hidden />
                    ) : null}
                  </button>
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
    </div>
  );
}
