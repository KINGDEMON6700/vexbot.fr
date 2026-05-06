import { apiFetch } from "./api.js";
import type { OverviewResponse } from "../types/overview.js";

export async function fetchGuildOverview(discordGuildId: string): Promise<OverviewResponse> {
  const res = await apiFetch(`/api/guilds/${encodeURIComponent(discordGuildId)}/overview`);
  if (!res.ok) {
    throw new Error("overview");
  }
  return res.json() as Promise<OverviewResponse>;
}

export type PatchBotMemberPayload = Partial<{
  nickname: string | null;
  avatar: string | null;
  banner: string | null;
}>;

export async function patchBotMember(
  discordGuildId: string,
  patch: PatchBotMemberPayload,
): Promise<void> {
  const res = await apiFetch(`/api/guilds/${encodeURIComponent(discordGuildId)}/bot/member`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    throw new Error("bot_member");
  }
}

export async function patchBotNickname(
  discordGuildId: string,
  nickname: string | null,
): Promise<void> {
  await patchBotMember(discordGuildId, { nickname });
}
