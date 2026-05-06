---
name: vex-panel-ui-coherent
description: >-
  Guides consistent UI work in the Vex web panel (help, buttons, text,
  components): clarify the ask, find existing patterns and all similar places,
  present a simple French plan with files and wait for user validation before
  coding, apply design tokens and tutoiement copy identically everywhere,
  verify impact, update patchnotes. Use when adding or changing panel UI,
  visual elements, reusable components, or user-facing strings in the Vex
  project, or when the user asks for coherent UI additions.
---

# Vex — Ajouter un élément UI cohérent

Applique **toujours** cette procédure avant et pendant une modification d’interface dans le panel Vex. Si les règles du dépôt (`.cursor/rules`) disent autre chose sur un point précis, elles priment.

## Étape 1 — Comprendre

- Reformuler ce qui est demandé (une phrase claire).
- **Où** : page, section, route ou flux utilisateur.
- **Pourquoi** : ce que l’admin Discord doit pouvoir faire ou comprendre.

Si un point manque, **poser des questions** avant de chercher ou coder.

## Étape 2 — Chercher

- Un **composant ou pattern** existe-t-il déjà ? (réutiliser plutôt que dupliquer.)
- Le **même besoin** apparaît-il sur d’autres pages ?
- **Lister tous les fichiers / écrans** à traiter pour rester uniforme (pas une modif isolée si le même cas existe ailleurs).

## Étape 3 — Planifier

- Rédiger le plan en **français simple**, sans jargon inutile.
- Indiquer les **fichiers à créer ou modifier** (liste explicite).
- **Attendre la validation explicite** de l’utilisateur avant d’éditer le code.

## Étape 4 — Coder

- **Design system** (aligné sur le panel actuel) : accent `#6366F1`, fond `#0E0E14`, surface `#13131A`, bordures `#1F1F2E`, texte zinc-100 / zinc-400, `rounded-xl` sur les cartes, `rounded-lg` sur les champs — et **cohérence** avec l’existant.
- **Textes** : tutoiement, ton humain, pas de jargon ni de termes techniques Discord/API visibles pour l’utilisateur ; éviter les formulations “IA” ou administratives vides.
- **Même comportement et même présentation** partout où le besoin est le même.

## Étape 5 — Vérifier

- Risque de **régression** (navigation, sélection de serveur, URLs avec `?guild=`, etc.) : prévenir si un changement peut casser autre chose.
- **Cohérence** visuelle et textuelle avec le reste du panel.
- **Patchnotes** : mettre à jour `panel/src/data/patchnotes.ts` (+0.0.1, nouvelle entrée en haut, date, résumé en langage utilisateur simple — pas de noms de fichiers ni détails techniques internes).

## Rappel express

```
[ ] Compris + périmètre clair
[ ] Patterns existants + liste des endroits concernés
[ ] Plan + fichiers → validation utilisateur
[ ] Code aligné design + textes
[ ] Vérifs + patchnotes
```
