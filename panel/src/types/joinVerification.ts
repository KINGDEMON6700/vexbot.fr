export type JoinVerificationSettings = {
  moduleEnabled: boolean;
  channelId: string | null;
  unverifiedRoleId: string | null;
  panelMessageId: string | null;
  buttonLabel: string | null;
  verifiedRoleIds: string[];
};
