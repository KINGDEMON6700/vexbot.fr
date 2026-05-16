import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import {
  fetchGuildMentionMeta,
  fetchGuildTextChannels,
  type GuildTextChannelOption,
} from "../../lib/embedsApi.js";
import {
  fetchJoinVerificationSettings,
  patchJoinVerificationSettings,
} from "../../lib/modulesJoinVerificationApi.js";
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
  channelId: string,
  unverifiedRoleId: string,
  buttonLabel: string,
  verifiedRoleIds: string[],
): string {
  return JSON.stringify({
    channelId: channelId.trim(),
    unverifiedRoleId: unverifiedRoleId.trim(),
    buttonLabel: buttonLabel.trim(),
    verifiedRoleIds: sortedIds(verifiedRoleIds),
  });
}

export function JoinVerificationModuleCard({
  discordGuildId,
  onFormDirtyChange,
  formSaveRef,
  discardSignal = 0,
}: Props) {
  const [channels, setChannels] = useState<GuildTextChannelOption[]>([]);
  const [mentionMeta, setMentionMeta] = useState<GuildMentionMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [panelWarning, setPanelWarning] = useState<string | null>(null);
  const [flagsSaving, setFlagsSaving] = useState(false);

  const [moduleEnabled, setModuleEnabled] = useState(false);
  const [channelId, setChannelId] = useState("");
  const [unverifiedRoleId, setUnverifiedRoleId] = useState("");
  const [buttonLabel, setButtonLabel] = useState("");
  const [verifiedRoleIds, setVerifiedRoleIds] = useState<string[]>([]);
  const [savedFormSnapshot, setSavedFormSnapshot] = useState("");

  const apply = useCallback((s: JoinVerificationSettings) => {
    setModuleEnabled(s.moduleEnabled);
    setChannelId(s.channelId ?? "");
    setUnverifiedRoleId(s.unverifiedRoleId ?? "");
    setButtonLabel(s.buttonLabel ?? "");
    setVerifiedRoleIds(s.verifiedRoleIds?.length ? [...s.verifiedRoleIds] : []);
    setSavedFormSnapshot(
      formSnapshot(s.channelId ?? "", s.unverifiedRoleId ?? "", s.buttonLabel ?? "", s.verifiedRoleIds ?? []),
    );
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPanelWarning(null);
    try {
      const [ch, meta, s] = await Promise.all([
        fetchGuildTextChannels(discordGuildId),
        fetchGuildMentionMeta(discordGuildId).catch(() => null),
        fetchJoinVerificationSettings(discordGuildId),
      ]);
      setChannels(ch);
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

  const patchFlags = useCallback(async () => {
    setFlagsSaving(true);
    setError(null);
    setPanelWarning(null);
    try {
      if (!moduleEnabled) {
        const { settings, panelSyncWarning } = await patchJoinVerificationSettings(discordGuildId, {
          moduleEnabled: true,
        });
        apply(settings);
        setPanelWarning(panelSyncWarning);
      } else {
        const { settings, panelSyncWarning } = await patchJoinVerificationSettings(discordGuildId, {
          moduleEnabled: false,
        });
        apply(settings);
        setPanelWarning(panelSyncWarning);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Mise à jour impossible.");
    } finally {
      setFlagsSaving(false);
    }
  }, [discordGuildId, moduleEnabled, apply]);

  const handleSaveForm = useCallback(async () => {
    setError(null);
    setPanelWarning(null);
    try {
      const { settings, panelSyncWarning } = await patchJoinVerificationSettings(discordGuildId, {
        moduleEnabled,
        channelId: channelId.trim() || null,
        unverifiedRoleId: unverifiedRoleId.trim() || null,
        buttonLabel: buttonLabel.trim() || null,
        verifiedRoleIds,
      });
      apply(settings);
      setPanelWarning(panelSyncWarning);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enregistrement impossible.");
    }
  }, [discordGuildId, moduleEnabled, channelId, unverifiedRoleId, buttonLabel, verifiedRoleIds, apply]);

  const onDirtyRef = useRef(onFormDirtyChange);
  onDirtyRef.current = onFormDirtyChange;

  useEffect(() => {
    const snap = formSnapshot(channelId, unverifiedRoleId, buttonLabel, verifiedRoleIds);
    onDirtyRef.current?.(savedFormSnapshot !== "" && snap !== savedFormSnapshot);
  }, [channelId, unverifiedRoleId, buttonLabel, verifiedRoleIds, savedFormSnapshot]);

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
        unverifiedRoleId: string;
        buttonLabel: string;
        verifiedRoleIds: string[];
      };
      setChannelId(d.channelId);
      setUnverifiedRoleId(d.unverifiedRoleId);
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

  return (
    <ModuleCard
      icon="shield-halved"
      title="Vérification à l’arrivée"
      description="Les nouveaux reçoivent d’abord un rôle « non vérifié », puis ils cliquent sur le bouton du salon de vérification, lisent une image puis retapent le code dans une petite fenêtre. Ensuite ils reçoivent les rôles que vous choisissez plus bas ; le module « Rôles à l’arrivée » peut en ajouter encore s’il est activé séparément. Les salons visibles ou non : réglez-les comme d’habitude avec les permissions Discord sur le serveur."
      enabled={moduleEnabled}
      enabledBusy={flagsSaving}
      onToggleEnabled={() => void patchFlags()}
    >
      {error ? (
        <div className="mb-3 rounded-md border border-amber-500/30 bg-amber-950/40 px-3 py-2 text-xs text-amber-100">
          {error}
        </div>
      ) : null}
      {panelWarning ? (
        <div className="mb-3 rounded-md border border-amber-500/30 bg-amber-950/40 px-3 py-2 text-xs text-amber-100">
          Panneau Discord : {panelWarning}
        </div>
      ) : null}

      <p className="mb-3 text-xs text-zinc-500">
        Activez le module avec l’interrupteur, choisissez le salon du panneau, le rôle « non vérifié », puis les rôles
        donnés après validation. Ensuite, utilisez la barre d’enregistrement en bas si elle apparaît.
      </p>

      {moduleEnabled && (!channelId.trim() || !unverifiedRoleId.trim()) ? (
        <p className="mb-3 rounded-md border border-amber-500/25 bg-amber-950/30 px-3 py-2 text-[11px] text-amber-100/95">
          Module activé mais incomplet : choisissez un <strong className="font-medium">salon</strong> et un{" "}
          <strong className="font-medium">rôle non vérifié</strong>, puis enregistrez.
        </p>
      ) : null}

      {!mentionMeta ? (
        <p className="mb-3 text-xs text-amber-200/90">
          Liste des rôles indisponible. Vérifiez que le bot est sur le serveur, puis rechargez.
        </p>
      ) : null}

      <div className="mb-3 rounded-md border border-zinc-600/40 bg-zinc-900/30 px-3 py-2 text-[11px] leading-relaxed text-zinc-400">
        <strong className="font-medium text-zinc-300">Salons :</strong> sur la partie réservée aux non vérifiés, autorisez
        le salon au rôle « non vérifié » uniquement ; sur le reste du serveur, laissez accès aux rôles que vous attribuez après
        vérification. Vex ne remplace pas le panneau Discord : vous réglerez toujours Visible / invisible par salon et par rôle à la main.
      </div>

      {channels.length === 0 ? (
        <p className="mb-3 text-xs text-amber-200/90">
          Aucun salon texte listé : vérifiez que le bot voit les salons (permission « Voir les salons »), puis rechargez.
        </p>
      ) : null}

      <div className="space-y-3">
        <label className="block text-xs font-medium text-zinc-400">
          Salon de vérification (panneau + bouton)
          <select className="ui-input mt-1" value={channelId} onChange={(e) => setChannelId(e.target.value)}>
            <option value="">— Choisir —</option>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs font-medium text-zinc-400">
          Rôle « non vérifié » (attribué à l’arrivée jusqu’à la validation)
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

        <label className="block text-xs font-medium text-zinc-400">
          Libellé du bouton du panneau (optionnel, max. 80 caractères)
          <input
            className="ui-input mt-1"
            value={buttonLabel}
            onChange={(e) => setButtonLabel(e.target.value)}
            maxLength={80}
            placeholder="Je ne suis pas un robot"
          />
        </label>

        <div>
          <p className="text-xs font-medium text-zinc-400">Rôles donnés après vérification</p>
          <p className="mt-1 text-[11px] text-zinc-500">
            Un ou plusieurs rôles attribués dès que le code image est bon (ex. accès aux salons membres).
          </p>
          <div className="mt-2">
            <MultiPicker
              options={roleOptions}
              selectedIds={verifiedRoleIds}
              onChange={setVerifiedRoleIds}
              placeholder="Chercher un rôle…"
              noneLabel="Aucun — seules les rôles « Rôles à l’arrivée » s’ajouteront si ce module séparé est activé."
            />
          </div>
        </div>

      </div>
    </ModuleCard>
  );
}
