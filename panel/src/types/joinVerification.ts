export type JoinVerificationSettings = {
  moduleEnabled: boolean;
  channelId: string | null;
  unverifiedRoleId: string | null;
  panelMessageId: string | null;
  panelContent: string | null;
  panelUseEmbed: boolean;
  panelEmbedColor: number | null;
  panelEmbedId: string | null;
  buttonLabel: string | null;
  verifiedRoleIds: string[];
};
