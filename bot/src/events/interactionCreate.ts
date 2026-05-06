import { Events, type Interaction } from "discord.js";
import type { VexClient } from "../client.js";

export default {
  name: Events.InteractionCreate,
  once: false,
  async execute(client: VexClient, ...args: unknown[]) {
    const interaction = args[0] as Interaction;
    if (!interaction.isChatInputCommand()) {
      return;
    }

    const command = client.commands.get(interaction.commandName);
    if (!command) {
      console.warn(`[interaction] Commande inconnue : ${interaction.commandName}`);
      try {
        await interaction.reply({
          content:
            "Cette commande n’est pas reconnue par ce bot (mise à jour ou déploiement des commandes à refaire).",
          ephemeral: true,
        });
      } catch {
        // interaction déjà expirée ou autre erreur réseau
      }
      return;
    }

    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(`[interaction] Erreur /${interaction.commandName}`, err);
      const reply = { content: "Une erreur s’est produite en exécutant cette commande." };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ ...reply, ephemeral: true });
      } else {
        await interaction.reply({ ...reply, ephemeral: true });
      }
    }
  },
};
