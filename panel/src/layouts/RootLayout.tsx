import { Outlet } from "react-router-dom";
import { Navbar } from "../components/layout/Navbar.js";
import { PanelBackground } from "../components/layout/PanelBackground.js";
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
            Ce serveur ne correspond à rien dans ta liste, ou tu n’y as plus accès. Choisis un
            autre serveur dans le menu.
          </div>
        ) : null}
        <main className="panel-main-enter mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
