export type NativeCommandSetting = {
  commandName: string;
  displayName: string;
  description: string;
  icon: string;
  configPanelPath: string | null;
  enabled: boolean;
  allowedRoleIds: string[];
  allowedChannelIds: string[];
};

export type CustomCommandResponseType = "PLAIN_TEXT" | "EMBED_INLINE" | "EMBED_TEMPLATE";

export type CustomCommand = {
  id: string;
  name: string;
  description: string;
  responseType: CustomCommandResponseType;
  responseText: string | null;
  embedId: string | null;
  ephemeral: boolean;
  enabled: boolean;
  allowedRoleIds: string[];
  allowedChannelIds: string[];
  discordCommandId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CustomCommandInput = {
  name: string;
  description: string;
  responseType: CustomCommandResponseType;
  responseText?: string | null;
  embedId?: string | null;
  ephemeral?: boolean;
  enabled?: boolean;
  allowedRoleIds?: string[];
  allowedChannelIds?: string[];
};
