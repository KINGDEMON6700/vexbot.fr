import type {
  MessageComponentTemplate,
  ComponentRowTemplate,
  ButtonStyleTemplate,
} from "../../types/embedTemplate.js";
import { defaultMessageComponent, normalizeComponentRows } from "./embedDraft.js";

const TYPE_LABELS: Record<MessageComponentTemplate["type"], string> = {
  button: "Bouton",
  link_button: "Bouton lien",
};

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-xs font-medium text-zinc-500">{children}</label>;
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="ui-input"
    />
  );
}

type Props = {
  rows: ComponentRowTemplate[];
  onChange: (rows: ComponentRowTemplate[]) => void;
};

function updateComponent(
  rows: ComponentRowTemplate[],
  ri: number,
  ci: number,
  next: MessageComponentTemplate,
): ComponentRowTemplate[] {
  return rows.map((row, i) =>
    i === ri
      ? {
          ...row,
          components: row.components.map((c, j) => (j === ci ? next : c)),
        }
      : row,
  );
}

function removeComponent(rows: ComponentRowTemplate[], ri: number, ci: number): ComponentRowTemplate[] {
  return rows.map((row, i) =>
    i === ri ? { ...row, components: row.components.filter((_, j) => j !== ci) } : row,
  );
}

function ComponentFields({
  c,
  onPatch,
}: {
  c: MessageComponentTemplate;
  onPatch: (next: MessageComponentTemplate) => void;
}) {
  if (c.type === "button") {
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <Label>Texte du bouton</Label>
          <TextInput value={c.label} onChange={(label) => onPatch({ ...c, label })} placeholder="Libellé" />
        </div>
        <div>
          <Label>Style</Label>
          <select
            value={c.style}
            onChange={(e) => onPatch({ ...c, style: e.target.value as ButtonStyleTemplate })}
            className="ui-input mt-1"
          >
            <option value="primary">Violet (principal)</option>
            <option value="secondary">Gris</option>
            <option value="success">Vert</option>
            <option value="danger">Rouge</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <Label>Identifiant interne</Label>
          <p className="mb-1 text-[11px] text-zinc-600">Pour que le bot reconnaisse le clic (pas affiché aux membres).</p>
          <TextInput value={c.customId} onChange={(customId) => onPatch({ ...c, customId })} placeholder="ex. : ouvrir_ticket" />
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div>
        <Label>Texte</Label>
        <TextInput value={c.label} onChange={(label) => onPatch({ ...c, label })} />
      </div>
      <div>
        <Label>Lien (URL)</Label>
        <TextInput value={c.url} onChange={(url) => onPatch({ ...c, url })} placeholder="https://…" />
      </div>
    </div>
  );
}

export function MessageComponentsEditor({ rows, onChange }: Props) {
  const setRows = (next: ComponentRowTemplate[]) => onChange(normalizeComponentRows(next));

  const rowTitle = (row: ComponentRowTemplate, index: number): string => {
    const first = row.components[0];
    if (!first) return `Ligne ${index + 1}`;
    if (first.type === "link_button") {
      const txt = first.label.trim() || "sans texte";
      return `Bouton lien : ${txt}`;
    }
    return `Ligne ${index + 1}`;
  };

  const addRow = () => {
    if (rows.length >= 5) return;
    setRows([...rows, { components: [] }]);
  };

  const removeRow = (ri: number) => {
    setRows(rows.filter((_, i) => i !== ri));
  };

  const moveRow = (ri: number, dir: -1 | 1) => {
    const j = ri + dir;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[ri], next[j]] = [next[j]!, next[ri]!];
    setRows(next);
  };

  const addComponentToRow = (ri: number, kind: MessageComponentTemplate["type"]) => {
    const row = rows[ri];
    // On limite à un seul composant par ligne pour éviter les ajouts involontaires répétés.
    if (!row || row.components.length >= 1) return;
    const comp = defaultMessageComponent(kind);
    setRows(
      rows.map((r, i) => (i === ri ? { ...r, components: [...r.components, comp] } : r)),
    );
  };

  const replaceComponentType = (ri: number, ci: number, kind: MessageComponentTemplate["type"]) => {
    setRows(updateComponent(rows, ri, ci, defaultMessageComponent(kind)));
  };

  const setRowComponentType = (ri: number, value: MessageComponentTemplate["type"] | "") => {
    const row = rows[ri];
    if (!row) return;
    if (value === "") {
      // Revenir à "Choisir" vide la ligne.
      if (row.components.length > 0) {
        setRows(removeComponent(rows, ri, 0));
      }
      return;
    }
    if (row.components.length === 0) {
      addComponentToRow(ri, value);
      return;
    }
    replaceComponentType(ri, 0, value);
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm leading-relaxed text-zinc-500">
        Jusqu’à <span className="text-zinc-400">5 lignes</span> — une ligne ={" "}
        <span className="text-zinc-400">un seul bouton lien</span>.
      </p>

      {rows.map((row, ri) => (
        <details
          key={ri}
          open
          className="rounded-xl border border-vex-border bg-vex-bg/40 [&_summary::-webkit-details-marker]:hidden"
        >
          <summary className="list-none cursor-pointer">
            <div className="flex flex-wrap items-center justify-between gap-2 p-3">
              <span className="text-xs font-semibold text-zinc-400">
                {rowTitle(row, ri)}
              </span>
              <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  disabled={ri === 0}
                  onClick={() => moveRow(ri, -1)}
                  className="ui-btn-secondary rounded px-2 py-1 text-xs text-zinc-400 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={ri >= rows.length - 1}
                  onClick={() => moveRow(ri, 1)}
                  className="ui-btn-secondary rounded px-2 py-1 text-xs text-zinc-400 disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => removeRow(ri)}
                  className="rounded border border-vex-border px-2 py-1 text-xs text-zinc-500 hover:bg-red-950/40 hover:text-amber-200/90"
                >
                  Supprimer la ligne
                </button>
              </div>
            </div>
          </summary>

          <div className="border-t border-vex-border/70 p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="min-w-[200px] flex-1">
                <Label>Type de composants</Label>
                <select
                  value={row.components[0]?.type ?? ""}
                  onChange={(e) =>
                    setRowComponentType(ri, e.target.value as MessageComponentTemplate["type"] | "")
                  }
                  className="ui-input mt-1"
                >
                  <option value="">— Choisir —</option>
                  <option value="link_button">{TYPE_LABELS.link_button}</option>
                </select>
              </div>
            </div>

            {row.components[0] ? (
              <div className="mt-3 rounded-lg border border-vex-border/60 bg-vex-surface/50 p-3">
                {row.components[0] && row.components[0].type === "link_button" ? (
                  <ComponentFields
                    c={row.components[0]}
                    onPatch={(next) => setRows(updateComponent(rows, ri, 0, next))}
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        </details>
      ))}

      <button
        type="button"
        onClick={addRow}
        disabled={rows.length >= 5}
        className="rounded-xl border border-dashed border-vex-border bg-vex-bg/40 px-4 py-3 text-sm text-zinc-400 transition hover:border-vex-accent/40 hover:text-zinc-200 disabled:opacity-40"
      >
        + Ligne ({rows.length}/5)
      </button>
    </div>
  );
}
