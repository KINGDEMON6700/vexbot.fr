#!/usr/bin/env node
/**
 * Remplace le tutoiement par le vouvoiement dans les textes UI du panel.
 * Ne touche pas aux noms de variables, placeholders Discord ({user}), etc.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../src");

const REPLACEMENTS = [
  [/Impossible de charger tes /g, "Impossible de charger vos "],
  [/Impossible de charger ton /g, "Impossible de charger votre "],
  [/Tu n'as/g, "Vous n'avez"],
  [/Tu n’as/g, "Vous n’avez"],
  [/Tu peux/g, "Vous pouvez"],
  [/Tu as/g, "Vous avez"],
  [/Tu es/g, "Vous êtes"],
  [/\bTu /g, "Vous "],
  [/ ton /g, " votre "],
  [/ ta /g, " votre "], // après createElement — éviter const ta
  [/ tes /g, " vos "],
  [/Ton /g, "Votre "],
  [/Ta /g, "Votre "],
  [/Tes /g, "Vos "],
  [/Connecte ton/g, "Connectez votre"],
  [/connecte ton/g, "connectez votre"],
  [/Choisis /g, "Choisissez "],
  [/choisis /g, "choisissez "],
  [/Clique sur/g, "Cliquez sur"],
  [/clique sur/g, "cliquez sur"],
  [/Invite le bot/g, "Invitez le bot"],
  [/invite le bot/g, "invitez le bot"],
  [/Réessaie/g, "Réessayez"],
  [/réessaie/g, "réessayez"],
  [/Reviens quand/g, "Revenez quand"],
  [/Pense à/g, "Pensez à"],
  [/Utilise «/g, "Utilisez «"],
  [/utilise /g, "utilisez "],
  [/dans ton profil/g, "dans votre profil"],
  [/ta liste/g, "votre liste"],
  [/ta place/g, "votre place"],
  [/ta demande/g, "votre demande"],
  [/ta publication/g, "votre publication"],
  [/ton avis/g, "votre avis"],
  [/ton serveur/g, "votre serveur"],
  [/ta recherche/g, "votre recherche"],
  [/tes modèles/g, "vos modèles"],
  [/tes serveurs/g, "vos serveurs"],
  [/tes Tickets/g, "vos tickets"],
  [/tes changements/g, "vos changements"],
  [/perdre ces changements/g, "perdre ces changements"],
  [/Quitte la page/g, "Quittez la page"],
  [/Crée-en/g, "Créez-en"],
  [/créé-en/g, "créé-en"],
  [/reviens /g, "revenez "],
  [/Gérer ta /g, "Gérer votre "],
  [/Partage ton/g, "Partagez votre"],
  [/Renseigne les/g, "Renseignez les"],
  [/si tu /g, "si vous "],
  [/que tu /g, "que vous "],
  [/quand tu /g, "quand vous "],
  [/pour que le membre/g, "pour que le membre"],
  [/te montre/g, "vous montre"],
  [/te répondre/g, "vous répondre"],
  [/va te répondre/g, "va vous répondre"],
];

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(name) && !name.endsWith(".d.ts")) out.push(p);
  }
  return out;
}

let changed = 0;
for (const file of walk(ROOT)) {
  if (file.includes("embedDraft.ts")) continue; // modèle exemple Discord, pas UI panel
  if (file.includes("vexTicketDefaultBranding")) continue;
  let text = fs.readFileSync(file, "utf8");
  const before = text;
  for (const [re, rep] of REPLACEMENTS) text = text.replace(re, rep);
  if (text !== before) {
    fs.writeFileSync(file, text);
    changed++;
  }
}
console.log(`Vouvoiement appliqué dans ${changed} fichier(s).`);
