import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { createEmbedTemplate, fetchEmbedTemplates } from "../../lib/embedsApi.js";
import {
  bumpMarketplacePublicationDownload,
  fetchMarketplacePublication,
  fetchMarketplacePublications,
  fetchMarketplaceStats,
  type MarketplacePublicationDto,
  type MarketplaceTemplateStats,
} from "../../lib/marketplaceApi.js";
import type { EmbedTemplate } from "../../types/embedTemplate.js";
import type { EligibleGuild } from "../../types/guild.js";
import type { PanelUser } from "../../types/auth.js";
import type {
  MarketplaceListItem,
  MarketplaceSortId,
  MarketplaceTypeFilterId,
} from "../../types/marketplace.js";
import { MarketplaceDetailModal } from "./MarketplaceDetailModal.js";
import { PublishTemplateModal } from "./PublishTemplateModal.js";

type Props = {
  discordGuildId: string;
  eligibleGuilds: EligibleGuild[];
  user: PanelUser;
};

function discordAvatarUrl(userId: string, avatarHash: string | null): string | null {
  if (!avatarHash) return null;
  const ext = avatarHash.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.${ext}?size=64`;
}

function publicationDtoToListItem(p: MarketplacePublicationDto): MarketplaceListItem {
  return {
    id: p.id,
    kind: p.kind,
    name: p.name,
    shortDescription: p.shortDescription,
    authorDiscordId: p.authorDiscordId,
    authorDisplayName: p.authorGlobalName ?? p.authorUsername,
    authorAvatar: p.authorAvatar,
    likes: p.likes,
    downloads: p.downloads,
    createdAt: p.createdAt,
    messages: p.messages,
    serverGuildId: p.serverGuildId ?? undefined,
    serverGuildName: p.serverGuildName ?? undefined,
    sourceServerTemplateId: p.sourceServerTemplateId ?? undefined,
  };
}

/** Options « type » — étendre ce tableau pour de nouveaux types (ex. automod). */
const TYPE_OPTIONS: { id: MarketplaceTypeFilterId; label: string }[] = [
  { id: "all", label: "Tous" },
  { id: "embed", label: "Embeds" },
  { id: "server", label: "Templates structure" },
];

const SORT_OPTIONS: { id: MarketplaceSortId; label: string }[] = [
  { id: "popular", label: "Populaire" },
  { id: "recent", label: "Récent" },
];

export function MarketplacePageContent({ discordGuildId, eligibleGuilds, user }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<MarketplaceTypeFilterId>("all");
  const [sort, setSort] = useState<MarketplaceSortId>("popular");
  const [publishOpen, setPublishOpen] = useState(false);
  const [publicationToEdit, setPublicationToEdit] = useState<MarketplacePublicationDto | null>(null);
  const [apiPublications, setApiPublications] = useState<MarketplacePublicationDto[]>([]);
  const [embedTemplates, setEmbedTemplates] = useState<EmbedTemplate[]>([]);
  const [embedsLoading, setEmbedsLoading] = useState(false);
  const [localTick, setLocalTick] = useState(0);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<MarketplaceListItem | null>(null);
  const [engagementRev, setEngagementRev] = useState(0);
  const [statsMap, setStatsMap] = useState<Record<string, MarketplaceTemplateStats>>({});

  const refreshPublished = useCallback(() => setLocalTick((t) => t + 1), []);

  const showToast = useCallback((msg: string) => setToast(msg), []);

  const loadPublications = useCallback(() => {
    void fetchMarketplacePublications()
      .then((list) => setApiPublications(list))
      .catch(() => {
        setApiPublications([]);
        showToast("Impossible de charger les publications du marketplace.");
      });
  }, [showToast]);

  const closePublishModal = useCallback(() => {
    setPublishOpen(false);
    setPublicationToEdit(null);
    if (searchParams.get("publishServerTemplate")) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("publishServerTemplate");
          return next;
        },
        { replace: true },
      );
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const id = searchParams.get("publishServerTemplate");
    if (!id || publishOpen) return;
    setPublicationToEdit(null);
    setPublishOpen(true);
  }, [searchParams, publishOpen]);

  const openManagePublication = useCallback(
    (id: string) => {
      void fetchMarketplacePublication(id)
        .then((pub) => {
          if (pub.authorDiscordId !== user.id) return;
          setPublicationToEdit(pub);
          setPublishOpen(true);
          setDetailItem(null);
        })
        .catch(() => {
          showToast("Impossible d’ouvrir cette publication.");
        });
    },
    [user.id, showToast],
  );

  const handlePublicationDeleted = useCallback(() => {
    setDetailItem(null);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!publishOpen) return;
    let cancelled = false;
    setEmbedsLoading(true);
    void fetchEmbedTemplates(discordGuildId)
      .then((list) => {
        if (!cancelled) setEmbedTemplates(list);
      })
      .catch(() => {
        if (!cancelled) {
          setEmbedTemplates([]);
          showToast("Impossible de charger vos modèles d’embeds.");
        }
      })
      .finally(() => {
        if (!cancelled) setEmbedsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [publishOpen, discordGuildId, showToast]);

  useEffect(() => {
    void localTick;
    loadPublications();
  }, [localTick, loadPublications]);

  const mergedList = useMemo(() => {
    return apiPublications.map(publicationDtoToListItem);
  }, [apiPublications]);

  useEffect(() => {
    const ids = mergedList.map((i) => i.id);
    if (ids.length === 0) {
      setStatsMap({});
      return;
    }
    let cancelled = false;
    void fetchMarketplaceStats(ids)
      .then((m) => {
        if (!cancelled) setStatsMap(m);
      })
      .catch(() => {
        if (!cancelled) setStatsMap({});
      });
    return () => {
      cancelled = true;
    };
  }, [mergedList, engagementRev]);

  const filteredSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = mergedList.filter((item) => {
      if (typeFilter !== "all" && item.kind !== typeFilter) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.shortDescription.toLowerCase().includes(q) ||
        item.authorDisplayName.toLowerCase().includes(q)
      );
    });
    rows = [...rows].sort((a, b) => {
      if (sort === "recent") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      const la = statsMap[a.id]?.likeCount ?? a.likes;
      const lb = statsMap[b.id]?.likeCount ?? b.likes;
      if (lb !== la) return lb - la;
      return b.downloads - a.downloads;
    });
    return rows;
  }, [mergedList, search, typeFilter, sort, statsMap]);

  const onImport = async (item: MarketplaceListItem) => {
    if (item.kind === "server") {
      showToast(
        "L’import d’un template de structure depuis le marketplace sera disponible dans une prochaine version.",
      );
      return;
    }
    const msgs = item.messages;
    if (!Array.isArray(msgs) || msgs.length === 0) {
      showToast("Cette template ne contient pas de données d’embed importables.");
      return;
    }
    setImportingId(item.id);
    try {
      const baseName = `${item.name} · import`;
      let name = baseName;
      const existing = await fetchEmbedTemplates(discordGuildId).catch(() => [] as EmbedTemplate[]);
      let n = 2;
      while (existing.some((e) => e.name === name)) {
        name = `${baseName} (${n})`;
        n += 1;
      }
      await createEmbedTemplate(discordGuildId, {
        name,
        messages: msgs,
      });
      if (!item.id.startsWith("seed-")) {
        void bumpMarketplacePublicationDownload(item.id)
          .then(() => {
            refreshPublished();
          })
          .catch(() => {});
      }
      setDetailItem(null);
      showToast(`Modèle « ${name} » ajouté dans Embeds.`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Import impossible.");
    } finally {
      setImportingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {toast ? (
        <div
          className="ui-card border-vex-accent/40 bg-vex-accent/10 px-4 py-3 text-sm text-zinc-100"
          role="status"
        >
          {toast}
        </div>
      ) : null}

      <div className="ui-card flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
          <input
            type="search"
            className="ui-input min-w-[12rem] flex-1 sm:max-w-xs"
            placeholder="Rechercher une template…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Rechercher une template"
          />
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="ui-input w-auto min-w-[8.5rem]"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as MarketplaceTypeFilterId)}
              aria-label="Filtrer par type"
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              className="ui-input w-auto min-w-[9.5rem]"
              value={sort}
              onChange={(e) => setSort(e.target.value as MarketplaceSortId)}
              aria-label="Trier"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex shrink-0 justify-end sm:ml-auto">
          <button
            type="button"
            className="ui-btn-primary"
            onClick={() => {
              setPublicationToEdit(null);
              setPublishOpen(true);
            }}
          >
            Publier une template
          </button>
        </div>
      </div>

      {filteredSorted.length === 0 ? (
        <div className="ui-empty-state">Aucune template ne correspond à votre recherche.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredSorted.map((item) => {
            const st = statsMap[item.id];
            const likesShown = st !== undefined ? st.likeCount : item.likes;
            const commentCount = st !== undefined ? st.commentCount : 0;
            const isMine = item.authorDiscordId === user.id && !item.id.startsWith("seed-");
            return (
            <article
              key={item.id}
              className="ui-card flex cursor-pointer flex-col p-4 transition hover:border-vex-accent/35 hover:bg-vex-surface/60"
              tabIndex={0}
              role="button"
              onClick={() => setDetailItem(item)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setDetailItem(item);
                }
              }}
              aria-label={`Ouvrir le détail : ${item.name}`}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <span
                  className={
                    item.kind === "embed"
                      ? "rounded-full bg-vex-accent/15 px-2 py-0.5 text-xs font-medium text-vex-accent"
                      : "rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400"
                  }
                >
                  {item.kind === "embed" ? "Embed" : "Template"}
                </span>
                {isMine ? (
                  <button
                    type="button"
                    className="ui-btn-secondary shrink-0 px-2.5 py-1 text-xs"
                    aria-label={`Gérer votre publication : ${item.name}`}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      openManagePublication(item.id);
                    }}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <span className="fa-solid fa-gear mr-1.5" aria-hidden />
                    Gérer
                  </button>
                ) : null}
              </div>
              <h3 className="text-base font-semibold text-zinc-100">{item.name}</h3>
              <p className="mt-1 line-clamp-2 text-sm text-zinc-400">{item.shortDescription}</p>

              <div className="mt-3 flex items-center gap-2 border-t border-vex-border/80 pt-3">
                {item.authorLogoUrl ? (
                  <img
                    src={item.authorLogoUrl}
                    alt=""
                    className="h-8 w-8 rounded-lg bg-vex-surface object-contain p-0.5 ring-1 ring-vex-border/80"
                    decoding="async"
                    referrerPolicy="no-referrer"
                  />
                ) : discordAvatarUrl(item.authorDiscordId, item.authorAvatar) ? (
                  <img
                    src={discordAvatarUrl(item.authorDiscordId, item.authorAvatar)!}
                    alt=""
                    className="h-8 w-8 rounded-lg object-cover"
                    decoding="async"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-vex-border text-xs font-semibold text-zinc-400">
                    {item.authorDisplayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="truncate text-sm text-zinc-300">{item.authorDisplayName}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                <span title="J’aime">
                  <span className="fa-solid fa-heart mr-1.5 text-rose-400/90" aria-hidden />
                  <span className="font-medium tabular-nums text-zinc-300">{likesShown}</span>
                </span>
                <span title="Commentaires">
                  <span className="fa-solid fa-comment mr-1.5 text-zinc-400" aria-hidden />
                  <span className="font-medium tabular-nums text-zinc-300">{commentCount}</span>
                </span>
                <span title="Nombre de fois où ce modèle a été importé dans Embeds">
                  <span className="fa-solid fa-file-import mr-1.5 text-sky-400/90" aria-hidden />
                  <span className="font-medium tabular-nums text-zinc-300">{item.downloads}</span>
                </span>
              </div>
            </article>
            );
          })}
        </div>
      )}

      {detailItem ? (
        <MarketplaceDetailModal
          item={mergedList.find((i) => i.id === detailItem.id) ?? detailItem}
          templateStats={statsMap[detailItem.id]}
          user={user}
          onClose={() => setDetailItem(null)}
          eligibleGuilds={eligibleGuilds}
          importingId={importingId}
          onImport={(it) => void onImport(it)}
          onEngagementChange={() => setEngagementRev((n) => n + 1)}
          onManagePublication={openManagePublication}
        />
      ) : null}

      <PublishTemplateModal
        open={publishOpen}
        publicationToEdit={publicationToEdit}
        discordGuildId={discordGuildId}
        initialServerTemplateId={searchParams.get("publishServerTemplate")}
        onClose={closePublishModal}
        embedTemplates={embedTemplates}
        embedsLoading={embedsLoading}
        onPublished={refreshPublished}
        onToast={showToast}
        onPublicationDeleted={handlePublicationDeleted}
      />
    </div>
  );
}
