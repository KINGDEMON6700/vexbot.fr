import { Events } from "discord.js";
import type { VexClient } from "../client.js";
import { syncTicketPanels } from "../features/ticketPanelSync.js";

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client: VexClient) {
    console.log(`[ready] Connecté en tant que ${client.user?.tag ?? "?"}`);
    await syncTicketPanels(client).catch((e) => console.error("[ready] syncTicketPanels", e));
  },
};
