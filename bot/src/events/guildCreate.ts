import { Events, type Guild } from "discord.js";
import { loadEnv } from "../config/env.js";
import { vexInternalPostJson } from "../lib/vexApi.js";

export default {
  name: Events.GuildCreate,
  async execute(guild: Guild) {
    const env = loadEnv();
    const result = await vexInternalPostJson(env, "/guild-installed", {
      discordGuildId: guild.id,
      name: guild.name,
    });
    if (!result.ok && result.kind !== "config") {
      console.warn("[guildCreate] impossible d'enregistrer l'installation", result);
    }
  },
};
