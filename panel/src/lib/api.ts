/** Base de l’API (sans slash final). */
export function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_URL;
  if (raw === undefined || raw === "") {
    throw new Error("VITE_API_URL est manquant dans l’environnement du panel.");
  }
  return String(raw).replace(/\/$/, "");
}

let csrfTokenPromise: Promise<string | null> | null = null;
const trackingCookieMaxAge = 60 * 60 * 24 * 365;

function needsCsrf(method: string | undefined): boolean {
  const m = (method ?? "GET").toUpperCase();
  return m !== "GET" && m !== "HEAD" && m !== "OPTIONS";
}

async function getCsrfToken(): Promise<string | null> {
  if (!csrfTokenPromise) {
    const base = getApiBaseUrl();
    csrfTokenPromise = fetch(`${base}/api/auth/csrf`, {
      credentials: "include",
    })
      .then(async (res) => {
        if (!res.ok) return null;
        const data = (await res.json()) as { csrfToken?: unknown };
        return typeof data.csrfToken === "string" ? data.csrfToken : null;
      })
      .catch(() => null);
  }
  return csrfTokenPromise;
}

function randomTrackingId(prefix: string): string {
  const bytes = new Uint8Array(12);
  window.crypto.getRandomValues(bytes);
  return `${prefix}_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

function readCookie(name: string): string | null {
  const found = document.cookie
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${name}=`));
  return found ? decodeURIComponent(found.slice(name.length + 1)) : null;
}

function writeTrackingCookie(name: string, value: string): void {
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${trackingCookieMaxAge}; Path=/; Domain=.vexbot.fr; SameSite=Lax; Secure`;
}

export function trackingIds(): { visitorId: string; sessionId: string } {
  const visitorId = readCookie("vex_vid") ?? window.localStorage.getItem("vex_vid") ?? randomTrackingId("v");
  const sessionId = readCookie("vex_sid_public") ?? window.sessionStorage.getItem("vex_sid_public") ?? randomTrackingId("s");
  window.localStorage.setItem("vex_vid", visitorId);
  window.sessionStorage.setItem("vex_sid_public", sessionId);
  writeTrackingCookie("vex_vid", visitorId);
  writeTrackingCookie("vex_sid_public", sessionId);
  return { visitorId, sessionId };
}

export function trackProductEvent(input: {
  type: string;
  source?: string;
  path?: string;
  referrer?: string;
  discordGuildId?: string | null;
  metadata?: unknown;
}): void {
  const base = getApiBaseUrl();
  const ids = trackingIds();
  const payload = JSON.stringify({
    ...input,
    source: input.source ?? "panel",
    path: input.path ?? `${window.location.pathname}${window.location.search}`,
    referrer: input.referrer ?? document.referrer ?? "",
    visitorId: ids.visitorId,
    sessionId: ids.sessionId,
  });
  const url = `${base}/api/public/events`;
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    credentials: "include",
    keepalive: true,
  }).catch(() => undefined);
}

/** fetch vers l’API avec cookies de session. */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const base = getApiBaseUrl();
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = new Headers(init?.headers);
  const ids = trackingIds();
  headers.set("x-vex-visitor-id", ids.visitorId);
  headers.set("x-vex-session-id", ids.sessionId);
  if (needsCsrf(init?.method) && !headers.has("x-csrf-token")) {
    const token = await getCsrfToken();
    if (token) headers.set("x-csrf-token", token);
  }
  const res = await fetch(url, {
    credentials: "include",
    ...init,
    headers,
  });
  const method = (init?.method ?? "GET").toUpperCase();
  if (needsCsrf(method) && !path.startsWith("/api/public/events") && !path.startsWith("/api/admin/tracking-data")) {
    window.dispatchEvent(
      new CustomEvent("vex:api-mutation", {
        detail: {
          method,
          path,
          status: res.status,
          ok: res.ok,
        },
      }),
    );
    trackProductEvent({
      type: res.ok ? "api_mutation_success" : "api_mutation_error",
      source: "panel_api",
      metadata: { method, path, status: res.status },
    });
  }
  return res;
}

export function getDiscordLoginUrl(): string {
  return `${getApiBaseUrl()}/api/auth/discord`;
}
