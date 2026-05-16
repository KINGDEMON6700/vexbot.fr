import { apiFetch } from "./api.js";

export async function resetAccountPanelData(confirmation: string): Promise<void> {
  const res = await apiFetch("/api/account/reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmation }),
  });

  if (!res.ok) {
    let message = "Réinitialisation impossible pour le moment.";
    try {
      const data = (await res.json()) as { message?: unknown };
      if (typeof data.message === "string" && data.message.trim()) {
        message = data.message;
      }
    } catch {
      // Réponse vide ou non JSON.
    }
    throw new Error(message);
  }
}

export type LeaveBotFromGuildsResult = {
  left: number;
  notPresent: number;
  failed: number;
  results: Array<{
    id: string;
    name: string;
    status: "left" | "not_present" | "failed";
    code?: number;
  }>;
};

export async function leaveBotFromAccessibleGuilds(confirmation: string): Promise<LeaveBotFromGuildsResult> {
  const res = await apiFetch("/api/account/bot/leave-accessible-guilds", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmation }),
  });

  if (!res.ok) {
    let message = "Impossible de retirer le bot pour le moment.";
    try {
      const data = (await res.json()) as { message?: unknown };
      if (typeof data.message === "string" && data.message.trim()) {
        message = data.message;
      }
    } catch {
      // Réponse vide ou non JSON.
    }
    throw new Error(message);
  }

  return (await res.json()) as LeaveBotFromGuildsResult;
}
