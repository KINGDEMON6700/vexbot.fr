import { useCallback, useEffect, useState } from "react";
import {
  createCustomCommand,
  deleteCustomCommand,
  fetchCustomCommands,
  fetchNativeCommands,
  updateCustomCommand,
  updateNativeCommand,
} from "../../lib/commandsApi.js";
import { fetchGuildMentionMeta, fetchEmbedTemplates } from "../../lib/embedsApi.js";
import type { CustomCommand, CustomCommandInput, NativeCommandSetting } from "../../types/commands.js";
import type { GuildMentionMeta } from "../../types/guildMeta.js";
import type { EmbedTemplate } from "../../types/embedTemplate.js";
import { CommandsPageSkeleton } from "../ui/PageSkeleton.js";
import { createPageCache } from "../../lib/pageDataCache.js";
import { SaveChangesBar, SAVE_BAR_PAGE_PADDING } from "../ui/SaveChangesBar.js";
import { NativeCommandCard } from "./NativeCommandCard.js";
import { CustomCommandEditor } from "./CustomCommandEditor.js";
import { CreateCustomCommandModal } from "./CreateCustomCommandModal.js";

type Props = {
  discordGuildId: string;
};

type CommandsBundle = {
  natives: NativeCommandSetting[];
  customs: CustomCommand[];
  meta: GuildMentionMeta | null;
  embedTemplates: EmbedTemplate[];
};

const commandsCache = createPageCache<CommandsBundle>();

export function CommandsPageContent({ discordGuildId }: Props) {
  const [natives, setNatives] = useState<NativeCommandSetting[]>(() => commandsCache.get(discordGuildId)?.natives ?? []);
  const [customs, setCustoms] = useState<CustomCommand[]>(() => commandsCache.get(discordGuildId)?.customs ?? []);
  const [meta, setMeta] = useState<GuildMentionMeta | null>(() => commandsCache.get(discordGuildId)?.meta ?? null);
  const [embedTemplates, setEmbedTemplates] = useState<EmbedTemplate[]>(() => commandsCache.get(discordGuildId)?.embedTemplates ?? []);

  const [loading, setLoading] = useState(() => !commandsCache.get(discordGuildId));
  const [error, setError] = useState<string | null>(null);
  const [selectedCustomId, setSelectedCustomId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [nativePermDrafts, setNativePermDrafts] = useState<
    Record<string, { enabled: boolean; allowedRoleIds: string[]; allowedChannelIds: string[] }>
  >({});
  const [nativePermSaving, setNativePermSaving] = useState(false);
  const [nativeDiscardSignal, setNativeDiscardSignal] = useState(0);

  const nativePermissionsDirty = Object.keys(nativePermDrafts).length > 0;

  const load = useCallback(async () => {
    if (!commandsCache.get(discordGuildId)) setLoading(true);
    setError(null);
    try {
      const [n, c, m, e] = await Promise.all([
        fetchNativeCommands(discordGuildId),
        fetchCustomCommands(discordGuildId),
        fetchGuildMentionMeta(discordGuildId),
        fetchEmbedTemplates(discordGuildId).catch(() => [] as EmbedTemplate[]),
      ]);
      setNatives(n);
      setCustoms(c);
      setMeta(m);
      setEmbedTemplates(e);
      commandsCache.set(discordGuildId, { natives: n, customs: c, meta: m, embedTemplates: e });
      setSelectedCustomId((cur) => {
        if (cur && c.some((x) => x.id === cur)) return cur;
        return c[0]?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement.");
    } finally {
      setLoading(false);
    }
  }, [discordGuildId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleNativeUpdate(
    commandName: string,
    body: Partial<Pick<NativeCommandSetting, "enabled" | "allowedRoleIds" | "allowedChannelIds">>,
  ) {
    const updated = await updateNativeCommand(discordGuildId, commandName, body);
    setNatives((prev) => prev.map((c) => (c.commandName === commandName ? updated : c)));
  }

  async function handleCreate(values: { name: string; description: string }) {
    setCreateBusy(true);
    try {
      const created = await createCustomCommand(discordGuildId, {
        name: values.name,
        description: values.description,
        responseType: "PLAIN_TEXT",
        responseText: "",
        ephemeral: false,
        enabled: true,
        allowedRoleIds: [],
        allowedChannelIds: [],
      });
      setCustoms((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedCustomId(created.id);
      setCreateOpen(false);
    } finally {
      setCreateBusy(false);
    }
  }

  async function handleSaveCustom(commandId: string, body: Partial<CustomCommandInput>) {
    const updated = await updateCustomCommand(discordGuildId, commandId, body);
    setCustoms((prev) =>
      prev.map((c) => (c.id === commandId ? updated : c)).sort((a, b) => a.name.localeCompare(b.name)),
    );
  }

  async function handleDeleteCustom(commandId: string) {
    await deleteCustomCommand(discordGuildId, commandId);
    setCustoms((prev) => prev.filter((c) => c.id !== commandId));
    setSelectedCustomId((cur) => {
      if (cur !== commandId) return cur;
      const remaining = customs.filter((c) => c.id !== commandId);
      return remaining[0]?.id ?? null;
    });
  }

  const selectedCustom = customs.find((c) => c.id === selectedCustomId) ?? null;

  const handleNativePermissionsDirty = useCallback(
    (
      commandName: string,
      dirty: boolean,
      payload: { enabled: boolean; allowedRoleIds: string[]; allowedChannelIds: string[] } | null,
    ) => {
      setNativePermDrafts((prev) => {
        const next = { ...prev };
        if (!dirty || !payload) delete next[commandName];
        else next[commandName] = payload;
        return next;
      });
    },
    [],
  );

  async function saveAllNativePermissions() {
    const entries = Object.entries(nativePermDrafts);
    if (entries.length === 0) return;
    setNativePermSaving(true);
    try {
      for (const [commandName, body] of entries) {
        await handleNativeUpdate(commandName, body);
      }
      setNativePermDrafts({});
    } finally {
      setNativePermSaving(false);
    }
  }

  if (loading && natives.length === 0 && customs.length === 0) {
    return <CommandsPageSkeleton />;
  }

  function discardNativePermissions() {
    setNativePermDrafts({});
    setNativeDiscardSignal((n) => n + 1);
  }

  return (
    <div className={`space-y-6 ${nativePermissionsDirty ? SAVE_BAR_PAGE_PADDING : ""}`}>
      {error ? (
        <div className="ui-card p-4 text-sm text-amber-200">{error}</div>
      ) : null}

      {/* Section A : commandes natives */}
      <section>
        <header className="mb-3">
          <h2 className="text-base font-semibold text-zinc-100">Commandes natives</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Active ou désactive les commandes du bot sur ce serveur. Vous pouvez aussi restreindre qui peut les utiliser
            et dans quels salons.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {natives.map((cmd) => (
              <div key={cmd.commandName} className="min-w-0">
                <NativeCommandCard
                  command={cmd}
                  meta={meta}
                  discardSignal={nativeDiscardSignal}
                  onPermissionsDirty={(dirty, payload) =>
                    handleNativePermissionsDirty(cmd.commandName, dirty, payload)
                  }
                  onChange={(body) => handleNativeUpdate(cmd.commandName, body)}
                />
              </div>
            ))}
          </div>
      </section>

      {/* Section B : commandes personnalisées */}
      <section>
        <header className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">Mes commandes personnalisées</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Crée des commandes simples qui répondent par un texte ou un embed. Exemple :{" "}
              <code className="rounded bg-vex-surface/60 px-1 py-0.5 text-[10px] text-zinc-300">
                /viking
              </code>{" "}
              → « Vous êtes un viking ! ».
            </p>
          </div>
          <button
            type="button"
            className="ui-btn-primary text-sm"
            onClick={() => setCreateOpen(true)}
          >
            <span className="fa-solid fa-plus mr-2" aria-hidden />
            Nouvelle commande
          </button>
        </header>

        {customs.length === 0 ? (
          <div className="ui-card p-6 text-center">
            <p className="text-sm text-zinc-400">Vous n'avez encore aucune commande personnalisée.</p>
            <button
              type="button"
              className="ui-btn-primary mt-3 text-sm"
              onClick={() => setCreateOpen(true)}
            >
              Créer ma première commande
            </button>
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[minmax(220px,260px)_minmax(0,1fr)]">
            <aside className="ui-card flex h-fit flex-col p-3">
              <p className="px-1 pb-2 text-[11px] uppercase tracking-wide text-zinc-500">
                {customs.length} commande{customs.length > 1 ? "s" : ""}
              </p>
              <div className="vex-scrollbar max-h-72 space-y-1 overflow-y-auto pr-1 xl:max-h-[480px]">
                {customs.map((c) => {
                  const active = c.id === selectedCustomId;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedCustomId(c.id)}
                      className={[
                        "w-full rounded-md border px-2.5 py-2 text-left transition",
                        active
                          ? "border-vex-accent/70 bg-vex-accent/10 text-zinc-100"
                          : "border-vex-border/50 bg-vex-bg/30 text-zinc-300 hover:border-vex-border hover:bg-vex-bg/50",
                      ].join(" ")}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">/{c.name}</span>
                        {!c.enabled ? (
                          <span className="rounded bg-zinc-700/50 px-1.5 py-0.5 text-[9px] uppercase text-zinc-400">
                            off
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-zinc-500">
                        {c.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </aside>

            <div className="ui-card p-4 sm:p-5">
              {selectedCustom ? (
                <CustomCommandEditor
                  key={selectedCustom.id}
                  command={selectedCustom}
                  meta={meta}
                  embedTemplates={embedTemplates}
                  onSave={(body) => handleSaveCustom(selectedCustom.id, body)}
                  onDelete={() => handleDeleteCustom(selectedCustom.id)}
                />
              ) : (
                <p className="py-8 text-center text-sm text-zinc-500">
                  Sélectionnez une commande dans la liste, ou créez-en une nouvelle.
                </p>
              )}
            </div>
          </div>
        )}
      </section>

      {createOpen ? (
        <CreateCustomCommandModal
          busy={createBusy}
          onCancel={() => (createBusy ? null : setCreateOpen(false))}
          onSubmit={handleCreate}
        />
      ) : null}

      <SaveChangesBar
        visible={nativePermissionsDirty}
        saving={nativePermSaving}
        onSave={() => void saveAllNativePermissions()}
        onDiscard={discardNativePermissions}
        zIndexClass="z-50"
      />
    </div>
  );
}
