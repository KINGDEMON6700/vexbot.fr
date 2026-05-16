import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import {
  fetchEmbedTemplates,
  fetchGuildMentionMeta,
  fetchGuildTextChannels,
  type GuildTextChannelOption,
} from "../../lib/embedsApi.js";
import {
  fetchJoinVerificationSettings,
  patchJoinVerificationSettings,
} from "../../lib/modulesJoinVerificationApi.js";
import type { EmbedTemplate } from "../../types/embedTemplate.js";
import type { GuildMentionMeta } from "../../types/guildMeta.js";
import type { JoinVerificationSettings } from "../../types/joinVerification.js";
import { MultiPicker, type MultiPickerOption } from "../commands/MultiPicker.js";
import { ModuleCard } from "./ModuleCard.js";

type Props = {
  discordGuildId: string;
  onFormDirtyChange?: (dirty: boolean) => void;
  formSaveRef?: MutableRefObject<(() => Promise<void>) | null>;
  discardSignal?: number;
};

function sortedIds(ids: string[]): string[] {
  return [...ids].sort();
}

function formSnapshot(
  moduleEnabled: boolean,
  channelId: string,
  unverifiedRoleId: string,
  panelContent: string,
  panelUseEmbed: boolean,
  panelEmbedColor: string,
  panelEmbedId: string,
  buttonLabel: string,
  verifiedRoleIds: string[],
): string {
  return JSON.stringify({
    moduleEnabled,
    channelId: channelId.trim(),
    unverifiedRoleId: unverifiedRoleId.trim(),
    panelContent: panelContent.trim(),
    panelUseEmbed,
    panelEmbedColor: panelEmbedColor.trim().toLowerCase(),
    panelEmbedId: panelEmbedId.trim(),
    buttonLabel: buttonLabel.trim(),
    verifiedRoleIds: sortedIds(verifiedRoleIds),
  });
}

function intToHex(n: number | null | undefined): string {
  if (typeof n !== "number") return "#5865f2";
  return `#${n.toString(16).padStart(6, "0")}`;
}

function hexToInt(hex: string): number | null {
  const s = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(s)) return null;
  return parseInt(s, 16);
}

export function JoinVerificationModuleCard({
  discordGuildId,
  onFormDirtyChange,
  formSaveRef,
  discardSignal = 0,
}: Props) {
  const [channels, setChannels] = useState<GuildTextChannelOption[]>([]);
  const [embedTemplates, setEmbedTemplates] = useState<EmbedTemplate[]>([]);
  const [mentionMeta, setMentionMeta] = useState<GuildMentionMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [panelWarning, setPanelWarning] = useState<string | null>(null);

  const [moduleEnabled, setModuleEnabled] = useState(false);
  const [channelId, setChannelId] = useState("");
  const [unverifiedRoleId, setUnverifiedRoleId] = useState("");
  const [panelKind, setPanelKind] = useState<"simple" | "template">("simple");
  const [panelContent, setPanelContent] = useState("");
  const [panelUseEmbed, setPanelUseEmbed] = useState(true);
  const [panelEmbedColor, setPanelEmbedColor] = useState("#5865f2");
  const [panelEmbedId, setPanelEmbedId] = useState("");
  const [buttonLabel, setButtonLabel] = useState("");
  const [verifiedRoleIds, setVerifiedRoleIds] = useState<string[]>([]);
  const [savedFormSnapshot, setSavedFormSnapshot] = useState("");

  const apply = useCallback((s: JoinVerificationSettings) => {
    setModuleEnabled(s.moduleEnabled);
    setChannelId(s.channelId ?? "");
    setUnverifiedRoleId(s.unverifiedRoleId ?? "");
    setPanelKind(s.panelEmbedId ? "template" : "simple");
    setPanelContent(s.panelContent ?? "");
    setPanelUseEmbed(s.panelUseEmbed ?? true);
    setPanelEmbedColor(intToHex(s.panelEmbedColor));
    setPanelEmbedId(s.panelEmbedId ?? "");
    setButtonLabel(s.buttonLabel ?? "");
    setVerifiedRoleIds(s.verifiedRoleIds?.length ? [...s.verifiedRoleIds] : []);
    setSavedFormSnapshot(
      formSnapshot(
        s.moduleEnabled,
        s.channelId ?? "",
        s.unverifiedRoleId ?? "",
        s.panelContent ?? "",
        s.panelUseEmbed ?? true,
        intToHex(s.panelEmbedColor),
        s.panelEmbedId ?? "",
        s.buttonLabel ?? "",
        s.verifiedRoleIds ?? [],
      ),
    );
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPanelWarning(null);
    try {
      const [ch, templates, meta, s] = await Promise.all([
        fetchGuildTextChannels(discordGuildId),
        fetchEmbedTemplates(discordGuildId).catch(() => []),
        fetchGuildMentionMeta(discordGuildId).catch(() => null),
        fetchJoinVerificationSettings(discordGuildId),
      ]);
      setChannels(ch);
      setEmbedTemplates(templates);
      setMentionMeta(meta);
      apply(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chargement impossible.");
    } finally {
      setLoading(false);
    }
  }, [discordGuildId, apply]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSaveForm = useCallback(async () => {
    setError(null);
    setPanelWarning(null);
    try {
      const { settings, panelSyncWarning } = await patchJoinVerificationSettings(discordGuildId, {
        moduleEnabled,
        channelId: channelId.trim() || null,
        unverifiedRoleId: unverifiedRoleId.trim() || null,
        panelContent: panelKind === "simple" ? panelContent.trim() || null : null,
        panelUseEmbed: panelKind === "simple" ? panelUseEmbed : true,
        panelEmbedColor: panelKind === "simple" && panelUseEmbed ? hexToInt(panelEmbedColor) : null,
        panelEmbedId: panelKind === "template" ? panelEmbedId.trim() || null : null,
        buttonLabel: buttonLabel.trim() || null,
        verifiedRoleIds,
      });
      apply(settings);
      setPanelWarning(panelSyncWarning);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enregistrement impossible.");
    }
  }, [
    discordGuildId,
    moduleEnabled,
    channelId,
    unverifiedRoleId,
    panelKind,
    panelContent,
    panelUseEmbed,
    panelEmbedColor,
    panelEmbedId,
    buttonLabel,
    verifiedRoleIds,
    apply,
  ]);

  const onDirtyRef = useRef(onFormDirtyChange);
  onDirtyRef.current = onFormDirtyChange;

  useEffect(() => {
    const snap = formSnapshot(
      moduleEnabled,
      channelId,
      unverifiedRoleId,
      panelContent,
      panelUseEmbed,
      panelEmbedColor,
      panelKind === "template" ? panelEmbedId : "",
      buttonLabel,
      verifiedRoleIds,
    );
    onDirtyRef.current?.(savedFormSnapshot !== "" && snap !== savedFormSnapshot);
  }, [
    moduleEnabled,
    channelId,
    unverifiedRoleId,
    panelContent,
    panelUseEmbed,
    panelEmbedColor,
    panelKind,
    panelEmbedId,
    buttonLabel,
    verifiedRoleIds,
    savedFormSnapshot,
  ]);

  useEffect(() => {
    if (!formSaveRef) return;
    formSaveRef.current = () => handleSaveForm();
    return () => {
      formSaveRef.current = null;
    };
  }, [formSaveRef, handleSaveForm]);

  useEffect(() => {
    if (!discardSignal || !savedFormSnapshot) return;
    try {
      const d = JSON.parse(savedFormSnapshot) as {
        channelId: string;
        moduleEnabled?: boolean;
        unverifiedRoleId: string;
        panelContent?: string;
        panelUseEmbed?: boolean;
        panelEmbedColor?: string;
        panelEmbedId?: string;
        buttonLabel: string;
        verifiedRoleIds: string[];
      };
      setModuleEnabled(d.moduleEnabled ?? false);
      setChannelId(d.channelId);
      setUnverifiedRoleId(d.unverifiedRoleId);
      setPanelContent(d.panelContent ?? "");
      setPanelUseEmbed(d.panelUseEmbed ?? true);
      setPanelEmbedColor(d.panelEmbedColor ?? "#5865f2");
      setPanelEmbedId(d.panelEmbedId ?? "");
      setPanelKind(d.panelEmbedId ? "template" : "simple");
      setButtonLabel(d.buttonLabel);
      setVerifiedRoleIds(Array.isArray(d.verifiedRoleIds) ? [...d.verifiedRoleIds] : []);
    } catch {
      /* ignore */
    }
  }, [discardSignal, savedFormSnapshot]);

  const roleOptions = useMemo(() => {
    const base = (mentionMeta?.roles ?? [])
      .filter((r) => r.id !== discordGuildId)
      .sort((a, b) => a.name.localeCompare(b.name, "fr", { sensitivity: "base" }));
    const out: MultiPickerOption[] = [];
    const skip = unverifiedRoleId.trim();
    for (const r of base) {
      if (skip && r.id === skip) continue;
      out.push({ id: r.id, label: r.name, color: r.color });
    }
    return out;
  }, [mentionMeta?.roles, discordGuildId, unverifiedRoleId]);

  if (loading) {
    return <div className="ui-card min-h-[10rem]" aria-busy="true" aria-label="Chargement" />;
  }

  const missingChannel = !channelId.trim();
  const missingUnverifiedRole = !unverifiedRoleId.trim();
  const missingPanelTemplate = panelKind === "template" && !panelEmbedId.trim();
  const missingRequired = missingChannel || missingUnverifiedRole || missingPanelTemplate;
  const panelModeLabel = panelKind === "template" ? "Modèle Embed" : panelUseEmbed ? "Message simple en embed" : "Texte simple";

  return (
    <ModuleCard
      icon="shield-halved"
      title="Vérification à l’arrivée"
      description="Filtre les nouveaux membres avec un rôle temporaire, un bouton Discord et un code image à retaper."
      enabled={moduleEnabled}
      onToggleEnabled={() => setModuleEnabled((v) => !v)}
    >
      {error ? (
        <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-950/40 px-3 py-2 text-xs text-amber-100">
          {error}
        </div>
      ) : null}
      {panelWarning ? (
        <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-950/40 px-3 py-2 text-xs text-amber-100">
          Panneau Discord : {panelWarning}
        </div>
      ) : null}

      <div className="space-y-4">
        <div className="grid min-w-0 gap-2 sm:grid-cols-3">
          <div className="rounded-lg border border-vex-border/50 bg-vex-bg/30 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">État</p>
            <p className={`mt-1 text-sm font-medium ${moduleEnabled ? "text-emerald-300" : "text-zinc-300"}`}>
              {moduleEnabled ? "Activée" : "Désactivée"}
            </p>
          </div>
          <div className="rounded-lg border border-vex-border/50 bg-vex-bg/30 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Configuration</p>
            <p className={`mt-1 text-sm font-medium ${missingRequired ? "text-amber-200" : "text-emerald-300"}`}>
              {missingRequired ? "À compléter" : "Prête"}
            </p>
          </div>
          <div className="rounded-lg border border-vex-border/50 bg-vex-bg/30 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Panneau</p>
            <p className="mt-1 truncate text-sm font-medium text-zinc-200" title={panelModeLabel}>
              {panelModeLabel}
            </p>
          </div>
        </div>

        {moduleEnabled && missingRequired ? (
          <div className="rounded-lg border border-amber-500/25 bg-amber-950/30 px-3 py-2 text-[11px] text-amber-100/95">
            Module activé mais incomplet : choisissez les champs manquants puis enregistrez. Le bot ne bloquera vraiment
            les nouveaux que quand le salon et le rôle non vérifié sont prêts.
          </div>
        ) : null}

        {!mentionMeta ? (
          <p className="rounded-lg border border-amber-500/25 bg-amber-950/25 px-3 py-2 text-xs text-amber-200/90">
            Liste des rôles indisponible. Vérifiez que le bot est sur le serveur, puis rechargez.
          </p>
        ) : null}

        {channels.length === 0 ? (
          <p className="rounded-lg border border-amber-500/25 bg-amber-950/25 px-3 py-2 text-xs text-amber-200/90">
            Aucun salon texte listé : vérifiez que le bot voit les salons, puis rechargez.
          </p>
        ) : null}

        <section className="min-w-0 rounded-xl border border-vex-border/50 bg-vex-bg/25 p-3 sm:p-4">
          <div className="mb-3 flex min-w-0 items-start gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-vex-accent/35 bg-vex-accent/10 text-xs font-semibold text-vex-accent">
              1
            </span>
            <div className="min-w-0">
              <h4 className="text-sm font-semibold text-zinc-100">Accès avant validation</h4>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                Le nouveau membre reçoit ce rôle temporaire et voit le salon de vérification.
              </p>
            </div>
          </div>

          <div className="grid min-w-0 gap-3 md:grid-cols-2">
            <label className="block min-w-0 text-xs font-medium text-zinc-400">
              Salon de vérification
              <select className="ui-input mt-1" value={channelId} onChange={(e) => setChannelId(e.target.value)}>
                <option value="">— Choisir —</option>
                {channels.map((c) => (
                  <option key={c.id} value={c.id}>
                    #{c.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block min-w-0 text-xs font-medium text-zinc-400">
              Rôle non vérifié
              <select
                className="ui-input mt-1"
                value={unverifiedRoleId}
                onChange={(e) => {
                  const next = e.target.value;
                  setUnverifiedRoleId(next);
                  if (next) setVerifiedRoleIds((prev) => prev.filter((id) => id !== next));
                }}
              >
                <option value="">— Choisir —</option>
                {(mentionMeta?.roles ?? [])
                  .filter((r) => r.id !== discordGuildId)
                  .sort((a, b) => a.name.localeCompare(b.name, "fr", { sensitivity: "base" }))
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>
        </section>

        <section className="min-w-0 rounded-xl border border-vex-border/50 bg-vex-bg/25 p-3 sm:p-4">
          <div className="mb-3 flex min-w-0 items-start gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-vex-accent/35 bg-vex-accent/10 text-xs font-semibold text-vex-accent">
              2
            </span>
            <div className="min-w-0">
              <h4 className="text-sm font-semibold text-zinc-100">Panneau Discord</h4>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                Le contenu peut être simple ou venir d’un modèle Embed. Le bouton de vérification sera ajouté automatiquement.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-zinc-400">Format du panneau</p>
              <div className="mt-1 grid grid-cols-1 rounded-2xl border border-vex-border bg-vex-bg/40 p-1 text-xs font-medium sm:inline-flex sm:rounded-full">
                <button
                  type="button"
                  className={[
                    "rounded-full px-3 py-1.5 transition",
                    panelKind === "simple" ? "bg-vex-accent text-white" : "text-zinc-400 hover:text-zinc-200",
                  ].join(" ")}
                  onClick={() => setPanelKind("simple")}
                >
                  Message simple
                </button>
                <button
                  type="button"
                  className={[
                    "rounded-full px-3 py-1.5 transition",
                    panelKind === "template" ? "bg-vex-accent text-white" : "text-zinc-400 hover:text-zinc-200",
                  ].join(" ")}
                  onClick={() => setPanelKind("template")}
                >
                  Modèle Embed
                </button>
              </div>
            </div>

            {panelKind === "template" ? (
              <label className="block min-w-0 text-xs font-medium text-zinc-400">
                Modèle à utiliser
                <select
                  className="ui-input mt-1"
                  value={panelEmbedId}
                  onChange={(e) => setPanelEmbedId(e.target.value)}
                >
                  <option value="">— Choisir un modèle —</option>
                  {embedTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                {embedTemplates.length === 0 ? (
                  <span className="mt-1 block text-[11px] text-amber-200/90">
                    Aucun modèle Embed disponible. Créez-en un dans la page Embeds.
                  </span>
                ) : null}
              </label>
            ) : (
              <div className="space-y-3">
                <label className="block min-w-0 text-xs font-medium text-zinc-400">
                  Texte du panneau
                  <textarea
                    className="ui-input mt-1 min-h-[6rem] text-sm"
                    value={panelContent}
                    onChange={(e) => setPanelContent(e.target.value)}
                    maxLength={4096}
                    placeholder="Clique sur le bouton pour lancer la vérification et accéder au serveur."
                  />
                </label>
                <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                  <label className="flex min-w-0 items-center gap-2 text-xs font-medium text-zinc-400">
                    <input
                      type="checkbox"
                      className="accent-vex-accent"
                      checked={panelUseEmbed}
                      onChange={(e) => setPanelUseEmbed(e.target.checked)}
                    />
                    Afficher dans un embed simple
                  </label>
                  {panelUseEmbed ? (
                    <label className="block min-w-0 text-xs font-medium text-zinc-400">
                      Couleur
                      <input
                        type="color"
                        className="mt-1 h-10 w-full rounded-lg border border-vex-border bg-vex-bg p-1"
                        value={panelEmbedColor}
                        onChange={(e) => setPanelEmbedColor(e.target.value)}
                      />
                    </label>
                  ) : null}
                </div>
              </div>
            )}

            <label className="block min-w-0 text-xs font-medium text-zinc-400">
              Libellé du bouton
              <input
                className="ui-input mt-1"
                value={buttonLabel}
                onChange={(e) => setButtonLabel(e.target.value)}
                maxLength={80}
                placeholder="Je ne suis pas un robot"
              />
            </label>
          </div>
        </section>

        <section className="min-w-0 rounded-xl border border-vex-border/50 bg-vex-bg/25 p-3 sm:p-4">
          <div className="mb-3 flex min-w-0 items-start gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-vex-accent/35 bg-vex-accent/10 text-xs font-semibold text-vex-accent">
              3
            </span>
            <div className="min-w-0">
              <h4 className="text-sm font-semibold text-zinc-100">Après validation</h4>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                Ces rôles sont donnés après le bon code. Le rôle non vérifié est retiré automatiquement.
              </p>
            </div>
          </div>
          <MultiPicker
            options={roleOptions}
            selectedIds={verifiedRoleIds}
            onChange={setVerifiedRoleIds}
            placeholder="Chercher un rôle…"
            noneLabel="Aucun rôle ici — le module séparé « Rôles à l’arrivée » peut encore en ajouter."
          />
        </section>

        <div className="rounded-xl border border-zinc-600/40 bg-zinc-900/30 px-3 py-2 text-[11px] leading-relaxed text-zinc-400">
          <strong className="font-medium text-zinc-300">Permissions Discord :</strong> donnez accès au salon de
          vérification au rôle non vérifié, puis masquez le reste du serveur à ce rôle si besoin. Vex crée le panneau et
          gère les rôles, mais les permissions de salons restent à régler dans Discord.
        </div>
      </div>
    </ModuleCard>
  );
}
