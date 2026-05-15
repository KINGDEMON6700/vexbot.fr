import { AppError } from "../lib/AppError.js";
import type {
  ApplyPlan,
  ChannelPlanItem,
  RolePlanItem,
} from "./serverTemplateDiff.js";
import type {
  ServerTemplateChannelType,
  ServerTemplateSnapshot,
  SnapshotPermissionOverwrite,
  SnapshotRole,
} from "./serverTemplateSnapshot.js";

const DISCORD_API = "https://discord.com/api/v10";

/** Convertit notre type de salon en valeur API Discord. */
function discordChannelTypeId(t: ServerTemplateChannelType): number {
  switch (t) {
    case "text":
      return 0;
    case "voice":
      return 2;
    case "category":
      return 4;
    case "announcement":
      return 5;
    case "stage":
      return 13;
    case "forum":
      return 15;
    case "media":
      return 16;
  }
}

export type ApplyProgressEvent =
  | { type: "start"; totalSteps: number }
  | { type: "step"; index: number; total: number; label: string; status: "doing" }
  | {
      type: "step";
      index: number;
      total: number;
      label: string;
      status: "done" | "error" | "skipped";
      detail?: string;
    }
  | { type: "done"; appliedSteps: number; failedSteps: number }
  | { type: "fatal"; error: string };

async function discordRequest<T>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  botToken: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${DISCORD_API}${path}`, {
    method,
    headers: {
      Authorization: `Bot ${botToken}`,
      "Content-Type": "application/json",
      // Discord exige une chaîne URL-encodée en ASCII pour ce header.
      "X-Audit-Log-Reason": encodeURIComponent(
        "Vex - application d'un template de serveur",
      ),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 204) return undefined as unknown as T;
  if (res.status === 429) {
    throw new AppError(
      503,
      "Discord nous a rate-limités, réessaie dans quelques secondes.",
      "DISCORD_RATE_LIMITED",
    );
  }
  if (!res.ok) {
    let txt = "";
    try {
      txt = await res.text();
    } catch {
      /* ignore */
    }
    throw new AppError(
      502,
      `Discord a renvoyé HTTP ${res.status}${txt ? ` — ${txt.slice(0, 200)}` : ""}`,
      "DISCORD_ERROR",
    );
  }
  return (await res.json()) as T;
}

/** Map permission overwrites snapshot → format Discord, en remplaçant les `roleSourceId` par les vrais IDs. */
function buildOverwritesForDiscord(
  overwrites: SnapshotPermissionOverwrite[],
  templateRoleIdToReal: Map<string, string>,
): Array<{ id: string; type: 0; allow: string; deny: string }> {
  const out: Array<{ id: string; type: 0; allow: string; deny: string }> = [];
  for (const o of overwrites) {
    const realId = templateRoleIdToReal.get(o.roleSourceId);
    if (!realId) continue;
    out.push({ id: realId, type: 0, allow: o.allow, deny: o.deny });
  }
  return out;
}

type ChannelCreatedApi = { id: string };
type RoleCreatedApi = { id: string };

/**
 * Applique un plan sur un serveur Discord. Async generator qui yield des événements de progression.
 *
 * Ordre des opérations (important pour éviter les références cassées) :
 *  1. Créer les rôles manquants (pour pouvoir s’en servir dans les overwrites)
 *  2. Modifier les rôles existants
 *  3. Créer les catégories
 *  4. Créer les salons (avec leur parent et leurs overwrites)
 *  5. Modifier les salons existants
 *  6. Supprimer les salons en trop
 *  7. Supprimer les rôles en trop
 */
export async function* applyServerTemplate(
  discordGuildId: string,
  botToken: string,
  plan: ApplyPlan,
  currentSnapshot: ServerTemplateSnapshot,
  templateSnapshot: ServerTemplateSnapshot,
): AsyncGenerator<ApplyProgressEvent> {
  // 1) Mapper sourceId du template → id réel sur le serveur cible (au fur et à mesure).
  /** Pour les rôles : sourceId template → id réel sur le serveur cible. */
  const templateRoleIdToReal = new Map<string, string>();
  /** Pour les catégories : sourceId template → id réel sur le serveur cible. */
  const templateCategoryIdToReal = new Map<string, string>();

  // Pré-remplissage des mappings depuis les deux snapshots complets : on lie par nom.
  // Comme ça les rôles/catégories existants (même non modifiés) sont accessibles aux overwrites
  // et aux salons à créer.
  const currentRoleIdByName = new Map<string, string>();
  for (const r of currentSnapshot.roles) currentRoleIdByName.set(r.name, r.sourceId);
  for (const r of templateSnapshot.roles) {
    const realId = currentRoleIdByName.get(r.name);
    if (realId) templateRoleIdToReal.set(r.sourceId, realId);
  }

  const currentCategoryIdByName = new Map<string, string>();
  for (const c of currentSnapshot.channels) {
    if (c.type === "category") currentCategoryIdByName.set(c.name, c.sourceId);
  }
  for (const c of templateSnapshot.channels) {
    if (c.type === "category") {
      const realId = currentCategoryIdByName.get(c.name);
      if (realId) templateCategoryIdToReal.set(c.sourceId, realId);
    }
  }

  const rolesToCreate = plan.rolesPlan.filter(
    (p): p is Extract<RolePlanItem, { kind: "create" }> => p.kind === "create",
  );
  const rolesToModify = plan.rolesPlan.filter(
    (p): p is Extract<RolePlanItem, { kind: "modify" }> => p.kind === "modify",
  );
  const rolesToDelete = plan.rolesPlan.filter(
    (p): p is Extract<RolePlanItem, { kind: "delete" }> => p.kind === "delete",
  );

  const channelCreates = plan.channelsPlan.filter(
    (p): p is Extract<ChannelPlanItem, { kind: "create" }> => p.kind === "create",
  );
  const categoryCreates = channelCreates.filter((c) => c.templateChannel.type === "category");
  const nonCategoryCreates = channelCreates.filter((c) => c.templateChannel.type !== "category");

  const channelModifies = plan.channelsPlan.filter(
    (p): p is Extract<ChannelPlanItem, { kind: "modify" }> => p.kind === "modify",
  );
  const channelDeletes = plan.channelsPlan.filter(
    (p): p is Extract<ChannelPlanItem, { kind: "delete" }> => p.kind === "delete",
  );

  const totalSteps =
    rolesToCreate.length +
    rolesToModify.length +
    categoryCreates.length +
    nonCategoryCreates.length +
    channelModifies.length +
    channelDeletes.length +
    rolesToDelete.length;

  let stepIndex = 0;
  let appliedSteps = 0;
  let failedSteps = 0;

  yield { type: "start", totalSteps };

  function nextStep(label: string): { index: number; total: number; label: string } {
    stepIndex += 1;
    return { index: stepIndex, total: totalSteps, label };
  }

  function rolePermsForCreate(role: SnapshotRole) {
    return {
      name: role.name,
      permissions: role.permissions,
      color: role.color,
      hoist: role.hoist,
      mentionable: role.mentionable,
      unicode_emoji: role.unicodeEmoji ?? undefined,
    };
  }

  // ---- 1. Créer rôles manquants ----
  for (const op of rolesToCreate) {
    const step = nextStep(`Créer le rôle « ${op.templateRole.name} »`);
    yield { type: "step", ...step, status: "doing" };
    try {
      const created = await discordRequest<RoleCreatedApi>(
        "POST",
        `/guilds/${discordGuildId}/roles`,
        botToken,
        rolePermsForCreate(op.templateRole),
      );
      templateRoleIdToReal.set(op.templateRole.sourceId, created.id);
      appliedSteps += 1;
      yield { type: "step", ...step, status: "done" };
    } catch (e) {
      failedSteps += 1;
      yield {
        type: "step",
        ...step,
        status: "error",
        detail: e instanceof Error ? e.message : "erreur inconnue",
      };
    }
  }

  // ---- 2. Modifier rôles existants ----
  for (const op of rolesToModify) {
    const step = nextStep(`Mettre à jour le rôle « ${op.templateRole.name} »`);
    yield { type: "step", ...step, status: "doing" };
    try {
      // @everyone est référencé par l'id de la guild
      await discordRequest(
        "PATCH",
        `/guilds/${discordGuildId}/roles/${op.currentRole.sourceId}`,
        botToken,
        rolePermsForCreate(op.templateRole),
      );
      // Le mapping est déjà rempli au-dessus.
      appliedSteps += 1;
      yield { type: "step", ...step, status: "done" };
    } catch (e) {
      failedSteps += 1;
      yield {
        type: "step",
        ...step,
        status: "error",
        detail: e instanceof Error ? e.message : "erreur inconnue",
      };
    }
  }

  // ---- 3. Créer catégories ----
  for (const op of categoryCreates) {
    const step = nextStep(`Créer la catégorie « ${op.templateChannel.name} »`);
    yield { type: "step", ...step, status: "doing" };
    try {
      const created = await discordRequest<ChannelCreatedApi>(
        "POST",
        `/guilds/${discordGuildId}/channels`,
        botToken,
        {
          name: op.templateChannel.name,
          type: discordChannelTypeId("category"),
          permission_overwrites: buildOverwritesForDiscord(
            op.templateChannel.permissionOverwrites,
            templateRoleIdToReal,
          ),
        },
      );
      templateCategoryIdToReal.set(op.templateChannel.sourceId, created.id);
      appliedSteps += 1;
      yield { type: "step", ...step, status: "done" };
    } catch (e) {
      failedSteps += 1;
      yield {
        type: "step",
        ...step,
        status: "error",
        detail: e instanceof Error ? e.message : "erreur inconnue",
      };
    }
  }

  // ---- 4. Créer salons (non catégories) ----
  for (const op of nonCategoryCreates) {
    const step = nextStep(`Créer le salon « ${op.templateChannel.name} »`);
    yield { type: "step", ...step, status: "doing" };
    try {
      const parentRealId = op.templateChannel.parentSourceId
        ? templateCategoryIdToReal.get(op.templateChannel.parentSourceId) ?? null
        : null;
      const payload: Record<string, unknown> = {
        name: op.templateChannel.name,
        type: discordChannelTypeId(op.templateChannel.type),
        permission_overwrites: buildOverwritesForDiscord(
          op.templateChannel.permissionOverwrites,
          templateRoleIdToReal,
        ),
      };
      if (parentRealId) payload.parent_id = parentRealId;
      if (op.templateChannel.topic !== null) payload.topic = op.templateChannel.topic;
      if (op.templateChannel.nsfw) payload.nsfw = true;
      if (op.templateChannel.rateLimitPerUser !== null)
        payload.rate_limit_per_user = op.templateChannel.rateLimitPerUser;
      if (op.templateChannel.bitrate !== null) payload.bitrate = op.templateChannel.bitrate;
      if (op.templateChannel.userLimit !== null) payload.user_limit = op.templateChannel.userLimit;
      if (op.templateChannel.defaultAutoArchiveDuration !== null)
        payload.default_auto_archive_duration = op.templateChannel.defaultAutoArchiveDuration;

      await discordRequest<ChannelCreatedApi>(
        "POST",
        `/guilds/${discordGuildId}/channels`,
        botToken,
        payload,
      );
      appliedSteps += 1;
      yield { type: "step", ...step, status: "done" };
    } catch (e) {
      failedSteps += 1;
      yield {
        type: "step",
        ...step,
        status: "error",
        detail: e instanceof Error ? e.message : "erreur inconnue",
      };
    }
  }

  // ---- 5. Modifier salons existants ----
  for (const op of channelModifies) {
    const step = nextStep(`Mettre à jour « ${op.templateChannel.name} »`);
    yield { type: "step", ...step, status: "doing" };
    try {
      const payload: Record<string, unknown> = {
        name: op.templateChannel.name,
      };
      if (op.templateChannel.type !== "category") {
        if (op.templateChannel.topic !== null) payload.topic = op.templateChannel.topic;
        if (op.templateChannel.rateLimitPerUser !== null)
          payload.rate_limit_per_user = op.templateChannel.rateLimitPerUser;
        if (op.templateChannel.bitrate !== null) payload.bitrate = op.templateChannel.bitrate;
        if (op.templateChannel.userLimit !== null) payload.user_limit = op.templateChannel.userLimit;
        payload.nsfw = op.templateChannel.nsfw;
      }
      payload.permission_overwrites = buildOverwritesForDiscord(
        op.templateChannel.permissionOverwrites,
        templateRoleIdToReal,
      );
      await discordRequest(
        "PATCH",
        `/channels/${op.currentChannel.sourceId}`,
        botToken,
        payload,
      );
      appliedSteps += 1;
      yield { type: "step", ...step, status: "done" };
    } catch (e) {
      failedSteps += 1;
      yield {
        type: "step",
        ...step,
        status: "error",
        detail: e instanceof Error ? e.message : "erreur inconnue",
      };
    }
  }

  // ---- 6. Supprimer salons en trop ----
  // Suppression : catégories en dernier pour ne pas laisser de salons orphelins entre deux DELETE.
  const orderedDeletes = [
    ...channelDeletes.filter((d) => d.currentChannel.type !== "category"),
    ...channelDeletes.filter((d) => d.currentChannel.type === "category"),
  ];
  for (const op of orderedDeletes) {
    const step = nextStep(`Supprimer « ${op.currentChannel.name} »`);
    yield { type: "step", ...step, status: "doing" };
    try {
      await discordRequest("DELETE", `/channels/${op.currentChannel.sourceId}`, botToken);
      appliedSteps += 1;
      yield { type: "step", ...step, status: "done" };
    } catch (e) {
      failedSteps += 1;
      yield {
        type: "step",
        ...step,
        status: "error",
        detail: e instanceof Error ? e.message : "erreur inconnue",
      };
    }
  }

  // ---- 7. Supprimer rôles en trop ----
  for (const op of rolesToDelete) {
    const step = nextStep(`Supprimer le rôle « ${op.currentRole.name} »`);
    yield { type: "step", ...step, status: "doing" };
    try {
      await discordRequest(
        "DELETE",
        `/guilds/${discordGuildId}/roles/${op.currentRole.sourceId}`,
        botToken,
      );
      appliedSteps += 1;
      yield { type: "step", ...step, status: "done" };
    } catch (e) {
      failedSteps += 1;
      yield {
        type: "step",
        ...step,
        status: "error",
        detail: e instanceof Error ? e.message : "erreur inconnue",
      };
    }
  }

  yield { type: "done", appliedSteps, failedSteps };
}
