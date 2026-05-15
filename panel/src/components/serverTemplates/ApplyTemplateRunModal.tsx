import { useEffect, useRef, useState } from "react";
import {
  applyServerTemplate,
  type ApplyProgressEvent,
} from "../../lib/serverTemplatesApi.js";

type Phase = "warning" | "running" | "finished" | "failed";

type Props = {
  discordGuildId: string;
  templateId: string;
  templateName: string;
  /** Quand on ferme la modale (le parent doit rafraîchir la liste / le cache). */
  onClose: (didApply: boolean) => void;
};

type StepLine = {
  index: number;
  total: number;
  label: string;
  status: "doing" | "done" | "error" | "skipped";
  detail?: string;
};

export function ApplyTemplateRunModal({
  discordGuildId,
  templateId,
  templateName,
  onClose,
}: Props) {
  const [phase, setPhase] = useState<Phase>("warning");
  const [steps, setSteps] = useState<StepLine[]>([]);
  const [total, setTotal] = useState(0);
  const [appliedSteps, setAppliedSteps] = useState(0);
  const [failedSteps, setFailedSteps] = useState(0);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const stepsBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && phase !== "running") onClose(phase === "finished");
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [phase, onClose]);

  useEffect(() => {
    stepsBottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [steps.length]);

  async function run() {
    setPhase("running");
    setSteps([]);
    setTotal(0);
    setAppliedSteps(0);
    setFailedSteps(0);
    setFatalError(null);
    try {
      await applyServerTemplate(discordGuildId, templateId, (ev: ApplyProgressEvent) => {
        if (ev.type === "start") {
          setTotal(ev.totalSteps);
          return;
        }
        if (ev.type === "step") {
          setSteps((prev) => {
            const status: StepLine["status"] = ev.status;
            const lineDetail = "detail" in ev ? ev.detail : undefined;
            // Si le step existe déjà (même index), on le remplace ; sinon on l'ajoute.
            const idx = prev.findIndex((s) => s.index === ev.index);
            const next: StepLine = {
              index: ev.index,
              total: ev.total,
              label: ev.label,
              status,
              detail: lineDetail,
            };
            if (idx === -1) return [...prev, next];
            const copy = prev.slice();
            copy[idx] = next;
            return copy;
          });
          return;
        }
        if (ev.type === "done") {
          setAppliedSteps(ev.appliedSteps);
          setFailedSteps(ev.failedSteps);
          setPhase(ev.failedSteps > 0 ? "failed" : "finished");
          return;
        }
        if (ev.type === "fatal") {
          setFatalError(ev.error);
          setPhase("failed");
        }
      });
      // Si on sort de la lecture sans avoir reçu "done" ni "fatal" (ex. coupure), on bascule en failed.
      setPhase((p) => (p === "running" ? "failed" : p));
    } catch (e) {
      setFatalError(e instanceof Error ? e.message : "Erreur inattendue.");
      setPhase("failed");
    }
  }

  const closeDisabled = phase === "running";
  const isWarning = phase === "warning";
  const isRunning = phase === "running";
  const isFinished = phase === "finished";
  const isFailed = phase === "failed";

  const progressPct = total > 0 ? Math.round((steps.length / total) * 100) : 0;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !closeDisabled) onClose(isFinished);
      }}
    >
      <div
        className="ui-card flex max-h-[90vh] w-full max-w-2xl flex-col p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="apply-run-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="border-b border-vex-border pb-3">
          <h2 id="apply-run-title" className="text-base font-semibold text-zinc-100">
            {isWarning
              ? "Confirmation"
              : isRunning
                ? "Application en cours…"
                : isFinished
                  ? "Application terminée"
                  : "Application interrompue"}
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Template : <strong className="text-zinc-300">{templateName}</strong>
          </p>
        </header>

        {isWarning ? (
          <div className="mt-4 space-y-3">
            <div className="rounded-md border border-red-500/40 bg-red-950/30 p-3 text-sm text-red-100/95">
              <p className="flex items-start gap-2">
                <span className="mt-0.5 fa-solid fa-triangle-exclamation" aria-hidden />
                <span>
                  <strong>Cette action va restructurer votre serveur.</strong> Les salons supprimés et
                  leur historique de messages seront perdus définitivement.{" "}
                  <strong>Cette action est irréversible.</strong>
                </span>
              </p>
            </div>
            <p className="text-xs text-zinc-500">
              Le bot va appliquer toutes les modifications listées dans l’aperçu. La progression
              s’affichera ici en temps réel.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="ui-btn-secondary text-sm"
                onClick={() => onClose(false)}
              >
                Annuler
              </button>
              <button
                type="button"
                className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-1.5 text-sm text-red-100 transition hover:bg-red-950/60"
                onClick={() => void run()}
              >
                <span className="fa-solid fa-play mr-2" aria-hidden />
                Appliquer le template
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>
                  {steps.length} / {total || "?"} étapes
                </span>
                <span>
                  {appliedSteps} ✓ · {failedSteps} ✗
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded bg-vex-border/40">
                <div
                  className={`h-full transition-[width] duration-150 ${
                    isFailed ? "bg-amber-400/70" : "bg-vex-accent"
                  }`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            <div className="mt-3 flex-1 min-h-0 overflow-y-auto rounded-md border border-vex-border/60 bg-vex-bg/30 p-2">
              {steps.length === 0 ? (
                <p className="px-2 py-3 text-center text-xs text-zinc-500">Préparation…</p>
              ) : (
                <ul className="space-y-1">
                  {steps.map((s) => (
                    <li
                      key={s.index}
                      className="flex items-start gap-2 rounded border border-vex-border/40 bg-vex-surface/40 px-2 py-1.5 text-xs"
                    >
                      {s.status === "doing" ? (
                        <span
                          className="mt-0.5 inline-block h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-zinc-500 border-t-vex-accent"
                          aria-hidden
                        />
                      ) : s.status === "done" ? (
                        <span className="mt-0.5 fa-solid fa-check shrink-0 text-emerald-400" aria-hidden />
                      ) : s.status === "error" ? (
                        <span className="mt-0.5 fa-solid fa-xmark shrink-0 text-red-400" aria-hidden />
                      ) : (
                        <span
                          className="mt-0.5 fa-solid fa-forward shrink-0 text-zinc-500"
                          aria-hidden
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p
                          className={[
                            "truncate",
                            s.status === "error" ? "text-red-200" : "text-zinc-200",
                          ].join(" ")}
                        >
                          {s.label}
                        </p>
                        {s.detail ? (
                          <p className="text-[10px] text-zinc-500">{s.detail}</p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                  <div ref={stepsBottomRef} />
                </ul>
              )}
            </div>

            {fatalError ? (
              <p className="mt-3 rounded-md border border-red-500/40 bg-red-950/30 p-2 text-xs text-red-200/95">
                {fatalError}
              </p>
            ) : null}

            <div className="mt-3 flex justify-end gap-2 border-t border-vex-border pt-3">
              {isRunning ? (
                <button type="button" className="ui-btn-secondary text-sm" disabled>
                  Application en cours…
                </button>
              ) : (
                <button
                  type="button"
                  className="ui-btn-primary text-sm"
                  onClick={() => onClose(isFinished)}
                >
                  Fermer
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
