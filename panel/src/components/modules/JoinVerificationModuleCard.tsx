import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
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
import type { JoinVerificationMode, JoinVerificationSettings } from "../../types/joinVerification.js";
import { ModuleCard } from "./ModuleCard.js";

type Props = {
  discordGuildId: string;
  onFormDirtyChange?: (dirty: boolean) => void;
  formSaveRef?: MutableRefObject<(() => Promise<void>) | null>;
  discardSignal?: number;
};

function formSnapshot(
  mode: JoinVerificationMode,
  channelId: string,
  unverifiedRoleId: string,
  buttonLabel: string,
): string {
  return JSON.stringify({
    mode,
    channelId: channelId.trim(),
    unverifiedRoleId: unverifiedRoleId.trim(),
    buttonLabel: buttonLabel.trim(),
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
  const [formSaving, setFormSaving] = useState(false);

  const [moduleEnabled, setModuleEnabled] = useState(false);
  const [mode, setMode] = useState<JoinVerificationMode>("BUTTON");
  const [channelId, setChannelId] = useState("");
  const [unverifiedRoleId, setUnverifiedRoleId] = useState("");
  const [buttonLabel, setButtonLabel] = useState("");
  const [savedFormSnapshot, setSavedFormSnapshot] = useState("");

  const apply = useCallback((s: JoinVerificationSettings) => {
    setModuleEnabled(s.moduleEnabled);
    setMode(s.mode);
    setChannelId(s.channelId ?? "");
    setUnverifiedRoleId(s.unverifiedRoleId ?? "");
    setButtonLabel(s.buttonLabel ?? "");
    setSavedFormSnapshot(
      formSnapshot(s.mode, s.channelId ?? "", s.unverifiedRoleId ?? "", s.buttonLabel ?? ""),
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
    setFormSaving(true);
    setError(null);
    setPanelWarning(null);
    try {
      const { settings, panelSyncWarning } = await patchJoinVerificationSettings(discordGuildId, {
        moduleEnabled,
        mode,
        channelId: channelId.trim() || null,
        unverifiedRoleId: unverifiedRoleId.trim() || null,
        buttonLabel: buttonLabel.trim() || null,
      });
      apply(settings);
      setPanelWarning(panelSyncWarning);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setFormSaving(false);
    }
  }, [discordGuildId, moduleEnabled, mode, channelId, unverifiedRoleId, buttonLabel, apply]);

  const onDirtyRef = useRef(onFormDirtyChange);
  onDirtyRef.current = onFormDirtyChange;

  useEffect(() => {
    const snap = formSnapshot(mode, channelId, unverifiedRoleId, buttonLabel);
    onDirtyRef.current?.(savedFormSnapshot !== "" && snap !== savedFormSnapshot);
  }, [mode, channelId, unverifiedRoleId, buttonLabel, savedFormSnapshot]);

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
        mode: JoinVerificationMode;
        channelId: string;
        unverifiedRoleId: string;
        buttonLabel: string;
      };
      setMode(d.mode);
      setChannelId(d.channelId);
      setUnverifiedRoleId(d.unverifiedRoleId);
      setButtonLabel(d.buttonLabel);
    } catch {
      /* ignore */
    }
  }, [discardSignal, savedFormSnapshot]);

  const currentFormSnapshot = formSnapshot(mode, channelId, unverifiedRoleId, buttonLabel);
  const isFormDirty = savedFormSnapshot !== "" && currentFormSnapshot !== savedFormSnapshot;

  if (loading) {
    return <div className="ui-card min-h-[10rem]" aria-busy="true" aria-label="Chargement" />;
  }

  const roleOptions = (mentionMeta?.roles ?? [])
    .filter((r) => r.id !== discordGuildId)
    .sort((a, b) => a.name.localeCompare(b.name, "fr", { sensitivity: "base" }));

  return (
    <ModuleCard
      icon="shield-halved"
      title="Vérification à l’arrivée"
      description="Les nouveaux reçoivent d’abord un rôle « non vérifié ». Ensuite : code en message privé + saisie dans le salon (captcha), ou un simple bouton. Les rôles du module « Rôles à l’arrivée » ne sont donnés qu’après la vérification. Qui voit quels salons : uniquement via les permissions Discord (voir ci-dessous)."
      enabled={moduleEnabled}
      enabledBusy={flagsSaving}
      onToggleEnabled={() => void patchFlags()}
    >
      {error ? <div className="mb-3 rounded-md border border-amber-500/30 bg-amber-950/40 px-3 py-2 text-xs text-amber-100">{error}</div> : null}
      {panelWarning ? (
        <div className="mb-3 rounded-md border border-amber-500/30 bg-amber-950/40 px-3 py-2 text-xs text-amber-100">
          Panneau Discord : {panelWarning}
        </div>
      ) : null}

      <p className="mb-3 text-xs text-zinc-500">
        Active le module avec l’interrupteur pour afficher les réglages. Ensuite choisis le mode, le salon et le rôle, et
        clique sur « Enregistrer ces réglages » (ou sur « Enregistrer » en bas de page si la barre apparaît).
      </p>

      {moduleEnabled && (!channelId.trim() || !unverifiedRoleId.trim()) ? (
        <p className="mb-3 rounded-md border border-amber-500/25 bg-amber-950/30 px-3 py-2 text-[11px] text-amber-100/95">
          Module activé mais pas encore prêt : choisis un <strong className="font-medium">salon</strong> et un{" "}
          <strong className="font-medium">rôle non vérifié</strong>, puis enregistre.
        </p>
      ) : null}

      {!mentionMeta ? (
        <p className="mb-3 text-xs text-amber-200/90">
          Liste des rôles indisponible. Vérifie que le bot est sur le serveur, puis recharge.
        </p>
      ) : null}

      <div className="mb-3 rounded-md border border-zinc-600/40 bg-zinc-900/30 px-3 py-2 text-[11px] leading-relaxed text-zinc-400">
        <strong className="font-medium text-zinc-300">Salons et catégories visibles :</strong> Vex ne peut pas « ouvrir » ou
        « fermer » des catégories à votre place : c’est Discord qui décide selon les rôles. En pratique : sur la catégorie ou le
        salon réservé aux non vérifiés, retire la permission « Voir le salon » à @everyone et aux membres vérifiés, et
        autorise-la pour le rôle « non vérifié ». Fais l’inverse pour le reste du serveur (les membres vérifiés voient les
        salons normaux, les nouveaux seulement le salon de vérif).
      </div>

      {channels.length === 0 ? (
        <p className="mb-3 text-xs text-amber-200/90">
          Aucun salon texte listé : le bot doit avoir accès aux salons (permission « Voir les salons » sur le serveur ou sur
          les catégories concernées), puis recharge la page.
        </p>
      ) : null}

      <div className="space-y-3">
        <fieldset className="space-y-2">
          <legend className="text-xs font-medium text-zinc-400">Mode</legend>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
            <input
              type="radio"
              name="joinVerifyMode"
              checked={mode === "BUTTON"}
              onChange={() => setMode("BUTTON")}
            />
            Bouton dans le salon (un clic)
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
            <input
              type="radio"
              name="joinVerifyMode"
              checked={mode === "CAPTCHA"}
              onChange={() => setMode("CAPTCHA")}
            />
            Captcha (code envoyé en message privé, à coller dans le salon)
          </label>
        </fieldset>

        <label className="block text-xs font-medium text-zinc-400">
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

        <label className="block text-xs font-medium text-zinc-400">
          Rôle « non vérifié » (ex. noverif)
          <select
            className="ui-input mt-1"
            value={unverifiedRoleId}
            onChange={(e) => setUnverifiedRoleId(e.target.value)}
          >
            <option value="">— Choisir —</option>
            {roleOptions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>

        {mode === "BUTTON" ? (
          <label className="block text-xs font-medium text-zinc-400">
            Texte du bouton (optionnel, max. 80 caractères)
            <input
              className="ui-input mt-1"
              value={buttonLabel}
              onChange={(e) => setButtonLabel(e.target.value)}
              maxLength={80}
              placeholder="Je ne suis pas un robot"
            />
          </label>
        ) : null}

        {isFormDirty ? (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-vex-border/50 pt-4">
            <button
              type="button"
              className="ui-btn-primary text-sm"
              disabled={formSaving}
              onClick={() => void handleSaveForm()}
            >
              {formSaving ? "Enregistrement…" : "Enregistrer ces réglages"}
            </button>
          </div>
        ) : null}
      </div>
    </ModuleCard>
  );
}
