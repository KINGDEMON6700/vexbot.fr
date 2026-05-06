import { readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { VexClient } from "../client.js";

type EventModule = {
  name: string;
  once?: boolean;
  execute: (client: VexClient, ...args: unknown[]) => void | Promise<void>;
};

export async function loadEvents(client: VexClient, eventsDir: string): Promise<void> {
  const files = await readdir(eventsDir);
  const eventFiles = files.filter(
    (f) => (f.endsWith(".ts") || f.endsWith(".js")) && !f.endsWith(".d.ts"),
  );

  for (const file of eventFiles) {
    const filePath = path.join(eventsDir, file);
    const mod = (await import(pathToFileURL(filePath).href)) as { default: EventModule };
    const ev = mod.default;
    if (!ev?.name || typeof ev.execute !== "function") {
      console.warn(`[événements] Fichier ignoré (export invalide) : ${file}`);
      continue;
    }

    const listener = (...args: unknown[]) => ev.execute(client, ...args);

    if (ev.once) {
      client.once(ev.name, listener);
    } else {
      client.on(ev.name, listener);
    }

    console.log(`[événements] Enregistré : ${ev.name}${ev.once ? " (once)" : ""}`);
  }
}
