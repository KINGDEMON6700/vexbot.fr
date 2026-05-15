import { AppError } from "../lib/AppError.js";
import {
  DEFAULT_TICKET_WELCOME_ADD_EMOJI,
  DEFAULT_TICKET_WELCOME_CLOSE_EMOJI,
  parseTicketWelcomeButtonEmojiForDiscord,
} from "../lib/ticketWelcomeButtonEmoji.js";
import type { TemplateMessageDto } from "./embedTemplateService.js";
import type { MessageComponentInput } from "./messageComponentsSchema.js";

/** Identique au customId côté bot (`ticketMemberClose.ts`). */
export const TICKET_WELCOME_MEMBER_CLOSE_CUSTOM_ID = "vex_ticket_welcome_close";

/** Identique au customId côté bot (`ticketWelcomeMemberAdd.ts`). */
export const TICKET_WELCOME_MEMBER_ADD_CUSTOM_ID = "vex_ticket_welcome_add";

type ButtonStyle = "primary" | "secondary" | "success" | "danger";

export type WelcomeTicketButtonsMergeOpts = {
  close: { enabled: boolean; style: ButtonStyle; emoji?: string | null };
  add: { enabled: boolean; style: ButtonStyle; emoji?: string | null };
};

function buildCloseButton(style: ButtonStyle, emojiRaw: string | null | undefined): MessageComponentInput {
  const emoji = parseTicketWelcomeButtonEmojiForDiscord(emojiRaw, DEFAULT_TICKET_WELCOME_CLOSE_EMOJI);
  return {
    type: "button",
    label: "Fermer ce ticket",
    style,
    customId: TICKET_WELCOME_MEMBER_CLOSE_CUSTOM_ID,
    emoji,
  };
}

function buildAddButton(style: ButtonStyle, emojiRaw: string | null | undefined): MessageComponentInput {
  const emoji = parseTicketWelcomeButtonEmojiForDiscord(emojiRaw, DEFAULT_TICKET_WELCOME_ADD_EMOJI);
  return {
    type: "button",
    label: "Ajouter au ticket",
    style,
    customId: TICKET_WELCOME_MEMBER_ADD_CUSTOM_ID,
    emoji,
  };
}

/**
 * Ajoute une ligne de bouton(s) sur le **premier** message du modèle (même message que l’embed d’accueil).
 * Discord limite à 5 lignes de composants par message.
 */
export function mergeWelcomeTicketButtonsIntoFirstMessage(
  messages: TemplateMessageDto[],
  opts: WelcomeTicketButtonsMergeOpts,
): TemplateMessageDto[] {
  if (!opts.close.enabled && !opts.add.enabled) return messages;
  if (messages.length === 0) return messages;

  const first = messages[0];
  const blocks: TemplateMessageDto["componentBlocks"] = first.componentBlocks.map((b) => ({
    rows: b.rows.map((r) => ({
      components: r.components.map((c) => ({ ...c })),
    })),
  }));

  let totalRows = 0;
  for (const b of blocks) totalRows += b.rows.length;
  if (totalRows >= 5) {
    throw new AppError(
      400,
      "Le message d’accueil utilise déjà 5 lignes de boutons sur Discord. Retirez une ligne dans l’éditeur d’embeds pour pouvoir afficher les boutons d’accueil (fermer / ajouter) sur le même message.",
      "WELCOME_EMBED_COMPONENT_ROWS_FULL",
    );
  }

  const rowComponents: MessageComponentInput[] = [];
  if (opts.close.enabled) rowComponents.push(buildCloseButton(opts.close.style, opts.close.emoji));
  if (opts.add.enabled) rowComponents.push(buildAddButton(opts.add.style, opts.add.emoji));

  blocks.push({
    rows: [{ components: rowComponents }],
  });

  const next: TemplateMessageDto[] = [...messages];
  next[0] = { ...first, componentBlocks: blocks };
  return next;
}

/** @deprecated Utiliser mergeWelcomeTicketButtonsIntoFirstMessage. */
export function mergeMemberCloseButtonIntoFirstMessage(
  messages: TemplateMessageDto[],
  style: ButtonStyle = "danger",
): TemplateMessageDto[] {
  return mergeWelcomeTicketButtonsIntoFirstMessage(messages, {
    close: { enabled: true, style },
    add: { enabled: false, style: "primary" },
  });
}
