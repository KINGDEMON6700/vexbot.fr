import type { MarketplaceListItem } from "../types/marketplace.js";
import type {
  ServerTemplateChannelSnapshot,
  ServerTemplateSnapshot,
} from "../types/serverTemplate.js";

export type ServerPreviewCategory = {
  name: string;
  channels: { name: string; voice?: boolean }[];
};

/** Snapshot v1 issu de la page Templates (stocké sur la publication marketplace). */
export function isServerTemplateMarketplaceSnapshot(m: unknown): m is ServerTemplateSnapshot {
  if (!m || typeof m !== "object") return false;
  const o = m as { v?: unknown; roles?: unknown; channels?: unknown };
  return o.v === 1 && Array.isArray(o.roles) && Array.isArray(o.channels);
}

export function getServerMarketplacePreviewLayoutFromSnapshot(
  snap: ServerTemplateSnapshot,
  fallbackName: string,
): {
  serverName: string;
  categories: ServerPreviewCategory[];
} {
  const categories = snap.channels
    .filter((c) => c.type === "category")
    .sort((a, b) => a.position - b.position);
  const nonCat = snap.channels.filter((c) => c.type !== "category");
  const childrenByParent = new Map<string | null, ServerTemplateChannelSnapshot[]>();
  for (const c of nonCat) {
    const arr = childrenByParent.get(c.parentSourceId) ?? [];
    arr.push(c);
    childrenByParent.set(c.parentSourceId, arr);
  }
  for (const arr of childrenByParent.values()) {
    arr.sort((a, b) => a.position - b.position);
  }

  const out: ServerPreviewCategory[] = categories.map((cat) => ({
    name: cat.name,
    channels: (childrenByParent.get(cat.sourceId) ?? []).map((ch) => ({
      name: ch.name,
      voice: ch.type === "voice",
    })),
  }));

  const orphan = childrenByParent.get(null) ?? [];
  if (orphan.length > 0) {
    out.push({
      name: "Sans catégorie",
      channels: orphan.map((ch) => ({ name: ch.name, voice: ch.type === "voice" })),
    });
  }

  if (out.length === 0) {
    return {
      serverName: snap.guildName?.trim() || fallbackName,
      categories: [{ name: "Structure", channels: [{ name: "Aucun salon dans le snapshot" }] }],
    };
  }

  return {
    serverName: snap.guildName?.trim() || fallbackName,
    categories: out,
  };
}

/** Arborescence illustrative quand aucun snapshot n’est disponible (anciennes fiches). */
export function getServerMarketplacePreviewLayout(item: MarketplaceListItem): {
  serverName: string;
  categories: ServerPreviewCategory[];
} {
  const serverName = item.serverGuildName ?? item.name;

  return {
    serverName,
    categories: [
      { name: "Texte", channels: [{ name: "discussion" }, { name: "annonces" }] },
      { name: "Autres", channels: [{ name: "suggestions" }] },
    ],
  };
}
