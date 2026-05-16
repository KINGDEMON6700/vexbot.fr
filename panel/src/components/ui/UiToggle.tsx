type Props = {
  title: string;
  hint?: string;
  active: boolean;
  busy?: boolean;
  onToggle: () => void;
  className?: string;
  detailsExpanded?: boolean;
  onToggleDetails?: () => void;
};

/** Interrupteur activer / désactiver (même style que les cartes modules). */
export function UiToggle({
  title,
  hint,
  active,
  busy = false,
  onToggle,
  className = "",
  detailsExpanded,
  onToggleDetails,
}: Props) {
  return (
    <div
      className={[
        "flex flex-col justify-between gap-2 rounded-md border border-vex-border/50 bg-vex-surface/30 p-3 sm:flex-row sm:items-center",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-zinc-200">{title}</p>
        {hint ? <p className="mt-0.5 text-xs text-zinc-500">{hint}</p> : null}
      </div>
      <div className="inline-flex shrink-0 items-center gap-2 sm:self-auto">
        {active && onToggleDetails ? (
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-vex-border/70 bg-vex-bg/60 text-xs text-zinc-300 transition hover:border-vex-accent/70 hover:text-vex-accent"
            aria-label={detailsExpanded ? `Replier : ${title}` : `Déplier : ${title}`}
            aria-expanded={detailsExpanded}
            onClick={onToggleDetails}
          >
            {detailsExpanded ? "▼" : "▶"}
          </button>
        ) : null}
        <label
          className={[
            "inline-flex cursor-pointer items-center gap-2 rounded-full px-2 py-1 text-[11px] font-medium transition",
            active ? "bg-emerald-500/15 text-emerald-300" : "bg-zinc-700/40 text-zinc-400",
            busy ? "pointer-events-none opacity-60" : "",
          ].join(" ")}
          aria-label={active ? `Désactiver : ${title}` : `Activer : ${title}`}
        >
          <input
            type="checkbox"
            className="hidden"
            checked={active}
            onChange={() => onToggle()}
            disabled={busy}
          />
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
          {active ? "Activé" : "Désactivé"}
        </label>
      </div>
    </div>
  );
}
