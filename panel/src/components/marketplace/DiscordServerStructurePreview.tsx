import { useMemo, useState } from "react";
import type { ServerPreviewCategory } from "../../lib/marketplaceServerLayouts.js";
import { humanizeDiscordPermissionBits, humanizeOverwritePair, parseDiscordPermissionBits } from "../../lib/discordPermissionLabels.js";
import type {
  ServerTemplateChannelSnapshot,
  ServerTemplateChannelType,
  ServerTemplateRoleSnapshot,
  ServerTemplateSnapshot,
} from "../../types/serverTemplate.js";

type Props = {
  serverName: string;
  iconUrl: string | null;
  categories: ServerPreviewCategory[];
  /** Snapshot complet : rôles + règles salon détaillées (publications récentes). */
  snapshot?: ServerTemplateSnapshot | null;
};

const BG_APP = "#1e1f22";
const BG_SIDEBAR = "#121314";
const BG_MAIN = "#2b2d31";
const TEXT_MUTED = "#949ba4";
const TEXT_MAIN = "#f2f3f5";

function intToHex(n: number): string {
  return `#${(n & 0xffffff).toString(16).padStart(6, "0")}`;
}

function channelIconClass(t: ServerTemplateChannelType): string {
  switch (t) {
    case "text":
      return "fa-solid fa-hashtag";
    case "voice":
      return "fa-solid fa-volume-high";
    case "announcement":
      return "fa-solid fa-bullhorn";
    case "stage":
      return "fa-solid fa-microphone-lines";
    case "forum":
      return "fa-solid fa-comments";
    case "media":
      return "fa-solid fa-image";
    case "category":
      return "fa-solid fa-folder";
    default:
      return "fa-solid fa-hashtag";
  }
}

function PermGroup({ title, labels, tone }: { title?: string; labels: string[]; tone: "allow" | "deny" | "neutral" }) {
  if (labels.length === 0) return null;
  const pill =
    tone === "allow"
      ? "border-emerald-500/35 bg-emerald-600/15 text-emerald-100"
      : tone === "deny"
        ? "border-red-500/35 bg-red-600/15 text-red-100"
        : "border-zinc-600/40 bg-zinc-800/60 text-zinc-300";
  return (
    <div className="mt-1.5">
      {title ? (
        <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: TEXT_MUTED }}>
          {title}
        </p>
      ) : null}
      <div className={`flex flex-wrap gap-1 ${title ? "mt-1" : ""}`}>
        {labels.map((l) => (
          <span key={l} className={`rounded border px-1.5 py-0.5 text-[10px] leading-tight ${pill}`}>
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

function SnapshotRolesBlock({ snapshot }: { snapshot: ServerTemplateSnapshot }) {
  const sorted = useMemo(
    () => [...snapshot.roles].sort((a, b) => b.position - a.position),
    [snapshot.roles],
  );

  if (sorted.length === 0) {
    return (
      <div className="border-t border-black/25 px-3 py-3" style={{ backgroundColor: BG_MAIN }}>
        <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: TEXT_MUTED }}>
          Rôles
        </p>
        <p className="mt-1 text-xs" style={{ color: TEXT_MUTED }}>
          Aucun rôle dans ce snapshot.
        </p>
      </div>
    );
  }

  return (
    <div className="border-t border-black/25 px-3 py-3" style={{ backgroundColor: BG_MAIN }}>
      <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: TEXT_MUTED }}>
        Rôles — permissions globales
      </p>
      <p className="mt-0.5 text-[11px] leading-snug" style={{ color: TEXT_MUTED }}>
        Ce que chaque rôle peut faire sur tout le serveur (hors règles spéciales par salon).
      </p>
      <ul className="mt-2 space-y-1.5">
        {sorted.map((role) => (
          <RolePermDetails key={role.sourceId} role={role} />
        ))}
      </ul>
    </div>
  );
}

function RolePermDetails({ role }: { role: ServerTemplateRoleSnapshot }) {
  const hasColor = role.color !== 0;
  const bits = parseDiscordPermissionBits(role.permissions);
  const labels = humanizeDiscordPermissionBits(bits);
  const meta: string[] = [];
  if (role.managed) meta.push("géré par une application");
  if (role.hoist) meta.push("affiché à part");
  if (role.mentionable) meta.push("mentionnable");

  return (
    <li className="rounded-md border border-black/20 bg-black/15 px-2 py-2">
      <details className="group">
        <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
          <div className="flex items-center gap-2">
            <span
              className="h-3 w-3 shrink-0 rounded-full border border-white/10"
              style={{ backgroundColor: hasColor ? intToHex(role.color) : "#4e5058" }}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate text-sm font-medium" style={{ color: TEXT_MAIN }}>
              {role.name}
            </span>
            <span className="shrink-0 text-[10px]" style={{ color: TEXT_MUTED }}>
              {labels.length} droit{labels.length > 1 ? "s" : ""}
            </span>
            <span
              className="fa-solid fa-chevron-down shrink-0 text-[10px] opacity-50 transition group-open:rotate-180"
              style={{ color: TEXT_MUTED }}
              aria-hidden
            />
          </div>
          {meta.length > 0 ? (
            <p className="mt-1 pl-5 text-[10px]" style={{ color: TEXT_MUTED }}>
              {meta.join(" · ")}
            </p>
          ) : null}
        </summary>
        <div className="mt-2 border-t border-black/15 pt-2 pl-1">
          <PermGroup title="Droits du rôle" labels={labels} tone="allow" />
        </div>
      </details>
    </li>
  );
}

/** Panneau déroulé : règles par rôle pour un salon ou une catégorie. */
function ChannelOverwritesPanel({
  channel,
  roleById,
}: {
  channel: ServerTemplateChannelSnapshot;
  roleById: Map<string, ServerTemplateRoleSnapshot>;
}) {
  const ow = channel.permissionOverwrites;
  if (ow.length === 0) return null;

  return (
    <ul className="mt-1.5 space-y-2 border-l-2 border-[#5865f2]/40 pl-2.5">
      {ow.map((o) => {
        const role = roleById.get(o.roleSourceId);
        const name = role?.name ?? `Rôle (${o.roleSourceId.slice(0, 6)}…)`;
        const { allow, deny } = humanizeOverwritePair(o.allow, o.deny);
        return (
          <li key={o.roleSourceId} className="rounded border border-black/15 bg-black/20 px-2 py-1.5">
            <p className="text-xs font-medium" style={{ color: TEXT_MAIN }}>
              {name}
            </p>
            <PermGroup labels={allow} tone="allow" />
            <PermGroup labels={deny} tone="deny" />
          </li>
        );
      })}
    </ul>
  );
}

function PermToggleButton({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="ml-auto flex shrink-0 items-center gap-1 rounded border border-black/25 bg-black/20 px-1.5 py-0.5 text-[10px] font-medium transition hover:bg-black/35"
      style={{ color: TEXT_MUTED }}
      aria-expanded={open}
      title={open ? "Masquer les permissions" : "Voir les règles spéciales de ce salon"}
    >
      <span className="fa-solid fa-shield-halved text-[9px]" aria-hidden />
      Perms
      <span
        className={`fa-solid fa-chevron-down text-[8px] opacity-80 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        aria-hidden
      />
    </button>
  );
}

function SnapshotChannelRow({
  channel,
  roleById,
  indent,
}: {
  channel: ServerTemplateChannelSnapshot;
  roleById: Map<string, ServerTemplateRoleSnapshot>;
  indent?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const hasOw = channel.permissionOverwrites.length > 0;
  const iconClass = channelIconClass(channel.type);

  return (
    <li className={`${indent ? "pl-2" : ""}`}>
      <div className="flex items-center gap-1.5 rounded px-1.5 py-1 text-sm" style={{ color: "#8d9095" }}>
        <span className={`${iconClass} w-4 shrink-0 text-center text-[11px]`} aria-hidden />
        <span className="min-w-0 flex-1 truncate" style={{ color: TEXT_MUTED }}>
          {channel.name}
        </span>
        {hasOw ? <PermToggleButton open={open} onClick={() => setOpen((v) => !v)} /> : null}
      </div>
      {open && hasOw ? <ChannelOverwritesPanel channel={channel} roleById={roleById} /> : null}
    </li>
  );
}

function SnapshotCategoryBlock({
  cat,
  children,
  roleById,
}: {
  cat: ServerTemplateChannelSnapshot;
  children: ServerTemplateChannelSnapshot[];
  roleById: Map<string, ServerTemplateRoleSnapshot>;
}) {
  const [open, setOpen] = useState(false);
  const hasOw = cat.permissionOverwrites.length > 0;

  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-center gap-1.5 px-1.5 pb-1 pt-1">
        <span className={`${channelIconClass("category")} shrink-0 text-[11px]`} style={{ color: TEXT_MUTED }} aria-hidden />
        <span
          className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-wide"
          style={{ color: TEXT_MUTED }}
        >
          {cat.name}
        </span>
        {hasOw ? <PermToggleButton open={open} onClick={() => setOpen((v) => !v)} /> : null}
      </div>
      {open && hasOw ? <ChannelOverwritesPanel channel={cat} roleById={roleById} /> : null}
      <ul className="space-y-0.5">
        {children.map((ch) => (
          <SnapshotChannelRow key={ch.sourceId} channel={ch} roleById={roleById} indent />
        ))}
      </ul>
    </div>
  );
}

function SnapshotStructureTree({ snapshot }: { snapshot: ServerTemplateSnapshot }) {
  const roleById = useMemo(() => {
    const m = new Map<string, ServerTemplateRoleSnapshot>();
    for (const r of snapshot.roles) m.set(r.sourceId, r);
    return m;
  }, [snapshot.roles]);

  const { categories, childrenByParent, orphans } = useMemo(() => {
    const categories = snapshot.channels
      .filter((c) => c.type === "category")
      .sort((a, b) => a.position - b.position);
    const childrenByParent = new Map<string | null, ServerTemplateChannelSnapshot[]>();
    for (const c of snapshot.channels) {
      if (c.type === "category") continue;
      const arr = childrenByParent.get(c.parentSourceId) ?? [];
      arr.push(c);
      childrenByParent.set(c.parentSourceId, arr);
    }
    for (const arr of childrenByParent.values()) {
      arr.sort((a, b) => a.position - b.position);
    }
    const orphans = [...(childrenByParent.get(null) ?? [])].sort((a, b) => a.position - b.position);
    return { categories, childrenByParent, orphans };
  }, [snapshot.channels]);

  return (
    <div className="px-1.5 py-2">
      {orphans.length === 0 && categories.length === 0 ? (
        <p className="px-1.5 py-4 text-center text-xs" style={{ color: TEXT_MUTED }}>
          Aucun salon dans ce snapshot.
        </p>
      ) : null}
      {orphans.length > 0 ? (
        <div className="mb-3">
          <p className="px-1.5 pb-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: TEXT_MUTED }}>
            Sans catégorie
          </p>
          <ul className="space-y-0.5">
            {orphans.map((ch) => (
              <SnapshotChannelRow key={ch.sourceId} channel={ch} roleById={roleById} />
            ))}
          </ul>
        </div>
      ) : null}
      {categories.map((cat) => (
        <SnapshotCategoryBlock
          key={cat.sourceId}
          cat={cat}
          children={childrenByParent.get(cat.sourceId) ?? []}
          roleById={roleById}
        />
      ))}
    </div>
  );
}

/**
 * Aperçu type « liste de salons » Discord (illustration pour les templates serveur marketplace).
 */
export function DiscordServerStructurePreview({ serverName, iconUrl, categories, snapshot }: Props) {
  const initial = serverName.trim().charAt(0).toUpperCase() || "?";

  return (
    <div
      className="w-full max-w-4xl overflow-hidden rounded-lg border border-zinc-600/50 text-left shadow-inner"
      style={{ backgroundColor: BG_APP, fontFamily: "var(--font-discord-body)" }}
    >
      <div className="max-h-[min(88vh,52rem)] overflow-y-auto">
        <div className="flex min-h-[min(52vh,22rem)] sm:min-h-[min(48vh,26rem)]">
          <div
            className="flex w-11 shrink-0 flex-col items-center border-r border-black/25 py-3 sm:w-[52px]"
            style={{ backgroundColor: BG_SIDEBAR }}
            aria-hidden
          >
            {iconUrl ? (
              <img src={iconUrl} alt="" className="h-8 w-8 rounded-[12px] object-cover sm:h-10 sm:w-10 sm:rounded-[15px]" decoding="async" />
            ) : (
              <div
                className="flex h-8 w-8 items-center justify-center rounded-[12px] text-sm font-bold text-white sm:h-10 sm:w-10 sm:rounded-[15px]"
                style={{ backgroundColor: "#5865f2" }}
              >
                {initial}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1" style={{ backgroundColor: BG_MAIN }}>
            <div className="border-b border-black/20 px-3 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: TEXT_MUTED }}>
                Aperçu structure
              </p>
              <h4 className="truncate text-sm font-semibold" style={{ color: TEXT_MAIN }}>
                {serverName}
              </h4>
              <p className="mt-0.5 text-[11px] leading-snug" style={{ color: TEXT_MUTED }}>
                {snapshot
                  ? "Schéma des salons. Le bouton « Perms » n’apparaît que s’il y a des règles spéciales sur le salon ou la catégorie ; il permet de les consulter."
                  : "Schéma des salons (aperçu, pas une copie exacte de votre serveur)."}
              </p>
            </div>
            <div className="px-1.5 py-2">
              {snapshot ? (
                <SnapshotStructureTree snapshot={snapshot} />
              ) : (
                categories.map((cat) => (
                  <div key={cat.name} className="mb-3 last:mb-0">
                    <div
                      className="px-1.5 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide"
                      style={{ color: TEXT_MUTED }}
                    >
                      {cat.name}
                    </div>
                    <ul className="space-y-0.5">
                      {cat.channels.map((ch) => (
                        <li key={`${cat.name}-${ch.name}`}>
                          <div
                            className="flex cursor-default items-center gap-1.5 rounded px-1.5 py-1.5 text-sm"
                            style={{ color: "#8d9095" }}
                          >
                            {ch.voice ? (
                              <span className="fa-solid fa-volume-high w-4 shrink-0 text-center text-[11px]" aria-hidden />
                            ) : (
                              <span className="w-4 shrink-0 text-center text-[13px] font-semibold opacity-80">#</span>
                            )}
                            <span className="min-w-0 truncate" style={{ color: TEXT_MUTED }}>
                              {ch.name}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {snapshot ? <SnapshotRolesBlock snapshot={snapshot} /> : null}
      </div>
    </div>
  );
}
