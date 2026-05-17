import { useCallback, useEffect, useMemo, useState } from "react";
import { ConnectPrompt } from "../components/auth/ConnectPrompt.js";
import { ModalShell } from "../components/ui/ModalShell.js";
import { PanelPageHeader } from "../components/ui/PanelPageHeader.js";
import { PageAuthSkeleton } from "../components/ui/PageSkeleton.js";
import { useAuth } from "../contexts/AuthContext.js";
import { apiFetch } from "../lib/api.js";

type JourneyEvent = {
  id: string;
  type: string;
  source: string | null;
  path: string | null;
  visitorId: string | null;
  sessionId: string | null;
  discordUserId: string | null;
  discordGuildId: string | null;
  guildName: string | null;
  metadata: unknown;
  createdAt: string;
};

type Journey = {
  key: string;
  label: string;
  discordUsername: string | null;
  kind: "user" | "visitor";
  linkStatus: "confirmed" | "anonymous" | "shared_device";
  linkNote: string;
  linkedVisitorId: string | null;
  linkedVisitorIds: string[];
  convertedDiscordUserId: string | null;
  events: JourneyEvent[];
};

type AdminStats = {
  range: HistoryRange;
  totals: {
    usersTotal: number;
    guildsTotal: number;
    newUsersToday: number;
    installsToday: number;
    activeUsersToday: number;
  };
  dailySummary: Array<{
    day: string;
    logins: number;
    newUsers: number;
    installs: number;
  }>;
  journeys: Journey[];
};

type JourneyFilter = "all" | "connected" | "anonymous";
type HistoryRange = "today" | "7d" | "30d" | "90d" | "all";

type ReadableEvent = JourneyEvent & {
  title: string;
  detail: string;
  pageLabel: string;
  guildLabel: string | null;
  category: string | null;
  entity: string | null;
  action: string | null;
  name: string | null;
  target: string | null;
  hidden?: boolean;
  hiddenReason?: string;
};

type TimelineGroup = {
  key: string;
  pageLabel: string;
  guildLabel: string | null;
  startAt: string;
  endAt: string;
  events: ReadableEvent[];
};

function formatDate(value: string): string {
  return new Date(value).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function shortId(value: string | null | undefined): string {
  if (!value) return "—";
  return value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
}

function metadataObject(metadata: unknown): Record<string, unknown> {
  return metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>) : {};
}

function pageName(path: string | null, source?: string | null, eventType?: string | null): string {
  if (source === "landing" || eventType?.startsWith("landing_") || eventType === "panel_open_click" || eventType === "bot_invite_click") {
    return "Landing";
  }
  if (!path) return "Page inconnue";
  if (path.startsWith("/login") || path.startsWith("/api/auth/")) return "Connexion Discord";
  if (path === "/") return "Vue d’ensemble";
  if (path.startsWith("/?guild=")) return "Sélection serveur";
  if (path.startsWith("/select-server")) return "Sélection serveur";
  if (path.startsWith("/admin/stats")) return "Panel développeur";
  if (path.includes("/embeds")) return "Embeds";
  if (path.includes("/tickets")) return "Tickets";
  if (path.includes("/server-templates")) return "Templates";
  if (path.includes("/commands")) return "Commandes";
  if (path.includes("/modules")) return "Modules";
  if (path.includes("/account-settings")) return "Paramètres du compte";
  if (path.startsWith("/embeds")) return "Embeds";
  if (path.startsWith("/tickets")) return "Tickets";
  if (path.startsWith("/templates")) return "Templates";
  if (path.startsWith("/commands")) return "Commandes";
  if (path.startsWith("/modules")) return "Modules";
  if (path.startsWith("/logs")) return "Logs";
  if (path.startsWith("/marketplace")) return "Marketplace";
  if (path.startsWith("/account-settings")) return "Paramètres du compte";
  return path;
}

function guildIdFromPath(path: string | null): string | null {
  if (!path) return null;
  try {
    const url = new URL(path, "https://panel.vexbot.fr");
    const guild = url.searchParams.get("guild");
    if (guild) return guild;
  } catch {
    // Try API route parsing below.
  }
  const match = path.match(/\/api\/guilds\/(\d{5,25})(?:\/|$)/);
  return match?.[1] ?? null;
}

function eventGuildLabel(event: JourneyEvent): string | null {
  if (event.guildName) return event.guildName;
  const guildId = event.discordGuildId ?? guildIdFromPath(event.path);
  return guildId ? `serveur ${shortId(guildId)}` : null;
}

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.length > 80 ? `${text.slice(0, 80)}…` : text;
}

function detailWithGuild(pageLabel: string, guildLabel: string | null): string {
  return guildLabel ? `${pageLabel} · ${guildLabel}` : pageLabel;
}

function uniqueDetail(parts: Array<string | null | undefined>): string {
  const values: string[] = [];
  for (const part of parts) {
    if (!part) continue;
    if (values.includes(part)) continue;
    values.push(part);
  }
  return values.join(" · ");
}

function isDevPanelPage(pageLabel: string): boolean {
  return pageLabel === "Panel développeur";
}

function businessActionLabel(action: string | null): string {
  const labels: Record<string, string> = {
    create: "A créé",
    update: "A modifié",
    delete: "A supprimé",
    send: "A envoyé",
    apply: "A appliqué",
    configure: "A configuré",
    view: "A consulté",
    toggle: "A changé",
    close: "A fermé",
    install: "A installé",
    sync: "A synchronisé",
    download: "A téléchargé",
    preview: "A prévisualisé",
    captcha_issue: "A généré un captcha",
    captcha_check: "A vérifié un captcha",
  };
  return action ? labels[action] ?? `A fait ${action}` : "A fait une action";
}

function entityLabel(entity: string | null): string {
  const labels: Record<string, string> = {
    embed: "l’embed",
    ticket: "le ticket",
    template: "le template",
    command: "la commande",
    module: "le module",
    marketplace: "la publication marketplace",
    bot: "le bot",
    account: "le compte",
  };
  return entity ? labels[entity] ?? entity : "un élément";
}

function businessTitle(meta: Record<string, unknown>): string | null {
  if (meta.category !== "business") return null;
  const action = typeof meta.action === "string" ? meta.action : null;
  const entity = typeof meta.entity === "string" ? meta.entity : null;
  const name = cleanText(meta.name);

  if (entity === "ticket" && action === "configure") {
    return "Met à jour les réglages tickets";
  }
  if (entity === "ticket" && action === "view") {
    return "Consulte un ticket";
  }
  if (entity === "embed") {
    if (action === "create") return name ? `Crée l’embed “${name}”` : "Crée un embed";
    if (action === "update") return name ? `Modifie l’embed “${name}”` : "Modifie un embed";
    if (action === "delete") return name ? `Supprime l’embed “${name}”` : "Supprime un embed";
    if (action === "send") return name ? `Envoie l’embed “${name}”` : "Envoie un embed";
  }
  if (entity === "module") {
    return name ? `Met à jour le module “${name}”` : "Met à jour un module";
  }
  if (entity === "command") {
    if (action === "configure") return name ? `Configure la commande “${name}”` : "Configure une commande";
    if (action === "create") return name ? `Crée la commande “${name}”` : "Crée une commande";
    if (action === "update") return name ? `Modifie la commande “${name}”` : "Modifie une commande";
    if (action === "delete") return name ? `Supprime la commande “${name}”` : "Supprime une commande";
  }
  if (entity === "template") {
    if (action === "apply") return name ? `Applique le template “${name}”` : "Applique un template";
    if (action === "create") return name ? `Crée le template “${name}”` : "Crée un template";
    if (action === "update") return name ? `Modifie le template “${name}”` : "Modifie un template";
    if (action === "delete") return name ? `Supprime le template “${name}”` : "Supprime un template";
    if (action === "preview") return name ? `Prévisualise le template “${name}”` : "Prévisualise un template";
  }
  if (entity === "marketplace") {
    if (action === "create") return name ? `Publie “${name}” sur la marketplace` : "Publie sur la marketplace";
    if (action === "update") return name ? `Modifie la publication “${name}”` : "Modifie une publication marketplace";
    if (action === "delete") return name ? `Supprime la publication “${name}”` : "Supprime une publication marketplace";
    if (action === "download") return "Télécharge un élément marketplace";
    if (action === "toggle") return "Aime ou retire un like marketplace";
  }
  if (entity === "bot") {
    if (action === "update") return name ? `Met à jour “${name}”` : "Met à jour le bot";
    if (action === "delete") return name ? `Retire “${name}”` : "Retire le bot";
  }
  if (entity === "account") {
    if (action === "delete") return "Supprime les données du compte";
  }

  const prefix = businessActionLabel(action);
  const object = entityLabel(entity);
  return name ? `${prefix} ${object} “${name}”` : `${prefix} ${object}`;
}

function businessPageLabel(entity: string | null, eventType: string): string | null {
  if (entity === "embed" || eventType.startsWith("embed_")) return "Embeds";
  if (entity === "ticket" || eventType.startsWith("ticket_")) return "Tickets";
  if (entity === "template" || eventType.startsWith("server_template_")) return "Templates";
  if (entity === "command" || eventType.includes("command")) return "Commandes";
  if (entity === "module" || eventType.includes("welcome") || eventType.includes("verification") || eventType.includes("auto_role")) return "Modules";
  if (entity === "bot") return "Modules";
  if (entity === "marketplace" || eventType.includes("marketplace")) return "Marketplace";
  if (entity === "account") return "Paramètres du compte";
  return null;
}

function eventTimestamp(event: JourneyEvent): number {
  return new Date(event.createdAt).getTime();
}

function readableEventKey(event: ReadableEvent): string {
  if (event.title === "Enregistre les changements" || event.category === "business") {
    return [event.title, event.detail, event.pageLabel, event.guildLabel ?? ""].join("|");
  }
  return [event.type, event.title, event.detail, event.pageLabel, event.guildLabel ?? "", event.path ?? ""].join("|");
}

function shouldMergeReadableEvents(previous: ReadableEvent, event: ReadableEvent): boolean {
  const diff = eventTimestamp(event) - eventTimestamp(previous);
  if (diff < 0) return false;
  if (readableEventKey(previous) !== readableEventKey(event)) return false;
  if (previous.category === "business" && event.category === "business") return diff <= 90_000;
  if (previous.title === "Enregistre les changements") return diff <= 20_000;
  return diff <= 3_000;
}

function compactEvents(events: ReadableEvent[]): ReadableEvent[] {
  const chronological = [...events].sort((a, b) => eventTimestamp(a) - eventTimestamp(b));
  const compacted: ReadableEvent[] = [];

  for (const event of chronological) {
    const previous = compacted[compacted.length - 1];
    if (previous && shouldMergeReadableEvents(previous, event)) {
      compacted[compacted.length - 1] = event;
      continue;
    }
    compacted.push(event);
  }

  return compacted.sort((a, b) => eventTimestamp(b) - eventTimestamp(a));
}

function removeClickDuplicatedByBusiness(events: ReadableEvent[]): ReadableEvent[] {
  return events.filter((event) => {
    if (!["panel_click", "panel_field_changed", "panel_changes_saved", "api_mutation_success", "panel_unsaved_changes_left", "panel_session_exit"].includes(event.type)) return true;
    return !events.some((candidate) => {
      if (candidate.category !== "business") return false;
      if (candidate.pageLabel !== event.pageLabel) return false;
      const sameGuild = !candidate.guildLabel || !event.guildLabel || candidate.guildLabel === event.guildLabel;
      if (!sameGuild) return false;
      const diff = Math.abs(eventTimestamp(candidate) - eventTimestamp(event));
      return diff <= 20_000;
    });
  });
}

function isDiscardedEvent(event: JourneyEvent): boolean {
  if (event.type === "landing_session_return" || event.type === "landing_session_exit") return true;
  if (event.type === "panel_session_return" || event.type === "panel_session_exit") return true;
  if (event.type !== "panel_click") return false;
  const meta = metadataObject(event.metadata);
  const path = event.path ?? cleanText(meta.path);
  const pageLabel = pageName(path, event.source, event.type);
  const text = cleanText(meta.text);
  if (pageLabel === "Sélection serveur" && text) return false;
  return true;
}

function isNoiseEvent(event: JourneyEvent): boolean {
  return Boolean(noiseReason(event));
}

function noiseReason(event: JourneyEvent): string | null {
  const meta = metadataObject(event.metadata);
  const text = cleanText(meta.text);
  const href = cleanText(meta.href);
  const title = cleanText(meta.title) ?? cleanText(meta.ariaLabel);
  const path = event.path ?? cleanText(meta.path);
  if (path?.startsWith("/admin/stats") && ["panel_click", "panel_page_view", "panel_session_exit", "panel_session_return"].includes(event.type)) {
    return "Action interne du Panel développeur.";
  }
  if (event.type === "landing_session_return" || event.type === "landing_session_exit") return "Retour/quitte landing trop automatique.";
  if (event.type === "panel_session_return") return "Retour panel automatique.";
  if (event.type === "panel_session_exit" && meta.dirty !== true) return "Quitte le panel sans modification.";
  if (event.type === "panel_click" && text && ["Tous", "Connectés", "Visiteurs"].includes(text)) return "Clic de filtre du Panel développeur.";
  if (event.type === "panel_click" && path?.startsWith("/select-server") && !text) return "Ouverture automatique de la sélection serveur.";
  if (event.type === "panel_click" && !text && !href && !title) return "Clic sans bouton ou cible claire.";
  return null;
}

function describeEvent(event: JourneyEvent): ReadableEvent | null {
  if (isDiscardedEvent(event)) return null;
  if (isNoiseEvent(event)) return null;
  const meta = metadataObject(event.metadata);
  const text = cleanText(meta.text);
  const path = event.path ?? cleanText(meta.path);
  const category = typeof meta.category === "string" ? meta.category : null;
  const entity = typeof meta.entity === "string" ? meta.entity : null;
  const inferredBusinessPage = businessPageLabel(entity, event.type);
  const pageLabel = path ? pageName(path, event.source, event.type) : (inferredBusinessPage ?? pageName(path, event.source, event.type));
  const guildLabel = eventGuildLabel(event);
  const action = typeof meta.action === "string" ? meta.action : null;
  const name = cleanText(meta.name);
  const target = cleanText(meta.target);
  const base = { ...event, pageLabel, guildLabel, category, entity, action, name, target };

  const business = businessTitle(meta);
  if (business) {
    const businessTarget = entity === "marketplace" ? null : target;
    return { ...base, title: business, detail: uniqueDetail([pageLabel, businessTarget, guildLabel]) || detailWithGuild(pageLabel, guildLabel) };
  }

  if (event.type === "panel_page_view") {
    if (path?.startsWith("/?guild=")) {
      return { ...base, title: guildLabel ? `Choisit le serveur “${guildLabel}”` : "Choisit un serveur", detail: "Le panel charge le serveur sélectionné" };
    }
    if (pageLabel === "Sélection serveur") {
      return { ...base, title: "Arrive sur la sélection serveur", detail: "Le panel attend le choix d’un serveur" };
    }
    return { ...base, title: `Ouvre ${pageLabel}`, detail: detailWithGuild(pageLabel, guildLabel) };
  }
  if (event.type === "panel_click") {
    if (pageLabel === "Sélection serveur" && text) {
      return { ...base, title: `Sélectionne le serveur “${text}”`, detail: "Choix du serveur pour continuer" };
    }
    return null;
  }
  if (event.type === "panel_field_changed") {
    return null;
  }
  if (event.type === "panel_changes_saved" || event.type === "api_mutation_success") {
    return null;
  }
  if (event.type === "api_mutation_error") {
    return { ...base, title: "Erreur pendant l’enregistrement", detail: `Statut ${String(meta.status ?? "inconnu")}${guildLabel ? ` · ${guildLabel}` : ""}` };
  }
  if (event.type === "panel_unsaved_changes_left" || event.type === "panel_session_exit") {
    return { ...base, title: "Quitte avec des changements non sauvegardés", detail: cleanText(meta.dirtyPath) || pageLabel };
  }
  if (event.type === "panel_login") {
    return { ...base, title: "Se connecte avec Discord", detail: "Connexion confirmée" };
  }
  if (event.type === "discord_login_started") {
    return { ...base, title: "Lance la connexion Discord", detail: "Redirection Discord" };
  }
  if (event.type === "bot_invite_click") {
    return { ...base, title: "Clique pour inviter le bot", detail: guildLabel ?? "Invitation Discord" };
  }
  if (event.type === "bot_installed") {
    return { ...base, title: "Bot installé sur un serveur", detail: guildLabel ?? "Serveur inconnu" };
  }
  if (event.type === "panel_open_click") {
    return { ...base, title: "Clique sur “Ouvrir le panel”", detail: "Landing" };
  }
  if (event.type === "landing_visit") {
    return { ...base, title: "Visite le site public", detail: "Landing" };
  }
  if (event.type === "embed_created") return { ...base, title: "Crée un embed", detail: guildLabel ?? pageLabel };
  if (event.type === "ticket_settings_updated") return { ...base, title: "Configure les tickets", detail: guildLabel ?? pageLabel };
  if (event.type === "custom_command_created") return { ...base, title: "Crée une commande", detail: guildLabel ?? pageLabel };
  if (event.type === "server_template_created") return { ...base, title: "Crée un template serveur", detail: guildLabel ?? pageLabel };

  return { ...base, title: event.type, detail: path || event.source || "Action enregistrée" };
}

function readableEvents(journey: Journey): ReadableEvent[] {
  return compactEvents(removeClickDuplicatedByBusiness(journey.events.map(describeEvent).filter((event): event is ReadableEvent => Boolean(event))));
}

function allTimelineEvents(journey: Journey): ReadableEvent[] {
  return journey.events
    .filter((event) => !isDiscardedEvent(event))
    .map((event) => {
      const visible = describeEvent(event);
      if (visible) return visible;
      const meta = metadataObject(event.metadata);
      const path = event.path ?? cleanText(meta.path);
      const pageLabel = pageName(path, event.source, event.type);
      const guildLabel = eventGuildLabel(event);
      return {
        ...event,
        title: event.type,
        detail: path || event.source || "Action technique",
        pageLabel,
        guildLabel,
        category: null,
        entity: null,
        action: null,
        name: null,
        target: null,
        hidden: true,
        hiddenReason: noiseReason(event) ?? "Masqué par la vue claire.",
      };
    })
    .sort((a, b) => eventTimestamp(b) - eventTimestamp(a));
}

function bestGuildLabel(events: ReadableEvent[]): string | null {
  return events.find((event) => event.guildLabel)?.guildLabel ?? null;
}

function timelineGroups(events: ReadableEvent[]): TimelineGroup[] {
  const chronological = [...events].sort((a, b) => eventTimestamp(a) - eventTimestamp(b));
  const groups: TimelineGroup[] = [];

  for (const event of chronological) {
    const storyPageLabel = event.pageLabel;
    if (!event.hidden && isDevPanelPage(storyPageLabel)) continue;
    const key = `${storyPageLabel}|${event.guildLabel ?? ""}`;
    const previous = groups[groups.length - 1];
    const sameGuild = !previous?.guildLabel || !event.guildLabel || previous.guildLabel === event.guildLabel;
    if (previous && previous.key.startsWith(`${storyPageLabel}|`) && sameGuild) {
      previous.events.push(event);
      previous.endAt = event.createdAt;
      previous.guildLabel = previous.guildLabel ?? event.guildLabel;
      continue;
    }
    groups.push({
      key: `${key}|${event.id}`,
      pageLabel: storyPageLabel,
      guildLabel: event.guildLabel,
      startAt: event.createdAt,
      endAt: event.createdAt,
      events: [event],
    });
  }

  return groups
    .map((group) => {
      const guildLabel = group.guildLabel ?? bestGuildLabel(group.events);
      return {
        ...group,
        guildLabel,
        events: [...group.events].sort((a, b) => eventTimestamp(b) - eventTimestamp(a)),
      };
    })
    .sort((a, b) => eventTimestamp({ createdAt: b.endAt } as JourneyEvent) - eventTimestamp({ createdAt: a.endAt } as JourneyEvent));
}

function journeyDuration(events: JourneyEvent[]): string {
  if (events.length < 2) return "1 action";
  const times = events.map(eventTimestamp);
  const first = Math.min(...times);
  const last = Math.max(...times);
  const minutes = Math.max(1, Math.round((last - first) / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

function detailRows(event: ReadableEvent): Array<{ label: string; value: string }> {
  const meta = metadataObject(event.metadata);
  const device = deviceDetails(event);
  const rows: Array<{ label: string; value: string }> = [
    { label: "Heure exacte", value: new Date(event.createdAt).toLocaleString("fr-FR") },
    { label: "Page", value: event.pageLabel },
  ];
  if (event.guildLabel) rows.push({ label: "Serveur", value: event.guildLabel });
  const success = meta.success;
  const entity = cleanText(meta.entity);
  const action = cleanText(meta.action);
  const name = cleanText(meta.name);
  const target = cleanText(meta.target);

  if (entity) rows.push({ label: "Objet", value: entityLabel(entity) });
  if (action) rows.push({ label: "Action métier", value: businessActionLabel(action) });
  if (name) rows.push({ label: "Nom", value: name });
  if (target) rows.push({ label: entity === "marketplace" ? "Type" : "Cible", value: target });
  if (typeof success === "boolean") rows.push({ label: "Résultat", value: success ? "Succès" : "Échec" });
  if (typeof meta.checked === "boolean") rows.push({ label: "Nouvel état", value: meta.checked ? "Activé" : "Désactivé" });
  rows.push({ label: "Navigateur", value: device.browser });
  rows.push({ label: "Appareil", value: device.device });

  return rows;
}

function shortValue(value: unknown): string {
  if (value === null) return "Vide";
  if (value === undefined) return "Non renseigné";
  if (typeof value === "boolean") return value ? "Activé" : "Désactivé";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return cleanText(value) ?? "Vide";
  if (Array.isArray(value)) return `${value.length} élément(s)`;
  if (typeof value === "object") return "Modifié";
  return String(value);
}

function readableChangeValue(key: string, value: unknown): string {
  if (value === null) return "Non configuré";
  if (value === undefined) return "Non renseigné";
  if (typeof value !== "string") return shortValue(value);
  const text = cleanText(value);
  if (!text) return "Vide";
  if (key.toLowerCase().includes("channelid")) return `Salon Discord ${shortId(text)}`;
  if (key.toLowerCase().includes("categoryid")) return `Catégorie Discord ${shortId(text)}`;
  if (key.toLowerCase().includes("embedid")) return `Modèle embed ${shortId(text)}`;
  if (key.toLowerCase().endsWith("id")) return shortId(text);
  return text;
}

function humanFieldLabel(key: string): string {
  const labels: Record<string, string> = {
    name: "Nom",
    description: "Description",
    enabled: "Activation",
    panelChannelId: "Salon du panneau",
    panelEmbedId: "Message du panneau",
    ticketCategoryId: "Catégorie des tickets",
    welcomeEmbedId: "Message d’accueil ticket",
    maxOpenTicketsPerOpener: "Tickets ouverts maximum",
    panelOpenConfig: "Bouton d’ouverture",
    categoryId: "Catégorie",
    logChannelId: "Salon de logs",
    transcriptChannelId: "Salon transcripts",
    welcomeChannelId: "Salon d’arrivée",
    goodbyeChannelId: "Salon de départ",
    channelId: "Salon",
    roleId: "Rôle",
    allowedRoleCount: "Rôles autorisés",
    allowedChannelCount: "Salons autorisés",
    rolesCount: "Nombre de rôles",
    channelsCount: "Nombre de salons",
    categoriesCount: "Nombre de catégories",
    responseType: "Type de réponse",
    ephemeral: "Réponse privée",
  };
  return labels[key] ?? key;
}

function changeRows(event: ReadableEvent): Array<{ label: string; before: string; after: string }> {
  const meta = metadataObject(event.metadata);
  const before = metadataObject(meta.before);
  const after = metadataObject(meta.after);
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
  const hasBefore = Object.keys(before).length > 0;
  const hasAfter = Object.keys(after).length > 0;

  return keys
    .filter((key) => {
      if (hasBefore && !hasAfter) return before[key] !== undefined;
      return after[key] !== undefined && (!hasBefore || JSON.stringify(before[key]) !== JSON.stringify(after[key]));
    })
    .slice(0, 8)
    .map((key) => ({
      label: humanFieldLabel(key),
      before: hasBefore ? readableChangeValue(key, before[key]) : "Non configuré",
      after: hasAfter ? readableChangeValue(key, after[key]) : "Supprimé",
    }));
}

function browserFromUserAgent(userAgent: string): string {
  if (/Cursor/i.test(userAgent)) return "Cursor";
  if (/OPT\//i.test(userAgent)) return "Opera Mobile";
  if (/Edg\//i.test(userAgent)) return "Edge";
  if (/OPR\//i.test(userAgent) || /Opera/i.test(userAgent)) return /Mobile|Android|iPhone/i.test(userAgent) ? "Opera Mobile" : "Opera";
  if (/Firefox\//i.test(userAgent)) return "Firefox";
  if (/CriOS\//i.test(userAgent) || /Chrome\//i.test(userAgent)) return "Chrome";
  if (/Safari\//i.test(userAgent)) return "Safari";
  if (/Discord/i.test(userAgent)) return "Discord WebView";
  return "Autre";
}

function deviceFromUserAgent(userAgent: string): string {
  if (/iPad|Tablet|Android(?!.*Mobile)/i.test(userAgent)) return "Tablette";
  if (/Mobile|iPhone|Android|Windows Phone/i.test(userAgent)) return "Téléphone";
  return "PC";
}

function osFromUserAgent(userAgent: string): string {
  if (/Android/i.test(userAgent)) return "Android";
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "iOS";
  if (/Windows/i.test(userAgent)) return "Windows";
  if (/Mac OS X|Macintosh/i.test(userAgent)) return "macOS";
  if (/Linux/i.test(userAgent)) return "Linux";
  return "Autre";
}

function deviceDetails(event: JourneyEvent): { browser: string; os: string; device: string; ip: string } {
  const network = metadataObject(metadataObject(event.metadata).network);
  const userAgent = typeof network.userAgent === "string" ? network.userAgent.trim() : "";
  const ipFull = cleanText(network.ipFull);
  const ipMasked = cleanText(network.ipMasked);
  return {
    browser: userAgent ? browserFromUserAgent(userAgent) : "Non détecté",
    os: userAgent ? osFromUserAgent(userAgent) : "Non détecté",
    device: userAgent ? deviceFromUserAgent(userAgent) : "Non détecté",
    ip: ipFull ?? ipMasked ?? "Non disponible",
  };
}

function uniqueTrackingIds(journey: Journey, key: "visitorId" | "sessionId"): string[] {
  return Array.from(new Set(journey.events.map((event) => event[key]).filter((value): value is string => Boolean(value))));
}

function journeyDeviceSummary(journey: Journey): { browsers: string[]; devices: string[]; oses: string[] } {
  const browsers = new Set<string>();
  const devices = new Set<string>();
  const oses = new Set<string>();

  for (const event of journey.events) {
    const network = metadataObject(metadataObject(event.metadata).network);
    const userAgent = typeof network.userAgent === "string" ? network.userAgent.trim() : "";
    if (!userAgent) continue;
    browsers.add(browserFromUserAgent(userAgent));
    devices.add(deviceFromUserAgent(userAgent));
    oses.add(osFromUserAgent(userAgent));
  }

  return {
    browsers: Array.from(browsers),
    devices: Array.from(devices),
    oses: Array.from(oses),
  };
}

function journeyNetworkSummary(journey: Journey): { country: string; ip: string | null } {
  for (const event of [...journey.events].sort((a, b) => eventTimestamp(b) - eventTimestamp(a))) {
    const network = metadataObject(metadataObject(event.metadata).network);
    const country = cleanText(network.country);
    const ipFull = cleanText(network.ipFull);
    const ipMasked = cleanText(network.ipMasked);
    if (country || ipFull || ipMasked) {
      return { country: country ?? "Pays inconnu", ip: ipFull ?? ipMasked };
    }
  }
  return { country: "Pays inconnu", ip: null };
}

function journeyStatus(journey: Journey): string {
  if (journey.linkStatus === "confirmed") return "Connecté";
  if (journey.linkStatus === "shared_device") return "Navigateur partagé";
  return "Visiteur";
}

function connectionStatusLabel(journey: Journey): string {
  if (journey.linkStatus === "confirmed") return "Connectée via Discord";
  if (journey.linkStatus === "shared_device") return "Navigateur partagé";
  return "Non connectée";
}

function connectionStatusClass(journey: Journey): string {
  if (journey.linkStatus === "confirmed") return "border-emerald-400/40 bg-emerald-500/10 text-emerald-100";
  if (journey.linkStatus === "shared_device") return "border-amber-400/40 bg-amber-500/10 text-amber-100";
  return "border-zinc-500/50 bg-zinc-500/10 text-zinc-200";
}

function pageIconClass(pageLabel: string): string {
  const icons: Record<string, string> = {
    "Vue d’ensemble": "fa-chart-line",
    Embeds: "fa-layer-group",
    Tickets: "fa-ticket",
    Templates: "fa-server",
    Commandes: "fa-terminal",
    Modules: "fa-puzzle-piece",
    Logs: "fa-scroll",
    Marketplace: "fa-store",
    "Paramètres du compte": "fa-user-gear",
    Landing: "fa-globe",
    "Sélection serveur": "fa-server",
    "Panel développeur": "fa-code",
  };
  return icons[pageLabel] ?? "fa-circle-dot";
}

function summaryPillClass(value: string): string {
  const key = value.toLowerCase();
  if (key.includes("opera")) return "border-red-400/40 bg-red-500/10 text-red-100";
  if (key.includes("cursor")) return "border-violet-400/40 bg-violet-500/10 text-violet-100";
  if (key.includes("chrome")) return "border-blue-400/40 bg-blue-500/10 text-blue-100";
  if (key.includes("safari")) return "border-cyan-400/40 bg-cyan-500/10 text-cyan-100";
  if (key.includes("firefox")) return "border-orange-400/40 bg-orange-500/10 text-orange-100";
  if (key.includes("edge")) return "border-sky-400/40 bg-sky-500/10 text-sky-100";
  if (key.includes("téléphone")) return "border-emerald-400/40 bg-emerald-500/10 text-emerald-100";
  if (key.includes("tablette")) return "border-fuchsia-400/40 bg-fuchsia-500/10 text-fuchsia-100";
  if (key === "pc") return "border-zinc-400/40 bg-zinc-500/10 text-zinc-100";
  if (key.includes("android")) return "border-lime-400/40 bg-lime-500/10 text-lime-100";
  if (key.includes("ios")) return "border-slate-300/40 bg-slate-400/10 text-slate-100";
  if (key.includes("windows")) return "border-blue-300/40 bg-blue-400/10 text-blue-100";
  if (key.includes("macos")) return "border-neutral-300/40 bg-neutral-400/10 text-neutral-100";
  if (key.includes("linux")) return "border-yellow-300/40 bg-yellow-400/10 text-yellow-100";
  return "border-vex-border bg-white/5 text-zinc-200";
}

function SummaryPills({ values }: { values: string[] }) {
  if (!values.length) return <span className="text-zinc-200">Non détecté</span>;
  return (
    <span className="flex flex-wrap gap-1.5">
      {values.map((value) => (
        <span key={value} className={`rounded-full border px-2 py-0.5 text-[11px] ${summaryPillClass(value)}`}>
          {value}
        </span>
      ))}
    </span>
  );
}

function SummaryIdList({ values }: { values: string[] }) {
  if (!values.length) return <span className="text-zinc-200">Aucun</span>;
  return (
    <span className="mt-1 flex flex-col gap-1">
      {values.map((value) => (
        <code key={value} className="break-all rounded-lg border border-vex-border bg-black/20 px-2 py-1 text-[11px] text-zinc-200">
          {value}
        </code>
      ))}
    </span>
  );
}

function StatCard({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <article className="rounded-2xl border border-vex-border/70 bg-vex-bg/40 p-5">
      <p className="text-sm text-zinc-400">{label}</p>
      <strong className="mt-2 block text-3xl text-zinc-50">{value.toLocaleString("fr-FR")}</strong>
      <p className="mt-2 text-xs text-zinc-500">{hint}</p>
    </article>
  );
}

function ActivityChart({ days }: { days: AdminStats["dailySummary"] }) {
  const max = Math.max(1, ...days.flatMap((day) => [day.logins, day.newUsers, day.installs]));
  return (
    <div className="ui-card-muted p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-50">Activité utile sur 7 jours</h2>
          <p className="mt-1 text-sm text-zinc-400">Connexions, nouveaux utilisateurs et installations bot.</p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-7 gap-3">
        {days.map((day) => (
          <div key={day.day} className="flex min-h-44 flex-col justify-end gap-1 rounded-xl border border-vex-border/60 bg-vex-bg/40 p-2">
            <div className="rounded bg-indigo-400/80" style={{ height: `${Math.max(4, (day.logins / max) * 110)}px` }} title={`${day.logins} connexion(s)`} />
            <div className="rounded bg-emerald-400/80" style={{ height: `${Math.max(4, (day.newUsers / max) * 110)}px` }} title={`${day.newUsers} nouveau(x)`} />
            <div className="rounded bg-amber-300/80" style={{ height: `${Math.max(4, (day.installs / max) * 110)}px` }} title={`${day.installs} installation(s)`} />
            <span className="mt-2 text-center text-[11px] text-zinc-500">{day.day.slice(5)}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-3 text-xs text-zinc-400">
        <span><span className="mr-1 inline-block h-2 w-2 rounded bg-indigo-400" />Connexions</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded bg-emerald-400" />Nouveaux</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded bg-amber-300" />Installations</span>
      </div>
    </div>
  );
}

export function AdminStatsPage() {
  const { status, user } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [journeyFilter, setJourneyFilter] = useState<JourneyFilter>("all");
  const [historyRange, setHistoryRange] = useState<HistoryRange>("30d");
  const [selectedJourney, setSelectedJourney] = useState<Journey | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<ReadableEvent | null>(null);
  const [showAllTimeline, setShowAllTimeline] = useState(false);
  const [expandedTimelineGroups, setExpandedTimelineGroups] = useState<Set<string>>(() => new Set());

  const loadStats = useCallback(async () => {
    if (!user?.isAdmin) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/admin/stats?range=${historyRange}`);
      if (!res.ok) throw new Error(res.status === 403 ? "Accès admin refusé." : "Chargement impossible.");
      setStats((await res.json()) as AdminStats);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue.");
    } finally {
      setLoading(false);
    }
  }, [historyRange, user?.isAdmin]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const filteredJourneys = useMemo(() => {
    if (!stats) return [];
    return stats.journeys.filter((journey) => {
      if (journeyFilter === "connected") return journey.kind === "user";
      if (journeyFilter === "anonymous") return journey.kind === "visitor";
      return true;
    });
  }, [journeyFilter, stats]);

  const selectedTimelineGroups = useMemo(() => {
    if (!selectedJourney) return [];
    return timelineGroups(showAllTimeline ? allTimelineEvents(selectedJourney) : readableEvents(selectedJourney));
  }, [selectedJourney, showAllTimeline]);

  async function resetTrackingData() {
    const ok = window.confirm("Supprimer les données de suivi ? Les serveurs et réglages ne seront pas supprimés.");
    if (!ok) return;
    setResetting(true);
    setError(null);
    try {
      const res = await apiFetch("/api/admin/tracking-data", { method: "DELETE" });
      if (!res.ok) throw new Error("Reset impossible.");
      setSelectedJourney(null);
      setSelectedEvent(null);
      setShowAllTimeline(false);
      await loadStats();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue.");
    } finally {
      setResetting(false);
    }
  }

  if (status === "loading") {
    return <PageAuthSkeleton title="Panel développeur" description="Suivi clair des utilisateurs." />;
  }

  if (!user) {
    return <ConnectPrompt pageTitle="Panel développeur" />;
  }

  if (!user.isAdmin) {
    return (
      <div className="flex flex-col gap-6">
        <PanelPageHeader title="Panel développeur" description="Réservée aux développeurs." />
        <div className="ui-card-muted px-6 py-10 text-center text-sm text-amber-100">
          Votre compte Discord n’est pas autorisé à voir ces statistiques.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <PanelPageHeader
          title="Panel développeur"
          description="Choisis une personne et suis son parcours sans bruit technique."
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void loadStats()}
            disabled={loading}
            className="rounded-xl border border-vex-border px-4 py-2 text-sm text-zinc-200 transition hover:border-indigo-400/60 disabled:opacity-60"
          >
            {loading ? "Actualisation…" : "Actualiser"}
          </button>
          <div className="flex flex-wrap gap-1 rounded-xl border border-vex-border p-1">
            {[
              ["today", "Aujourd’hui"],
              ["7d", "7 j"],
              ["30d", "30 j"],
              ["90d", "90 j"],
              ["all", "Tout"],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setHistoryRange(id as HistoryRange);
                  setSelectedJourney(null);
                  setSelectedEvent(null);
                  setExpandedTimelineGroups(new Set());
                }}
                className={`rounded-lg px-3 py-1.5 text-xs transition ${
                  historyRange === id
                    ? "bg-indigo-500/20 text-indigo-100"
                    : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void resetTrackingData()}
            disabled={resetting}
            className="rounded-xl border border-red-400/50 bg-red-500/10 px-4 py-2 text-sm text-red-100 transition hover:bg-red-500/20 disabled:opacity-60"
          >
            {resetting ? "Reset…" : "Reset données"}
          </button>
        </div>
      </div>

      {error ? <div className="ui-card-muted p-4 text-sm text-red-200">{error}</div> : null}
      {!stats && !error ? <div className="ui-card-muted p-5 text-sm text-zinc-400">Chargement des statistiques…</div> : null}

      {stats ? (
        <>
          <section className="grid gap-4 md:grid-cols-4">
            <StatCard label="Utilisateurs actifs aujourd’hui" value={stats.totals.activeUsersToday} hint="Comptes ayant fait une action dans le panel." />
            <StatCard label="Nouveaux utilisateurs" value={stats.totals.newUsersToday} hint="Première connexion Discord aujourd’hui." />
            <StatCard label="Serveurs suivis" value={stats.totals.guildsTotal} hint="Serveurs connus en base." />
            <StatCard label="Installations bot" value={stats.totals.installsToday} hint="Installations détectées aujourd’hui." />
          </section>

          <ActivityChart days={stats.dailySummary} />

          <section className="ui-card-muted p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-zinc-50">Utilisateurs suivis</h2>
                <p className="mt-1 text-sm text-zinc-400">Clique sur une carte pour lire le parcours proprement.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  ["all", "Tous"],
                  ["connected", "Connectés"],
                  ["anonymous", "Visiteurs"],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setJourneyFilter(id as JourneyFilter)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      journeyFilter === id
                        ? "border-indigo-400/70 bg-indigo-500/15 text-indigo-100"
                        : "border-vex-border text-zinc-400 hover:border-indigo-400/50 hover:text-zinc-100"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {filteredJourneys.length ? (
                filteredJourneys.map((journey) => {
                  const events = readableEvents(journey);
                  const latest = events[0];
                  const network = journeyNetworkSummary(journey);
                  return (
                    <button
                      key={journey.key}
                      type="button"
                      onClick={() => {
                        const cardEvents = readableEvents(journey);
                        setSelectedJourney(journey);
                        setSelectedEvent(cardEvents[0] ?? null);
                        setShowAllTimeline(false);
                        setExpandedTimelineGroups(new Set());
                      }}
                      className="group rounded-2xl border border-vex-border/70 bg-vex-bg/40 p-4 text-left transition hover:border-indigo-400/60 hover:bg-vex-bg/70"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <strong className="truncate text-base text-zinc-100">{journey.label}</strong>
                            <span className="rounded-full border border-vex-border px-2 py-0.5 text-[11px] text-zinc-300">
                              {journeyStatus(journey)}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-zinc-500">
                            {events.length} action(s) utile(s) · {journeyDuration(events.length ? events : journey.events)}
                          </p>
                          <p className="mt-1 text-xs text-zinc-500">
                            {network.country} {network.ip ? `· ${network.ip}` : ""}
                          </p>
                        </div>
                        <span className="fa-solid fa-arrow-up-right-from-square text-xs text-zinc-600 transition group-hover:text-indigo-300" aria-hidden />
                      </div>

                      <div className="mt-3 rounded-xl border border-vex-border/60 bg-black/10 p-3">
                        <p className="text-sm text-zinc-200">
                          Dernière action : {latest ? latest.title : "Aucune action utile visible"}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {latest ? `${formatDate(latest.createdAt)} · ${latest.detail}` : journey.linkNote}
                        </p>
                        {latest?.guildLabel ? (
                          <p className="mt-2 inline-flex rounded-full bg-white/5 px-2 py-1 text-[11px] text-zinc-300">
                            {latest.guildLabel}
                          </p>
                        ) : null}
                      </div>
                    </button>
                  );
                })
              ) : (
                <p className="rounded-xl border border-vex-border/70 bg-vex-bg/40 p-4 text-sm text-zinc-500">
                  Aucun utilisateur ne correspond à ce filtre.
                </p>
              )}
            </div>
          </section>
        </>
      ) : null}

      <ModalShell
        open={Boolean(selectedJourney)}
        onClose={() => {
          setSelectedJourney(null);
          setSelectedEvent(null);
          setShowAllTimeline(false);
          setExpandedTimelineGroups(new Set());
        }}
        title={selectedJourney ? `Parcours · ${selectedJourney.label}` : "Parcours"}
        size="large"
      >
        {selectedJourney ? (
          <div className="grid gap-5 xl:grid-cols-[16rem_1fr_20rem]">
            <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
              <div className="rounded-2xl border border-vex-border bg-vex-bg/40 p-4">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Personne suivie</p>
                <strong className="mt-1 block text-lg text-zinc-50">{selectedJourney.label}</strong>
                {selectedJourney.discordUsername ? (
                  <p className="mt-1 text-sm text-indigo-100">@{selectedJourney.discordUsername}</p>
                ) : null}
                <span className={`mt-3 inline-flex rounded-full border px-2.5 py-1 text-xs ${connectionStatusClass(selectedJourney)}`}>
                  {connectionStatusLabel(selectedJourney)}
                </span>
              </div>

              <div className="rounded-2xl border border-vex-border bg-vex-bg/40 p-4 text-sm">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Résumé</p>
                <dl className="mt-3 space-y-2">
                  <div className="flex justify-between gap-3">
                    <dt className="text-zinc-500">Statut</dt>
                    <dd className="text-zinc-200">{journeyStatus(selectedJourney)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-zinc-500">Actions utiles</dt>
                    <dd className="text-zinc-200">{readableEvents(selectedJourney).length}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-zinc-500">Durée</dt>
                    <dd className="text-zinc-200">{journeyDuration(selectedJourney.events)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-zinc-500">Pays</dt>
                    <dd className="text-zinc-200">{journeyNetworkSummary(selectedJourney).country}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">IP</dt>
                    <dd className="break-all text-zinc-200">{journeyNetworkSummary(selectedJourney).ip ?? "Non disponible"}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">visitorId utilisés</dt>
                    <dd>
                      <SummaryIdList values={uniqueTrackingIds(selectedJourney, "visitorId")} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">sessionId utilisés</dt>
                    <dd>
                      <SummaryIdList values={uniqueTrackingIds(selectedJourney, "sessionId")} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">Navigateurs</dt>
                    <dd className="mt-1">
                      <SummaryPills values={journeyDeviceSummary(selectedJourney).browsers} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">Appareils</dt>
                    <dd className="mt-1">
                      <SummaryPills values={journeyDeviceSummary(selectedJourney).devices} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">OS utilisés</dt>
                    <dd className="mt-1">
                      <SummaryPills values={journeyDeviceSummary(selectedJourney).oses} />
                    </dd>
                  </div>
                </dl>
              </div>
            </aside>

            <section className="rounded-2xl border border-vex-border bg-vex-bg/30 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-zinc-50">Timeline complète</h3>
                  <p className="mt-1 text-sm text-zinc-400">Actions les plus récentes en haut. Clique pour voir le détail.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowAllTimeline((value) => !value);
                    setExpandedTimelineGroups(new Set());
                  }}
                  className="rounded-xl border border-vex-border px-3 py-2 text-xs text-zinc-300 transition hover:border-indigo-400/50"
                >
                  {showAllTimeline ? "Vue claire" : "Tout afficher"}
                </button>
              </div>

              <div className="mt-5 space-y-3">
                {selectedTimelineGroups.map((group) => {
                  const expanded = expandedTimelineGroups.has(group.key);
                  return (
                  <div key={group.key} className="rounded-2xl border border-vex-border/70 bg-black/10 p-3">
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedTimelineGroups((previous) => {
                          const next = new Set(previous);
                          if (next.has(group.key)) next.delete(group.key);
                          else next.add(group.key);
                          return next;
                        });
                      }}
                      className="flex w-full flex-col gap-1 text-left sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <strong className="flex items-center gap-2 text-base text-zinc-100">
                          <span className={`fa-solid ${pageIconClass(group.pageLabel)} text-indigo-300`} aria-hidden />
                          <span>{group.pageLabel}</span>
                        </strong>
                        {group.guildLabel ? (
                          <span className="mt-2 inline-flex rounded-full border border-vex-border bg-white/5 px-2 py-1 text-[11px] text-zinc-200">
                            {group.guildLabel}
                          </span>
                        ) : null}
                        <p className="text-xs text-zinc-500">
                          {formatTime(group.startAt)} → {formatTime(group.endAt)} · {group.events.length} étape(s)
                        </p>
                      </div>
                      <span className={`fa-solid fa-chevron-down text-xs text-zinc-500 transition ${expanded ? "rotate-180" : ""}`} aria-hidden />
                    </button>
                    {expanded ? (
                    <div className="mt-3 space-y-2">
                      {group.events.map((event, index) => (
                        <div key={event.id} className="grid grid-cols-[4.5rem_1fr] gap-3">
                          <div className="pt-3 text-right text-xs text-zinc-500">{formatTime(event.createdAt)}</div>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedEvent(event);
                            }}
                            className={`rounded-xl border p-3 text-left transition ${
                              selectedEvent?.id === event.id
                                ? "border-indigo-400/70 bg-indigo-500/10"
                                : event.hidden
                                  ? "border-zinc-700/70 bg-black/5 opacity-60 hover:border-zinc-500"
                                  : "border-vex-border/70 bg-vex-bg/40 hover:border-indigo-400/50"
                            }`}
                          >
                            <strong className="text-sm text-zinc-100">
                              {group.events.length - index}. {event.title}
                            </strong>
                            <p className="mt-1 text-xs text-zinc-500">{event.detail}</p>
                            {event.hiddenReason ? (
                              <p className="mt-2 text-[11px] text-amber-200/80">Masqué en vue claire : {event.hiddenReason}</p>
                            ) : null}
                          </button>
                        </div>
                      ))}
                    </div>
                    ) : null}
                  </div>
                  );
                })}
                {!selectedTimelineGroups.length ? (
                  <p className="rounded-xl border border-vex-border/70 bg-vex-bg/40 p-4 text-sm text-zinc-500">
                    Aucune action utile à afficher après nettoyage.
                  </p>
                ) : null}
              </div>
            </section>

            <aside className="rounded-2xl border border-vex-border bg-vex-bg/30 p-4 xl:sticky xl:top-4 xl:self-start">
              <h3 className="text-lg font-semibold text-zinc-50">Détail de l’action</h3>
              {selectedEvent ? (
                <div className="mt-4 space-y-4 text-sm">
                  {(() => {
                    const changes = changeRows(selectedEvent);
                    return changes.length ? (
                      <div className="rounded-xl border border-vex-border/70 bg-black/15 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Modifications</p>
                        <div className="mt-3 space-y-2">
                          {changes.map((change) => (
                            <div key={change.label} className="rounded-lg border border-vex-border/60 bg-vex-bg/40 p-2">
                              <p className="text-xs font-medium text-zinc-200">{change.label}</p>
                              <p className="mt-1 text-xs text-zinc-500">
                                Avant : <span className="text-zinc-300">{change.before}</span>
                              </p>
                              <p className="mt-0.5 text-xs text-zinc-500">
                                Après : <span className="text-emerald-200">{change.after}</span>
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null;
                  })()}
                  <div>
                    <p className="text-xs uppercase tracking-wide text-zinc-500">Action</p>
                    <strong className="mt-1 block text-zinc-100">{selectedEvent.title}</strong>
                    <p className="mt-1 text-zinc-400">{selectedEvent.detail}</p>
                    {selectedEvent.hiddenReason ? (
                      <p className="mt-2 rounded-lg border border-amber-400/30 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-100">
                        Masqué en vue claire : {selectedEvent.hiddenReason}
                      </p>
                    ) : null}
                  </div>
                  <dl className="space-y-3">
                    {detailRows(selectedEvent).map((row) => (
                      <div key={`${row.label}-${row.value}`}>
                        <dt className="text-zinc-500">{row.label}</dt>
                        <dd className="break-all text-zinc-200">{row.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ) : (
                <p className="mt-4 text-sm text-zinc-500">Clique sur une action de la timeline.</p>
              )}
            </aside>
          </div>
        ) : null}
      </ModalShell>
    </div>
  );
}
