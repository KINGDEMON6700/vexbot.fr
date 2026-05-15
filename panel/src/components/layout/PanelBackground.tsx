/** Arrière-plan décoratif (aligné sur la landing vexbot.fr). */
export function PanelBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <div className="panel-orb panel-orb-1" />
      <div className="panel-orb panel-orb-2" />
      <div className="panel-orb panel-orb-3" />
      <div className="panel-grid" />
    </div>
  );
}
