/** Libellés FR pour les bits de permissions Discord (API). */

const PERM_BY_INDEX: Record<number, string> = {
  0: "Créer une invitation",
  1: "Expulser des membres",
  2: "Bannir des membres",
  3: "Administrateur",
  4: "Gérer les salons",
  5: "Gérer le serveur",
  6: "Ajouter des réactions",
  7: "Voir les journaux d’audit",
  8: "Voix prioritaire",
  9: "Vidéo / stream",
  10: "Voir les salons",
  11: "Envoyer des messages",
  12: "Utiliser les messages TTS",
  13: "Gérer les messages",
  14: "Intégrer des liens",
  15: "Joindre des fichiers",
  16: "Voir l’historique des messages",
  17: "Mentionner @everyone et @here",
  18: "Utiliser des émojis externes",
  19: "Voir les statistiques du serveur",
  20: "Se connecter (vocal)",
  21: "Parler (vocal)",
  22: "Couper le micro des membres",
  23: "Mettre en sourdine des membres",
  24: "Déplacer des membres",
  25: "Détection de la voix",
  26: "Changer de pseudo",
  27: "Gérer les pseudos",
  28: "Gérer les rôles",
  29: "Gérer les webhooks",
  30: "Gérer les expressions du serveur",
  31: "Utiliser les commandes d’application",
  32: "Demander à prendre la parole (stage)",
  33: "Gérer les événements",
  34: "Gérer les fils",
  35: "Créer des fils publics",
  36: "Créer des fils privés",
  37: "Utiliser des autocollants externes",
  38: "Envoyer des messages dans les fils",
  39: "Utiliser les activités intégrées",
  40: "Modérer les membres (timeout)",
  41: "Voir les stats monétisation créateur",
  42: "Utiliser le soundboard",
  43: "Créer des expressions du serveur",
  44: "Créer des événements",
  45: "Utiliser des sons externes",
  46: "Envoyer des messages vocaux",
  47: "Définir le statut d’invitation",
  48: "Envoyer des sondages",
  49: "Utiliser des applications externes",
  50: "Créer du contenu média",
  51: "Définir le salon média par défaut",
  52: "Envoyer des messages en mode média",
  53: "Utiliser les commandes slash externes",
};

export function parseDiscordPermissionBits(raw: string): bigint {
  try {
    const t = raw?.trim() ?? "";
    if (!t || t === "0") return 0n;
    return BigInt(t);
  } catch {
    return 0n;
  }
}

/** Liste des droits activés (ordre des bits API), en français. */
export function humanizeDiscordPermissionBits(bits: bigint): string[] {
  if (bits === 0n) return [];
  if ((bits & (1n << 3n)) !== 0n) {
    return ["Administrateur (toutes les permissions du rôle)"];
  }
  const out: string[] = [];
  for (let i = 0; i < 54; i++) {
    const b = 1n << BigInt(i);
    if ((bits & b) === 0n) continue;
    out.push(PERM_BY_INDEX[i] ?? `Permission (bit ${i})`);
  }
  return out;
}

export function humanizeOverwritePair(allowRaw: string, denyRaw: string): { allow: string[]; deny: string[] } {
  const allow = parseDiscordPermissionBits(allowRaw);
  const deny = parseDiscordPermissionBits(denyRaw);
  return {
    allow: humanizeDiscordPermissionBits(allow),
    deny: humanizeDiscordPermissionBits(deny),
  };
}
