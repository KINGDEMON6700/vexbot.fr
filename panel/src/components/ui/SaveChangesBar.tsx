import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

type Props = {
  visible: boolean;
  saving?: boolean;
  status?: "dirty" | "saved";
  onSave: () => void;
  onDiscard: () => void;
  /** Incrémenter pour secouer la barre (ex. erreur de validation). */
  shakeKey?: number;
  zIndexClass?: string;
};

/** Espace sous le contenu quand la barre fixe est visible (bandeau fin). */
export const SAVE_BAR_PAGE_PADDING =
  "pb-[calc(4.25rem+env(safe-area-inset-bottom,0px))]" as const;

/** Barre fixe Enregistrer / Ne pas enregistrer — même style que le bandeau navigation (.ui-nav-bar). */
export function SaveChangesBar({
  visible,
  saving = false,
  status = "dirty",
  onSave,
  onDiscard,
  shakeKey = 0,
  zIndexClass = "",
}: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!visible || !mounted) return null;

  const isSaved = status === "saved" && !saving;
  const statusLabel = saving
    ? "Enregistrement..."
    : isSaved
      ? "Modifications enregistrées"
      : "Modifications non enregistrées";

  return createPortal(
    <div className={`ui-save-bar flex justify-center ${zIndexClass}`.trim()} role="region" aria-label={statusLabel}>
      <div key={shakeKey} className={`ui-save-bar-inner ${shakeKey > 0 ? "animate-vex-shake" : ""}`}>
        <p
          className={`text-xs font-medium ${isSaved ? "text-emerald-300/95" : "text-amber-200/95"}`}
          role="status"
          aria-live="polite"
        >
          {statusLabel}
        </p>
        {!isSaved ? (
          <>
            <button type="button" onClick={onSave} disabled={saving} className="ui-save-bar-btn-primary">
              {saving ? "Enregistrement..." : "Enregistrer"}
            </button>
            <button type="button" onClick={onDiscard} disabled={saving} className="ui-save-bar-btn-secondary">
              Ne pas enregistrer
            </button>
          </>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
