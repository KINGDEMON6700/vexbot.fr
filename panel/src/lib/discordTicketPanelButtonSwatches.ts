import type { DiscordTicketPanelButtonStyle } from "../types/ticket.js";

/** Couleurs proches du rendu Discord (boutons du panneau ticket). */
export const DISCORD_TICKET_PANEL_BUTTON_SWATCHES: ReadonlyArray<{
  value: DiscordTicketPanelButtonStyle;
  label: string;
  hex: string;
}> = [
  { value: "primary", label: "Bleu", hex: "#5865F2" },
  { value: "secondary", label: "Gris", hex: "#4F545C" },
  { value: "success", label: "Vert", hex: "#248046" },
  { value: "danger", label: "Rouge", hex: "#DA373C" },
];

export function discordTicketPanelButtonPreviewHex(
  style: DiscordTicketPanelButtonStyle | undefined,
): string {
  const hit = DISCORD_TICKET_PANEL_BUTTON_SWATCHES.find((s) => s.value === (style ?? "primary"));
  return hit?.hex ?? "#5865F2";
}
