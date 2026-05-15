import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { AppError } from "../lib/AppError.js";
import { requireSession } from "../middleware/requireSession.js";
import {
  addMarketplaceComment,
  assertMarketplaceTemplateId,
  deleteMarketplaceComment,
  getMarketplaceStatsMap,
  listMarketplaceComments,
  toggleMarketplaceLike,
} from "../services/marketplaceEngagementService.js";
import {
  bumpMarketplacePublicationDownload,
  createMarketplacePublication,
  deleteMarketplacePublication,
  getMarketplacePublication,
  listMarketplacePublications,
  updateMarketplacePublication,
} from "../services/marketplacePublicationService.js";

export const marketplaceRouter = Router();

const publicationCreateSchema = z.object({
  kind: z.enum(["embed", "server"]),
  name: z.string().min(1).max(120),
  shortDescription: z.string().min(1).max(2000),
  messages: z.unknown().optional(),
  serverGuildId: z.string().nullable().optional(),
  serverGuildName: z.string().nullable().optional(),
  sourceEmbedTemplateId: z.string().nullable().optional(),
  sourceServerTemplateId: z.string().nullable().optional(),
});

const publicationUpdateSchema = z.object({
  name: z.string().min(1).max(120),
  shortDescription: z.string().min(1).max(2000),
  messages: z.unknown().optional(),
  serverGuildId: z.string().nullable().optional(),
  serverGuildName: z.string().nullable().optional(),
  sourceEmbedTemplateId: z.string().nullable().optional(),
  sourceServerTemplateId: z.string().nullable().optional(),
});

marketplaceRouter.get(
  "/stats",
  requireSession,
  asyncHandler(async (req, res) => {
    const raw = typeof req.query.ids === "string" ? req.query.ids : "";
    const ids = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 200);
    const user = req.session.discordUser!;
    const stats = await getMarketplaceStatsMap(prisma, ids, user.id);
    res.json({ stats });
  }),
);

marketplaceRouter.get(
  "/publications",
  requireSession,
  asyncHandler(async (_req, res) => {
    const publications = await listMarketplacePublications(prisma);
    res.json({ publications });
  }),
);

marketplaceRouter.post(
  "/publications",
  requireSession,
  asyncHandler(async (req, res) => {
    const user = req.session.discordUser!;
    const parsed = publicationCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Données invalides.", "INVALID_BODY");
    }
    const publication = await createMarketplacePublication(prisma, user, {
      kind: parsed.data.kind,
      name: parsed.data.name,
      shortDescription: parsed.data.shortDescription,
      messages: parsed.data.messages,
      serverGuildId: parsed.data.serverGuildId,
      serverGuildName: parsed.data.serverGuildName,
      sourceEmbedTemplateId: parsed.data.sourceEmbedTemplateId,
      sourceServerTemplateId: parsed.data.sourceServerTemplateId,
    });
    res.status(201).json({ publication });
  }),
);

marketplaceRouter.get(
  "/publications/:id",
  requireSession,
  asyncHandler(async (req, res) => {
    const publication = await getMarketplacePublication(prisma, req.params.id);
    if (!publication) {
      throw new AppError(404, "Publication introuvable.", "NOT_FOUND");
    }
    res.json({ publication });
  }),
);

marketplaceRouter.patch(
  "/publications/:id",
  requireSession,
  asyncHandler(async (req, res) => {
    const user = req.session.discordUser!;
    const parsed = publicationUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Données invalides.", "INVALID_BODY");
    }
    const publication = await updateMarketplacePublication(prisma, req.params.id, user, {
      name: parsed.data.name,
      shortDescription: parsed.data.shortDescription,
      messages: parsed.data.messages,
      serverGuildId: parsed.data.serverGuildId,
      serverGuildName: parsed.data.serverGuildName,
      sourceEmbedTemplateId: parsed.data.sourceEmbedTemplateId,
      sourceServerTemplateId: parsed.data.sourceServerTemplateId,
    });
    res.json({ publication });
  }),
);

marketplaceRouter.delete(
  "/publications/:id",
  requireSession,
  asyncHandler(async (req, res) => {
    const user = req.session.discordUser!;
    await deleteMarketplacePublication(prisma, req.params.id, user.id);
    res.status(204).end();
  }),
);

marketplaceRouter.post(
  "/publications/:id/downloads",
  requireSession,
  asyncHandler(async (req, res) => {
    const result = await bumpMarketplacePublicationDownload(prisma, req.params.id);
    res.json(result);
  }),
);

marketplaceRouter.post(
  "/:templateId/like",
  requireSession,
  asyncHandler(async (req, res) => {
    const user = req.session.discordUser!;
    const tid = assertMarketplaceTemplateId(req.params.templateId);
    const result = await toggleMarketplaceLike(prisma, tid, user.id);
    res.json(result);
  }),
);

marketplaceRouter.get(
  "/:templateId/comments",
  requireSession,
  asyncHandler(async (req, res) => {
    const tid = assertMarketplaceTemplateId(req.params.templateId);
    const comments = await listMarketplaceComments(prisma, tid);
    res.json({ comments });
  }),
);

marketplaceRouter.delete(
  "/:templateId/comments/:commentId",
  requireSession,
  asyncHandler(async (req, res) => {
    const user = req.session.discordUser!;
    const tid = assertMarketplaceTemplateId(req.params.templateId);
    const result = await deleteMarketplaceComment(prisma, tid, req.params.commentId, user.id);
    res.json(result);
  }),
);

const commentBodySchema = z.object({
  body: z.string().max(2000),
});

marketplaceRouter.post(
  "/:templateId/comments",
  requireSession,
  asyncHandler(async (req, res) => {
    const user = req.session.discordUser!;
    const tid = assertMarketplaceTemplateId(req.params.templateId);
    const parsed = commentBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Corps de requête invalide.", "INVALID_BODY");
    }
    const comment = await addMarketplaceComment(prisma, tid, user, parsed.data.body);
    res.status(200).json({ comment });
  }),
);
