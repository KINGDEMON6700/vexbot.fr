import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import express from "express";
import { loadEnv } from "./config/env.js";
import { createCorsMiddleware } from "./middleware/cors.js";
import { createSessionMiddleware } from "./middleware/session.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFound } from "./middleware/notFound.js";
import { healthRouter } from "./routes/health.js";
import { authRouter } from "./routes/auth.js";
import { accountRouter } from "./routes/account.js";
import { guildsRouter } from "./routes/guilds.js";
import { createBotInternalRouter } from "./routes/botInternal.js";
import { marketplaceRouter } from "./routes/marketplace.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: path.resolve(__dirname, "../.env") });

const env = loadEnv();

const app = express();
app.set("trust proxy", 1);

app.use(createCorsMiddleware(env));
app.use(express.json({ limit: "12mb" }));
app.use(createSessionMiddleware(env));

app.use("/api", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/account", accountRouter);
app.use("/api/guilds", guildsRouter);
app.use("/api/marketplace", marketplaceRouter);
app.use("/api/bot-internal", createBotInternalRouter(env));

app.use(notFound);
app.use(errorHandler(env));

const port = env.PORT;
const host = env.HOST;

app.listen(port, host, () => {
  console.log(`API Vex : http://${host === "0.0.0.0" ? "localhost" : host}:${port}`);
});
