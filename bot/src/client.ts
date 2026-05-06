import { Client, Collection } from "discord.js";
import type { SlashCommandModule } from "./types/command.js";

export class VexClient extends Client {
  commands = new Collection<string, SlashCommandModule>();
}
