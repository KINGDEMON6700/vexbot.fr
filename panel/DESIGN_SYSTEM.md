# Design System Vex (existant)

Ce document décrit les styles **déja utilisés dans le panel** (`panel/src`) et sert de référence pour garder une interface cohérente.

## 1) Couleurs

### Couleurs principales (tokens)
- `vex-accent` : `#6366f1` (action principale, liens importants)
- `vex-bg` : `#0e0e14` (fond global)
- `vex-surface` : `#13131a` (cartes, zones de contenu)
- `vex-border` : `#1f1f2e` (bordures)

### Couleurs de texte les plus utilisées
- Texte fort : `text-zinc-100`
- Texte standard : `text-zinc-300` / `text-zinc-400`
- Texte secondaire : `text-zinc-500` / `text-zinc-600`

### Couleurs d'état
- Info/neutral : `zinc-*`
- Succès : `emerald-*`
- Avertissement : `amber-*`
- Danger : `red-*`

## 2) Typographies

- Police principale : `Inter` (token `--font-sans`)
- Police “rendu Discord” : `Noto Sans` (token `--font-discord-body`)

### Échelle de texte observée
- Très petit : `text-xs` / `text-[11px]`
- Corps : `text-sm`
- Titre local : `text-lg`
- Titre de page : `text-2xl` + `font-semibold` + `tracking-tight`

## 3) Espacements

### Rythme vertical
- Espacement sections : `gap-6`
- Cartes : `p-4` / `p-5` / `p-6`
- États “chargement/vide” : `px-6` à `px-8`, `py-10` à `py-12`

### Champs et boutons
- Inputs : `px-3 py-2` (ou `py-2.5`)
- Boutons : `px-3/4 py-1.5/2`

## 4) Border radius

- Standard UI : `rounded-lg`
- Cartes / grands blocs : `rounded-xl`
- Micro éléments (tags, badges) : `rounded` ou `rounded-md`
- Preview Discord (fidélité Discord) : `rounded-[3px]` / `rounded-[4px]`

## 5) Composants UI récurrents

- **Carte standard** : fond `vex-surface`, bordure `vex-border`, `rounded-xl`
- **Carte atténuée** : `vex-surface/50` (chargement, info secondaire)
- **État vide** : bordure en tirets + fond `vex-bg/40` + texte centré
- **Bouton principal** : fond `vex-accent`, texte blanc
- **Bouton secondaire** : bordure `vex-border`, fond transparent
- **Champ de saisie** : fond `vex-bg`, bordure `vex-border`, focus `vex-accent`

## 6) Classes utilitaires ajoutées pour harmoniser

Ces classes sont centralisées dans `panel/src/index.css` (`@layer components`) :

- `.ui-card`
- `.ui-card-muted`
- `.ui-empty-state`
- `.ui-btn-primary`
- `.ui-btn-secondary`
- `.ui-input`

Objectif : garder les mêmes styles sur toutes les pages sans changer la structure JSX.

## 7) Mise en page et navigation

- Contenu principal du panel : largeur max **`max-w-6xl`**, marges **`px-4 sm:px-6`**, comme la barre du haut (`Navbar`).
- En-tête de page : **`text-2xl font-semibold tracking-tight text-zinc-100`** + sous-titre **`text-sm text-zinc-400`** (souvent via `AuthenticatedSection`).
- Pages « pleine largeur » (ex. **Embeds**) : passer **`wrapContent={false}`** sur `AuthenticatedSection` pour ne pas enfermer le contenu dans le cadre en pointillés réservé aux placeholders.

## 8) Icônes

- Icônes **Font Awesome 6** en classes du type **`fa-solid fa-…`** (déjà utilisé sur la vue d’ensemble pour les petites stats).

## 9) Motifs récurrents (pages déjà faites)

- **Stat / carte métrique** (vue d’ensemble) : `rounded-lg border border-vex-border/80 bg-vex-bg/50` + icône accent + label `text-xs text-zinc-500`.
- **Titre de groupe** (uppercase discret) : `text-[11px] font-semibold uppercase tracking-wider text-zinc-500`.
- **Message d’erreur chargement** : carte atténuée centrée, phrase humaine, jamais de code technique brut pour l’utilisateur.

## 10) Règles d'application (à suivre)

- Réutiliser d'abord les classes utilitaires ci-dessus avant d’écrire de nouvelles combinaisons.
- Garder `rounded-xl` pour les grands conteneurs, `rounded-lg` pour champs/boutons.
- Utiliser `text-zinc-500/600` pour le texte secondaire, `text-zinc-100` pour le contenu principal.
- Garder les couleurs `amber/red/emerald` uniquement pour les statuts (warning/danger/succès).
- Pour une **nouvelle page riche** (ex. Tickets) : même rythme **`gap-6`**, mêmes états vide / chargement / erreur que **Vue d’ensemble** et **Embeds**.
