import type { PrismaClient } from "@prisma/client";
import { findEmbedTemplateDtoById } from "./embedTemplateService.js";
import { templateMessageDtoToDiscordRestPayload } from "./embedSendService.js";
import {
  DEFAULT_TICKET_PANEL_OPEN_CONFIG,
  resolveTicketPanelOpenConfig,
  type DiscordTicketPanelButtonStyle,
  type TicketPanelOpenConfig,
} from "../lib/ticketPanelOpenConfig.js";
import { defaultTicketPanelDiscordEmbed } from "../lib/vexTicketDefaultBranding.js";
import { getGuildTicketSettingsDto, updatePanelMessageIdInternal } from "./ticketService.js";

const DISCORD_API = "https://discord.com/api/v10";

/** Même identifiant que le bouton géré par le bot (`ticketOpen.ts`). */
export const TICKET_PANEL_BUTTON_CUSTOM_ID = "vex_ticket_open";

/** Menu déroulant « type de ticket » — géré par le bot. */
export const TICKET_PANEL_SELECT_CUSTOM_ID = "vex_ticket_open_sel";

/** Styles bouton Discord REST (1–4) ; le 5 = lien URL, non utilisé ici. */
const DISCORD_BUTTON_REST_STYLE: Record<DiscordTicketPanelButtonStyle, 1 | 2 | 3 | 4> = {
  primary: 1,
  secondary: 2,
  success: 3,
  danger: 4,
};

type DiscordActionRow = {
  type: 1;
  components: Array<
    | {
        type: 2;
        style: 1 | 2 | 3 | 4 | 5;
        label: string;
        custom_id?: string;
        url?: string;
        disabled?: boolean;
      }
    | {
        type: 3;
        custom_id: string;
        placeholder?: string;
        min_values: number;
        max_values: number;
        options: Array<{ label: string; value: string; description?: string }>;
      }
  >;
};

function buildOpenRow(cfg: TicketPanelOpenConfig): DiscordActionRow {
  if (cfg.style === "select") {
    return {
      type: 1,
      components: [
        {
          type: 3,
          custom_id: TICKET_PANEL_SELECT_CUSTOM_ID,
          placeholder: cfg.selectPlaceholder.slice(0, 150),
          min_values: 1,
          max_values: 1,
          options: cfg.options.map((o, i) => ({
            label: o.label.slice(0, 100),
            value: String(i),
            ...(o.description != null && String(o.description).trim() !== ""
              ? { description: String(o.description).trim().slice(0, 100) }
              : {}),
          })),
        },
      ],
    };
  }
  const label = (cfg.buttonLabel || DEFAULT_TICKET_PANEL_OPEN_CONFIG.buttonLabel).slice(0, 80);
  const restStyle = DISCORD_BUTTON_REST_STYLE[cfg.discordButtonStyle];
  return {
    type: 1,
    components: [
      {
        type: 2,
        style: restStyle,
        label,
        custom_id: TICKET_PANEL_BUTTON_CUSTOM_ID,
        disabled: false,
      },
    ],
  };
}

function defaultPanelBody(resolved: TicketPanelOpenConfig): Record<string, unknown> {
  return {
    /** Sur un PATCH, omettre `content` laisse l’ancien texte sur le message Discord. */
    content: null,
    embeds: [defaultTicketPanelDiscordEmbed()],
    components: [buildOpenRow(resolved)],
  };
}

/**
 * Corps JSON pour PATCH/POST message Discord (panneau tickets).
 * Réserve la dernière ligne pour le bouton ou le menu (max. 5 lignes au total).
 */
export async function buildTicketPanelDiscordJsonBody(
  prisma: PrismaClient,
  discordGuildId: string,
): Promise<Record<string, unknown> | null> {
  const settings = await getGuildTicketSettingsDto(prisma, discordGuildId);
  if (!settings?.panelChannelId) {
    return null;
  }

  const resolved = resolveTicketPanelOpenConfig(settings.panelOpenConfig ?? null);
  const openRow = buildOpenRow(resolved);
  const maxTemplateRows = resolved.style === "select" ? 3 : 4;

  if (!settings.panelEmbedId) {
    return defaultPanelBody(resolved);
  }

  const dto = await findEmbedTemplateDtoById(prisma, discordGuildId, settings.panelEmbedId);
  const first = dto?.messages[0];
  if (!first) {
    return defaultPanelBody(resolved);
  }

  try {
    const p = templateMessageDtoToDiscordRestPayload(first);
    const templateRows = p.components;
    const sliced = templateRows.slice(0, maxTemplateRows);
    const merged: DiscordActionRow[] = [...sliced, openRow];

    const hasContent = p.content != null && String(p.content).trim() !== "";
    const contentOut: string | null = hasContent ? String(p.content) : null;

    let embedsOut: typeof p.embeds;
    if (p.embeds.length > 0) {
      embedsOut = p.embeds;
    } else if (!hasContent) {
      embedsOut = [defaultTicketPanelDiscordEmbed()];
    } else {
      /** Modèle texte seul : il faut envoyer `[]` pour retirer les anciens embeds du message. */
      embedsOut = [];
    }

    return {
      content: contentOut,
      embeds: embedsOut,
      components: merged,
    };
  } catch {
    return defaultPanelBody(resolved);
  }
}

async function fetchChannel(channelId: string, botToken: string): Promise<{ id: string; guild_id?: string } | null> {
  const res = await fetch(`${DISCORD_API}/channels/${channelId}`, {
    headers: { Authorization: `Bot ${botToken}` },
  });
  if (!res.ok) return null;
  return (await res.json()) as { id: string; guild_id?: string };
}

export async function syncTicketPanelMessageDiscord(
  prisma: PrismaClient,
  discordGuildId: string,
  botToken: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const settings = await getGuildTicketSettingsDto(prisma, discordGuildId);
  if (!settings?.panelChannelId) {
    return { ok: true };
  }

  const chMeta = await fetchChannel(settings.panelChannelId, botToken);
  if (!chMeta?.guild_id || chMeta.guild_id !== discordGuildId) {
    return {
      ok: false,
      message:
        "Le salon du panneau est introuvable, le bot n’y a pas accès, ou il n’appartient pas à ce serveur. Vérifiez les permissions du bot dans ce salon.",
    };
  }

  const payload = await buildTicketPanelDiscordJsonBody(prisma, discordGuildId);
  if (!payload) {
    return { ok: true };
  }

  const channelId = settings.panelChannelId;

  if (settings.panelMessageId) {
    const patchRes = await fetch(`${DISCORD_API}/channels/${channelId}/messages/${settings.panelMessageId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (patchRes.ok) {
      return { ok: true };
    }
    if (patchRes.status !== 404) {
      let hint = "Discord a refusé la mise à jour du message panneau.";
      try {
        const j = (await patchRes.json()) as { message?: string };
        if (j.message) hint = j.message;
      } catch {
        /* ignore */
      }
      return { ok: false, message: hint };
    }
  }

  const postRes = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!postRes.ok) {
    let hint = "Impossible de publier le message panneau dans ce salon.";
    try {
      const j = (await postRes.json()) as { message?: string };
      if (j.message) hint = j.message;
    } catch {
      /* ignore */
    }
    return { ok: false, message: hint };
  }

  const created = (await postRes.json()) as { id: string };
  await updatePanelMessageIdInternal(prisma, discordGuildId, created.id);
  return { ok: true };
}
