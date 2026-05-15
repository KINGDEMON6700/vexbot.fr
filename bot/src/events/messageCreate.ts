import { Events, type Message } from "discord.js";
import type { VexClient } from "../client.js";
import { handleJoinVerifyCaptchaMessage } from "../features/joinVerification.js";

export default {
  name: Events.MessageCreate,
  once: false,
  async execute(_client: VexClient, message: Message) {
    await handleJoinVerifyCaptchaMessage(message);
  },
};
