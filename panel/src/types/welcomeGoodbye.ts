export type WelcomeGoodbyeSettings = {
  /** Si false : aucun message arrivée/départ (salon ni DM). */
  moduleEnabled: boolean;
  /** Message d’arrivée (salon + DM éventuel) si le module est actif. */
  welcomeMessagesEnabled: boolean;
  /** Message de départ dans le salon si le module est actif. */
  goodbyeMessagesEnabled: boolean;
  welcomeChannelId: string | null;
  welcomeContent: string | null;
  welcomeUseEmbed: boolean;
  welcomeEmbedColor: number | null;
  /** Modèle Embeds pour le salon d’arrivée (prioritaire sur texte / embed simple). */
  welcomeEmbedId: string | null;
  goodbyeChannelId: string | null;
  goodbyeContent: string | null;
  goodbyeUseEmbed: boolean;
  goodbyeEmbedColor: number | null;
  goodbyeEmbedId: string | null;
  dmWelcomeEnabled: boolean;
  dmWelcomeContent: string | null;
};
