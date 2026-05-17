import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { Request } from "express";
import geoip from "geoip-lite";
import type { DiscordUser } from "../types/discord.js";

type TrackProductEventInput = {
  type: string;
  source?: string | null;
  path?: string | null;
  referrer?: string | null;
  visitorId?: string | null;
  sessionId?: string | null;
  discordUserId?: string | null;
  discordGuildId?: string | null;
  metadata?: unknown;
};

type BusinessEventMetadataInput = {
  category?: "business" | "page" | "ui" | "system";
  entity: string;
  action: string;
  name?: string | null;
  target?: string | null;
  success?: boolean;
  before?: unknown;
  after?: unknown;
  [key: string]: unknown;
};

function trim(value: string | null | undefined, max: number): string | null {
  const normalized = value?.trim();
  if (!normalized) return null;
  return normalized.slice(0, max);
}

export function hashIp(ip: string | undefined): string | null {
  if (!ip) return null;
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

function clientIpFromRequest(req: Request): string | null {
  const forwarded = req.get("x-forwarded-for")?.split(",")[0]?.trim();
  const candidates = [
    req.get("cf-connecting-ip"),
    req.get("x-real-ip"),
    forwarded,
    req.ip,
    req.socket.remoteAddress,
  ];
  for (const candidate of candidates) {
    const normalized = candidate?.replace(/^::ffff:/, "").trim();
    if (normalized) return normalized;
  }
  return null;
}

function maskIp(ip: string | undefined): string | null {
  if (!ip) return null;
  const normalized = ip.replace(/^::ffff:/, "").trim();
  if (!normalized) return null;
  if (normalized.includes(".")) {
    const parts = normalized.split(".");
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
  }
  if (normalized.includes(":")) {
    const parts = normalized.split(":").filter(Boolean);
    return `${parts.slice(0, 2).join(":")}:xxxx`;
  }
  return "masquée";
}

function cleanCountry(value: string | undefined): string | null {
  const normalized = value?.trim().toUpperCase();
  if (!normalized || !/^[A-Z]{2}$/.test(normalized)) return null;
  return normalized;
}

function countryFromLocalGeoIp(ip: string | null): string | null {
  if (!ip) return null;
  return cleanCountry(geoip.lookup(ip)?.country);
}

export function networkMetadataFromRequest(req: Request): {
  ipHash: string | null;
  ipMasked: string | null;
  ipFull: string | null;
  country: string | null;
  userAgent: string | null;
} {
  const ip = clientIpFromRequest(req);
  const country =
    cleanCountry(req.get("cf-ipcountry")) ??
    cleanCountry(req.get("x-vercel-ip-country")) ??
    cleanCountry(req.get("x-country-code")) ??
    countryFromLocalGeoIp(ip);
  return {
    ipHash: hashIp(ip ?? undefined),
    ipMasked: maskIp(ip ?? undefined),
    ipFull: trim(ip, 80),
    country,
    userAgent: trim(req.get("user-agent"), 500),
  };
}

export function businessEventMetadata(input: BusinessEventMetadataInput): Record<string, unknown> {
  const out: Record<string, unknown> = {
    category: input.category ?? "business",
    entity: input.entity,
    action: input.action,
    success: input.success ?? true,
  };
  if (input.name) out.name = input.name;
  if (input.target) out.target = input.target;
  if (input.before !== undefined) out.before = input.before;
  if (input.after !== undefined) out.after = input.after;
  for (const [key, value] of Object.entries(input)) {
    if (["category", "entity", "action", "name", "target", "success", "before", "after"].includes(key)) continue;
    if (value !== undefined) out[key] = value;
  }
  return out;
}

export async function recordPanelLogin(
  prisma: PrismaClient,
  user: DiscordUser,
  tracking?: { visitorId?: string | null; sessionId?: string | null },
) {
  const panelUser = await prisma.panelUser.upsert({
    where: { discordUserId: user.id },
    create: {
      discordUserId: user.id,
      username: user.username,
      globalName: user.global_name,
      avatar: user.avatar,
      loginCount: 1,
    },
    update: {
      username: user.username,
      globalName: user.global_name,
      avatar: user.avatar,
      lastLoginAt: new Date(),
      loginCount: { increment: 1 },
    },
    select: { id: true },
  });

  await prisma.panelLoginEvent.create({
    data: {
      panelUserId: panelUser.id,
      discordUserId: user.id,
      visitorId: trim(tracking?.visitorId, 80),
      sessionId: trim(tracking?.sessionId, 80),
    },
  });
}

export async function recordBotInviteClick(
  prisma: PrismaClient,
  input: {
    source: string;
    discordGuildId?: string | null;
    visitorId?: string | null;
    sessionId?: string | null;
    userAgent?: string | null;
    ipHash?: string | null;
  },
) {
  await prisma.botInviteEvent.create({
    data: {
      source: trim(input.source, 80) ?? "unknown",
      discordGuildId: trim(input.discordGuildId, 32),
      visitorId: trim(input.visitorId, 80),
      sessionId: trim(input.sessionId, 80),
      userAgent: trim(input.userAgent, 500),
      ipHash: input.ipHash,
    },
  });
}

export async function recordProductEvent(prisma: PrismaClient, input: TrackProductEventInput) {
  await prisma.productEvent.create({
    data: {
      type: trim(input.type, 80) ?? "unknown",
      source: trim(input.source, 80),
      path: trim(input.path, 300),
      referrer: trim(input.referrer, 500),
      visitorId: trim(input.visitorId, 80),
      sessionId: trim(input.sessionId, 80),
      discordUserId: trim(input.discordUserId, 32),
      discordGuildId: trim(input.discordGuildId, 32),
      metadata: input.metadata === undefined ? undefined : (input.metadata as object),
    },
  });
}
