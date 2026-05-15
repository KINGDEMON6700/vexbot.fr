import { templateToDraft, type TemplateDraft } from "../components/embeds/embedDraft.js";
import type { EmbedTemplate } from "../types/embedTemplate.js";

/** Brouillon d’aperçu Discord à partir des messages d’une template marketplace (embed). */
export function embedMessagesToPreviewDraft(messages: EmbedTemplate["messages"]): TemplateDraft {
  const t: EmbedTemplate = {
    id: "marketplace-preview",
    name: "",
    listAccentColor: null,
    listIconColor: null,
    listIconKey: null,
    messages,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return templateToDraft(t);
}
