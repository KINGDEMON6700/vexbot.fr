import { SlashCommandBuilder } from "discord.js";
import type { SlashCommandModule } from "../types/command.js";

const data = new SlashCommandBuilder()
  .setName("ping")
  .setDescription("Vérifie que le bot répond.");

const command: SlashCommandModule = {
  data,
  async execute(interaction) {
    await interaction.reply({ content: "Pong !" });
  },
};

export default command;
