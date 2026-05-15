import { Events, type Interaction } from "discord.js";
import type { VexClient } from "../client.js";
import {
  handleTicketWelcomeMemberClose,
  TICKET_WELCOME_MEMBER_CLOSE_CUSTOM_ID,
} from "../features/ticketMemberClose.js";
import {
  handleTicketWelcomeAddButton,
  handleTicketWelcomeAddIdButton,
  handleTicketWelcomeAddModal,
  handleTicketWelcomeAddUserSelect,
  TICKET_WELCOME_ADD_ID_BTN_PREFIX,
  TICKET_WELCOME_ADD_MODAL_PREFIX,
  TICKET_WELCOME_ADD_USER_SELECT_PREFIX,
  TICKET_WELCOME_MEMBER_ADD_CUSTOM_ID,
} from "../features/ticketWelcomeMemberAdd.js";
import {
  handleTicketOpenButton,
  handleTicketOpenModal,
  handleTicketOpenSelect,
  TICKET_OPEN_BUTTON_CUSTOM_ID,
  TICKET_OPEN_SELECT_CUSTOM_ID,
} from "../features/ticketOpen.js";
import {
  checkNativeCommandAccess,
  tryRunCustomSlashCommand,
} from "../features/commandsAccess.js";
import { loadEnv } from "../config/env.js";
import {
  handleJoinVerifyButton,
  JOIN_VERIFY_BUTTON_CUSTOM_ID,
} from "../features/joinVerification.js";

const MODAL_TICKET_PREFIX = "vex_tkm:";

export default {
  name: Events.InteractionCreate,
  once: false,
  async execute(client: VexClient, ...args: unknown[]) {
    const interaction = args[0] as Interaction;

    if (interaction.isModalSubmit() && interaction.customId.startsWith(TICKET_WELCOME_ADD_MODAL_PREFIX)) {
      try {
        await handleTicketWelcomeAddModal(interaction);
      } catch (err) {
        console.error("[interaction] Modal ajout ticket (accueil)", err);
        try {
          if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: "Une erreur s’est produite." });
          } else {
            await interaction.reply({ content: "Une erreur s’est produite.", ephemeral: true });
          }
        } catch {
          // ignore
        }
      }
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith(MODAL_TICKET_PREFIX)) {
      try {
        await handleTicketOpenModal(interaction);
      } catch (err) {
        console.error("[interaction] Modal ticket", err);
        try {
          if (interaction.deferred || interaction.replied) {
            await interaction.editReply({
              content: "Une erreur s’est produite en ouvrant le ticket.",
            });
          } else {
            await interaction.reply({ content: "Une erreur s’est produite en ouvrant le ticket.", ephemeral: true });
          }
        } catch {
          // ignore
        }
      }
      return;
    }

    if (interaction.isUserSelectMenu() && interaction.customId.startsWith(TICKET_WELCOME_ADD_USER_SELECT_PREFIX)) {
      try {
        await handleTicketWelcomeAddUserSelect(interaction);
      } catch (err) {
        console.error("[interaction] Menu ajout membre ticket", err);
        try {
          if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: "Une erreur s’est produite.", components: [] });
          } else {
            await interaction.reply({ content: "Une erreur s’est produite.", ephemeral: true });
          }
        } catch {
          // ignore
        }
      }
      return;
    }

    if (interaction.isStringSelectMenu() && interaction.customId === TICKET_OPEN_SELECT_CUSTOM_ID) {
      try {
        await handleTicketOpenSelect(interaction);
      } catch (err) {
        console.error("[interaction] Menu ticket", err);
        try {
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: "Une erreur s’est produite.", ephemeral: true });
          } else {
            await interaction.reply({ content: "Une erreur s’est produite.", ephemeral: true });
          }
        } catch {
          // ignore
        }
      }
      return;
    }

    if (interaction.isButton() && interaction.customId === TICKET_OPEN_BUTTON_CUSTOM_ID) {
      try {
        await handleTicketOpenButton(interaction);
      } catch (err) {
        console.error("[interaction] Bouton ticket", err);
        try {
          if (interaction.deferred || interaction.replied) {
            await interaction.editReply({
              content: "Une erreur s’est produite en ouvrant le ticket.",
            });
          } else {
            await interaction.reply({ content: "Une erreur s’est produite en ouvrant le ticket.", ephemeral: true });
          }
        } catch {
          // ignore
        }
      }
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith(TICKET_WELCOME_ADD_ID_BTN_PREFIX)) {
      try {
        await handleTicketWelcomeAddIdButton(interaction);
      } catch (err) {
        console.error("[interaction] Bouton coller ID ticket", err);
        try {
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: "Une erreur s’est produite.", ephemeral: true });
          } else {
            await interaction.reply({ content: "Une erreur s’est produite.", ephemeral: true });
          }
        } catch {
          // ignore
        }
      }
      return;
    }

    if (interaction.isButton() && interaction.customId === TICKET_WELCOME_MEMBER_ADD_CUSTOM_ID) {
      try {
        await handleTicketWelcomeAddButton(interaction);
      } catch (err) {
        console.error("[interaction] Bouton ajouter au ticket (accueil)", err);
        try {
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: "Une erreur s’est produite.", ephemeral: true });
          } else {
            await interaction.reply({ content: "Une erreur s’est produite.", ephemeral: true });
          }
        } catch {
          // ignore
        }
      }
      return;
    }

    if (interaction.isButton() && interaction.customId === TICKET_WELCOME_MEMBER_CLOSE_CUSTOM_ID) {
      try {
        await handleTicketWelcomeMemberClose(interaction);
      } catch (err) {
        console.error("[interaction] Bouton fermer ticket (membre)", err);
        try {
          if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: "Une erreur s’est produite en fermant le ticket." });
          } else {
            await interaction.reply({ content: "Une erreur s’est produite en fermant le ticket.", ephemeral: true });
          }
        } catch {
          // ignore
        }
      }
      return;
    }

    if (interaction.isButton() && interaction.customId === JOIN_VERIFY_BUTTON_CUSTOM_ID) {
      try {
        await handleJoinVerifyButton(interaction);
      } catch (err) {
        console.error("[interaction] Bouton vérification arrivée", err);
        try {
          if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: "Une erreur s’est produite." });
          } else {
            await interaction.reply({ content: "Une erreur s’est produite.", ephemeral: true });
          }
        } catch {
          // ignore
        }
      }
      return;
    }

    if (!interaction.isChatInputCommand()) {
      return;
    }

    const env = loadEnv();
    const command = client.commands.get(interaction.commandName);

    // Pas un module natif : on essaye en tant que commande personnalisée
    // résolue par l'API Vex.
    if (!command) {
      try {
        const handled = await tryRunCustomSlashCommand(env, interaction);
        if (handled) return;
      } catch (err) {
        console.error(`[interaction] Erreur commande custom /${interaction.commandName}`, err);
      }

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

    // Module natif : vérifie d'abord côté API que la commande est activée
    // et que le membre a le droit de l'utiliser dans ce salon.
    try {
      const allowed = await checkNativeCommandAccess(env, interaction, interaction.commandName);
      if (!allowed) return;
    } catch (err) {
      console.error(
        `[interaction] Erreur check accès /${interaction.commandName}`,
        err,
      );
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
