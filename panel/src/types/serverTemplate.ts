export type ServerTemplateChannelType =
  | "text"
  | "voice"
  | "category"
  | "announcement"
  | "stage"
  | "forum"
  | "media";

export type ServerTemplateRoleSnapshot = {
  sourceId: string;
  name: string;
  color: number;
  permissions: string;
  hoist: boolean;
  mentionable: boolean;
  position: number;
  managed: boolean;
  unicodeEmoji: string | null;
  icon: string | null;
};

export type ServerTemplatePermissionOverwrite = {
  kind: "role";
  roleSourceId: string;
  allow: string;
  deny: string;
};

export type ServerTemplateChannelSnapshot = {
  sourceId: string;
  name: string;
  type: ServerTemplateChannelType;
  parentSourceId: string | null;
  position: number;
  topic: string | null;
  nsfw: boolean;
  rateLimitPerUser: number | null;
  bitrate: number | null;
  userLimit: number | null;
  rtcRegion: string | null;
  defaultAutoArchiveDuration: number | null;
  permissionOverwrites: ServerTemplatePermissionOverwrite[];
};

export type ServerTemplateSnapshot = {
  v: 1;
  guildName: string;
  sourceGuildId: string;
  capturedAt: string;
  roles: ServerTemplateRoleSnapshot[];
  channels: ServerTemplateChannelSnapshot[];
};

export type ServerTemplateSummary = {
  id: string;
  name: string;
  description: string | null;
  createdByDiscordUserId: string;
  rolesCount: number;
  channelsCount: number;
  categoriesCount: number;
  sourceGuildName: string;
  createdAt: string;
  updatedAt: string;
};

export type ServerTemplateDetail = ServerTemplateSummary & {
  snapshot: ServerTemplateSnapshot;
};

export type RolePlanItem =
  | { kind: "create"; templateRole: ServerTemplateRoleSnapshot }
  | {
      kind: "modify";
      currentRole: ServerTemplateRoleSnapshot;
      templateRole: ServerTemplateRoleSnapshot;
      changes: string[];
    }
  | { kind: "delete"; currentRole: ServerTemplateRoleSnapshot }
  | {
      kind: "skip";
      reason: string;
      currentRole?: ServerTemplateRoleSnapshot;
      templateRole?: ServerTemplateRoleSnapshot;
    };

export type ChannelPlanItem =
  | {
      kind: "create";
      templateChannel: ServerTemplateChannelSnapshot;
      parentNameInTemplate: string | null;
    }
  | {
      kind: "modify";
      currentChannel: ServerTemplateChannelSnapshot;
      templateChannel: ServerTemplateChannelSnapshot;
      changes: string[];
    }
  | { kind: "delete"; currentChannel: ServerTemplateChannelSnapshot };

export type ApplyPlan = {
  rolesPlan: RolePlanItem[];
  channelsPlan: ChannelPlanItem[];
  warnings: string[];
  summary: {
    rolesToCreate: number;
    rolesToModify: number;
    rolesToDelete: number;
    channelsToCreate: number;
    channelsToModify: number;
    channelsToDelete: number;
  };
};

export type ServerTemplatePreviewResult = {
  plan: ApplyPlan;
  currentCapturedAt: string;
};
