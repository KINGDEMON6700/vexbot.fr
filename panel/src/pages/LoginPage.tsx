import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.js";
import { PageAuthSkeleton } from "../components/ui/PageSkeleton.js";

type LoginLocationState = {
  pageTitle?: string;
};

export function LoginPage() {
  const { status, user, startDiscordLogin } = useAuth();
  const location = useLocation();
  const state = location.state as LoginLocationState | null;
  const pageTitle = state?.pageTitle;

  if (status === "loading") {
    return (
      <PageAuthSkeleton
        title="Connexion"
        description="Préparation de la connexion Discord."
      />
    );
  }

  if (user) {
    return <Navigate to="/select-server" replace />;
  }

  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="ui-card-interactive relative overflow-hidden p-8 text-center sm:p-10">
        <div
          className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full bg-indigo-500/20 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-20 -right-16 h-56 w-56 rounded-full bg-violet-500/15 blur-3xl"
          aria-hidden
        />

        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-200/80">
            VexBot
          </p>
          <h1 className="mt-3 text-2xl font-bold text-zinc-50 sm:text-3xl">
            Connexion au panel
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-zinc-400">
            Connectez votre compte Discord pour choisir un serveur et gérer VexBot.
          </p>
          {pageTitle ? (
            <p className="mt-3 text-xs text-zinc-500">
              Page demandée : <span className="text-zinc-300">{pageTitle}</span>
            </p>
          ) : null}

          <button
            type="button"
            onClick={startDiscordLogin}
            className="ui-btn-primary mt-7 inline-flex items-center justify-center gap-2 py-2.5"
          >
            <span className="fa-brands fa-discord" aria-hidden />
            Se connecter avec Discord
          </button>
        </div>
      </div>
    </section>
  );
}
