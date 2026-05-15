import { useAuth } from "../../contexts/AuthContext.js";

type Props = {
  pageTitle: string;
};

export function ConnectPrompt({ pageTitle }: Props) {
  const { startDiscordLogin } = useAuth();

  return (
    <div className="ui-card-interactive relative overflow-hidden p-8 sm:p-10">
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-indigo-500/20 blur-3xl"
        aria-hidden
      />
      <h2 className="text-lg font-semibold text-zinc-100">Connecte-toi</h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-400">
        Pour accéder à « {pageTitle} », connecte ton compte Discord. Ça ne prend qu’un instant.
      </p>
      <button type="button" onClick={startDiscordLogin} className="ui-btn-primary mt-6 py-2.5">
        Se connecter avec Discord
      </button>
    </div>
  );
}
