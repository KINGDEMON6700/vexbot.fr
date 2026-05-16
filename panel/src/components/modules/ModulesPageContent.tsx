import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchEmbedTemplates,
  fetchGuildMentionMeta,
  fetchGuildTextChannels,
  type GuildTextChannelOption,
} from "../../lib/embedsApi.js";
import type { EmbedTemplate } from "../../types/embedTemplate.js";
import type { GuildMentionMeta } from "../../types/guildMeta.js";
import { fetchGuildOverview } from "../../lib/overviewApi.js";
import { fetchJoinAutoRoleSettings, patchJoinAutoRoleSettings } from "../../lib/modulesJoinAutoRolesApi.js";
import { fetchWelcomeGoodbyeSettings, patchWelcomeGoodbyeSettings } from "../../lib/modulesWelcomeApi.js";
import type { JoinAutoRoleSettings } from "../../types/joinAutoRoles.js";
import type { OverviewResponse } from "../../types/overview.js";
import type { WelcomeGoodbyeSettings } from "../../types/welcomeGoodbye.js";
import { MultiPicker, type MultiPickerOption } from "../commands/MultiPicker.js";
import { ModulesPageSkeleton } from "../ui/PageSkeleton.js";
import { SaveChangesBar, SAVE_BAR_PAGE_PADDING } from "../ui/SaveChangesBar.js";
import { ModuleCard } from "./ModuleCard.js";
import { BotAppearanceModuleCard } from "./BotAppearanceModuleCard.js";
import { JoinVerificationModuleCard } from "./JoinVerificationModuleCard.js";

type Props = {
  discordGuildId: string;
};

function embedColorToInput(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "#5865f2";
  const v = Math.max(0, Math.min(0xffffff, Math.floor(n)));
  return `#${v.toString(16).padStart(6, "0")}`;
}

/** Champs enregistrés via « Enregistrer ». */
function welcomeGoodbyeDraftSnapshot(s: WelcomeGoodbyeSettings): string {
  const welcomeKind: "simple" | "template" = s.welcomeEmbedId?.trim() ? "template" : "simple";
  const goodbyeKind: "simple" | "template" = s.goodbyeEmbedId?.trim() ? "template" : "simple";
  return JSON.stringify({
    moduleEnabled: s.moduleEnabled,
    welcomeMessagesEnabled: s.welcomeMessagesEnabled,
    goodbyeMessagesEnabled: s.goodbyeMessagesEnabled,
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
  moduleEnabled: boolean;
  welcomeMessagesEnabled: boolean;
  goodbyeMessagesEnabled: boolean;
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

const PLACEHOLDER_VARS =
  "{user} · {user.mention} · {user.name} · {user.id} · {server} ou {guild} · {memberCount}";

const EMBED_COLOR_SWATCHES: ReadonlyArray<{ label: string; hex: string }> = [
  { label: "Bleu nuit", hex: "#4F7BFF" },
  { label: "Violet", hex: "#9B5CFF" },
  { label: "Rose", hex: "#EB6BA8" },
  { label: "Corail", hex: "#FF6B6B" },
  { label: "Orange", hex: "#F59E0B" },
  { label: "Menthe", hex: "#34D399" },
  { label: "Turquoise", hex: "#22D3EE" },
  { label: "Ardoise", hex: "#64748B" },
];

function EmbedColorPicker({
  label,
  labelId,
  value,
  onChange,
}: {
  label: string;
  labelId: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const selectedValue = value.toLowerCase();

  return (
    <div className="space-y-2">
      <span className="block text-xs font-medium text-zinc-400" id={labelId}>
        {label}
      </span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          className="h-9 w-14 cursor-pointer rounded border border-vex-border bg-vex-bg p-0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="text-xs text-zinc-500">{value}</span>
      </div>
      <div className="flex flex-wrap items-center gap-3" role="radiogroup" aria-labelledby={labelId}>
        {EMBED_COLOR_SWATCHES.map((sw) => {
          const selected = selectedValue === sw.hex.toLowerCase();
          return (
            <button
              key={sw.hex}
              type="button"
              role="radio"
              aria-checked={selected}
              title={sw.label}
              aria-label={`${sw.label}${selected ? ", sélectionné" : ""}`}
              onClick={() => onChange(sw.hex)}
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
  );
}

function SubModuleToggle({
  title,
  hint,
  active,
  busy,
  onToggle,
  detailsExpanded,
  onToggleDetails,
}: {
  title: string;
  hint: string;
  active: boolean;
  busy: boolean;
  onToggle: () => void;
  detailsExpanded?: boolean;
  onToggleDetails?: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-2 rounded-md border border-vex-border/50 bg-vex-bg/25 p-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-zinc-300">{title}</p>
        <p className="mt-0.5 text-[11px] text-zinc-500">{hint}</p>
      </div>
      <div className="inline-flex shrink-0 items-center gap-2">
        {active && onToggleDetails ? (
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-vex-border/70 bg-vex-bg/60 text-xs text-zinc-300 transition hover:border-vex-accent/70 hover:text-vex-accent"
            aria-label={detailsExpanded ? `Replier : ${title}` : `Déplier : ${title}`}
            aria-expanded={detailsExpanded}
            onClick={onToggleDetails}
          >
            {detailsExpanded ? "▼" : "▶"}
          </button>
        ) : null}
        <label
          className={[
            "inline-flex cursor-pointer items-center rounded-full p-1 transition",
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
    </div>
  );
}

export function ModulesPageContent({ discordGuildId }: Props) {
  const [channels, setChannels] = useState<GuildTextChannelOption[]>([]);
  const [embedTemplates, setEmbedTemplates] = useState<EmbedTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);
  const [joinVerifyDirty, setJoinVerifyDirty] = useState(false);
  const [joinVerifyDiscardSignal, setJoinVerifyDiscardSignal] = useState(0);
  const joinVerifySaveRef = useRef<(() => Promise<void>) | null>(null);
  const [appearanceDirty, setAppearanceDirty] = useState(false);
  const [appearanceDiscardSignal, setAppearanceDiscardSignal] = useState(0);
  const appearanceSaveRef = useRef<(() => Promise<void>) | null>(null);

  const [moduleEnabled, setModuleEnabled] = useState(true);
  const [welcomeMessagesEnabled, setWelcomeMessagesEnabled] = useState(true);
  const [goodbyeMessagesEnabled, setGoodbyeMessagesEnabled] = useState(true);
  const [welcomeDetailsOpen, setWelcomeDetailsOpen] = useState(false);
  const [goodbyeDetailsOpen, setGoodbyeDetailsOpen] = useState(false);

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

  const [savedDraftSnapshot, setSavedDraftSnapshot] = useState("");
  const [guildOverview, setGuildOverview] = useState<OverviewResponse | null>(null);

  const refreshGuildOverview = useCallback(async () => {
    try {
      const o = await fetchGuildOverview(discordGuildId);
      setGuildOverview(o);
    } catch {
      setGuildOverview(null);
    }
  }, [discordGuildId]);

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
    setJoinRoleSnapshot(JSON.stringify({ moduleEnabled: s.moduleEnabled, discordRoleIds: s.discordRoleIds }));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSavedOk(false);
    try {
      const [ch, tpl, s, join, meta, ov] = await Promise.all([
        fetchGuildTextChannels(discordGuildId),
        fetchEmbedTemplates(discordGuildId).catch(() => [] as EmbedTemplate[]),
        fetchWelcomeGoodbyeSettings(discordGuildId),
        fetchJoinAutoRoleSettings(discordGuildId),
        fetchGuildMentionMeta(discordGuildId).catch(() => null),
        fetchGuildOverview(discordGuildId).catch(() => null),
      ]);
      setChannels(ch);
      setEmbedTemplates(tpl);
      applySettingsToForm(s);
      applyJoinFromSettings(join);
      setMentionMeta(meta);
      setGuildOverview(ov);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chargement impossible.");
    } finally {
      setLoading(false);
    }
  }, [discordGuildId, applySettingsToForm, applyJoinFromSettings]);

  useEffect(() => {
    void load();
  }, [load]);

  const currentDraftSnapshot = useMemo(
    () =>
      JSON.stringify({
        moduleEnabled,
        welcomeMessagesEnabled,
        goodbyeMessagesEnabled,
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
      moduleEnabled,
      welcomeMessagesEnabled,
      goodbyeMessagesEnabled,
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
    () => joinRoleSnapshot !== JSON.stringify({ moduleEnabled: joinModuleEnabled, discordRoleIds: joinRoleIds }),
    [joinModuleEnabled, joinRoleSnapshot, joinRoleIds],
  );

  const showSaveBar = isDraftDirty || joinVerifyDirty || joinRolesDirty || appearanceDirty;

  useEffect(() => {
    if (showSaveBar && savedOk) setSavedOk(false);
  }, [showSaveBar, savedOk]);

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
      setModuleEnabled(d.moduleEnabled ?? true);
      setWelcomeMessagesEnabled(d.welcomeMessagesEnabled ?? true);
      setGoodbyeMessagesEnabled(d.goodbyeMessagesEnabled ?? true);
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
    try {
      const d = JSON.parse(joinRoleSnapshot) as { moduleEnabled?: boolean; discordRoleIds?: string[] };
      setJoinModuleEnabled(d.moduleEnabled ?? false);
      setJoinRoleIds(Array.isArray(d.discordRoleIds) ? [...d.discordRoleIds] : []);
    } catch {
      void load();
    }
    setJoinVerifyDiscardSignal((n) => n + 1);
    setAppearanceDiscardSignal((n) => n + 1);
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
      if (joinVerifyDirty && joinVerifySaveRef.current) {
        await joinVerifySaveRef.current();
      }
      if (joinRolesDirty) {
        const nextJoin = await patchJoinAutoRoleSettings(discordGuildId, {
          moduleEnabled: joinModuleEnabled,
          discordRoleIds: joinRoleIds,
        });
        applyJoinFromSettings(nextJoin);
      }
      if (appearanceDirty && appearanceSaveRef.current) {
        await appearanceSaveRef.current();
      }
      setSavedOk(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <ModulesPageSkeleton />;
  }

  return (
    <div className={`space-y-6 ${showSaveBar || savedOk ? SAVE_BAR_PAGE_PADDING : ""}`}>
      {error ? <div className="ui-card p-4 text-sm text-amber-200">{error}</div> : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:items-start xl:gap-6">
        <div className="min-w-0">
          <ModuleCard
            icon="user-plus"
            title="Arrivées et départs"
            description="Messages quand un membre rejoint ou quitte le serveur."
            enabled={moduleEnabled}
            enabledBusy={saving}
            onToggleEnabled={() => setModuleEnabled((v) => !v)}
          >
            <p className="mb-4 text-xs text-zinc-500">
              Choisissez un salon texte, puis un <strong className="font-medium text-zinc-400">embed simple</strong> ici ou un{" "}
              <strong className="font-medium text-zinc-400">modèle</strong> créé dans la page{" "}
              <strong className="font-medium text-zinc-400">Embeds</strong> (plusieurs messages, couleurs, boutons, etc.).
            </p>

            <div className="grid grid-cols-1 gap-6">
              <div className="min-w-0 space-y-3 rounded-md border border-vex-border/40 bg-vex-bg/20 p-3">
                <SubModuleToggle
                  title="Messages d’arrivée"
                  hint="Salon + texte de bienvenue pour les nouveaux membres."
                  active={welcomeMessagesEnabled}
                  busy={saving}
                  detailsExpanded={welcomeDetailsOpen}
                  onToggleDetails={() => setWelcomeDetailsOpen((v) => !v)}
                  onToggle={() => setWelcomeMessagesEnabled((v) => !v)}
                />
                {welcomeMessagesEnabled && welcomeDetailsOpen ? (
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
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-zinc-400">Format du message dans le salon</p>
                      <div className="grid grid-cols-1 rounded-2xl border border-vex-border bg-vex-bg/40 p-1 text-xs font-medium sm:inline-flex sm:rounded-full">
                        <button
                          type="button"
                          className={[
                            "rounded-full px-3 py-1.5 transition",
                            welcomeKind === "simple" ? "bg-vex-accent text-white" : "text-zinc-400 hover:text-zinc-200",
                          ].join(" ")}
                          onClick={() => {
                            setWelcomeKind("simple");
                            setWelcomeEmbedId("");
                          }}
                        >
                          Message simple
                        </button>
                        <button
                          type="button"
                          className={[
                            "rounded-full px-3 py-1.5 transition",
                            welcomeKind === "template" ? "bg-vex-accent text-white" : "text-zinc-400 hover:text-zinc-200",
                          ].join(" ")}
                          onClick={() => {
                            setWelcomeKind("template");
                          }}
                        >
                          Modèle du message
                        </button>
                      </div>
                    </div>
                    {welcomeKind === "simple" ? (
                      <EmbedColorPicker
                        label="Couleur de la barre latérale"
                        labelId="welcome-embed-color-label"
                        value={welcomeEmbedColorHex}
                        onChange={setWelcomeEmbedColorHex}
                      />
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
                        <p className="mt-1.5 text-[11px] text-zinc-500">Variables : {PLACEHOLDER_VARS}</p>
                        {embedTemplates.length === 0 ? (
                          <p className="text-[11px] text-amber-200/90">
                            Aucun modèle sur ce serveur. Créez-en un dans la page Embeds.
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
                  busy={saving}
                  detailsExpanded={goodbyeDetailsOpen}
                  onToggleDetails={() => setGoodbyeDetailsOpen((v) => !v)}
                  onToggle={() => setGoodbyeMessagesEnabled((v) => !v)}
                />
                {goodbyeMessagesEnabled && goodbyeDetailsOpen ? (
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
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-zinc-400">Format du message dans le salon</p>
                      <div className="grid grid-cols-1 rounded-2xl border border-vex-border bg-vex-bg/40 p-1 text-xs font-medium sm:inline-flex sm:rounded-full">
                        <button
                          type="button"
                          className={[
                            "rounded-full px-3 py-1.5 transition",
                            goodbyeKind === "simple" ? "bg-vex-accent text-white" : "text-zinc-400 hover:text-zinc-200",
                          ].join(" ")}
                          onClick={() => {
                            setGoodbyeKind("simple");
                            setGoodbyeEmbedId("");
                          }}
                        >
                          Message simple
                        </button>
                        <button
                          type="button"
                          className={[
                            "rounded-full px-3 py-1.5 transition",
                            goodbyeKind === "template" ? "bg-vex-accent text-white" : "text-zinc-400 hover:text-zinc-200",
                          ].join(" ")}
                          onClick={() => {
                            setGoodbyeKind("template");
                          }}
                        >
                          Modèle du message
                        </button>
                      </div>
                    </div>
                    {goodbyeKind === "simple" ? (
                      <EmbedColorPicker
                        label="Couleur de la barre latérale"
                        labelId="goodbye-embed-color-label"
                        value={goodbyeEmbedColorHex}
                        onChange={setGoodbyeEmbedColorHex}
                      />
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
                        <p className="mt-1.5 text-[11px] text-zinc-500">Variables : {PLACEHOLDER_VARS}</p>
                        {embedTemplates.length === 0 ? (
                          <p className="text-[11px] text-amber-200/90">
                            Aucun modèle sur ce serveur. Créez-en un dans la page Embeds.
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

        <div className="min-w-0">
          <BotAppearanceModuleCard
            discordGuildId={discordGuildId}
            overview={guildOverview}
            onRefresh={refreshGuildOverview}
            onDirtyChange={setAppearanceDirty}
            saveRef={appearanceSaveRef}
            discardSignal={appearanceDiscardSignal}
          />
        </div>

        <div className="min-w-0">
          <ModuleCard
            icon="id-badge"
            title="Rôles à l’arrivée"
            description="Ajoute un ou plusieurs rôles après la vérification (ou tout de suite si la vérification à l’arrivée est désactivée). Le rôle du bot doit être au-dessus de ces rôles, avec « Gérer les rôles »."
            enabled={joinModuleEnabled}
            enabledBusy={saving}
            onToggleEnabled={() => setJoinModuleEnabled((v) => !v)}
          >
            {!mentionMeta ? (
              <p className="text-xs text-amber-200/90">
                Liste des rôles indisponible. Vérifie que le bot est bien présent sur le serveur, puis recharge la page.
              </p>
            ) : null}
            <p className="mb-3 text-xs text-zinc-500">
              Choisissez un ou plusieurs rôles ci-dessous, puis utilisez la barre « Enregistrer ». Vous pouvez laisser le module activé sans rôle : dans ce cas, rien ne sera ajouté.
            </p>
            <MultiPicker
              options={joinRolePickerOptions}
              selectedIds={joinRoleIds}
              onChange={setJoinRoleIds}
              placeholder="Filtrer les rôles…"
              noneLabel="Aucun rôle sélectionné"
              disabled={!joinModuleEnabled || joinRolePickerOptions.length === 0}
            />
          </ModuleCard>
        </div>

        <div className="min-w-0">
          <JoinVerificationModuleCard
            discordGuildId={discordGuildId}
            onFormDirtyChange={setJoinVerifyDirty}
            formSaveRef={joinVerifySaveRef}
            discardSignal={joinVerifyDiscardSignal}
          />
        </div>
      </div>

      <SaveChangesBar
        visible={showSaveBar || savedOk}
        saving={saving}
        status={savedOk && !showSaveBar ? "saved" : "dirty"}
        onSave={() => void handleSave()}
        onDiscard={handleDiscardDraft}
        zIndexClass="z-50"
      />
    </div>
  );
}
