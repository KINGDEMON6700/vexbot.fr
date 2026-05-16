import type { PrismaClient } from "@prisma/client";
import { getJoinVerificationSettings } from "./joinVerificationSettingsService.js";

const DISCORD_API = "https://discord.com/api/v10";

/** Identique au bouton géré par le bot (`joinVerification.ts`). */
export const JOIN_VERIFY_BUTTON_CUSTOM_ID = "vex_join_verify";

const DEFAULT_BUTTON_LABEL = "Je ne suis pas un robot";

function buildVerifyPanelPayload(buttonLabel: string): Record<string, unknown> {
  const label = (buttonLabel.trim() || DEFAULT_BUTTON_LABEL).slice(0, 80);
  return {
    content: null,
    embeds: [
      {
        title: "Vérification",
        description:
          "Cliquez sur le bouton : une fenêtre privée pour vous affiche une image avec un code à retaper pour accéder au reste du serveur. Il faut avoir le rôle « non vérifié ».",
        color: 0x5865f2,
      },
    ],
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 3,
            label,
            custom_id: JOIN_VERIFY_BUTTON_CUSTOM_ID,
            disabled: false,
          },
        ],
      },
    ],
  };
}

async function fetchChannel(channelId: string, botToken: string): Promise<{ id: string; guild_id?: string } | null> {
  const res = await fetch(`${DISCORD_API}/channels/${channelId}`, {
    headers: { Authorization: `Bot ${botToken}` },
  });
  if (!res.ok) return null;
  return (await res.json()) as { id: string; guild_id?: string };
}

async function deleteDiscordMessage(
  channelId: string,
  messageId: string,
  botToken: string,
): Promise<void> {
  await fetch(`${DISCORD_API}/channels/${channelId}/messages/${messageId}`, {
    method: "DELETE",
    headers: { Authorization: `Bot ${botToken}` },
  }).catch(() => {});
}

export async function syncJoinVerificationPanelDiscord(
  prisma: PrismaClient,
  discordGuildId: string,
  botToken: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const settings = await getJoinVerificationSettings(prisma, discordGuildId);

  if (!settings.moduleEnabled || !settings.channelId) {
    if (settings.panelMessageId) {
      const row = await prisma.joinVerificationSettings.findFirst({
        where: { guild: { discordId: discordGuildId } },
        select: { channelId: true, panelMessageId: true },
      });
      if (row?.channelId && row.panelMessageId) {
        await deleteDiscordMessage(row.channelId, row.panelMessageId, botToken);
      }
      await prisma.joinVerificationSettings.updateMany({
        where: { guild: { discordId: discordGuildId } },
        data: { panelMessageId: null },
      });
    }
    return { ok: true };
  }

  const chMeta = await fetchChannel(settings.channelId, botToken);
  if (!chMeta?.guild_id || chMeta.guild_id !== discordGuildId) {
    return {
      ok: false,
      message:
        "Le salon de vérification est introuvable, le bot n’y a pas accès, ou il n’appartient pas à ce serveur.",
    };
  }

  const payload = buildVerifyPanelPayload(settings.buttonLabel ?? DEFAULT_BUTTON_LABEL);
  const channelId = settings.channelId;

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
      let hint = "Discord a refusé la mise à jour du message de vérification.";
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
    let hint = "Impossible de publier le message de vérification dans ce salon.";
    try {
      const j = (await postRes.json()) as { message?: string };
      if (j.message) hint = j.message;
    } catch {
      /* ignore */
    }
    return { ok: false, message: hint };
  }

  const created = (await postRes.json()) as { id: string };
  await prisma.joinVerificationSettings.updateMany({
    where: { guild: { discordId: discordGuildId } },
    data: { panelMessageId: created.id },
  });
  return { ok: true };
}
