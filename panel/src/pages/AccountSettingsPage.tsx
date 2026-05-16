import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ConnectPrompt } from "../components/auth/ConnectPrompt.js";
import { PanelPageHeader } from "../components/ui/PanelPageHeader.js";
import { PageAuthSkeleton } from "../components/ui/PageSkeleton.js";
import { useAuth } from "../contexts/AuthContext.js";
import { useGuild } from "../contexts/GuildContext.js";
import { leaveBotFromAccessibleGuilds, resetAccountPanelData } from "../lib/accountApi.js";

const TICKET_EMOJI_PICKER_STORAGE_KEY = "vex-ticket-emoji-picker-custom";
const EMBED_EXAMPLE_SUPPRESSED_STORAGE_PREFIX = "vex-embed-example-suppressed:";

function clearEmbedExampleSuppressionStorage() {
  for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
    const key = window.localStorage.key(i);
    if (key?.startsWith(EMBED_EXAMPLE_SUPPRESSED_STORAGE_PREFIX)) {
      window.localStorage.removeItem(key);
    }
  }
}

export function AccountSettingsPage() {
  const { status, user, refresh } = useAuth();
  const { eligibleGuilds, setSelectedGuildId } = useGuild();
  const navigate = useNavigate();
  const [confirmation, setConfirmation] = useState("");
  const [leaveConfirmation, setLeaveConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [leaveBusy, setLeaveBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [leaveMessage, setLeaveMessage] = useState<string | null>(null);
  const [leaveError, setLeaveError] = useState<string | null>(null);

  const resetEnabled = confirmation === "RESET" && !busy;
  const leaveEnabled = leaveConfirmation === "QUITTER" && !leaveBusy;
  const affectedGuildCount = useMemo(() => eligibleGuilds.length, [eligibleGuilds.length]);
  const botPresentGuildCount = useMemo(
    () => eligibleGuilds.filter((guild) => guild.botPresent).length,
    [eligibleGuilds],
  );

  async function onReset() {
    if (!resetEnabled) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await resetAccountPanelData(confirmation);
      try {
        window.localStorage.removeItem(TICKET_EMOJI_PICKER_STORAGE_KEY);
        clearEmbedExampleSuppressionStorage();
      } catch {
        // Le nettoyage local est secondaire.
      }
      setSelectedGuildId(null);
      setMessage("Données réinitialisées. Vous allez revenir à l’écran de connexion.");
      await refresh();
      void navigate("/", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Réinitialisation impossible pour le moment.");
    } finally {
      setBusy(false);
    }
  }

  async function onLeaveBot() {
    if (!leaveEnabled) return;
    setLeaveBusy(true);
    setLeaveMessage(null);
    setLeaveError(null);
    try {
      const result = await leaveBotFromAccessibleGuilds(leaveConfirmation);
      setLeaveConfirmation("");
      await refresh();
      const failedNames = result.results
        .filter((r) => r.status === "failed")
        .map((r) => `${r.name} (${r.code ?? "erreur"})`);
      setLeaveMessage(`Bot retiré de ${result.left} serveur(s). Déjà absent : ${result.notPresent}.`);
      if (failedNames.length > 0) {
        setLeaveError(`Échec sur : ${failedNames.join(", ")}.`);
      }
    } catch (e) {
      setLeaveError(e instanceof Error ? e.message : "Impossible de retirer le bot pour le moment.");
    } finally {
      setLeaveBusy(false);
    }
  }

  if (status === "loading") {
    return (
      <PageAuthSkeleton
        title="Paramètres du compte"
        description="Gérez les données liées à votre accès au panel."
      />
    );
  }

  if (!user) {
    return <ConnectPrompt pageTitle="Paramètres du compte" />;
  }

  const displayName = user.global_name ?? user.username;

  return (
    <section className="flex flex-col gap-6">
      <PanelPageHeader
        title="Paramètres du compte"
        description="Gérez votre compte panel et les données associées."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
        <article className="ui-card p-4 sm:p-5">
          <h2 className="text-base font-semibold text-zinc-100">Compte connecté</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Vous êtes connecté avec <span className="font-medium text-zinc-200">{displayName}</span>.
          </p>
          <p className="mt-1 break-all text-xs text-zinc-500">Identifiant Discord : {user.id}</p>
        </article>

        <article className="ui-card-muted p-4 sm:p-5">
          <h2 className="text-base font-semibold text-zinc-100">Serveurs concernés</h2>
          <p className="mt-2 text-sm text-zinc-400">
            La réinitialisation touchera les données panel des serveurs accessibles avec ce compte.
          </p>
          <p className="mt-3 text-2xl font-semibold text-zinc-100">{affectedGuildCount}</p>
          <p className="mt-1 text-xs text-zinc-500">Bot présent sur {botPresentGuildCount} serveur(s).</p>
        </article>
      </div>

      <div className="grid items-start gap-4 md:grid-cols-2">
        <article className="min-w-0 rounded-xl border border-amber-400/30 bg-amber-950/20 p-4 sm:p-5">
          <h2 className="text-base font-semibold text-amber-100">Retirer le bot des serveurs</h2>
          <p className="mt-2 text-sm text-amber-100/80">
            Cette action fait quitter Vex de tous les serveurs accessibles avec votre compte où le bot est présent.
          </p>

          <div className="mt-5 max-w-md">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-amber-100/80">Écrivez QUITTER pour confirmer</span>
              <input
                className="ui-input"
                value={leaveConfirmation}
                onChange={(e) => setLeaveConfirmation(e.target.value)}
                placeholder="QUITTER"
                autoComplete="off"
                disabled={leaveBusy}
              />
            </label>

            <button
              type="button"
              className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-amber-300/50 bg-amber-500/15 px-4 py-2 text-center text-sm font-medium text-amber-100 transition hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              disabled={!leaveEnabled}
              onClick={() => void onLeaveBot()}
            >
              {leaveBusy ? "Retrait en cours…" : "Retirer le bot de tous mes serveurs"}
            </button>

            {leaveMessage ? <p className="mt-3 text-sm text-emerald-200/90">{leaveMessage}</p> : null}
            {leaveError ? <p className="mt-3 text-sm text-amber-200/90">{leaveError}</p> : null}
          </div>
        </article>

        <article className="min-w-0 rounded-xl border border-red-500/30 bg-red-950/20 p-4 sm:p-5">
          <h2 className="text-base font-semibold text-red-100">Réinitialiser les données du panel</h2>
          <p className="mt-2 text-sm text-red-100/80">
            Cette action remet à zéro les données du panel liées à votre compte : marketplace, réglages des
            serveurs accessibles et session actuelle.
          </p>

          <div className="mt-5 max-w-md">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-red-100/80">Écrivez RESET pour confirmer</span>
              <input
                className="ui-input"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                placeholder="RESET"
                autoComplete="off"
                disabled={busy}
              />
            </label>

            <button
              type="button"
              className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-red-400/50 bg-red-500/15 px-4 py-2 text-center text-sm font-medium text-red-100 transition hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              disabled={!resetEnabled}
              onClick={() => void onReset()}
            >
              {busy ? "Réinitialisation…" : "Réinitialiser mon compte panel"}
            </button>

            {message ? <p className="mt-3 text-sm text-emerald-200/90">{message}</p> : null}
            {error ? <p className="mt-3 text-sm text-amber-200/90">{error}</p> : null}
          </div>
        </article>
      </div>
    </section>
  );
}
