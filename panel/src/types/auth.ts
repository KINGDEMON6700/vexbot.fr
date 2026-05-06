/** Profil renvoyé par GET /api/auth/me (scope identify). */
export type PanelUser = {
  id: string;
  username: string;
  discriminator: string;
  global_name: string | null;
  avatar: string | null;
};

/** Serveur renvoyé par GET /api/auth/me (scope guilds). */
export type PanelGuild = {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
};

export type AuthMeResponse = {
  user: PanelUser;
  guilds: PanelGuild[];
};
