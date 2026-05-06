import { timingSafeEqual } from "node:crypto";
import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import type { Env } from "../config/env.js";
import { findEmbedTemplateDtoByNameCaseInsensitive } from "../services/embedTemplateService.js";
import { sendTemplateMessagesToChannel } from "../services/embedSendService.js";

const sendEmbedBodySchema = z.object({
  discordGuildId: z.string().min(1).max(32),
  channelId: z.string().min(1).max(32),
  templateName: z.string().min(1).max(100),
});

function timingSafeStringEqual(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

export function createBotInternalRouter(env: Env) {
  const router = Router();

  router.post(
    "/send-embed-template",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const provided = req.get("x-vex-bot-key") ?? "";
        if (!timingSafeStringEqual(provided, env.VEX_BOT_API_SECRET)) {
          res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Clé invalide." } });
          return;
        }

        const parsed = sendEmbedBodySchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({ error: { code: "INVALID_BODY", message: "Requête invalide." } });
          return;
        }

        const { discordGuildId, channelId, templateName } = parsed.data;
        const template = await findEmbedTemplateDtoByNameCaseInsensitive(
          prisma,
          discordGuildId,
          templateName,
        );
        if (!template) {
          res.status(404).json({
            error: { code: "TEMPLATE_NOT_FOUND", message: "Modèle introuvable pour ce serveur." },
          });
          return;
        }

        const result = await sendTemplateMessagesToChannel(discordGuildId, env.DISCORD_BOT_TOKEN, {
          channelId,
          messages: template.messages.map((m) => ({
            messageContent: m.messageContent,
            embeds: m.embeds,
            componentBlocks: m.componentBlocks,
          })),
        });

        res.json({ ok: true, sent: result.sent });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
