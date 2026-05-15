import type { Client, TextChannel } from "discord.js";
import { loadEnv } from "../config/env.js";
import { vexInternalGetJson, vexInternalPatchJson, vexInternalPostJson } from "../lib/vexApi.js";

type BulkRow = {
  discordGuildId: string;
  panelChannelId: string;
  panelMessageId: string | null;
  ticketCategoryId: string | null;
  welcomeEmbedId: string | null;
  panelEmbedId: string | null;
};

export async function syncTicketPanels(client: Client): Promise<void> {
  const env = loadEnv();
  if (!env.API_BASE_URL || !env.VEX_BOT_API_SECRET) {
    console.warn("[ticket-panel] API_BASE_URL ou VEX_BOT_API_SECRET manquant — pas de synchro panneau.");
    return;
  }

  const bulk = await vexInternalGetJson<{ guilds: BulkRow[] }>(env, "/ticket-settings-bulk");
  if (!bulk.ok) {
    console.warn("[ticket-panel] Impossible de charger les réglages :", bulk.message ?? bulk.kind);
    return;
  }

  for (const row of bulk.data.guilds) {
    try {
      const g = await client.guilds.fetch(row.discordGuildId).catch(() => null);
      if (!g) continue;

      const ch = (await g.channels.fetch(row.panelChannelId).catch(() => null)) as TextChannel | null;
      if (!ch || !ch.isTextBased() || ch.isDMBased()) continue;

      const render = await vexInternalPostJson<{ body: Record<string, unknown> }>(env, "/ticket-panel-render", {
        discordGuildId: row.discordGuildId,
      });
      if (!render.ok) {
        console.warn(
          `[ticket-panel] Rendu panneau refusé pour ${row.discordGuildId} :`,
          render.message ?? render.kind,
        );
        continue;
      }
      if (!render.data.body) {
        console.warn(`[ticket-panel] Réponse sans corps pour ${row.discordGuildId}`);
        continue;
      }
      const body = render.data.body;

      if (row.panelMessageId) {
        try {
          const msg = await ch.messages.fetch(row.panelMessageId);
          await msg.edit(body);
          continue;
        } catch {
          // message supprimé ou inaccessible : on en recrée un
        }
      }

      const sent = await ch.send(body);
      const patch = await vexInternalPatchJson(env, "/ticket-settings/panel-message", {
        discordGuildId: row.discordGuildId,
        panelMessageId: sent.id,
      });
      if (!patch.ok) {
        console.warn(`[ticket-panel] Impossible d’enregistrer l’id du message pour ${row.discordGuildId}`);
      }
    } catch (e) {
      console.warn(`[ticket-panel] Erreur serveur ${row.discordGuildId}`, e);
    }
  }

  if (bulk.data.guilds.length > 0) {
    console.log(`[ticket-panel] Synchro terminée pour ${bulk.data.guilds.length} serveur(s).`);
  }
}
