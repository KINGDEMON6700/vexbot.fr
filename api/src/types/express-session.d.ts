import type { DiscordGuild, DiscordUser } from "./discord.js";

declare module "express-session" {
  interface SessionData {
    oauthState?: string;
    discordAccessToken?: string;
    discordUser?: DiscordUser;
    discordGuilds?: DiscordGuild[];
  }
}

export {};
