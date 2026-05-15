import { apiFetch } from "./api.js";
import { fetchEmbedTemplates, fetchGuildTextChannels, type GuildTextChannelOption } from "./embedsApi.js";
import type {
  TicketDetailResponse,
  TicketListItem,
  TicketPanelOpenConfig,
  TicketSettings,
} from "../types/ticket.js";

export { fetchEmbedTemplates, fetchGuildTextChannels, type GuildTextChannelOption };

type ApiErrorShape = { error?: { message?: string; code?: string } };

async function readApiError(res: Response): Promise<Error & { status: number; code?: string }> {
  let message = "Erreur";
  let code: string | undefined;
  try {
    const j = (await res.json()) as ApiErrorShape;
    if (j.error?.message) message = j.error.message;
    code = j.error?.code;
  } catch {
    /* ignore */
  }
  const e = new Error(message) as Error & { status: number; code?: string };
  e.status = res.status;
  e.code = code;
  return e;
}

export async function fetchGuildCategories(discordGuildId: string): Promise<GuildTextChannelOption[]> {
  const res = await apiFetch(`/api/guilds/${encodeURIComponent(discordGuildId)}/meta/categories`);
  if (!res.ok) throw new Error("categories");
  const data = (await res.json()) as { categories: GuildTextChannelOption[] };
  return data.categories;
}

export async function fetchTicketSettings(discordGuildId: string): Promise<TicketSettings> {
  const res = await apiFetch(`/api/guilds/${encodeURIComponent(discordGuildId)}/ticket-settings`);
  if (!res.ok) {
    const err = await readApiError(res);
    throw err;
  }
  const data = (await res.json()) as { settings: TicketSettings | null };
  return (
    data.settings ?? {
      panelChannelId: null,
      panelMessageId: null,
      ticketCategoryId: null,
      welcomeEmbedId: null,
      panelEmbedId: null,
      panelOpenConfig: null,
      welcomeMemberCloseButton: false,
      welcomeMemberCloseButtonStyle: "danger",
      welcomeMemberAddButton: false,
      welcomeMemberAddButtonStyle: "primary",
      welcomeMemberCloseButtonEmoji: null,
      welcomeMemberAddButtonEmoji: null,
      maxOpenTicketsPerOpener: 1,
    }
  );
}

export type PatchTicketSettingsBody = Partial<{
  panelChannelId: string | null;
  ticketCategoryId: string | null;
  welcomeEmbedId: string | null;
  panelEmbedId: string | null;
  panelOpenConfig: TicketPanelOpenConfig | null;
  welcomeMemberCloseButton: boolean;
  welcomeMemberCloseButtonStyle: "primary" | "secondary" | "success" | "danger";
  welcomeMemberAddButton: boolean;
  welcomeMemberAddButtonStyle: "primary" | "secondary" | "success" | "danger";
  welcomeMemberCloseButtonEmoji?: string | null;
  welcomeMemberAddButtonEmoji?: string | null;
  maxOpenTicketsPerOpener?: number;
}>;

export type PatchTicketSettingsResult = {
  settings: TicketSettings;
  panelSyncWarning: string | null;
};

export async function patchTicketSettings(
  discordGuildId: string,
  body: PatchTicketSettingsBody,
): Promise<PatchTicketSettingsResult> {
  const res = await apiFetch(`/api/guilds/${encodeURIComponent(discordGuildId)}/ticket-settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await readApiError(res);
    throw err;
  }
  const data = (await res.json()) as { settings: TicketSettings; panelSyncWarning?: string | null };
  return {
    settings: data.settings,
    panelSyncWarning: data.panelSyncWarning ?? null,
  };
}

export async function fetchTicketsList(
  discordGuildId: string,
  status: "OPEN" | "CLOSED",
): Promise<TicketListItem[]> {
  const res = await apiFetch(
    `/api/guilds/${encodeURIComponent(discordGuildId)}/tickets?status=${encodeURIComponent(status)}`,
  );
  if (!res.ok) {
    const err = await readApiError(res);
    throw err;
  }
  const data = (await res.json()) as { tickets: TicketListItem[] };
  return data.tickets;
}

export type LiveChannelMessage = {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatarHash: string | null;
  content: string;
  createdAt: string;
};

export async function fetchTicketLiveMessages(
  discordGuildId: string,
  ticketId: string,
): Promise<LiveChannelMessage[]> {
  const res = await apiFetch(
    `/api/guilds/${encodeURIComponent(discordGuildId)}/tickets/${encodeURIComponent(ticketId)}/live-messages`,
  );
  if (!res.ok) {
    const err = await readApiError(res);
    throw err;
  }
  const data = (await res.json()) as { messages: LiveChannelMessage[] };
  return data.messages;
}

export async function fetchTicketDetail(
  discordGuildId: string,
  ticketId: string,
): Promise<TicketDetailResponse> {
  const res = await apiFetch(
    `/api/guilds/${encodeURIComponent(discordGuildId)}/tickets/${encodeURIComponent(ticketId)}`,
  );
  if (!res.ok) {
    const err = await readApiError(res);
    throw err;
  }
  return (await res.json()) as TicketDetailResponse;
}
