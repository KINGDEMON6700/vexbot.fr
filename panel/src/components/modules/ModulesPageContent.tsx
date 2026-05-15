import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchEmbedTemplates,
  fetchGuildMentionMeta,
  fetchGuildTextChannels,
  type GuildTextChannelOption,
} from "../../lib/embedsApi.js";
import type { EmbedTemplate } from "../../types/embedTemplate.js";
import type { GuildMentionMeta } from "../../types/guildMeta.js";
import { fetchJoinAutoRoleSettings, patchJoinAutoRoleSettings } from "../../lib/modulesJoinAutoRolesApi.js";
import { fetchWelcomeGoodbyeSettings, patchWelcomeGoodbyeSettings } from "../../lib/modulesWelcomeApi.js";
import type { JoinAutoRoleSettings } from "../../types/joinAutoRoles.js";
import type { WelcomeGoodbyeSettings } from "../../types/welcomeGoodbye.js";
import { MultiPicker, type MultiPickerOption } from "../commands/MultiPicker.js";
import { ModuleCard } from "./ModuleCard.js";
import { JoinVerificationModuleCard } from "./JoinVerificationModuleCard.js";

type Props = {
  discordGuildId: string;
};

function embedColorToInput(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "#5865f2";
  const v = Math.max(0, Math.min(0xffffff, Math.floor(n)));
  return `#${v.toString(16).padStart(6, "0")}`;
}

/** Champs enregistrés via « Enregistrer » (les interrupteurs principaux sont sauvegardés tout de suite). */
function welcomeGoodbyeDraftSnapshot(s: WelcomeGoodbyeSettings): string {
  const welcomeKind: "simple" | "template" = s.welcomeEmbedId?.trim() ? "template" : "simple";
  const goodbyeKind: "simple" | "template" = s.goodbyeEmbedId?.trim() ? "template" : "simple";
  return JSON.stringify({
    welcomeChannelId: s.welcomeChannelId ?? "",
    welcomeContent: s.welcomeContent ?? "",
    welcomeKind,
    welcomeEmbedColorHex: embedColorToInput(s.welcomeEmbedColor),
    welcomeEmbedId: s.welcomeEmbedId ?? "",
    goodbyeChannelId: s.goodbyeChannelId ?? "",
    goodbyeContent: s.goodbyeContent ?? "",
    goodbyeKind,
    goodbyeEmbedColorHex: embedColorToInput(s.goodbyeEmbedColor),
    goodbyeEmbedId: s.goodbyeEmbedId ?? "",
  });
}

type WelcomeGoodbyeDraft = {
  welcomeChannelId: string;
  welcomeContent: string;
  welcomeKind: "simple" | "template";
  welcomeEmbedColorHex: string;
  welcomeEmbedId: string;
  goodbyeChannelId: string;
  goodbyeContent: string;
  goodbyeKind: "simple" | "template";
  goodbyeEmbedColorHex: string;
  goodbyeEmbedId: string;
};

const PLACEHOLDER_HELP =
  "{user} · {user.mention} · {user.name} · {user.id} · {server} ou {guild} · {memberCount} (aussi dans les modèles d’embeds)";

function SubModuleToggle({
  title,
  hint,
  active,
  busy,
  onToggle,
}: {
  title: string;
  hint: string;
  active: boolean;
  busy: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex flex-col justify-between gap-2 rounded-md border border-vex-border/50 bg-vex-bg/25 p-3 sm:flex-row sm:items-center">
      <div className="min-w-0">
        <p className="text-xs font-medium text-zinc-300">{title}</p>
        <p className="mt-0.5 text-[11px] text-zinc-500">{hint}</p>
      </div>
      <label
        className={[
          "inline-flex shrink-0 cursor-pointer items-center self-end rounded-full p-1 transition sm:self-auto",
          active ? "bg-emerald-500/15" : "bg-zinc-700/40",
          busy ? "pointer-events-none opacity-60" : "",
        ].join(" ")}
        aria-label={active ? `Désactiver ${title}` : `Activer ${title}`}
      >
        <input type="checkbox" className="hidden" checked={active} onChange={() => onToggle()} disabled={busy} />
        <span
          className={[
            "relative inline-block h-3.5 w-7 rounded-full transition",
            active ? "bg-emerald-500/70" : "bg-zinc-600",
          ].join(" ")}
        >
          <span
            className={[
              "absolute top-0.5 inline-block h-2.5 w-2.5 rounded-full bg-white transition",
              active ? "left-3.5" : "left-0.5",
            ].join(" ")}
          />
        </span>
      </label>
    </div>
  );
}

export function ModulesPageContent({ discordGuildId }: Props) {
  const [channels, setChannels] = useState<GuildTextChannelOption[]>([]);
  const [embedTemplates, setEmbedTemplates] = useState<EmbedTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [flagsSaving, setFlagsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);

  const [moduleEnabled, setModuleEnabled] = useState(true);
  const [welcomeMessagesEnabled, setWelcomeMessagesEnabled] = useState(true);
  const [goodbyeMessagesEnabled, setGoodbyeMessagesEnabled] = useState(true);

  const [welcomeChannelId, setWelcomeChannelId] = useState("");
  const [welcomeContent, setWelcomeContent] = useState("");
  const [welcomeKind, setWelcomeKind] = useState<"simple" | "template">("simple");
  const [welcomeEmbedColorHex, setWelcomeEmbedColorHex] = useState("#5865f2");
  const [welcomeEmbedId, setWelcomeEmbedId] = useState("");

  const [goodbyeChannelId, setGoodbyeChannelId] = useState("");
  const [goodbyeContent, setGoodbyeContent] = useState("");
  const [goodbyeKind, setGoodbyeKind] = useState<"simple" | "template">("simple");
  const [goodbyeEmbedColorHex, setGoodbyeEmbedColorHex] = useState("#5865f2");
  const [goodbyeEmbedId, setGoodbyeEmbedId] = useState("");

  const [mentionMeta, setMentionMeta] = useState<GuildMentionMeta | null>(null);
  const [joinModuleEnabled, setJoinModuleEnabled] = useState(false);
  const [joinRoleIds, setJoinRoleIds] = useState<string[]>([]);
  const [joinRoleSnapshot, setJoinRoleSnapshot] = useState("");
  const [joinFlagsSaving, setJoinFlagsSaving] = useState(false);
  const [joinRolesSaving, setJoinRolesSaving] = useState(false);

  const [savedDraftSnapshot, setSavedDraftSnapshot] = useState("");

  const applySettingsToForm = useCallback((s: WelcomeGoodbyeSettings) => {
    setModuleEnabled(s.moduleEnabled);
    setWelcomeMessagesEnabled(s.welcomeMessagesEnabled);
    setGoodbyeMessagesEnabled(s.goodbyeMessagesEnabled);
    setWelcomeChannelId(s.welcomeChannelId ?? "");
    setWelcomeContent(s.welcomeContent ?? "");
    setWelcomeKind(s.welcomeEmbedId?.trim() ? "template" : "simple");
    setWelcomeEmbedColorHex(embedColorToInput(s.welcomeEmbedColor));
    setWelcomeEmbedId(s.welcomeEmbedId ?? "");
    setGoodbyeChannelId(s.goodbyeChannelId ?? "");
    setGoodbyeContent(s.goodbyeContent ?? "");
    setGoodbyeKind(s.goodbyeEmbedId?.trim() ? "template" : "simple");
    setGoodbyeEmbedColorHex(embedColorToInput(s.goodbyeEmbedColor));
    setGoodbyeEmbedId(s.goodbyeEmbedId ?? "");
    setSavedDraftSnapshot(welcomeGoodbyeDraftSnapshot(s));
  }, []);

  const applyJoinFromSettings = useCallback((s: JoinAutoRoleSettings) => {
    setJoinModuleEnabled(s.moduleEnabled);
    setJoinRoleIds([...s.discordRoleIds]);
    setJoinRoleSnapshot(JSON.stringify(s.discordRoleIds));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSavedOk(false);
    try {
      const [ch, tpl, s, join, meta] = await Promise.all([
        fetchGuildTextChannels(discordGuildId),
        fetchEmbedTemplates(discordGuildId).catch(() => [] as EmbedTemplate[]),
        fetchWelcomeGoodbyeSettings(discordGuildId),
        fetchJoinAutoRoleSettings(discordGuildId),
        fetchGuildMentionMeta(discordGuildId).catch(() => null),
      ]);
      setChannels(ch);
      setEmbedTemplates(tpl);
      applySettingsToForm(s);
      applyJoinFromSettings(join);
      setMentionMeta(meta);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chargement impossible.");
    } finally {
      setLoading(false);
    }
  }, [discordGuildId, applySettingsToForm, applyJoinFromSettings]);

  const patchJoinFlags = useCallback(async () => {
    setJoinFlagsSaving(true);
    setError(null);
    setSavedOk(false);
    try {
      const next = await patchJoinAutoRoleSettings(discordGuildId, { moduleEnabled: !joinModuleEnabled });
      applyJoinFromSettings(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Mise à jour impossible.");
    } finally {
      setJoinFlagsSaving(false);
    }
  }, [discordGuildId, joinModuleEnabled, applyJoinFromSettings]);

  const patchFlags = useCallback(
    async (
      partial: Partial<
        Pick<WelcomeGoodbyeSettings, "moduleEnabled" | "welcomeMessagesEnabled" | "goodbyeMessagesEnabled">
      >,
    ) => {
      setFlagsSaving(true);
      setError(null);
      setSavedOk(false);
      try {
        const next = await patchWelcomeGoodbyeSettings(discordGuildId, partial);
        applySettingsToForm(next);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Mise à jour impossible.");
      } finally {
        setFlagsSaving(false);
      }
    },
    [discordGuildId, applySettingsToForm],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const currentDraftSnapshot = useMemo(
    () =>
      JSON.stringify({
        welcomeChannelId,
        welcomeContent,
        welcomeKind,
        welcomeEmbedColorHex,
        welcomeEmbedId,
        goodbyeChannelId,
        goodbyeContent,
        goodbyeKind,
        goodbyeEmbedColorHex,
        goodbyeEmbedId,
      }),
    [
      welcomeChannelId,
      welcomeContent,
      welcomeKind,
      welcomeEmbedColorHex,
      welcomeEmbedId,
      goodbyeChannelId,
      goodbyeContent,
      goodbyeKind,
      goodbyeEmbedColorHex,
      goodbyeEmbedId,
    ],
  );

  const isDraftDirty = savedDraftSnapshot !== "" && currentDraftSnapshot !== savedDraftSnapshot;

  const joinRolesDirty = useMemo(
    () => joinRoleSnapshot !== JSON.stringify(joinRoleIds),
    [joinRoleSnapshot, joinRoleIds],
  );

  const joinRolePickerOptions: MultiPickerOption[] = useMemo(() => {
    const roles = mentionMeta?.roles ?? [];
    return [...roles]
      .filter((r) => r.id !== discordGuildId)
      .sort((a, b) => a.name.localeCompare(b.name, "fr", { sensitivity: "base" }))
      .map((r) => ({ id: r.id, label: r.name, color: r.color }));
  }, [mentionMeta?.roles, discordGuildId]);

  function handleDiscardDraft() {
    try {
      const d = JSON.parse(savedDraftSnapshot) as WelcomeGoodbyeDraft;
      setWelcomeChannelId(d.welcomeChannelId ?? "");
      setWelcomeContent(d.welcomeContent ?? "");
      setWelcomeKind(d.welcomeKind === "template" ? "template" : "simple");
      setWelcomeEmbedColorHex(d.welcomeEmbedColorHex || "#5865f2");
      setWelcomeEmbedId(d.welcomeEmbedId ?? "");
      setGoodbyeChannelId(d.goodbyeChannelId ?? "");
      setGoodbyeContent(d.goodbyeContent ?? "");
      setGoodbyeKind(d.goodbyeKind === "template" ? "template" : "simple");
      setGoodbyeEmbedColorHex(d.goodbyeEmbedColorHex || "#5865f2");
      setGoodbyeEmbedId(d.goodbyeEmbedId ?? "");
    } catch {
      void load();
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSavedOk(false);
    const welcomeUseEmbed = welcomeKind === "simple";
    const welcomeColor =
      welcomeKind === "simple" && /^#[0-9a-fA-F]{6}$/.test(welcomeEmbedColorHex)
        ? parseInt(welcomeEmbedColorHex.slice(1), 16)
        : null;
    const goodbyeUseEmbed = goodbyeKind === "simple";
    const goodbyeColor =
      goodbyeKind === "simple" && /^#[0-9a-fA-F]{6}$/.test(goodbyeEmbedColorHex)
        ? parseInt(goodbyeEmbedColorHex.slice(1), 16)
        : null;
    const useWelcomeTemplate = welcomeKind === "template";
    const useGoodbyeTemplate = goodbyeKind === "template";

    try {
      const next = await patchWelcomeGoodbyeSettings(discordGuildId, {
        moduleEnabled,
        welcomeMessagesEnabled,
        goodbyeMessagesEnabled,
        welcomeChannelId: welcomeChannelId.trim() || null,
        welcomeContent: useWelcomeTemplate ? null : welcomeContent.trim() || null,
        welcomeUseEmbed: useWelcomeTemplate ? false : welcomeUseEmbed,
        welcomeEmbedColor: useWelcomeTemplate ? null : welcomeUseEmbed ? welcomeColor : null,
        welcomeEmbedId: useWelcomeTemplate ? welcomeEmbedId.trim() || null : null,
        goodbyeChannelId: goodbyeChannelId.trim() || null,
        goodbyeContent: useGoodbyeTemplate ? null : goodbyeContent.trim() || null,
        goodbyeUseEmbed: useGoodbyeTemplate ? false : goodbyeUseEmbed,
        goodbyeEmbedColor: useGoodbyeTemplate ? null : goodbyeUseEmbed ? goodbyeColor : null,
        goodbyeEmbedId: useGoodbyeTemplate ? goodbyeEmbedId.trim() || null : null,
      });
      applySettingsToForm(next);
      setSavedOk(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveJoinRoles() {
    if (!joinRolesDirty) return;
    setJoinRolesSaving(true);
    setError(null);
    setSavedOk(false);
    try {
      const next = await patchJoinAutoRoleSettings(discordGuildId, { discordRoleIds: joinRoleIds });
      applyJoinFromSettings(next);
      setSavedOk(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setJoinRolesSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="ui-card-muted px-5 py-10 text-center text-sm text-zinc-500">Chargement des réglages…</div>
    );
  }

  return (
    <div className="space-y-6">
      {error ? <div className="ui-card p-4 text-sm text-amber-200">{error}</div> : null}
      {savedOk ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/40 px-4 py-2 text-sm text-emerald-100/95">
          Modifications enregistrées.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2 xl:col-span-3">
          <ModuleCard
            icon="user-plus"
            title="Arrivées et départs"
            description={`Messages quand un membre rejoint ou quitte le serveur. Variables : ${PLACEHOLDER_HELP}.`}
            enabled={moduleEnabled}
            enabledBusy={flagsSaving}
            onToggleEnabled={() => void patchFlags({ moduleEnabled: !moduleEnabled })}
          >
            <p className="mb-4 text-xs text-zinc-500">
              Choisis un salon texte, puis un <strong className="font-medium text-zinc-400">embed simple</strong> ici ou un{" "}
              <strong className="font-medium text-zinc-400">modèle</strong> créé dans la page{" "}
              <strong className="font-medium text-zinc-400">Embeds</strong> (plusieurs messages, couleurs, boutons, etc.).
            </p>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="min-w-0 space-y-3 rounded-md border border-vex-border/40 bg-vex-bg/20 p-3">
                <SubModuleToggle
                  title="Messages d’arrivée"
                  hint="Salon + texte de bienvenue pour les nouveaux membres."
                  active={welcomeMessagesEnabled}
                  busy={flagsSaving}
                  onToggle={() => void patchFlags({ welcomeMessagesEnabled: !welcomeMessagesEnabled })}
                />
                {welcomeMessagesEnabled ? (
                  <div className="space-y-3 border-t border-vex-border/50 pt-3">
                    <label className="block text-xs font-medium text-zinc-400">
                      Salon
                      <select
                        className="ui-input mt-1"
                        value={welcomeChannelId}
                        onChange={(e) => setWelcomeChannelId(e.target.value)}
                      >
                        <option value="">— Aucun —</option>
                        {channels.map((c) => (
                          <option key={c.id} value={c.id}>
                            #{c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <fieldset className="space-y-2">
                      <legend className="text-xs font-medium text-zinc-400">Format du message dans le salon</legend>
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                        <input
                          type="radio"
                          name="welcomeFmt"
                          checked={welcomeKind === "simple"}
                          onChange={() => {
                            setWelcomeKind("simple");
                            setWelcomeEmbedId("");
                          }}
                        />
                        Embed simple (description + couleur, max. 4096 caractères)
                      </label>
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                        <input
                          type="radio"
                          name="welcomeFmt"
                          checked={welcomeKind === "template"}
                          onChange={() => {
                            setWelcomeKind("template");
                          }}
                        />
                        Modèle d’embed (page Embeds)
                      </label>
                    </fieldset>
                    {welcomeKind === "simple" ? (
                      <label className="block text-xs font-medium text-zinc-400">
                        Couleur de la barre latérale
                        <div className="mt-1 flex items-center gap-2">
                          <input
                            type="color"
                            className="h-9 w-14 cursor-pointer rounded border border-vex-border bg-vex-bg p-0"
                            value={welcomeEmbedColorHex}
                            onChange={(e) => setWelcomeEmbedColorHex(e.target.value)}
                          />
                          <span className="text-xs text-zinc-500">{welcomeEmbedColorHex}</span>
                        </div>
                      </label>
                    ) : null}
                    {welcomeKind === "template" ? (
                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-zinc-400">
                          Modèle à envoyer
                          <select
                            className="ui-input mt-1"
                            value={welcomeEmbedId}
                            onChange={(e) => setWelcomeEmbedId(e.target.value)}
                          >
                            <option value="">— Choisir un modèle —</option>
                            {embedTemplates.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        {embedTemplates.length === 0 ? (
                          <p className="text-[11px] text-amber-200/90">
                            Aucun modèle sur ce serveur. Crée-en un dans la page Embeds.
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    {welcomeKind !== "template" ? (
                      <label className="block text-xs font-medium text-zinc-400">
                        Texte
                        <textarea
                          className="ui-input mt-1 min-h-[8rem] font-mono text-sm"
                          value={welcomeContent}
                          onChange={(e) => setWelcomeContent(e.target.value)}
                          maxLength={4096}
                          placeholder="Ex. Bienvenue {user.mention} sur **{server}** !"
                        />
                      </label>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="min-w-0 space-y-3 rounded-md border border-vex-border/40 bg-vex-bg/20 p-3">
                <SubModuleToggle
                  title="Messages de départ"
                  hint="Message dans le salon quand quelqu’un quitte le serveur."
                  active={goodbyeMessagesEnabled}
                  busy={flagsSaving}
                  onToggle={() => void patchFlags({ goodbyeMessagesEnabled: !goodbyeMessagesEnabled })}
                />
                {goodbyeMessagesEnabled ? (
                  <div className="space-y-3 border-t border-vex-border/50 pt-3">
                    <label className="block text-xs font-medium text-zinc-400">
                      Salon
                      <select
                        className="ui-input mt-1"
                        value={goodbyeChannelId}
                        onChange={(e) => setGoodbyeChannelId(e.target.value)}
                      >
                        <option value="">— Aucun —</option>
                        {channels.map((c) => (
                          <option key={c.id} value={c.id}>
                            #{c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <fieldset className="space-y-2">
                      <legend className="text-xs font-medium text-zinc-400">Format du message dans le salon</legend>
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                        <input
                          type="radio"
                          name="goodbyeFmt"
                          checked={goodbyeKind === "simple"}
                          onChange={() => {
                            setGoodbyeKind("simple");
                            setGoodbyeEmbedId("");
                          }}
                        />
                        Embed simple (description + couleur, max. 4096 caractères)
                      </label>
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                        <input
                          type="radio"
                          name="goodbyeFmt"
                          checked={goodbyeKind === "template"}
                          onChange={() => {
                            setGoodbyeKind("template");
                          }}
                        />
                        Modèle d’embed (page Embeds)
                      </label>
                    </fieldset>
                    {goodbyeKind === "simple" ? (
                      <label className="block text-xs font-medium text-zinc-400">
                        Couleur de la barre latérale
                        <div className="mt-1 flex items-center gap-2">
                          <input
                            type="color"
                            className="h-9 w-14 cursor-pointer rounded border border-vex-border bg-vex-bg p-0"
                            value={goodbyeEmbedColorHex}
                            onChange={(e) => setGoodbyeEmbedColorHex(e.target.value)}
                          />
                          <span className="text-xs text-zinc-500">{goodbyeEmbedColorHex}</span>
                        </div>
                      </label>
                    ) : null}
                    {goodbyeKind === "template" ? (
                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-zinc-400">
                          Modèle à envoyer
                          <select
                            className="ui-input mt-1"
                            value={goodbyeEmbedId}
                            onChange={(e) => setGoodbyeEmbedId(e.target.value)}
                          >
                            <option value="">— Choisir un modèle —</option>
                            {embedTemplates.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        {embedTemplates.length === 0 ? (
                          <p className="text-[11px] text-amber-200/90">
                            Aucun modèle sur ce serveur. Crée-en un dans la page Embeds.
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    {goodbyeKind !== "template" ? (
                      <label className="block text-xs font-medium text-zinc-400">
                        Texte
                        <textarea
                          className="ui-input mt-1 min-h-[8rem] font-mono text-sm"
                          value={goodbyeContent}
                          onChange={(e) => setGoodbyeContent(e.target.value)}
                          maxLength={4096}
                          placeholder="Ex. {user.name} a quitté {server}."
                        />
                      </label>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </ModuleCard>
        </div>

        <div className="min-w-0 lg:col-span-2 xl:col-span-3">
          <ModuleCard
            icon="id-badge"
            title="Rôles à l’arrivée"
            description="Ajoute un ou plusieurs rôles après la vérification (ou tout de suite si la vérification à l’arrivée est désactivée). Le rôle du bot doit être au-dessus de ces rôles, avec « Gérer les rôles »."
            enabled={joinModuleEnabled}
            enabledBusy={joinFlagsSaving}
            onToggleEnabled={() => void patchJoinFlags()}
          >
            {!mentionMeta ? (
              <p className="text-xs text-amber-200/90">
                Liste des rôles indisponible. Vérifie que le bot est bien présent sur le serveur, puis recharge la page.
              </p>
            ) : null}
            <p className="mb-3 text-xs text-zinc-500">
              Choisis un ou plusieurs rôles ci-dessous, puis clique sur « Enregistrer la sélection ». Tu peux laisser le module activé sans rôle : dans ce cas, rien ne sera ajouté.
            </p>
            <MultiPicker
              options={joinRolePickerOptions}
              selectedIds={joinRoleIds}
              onChange={setJoinRoleIds}
              placeholder="Filtrer les rôles…"
              noneLabel="Aucun rôle sélectionné"
              disabled={!joinModuleEnabled || joinRolePickerOptions.length === 0}
            />
            {joinRolesDirty ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="ui-btn-primary text-sm"
                  disabled={joinRolesSaving}
                  onClick={() => void handleSaveJoinRoles()}
                >
                  {joinRolesSaving ? "Enregistrement…" : "Enregistrer la sélection"}
                </button>
              </div>
            ) : null}
          </ModuleCard>
        </div>

        <div className="min-w-0 lg:col-span-2 xl:col-span-3">
          <JoinVerificationModuleCard discordGuildId={discordGuildId} />
        </div>
      </div>

      {isDraftDirty ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
          <div className="pointer-events-auto ui-card flex items-center gap-2 px-3 py-2 shadow-xl">
            <button type="button" className="ui-btn-primary" disabled={saving} onClick={() => void handleSave()}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
            <button type="button" className="ui-btn-secondary" disabled={saving} onClick={handleDiscardDraft}>
              Ne pas enregistrer
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
