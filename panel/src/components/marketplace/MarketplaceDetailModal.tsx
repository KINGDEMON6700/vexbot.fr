import { useCallback, useEffect, useState } from "react";
import type { EligibleGuild } from "../../types/guild.js";
import type { PanelUser } from "../../types/auth.js";
import type { MarketplaceListItem } from "../../types/marketplace.js";
import {
  deleteMarketplaceComment,
  fetchMarketplaceComments,
  postMarketplaceComment,
  toggleMarketplaceLikeApi,
  type MarketplaceCommentApi,
  type MarketplaceTemplateStats,
} from "../../lib/marketplaceApi.js";
import { embedMessagesToPreviewDraft } from "../../lib/marketplaceEmbedPreview.js";
import { getServerMarketplacePreviewLayout, getServerMarketplacePreviewLayoutFromSnapshot, isServerTemplateMarketplaceSnapshot } from "../../lib/marketplaceServerLayouts.js";
import { guildIconUrl } from "../../lib/guildIconUrl.js";
import { DiscordEmbedPreview } from "../embeds/DiscordEmbedPreview.js";
import { DiscordServerStructurePreview } from "./DiscordServerStructurePreview.js";

type Props = {
  item: MarketplaceListItem;
  /** Stats serveur pour cette template (undefined tant que la liste n’a pas fini de charger). */
  templateStats?: MarketplaceTemplateStats;
  user: PanelUser;
  onClose: () => void;
  eligibleGuilds: EligibleGuild[];
  importingId: string | null;
  onImport: (item: MarketplaceListItem) => void;
  onEngagementChange?: () => void;
  /** Ouvre la popup « Gérer ta publication » (formulaire + suppression). */
  onManagePublication?: (publicationId: string) => void;
};

function discordAvatarUrl(userId: string, avatarHash: string | null, size = 128): string | null {
  if (!avatarHash) return null;
  const ext = avatarHash.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.${ext}?size=${size}`;
}

function serverIconUrlForItem(item: MarketplaceListItem, eligibleGuilds: EligibleGuild[]): string | null {
  if (!item.serverGuildId) return null;
  const g = eligibleGuilds.find((x) => x.id === item.serverGuildId);
  if (!g?.icon) return null;
  return guildIconUrl(g.id, g.icon, 128);
}

function formatListedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function formatCommentAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function MarketplaceDetailModal({
  item,
  templateStats,
  user,
  onClose,
  eligibleGuilds,
  importingId,
  onImport,
  onEngagementChange,
  onManagePublication,
}: Props) {
  const [comments, setComments] = useState<MarketplaceCommentApi[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [commentHint, setCommentHint] = useState<string | null>(null);
  const [likeBusy, setLikeBusy] = useState(false);
  const [likeHint, setLikeHint] = useState<string | null>(null);

  const liked = templateStats?.likedByMe ?? false;
  const likeCountShown = templateStats !== undefined ? templateStats.likeCount : item.likes;

  const isMyPublication =
    item.authorDiscordId === user.id && !item.id.startsWith("seed-") && Boolean(onManagePublication);

  const reloadComments = useCallback(async () => {
    setCommentsLoading(true);
    try {
      const list = await fetchMarketplaceComments(item.id);
      setComments(list);
    } catch {
      setComments([]);
      setCommentHint("Impossible de charger les commentaires.");
    } finally {
      setCommentsLoading(false);
    }
  }, [item.id]);

  useEffect(() => {
    setCommentHint(null);
    setLikeHint(null);
    setComments([]);
    setCommentDraft("");
    setCommentsLoading(true);
    void reloadComments();
  }, [item.id, reloadComments]);

  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [item, onClose]);

  const toggleLike = () => {
    if (likeBusy) return;
    setLikeBusy(true);
    setLikeHint(null);
    void toggleMarketplaceLikeApi(item.id)
      .then(() => {
        onEngagementChange?.();
      })
      .catch((e) => {
        setLikeHint(e instanceof Error ? e.message : "Action impossible.");
      })
      .finally(() => {
        setLikeBusy(false);
      });
  };

  const submitComment = () => {
    const t = commentDraft.trim();
    if (!t) {
      setCommentHint("Écris un message avant d’envoyer.");
      return;
    }
    setCommentBusy(true);
    setCommentHint(null);
    void postMarketplaceComment(item.id, t)
      .then(() => reloadComments())
      .then(() => {
        setCommentDraft("");
        onEngagementChange?.();
      })
      .catch((e) => {
        setCommentHint(e instanceof Error ? e.message : "Envoi impossible. Réessaie.");
      })
      .finally(() => {
        setCommentBusy(false);
      });
  };

  const removeComment = (commentId: string) => {
    if (!window.confirm("Supprimer ce commentaire ?")) return;
    setDeletingCommentId(commentId);
    setCommentHint(null);
    void deleteMarketplaceComment(item.id, commentId)
      .then(() => reloadComments())
      .then(() => {
        onEngagementChange?.();
      })
      .catch((e) => {
        setCommentHint(e instanceof Error ? e.message : "Suppression impossible.");
      })
      .finally(() => {
        setDeletingCommentId(null);
      });
  };

  const serverLayout =
    item.kind === "server"
      ? isServerTemplateMarketplaceSnapshot(item.messages)
        ? getServerMarketplacePreviewLayoutFromSnapshot(item.messages, item.name)
        : getServerMarketplacePreviewLayout(item)
      : null;

  const serverSnapshot =
    item.kind === "server" && isServerTemplateMarketplaceSnapshot(item.messages) ? item.messages : null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-3 sm:p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="ui-card flex max-h-[min(92vh,52rem)] w-full max-w-6xl flex-col overflow-hidden shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="marketplace-detail-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-vex-border px-4 py-3 sm:px-5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Marketplace</span>
          <button type="button" className="ui-btn-secondary shrink-0" onClick={onClose}>
            Fermer
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
          <div className="vex-scrollbar flex min-h-0 w-full shrink-0 flex-col overflow-y-auto border-vex-border p-4 sm:p-5 lg:max-w-md lg:border-r xl:max-w-lg">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span
                className={
                  item.kind === "embed"
                    ? "rounded-full bg-vex-accent/15 px-2 py-0.5 text-xs font-medium text-vex-accent"
                    : "rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400"
                }
              >
                {item.kind === "embed" ? "Embed" : "Template"}
              </span>
              <span className="text-xs text-zinc-500">Publié le {formatListedAt(item.createdAt)}</span>
            </div>
            <h2 id="marketplace-detail-title" className="text-xl font-semibold tracking-tight text-zinc-100">
              {item.name}
            </h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-400">{item.shortDescription}</p>

            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-vex-border/80 pt-4 text-sm text-zinc-500">
              <div className="flex min-w-0 basis-full items-center gap-2 sm:basis-auto">
                {item.authorLogoUrl ? (
                  <img
                    src={item.authorLogoUrl}
                    alt=""
                    className="h-9 w-9 shrink-0 rounded-lg bg-vex-surface object-contain p-0.5 ring-1 ring-vex-border/80"
                    decoding="async"
                    referrerPolicy="no-referrer"
                  />
                ) : discordAvatarUrl(item.authorDiscordId, item.authorAvatar) ? (
                  <img
                    src={discordAvatarUrl(item.authorDiscordId, item.authorAvatar)!}
                    alt=""
                    className="h-9 w-9 shrink-0 rounded-lg object-cover"
                    decoding="async"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-vex-border text-sm font-semibold text-zinc-400">
                    {item.authorDisplayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="truncate font-medium text-zinc-300">{item.authorDisplayName}</span>
              </div>
              <span title="J’aime">
                <span className="fa-solid fa-heart mr-1.5 text-rose-400/90" aria-hidden />
                <span className="font-medium tabular-nums text-zinc-300">{likeCountShown}</span>
              </span>
              {templateStats !== undefined ? (
                <span title="Commentaires">
                  <span className="fa-solid fa-comment mr-1.5 text-zinc-400" aria-hidden />
                  <span className="font-medium tabular-nums text-zinc-300">{templateStats.commentCount}</span>
                </span>
              ) : null}
              <span title="Nombre de fois où ce modèle a été importé dans Embeds">
                <span className="fa-solid fa-file-import mr-1.5 text-sky-400/90" aria-hidden />
                <span className="font-medium tabular-nums text-zinc-300">{item.downloads}</span>
              </span>
            </div>

            {isMyPublication ? (
              <div className="mt-4">
                <button
                  type="button"
                  className="ui-btn-secondary w-full text-sm"
                  onClick={() => onManagePublication?.(item.id)}
                >
                  <span className="fa-solid fa-gear mr-2" aria-hidden />
                  Gérer la publication
                </button>
              </div>
            ) : null}

            <div className={isMyPublication ? "mt-3" : "mt-4"}>
              <button
                type="button"
                className={
                  liked
                    ? "ui-btn-secondary w-full border-rose-500/35 text-rose-200 hover:bg-rose-500/10"
                    : "ui-btn-secondary w-full"
                }
                onClick={toggleLike}
                aria-pressed={liked}
                disabled={likeBusy}
              >
                <span className={`fa-solid fa-heart mr-2 ${liked ? "text-rose-400" : "text-zinc-500"}`} aria-hidden />
                {likeBusy ? "…" : liked ? "J’aime plus" : "J’aime"}
                <span className="ml-2 text-zinc-400">({likeCountShown})</span>
              </button>
              {likeHint ? <p className="mt-1.5 text-[11px] text-amber-200/90">{likeHint}</p> : null}
            </div>

            <div className="mt-6 border-t border-vex-border pt-5">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Commentaires</h3>
              <div className="vex-scrollbar mt-2 max-h-80 space-y-3 overflow-y-auto rounded-lg border border-vex-border/60 bg-vex-bg/30 p-2">
                {commentsLoading ? (
                  <p className="px-2 py-4 text-center text-xs text-zinc-500">Chargement…</p>
                ) : comments.length === 0 ? (
                  <p className="px-2 py-4 text-center text-xs text-zinc-500">Aucun commentaire pour l’instant.</p>
                ) : (
                  comments.map((c) => {
                    const displayName = c.authorGlobalName ?? c.authorUsername;
                    const isMine = c.discordUserId === user.id;
                    return (
                      <div key={c.id} className="rounded-md border border-vex-border/40 bg-vex-surface/50 px-2.5 py-2">
                        <div className="flex items-start gap-2">
                          {discordAvatarUrl(c.discordUserId, c.authorAvatar, 64) ? (
                            <img
                              src={discordAvatarUrl(c.discordUserId, c.authorAvatar, 64)!}
                              alt=""
                              className="mt-0.5 h-7 w-7 shrink-0 rounded-md object-cover"
                              decoding="async"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-vex-border text-[10px] font-semibold text-zinc-400">
                              {displayName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
                              <span className="text-xs font-medium text-zinc-200">{displayName}</span>
                              {isMine ? (
                                <span className="rounded bg-vex-accent/20 px-1.5 py-0.5 text-[10px] font-medium text-vex-accent">
                                  Toi
                                </span>
                              ) : null}
                              <span className="text-[10px] text-zinc-600">{formatCommentAt(c.createdAt)}</span>
                            </div>
                            <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-zinc-400">
                              {c.body}
                            </p>
                          </div>
                          {isMine ? (
                            <button
                              type="button"
                              className="shrink-0 rounded border border-red-500/40 px-2 py-1 text-[10px] font-medium text-red-200 hover:bg-red-500/10 disabled:opacity-50"
                              disabled={deletingCommentId !== null || commentBusy}
                              aria-label="Supprimer ce commentaire"
                              onClick={() => removeComment(c.id)}
                            >
                              {deletingCommentId === c.id ? "…" : "Supprimer"}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <label className="mt-3 block text-xs font-medium text-zinc-400" htmlFor="marketplace-comment">
                Ton commentaire
              </label>
              <textarea
                id="marketplace-comment"
                className="ui-input mt-1.5 min-h-[72px] resize-y text-sm"
                value={commentDraft}
                onChange={(e) => setCommentDraft(e.target.value)}
                placeholder="Partage ton avis sur cette template…"
                maxLength={2000}
                disabled={commentBusy || deletingCommentId !== null}
              />
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="text-[10px] text-zinc-600">{commentDraft.length}/2000</span>
                <button
                  type="button"
                  className="ui-btn-secondary text-xs"
                  disabled={commentBusy || deletingCommentId !== null}
                  onClick={() => submitComment()}
                >
                  {commentBusy ? "Publication…" : "Publier le commentaire"}
                </button>
              </div>
              {commentHint ? (
                <p className="mt-1 text-right text-[11px] text-amber-200/90">{commentHint}</p>
              ) : null}
            </div>

            <div className="mt-6 border-t border-vex-border pt-5">
              <button
                type="button"
                className="ui-btn-primary w-full"
                disabled={importingId === item.id}
                onClick={() => onImport(item)}
              >
                {importingId === item.id ? "Import…" : "Importer"}
              </button>
            </div>
          </div>

          <div
            className="vex-scrollbar flex min-h-[min(52vh,26rem)] flex-1 flex-col overflow-y-auto border-t border-vex-border p-4 sm:p-5 lg:min-h-0 lg:border-t-0"
            style={{ backgroundColor: "rgba(14, 14, 20, 0.65)" }}
          >
            <p className="mb-3 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Aperçu</p>
            <div className="min-h-0 w-full flex-1">
              {item.kind === "embed" && Array.isArray(item.messages) && item.messages.length > 0 ? (
                <div className="overflow-hidden rounded-lg border border-vex-border/80">
                  <DiscordEmbedPreview
                    draft={embedMessagesToPreviewDraft(item.messages)}
                    mentionLookup={{ channelNames: {}, roleNames: {} }}
                    compact={false}
                    className="rounded-none border-0 shadow-none"
                  />
                </div>
              ) : null}
              {item.kind === "embed" && (!Array.isArray(item.messages) || item.messages.length === 0) ? (
                <p className="rounded-lg border border-dashed border-vex-border/60 bg-vex-bg/30 px-4 py-8 text-center text-sm text-zinc-500">
                  Aucun aperçu embed pour cette template.
                </p>
              ) : null}
              {item.kind === "server" && serverLayout ? (
                <div className="w-full max-w-4xl">
                  <DiscordServerStructurePreview
                    serverName={serverLayout.serverName}
                    iconUrl={serverIconUrlForItem(item, eligibleGuilds)}
                    categories={serverLayout.categories}
                    snapshot={serverSnapshot}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
