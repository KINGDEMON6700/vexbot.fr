import { Events, type Message } from "discord.js";
import type { VexClient } from "../client.js";

/** Réservé à d’éventuelles fonctionnalités basées messages ; la vérification passe par bouton + modal. */
export default {
  name: Events.MessageCreate,
  once: false,
  execute(_client: VexClient, _message: Message) {},
};
