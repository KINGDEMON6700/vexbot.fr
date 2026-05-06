/** Base de l’API (sans slash final). */
export function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_URL;
  if (raw === undefined || raw === "") {
    throw new Error("VITE_API_URL est manquant dans l’environnement du panel.");
  }
  return String(raw).replace(/\/$/, "");
}

/** fetch vers l’API avec cookies de session. */
export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const base = getApiBaseUrl();
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  return fetch(url, {
    credentials: "include",
    ...init,
    headers: {
      ...init?.headers,
    },
  });
}

export function getDiscordLoginUrl(): string {
  return `${getApiBaseUrl()}/api/auth/discord`;
}
