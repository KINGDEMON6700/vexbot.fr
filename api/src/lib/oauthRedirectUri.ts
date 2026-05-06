import type { Request } from "express";

/**
 * URL exacte du callback OAuth2 (Discord exige la même valeur à l’autorisation et à l’échange du code).
 * Dérivée du Host de la requête pour que ça marche en LAN / IP publique sans rester bloqué sur localhost.
 */
export function resolveOAuthRedirectUriFromRequest(req: Request): string {
  const xfHost = req.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = xfHost || req.get("host")?.trim();
  if (!host) {
    throw new Error("Impossible de déterminer l’URL de callback OAuth (header Host manquant).");
  }
  const xfProto = req.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto = xfProto || req.protocol || "http";
  const origin = `${proto}://${host}`.replace(/\/$/, "");
  return `${origin}/api/auth/callback`;
}
