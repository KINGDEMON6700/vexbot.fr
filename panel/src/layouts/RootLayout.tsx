import { Outlet } from "react-router-dom";
import { Navbar } from "../components/layout/Navbar.js";
import { PanelBackground } from "../components/layout/PanelBackground.js";
import { PanelRouteTransition } from "../components/layout/PanelRouteTransition.js";
import { useGuild } from "../contexts/GuildContext.js";

export function RootLayout() {
  const { isGuildParamInvalid } = useGuild();

  return (
    <div className="relative min-h-screen bg-vex-bg text-zinc-100">
      <PanelBackground />
      <div className="relative z-10 flex min-h-screen flex-col">
        <Navbar />
        {isGuildParamInvalid ? (
          <div
            className="border-b border-amber-500/25 bg-amber-950/40 px-4 py-2.5 text-center text-sm text-amber-100/95 backdrop-blur-sm"
            role="status"
          >
            Ce serveur ne correspond à rien dans votre liste, ou vous n’y avez plus accès. Choisissez un
            autre serveur dans le menu.
          </div>
        ) : null}
        <main className="mx-auto w-full max-w-6xl flex-1 px-3 py-5 sm:px-6 sm:py-8">
          <PanelRouteTransition>
            <Outlet />
          </PanelRouteTransition>
        </main>
      </div>
    </div>
  );
}
