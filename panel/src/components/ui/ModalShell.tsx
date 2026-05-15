import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** large = détail marketplace ; medium = formulaires */
  size?: "medium" | "large";
  /** Empêche la fermeture clic extérieur / Échap */
  lockDismiss?: boolean;
};

/**
 * Fenêtre modale plein écran (fond assombri, scroll dans la boîte).
 * Toujours au-dessus du panel — pas dans une carte.
 */
export function ModalShell({
  open,
  onClose,
  title,
  children,
  size = "medium",
  lockDismiss = false,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !lockDismiss) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, lockDismiss]);

  if (!open) return null;

  const maxW = size === "large" ? "max-w-6xl" : "max-w-lg";

  return createPortal(
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 p-4 sm:p-6"
      role="presentation"
      onMouseDown={(e) => {
        if (lockDismiss) return;
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "modal-shell-title" : undefined}
        className={`ui-card flex max-h-[min(92vh,52rem)] w-full ${maxW} flex-col overflow-hidden shadow-2xl`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {title ? (
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-vex-border/80 px-4 py-3 sm:px-5">
            <h2 id="modal-shell-title" className="text-base font-semibold text-zinc-100">
              {title}
            </h2>
            {!lockDismiss ? (
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-zinc-400 transition hover:bg-vex-bg/60 hover:text-zinc-100"
                aria-label="Fermer"
              >
                <span className="fa-solid fa-xmark" aria-hidden />
              </button>
            ) : null}
          </header>
        ) : null}
        <div className="min-h-0 flex-1 overflow-y-auto vex-scrollbar p-4 sm:p-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
