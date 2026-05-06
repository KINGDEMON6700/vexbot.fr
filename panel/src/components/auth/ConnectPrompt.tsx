import { useAuth } from "../../contexts/AuthContext.js";

type Props = {
  pageTitle: string;
};

export function ConnectPrompt({ pageTitle }: Props) {
  const { startDiscordLogin } = useAuth();

  return (
    <div className="rounded-xl border border-vex-border bg-vex-surface p-8 shadow-lg">
      <h2 className="text-lg font-semibold text-zinc-100">Connecte-toi</h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-400">
        Pour accéder à « {pageTitle} », connecte ton compte Discord. Ça ne prend qu’un
        instant.
      </p>
      <button
        type="button"
        onClick={startDiscordLogin}
        className="mt-6 rounded-lg bg-vex-accent px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
      >
        Se connecter avec Discord
      </button>
    </div>
  );
}
