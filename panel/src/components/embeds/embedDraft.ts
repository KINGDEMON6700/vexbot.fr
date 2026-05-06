import type {
  EmbedTemplate,
  EmbedTimestampMode,
  MessageComponentTemplate,
  ComponentRowTemplate,
  ComponentBlockTemplate,
} from "../../types/embedTemplate.js";

const DEFAULT_BLURPLE = 0x5865f2;

/** Un bloc dans l’éditeur (sans nom de modèle). */
export type EmbedDraft = {
  title: string;
  description: string;
  colorHex: string;
  url: string;
  thumbnailUrl: string;
  imageUrl: string;
  authorName: string;
  authorUrl: string;
  authorIconUrl: string;
  footerText: string;
  footerIconUrl: string;
  fields: { name: string; value: string; inline: boolean }[];
  timestampMode: EmbedTimestampMode;
  fixedAtLocal: string;
};

export type ComponentBlockDraft = {
  rows: ComponentRowTemplate[];
};

/** Un message dans l’éditeur (contenu + embeds + blocs composants). */
export type SingleMessageDraft = {
  messageContent: string;
  /** Vide = utiliser le profil du bot dans l’aperçu. */
  profileDisplayName: string;
  /** Vide = utiliser la photo du bot dans l’aperçu. */
  profileAvatarUrl: string;
  embeds: EmbedDraft[];
  componentBlocks: ComponentBlockDraft[];
};

export type TemplateDraft = {
  name: string;
  messages: SingleMessageDraft[];
};

export function defaultEmbedDraft(): EmbedDraft {
  return {
    title: "",
    description: "",
    colorHex: intToHex(DEFAULT_BLURPLE),
    url: "",
    thumbnailUrl: "",
    imageUrl: "",
    authorName: "",
    authorUrl: "",
    authorIconUrl: "",
    footerText: "",
    footerIconUrl: "",
    fields: [],
    timestampMode: "NONE",
    fixedAtLocal: "",
  };
}

export function defaultComponentBlockDraft(): ComponentBlockDraft {
  return { rows: [] };
}

export function defaultSingleMessageDraft(): SingleMessageDraft {
  return {
    messageContent: "",
    profileDisplayName: "",
    profileAvatarUrl: "",
    embeds: [defaultEmbedDraft()],
    componentBlocks: [],
  };
}

export function defaultMessageComponent(kind: MessageComponentTemplate["type"]): MessageComponentTemplate {
  switch (kind) {
    case "button":
      return { type: "button", label: "Bouton", style: "primary", customId: "bouton_1" };
    case "link_button":
      return { type: "link_button", label: "Lien", url: "https://discord.com" };
  }
}

export function defaultTemplateDraft(): TemplateDraft {
  return {
    name: "Exemple",
    messages: [
      {
        messageContent:
          "Ce modèle te montre les principales possibilités des embeds. Tu peux tout modifier ensuite.",
        profileDisplayName: "",
        profileAvatarUrl: "",
        embeds: [
          {
            title: "Bienvenue sur ton modèle Embed",
            description:
              "Tu peux combiner texte, titres, liens, champs, images et horodatage dans un seul message.\n\n" +
              "Exemple rapide : **gras**, *italique*, __souligné__, ~~barré~~.",
            colorHex: "#5865f2",
            url: "https://discord.com",
            thumbnailUrl: "https://cdn.discordapp.com/embed/avatars/3.png",
            imageUrl: "https://cdn.discordapp.com/embed/avatars/4.png",
            authorName: "Vex",
            authorUrl: "https://discord.com",
            authorIconUrl: "https://cdn.discordapp.com/embed/avatars/0.png",
            footerText: "Exemple prêt à personnaliser",
            footerIconUrl: "https://cdn.discordapp.com/embed/avatars/0.png",
            fields: [
              { name: "Bloc info", value: "Tu peux ajouter des champs côte à côte.", inline: true },
              { name: "Bloc action", value: "Pratique pour résumer des points clés.", inline: true },
            ],
            timestampMode: "NOW",
            fixedAtLocal: "",
          },
        ],
        componentBlocks: [
          {
            rows: [
              {
                components: [
                  {
                    type: "link_button",
                    label: "Voir la documentation Discord",
                    url: "https://support.discord.com/hc/fr",
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

export function intToHex(n: number): string {
  return `#${n.toString(16).padStart(6, "0")}`;
}

export function hexToInt(hex: string): number | null {
  const s = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(s)) return null;
  return parseInt(s, 16);
}

function isoToDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function blockToDraft(e: EmbedTemplate["messages"][number]["embeds"][number]): EmbedDraft {
  const c = e.color;
  return {
    title: e.title ?? "",
    description: e.description ?? "",
    colorHex: c != null ? intToHex(c) : intToHex(DEFAULT_BLURPLE),
    url: e.url ?? "",
    thumbnailUrl: e.thumbnailUrl ?? "",
    imageUrl: e.imageUrl ?? "",
    authorName: e.authorName ?? "",
    authorUrl: e.authorUrl ?? "",
    authorIconUrl: e.authorIconUrl ?? "",
    footerText: e.footerText ?? "",
    footerIconUrl: e.footerIconUrl ?? "",
    fields: e.fields.map((f) => ({ ...f })),
    timestampMode: e.timestampMode,
    fixedAtLocal: e.fixedAt ? isoToDatetimeLocalValue(e.fixedAt) : "",
  };
}

function cloneComponent(c: MessageComponentTemplate): MessageComponentTemplate {
  return JSON.parse(JSON.stringify(c)) as MessageComponentTemplate;
}

function cloneRows(rows: ComponentRowTemplate[]): ComponentRowTemplate[] {
  return rows.map((r) => ({
    components: r.components.map((c) => cloneComponent(c)),
  }));
}

function cloneBlocks(blocks: ComponentBlockTemplate[]): ComponentBlockDraft[] {
  return blocks.map((b) => ({
    rows: cloneRows(b.rows),
  }));
}

export function templateToDraft(t: EmbedTemplate): TemplateDraft {
  const messages: SingleMessageDraft[] =
    Array.isArray(t.messages) && t.messages.length > 0
      ? t.messages.map((m) => ({
          messageContent: m.messageContent ?? "",
          profileDisplayName: m.profileDisplayName ?? "",
          profileAvatarUrl: m.profileAvatarUrl ?? "",
          embeds: m.embeds.length > 0 ? m.embeds.map(blockToDraft) : [defaultEmbedDraft()],
          componentBlocks: m.componentBlocks.length > 0 ? cloneBlocks(m.componentBlocks) : [],
        }))
      : [defaultSingleMessageDraft()];
  return {
    name: t.name,
    messages,
  };
}

function emptyToNull(s: string): string | null {
  const x = s.trim();
  return x === "" ? null : x;
}

function singleBlockToApiPayload(d: EmbedDraft) {
  const color = hexToInt(d.colorHex) ?? DEFAULT_BLURPLE;
  let fixedAt: string | null = null;
  if (d.timestampMode === "FIXED") {
    if (!d.fixedAtLocal) throw new Error("fixed");
    fixedAt = new Date(d.fixedAtLocal).toISOString();
  }
  return {
    title: emptyToNull(d.title),
    description: emptyToNull(d.description),
    color,
    url: emptyToNull(d.url),
    thumbnailUrl: emptyToNull(d.thumbnailUrl),
    imageUrl: emptyToNull(d.imageUrl),
    authorName: emptyToNull(d.authorName),
    authorUrl: emptyToNull(d.authorUrl),
    authorIconUrl: emptyToNull(d.authorIconUrl),
    footerText: emptyToNull(d.footerText),
    footerIconUrl: emptyToNull(d.footerIconUrl),
    fields: d.fields.filter((f) => f.name.trim() || f.value.trim()),
    timestampMode: d.timestampMode,
    fixedAt,
  };
}

/** Payload pour création / mise à jour complète du modèle. */
export function templateDraftMessagesToApiPayload(d: TemplateDraft) {
  return d.messages.map((m) => ({
    messageContent: emptyToNull(m.messageContent),
    profileDisplayName: emptyToNull(m.profileDisplayName),
    profileAvatarUrl: emptyToNull(m.profileAvatarUrl),
    embeds: m.embeds.map((block) => singleBlockToApiPayload(block)),
    componentBlocks: m.componentBlocks.map((b) => ({
      rows: b.rows.map((row) => ({
        components: row.components.map((c) => cloneComponent(c)),
      })),
    })),
  }));
}

/** Payload pour création / mise à jour complète du modèle. */
export function templateDraftToApiPayload(d: TemplateDraft) {
  const name = d.name.trim();
  if (!name) {
    throw new Error("name");
  }
  return {
    name,
    messages: templateDraftMessagesToApiPayload(d),
  };
}
