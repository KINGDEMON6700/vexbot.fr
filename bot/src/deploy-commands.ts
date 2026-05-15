import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { REST, Routes } from "discord.js";
import { loadDeployEnv } from "./config/env.js";
import type { SlashCommandModule } from "./types/command.js";
import { readdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: path.resolve(__dirname, "../.env") });

async function collectCommandJson(commandsDir: string) {
  const files = await readdir(commandsDir);
  const commandFiles = files.filter(
    (f) => (f.endsWith(".ts") || f.endsWith(".js")) && !f.endsWith(".d.ts"),
  );
  const body: unknown[] = [];

  for (const file of commandFiles) {
    const filePath = path.join(commandsDir, file);
    const mod = (await import(pathToFileURL(filePath).href)) as {
      default: SlashCommandModule;
    };
    const command = mod.default;
    if (!command?.data?.toJSON) continue;
    body.push(command.data.toJSON());
  }

  return body;
}

async function main() {
  const env = loadDeployEnv();
  const commandsDir = path.join(__dirname, "commands");
  const body = await collectCommandJson(commandsDir);

  const rest = new REST({ version: "10" }).setToken(env.DISCORD_BOT_TOKEN);

  const guildId = env.DISCORD_GUILD_ID;

  const names = body
    .map((c) => (c && typeof c === "object" && "name" in c ? String((c as { name: unknown }).name) : ""))
    .filter(Boolean);

  if (guildId) {
    console.log(`[deploy] Enregistrement sur le serveur ${guildId} (visible tout de suite sur ce serveur)…`);
    await rest.put(Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, guildId), {
      body,
    });
  } else {
    console.log(
      "[deploy] Enregistrement global : les commandes peuvent mettre jusqu’à ~1 h à apparaître partout. Pour tester tout de suite, définissez DISCORD_GUILD_ID (ID du serveur) dans bot/.env puis relancez ce script.",
    );
    await rest.put(Routes.applicationCommands(env.DISCORD_CLIENT_ID), { body });
  }

  console.log(`[deploy] ${body.length} commande(s) enregistrée(s) sur l’application Discord : ${names.join(", ")}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
