import { readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { VexClient } from "../client.js";
import type { SlashCommandModule } from "../types/command.js";

export async function loadCommands(client: VexClient, commandsDir: string): Promise<void> {
  const files = await readdir(commandsDir);
  const commandFiles = files.filter(
    (f) => (f.endsWith(".ts") || f.endsWith(".js")) && !f.endsWith(".d.ts"),
  );

  for (const file of commandFiles) {
    const filePath = path.join(commandsDir, file);
    const mod = (await import(pathToFileURL(filePath).href)) as {
      default: SlashCommandModule;
    };
    const command = mod.default;
    if (!command?.data?.name || typeof command.execute !== "function") {
      console.warn(`[commandes] Fichier ignoré (export invalide) : ${file}`);
      continue;
    }
    client.commands.set(command.data.name, command);
    console.log(`[commandes] Chargé : /${command.data.name}`);
  }
}
