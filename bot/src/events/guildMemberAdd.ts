import { Events, type GuildMember } from "discord.js";
import type { VexClient } from "../client.js";
import { runJoinAutoRolesForMember } from "../features/joinAutoRoles.js";
import { runJoinVerificationOnJoin } from "../features/joinVerification.js";
import { runWelcomeForMember } from "../features/welcomeGoodbye.js";

export default {
  name: Events.GuildMemberAdd,
  async execute(_client: VexClient, member: GuildMember) {
    const gated = await runJoinVerificationOnJoin(member);
    if (!gated) {
      await runJoinAutoRolesForMember(member);
    }
    await runWelcomeForMember(member);
  },
};
