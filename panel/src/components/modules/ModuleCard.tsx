import type { ReactNode } from "react";

type Props = {
  /** Nom d’icône Font Awesome (sans préfixe), ex. `user-plus`. */
  icon: string;
  title: string;
  description: string;
  /** Si true : le corps de la carte est affiché (déplié). Si false : seul l’en-tête reste visible. */
  enabled: boolean;
  /** Si true : le formulaire reste visible même quand le module est désactivé (pour pouvoir configurer avant d’activer). */
  keepFormVisibleWhenDisabled?: boolean;
  enabledBusy?: boolean;
  /** Si false : pas d’interrupteur (ex. apparence du bot — toujours disponible si le bot est sur le serveur). */
  hideEnabledToggle?: boolean;
  onToggleEnabled: () => void;
  children: ReactNode;
};

/**
 * Carte module — en-tête aligné sur les cartes « commandes natives ».
 * Le contenu se déploie avec l’activation, se replie avec la désactivation (pas de bouton Configurer).
 */
export function ModuleCard({
  icon,
  title,
  description,
  enabled,
  keepFormVisibleWhenDisabled = false,
  enabledBusy = false,
  hideEnabledToggle = false,
  onToggleEnabled,
  children,
}: Props) {
  return (
    <div
      className={[
        "ui-card min-w-0 overflow-hidden transition",
        enabled ? "opacity-100" : "opacity-70",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-start justify-between gap-2 p-3 sm:gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-2 sm:gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-vex-surface text-zinc-300">
            <span className={`fa-solid fa-${icon}`} aria-hidden />
          </div>
          <div className="min-w-0">
            <h3 className="line-clamp-2 text-sm font-semibold text-zinc-100">{title}</h3>
            <p className="mt-1 line-clamp-3 text-xs text-zinc-400">{description}</p>
          </div>
        </div>
        {hideEnabledToggle ? null : (
          <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-2 sm:w-auto sm:justify-start">
            <label
              className={[
                "inline-flex cursor-pointer items-center gap-2 rounded-full px-2 py-1 text-[11px] font-medium transition",
                enabled ? "bg-emerald-500/15 text-emerald-300" : "bg-zinc-700/40 text-zinc-400",
                enabledBusy ? "opacity-60" : "",
              ].join(" ")}
            >
              <input
                type="checkbox"
                className="hidden"
                checked={enabled}
                onChange={() => onToggleEnabled()}
                disabled={enabledBusy}
              />
              <span
                className={[
                  "relative inline-block h-3.5 w-7 rounded-full transition",
                  enabled ? "bg-emerald-500/70" : "bg-zinc-600",
                ].join(" ")}
              >
                <span
                  className={[
                    "absolute top-0.5 inline-block h-2.5 w-2.5 rounded-full bg-white transition",
                    enabled ? "left-3.5" : "left-0.5",
                  ].join(" ")}
                />
              </span>
              {enabled ? "Activée" : "Désactivée"}
            </label>
          </div>
        )}
      </div>

      {enabled || keepFormVisibleWhenDisabled ? (
        <div className="border-t border-vex-border/60 bg-vex-surface/20 p-3 sm:p-4">{children}</div>
      ) : null}
    </div>
  );
}
