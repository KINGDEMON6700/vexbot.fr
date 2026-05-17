import { Router } from "express";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../db.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { requireSession } from "../middleware/requireSession.js";
import { requireAdmin } from "../middleware/requireAdmin.js";

export const adminStatsRouter = Router();
const BACKUP_DIR = "/home/localvps/backups/vexbot";

function since(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfDayOffset(daysAgo: number): Date {
  const d = startOfToday();
  d.setDate(d.getDate() - daysAgo);
  return d;
}

function endOfDay(start: Date): Date {
  const d = new Date(start);
  d.setDate(d.getDate() + 1);
  return d;
}

function pct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

function parseJourneyRange(raw: unknown): { key: "today" | "7d" | "30d" | "90d" | "all"; start: Date | null } {
  const value = typeof raw === "string" ? raw : "30d";
  if (value === "today") return { key: "today", start: startOfToday() };
  if (value === "7d") return { key: "7d", start: since(7) };
  if (value === "90d") return { key: "90d", start: since(90) };
  if (value === "all") return { key: "all", start: null };
  return { key: "30d", start: since(30) };
}

function guildIdFromPath(pathValue: string | null | undefined): string | null {
  if (!pathValue) return null;
  try {
    const url = new URL(pathValue, "https://panel.vexbot.fr");
    const guild = url.searchParams.get("guild");
    if (guild) return guild;
  } catch {
    // Ignore invalid relative URLs and try route parsing below.
  }
  const match = pathValue.match(/\/api\/guilds\/(\d{5,25})(?:\/|$)/);
  return match?.[1] ?? null;
}

adminStatsRouter.get(
  "/stats",
  requireSession,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const today = startOfToday();
    const since7 = since(7);
    const since30 = since(30);
    const journeyRange = parseJourneyRange(req.query.range);
    const journeyCreatedAtWhere = journeyRange.start ? { createdAt: { gte: journeyRange.start } } : {};
    const [
      usersTotal,
      newUsersToday,
      newUsers7d,
      newUsers30d,
      loginsToday,
      logins7d,
      logins30d,
      inviteClicksToday,
      inviteClicks7d,
      inviteClicks30d,
      landingVisitsToday,
      landingVisits7d,
      landingVisits30d,
      installsToday,
      installs7d,
      installs30d,
      guildsTotal,
      productEvents7d,
    ] =
      await Promise.all([
        prisma.panelUser.count(),
        prisma.panelUser.count({ where: { firstSeenAt: { gte: today } } }),
        prisma.panelUser.count({ where: { firstSeenAt: { gte: since7 } } }),
        prisma.panelUser.count({ where: { firstSeenAt: { gte: since30 } } }),
        prisma.panelLoginEvent.count({ where: { createdAt: { gte: today } } }),
        prisma.panelLoginEvent.count({ where: { createdAt: { gte: since7 } } }),
        prisma.panelLoginEvent.count({ where: { createdAt: { gte: since30 } } }),
        prisma.botInviteEvent.count({ where: { createdAt: { gte: today } } }),
        prisma.botInviteEvent.count({ where: { createdAt: { gte: since7 } } }),
        prisma.botInviteEvent.count({ where: { createdAt: { gte: since30 } } }),
        prisma.productEvent.count({ where: { type: "landing_visit", createdAt: { gte: today } } }),
        prisma.productEvent.count({ where: { type: "landing_visit", createdAt: { gte: since7 } } }),
        prisma.productEvent.count({ where: { type: "landing_visit", createdAt: { gte: since30 } } }),
        prisma.productEvent.count({ where: { type: "bot_installed", createdAt: { gte: today } } }),
        prisma.productEvent.count({ where: { type: "bot_installed", createdAt: { gte: since7 } } }),
        prisma.productEvent.count({ where: { type: "bot_installed", createdAt: { gte: since30 } } }),
        prisma.guild.count(),
        prisma.productEvent.groupBy({
          by: ["type"],
          where: { createdAt: { gte: since7 } },
          _count: { _all: true },
          orderBy: { _count: { type: "desc" } },
          take: 20,
        }),
      ]);

    const [recentLogins, recentInvites, recentEvents, visitorEvents30d, sessionEvents30d, recentUsers, trackedGuilds, allGuilds, allPanelUsers, journeyEvents, loginLinks, activeUserEventsToday] = await Promise.all([
      prisma.panelLoginEvent.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { panelUser: true },
      }),
      prisma.botInviteEvent.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.productEvent.findMany({
        orderBy: { createdAt: "desc" },
        take: 60,
      }),
      prisma.productEvent.findMany({
        where: { createdAt: { gte: since30 }, visitorId: { not: null } },
        select: { visitorId: true },
      }),
      prisma.productEvent.findMany({
        where: { createdAt: { gte: since30 }, sessionId: { not: null } },
        select: { sessionId: true },
      }),
      prisma.panelUser.findMany({
        orderBy: { lastLoginAt: "desc" },
        take: 20,
        include: {
          loginEvents: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      }),
      prisma.guild.findMany({
        orderBy: { updatedAt: "desc" },
        take: 20,
        include: {
          _count: {
            select: {
              embeds: true,
              tickets: true,
              serverTemplates: true,
              customSlashCommands: true,
            },
          },
        },
      }),
      prisma.guild.findMany({
        select: {
          discordId: true,
          name: true,
        },
      }),
      prisma.panelUser.findMany({
        select: {
          discordUserId: true,
          username: true,
          globalName: true,
        },
        take: 1000,
      }),
      prisma.productEvent.findMany({
        where: {
          ...journeyCreatedAtWhere,
          OR: [{ visitorId: { not: null } }, { discordUserId: { not: null } }],
        },
        orderBy: { createdAt: "desc" },
        take: journeyRange.key === "all" ? 5000 : 2500,
      }),
      prisma.panelLoginEvent.findMany({
        where: journeyCreatedAtWhere,
        orderBy: { createdAt: "desc" },
        take: journeyRange.key === "all" ? 1500 : 750,
        include: { panelUser: true },
      }),
      prisma.productEvent.findMany({
        where: { createdAt: { gte: today }, discordUserId: { not: null } },
        select: { discordUserId: true },
      }),
    ]);

    const uniqueVisitors30d = new Set(visitorEvents30d.map((event) => event.visitorId).filter(Boolean)).size;
    const uniqueSessions30d = new Set(sessionEvents30d.map((event) => event.sessionId).filter(Boolean)).size;
    const activeUsersToday = new Set(activeUserEventsToday.map((event) => event.discordUserId).filter(Boolean)).size;
    const dailySummary = await Promise.all(
      Array.from({ length: 7 }, async (_, index) => {
        const day = startOfDayOffset(6 - index);
        const nextDay = endOfDay(day);
        const [logins, newUsers, installs] = await Promise.all([
          prisma.panelLoginEvent.count({ where: { createdAt: { gte: day, lt: nextDay } } }),
          prisma.panelUser.count({ where: { firstSeenAt: { gte: day, lt: nextDay } } }),
          prisma.productEvent.count({ where: { type: "bot_installed", createdAt: { gte: day, lt: nextDay } } }),
        ]);
        return {
          day: day.toISOString().slice(0, 10),
          logins,
          newUsers,
          installs,
        };
      }),
    );

    const userByDiscord = new Map<string, { discordUserId: string; username: string; globalName: string | null }>();
    const visitorUsers = new Map<string, Map<string, { discordUserId: string; username: string; globalName: string | null }>>();
    const sessionUsers = new Map<string, Map<string, { discordUserId: string; username: string; globalName: string | null }>>();
    for (const user of allPanelUsers) {
      userByDiscord.set(user.discordUserId, {
        discordUserId: user.discordUserId,
        username: user.username,
        globalName: user.globalName,
      });
    }
    for (const login of loginLinks) {
      const userInfo = {
        discordUserId: login.discordUserId,
        username: login.panelUser.username,
        globalName: login.panelUser.globalName,
      };
      userByDiscord.set(login.discordUserId, userInfo);
      if (login.visitorId) {
        const users = visitorUsers.get(login.visitorId) ?? new Map();
        users.set(login.discordUserId, userInfo);
        visitorUsers.set(login.visitorId, users);
      }
      if (login.sessionId) {
        const users = sessionUsers.get(login.sessionId) ?? new Map();
        users.set(login.discordUserId, userInfo);
        sessionUsers.set(login.sessionId, users);
      }
    }
    for (const event of journeyEvents) {
      if (!event.discordUserId) continue;
      const existing = userByDiscord.get(event.discordUserId);
      const userInfo = existing ?? {
        discordUserId: event.discordUserId,
        username: event.discordUserId,
        globalName: null,
      };
      if (event.visitorId) {
        const users = visitorUsers.get(event.visitorId) ?? new Map();
        users.set(event.discordUserId, userInfo);
        visitorUsers.set(event.visitorId, users);
      }
      if (event.sessionId) {
        const sessionLinkedUsers = sessionUsers.get(event.sessionId) ?? new Map();
        sessionLinkedUsers.set(event.discordUserId, userInfo);
        sessionUsers.set(event.sessionId, sessionLinkedUsers);
      }
    }

    const safeVisitorToUser = new Map<string, { discordUserId: string; username: string; globalName: string | null }>();
    const safeSessionToUser = new Map<string, { discordUserId: string; username: string; globalName: string | null }>();
    const ambiguousVisitorIds = new Set<string>();
    const ambiguousSessionIds = new Set<string>();
    for (const [visitorId, users] of visitorUsers) {
      if (users.size === 1) {
        safeVisitorToUser.set(visitorId, Array.from(users.values())[0]);
      } else {
        ambiguousVisitorIds.add(visitorId);
      }
    }
    for (const [sessionId, users] of sessionUsers) {
      if (users.size === 1) {
        safeSessionToUser.set(sessionId, Array.from(users.values())[0]);
      } else {
        ambiguousSessionIds.add(sessionId);
      }
    }

    const userToVisitors = new Map<string, Set<string>>();
    for (const [visitorId, linked] of safeVisitorToUser) {
      const visitors = userToVisitors.get(linked.discordUserId) ?? new Set<string>();
      visitors.add(visitorId);
      userToVisitors.set(linked.discordUserId, visitors);
    }

    const eventUserKey = (event: (typeof journeyEvents)[number]): string | null => {
      if (event.discordUserId) return event.discordUserId;
      if (event.sessionId && !ambiguousSessionIds.has(event.sessionId)) {
        const sessionUser = safeSessionToUser.get(event.sessionId);
        if (sessionUser) return sessionUser.discordUserId;
      }
      if (!event.visitorId) return null;
      if (ambiguousVisitorIds.has(event.visitorId)) return null;
      return safeVisitorToUser.get(event.visitorId)?.discordUserId ?? null;
    };

    const guildByDiscordId = new Map(allGuilds.map((guild) => [guild.discordId, guild]));

    const mapJourneyEvent = (event: (typeof journeyEvents)[number]) => {
      const metadata = event.metadata && typeof event.metadata === "object" ? (event.metadata as Record<string, unknown>) : {};
      const metadataPath = typeof metadata.path === "string" ? metadata.path : null;
      const guildId = event.discordGuildId ?? guildIdFromPath(event.path) ?? guildIdFromPath(metadataPath);
      const guild = guildId ? guildByDiscordId.get(guildId) : null;
      const linkedDiscordUserId = eventUserKey(event);
      return {
        id: event.id,
        type: event.type,
        source: event.source,
        path: event.path,
        visitorId: event.visitorId,
        sessionId: event.sessionId,
        discordUserId: event.discordUserId ?? linkedDiscordUserId,
        discordGuildId: guildId,
        guildName: guild?.name ?? null,
        metadata: event.metadata,
        createdAt: event.createdAt.toISOString(),
      };
    };

    const userJourneyKeys = Array.from(
      new Set(
        journeyEvents
          .map(eventUserKey)
          .concat(loginLinks.map((login) => login.discordUserId))
          .filter((key): key is string => Boolean(key)),
      ),
    );
    const visitorJourneyKeys = Array.from(
      new Set(
        journeyEvents
          .filter((event) => event.visitorId && !eventUserKey(event))
          .map((event) => event.visitorId!)
      ),
    );

    const journeys = [
      ...userJourneyKeys.map((key) => {
        const linkedVisitors = Array.from(userToVisitors.get(key) ?? []);
        const events = journeyEvents
          .filter((event) => eventUserKey(event) === key)
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
          .slice(-250)
          .map(mapJourneyEvent);
        const linked = userByDiscord.get(key) ?? safeVisitorToUser.get(linkedVisitors[0] ?? "");
        return {
          key,
          label: linked?.globalName || linked?.username || key,
          discordUsername: linked?.username ?? null,
          kind: "user" as const,
          linkStatus: "confirmed" as const,
          linkNote: "Lien confirmé par connexion Discord ou session active.",
          linkedVisitorId: linkedVisitors[0] ?? null,
          linkedVisitorIds: linkedVisitors,
          convertedDiscordUserId: key,
          events,
        };
      }),
      ...visitorJourneyKeys.map((key) => {
        const events = journeyEvents
          .filter((event) => event.visitorId === key && !eventUserKey(event))
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
          .slice(-250)
          .map(mapJourneyEvent);
        const isSharedDevice = ambiguousVisitorIds.has(key);
        return {
          key,
          label: isSharedDevice ? `Navigateur partagé ${key}` : `Visiteur ${key}`,
          discordUsername: null,
          kind: "visitor" as const,
          linkStatus: isSharedDevice ? ("shared_device" as const) : ("anonymous" as const),
          linkNote: isSharedDevice
            ? "Plusieurs comptes Discord ont utilisé ce navigateur, donc le lien reste séparé."
            : "Aucune connexion Discord sûre trouvée pour ce visiteur.",
          linkedVisitorId: key,
          linkedVisitorIds: [key],
          convertedDiscordUserId: null,
          events,
        };
      }),
    ]
      .filter((journey) => journey.events.length > 0)
      .sort((a, b) => {
        const lastA = a.events[a.events.length - 1]?.createdAt ?? "";
        const lastB = b.events[b.events.length - 1]?.createdAt ?? "";
        return new Date(lastB).getTime() - new Date(lastA).getTime();
      })
      .slice(0, 50)
      .map((() => {
        let visitorRank = 0;
        return (journey) => {
        if (journey.kind !== "visitor") return journey;
        visitorRank += 1;
        return {
          ...journey,
          label: journey.linkStatus === "shared_device" ? `Navigateur partagé #${visitorRank}` : `Visiteur #${visitorRank}`,
        };
        };
      })());

    res.json({
      range: journeyRange.key,
      totals: {
        usersTotal,
        guildsTotal,
        newUsersToday,
        newUsers7d,
        newUsers30d,
        loginsToday,
        logins7d,
        logins30d,
        inviteClicksToday,
        inviteClicks7d,
        inviteClicks30d,
        landingVisitsToday,
        landingVisits7d,
        landingVisits30d,
        installsToday,
        installs7d,
        installs30d,
        uniqueVisitors30d,
        uniqueSessions30d,
        activeUsersToday,
      },
      funnel30d: {
        landingVisits: landingVisits30d,
        inviteClicks: inviteClicks30d,
        botInstalls: installs30d,
        panelLogins: logins30d,
        inviteClickRate: pct(inviteClicks30d, landingVisits30d),
        installRate: pct(installs30d, inviteClicks30d),
        loginRate: pct(logins30d, installs30d),
      },
      productEvents7d: productEvents7d.map((row) => ({
        type: row.type,
        count: row._count._all,
      })),
      dailySummary,
      recentLogins: recentLogins.map((row) => ({
        id: row.id,
        discordUserId: row.discordUserId,
        username: row.panelUser.username,
        globalName: row.panelUser.globalName,
        createdAt: row.createdAt.toISOString(),
      })),
      recentInvites: recentInvites.map((row) => ({
        id: row.id,
        source: row.source,
        discordGuildId: row.discordGuildId,
        createdAt: row.createdAt.toISOString(),
      })),
      recentEvents: recentEvents.map((row) => ({
        id: row.id,
        type: row.type,
        source: row.source,
        path: row.path,
        visitorId: row.visitorId,
        sessionId: row.sessionId,
        discordUserId: row.discordUserId,
        discordGuildId: row.discordGuildId,
        metadata: row.metadata,
        createdAt: row.createdAt.toISOString(),
      })),
      recentUsers: recentUsers.map((row) => ({
        id: row.id,
        discordUserId: row.discordUserId,
        username: row.username,
        globalName: row.globalName,
        firstSeenAt: row.firstSeenAt.toISOString(),
        lastLoginAt: row.lastLoginAt.toISOString(),
        loginCount: row.loginCount,
        lastVisitorId: row.loginEvents[0]?.visitorId ?? null,
        lastSessionId: row.loginEvents[0]?.sessionId ?? null,
      })),
      trackedGuilds: trackedGuilds.map((guild) => ({
        id: guild.id,
        discordId: guild.discordId,
        name: guild.name,
        createdAt: guild.createdAt.toISOString(),
        updatedAt: guild.updatedAt.toISOString(),
        embedCount: guild._count.embeds,
        ticketCount: guild._count.tickets,
        templateCount: guild._count.serverTemplates,
        customCommandCount: guild._count.customSlashCommands,
      })),
      journeys,
      visitorLinks: Array.from(safeVisitorToUser.entries()).slice(0, 30).map(([visitorId, linked]) => ({
        visitorId,
        ...linked,
      })),
      visitorWarnings: Array.from(ambiguousVisitorIds).slice(0, 20).map((visitorId) => ({
        visitorId,
        reason: "Plusieurs comptes Discord ont utilisé ce même navigateur.",
      })),
    });
  }),
);

adminStatsRouter.get(
  "/health",
  requireSession,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const dbOk = await prisma.$queryRaw`SELECT 1`;
    let latestBackup: { file: string; size: number; mtime: string } | null = null;
    try {
      const files = (await readdir(BACKUP_DIR)).filter((file) => file.endsWith(".db"));
      const stats = await Promise.all(
        files.map(async (file) => {
          const info = await stat(path.join(BACKUP_DIR, file));
          return { file, size: info.size, mtime: info.mtime };
        }),
      );
      stats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
      if (stats[0]) {
        latestBackup = {
          file: stats[0].file,
          size: stats[0].size,
          mtime: stats[0].mtime.toISOString(),
        };
      }
    } catch {
      latestBackup = null;
    }
    res.json({
      api: true,
      database: Boolean(dbOk),
      latestBackup,
      checkedAt: new Date().toISOString(),
    });
  }),
);

adminStatsRouter.delete(
  "/tracking-data",
  requireSession,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const [productEvents, panelLogins, botInvites, snapshots] = await prisma.$transaction([
      prisma.productEvent.deleteMany(),
      prisma.panelLoginEvent.deleteMany(),
      prisma.botInviteEvent.deleteMany(),
      prisma.dailyMetricSnapshot.deleteMany(),
    ]);

    res.json({
      deleted: {
        productEvents: productEvents.count,
        panelLogins: panelLogins.count,
        botInvites: botInvites.count,
        snapshots: snapshots.count,
      },
    });
  }),
);
