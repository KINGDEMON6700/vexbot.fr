import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { GatewayIntentBits } from "discord.js";
import { VexClient } from "./client.js";
import { loadEnv } from "./config/env.js";
import { loadCommands } from "./lib/loadCommands.js";
import { loadEvents } from "./lib/loadEvents.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: path.resolve(__dirname, "../.env") });

async function main() {
  const env = loadEnv();

  const client = new VexClient({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  const commandsDir = path.join(__dirname, "commands");
  const eventsDir = path.join(__dirname, "events");

  await loadCommands(client, commandsDir);
  await loadEvents(client, eventsDir);

  await client.login(env.DISCORD_BOT_TOKEN);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
