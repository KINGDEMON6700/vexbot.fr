import { Events, type GuildMember, type PartialGuildMember } from "discord.js";
import type { VexClient } from "../client.js";
import { runGoodbyeForMember } from "../features/welcomeGoodbye.js";

export default {
  name: Events.GuildMemberRemove,
  async execute(_client: VexClient, member: GuildMember | PartialGuildMember) {
    await runGoodbyeForMember(member);
  },
};
