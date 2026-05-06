/** Réponse partielle de GET /users/@me (scopes identify) */
export type DiscordUser = {
  id: string;
  username: string;
  discriminator: string;
  global_name: string | null;
  avatar: string | null;
  email?: string;
};

/** Élément de GET /users/@me/guilds (scope guilds) */
export type DiscordGuild = {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
};
