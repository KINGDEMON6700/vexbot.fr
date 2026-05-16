import { useEffect, useState } from "react";
import { UiToggle } from "../ui/UiToggle.js";
import { DISCORD_TICKET_PANEL_BUTTON_SWATCHES } from "../../lib/discordTicketPanelButtonSwatches.js";
import { normalizeSelectConfigClient } from "../../lib/migrateTicketPanelSelect.js";
import type {
  DiscordTicketPanelButtonStyle,
  TicketPanelOpenConfig,
  TicketPanelOpenOption,
} from "../../types/ticket.js";

function defaultOption(): TicketPanelOpenOption {
  return {
    label: "Aide générale",
    description: "",
    requireModal: true,
    modalTitle: "Nouveau ticket",
    modalInputLabel: "Décris votre demande",
    modalInputPlaceholder: "",
    modalInputStyle: "paragraph",
  };
}

/** Alignement sur l’API (migration ancien `requireModal` global sur le menu). */
function isDiscordButtonStyle(v: unknown): v is DiscordTicketPanelButtonStyle {
  return v === "primary" || v === "secondary" || v === "success" || v === "danger";
}

export function normalizePanelOpenConfig(c: TicketPanelOpenConfig): TicketPanelOpenConfig {
  const n = normalizeSelectConfigClient(c);
  if (n.style !== "button") return n;
  if (!isDiscordButtonStyle(n.discordButtonStyle)) {
    return { ...n, discordButtonStyle: "primary" };
  }
  return n;
}

export function defaultTicketPanelOpen(): Extract<TicketPanelOpenConfig, { style: "button" }> {
  return {
    v: 1,
    style: "button",
    buttonLabel: "Ouvrir un ticket",
    discordButtonStyle: "primary",
    requireModal: false,
    modalTitle: "Ouvrir un ticket",
    modalInputLabel: "Explique votre demande",
    modalInputPlaceholder: "",
    modalInputStyle: "paragraph",
  };
}

type Props = {
  value: TicketPanelOpenConfig;
  onChange: (next: TicketPanelOpenConfig) => void;
};

export function TicketPanelOpenSection({ value, onChange }: Props) {
  const valueNorm = normalizePanelOpenConfig(value);
  const selectOptionCount = value.style === "select" ? value.options.length : 0;

  /** `true` = section développée pour l’option d’index `i`. */
  const [optionExpanded, setOptionExpanded] = useState<boolean[]>([]);
  const [buttonModalDetailsOpen, setButtonModalDetailsOpen] = useState(true);
  const [optionModalExpanded, setOptionModalExpanded] = useState<boolean[]>([]);

  useEffect(() => {
    if (value.style !== "select") return;
    const n = value.options.length;
    setOptionExpanded((prev) => {
      if (prev.length === n) return prev;
      return Array.from({ length: n }, (_, i) => prev[i] ?? true);
    });
    setOptionModalExpanded((prev) => {
      if (prev.length === n) return prev;
      return Array.from({ length: n }, (_, i) => prev[i] ?? true);
    });
  }, [value.style, selectOptionCount]);

  function setLayoutStyle(next: "button" | "select") {
    if (next === "button") {
      if (valueNorm.style === "button") return;
      const first = valueNorm.options[0];
      const rm = first?.requireModal ?? false;
      onChange({
        v: 1,
        style: "button",
        buttonLabel: "Ouvrir un ticket",
        discordButtonStyle: "primary",
        requireModal: rm,
        modalTitle: rm ? (first?.modalTitle ?? "Ouvrir un ticket") : null,
        modalInputLabel: rm ? (first?.modalInputLabel ?? "Votre demande") : null,
        modalInputPlaceholder: rm ? (first?.modalInputPlaceholder ?? "") : null,
        modalInputStyle: rm ? (first?.modalInputStyle ?? "paragraph") : "paragraph",
      });
      return;
    }
    if (valueNorm.style === "select") return;
    const rm = valueNorm.requireModal;
    onChange({
      v: 1,
      style: "select",
      selectPlaceholder: "Choisissez un type de demande",
      options: rm
        ? [
            {
              label: "Aide générale",
              description: "",
              requireModal: true,
              modalTitle: valueNorm.modalTitle ?? "Nouveau ticket",
              modalInputLabel: valueNorm.modalInputLabel ?? "Décris votre demande",
              modalInputPlaceholder: valueNorm.modalInputPlaceholder ?? "",
              modalInputStyle: valueNorm.modalInputStyle ?? "paragraph",
            },
          ]
        : [{ ...defaultOption(), requireModal: false }],
    });
  }

  function setRequireModal(next: boolean) {
    if (valueNorm.style !== "button") return;
    if (!next) {
      onChange({
        ...valueNorm,
        requireModal: false,
        modalTitle: null,
        modalInputLabel: null,
        modalInputPlaceholder: null,
        modalInputStyle: "paragraph",
      });
    } else {
      setButtonModalDetailsOpen(true);
      onChange({
        ...valueNorm,
        requireModal: true,
        modalTitle: valueNorm.modalTitle ?? "Ouvrir un ticket",
        modalInputLabel: valueNorm.modalInputLabel ?? "Explique votre demande",
        modalInputPlaceholder: valueNorm.modalInputPlaceholder ?? "",
        modalInputStyle: valueNorm.modalInputStyle ?? "paragraph",
      });
    }
  }

  function updateSelectOption(i: number, part: Partial<TicketPanelOpenOption>) {
    if (valueNorm.style !== "select") return;
    const options = valueNorm.options.map((o, j) => (j === i ? { ...o, ...part } : o));
    onChange({ ...valueNorm, options });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={
            valueNorm.style === "button" ? "ui-btn-primary text-sm" : "ui-btn-secondary text-sm"
          }
          onClick={() => setLayoutStyle("button")}
        >
          Bouton
        </button>
        <button
          type="button"
          className={
            valueNorm.style === "select" ? "ui-btn-primary text-sm" : "ui-btn-secondary text-sm"
          }
          onClick={() => setLayoutStyle("select")}
        >
          Liste
        </button>
      </div>

      {valueNorm.style === "button" ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-zinc-400">Libellé du bouton d’ouverture</span>
            <input
              className="ui-input"
              maxLength={80}
              value={valueNorm.buttonLabel}
              onChange={(e) => onChange({ ...valueNorm, buttonLabel: e.target.value })}
            />
          </label>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <span className="text-sm text-zinc-400" id="discord-ticket-btn-color-label">
              Couleur du bouton sur Discord
            </span>
            <div
              className="flex flex-wrap items-center gap-3"
              role="radiogroup"
              aria-labelledby="discord-ticket-btn-color-label"
            >
              {DISCORD_TICKET_PANEL_BUTTON_SWATCHES.map((sw) => {
                const selected = valueNorm.discordButtonStyle === sw.value;
                return (
                  <button
                    key={sw.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    title={sw.label}
                    aria-label={`${sw.label}${selected ? ", sélectionné" : ""}`}
                    onClick={() => onChange({ ...valueNorm, discordButtonStyle: sw.value })}
                    className={`h-10 w-10 shrink-0 rounded-full border-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-vex-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-vex-bg ${
                      selected
                        ? "border-zinc-100 ring-2 ring-zinc-200/90 ring-offset-2 ring-offset-vex-bg"
                        : "border-zinc-600/70 opacity-90 hover:border-zinc-400 hover:opacity-100"
                    }`}
                    style={{ backgroundColor: sw.hex }}
                  />
                );
              })}
            </div>
          </div>
          <UiToggle
            className="sm:col-span-2"
            title="Question/réponse avant ouverture"
            hint="Si activé, Discord ouvre une fenêtre pour détailler la demande avant l’ouverture du ticket. Si désactivé, le ticket s’ouvre tout de suite."
            active={valueNorm.requireModal}
            detailsExpanded={buttonModalDetailsOpen}
            onToggleDetails={() => setButtonModalDetailsOpen((v) => !v)}
            onToggle={() => setRequireModal(!valueNorm.requireModal)}
          />
          {valueNorm.requireModal && buttonModalDetailsOpen ? (
            <>
              <label className="mt-4 flex flex-col gap-1.5 text-sm sm:col-span-2">
                <span className="text-zinc-400">Titre de la fenêtre Discord (45 caractères max.)</span>
                <input
                  className="ui-input"
                  maxLength={45}
                  value={valueNorm.modalTitle ?? ""}
                  onChange={(e) => onChange({ ...valueNorm, modalTitle: e.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-zinc-400">Question au-dessus de la zone de texte</span>
                <input
                  className="ui-input"
                  maxLength={45}
                  value={valueNorm.modalInputLabel ?? ""}
                  onChange={(e) => onChange({ ...valueNorm, modalInputLabel: e.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-zinc-400">Exemple grisé dans la zone (facultatif)</span>
                <input
                  className="ui-input"
                  maxLength={100}
                  value={valueNorm.modalInputPlaceholder ?? ""}
                  onChange={(e) => onChange({ ...valueNorm, modalInputPlaceholder: e.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
                <span className="text-zinc-400">Réponse courte ou longue</span>
                <select
                  className="ui-input"
                  value={valueNorm.modalInputStyle ?? "paragraph"}
                  onChange={(e) =>
                    onChange({
                      ...valueNorm,
                      modalInputStyle: e.target.value === "short" ? "short" : "paragraph",
                    })
                  }
                >
                  <option value="short">Une seule ligne</option>
                  <option value="paragraph">Plusieurs lignes (recommandé)</option>
                </select>
              </label>
            </>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-zinc-400">Texte invitant à choisir dans la liste (grisé)</span>
            <input
              className="ui-input"
              maxLength={150}
              value={valueNorm.selectPlaceholder}
              onChange={(e) => onChange({ ...valueNorm, selectPlaceholder: e.target.value })}
            />
          </label>

          <ul className="space-y-3">
            {valueNorm.options.map((opt, i) => {
              const open = optionExpanded[i] !== false;
              return (
                <li
                  key={i}
                  className="overflow-hidden rounded-lg border border-vex-border/60 bg-vex-surface/40"
                >
                  <div className="flex flex-wrap items-stretch gap-2 border-b border-vex-border/40 p-2 sm:items-center">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-zinc-200 hover:bg-vex-bg/50"
                      aria-expanded={open}
                      onClick={() =>
                        setOptionExpanded((prev) => {
                          const next = [...prev];
                          while (next.length <= i) next.push(true);
                          next[i] = !open;
                          return next;
                        })
                      }
                    >
                      <span className="shrink-0 text-zinc-500" aria-hidden>
                        {open ? "▼" : "▶"}
                      </span>
                      <span className="min-w-0">
                        <span className="text-xs font-medium text-zinc-500">Option {i + 1}</span>
                        <span className="mt-0.5 block truncate text-sm text-zinc-200">
                          {opt.label.trim() || "Sans nom"}
                          {opt.requireModal ? (
                            <span className="ml-2 text-xs font-normal text-zinc-500">· avec saisie</span>
                          ) : (
                            <span className="ml-2 text-xs font-normal text-zinc-500">· sans saisie</span>
                          )}
                        </span>
                      </span>
                    </button>
                    {valueNorm.options.length > 1 ? (
                      <button
                        type="button"
                        className="ui-btn-secondary shrink-0 self-center px-2 py-1 text-xs text-red-200/90"
                        onClick={() => {
                          setOptionExpanded((prev) => prev.filter((_, j) => j !== i));
                          onChange({
                            ...valueNorm,
                            options: valueNorm.options.filter((_, j) => j !== i),
                          });
                        }}
                      >
                        Retirer
                      </button>
                    ) : null}
                  </div>
                  {open ? (
                    <div className="grid gap-2 p-3 sm:grid-cols-2">
                      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                        <span className="text-zinc-400">Nom visible dans la liste</span>
                        <input
                          className="ui-input"
                          maxLength={100}
                          value={opt.label}
                          onChange={(e) => updateSelectOption(i, { label: e.target.value })}
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                        <span className="text-zinc-400">Petite phrase sous le nom (facultatif)</span>
                        <input
                          className="ui-input"
                          maxLength={100}
                          value={opt.description ?? ""}
                          onChange={(e) => updateSelectOption(i, { description: e.target.value || null })}
                        />
                      </label>
                      <UiToggle
                        className="sm:col-span-2"
                        title="Question/réponse avant ouverture"
                        hint="Si activé, une fenêtre demande le détail après le choix de cette option. Si désactivé, le ticket s’ouvre tout de suite avec ce type."
                        active={opt.requireModal}
                        detailsExpanded={optionModalExpanded[i] !== false}
                        onToggleDetails={() =>
                          setOptionModalExpanded((prev) => {
                            const next = [...prev];
                            while (next.length <= i) next.push(true);
                            next[i] = next[i] === false;
                            return next;
                          })
                        }
                        onToggle={() => {
                          const nextRequireModal = !opt.requireModal;
                          if (nextRequireModal) {
                            setOptionModalExpanded((prev) => {
                              const next = [...prev];
                              while (next.length <= i) next.push(true);
                              next[i] = true;
                              return next;
                            });
                          }
                          updateSelectOption(i, { requireModal: nextRequireModal });
                        }}
                      />
                      {opt.requireModal && optionModalExpanded[i] !== false ? (
                        <>
                          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                            <span className="text-zinc-400">Titre de la fenêtre après le choix</span>
                            <input
                              className="ui-input"
                              maxLength={45}
                              value={opt.modalTitle}
                              onChange={(e) => updateSelectOption(i, { modalTitle: e.target.value })}
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-sm">
                            <span className="text-zinc-400">Question au-dessus de la zone de texte</span>
                            <input
                              className="ui-input"
                              maxLength={45}
                              value={opt.modalInputLabel}
                              onChange={(e) => updateSelectOption(i, { modalInputLabel: e.target.value })}
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-sm">
                            <span className="text-zinc-400">Exemple grisé (facultatif)</span>
                            <input
                              className="ui-input"
                              maxLength={100}
                              value={opt.modalInputPlaceholder ?? ""}
                              onChange={(e) =>
                                updateSelectOption(i, { modalInputPlaceholder: e.target.value || null })
                              }
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                            <span className="text-zinc-400">Réponse courte ou longue</span>
                            <select
                              className="ui-input"
                              value={opt.modalInputStyle}
                              onChange={(e) =>
                                updateSelectOption(i, {
                                  modalInputStyle: e.target.value === "short" ? "short" : "paragraph",
                                })
                              }
                            >
                              <option value="short">Une seule ligne</option>
                              <option value="paragraph">Plusieurs lignes (recommandé)</option>
                            </select>
                          </label>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {valueNorm.options.length < 25 ? (
            <button
              type="button"
              className="ui-btn-secondary text-sm"
              onClick={() => {
                setOptionExpanded((e) => [...e, true]);
                onChange({ ...valueNorm, options: [...valueNorm.options, defaultOption()] });
              }}
            >
              Ajouter une option au menu
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
