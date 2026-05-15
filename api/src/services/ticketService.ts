import { Prisma, type PrismaClient, type TicketCloseReason, type TicketStatus, type TranscriptFormat } from "@prisma/client";
import { AppError } from "../lib/AppError.js";
import {
  parseTicketPanelOpenConfig,
  type TicketPanelOpenConfig,
  validateTicketPanelOpenConfigBody,
} from "../lib/ticketPanelOpenConfig.js";
import { ensureGuildForDiscord } from "./ensureGuild.js";
import {
  enrichTicketListWithDiscord,
  getDiscordBotSelfCached,
  resolveTicketDiscordDisplay,
} from "./ticketDetailDiscordResolve.js";

export type GuildTicketSettingsDto = {
  panelChannelId: string | null;
  panelMessageId: string | null;
  ticketCategoryId: string | null;
  welcomeEmbedId: string | null;
  /** Modèle Embeds optionnel pour le message panneau (bouton ou liste + formulaire ajoutés automatiquement). */
  panelEmbedId: string | null;
  /** null en base = comportement par défaut (bouton « Ouvrir un ticket »). */
  panelOpenConfig: TicketPanelOpenConfig | null;
  /** Bouton « fermer » sous le message d’accueil (auteur ou équipe). */
  welcomeMemberCloseButton: boolean;
  /** Couleur du bouton « fermer le ticket » sur Discord. */
  welcomeMemberCloseButtonStyle: DiscordButtonStyle;
  /** Bouton « ajouter » sous le message d’accueil (fenêtre pour l’ID du membre). */
  welcomeMemberAddButton: boolean;
  welcomeMemberAddButtonStyle: DiscordButtonStyle;
  /** Saisie libre ou `<:nom:id>` ; null = emoji par défaut (🔒 / 👥). */
  welcomeMemberCloseButtonEmoji: string | null;
  welcomeMemberAddButtonEmoji: string | null;
  /** Tickets encore ouverts par la même personne (1–25). */
  maxOpenTicketsPerOpener: number;
};

export type DiscordButtonStyle = "primary" | "secondary" | "success" | "danger";

const VALID_BUTTON_STYLES: ReadonlySet<DiscordButtonStyle> = new Set([
  "primary",
  "secondary",
  "success",
  "danger",
]);

function isValidButtonStyle(v: unknown): v is DiscordButtonStyle {
  return typeof v === "string" && VALID_BUTTON_STYLES.has(v as DiscordButtonStyle);
}

const MAX_OPEN_TICKETS_PER_OPENER_CAP = 25;

function clampMaxOpenTicketsPerOpener(n: number): number {
  if (!Number.isFinite(n) || Number.isNaN(n)) return 1;
  const i = Math.trunc(n);
  if (i < 1) return 1;
  if (i > MAX_OPEN_TICKETS_PER_OPENER_CAP) return MAX_OPEN_TICKETS_PER_OPENER_CAP;
  return i;
}

function normalizeMaxOpenTicketsPerOpenerWhenPresent(raw: unknown): number {
  if (typeof raw === "number" && Number.isInteger(raw)) {
    return clampMaxOpenTicketsPerOpener(raw);
  }
  if (typeof raw === "string" && /^\d+$/.test(raw.trim())) {
    return clampMaxOpenTicketsPerOpener(parseInt(raw.trim(), 10));
  }
  throw new AppError(
    400,
    "maxOpenTicketsPerOpener doit être un entier entre 1 et 25.",
    "INVALID_FIELD",
  );
}

function normalizeWelcomeMemberButtonEmoji(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "string") {
    throw new AppError(400, "L’emoji du bouton doit être une chaîne de caractères ou vide.", "INVALID_FIELD");
  }
  const t = raw.trim();
  if (!t) return null;
  if (t.length > 100) {
    throw new AppError(400, "L’emoji du bouton est trop long (100 caractères max).", "INVALID_FIELD");
  }
  return t;
}

const PATCHABLE_KEYS = [
  "panelChannelId",
  "panelMessageId",
  "ticketCategoryId",
  "welcomeEmbedId",
  "panelEmbedId",
  "panelOpenConfig",
] as const;

function normalizeDiscordId(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  if (!/^\d{5,25}$/.test(s)) {
    throw new AppError(400, "Identifiant de salon Discord invalide.", "INVALID_ID");
  }
  return s;
}

/** Id interne Prisma du modèle d’embed (cuid), pas un identifiant Discord. */
function normalizeEmbedTemplateId(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  if (!/^[a-zA-Z0-9_.-]{8,64}$/.test(s)) {
    throw new AppError(400, "Référence du modèle d’embed invalide.", "INVALID_EMBED_REF");
  }
  return s;
}

export async function getGuildTicketSettingsDto(
  prisma: PrismaClient,
  discordGuildId: string,
): Promise<GuildTicketSettingsDto | null> {
  const guild = await prisma.guild.findUnique({
    where: { discordId: discordGuildId },
    select: { id: true },
  });
  if (!guild) return null;
  const row = await prisma.guildTicketSettings.findUnique({
    where: { guildId: guild.id },
  });
  if (!row) {
    return {
      panelChannelId: null,
      panelMessageId: null,
      ticketCategoryId: null,
      welcomeEmbedId: null,
      panelEmbedId: null,
      panelOpenConfig: null,
      welcomeMemberCloseButton: false,
      welcomeMemberCloseButtonStyle: "danger",
      welcomeMemberAddButton: false,
      welcomeMemberAddButtonStyle: "primary",
      welcomeMemberCloseButtonEmoji: null,
      welcomeMemberAddButtonEmoji: null,
      maxOpenTicketsPerOpener: 1,
    };
  }
  return {
    panelChannelId: row.panelChannelId,
    panelMessageId: row.panelMessageId,
    ticketCategoryId: row.ticketCategoryId,
    welcomeEmbedId: row.welcomeEmbedId,
    panelEmbedId: row.panelEmbedId,
    panelOpenConfig: parseTicketPanelOpenConfig(row.panelOpenConfig),
    welcomeMemberCloseButton: row.welcomeMemberCloseButton ?? false,
    welcomeMemberCloseButtonStyle: isValidButtonStyle(row.welcomeMemberCloseButtonStyle)
      ? row.welcomeMemberCloseButtonStyle
      : "danger",
    welcomeMemberAddButton: row.welcomeMemberAddButton ?? false,
    welcomeMemberAddButtonStyle: isValidButtonStyle(row.welcomeMemberAddButtonStyle)
      ? row.welcomeMemberAddButtonStyle
      : "primary",
    welcomeMemberCloseButtonEmoji: row.welcomeMemberCloseButtonEmoji ?? null,
    welcomeMemberAddButtonEmoji: row.welcomeMemberAddButtonEmoji ?? null,
    maxOpenTicketsPerOpener: clampMaxOpenTicketsPerOpener(row.maxOpenTicketsPerOpener ?? 1),
  };
}

export async function upsertGuildTicketSettings(
  prisma: PrismaClient,
  discordGuildId: string,
  guildNameHint: string | null | undefined,
  body: unknown,
): Promise<GuildTicketSettingsDto> {
  const raw = body && typeof body === "object" ? (body as Record<string, unknown>) : {};

  if (Object.prototype.hasOwnProperty.call(raw, "panelMessageId")) {
    throw new AppError(400, "Le message panneau est géré par le bot.", "FORBIDDEN_FIELD");
  }

  const guildId = await ensureGuildForDiscord(prisma, discordGuildId, guildNameHint);

  type Key = "panelChannelId" | "ticketCategoryId" | "welcomeEmbedId" | "panelEmbedId";
  const updates: Partial<Record<Key, string | null>> = {};
  let nextPanelOpenJson: Prisma.InputJsonValue | null | undefined;
  if (Object.prototype.hasOwnProperty.call(raw, "panelOpenConfig")) {
    const v = raw.panelOpenConfig;
    if (v === null) {
      nextPanelOpenJson = null;
    } else {
      try {
        const parsed = validateTicketPanelOpenConfigBody(v);
        nextPanelOpenJson = parsed as unknown as Prisma.InputJsonValue;
      } catch (e) {
        throw new AppError(400, e instanceof Error ? e.message : "panelOpenConfig invalide.", "INVALID_PANEL_OPEN");
      }
    }
  }

  for (const key of PATCHABLE_KEYS) {
    if (key === "panelMessageId" || key === "panelOpenConfig") continue;
    if (!Object.prototype.hasOwnProperty.call(raw, key)) continue;
    if (key === "welcomeEmbedId" || key === "panelEmbedId") {
      (updates as Record<string, string | null>)[key] = normalizeEmbedTemplateId(raw[key]);
    } else {
      (updates as Record<string, string | null>)[key] = normalizeDiscordId(raw[key]);
    }
  }

  for (const embedKey of ["welcomeEmbedId", "panelEmbedId"] as const) {
    const id = updates[embedKey];
    if (id) {
      const embedOk = await prisma.embed.findFirst({
        where: { id, guildId },
        select: { id: true },
      });
      if (!embedOk) {
        throw new AppError(400, "Ce modèle d’embed n’existe pas sur ce serveur.", "EMBED_NOT_FOUND");
      }
    }
  }

  const existing = await prisma.guildTicketSettings.findUnique({ where: { guildId } });

  let nextWelcomeMemberClose: boolean | undefined;
  if (Object.prototype.hasOwnProperty.call(raw, "welcomeMemberCloseButton")) {
    const v = raw.welcomeMemberCloseButton;
    if (typeof v !== "boolean") {
      throw new AppError(400, "welcomeMemberCloseButton doit être true ou false.", "INVALID_FIELD");
    }
    nextWelcomeMemberClose = v;
  }

  let nextWelcomeMemberCloseStyle: DiscordButtonStyle | undefined;
  if (Object.prototype.hasOwnProperty.call(raw, "welcomeMemberCloseButtonStyle")) {
    const v = raw.welcomeMemberCloseButtonStyle;
    if (!isValidButtonStyle(v)) {
      throw new AppError(
        400,
        "welcomeMemberCloseButtonStyle doit être 'primary', 'secondary', 'success' ou 'danger'.",
        "INVALID_FIELD",
      );
    }
    nextWelcomeMemberCloseStyle = v;
  }

  let nextWelcomeMemberAdd: boolean | undefined;
  if (Object.prototype.hasOwnProperty.call(raw, "welcomeMemberAddButton")) {
    const v = raw.welcomeMemberAddButton;
    if (typeof v !== "boolean") {
      throw new AppError(400, "welcomeMemberAddButton doit être true ou false.", "INVALID_FIELD");
    }
    nextWelcomeMemberAdd = v;
  }

  let nextWelcomeMemberAddStyle: DiscordButtonStyle | undefined;
  if (Object.prototype.hasOwnProperty.call(raw, "welcomeMemberAddButtonStyle")) {
    const v = raw.welcomeMemberAddButtonStyle;
    if (!isValidButtonStyle(v)) {
      throw new AppError(
        400,
        "welcomeMemberAddButtonStyle doit être 'primary', 'secondary', 'success' ou 'danger'.",
        "INVALID_FIELD",
      );
    }
    nextWelcomeMemberAddStyle = v;
  }

  let nextWelcomeMemberCloseEmoji: string | null | undefined;
  if (Object.prototype.hasOwnProperty.call(raw, "welcomeMemberCloseButtonEmoji")) {
    nextWelcomeMemberCloseEmoji = normalizeWelcomeMemberButtonEmoji(raw.welcomeMemberCloseButtonEmoji);
  }

  let nextWelcomeMemberAddEmoji: string | null | undefined;
  if (Object.prototype.hasOwnProperty.call(raw, "welcomeMemberAddButtonEmoji")) {
    nextWelcomeMemberAddEmoji = normalizeWelcomeMemberButtonEmoji(raw.welcomeMemberAddButtonEmoji);
  }

  let nextMaxOpenTicketsPerOpener: number | undefined;
  if (Object.prototype.hasOwnProperty.call(raw, "maxOpenTicketsPerOpener")) {
    nextMaxOpenTicketsPerOpener = normalizeMaxOpenTicketsPerOpenerWhenPresent(raw.maxOpenTicketsPerOpener);
  }

  const nextPanel = updates.panelChannelId !== undefined ? updates.panelChannelId : (existing?.panelChannelId ?? null);
  const nextCat =
    updates.ticketCategoryId !== undefined ? updates.ticketCategoryId : (existing?.ticketCategoryId ?? null);
  const nextWelcome =
    updates.welcomeEmbedId !== undefined ? updates.welcomeEmbedId : (existing?.welcomeEmbedId ?? null);
  const nextPanelEmbed =
    updates.panelEmbedId !== undefined ? updates.panelEmbedId : (existing?.panelEmbedId ?? null);

  const clearingPanel = updates.panelChannelId !== undefined && updates.panelChannelId === null;

  const panelOpenPrisma =
    nextPanelOpenJson === undefined
      ? {}
      : {
          panelOpenConfig:
            nextPanelOpenJson === null ? Prisma.DbNull : (nextPanelOpenJson as Prisma.InputJsonValue),
        };

  const memberClosePrisma =
    nextWelcomeMemberClose !== undefined ? { welcomeMemberCloseButton: nextWelcomeMemberClose } : {};

  const memberCloseStylePrisma =
    nextWelcomeMemberCloseStyle !== undefined
      ? { welcomeMemberCloseButtonStyle: nextWelcomeMemberCloseStyle }
      : {};

  const memberAddPrisma =
    nextWelcomeMemberAdd !== undefined ? { welcomeMemberAddButton: nextWelcomeMemberAdd } : {};

  const memberAddStylePrisma =
    nextWelcomeMemberAddStyle !== undefined
      ? { welcomeMemberAddButtonStyle: nextWelcomeMemberAddStyle }
      : {};

  const memberCloseEmojiPrisma =
    nextWelcomeMemberCloseEmoji !== undefined
      ? { welcomeMemberCloseButtonEmoji: nextWelcomeMemberCloseEmoji }
      : {};

  const memberAddEmojiPrisma =
    nextWelcomeMemberAddEmoji !== undefined ? { welcomeMemberAddButtonEmoji: nextWelcomeMemberAddEmoji } : {};

  const maxOpenTicketsPrisma =
    nextMaxOpenTicketsPerOpener !== undefined
      ? { maxOpenTicketsPerOpener: nextMaxOpenTicketsPerOpener }
      : {};

  await prisma.guildTicketSettings.upsert({
    where: { guildId },
    create: {
      guildId,
      panelChannelId: nextPanel,
      ticketCategoryId: nextCat,
      welcomeEmbedId: nextWelcome,
      panelEmbedId: nextPanelEmbed,
      welcomeMemberCloseButton: nextWelcomeMemberClose ?? false,
      welcomeMemberCloseButtonStyle: nextWelcomeMemberCloseStyle ?? "danger",
      welcomeMemberAddButton: nextWelcomeMemberAdd ?? false,
      welcomeMemberAddButtonStyle: nextWelcomeMemberAddStyle ?? "primary",
      welcomeMemberCloseButtonEmoji: nextWelcomeMemberCloseEmoji ?? null,
      welcomeMemberAddButtonEmoji: nextWelcomeMemberAddEmoji ?? null,
      maxOpenTicketsPerOpener: nextMaxOpenTicketsPerOpener ?? 1,
      ...panelOpenPrisma,
    },
    update: {
      ...(updates.panelChannelId !== undefined ? { panelChannelId: updates.panelChannelId } : {}),
      ...(updates.ticketCategoryId !== undefined ? { ticketCategoryId: updates.ticketCategoryId } : {}),
      ...(updates.welcomeEmbedId !== undefined ? { welcomeEmbedId: updates.welcomeEmbedId } : {}),
      ...(updates.panelEmbedId !== undefined ? { panelEmbedId: updates.panelEmbedId } : {}),
      ...memberClosePrisma,
      ...memberCloseStylePrisma,
      ...memberAddPrisma,
      ...memberAddStylePrisma,
      ...memberCloseEmojiPrisma,
      ...memberAddEmojiPrisma,
      ...maxOpenTicketsPrisma,
      ...panelOpenPrisma,
      ...(clearingPanel ? { panelMessageId: null } : {}),
    },
  });

  const out = await prisma.guildTicketSettings.findUnique({ where: { guildId } });
  return {
    panelChannelId: out?.panelChannelId ?? null,
    panelMessageId: out?.panelMessageId ?? null,
    ticketCategoryId: out?.ticketCategoryId ?? null,
    welcomeEmbedId: out?.welcomeEmbedId ?? null,
    panelEmbedId: out?.panelEmbedId ?? null,
    panelOpenConfig: parseTicketPanelOpenConfig(out?.panelOpenConfig ?? null),
    welcomeMemberCloseButton: out?.welcomeMemberCloseButton ?? false,
    welcomeMemberCloseButtonStyle: isValidButtonStyle(out?.welcomeMemberCloseButtonStyle)
      ? out.welcomeMemberCloseButtonStyle
      : "danger",
    welcomeMemberAddButton: out?.welcomeMemberAddButton ?? false,
    welcomeMemberAddButtonStyle: isValidButtonStyle(out?.welcomeMemberAddButtonStyle)
      ? out.welcomeMemberAddButtonStyle
      : "primary",
    welcomeMemberCloseButtonEmoji: out?.welcomeMemberCloseButtonEmoji ?? null,
    welcomeMemberAddButtonEmoji: out?.welcomeMemberAddButtonEmoji ?? null,
    maxOpenTicketsPerOpener: clampMaxOpenTicketsPerOpener(out?.maxOpenTicketsPerOpener ?? 1),
  };
}

export async function updatePanelMessageIdInternal(
  prisma: PrismaClient,
  discordGuildId: string,
  panelMessageId: string | null,
): Promise<void> {
  const guild = await prisma.guild.findUnique({
    where: { discordId: discordGuildId },
    select: { id: true },
  });
  if (!guild) return;
  await prisma.guildTicketSettings.upsert({
    where: { guildId: guild.id },
    create: {
      guildId: guild.id,
      panelMessageId,
    },
    update: { panelMessageId },
  });
}

export type TicketListItemDto = {
  id: string;
  ticketNumber: number;
  channelId: string;
  openerId: string;
  status: TicketStatus;
  createdAt: string;
  closedAt: string | null;
  subject: string | null;
  /** Nom du salon côté Discord (liste enrichie). */
  channelDiscordName: string | null;
  /** Pseudo / surnom de l’auteur d’ouverture (liste enrichie). */
  openerDisplayName: string | null;
};

export async function listTicketsForGuild(
  prisma: PrismaClient,
  discordGuildId: string,
  status: TicketStatus,
  botToken: string,
): Promise<TicketListItemDto[]> {
  const guild = await prisma.guild.findUnique({
    where: { discordId: discordGuildId },
    select: { id: true },
  });
  if (!guild) return [];
  const rows = await prisma.ticket.findMany({
    where: { guildId: guild.id, status },
    orderBy: { ticketNumber: "desc" },
    select: {
      id: true,
      ticketNumber: true,
      channelId: true,
      openerId: true,
      status: true,
      createdAt: true,
      closedAt: true,
      subject: true,
    },
  });
  const list: TicketListItemDto[] = rows.map((r) => ({
    id: r.id,
    ticketNumber: r.ticketNumber,
    channelId: r.channelId,
    openerId: r.openerId,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    closedAt: r.closedAt ? r.closedAt.toISOString() : null,
    subject: r.subject,
    channelDiscordName: null,
    openerDisplayName: null,
  }));
  await enrichTicketListWithDiscord(discordGuildId, list, botToken);
  return list;
}

export type TicketDetailDto = {
  ticket: TicketListItemDto & {
    closedById: string | null;
    closeReason: TicketCloseReason | null;
    embedId: string | null;
    openerAvatarHash: string | null;
    openerDiscordUsername: string | null;
  };
  transcript: {
    format: TranscriptFormat;
    content: string;
    messageCount: number | null;
    generatedAt: string;
  } | null;
  /** Profil Discord du bot (avatars des messages du bot dans les vieux transcripts). */
  discordBotProfile: {
    id: string;
    username: string;
    globalName: string | null;
    avatarHash: string | null;
  } | null;
};

export async function getTicketDetailForGuild(
  prisma: PrismaClient,
  discordGuildId: string,
  ticketId: string,
  botToken: string,
): Promise<TicketDetailDto | null> {
  const guild = await prisma.guild.findUnique({
    where: { discordId: discordGuildId },
    select: { id: true },
  });
  if (!guild) return null;
  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, guildId: guild.id },
    include: { transcript: true },
  });
  if (!ticket) return null;
  const [{ channelDiscordName, openerDisplayName, openerAvatarHash, openerDiscordUsername }, me] =
    await Promise.all([
      resolveTicketDiscordDisplay(discordGuildId, ticket.channelId, ticket.openerId, botToken),
      getDiscordBotSelfCached(botToken),
    ]);
  const base: TicketListItemDto = {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    channelId: ticket.channelId,
    openerId: ticket.openerId,
    status: ticket.status,
    createdAt: ticket.createdAt.toISOString(),
    closedAt: ticket.closedAt ? ticket.closedAt.toISOString() : null,
    subject: ticket.subject,
    channelDiscordName,
    openerDisplayName,
  };
  return {
    ticket: {
      ...base,
      closedById: ticket.closedById,
      closeReason: ticket.closeReason,
      embedId: ticket.embedId,
      openerAvatarHash,
      openerDiscordUsername,
    },
    transcript: ticket.transcript
      ? {
          format: ticket.transcript.format,
          content: ticket.transcript.content,
          messageCount: ticket.transcript.messageCount,
          generatedAt: ticket.transcript.generatedAt.toISOString(),
        }
      : null,
    discordBotProfile: me
      ? {
          id: me.id,
          username: me.username,
          globalName: me.global_name?.trim() ? me.global_name.trim() : null,
          avatarHash: me.avatar ?? null,
        }
      : null,
  };
}

/** Tickets encore ouverts pour ce membre : nombre + salon du plus récent (pour ping Discord). */
export async function openTicketsSummaryForOpener(
  prisma: PrismaClient,
  discordGuildId: string,
  openerDiscordId: string,
): Promise<{ count: number; channelId: string | null }> {
  const guild = await prisma.guild.findUnique({
    where: { discordId: discordGuildId },
    select: { id: true },
  });
  if (!guild) return { count: 0, channelId: null };
  const rows = await prisma.ticket.findMany({
    where: { guildId: guild.id, openerId: openerDiscordId, status: "OPEN" },
    orderBy: { createdAt: "desc" },
    select: { channelId: true },
  });
  return {
    count: rows.length,
    channelId: rows.length > 0 ? rows[0].channelId : null,
  };
}

/** Annule un ticket tout juste créé si l’envoi du message d’accueil a échoué (bot uniquement). */
export async function findOpenTicketByChannel(
  prisma: PrismaClient,
  discordGuildId: string,
  channelId: string,
): Promise<{ id: string; openerId: string; welcomeMemberAddButton: boolean } | null> {
  const guild = await prisma.guild.findUnique({
    where: { discordId: discordGuildId },
    select: { id: true },
  });
  if (!guild) return null;
  const ticket = await prisma.ticket.findFirst({
    where: { guildId: guild.id, channelId, status: "OPEN" },
    select: { id: true, openerId: true },
  });
  if (!ticket) return null;
  const settings = await prisma.guildTicketSettings.findUnique({
    where: { guildId: guild.id },
    select: { welcomeMemberAddButton: true },
  });
  return {
    id: ticket.id,
    openerId: ticket.openerId,
    welcomeMemberAddButton: settings?.welcomeMemberAddButton ?? false,
  };
}

export async function deleteOpenTicketByChannelInternal(
  prisma: PrismaClient,
  discordGuildId: string,
  channelId: string,
): Promise<void> {
  const guild = await prisma.guild.findUnique({
    where: { discordId: discordGuildId },
    select: { id: true },
  });
  if (!guild) return;
  await prisma.ticket.deleteMany({
    where: { guildId: guild.id, channelId, status: "OPEN" },
  });
}

function normalizeTicketSubject(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = raw.trim();
  if (!t) return null;
  return t.slice(0, 500);
}

export async function registerTicketOpenInternal(
  prisma: PrismaClient,
  discordGuildId: string,
  channelId: string,
  openerDiscordId: string,
  subject?: string | null,
): Promise<{ ticketId: string; ticketNumber: number; welcomeEmbedId: string | null }> {
  const guildId = await ensureGuildForDiscord(prisma, discordGuildId, null);

  const subjectNorm = normalizeTicketSubject(subject ?? null);

  return prisma.$transaction(async (tx) => {
    const tSettings = await tx.guildTicketSettings.findUnique({
      where: { guildId },
      select: { welcomeEmbedId: true, maxOpenTicketsPerOpener: true },
    });
    const welcomeEmbedId = tSettings?.welcomeEmbedId ?? null;
    const maxOpen = clampMaxOpenTicketsPerOpener(tSettings?.maxOpenTicketsPerOpener ?? 1);

    const openCount = await tx.ticket.count({
      where: { guildId, openerId: openerDiscordId, status: "OPEN" },
    });
    if (openCount >= maxOpen) {
      throw new AppError(
        409,
        `Ce membre a déjà ${String(openCount)} ticket(s) ouvert(s) sur ce serveur ; la limite est de ${String(maxOpen)}.`,
        "TICKET_OPENER_LIMIT",
      );
    }

    const agg = await tx.ticket.aggregate({
      where: { guildId },
      _max: { ticketNumber: true },
    });
    const nextNum = (agg._max.ticketNumber ?? 0) + 1;
    const created = await tx.ticket.create({
      data: {
        guildId,
        ticketNumber: nextNum,
        channelId,
        openerId: openerDiscordId,
        status: "OPEN",
        embedId: welcomeEmbedId,
        subject: subjectNorm,
      },
      select: { id: true, ticketNumber: true },
    });
    return {
      ticketId: created.id,
      ticketNumber: created.ticketNumber,
      welcomeEmbedId,
    };
  });
}

export async function closeTicketWithTranscriptInternal(
  prisma: PrismaClient,
  discordGuildId: string,
  channelId: string,
  closedByDiscordId: string,
  input: {
    transcriptContent: string;
    format: TranscriptFormat;
    messageCount: number;
    closeReason: TicketCloseReason;
    /** true = fermeture via le bouton d’accueil (réglage serveur + auteur ou modérateur). */
    memberSelfClose?: boolean;
    /** true = le bot a vérifié « Gérer les salons » pour un non-auteur. */
    welcomeCloseByStaff?: boolean;
  },
): Promise<{ ticketId: string; ticketNumber: number }> {
  const guild = await prisma.guild.findUnique({
    where: { discordId: discordGuildId },
    select: { id: true },
  });
  if (!guild) {
    throw new AppError(404, "Serveur inconnu.", "GUILD_NOT_FOUND");
  }
  const ticket = await prisma.ticket.findFirst({
    where: { guildId: guild.id, channelId, status: "OPEN" },
  });
  if (!ticket) {
    throw new AppError(404, "Aucun ticket ouvert ne correspond à ce salon.", "TICKET_NOT_FOUND");
  }

  if (input.memberSelfClose) {
    const settings = await prisma.guildTicketSettings.findUnique({
      where: { guildId: guild.id },
      select: { welcomeMemberCloseButton: true },
    });
    if (!settings?.welcomeMemberCloseButton) {
      throw new AppError(403, "La fermeture par le membre n’est pas activée sur ce serveur.", "MEMBER_CLOSE_DISABLED");
    }
    const isOpener = ticket.openerId === closedByDiscordId;
    if (!isOpener && !input.welcomeCloseByStaff) {
      throw new AppError(
        403,
        "Seul l’auteur du ticket ou un modérateur avec « Gérer les salons » peut fermer avec ce bouton.",
        "NOT_TICKET_OPENER",
      );
    }
  }

  return prisma.$transaction(async (tx) => {
    await tx.ticket.update({
      where: { id: ticket.id },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
        closedById: closedByDiscordId,
        closeReason: input.closeReason,
      },
    });
    await tx.ticketTranscript.upsert({
      where: { ticketId: ticket.id },
      create: {
        ticketId: ticket.id,
        format: input.format,
        content: input.transcriptContent,
        messageCount: input.messageCount,
        generatedById: closedByDiscordId,
      },
      update: {
        format: input.format,
        content: input.transcriptContent,
        messageCount: input.messageCount,
        generatedById: closedByDiscordId,
        generatedAt: new Date(),
      },
    });
    return { ticketId: ticket.id, ticketNumber: ticket.ticketNumber };
  });
}

export type TicketSettingsBulkRow = {
  discordGuildId: string;
  panelChannelId: string;
  panelMessageId: string | null;
  ticketCategoryId: string | null;
  welcomeEmbedId: string | null;
  panelEmbedId: string | null;
};

/** Serveurs avec un salon panneau défini (synchro message au démarrage du bot). */
export async function listGuildTicketSettingsForBotSync(prisma: PrismaClient): Promise<TicketSettingsBulkRow[]> {
  const rows = await prisma.guildTicketSettings.findMany({
    where: {
      panelChannelId: { not: null },
    },
    include: {
      guild: { select: { discordId: true } },
    },
  });
  return rows
    .filter((r) => r.panelChannelId)
    .map((r) => ({
      discordGuildId: r.guild.discordId,
      panelChannelId: r.panelChannelId!,
      panelMessageId: r.panelMessageId,
      ticketCategoryId: r.ticketCategoryId,
      welcomeEmbedId: r.welcomeEmbedId,
      panelEmbedId: r.panelEmbedId,
    }));
}
