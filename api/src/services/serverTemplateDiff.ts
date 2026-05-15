import type {
  ServerTemplateSnapshot,
  SnapshotChannel,
  SnapshotRole,
} from "./serverTemplateSnapshot.js";

/**
 * Plan d’actions pour passer de l’état actuel à l’état décrit par le template.
 * - matching des rôles : par nom (case-sensitive)
 * - matching des catégories : par nom
 * - matching des salons : par nom + nom de la catégorie parente (les déplacements = delete + create pour rester simple)
 *
 * Cas particuliers :
 * - @everyone : jamais créé ni supprimé, on met juste à jour ses permissions globales (= "modify").
 * - Rôles `managed` (bots, boosters, intégrations) : intacts (skip).
 * - Permissions overwrites : portent sur le nom du rôle (le rôle d’origine est résolu par sourceId dans le snapshot, on remappe par nom pour l’apply).
 */

export type RolePlanItem =
  | { kind: "create"; templateRole: SnapshotRole }
  | { kind: "modify"; currentRole: SnapshotRole; templateRole: SnapshotRole; changes: string[] }
  | { kind: "delete"; currentRole: SnapshotRole }
  | { kind: "skip"; reason: string; currentRole?: SnapshotRole; templateRole?: SnapshotRole };

export type ChannelPlanItem =
  | {
      kind: "create";
      templateChannel: SnapshotChannel;
      parentNameInTemplate: string | null;
    }
  | {
      kind: "modify";
      currentChannel: SnapshotChannel;
      templateChannel: SnapshotChannel;
      changes: string[];
    }
  | { kind: "delete"; currentChannel: SnapshotChannel };

export type ApplyPlan = {
  rolesPlan: RolePlanItem[];
  channelsPlan: ChannelPlanItem[];
  warnings: string[];
  /** Compteurs synthétiques pour l’UI. */
  summary: {
    rolesToCreate: number;
    rolesToModify: number;
    rolesToDelete: number;
    channelsToCreate: number;
    channelsToModify: number;
    channelsToDelete: number;
  };
};

function isEveryoneName(name: string): boolean {
  return name === "@everyone";
}

function findParentName(channels: SnapshotChannel[], parentSourceId: string | null): string | null {
  if (!parentSourceId) return null;
  const cat = channels.find((c) => c.sourceId === parentSourceId && c.type === "category");
  return cat ? cat.name : null;
}

/** Renvoie la liste des champs qui diffèrent entre deux rôles (présentables à l’utilisateur). */
function roleChanges(curr: SnapshotRole, tpl: SnapshotRole): string[] {
  const out: string[] = [];
  if (curr.color !== tpl.color) out.push("couleur");
  if (curr.hoist !== tpl.hoist) out.push("séparation dans la liste");
  if (curr.mentionable !== tpl.mentionable) out.push("mentionnable");
  if (curr.permissions !== tpl.permissions) out.push("permissions globales");
  if (curr.position !== tpl.position) out.push("position");
  if (curr.unicodeEmoji !== tpl.unicodeEmoji) out.push("emoji");
  return out;
}

function permissionOverwritesEqual(
  curr: SnapshotChannel,
  currRoleNameById: Map<string, string>,
  tpl: SnapshotChannel,
  tplRoleNameById: Map<string, string>,
): boolean {
  const a = new Map<string, { allow: string; deny: string }>();
  for (const o of curr.permissionOverwrites) {
    const name = currRoleNameById.get(o.roleSourceId);
    if (name) a.set(name, { allow: o.allow, deny: o.deny });
  }
  const b = new Map<string, { allow: string; deny: string }>();
  for (const o of tpl.permissionOverwrites) {
    const name = tplRoleNameById.get(o.roleSourceId);
    if (name) b.set(name, { allow: o.allow, deny: o.deny });
  }
  if (a.size !== b.size) return false;
  for (const [k, v] of a) {
    const w = b.get(k);
    if (!w) return false;
    if (w.allow !== v.allow || w.deny !== v.deny) return false;
  }
  return true;
}

function channelChanges(
  curr: SnapshotChannel,
  currRoleNameById: Map<string, string>,
  tpl: SnapshotChannel,
  tplRoleNameById: Map<string, string>,
): string[] {
  const out: string[] = [];
  if (curr.type !== tpl.type) out.push(`type (${curr.type} → ${tpl.type})`);
  if ((curr.topic ?? "") !== (tpl.topic ?? "")) out.push("sujet");
  if (curr.nsfw !== tpl.nsfw) out.push("NSFW");
  if (curr.rateLimitPerUser !== tpl.rateLimitPerUser) out.push("slowmode");
  if (curr.bitrate !== tpl.bitrate) out.push("bitrate");
  if (curr.userLimit !== tpl.userLimit) out.push("limite d’utilisateurs");
  if (curr.position !== tpl.position) out.push("position");
  if (!permissionOverwritesEqual(curr, currRoleNameById, tpl, tplRoleNameById)) {
    out.push("permissions par rôle");
  }
  return out;
}

export function buildApplyPlan(
  current: ServerTemplateSnapshot,
  template: ServerTemplateSnapshot,
): ApplyPlan {
  const warnings: string[] = [];

  const currRoleNameById = new Map(current.roles.map((r) => [r.sourceId, r.name]));
  const tplRoleNameById = new Map(template.roles.map((r) => [r.sourceId, r.name]));

  const currRolesByName = new Map<string, SnapshotRole>();
  for (const r of current.roles) currRolesByName.set(r.name, r);
  const tplRolesByName = new Map<string, SnapshotRole>();
  for (const r of template.roles) tplRolesByName.set(r.name, r);

  const rolesPlan: RolePlanItem[] = [];

  // @everyone : on le retire des sets, gestion à part.
  const currEveryone = currRolesByName.get("@everyone");
  const tplEveryone = tplRolesByName.get("@everyone");
  if (currEveryone && tplEveryone) {
    const changes = roleChanges(currEveryone, tplEveryone).filter(
      (c) => c !== "position" && c !== "séparation dans la liste" && c !== "mentionnable" && c !== "couleur",
    );
    if (changes.length > 0) {
      rolesPlan.push({ kind: "modify", currentRole: currEveryone, templateRole: tplEveryone, changes });
    } else {
      rolesPlan.push({
        kind: "skip",
        reason: "@everyone : permissions globales identiques",
        currentRole: currEveryone,
      });
    }
    currRolesByName.delete("@everyone");
    tplRolesByName.delete("@everyone");
  }

  // Création / modification
  for (const [name, tpl] of tplRolesByName) {
    const curr = currRolesByName.get(name);
    if (!curr) {
      rolesPlan.push({ kind: "create", templateRole: tpl });
    } else {
      if (curr.managed) {
        rolesPlan.push({
          kind: "skip",
          reason: "rôle géré par Discord/une intégration",
          currentRole: curr,
          templateRole: tpl,
        });
      } else {
        const changes = roleChanges(curr, tpl);
        if (changes.length > 0) {
          rolesPlan.push({ kind: "modify", currentRole: curr, templateRole: tpl, changes });
        }
      }
      currRolesByName.delete(name);
    }
  }

  // Suppression
  for (const [, curr] of currRolesByName) {
    if (curr.managed) {
      rolesPlan.push({
        kind: "skip",
        reason: "rôle géré par Discord/une intégration",
        currentRole: curr,
      });
      continue;
    }
    rolesPlan.push({ kind: "delete", currentRole: curr });
  }

  // ---- Channels ----

  /** Clé unique pour matcher : "category|name" pour les catégories, "<parentName>|<name>" pour les salons. */
  function channelKey(channels: SnapshotChannel[], ch: SnapshotChannel): string {
    if (ch.type === "category") return `__cat__|${ch.name}`;
    const parent = findParentName(channels, ch.parentSourceId);
    return `${parent ?? "__none__"}|${ch.name}`;
  }

  const currChannelsByKey = new Map<string, SnapshotChannel>();
  for (const c of current.channels) currChannelsByKey.set(channelKey(current.channels, c), c);
  const tplChannelsByKey = new Map<string, SnapshotChannel>();
  for (const c of template.channels) tplChannelsByKey.set(channelKey(template.channels, c), c);

  const channelsPlan: ChannelPlanItem[] = [];

  // Création / modification
  for (const [key, tpl] of tplChannelsByKey) {
    const curr = currChannelsByKey.get(key);
    if (!curr) {
      channelsPlan.push({
        kind: "create",
        templateChannel: tpl,
        parentNameInTemplate: findParentName(template.channels, tpl.parentSourceId),
      });
    } else {
      const changes = channelChanges(curr, currRoleNameById, tpl, tplRoleNameById);
      if (changes.length > 0) {
        channelsPlan.push({ kind: "modify", currentChannel: curr, templateChannel: tpl, changes });
      }
      currChannelsByKey.delete(key);
    }
  }

  // Suppression
  for (const [, curr] of currChannelsByKey) {
    channelsPlan.push({ kind: "delete", currentChannel: curr });
  }

  // ---- Avertissements ----
  const willDeleteChannels = channelsPlan.filter((p) => p.kind === "delete").length;
  if (willDeleteChannels > 0) {
    warnings.push(
      `${willDeleteChannels} salon(s)/catégorie(s) seront supprimés. Tout l’historique des messages sera perdu.`,
    );
  }
  const willDeleteRoles = rolesPlan.filter((p) => p.kind === "delete").length;
  if (willDeleteRoles > 0) {
    warnings.push(
      `${willDeleteRoles} rôle(s) seront supprimés. Les membres perdront ces rôles.`,
    );
  }
  if (rolesPlan.some((p) => p.kind === "create")) {
    warnings.push(
      "Les rôles créés n’auront aucun membre. Tu devras les attribuer manuellement.",
    );
  }

  return {
    rolesPlan,
    channelsPlan,
    warnings,
    summary: {
      rolesToCreate: rolesPlan.filter((p) => p.kind === "create").length,
      rolesToModify: rolesPlan.filter((p) => p.kind === "modify").length,
      rolesToDelete: rolesPlan.filter((p) => p.kind === "delete").length,
      channelsToCreate: channelsPlan.filter((p) => p.kind === "create").length,
      channelsToModify: channelsPlan.filter((p) => p.kind === "modify").length,
      channelsToDelete: channelsPlan.filter((p) => p.kind === "delete").length,
    },
  };
}
