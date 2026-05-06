# Vex — Contexte du projet

## C'est quoi Vex ?
Vex est un bot Discord tout-en-un avec un panel web d'administration.
Il se positionne comme une alternative premium à Carl-bot, MEE6 et Arcane.
L'objectif est d'offrir les meilleures fonctionnalités du marché, 
une interface claire et moderne, et une expérience utilisateur 
que les concurrents n'ont pas.

## Modèle économique
Freemium :
- Fonctionnalités de base gratuites pour tous
- Fonctionnalités avancées réservées aux serveurs premium (à définir au fur et à mesure)

## Cible
- Serveurs Discord francophones et anglophones
- Admins et owners de serveurs Discord (pas des développeurs)
- Toute taille de serveur : petites communautés comme grands serveurs

## Langues
- Panel web : français et anglais (i18n à prévoir)
- Bot : français et anglais selon la config du serveur

## Fonctionnalités prévues

### Embeds
Créer des messages enrichis (titre, description, couleur, images, boutons)
depuis le panel et les envoyer dans n'importe quel salon Discord.
- Éditeur visuel avec aperçu temps réel style Discord
- Boutons et menus déroulants (composants Discord)
- Import / export JSON
- Historique des envois

### Tickets
Système de support complet pour les membres du serveur.
- Panneau avec bouton personnalisable dans un salon
- Ouverture automatique d'un salon privé par ticket
- Message d'accueil personnalisable avec variables dynamiques
- Prise en charge par le staff
- Fermeture avec génération de transcript
- Liste et modération des tickets depuis le panel
- Archivage

### Logs
Journaux d'événements automatiques dans des salons dédiés.
- Arrivées et départs de membres
- Messages modifiés ou supprimés
- Actions de modération (ban, kick, warn, mute)
- Configuration par type d'événement avec salon cible distinct

### Modération
Outils de modération directement depuis le bot.
- Ban, kick, warn, mute, timeout
- Historique des sanctions par membre
- Système d'avertissements avec seuils automatiques
- Logs des actions de modération

### Rôles automatiques
Gestion intelligente des rôles.
- Rôle attribué automatiquement à l'arrivée sur le serveur
- Groupes de rôles avec règles personnalisées
- Attribution manuelle depuis le panel

### Commandes slash personnalisées
Permettre aux admins de créer leurs propres commandes.
- Réponse texte ou embed sauvegardé
- Visibilité : publique, éphémère, ou avec préfixe texte
- Déploiement immédiat sur le serveur Discord

### Bienvenue / Au revoir
Messages automatiques à l'arrivée ou au départ d'un membre.
- Message personnalisable avec variables dynamiques
- Embed ou texte simple
- Salon configurable

### Panel web
Interface d'administration pour configurer le bot sans toucher au code.
- Auth OAuth2 Discord
- Sélection du serveur
- Une page par module
- Design sombre, moderne, couleur accent indigo #6366F1
- Aides contextuelles partout
- Textes simples, tutoiement, langage humain
- Système de patchnotes intégré avec versioning
- Responsive desktop et mobile

## Ce qui nous différencie des concurrents
- UX bien supérieure à Carl-bot et MEE6 : on ne laisse jamais 
  l'utilisateur sans explication
- Aperçu temps réel Discord dans le panel pour les embeds et tickets
- Transcripts de tickets complets
- Panel entièrement en français ET anglais
- Design moderne et cohérent, pas générique
- Patchnotes publiques intégrées dans le panel

## Stack technique
- Bot : Node.js + TypeScript + discord.js v14
- API : Express + Prisma + SQLite (PostgreSQL en production)
- Panel : React + Vite + TypeScript + Tailwind CSS
- Auth : OAuth2 Discord (Passport.js)
- Monorepo : npm workspaces (api/, panel/, bot/)

## Design system panel
- Fond : #0E0E14
- Surface : #13131A
- Bordures : #1F1F2E
- Accent : #6366F1 (indigo)
- Texte principal : zinc-100
- Texte secondaire : zinc-400
- Arrondis : rounded-xl cartes, rounded-lg inputs
- Police : Inter

## Règles UX non négociables
- L'utilisateur ne doit jamais être bloqué sans explication
- Chaque section a une aide contextuelle
- Jamais de termes techniques visibles (pas de "guild_not_found", 
  pas de routes API, pas de noms de fichiers)
- Tutoiement partout
- Les textes doivent sembler écrits par un humain, pas une IA
- Cohérence visuelle et textuelle sur toutes les pages

Un dossier img/ est présent à la racine du projet.
Il contient les fichiers PNG et SVG du branding Vex :

vex-logo-dark.svg / .png — logo fond sombre
vex-logo-indigo.svg / .png — logo fond indigo
vex-logo-outline.svg / .png — logo outline
vex-logo-light.svg / .png — logo fond clair
vex-logo-wordmark.svg / .png — logo horizontal avec texte
vex-icon-512.svg / .png — icône 512x512 pour Discord et favicon
vex-banniere.svg / .png — bannière 960x540

Toujours utiliser ces fichiers pour le branding. Ne jamais recréer de logo ou d'icône depuis le code."