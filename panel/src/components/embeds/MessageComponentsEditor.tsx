import type {
  MessageComponentTemplate,
  ComponentRowTemplate,
  ButtonStyleTemplate,
} from "../../types/embedTemplate.js";
import { defaultMessageComponent } from "./embedDraft.js";

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
      className="w-full rounded-lg border border-vex-border bg-vex-bg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-vex-accent focus:outline-none focus:ring-1 focus:ring-vex-accent"
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
            className="mt-1 w-full rounded-lg border border-vex-border bg-vex-bg px-3 py-2 text-sm text-zinc-100 focus:border-vex-accent focus:outline-none"
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
  const setRows = (next: ComponentRowTemplate[]) => onChange(next);

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
    if (!row || row.components.length >= 5) return;
    const comp = defaultMessageComponent(kind);
    setRows(
      rows.map((r, i) => (i === ri ? { ...r, components: [...r.components, comp] } : r)),
    );
  };

  const replaceComponentType = (ri: number, ci: number, kind: MessageComponentTemplate["type"]) => {
    setRows(updateComponent(rows, ri, ci, defaultMessageComponent(kind)));
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm leading-relaxed text-zinc-500">
        Jusqu’à <span className="text-zinc-400">5 lignes</span> de boutons. Sur chaque ligne : jusqu’à{" "}
        <span className="text-zinc-400">5 boutons</span> (classiques ou liens), comme dans Discord.
      </p>

      {rows.map((row, ri) => (
        <div key={ri} className="rounded-xl border border-vex-border bg-vex-bg/40 p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-zinc-400">
              Ligne {ri + 1} / {rows.length}
            </span>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                disabled={ri === 0}
                onClick={() => moveRow(ri, -1)}
                className="rounded border border-vex-border px-2 py-1 text-xs text-zinc-400 hover:bg-vex-surface disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                disabled={ri >= rows.length - 1}
                onClick={() => moveRow(ri, 1)}
                className="rounded border border-vex-border px-2 py-1 text-xs text-zinc-400 hover:bg-vex-surface disabled:opacity-30"
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

          {row.components.length === 0 ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="min-w-[200px] flex-1">
                <Label>Ajouter un bouton</Label>
                <select
                  defaultValue=""
                  onChange={(e) => {
                    const v = e.target.value as MessageComponentTemplate["type"] | "";
                    e.target.selectedIndex = 0;
                    if (v) addComponentToRow(ri, v);
                  }}
                  className="mt-1 w-full rounded-lg border border-vex-border bg-vex-bg px-3 py-2 text-sm text-zinc-100"
                >
                  <option value="">— Choisir —</option>
                  <option value="button">{TYPE_LABELS.button}</option>
                  <option value="link_button">{TYPE_LABELS.link_button}</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {row.components.map((comp, ci) => (
                <div key={`${ri}-${ci}-${comp.type}`} className="rounded-lg border border-vex-border/60 bg-vex-surface/50 p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-600">
                      {TYPE_LABELS[comp.type]}
                    </span>
                    <div className="flex flex-wrap gap-1">
                      <select
                        value={comp.type}
                        onChange={(e) =>
                          replaceComponentType(ri, ci, e.target.value as MessageComponentTemplate["type"])
                        }
                        className="rounded border border-vex-border bg-vex-bg px-2 py-1 text-[11px] text-zinc-300"
                      >
                        <option value="button">{TYPE_LABELS.button}</option>
                        <option value="link_button">{TYPE_LABELS.link_button}</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => setRows(removeComponent(rows, ri, ci))}
                        className="rounded border border-vex-border px-2 py-1 text-[11px] text-zinc-500 hover:bg-red-950/30"
                      >
                        Retirer
                      </button>
                    </div>
                  </div>
                  <ComponentFields
                    c={comp}
                    onPatch={(next) => setRows(updateComponent(rows, ri, ci, next))}
                  />
                </div>
              ))}

              {row.components.length < 5 ? (
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[180px] flex-1">
                    <Label>Ajouter un bouton sur cette ligne</Label>
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        const v = e.target.value as MessageComponentTemplate["type"] | "";
                        e.target.selectedIndex = 0;
                        if (v) addComponentToRow(ri, v);
                      }}
                      className="mt-1 w-full rounded-lg border border-vex-border bg-vex-bg px-3 py-2 text-sm text-zinc-100"
                    >
                      <option value="">— Choisir —</option>
                      <option value="button">{TYPE_LABELS.button}</option>
                      <option value="link_button">{TYPE_LABELS.link_button}</option>
                    </select>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
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
