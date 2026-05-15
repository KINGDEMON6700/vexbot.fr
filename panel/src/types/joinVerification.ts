export type JoinVerificationMode = "CAPTCHA" | "BUTTON";

export type JoinVerificationSettings = {
  moduleEnabled: boolean;
  mode: JoinVerificationMode;
  channelId: string | null;
  unverifiedRoleId: string | null;
  panelMessageId: string | null;
  buttonLabel: string | null;
};
