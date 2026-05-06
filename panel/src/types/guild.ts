export type EligibleGuild = {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  botPresent: boolean;
  inviteUrl: string | null;
};
