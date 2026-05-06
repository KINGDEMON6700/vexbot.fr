export type OverviewResponse = {
  botPresent: boolean;
  discord: {
    name: string;
    iconUrl: string | null;
    memberCount: number | null;
    onlineCount: number | null;
    channelCount: number | null;
    channelCategoriesCount: number | null;
    channelTextCount: number | null;
    channelVoiceCount: number | null;
    channelForumCount: number | null;
    channelMediaCount: number | null;
    channelOtherCount: number | null;
    roleCount: number | null;
    boostTier: number | null;
    boostCount: number | null;
    createdAtIso: string | null;
    partial: boolean;
    partialNotice: string | null;
  };
  vex: {
    ticketsOpen: number;
    ticketsClosed: number;
    embedCount: number;
    slashCommandsActive: number;
    sanctionsTotal: number;
  } | null;
  bot: {
    nickname: string | null;
    accountUsername: string;
    guildAvatarUrl: string | null;
    guildBannerUrl: string | null;
    defaultAvatarUrl: string | null;
    defaultBannerUrl: string | null;
  } | null;
  inviteUrl: string | null;
};
