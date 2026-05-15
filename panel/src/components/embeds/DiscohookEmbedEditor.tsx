import { type Dispatch, type SetStateAction } from "react";
import {
  defaultComponentBlockDraft,
  defaultEmbedDraft,
  defaultSingleMessageDraft,
  type ComponentBlockDraft,
  type EmbedDraft,
  type SingleMessageDraft,
  type TemplateDraft,
} from "./embedDraft.js";
import { MessageComponentsEditor } from "./MessageComponentsEditor.js";

function Section({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="rounded-xl border border-vex-border bg-vex-surface/70 [&_summary::-webkit-details-marker]:hidden"
    >
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-vex-bg/30">
        {title}
      </summary>
      <div className="border-t border-vex-border/80 px-4 py-3">{children}</div>
    </details>
  );
}

/** Titre + actions sur la même ligne ; les boutons apparaissent au survol du titre (toujours visibles sur écran tactile). */
function SectionWithToolbar({
  title,
  defaultOpen,
  toolbar,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  toolbar: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="rounded-xl border border-vex-border bg-vex-surface/70 [&_summary::-webkit-details-marker]:hidden"
    >
      <summary className="group flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-vex-bg/30">
        <span className="min-w-0">{title}</span>
        <div
          className="flex shrink-0 flex-wrap gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {toolbar}
        </div>
      </summary>
      <div className="border-t border-vex-border/80 px-4 py-3">{children}</div>
    </details>
  );
}

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

type BlockProps = {
  block: EmbedDraft;
  /** Clé unique pour les boutons radio (horodatage) quand plusieurs messages / embeds. */
  radioGroupKey: string;
  updateBlock: (patch: Partial<EmbedDraft>) => void;
  setField: (fi: number, patch: Partial<EmbedDraft["fields"][0]>) => void;
  addField: () => void;
  removeField: (fi: number) => void;
};

function EmbedBlockEditor(p: BlockProps) {
  const set = (patch: Partial<EmbedDraft>) => p.updateBlock(patch);

  return (
    <div className="flex flex-col gap-3">
      <Section title="Auteur" defaultOpen>
        <div className="flex flex-col gap-3">
          <div>
            <Label>Nom</Label>
            <TextInput value={p.block.authorName} onChange={(authorName) => set({ authorName })} />
          </div>
          <div>
            <Label>Lien</Label>
            <TextInput value={p.block.authorUrl} onChange={(authorUrl) => set({ authorUrl })} placeholder="https://…" />
          </div>
          <div>
            <Label>Image (URL)</Label>
            <TextInput
              value={p.block.authorIconUrl}
              onChange={(authorIconUrl) => set({ authorIconUrl })}
              placeholder="https://…"
            />
          </div>
        </div>
      </Section>

      <Section title="Corps" defaultOpen>
        <div className="flex flex-col gap-3">
          <div>
            <Label>Titre</Label>
            <TextInput value={p.block.title} onChange={(title) => set({ title })} />
          </div>
          <div>
            <Label>Lien du titre</Label>
            <TextInput value={p.block.url} onChange={(url) => set({ url })} placeholder="https://…" />
          </div>
          <div>
            <Label>Description</Label>
            <textarea
              value={p.block.description}
              onChange={(e) => set({ description: e.target.value })}
              rows={6}
              placeholder="Texte principal…"
              className="ui-input resize-y"
            />
          </div>
        </div>
      </Section>

      <Section title="Champs">
        <div className="flex flex-col gap-3">
          <p className="text-[11px] text-zinc-600">
            Jusqu’à 25 blocs. Coche « sur la même ligne » pour les aligner comme sur Discord.
          </p>
          {p.block.fields.map((f, fi) => (
            <div key={fi} className="rounded-lg border border-vex-border/80 bg-vex-bg/40 p-3">
              <div className="mb-2 flex flex-wrap justify-between gap-2">
                <span className="text-xs text-zinc-400">Bloc {fi + 1}</span>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-400">
                  <input
                    type="checkbox"
                    checked={f.inline}
                    onChange={(e) => p.setField(fi, { inline: e.target.checked })}
                    className="rounded border-vex-border text-vex-accent"
                  />
                  Sur la même ligne
                </label>
              </div>
              <TextInput
                value={f.name}
                onChange={(name) => p.setField(fi, { name })}
                placeholder="Titre du bloc"
              />
              <textarea
                value={f.value}
                onChange={(e) => p.setField(fi, { value: e.target.value })}
                rows={3}
                className="ui-input mt-2 resize-y"
              />
              <button
                type="button"
                onClick={() => p.removeField(fi)}
                className="mt-2 text-xs text-zinc-500 hover:text-amber-200/90 hover:underline"
              >
                Retirer ce bloc
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={p.addField}
            disabled={p.block.fields.length >= 25}
            className="rounded-lg border border-dashed border-vex-border px-3 py-2 text-sm text-zinc-400 hover:border-vex-accent/50 disabled:opacity-40"
          >
            + Ajouter un champ
          </button>
        </div>
      </Section>

      <Section title="Images">
        <div className="flex flex-col gap-3">
          <div>
            <Label>Miniature</Label>
            <TextInput
              value={p.block.thumbnailUrl}
              onChange={(thumbnailUrl) => set({ thumbnailUrl })}
              placeholder="https://…"
            />
          </div>
          <div>
            <Label>Grande image</Label>
            <TextInput value={p.block.imageUrl} onChange={(imageUrl) => set({ imageUrl })} placeholder="https://…" />
          </div>
        </div>
      </Section>

      <Section title="Pied de page">
        <div className="flex flex-col gap-3">
          <div>
            <Label>Texte</Label>
            <TextInput value={p.block.footerText} onChange={(footerText) => set({ footerText })} />
          </div>
          <div>
            <Label>Icône (URL)</Label>
            <TextInput value={p.block.footerIconUrl} onChange={(footerIconUrl) => set({ footerIconUrl })} />
          </div>
        </div>
      </Section>

      <Section title="Couleur & horodatage">
        <div className="flex flex-col gap-3">
          <div>
            <Label>Couleur de la bande</Label>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <input
                type="color"
                value={p.block.colorHex.length === 7 ? p.block.colorHex : "#5865f2"}
                onChange={(e) => set({ colorHex: e.target.value })}
                className="h-10 w-14 cursor-pointer rounded border border-vex-border bg-vex-bg"
              />
              <TextInput value={p.block.colorHex} onChange={(colorHex) => set({ colorHex })} placeholder="#5865f2" />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
              <input
                type="radio"
                name={`ts-${p.radioGroupKey}`}
                checked={p.block.timestampMode === "NONE"}
                onChange={() => set({ timestampMode: "NONE" })}
                className="text-vex-accent"
              />
              Pas d’horodatage dans l’embed
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
              <input
                type="radio"
                name={`ts-${p.radioGroupKey}`}
                checked={p.block.timestampMode === "NOW"}
                onChange={() => set({ timestampMode: "NOW" })}
                className="text-vex-accent"
              />
              Heure d’envoi (dans Discord)
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
              <input
                type="radio"
                name={`ts-${p.radioGroupKey}`}
                checked={p.block.timestampMode === "FIXED"}
                onChange={() => set({ timestampMode: "FIXED" })}
                className="text-vex-accent"
              />
              Date fixe
            </label>
            {p.block.timestampMode === "FIXED" ? (
              <input
                type="datetime-local"
                value={p.block.fixedAtLocal}
                onChange={(e) => set({ fixedAtLocal: e.target.value })}
                className="ui-input max-w-xs"
              />
            ) : null}
          </div>
        </div>
      </Section>
    </div>
  );
}

type Props = {
  draft: TemplateDraft;
  setDraft: Dispatch<SetStateAction<TemplateDraft>>;
};

export function DiscohookEmbedEditor({ draft, setDraft }: Props) {

  const updateEmbed = (mi: number, ei: number, patch: Partial<EmbedDraft>) => {
    setDraft((d) => ({
      ...d,
      messages: d.messages.map((m, i) =>
        i === mi
          ? { ...m, embeds: m.embeds.map((e, j) => (j === ei ? { ...e, ...patch } : e)) }
          : m,
      ),
    }));
  };

  const setField = (mi: number, embedIndex: number, fieldIndex: number, patch: Partial<EmbedDraft["fields"][0]>) => {
    setDraft((d) => ({
      ...d,
      messages: d.messages.map((m, i) => {
        if (i !== mi) return m;
        return {
          ...m,
          embeds: m.embeds.map((e, j) => {
            if (j !== embedIndex) return e;
            const fields = [...e.fields];
            fields[fieldIndex] = { ...fields[fieldIndex]!, ...patch };
            return { ...e, fields };
          }),
        };
      }),
    }));
  };

  const addField = (mi: number, embedIndex: number) => {
    setDraft((d) => ({
      ...d,
      messages: d.messages.map((m, i) =>
        i === mi
          ? {
              ...m,
              embeds: m.embeds.map((e, j) =>
                j === embedIndex ? { ...e, fields: [...e.fields, { name: "", value: "", inline: false }] } : e,
              ),
            }
          : m,
      ),
    }));
  };

  const removeField = (mi: number, embedIndex: number, fieldIndex: number) => {
    setDraft((d) => ({
      ...d,
      messages: d.messages.map((m, i) =>
        i === mi
          ? {
              ...m,
              embeds: m.embeds.map((e, j) =>
                j === embedIndex ? { ...e, fields: e.fields.filter((_, x) => x !== fieldIndex) } : e,
              ),
            }
          : m,
      ),
    }));
  };

  const moveEmbed = (mi: number, i: number, dir: -1 | 1) => {
    setDraft((d) => {
      const msg = d.messages[mi];
      if (!msg) return d;
      const j = i + dir;
      if (j < 0 || j >= msg.embeds.length) return d;
      const nextEmbeds = [...msg.embeds];
      [nextEmbeds[i], nextEmbeds[j]] = [nextEmbeds[j]!, nextEmbeds[i]!];
      return {
        ...d,
        messages: d.messages.map((m, x) => (x === mi ? { ...m, embeds: nextEmbeds } : m)),
      };
    });
  };

  const duplicateEmbed = (mi: number, i: number) => {
    setDraft((d) => {
      const msg = d.messages[mi];
      if (!msg || msg.embeds.length >= 10) return d;
      const copy = JSON.parse(JSON.stringify(msg.embeds[i]!)) as EmbedDraft;
      const next = [...msg.embeds.slice(0, i + 1), copy, ...msg.embeds.slice(i + 1)];
      return {
        ...d,
        messages: d.messages.map((m, x) => (x === mi ? { ...m, embeds: next } : m)),
      };
    });
  };

  const removeEmbed = (mi: number, i: number) => {
    setDraft((d) => {
      const msg = d.messages[mi];
      if (!msg || msg.embeds.length <= 1) return d;
      return {
        ...d,
        messages: d.messages.map((m, x) =>
          x === mi ? { ...m, embeds: m.embeds.filter((_, j) => j !== i) } : m,
        ),
      };
    });
  };

  const addEmbed = (mi: number) => {
    setDraft((d) => {
      const msg = d.messages[mi];
      if (!msg || msg.embeds.length >= 10) return d;
      return {
        ...d,
        messages: d.messages.map((m, x) =>
          x === mi ? { ...m, embeds: [...m.embeds, defaultEmbedDraft()] } : m,
        ),
      };
    });
  };

  const moveMessage = (mi: number, dir: -1 | 1) => {
    setDraft((d) => {
      const j = mi + dir;
      if (j < 0 || j >= d.messages.length) return d;
      const next = [...d.messages];
      [next[mi], next[j]] = [next[j]!, next[mi]!];
      return { ...d, messages: next };
    });
  };

  const duplicateMessage = (mi: number) => {
    setDraft((d) => {
      if (d.messages.length >= 10) return d;
      const copy = JSON.parse(JSON.stringify(d.messages[mi]!)) as SingleMessageDraft;
      const next = [...d.messages.slice(0, mi + 1), copy, ...d.messages.slice(mi + 1)];
      return { ...d, messages: next };
    });
  };

  const removeMessage = (mi: number) => {
    setDraft((d) => {
      if (d.messages.length <= 1) return d;
      return { ...d, messages: d.messages.filter((_, j) => j !== mi) };
    });
  };

  const addMessage = () => {
    setDraft((d) => {
      if (d.messages.length >= 10) return d;
      return { ...d, messages: [...d.messages, defaultSingleMessageDraft()] };
    });
  };

  const moveComponentBlock = (mi: number, bi: number, dir: -1 | 1) => {
    setDraft((d) => {
      const msg = d.messages[mi];
      if (!msg) return d;
      const j = bi + dir;
      if (j < 0 || j >= msg.componentBlocks.length) return d;
      const blocks = [...msg.componentBlocks];
      [blocks[bi], blocks[j]] = [blocks[j]!, blocks[bi]!];
      return {
        ...d,
        messages: d.messages.map((m, x) => (x === mi ? { ...m, componentBlocks: blocks } : m)),
      };
    });
  };

  const duplicateComponentBlock = (mi: number, bi: number) => {
    setDraft((d) => {
      const msg = d.messages[mi];
      if (!msg || msg.componentBlocks.length >= 10) return d;
      const copy = JSON.parse(JSON.stringify(msg.componentBlocks[bi]!)) as ComponentBlockDraft;
      const next = [...msg.componentBlocks.slice(0, bi + 1), copy, ...msg.componentBlocks.slice(bi + 1)];
      return {
        ...d,
        messages: d.messages.map((m, x) => (x === mi ? { ...m, componentBlocks: next } : m)),
      };
    });
  };

  const removeComponentBlock = (mi: number, bi: number) => {
    setDraft((d) => {
      const msg = d.messages[mi];
      if (!msg) return d;
      return {
        ...d,
        messages: d.messages.map((m, x) =>
          x === mi ? { ...m, componentBlocks: m.componentBlocks.filter((_, j) => j !== bi) } : m,
        ),
      };
    });
  };

  const addComponentBlock = (mi: number) => {
    setDraft((d) => {
      const msg = d.messages[mi];
      if (!msg || msg.componentBlocks.length >= 10) return d;
      return {
        ...d,
        messages: d.messages.map((m, x) =>
          x === mi ? { ...m, componentBlocks: [...m.componentBlocks, defaultComponentBlockDraft()] } : m,
        ),
      };
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {draft.messages.map((msg, mi) => (
        <SectionWithToolbar
          key={mi}
          title={`Message ${mi + 1}`}
          defaultOpen={mi === 0}
          toolbar={
            <>
              <button
                type="button"
                disabled={mi === 0}
                onClick={(e) => {
                  e.stopPropagation();
                  moveMessage(mi, -1);
                }}
                className="ui-btn-secondary rounded px-2 py-1 text-xs text-zinc-400 disabled:opacity-30"
                title="Monter"
              >
                ↑
              </button>
              <button
                type="button"
                disabled={mi >= draft.messages.length - 1}
                onClick={(e) => {
                  e.stopPropagation();
                  moveMessage(mi, 1);
                }}
                className="ui-btn-secondary rounded px-2 py-1 text-xs text-zinc-400 disabled:opacity-30"
                title="Descendre"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  duplicateMessage(mi);
                }}
                disabled={draft.messages.length >= 10}
                className="ui-btn-secondary rounded px-2 py-1 text-xs text-zinc-400 disabled:opacity-30"
                title="Dupliquer"
              >
                ⧉
              </button>
              <button
                type="button"
                disabled={draft.messages.length <= 1}
                onClick={(e) => {
                  e.stopPropagation();
                  removeMessage(mi);
                }}
                className="rounded border border-vex-border px-2 py-1 text-xs text-zinc-500 hover:bg-red-950/40 hover:text-amber-200/90 disabled:opacity-30"
                title="Supprimer"
              >
                ✕
              </button>
            </>
          }
        >
          <div className="flex flex-col gap-3">
            <Section title="Profil">
              <p className="mb-3 text-[11px] leading-relaxed text-zinc-600">
                Optionnel : vous pouvez choisir un nom et une photo rien que pour ce message du modèle. Si vous laissez vide,
                l’aperçu utilisez le nom et la photo du bot (comme sur la vue d’ensemble → Apparence du bot).
              </p>
              <div className="flex flex-col gap-3">
                <div>
                  <Label>Nom affiché</Label>
                  <input
                    type="text"
                    value={msg.profileDisplayName}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        messages: d.messages.map((m, i) =>
                          i === mi ? { ...m, profileDisplayName: e.target.value } : m,
                        ),
                      }))
                    }
                    maxLength={80}
                    placeholder="Laisse vide pour le nom du bot"
                    className="ui-input mt-1"
                  />
                </div>
                <div>
                  <Label>Lien de la photo</Label>
                  <p className="mb-1 text-[11px] text-zinc-600">Une adresse web (https…) qui pointe vers l’image.</p>
                  <input
                    type="url"
                    value={msg.profileAvatarUrl}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        messages: d.messages.map((m, i) =>
                          i === mi ? { ...m, profileAvatarUrl: e.target.value } : m,
                        ),
                      }))
                    }
                    placeholder="Laisse vide pour la photo du bot"
                    className="ui-input"
                  />
                </div>
              </div>
            </Section>

            <div>
              <Label>Contenu du message</Label>
              <p className="mb-2 text-[11px] text-zinc-600">
                Texte au-dessus des embeds.
              </p>
              <textarea
                value={msg.messageContent}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    messages: d.messages.map((m, i) =>
                      i === mi ? { ...m, messageContent: e.target.value } : m,
                    ),
                  }))
                }
                rows={4}
                placeholder="Optionnel — laisse vide pour n’envoyer que des embeds."
                className="ui-input resize-y"
              />
            </div>

            {msg.embeds.map((block, i) => (
              <SectionWithToolbar
                key={i}
                title={`Embed ${i + 1}`}
                defaultOpen={i === 0}
                toolbar={
                  <>
                    <button
                      type="button"
                      disabled={i === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        moveEmbed(mi, i, -1);
                      }}
                      className="ui-btn-secondary rounded px-2 py-1 text-xs text-zinc-400 disabled:opacity-30"
                      title="Monter"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={i >= msg.embeds.length - 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        moveEmbed(mi, i, 1);
                      }}
                      className="ui-btn-secondary rounded px-2 py-1 text-xs text-zinc-400 disabled:opacity-30"
                      title="Descendre"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        duplicateEmbed(mi, i);
                      }}
                      disabled={msg.embeds.length >= 10}
                      className="ui-btn-secondary rounded px-2 py-1 text-xs text-zinc-400 disabled:opacity-30"
                      title="Dupliquer"
                    >
                      ⧉
                    </button>
                    <button
                      type="button"
                      disabled={msg.embeds.length <= 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeEmbed(mi, i);
                      }}
                      className="rounded border border-vex-border px-2 py-1 text-xs text-zinc-500 hover:bg-red-950/40 hover:text-amber-200/90 disabled:opacity-30"
                      title="Supprimer"
                    >
                      ✕
                    </button>
                  </>
                }
              >
                <EmbedBlockEditor
                  block={block}
                  radioGroupKey={`${mi}-${i}`}
                  updateBlock={(patch) => updateEmbed(mi, i, patch)}
                  setField={(fi, patch) => setField(mi, i, fi, patch)}
                  addField={() => addField(mi, i)}
                  removeField={(fi) => removeField(mi, i, fi)}
                />
              </SectionWithToolbar>
            ))}

            <button
              type="button"
              onClick={() => addEmbed(mi)}
              disabled={msg.embeds.length >= 10}
              className="rounded-xl border border-dashed border-vex-border bg-vex-bg/40 px-4 py-3 text-sm text-zinc-400 transition hover:border-vex-accent/40 hover:text-zinc-200 disabled:opacity-40"
            >
              + Ajouter un embed ({msg.embeds.length}/10)
            </button>

            {msg.componentBlocks.map((cb, bi) => (
              <SectionWithToolbar
                key={bi}
                title={`Composants ${bi + 1}`}
                defaultOpen={bi === 0}
                toolbar={
                  <>
                    <button
                      type="button"
                      disabled={bi === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        moveComponentBlock(mi, bi, -1);
                      }}
                      className="ui-btn-secondary rounded px-2 py-1 text-xs text-zinc-400 disabled:opacity-30"
                      title="Monter"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={bi >= msg.componentBlocks.length - 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        moveComponentBlock(mi, bi, 1);
                      }}
                      className="ui-btn-secondary rounded px-2 py-1 text-xs text-zinc-400 disabled:opacity-30"
                      title="Descendre"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        duplicateComponentBlock(mi, bi);
                      }}
                      disabled={msg.componentBlocks.length >= 10}
                      className="ui-btn-secondary rounded px-2 py-1 text-xs text-zinc-400 disabled:opacity-30"
                      title="Dupliquer"
                    >
                      ⧉
                    </button>
                    <button
                      type="button"
                      disabled={msg.componentBlocks.length === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeComponentBlock(mi, bi);
                      }}
                      className="rounded border border-vex-border px-2 py-1 text-xs text-zinc-500 hover:bg-red-950/40 hover:text-amber-200/90 disabled:opacity-30"
                      title="Supprimer"
                    >
                      ✕
                    </button>
                  </>
                }
              >
                <MessageComponentsEditor
                  rows={cb.rows}
                  onChange={(rows) =>
                    setDraft((d) => ({
                      ...d,
                      messages: d.messages.map((m, i) =>
                        i === mi
                          ? {
                              ...m,
                              componentBlocks: m.componentBlocks.map((c, j) =>
                                j === bi ? { ...c, rows } : c,
                              ),
                            }
                          : m,
                      ),
                    }))
                  }
                />
              </SectionWithToolbar>
            ))}

            <button
              type="button"
              onClick={() => addComponentBlock(mi)}
              disabled={msg.componentBlocks.length >= 10}
              className="rounded-xl border border-dashed border-vex-border bg-vex-bg/40 px-4 py-3 text-sm text-zinc-400 transition hover:border-vex-accent/40 hover:text-zinc-200 disabled:opacity-40"
            >
              + Ajouter des composants ({msg.componentBlocks.length}/10)
            </button>
          </div>
        </SectionWithToolbar>
      ))}

      <button
        type="button"
        onClick={addMessage}
        disabled={draft.messages.length >= 10}
        className="rounded-xl border border-dashed border-vex-border bg-vex-bg/40 px-4 py-3 text-sm text-zinc-400 transition hover:border-vex-accent/40 hover:text-zinc-200 disabled:opacity-40"
      >
        + Ajouter un message ({draft.messages.length}/10)
      </button>
    </div>
  );
}
