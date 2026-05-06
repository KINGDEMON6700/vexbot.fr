import { Events } from "discord.js";
import type { VexClient } from "../client.js";

export default {
  name: Events.ClientReady,
  once: true,
  execute(client: VexClient) {
    console.log(`[ready] Connecté en tant que ${client.user?.tag ?? "?"}`);
  },
};
