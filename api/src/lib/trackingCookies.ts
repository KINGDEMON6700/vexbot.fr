import type { Request } from "express";

function parseCookieHeader(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (!rawKey || rest.length === 0) continue;
    out[rawKey] = decodeURIComponent(rest.join("="));
  }
  return out;
}

function clean(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(trimmed)) return null;
  return trimmed;
}

export function trackingFromRequest(req: Request): { visitorId: string | null; sessionId: string | null } {
  const cookies = parseCookieHeader(req.get("cookie"));
  return {
    visitorId: clean(req.get("x-vex-visitor-id") ?? cookies.vex_vid),
    sessionId: clean(req.get("x-vex-session-id") ?? cookies.vex_sid_public),
  };
}
