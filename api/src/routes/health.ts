import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler.js";

export const healthRouter = Router();

healthRouter.get(
  "/health",
  asyncHandler(async (_req, res) => {
    res.json({
      ok: true,
      service: "vex-api",
      time: new Date().toISOString(),
    });
  }),
);
