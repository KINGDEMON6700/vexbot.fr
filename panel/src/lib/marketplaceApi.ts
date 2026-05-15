import { apiFetch } from "./api.js";

export type MarketplaceTemplateStats = {
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
};

export type MarketplaceCommentApi = {
  id: string;
  discordUserId: string;
  authorGlobalName: string | null;
  authorUsername: string;
  authorAvatar: string | null;
  body: string;
  createdAt: string;
};

async function readApiError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: { message?: string } };
    if (j.error?.message) return j.error.message;
  } catch {
    /* ignore */
  }
  return "Erreur";
}

export async function fetchMarketplaceStats(ids: string[]): Promise<Record<string, MarketplaceTemplateStats>> {
  if (ids.length === 0) return {};
  const res = await apiFetch(`/api/marketplace/stats?ids=${encodeURIComponent(ids.join(","))}`);
  if (!res.ok) throw new Error(await readApiError(res));
  const data = (await res.json()) as { stats: Record<string, MarketplaceTemplateStats> };
  return data.stats ?? {};
}

export async function toggleMarketplaceLikeApi(
  templateId: string,
): Promise<{ liked: boolean; likeCount: number }> {
  const res = await apiFetch(`/api/marketplace/${encodeURIComponent(templateId)}/like`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return (await res.json()) as { liked: boolean; likeCount: number };
}

export async function fetchMarketplaceComments(templateId: string): Promise<MarketplaceCommentApi[]> {
  const res = await apiFetch(`/api/marketplace/${encodeURIComponent(templateId)}/comments`);
  if (!res.ok) throw new Error(await readApiError(res));
  const data = (await res.json()) as { comments: MarketplaceCommentApi[] };
  return data.comments ?? [];
}

export async function postMarketplaceComment(templateId: string, body: string): Promise<MarketplaceCommentApi> {
  const res = await apiFetch(`/api/marketplace/${encodeURIComponent(templateId)}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
  if (!res.ok) throw new Error(await readApiError(res));
  const data = (await res.json()) as { comment: MarketplaceCommentApi };
  return data.comment;
}

export async function deleteMarketplaceComment(
  templateId: string,
  commentId: string,
): Promise<{ deleted: boolean }> {
  const res = await apiFetch(
    `/api/marketplace/${encodeURIComponent(templateId)}/comments/${encodeURIComponent(commentId)}`,
    {
      method: "DELETE",
    },
  );
  if (!res.ok) throw new Error(await readApiError(res));
  return (await res.json()) as { deleted: boolean };
}

export type MarketplacePublicationDto = {
  id: string;
  kind: "embed" | "server";
  name: string;
  shortDescription: string;
  authorDiscordId: string;
  authorGlobalName: string | null;
  authorUsername: string;
  authorAvatar: string | null;
  createdAt: string;
  likes: number;
  downloads: number;
  messages?: unknown;
  serverGuildId?: string | null;
  serverGuildName?: string | null;
  sourceEmbedTemplateId?: string | null;
  sourceServerTemplateId?: string | null;
};

export async function fetchMarketplacePublications(): Promise<MarketplacePublicationDto[]> {
  const res = await apiFetch("/api/marketplace/publications");
  if (!res.ok) throw new Error(await readApiError(res));
  const data = (await res.json()) as { publications: MarketplacePublicationDto[] };
  return data.publications ?? [];
}

export async function fetchMarketplacePublication(id: string): Promise<MarketplacePublicationDto> {
  const res = await apiFetch(`/api/marketplace/publications/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(await readApiError(res));
  const data = (await res.json()) as { publication: MarketplacePublicationDto };
  return data.publication;
}

export async function createMarketplacePublication(body: {
  kind: "embed" | "server";
  name: string;
  shortDescription: string;
  messages?: unknown;
  serverGuildId?: string | null;
  serverGuildName?: string | null;
  sourceEmbedTemplateId?: string | null;
  sourceServerTemplateId?: string | null;
}): Promise<MarketplacePublicationDto> {
  const res = await apiFetch("/api/marketplace/publications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readApiError(res));
  const data = (await res.json()) as { publication: MarketplacePublicationDto };
  return data.publication;
}

export async function updateMarketplacePublication(
  id: string,
  body: {
    name: string;
    shortDescription: string;
    messages?: unknown;
    serverGuildId?: string | null;
    serverGuildName?: string | null;
    sourceEmbedTemplateId?: string | null;
    sourceServerTemplateId?: string | null;
  },
): Promise<MarketplacePublicationDto> {
  const res = await apiFetch(`/api/marketplace/publications/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readApiError(res));
  const data = (await res.json()) as { publication: MarketplacePublicationDto };
  return data.publication;
}

export async function deleteMarketplacePublication(id: string): Promise<void> {
  const res = await apiFetch(`/api/marketplace/publications/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(await readApiError(res));
}

export async function bumpMarketplacePublicationDownload(id: string): Promise<{ downloads: number }> {
  const res = await apiFetch(`/api/marketplace/publications/${encodeURIComponent(id)}/downloads`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return (await res.json()) as { downloads: number };
}
