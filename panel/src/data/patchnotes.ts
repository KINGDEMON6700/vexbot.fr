export type Patchnote = {
  version: string;
  date: string;
  changes: string[];
};

export const patchnotes: Patchnote[] = [
  {
    version: "0.0.62",
    date: "2026-04-20",
    changes: [
      "Embeds : texte d’aide sous le nom du modèle un peu plus court.",
    ],
  },
  {
    version: "0.0.61",
    date: "2026-04-20",
    changes: [
      "Embeds : le nom du modèle se saisit dans la carte Modèle ; le petit bloc en haut de l’éditeur a disparu pour alléger la page.",
    ],
  },
  {
    version: "0.0.60",
    date: "2026-04-20",
    changes: [
      "Embeds : choisir un modèle, en créer un nouveau ou en supprimer un se fait dans un bloc plus clair, avec un menu qui s’ouvre comme pour le choix du serveur.",
    ],
  },
  {
    version: "0.0.59",
    date: "2026-04-20",
    changes: [
      "Rien ne change pour toi dans le panel ; on a retiré des messages techniques dans la console du bot en développement.",
    ],
  },
  {
    version: "0.0.56",
    date: "2026-04-20",
    changes: [
      "Sur Discord, les administrateurs peuvent utiliser la commande /sendembed avec le nom d’un modèle Embeds pour l’envoyer dans le salon où la commande est utilisée.",
    ],
  },
  {
    version: "0.0.55",
    date: "2026-04-20",
    changes: [
      "Vue d’ensemble : un accès « Voir les patchnotes » est ajouté dans la carte Informations Bot, avec une page dédiée pour lire toutes les nouveautés.",
    ],
  },
  {
    version: "0.0.54",
    date: "2026-04-20",
    changes: [
      "Embeds : le bouton « Enregistrer » est déplacé à côté du choix du modèle, avec un indicateur de modifications non enregistrées et une confirmation avant de perdre des changements.",
    ],
  },
  {
    version: "0.0.53",
    date: "2026-04-20",
    changes: [
      "Embeds : l’aperçu Discord est encore ajusté pour mieux coller au rendu réel, avec l’icône de lien externe sur le bouton lien et des espacements plus proches de Discord.",
    ],
  },
  {
    version: "0.0.52",
    date: "2026-04-20",
    changes: [
      "Embeds : l’aperçu Discord se rapproche du rendu réel avec un titre cliquable en bleu et des champs moins sombres/plus lisibles.",
    ],
  },
  {
    version: "0.0.51",
    date: "2026-04-20",
    changes: [
      "Embeds : les images du modèle « Exemple » utilisent des liens plus fiables pour s’afficher correctement lors de l’envoi sur Discord.",
    ],
  },
  {
    version: "0.0.50",
    date: "2026-04-20",
    changes: [
      "Embeds : tu peux choisir un salon texte puis cliquer sur « Envoyer » pour publier directement le modèle en cours (même s’il n’est pas enregistré), message par message dans l’ordre.",
    ],
  },
  {
    version: "0.0.49",
    date: "2026-04-20",
    changes: [
      "Embeds : le message d’intro du modèle « Exemple » est ajusté en retirant « Salut ! » pour aller plus direct.",
    ],
  },
  {
    version: "0.0.48",
    date: "2026-04-20",
    changes: [
      "Embeds : le contenu du premier embed du modèle « Exemple » revient à une version plus courte et plus simple.",
    ],
  },
  {
    version: "0.0.47",
    date: "2026-04-20",
    changes: [
      "Embeds : le modèle « Exemple » n’a plus qu’un seul embed, avec une explication complète du formatage et des mentions directement dedans.",
    ],
  },
  {
    version: "0.0.46",
    date: "2026-04-20",
    changes: [
      "Embeds : l’exemple explique maintenant comment récupérer un ID (clic droit puis « Copier l’identifiant ») pour un salon, un rôle ou un utilisateur.",
    ],
  },
  {
    version: "0.0.45",
    date: "2026-04-20",
    changes: [
      "Embeds : le texte d’intro est raccourci pour retirer la mention de réutilisation plus tard dans le bot.",
    ],
  },
  {
    version: "0.0.44",
    date: "2026-04-20",
    changes: [
      "Embeds : le bouton « Nouveau » propose maintenant un modèle « Exemple » pré-rempli (2 embeds, images, formatage, mentions et un bouton lien) pour montrer ce que tu peux faire.",
    ],
  },
  {
    version: "0.0.43",
    date: "2026-04-20",
    changes: [
      "Embeds : avant de supprimer un modèle, une confirmation claire s’affiche dans la page avec « Oui, supprimer » et « Annuler ».",
    ],
  },
  {
    version: "0.0.42",
    date: "2026-04-20",
    changes: [
      "Embeds : le titre de l’aide markdown devient « Formatage du texte » pour être plus clair.",
    ],
  },
  {
    version: "0.0.41",
    date: "2026-04-20",
    changes: [
      "Embeds : l’aide markdown inclut aussi le format pour ping un utilisateur.",
    ],
  },
  {
    version: "0.0.40",
    date: "2026-04-20",
    changes: [
      "Embeds : le texte d’aide au-dessus du contenu est simplifié, l’insertion rapide salon/rôle est retirée, et l’aide markdown affiche aussi comment ping un salon ou un rôle.",
    ],
  },
  {
    version: "0.0.39",
    date: "2026-04-20",
    changes: [
      "Embeds : le compteur de lignes des composants n’est plus affiché, et une aide markdown simple est ajoutée sous l’aperçu Discord.",
    ],
  },
  {
    version: "0.0.38",
    date: "2026-04-20",
    changes: [
      "Embeds : les composants sous un message ne sont plus obligatoires ; tu peux maintenant enregistrer un modèle avec 0 composant.",
    ],
  },
  {
    version: "0.0.37",
    date: "2026-04-19",
    changes: [
      "Embeds : les composants sous le message se limitent aux boutons classiques et aux boutons lien (plus de menus déroulants) — plus simple à gérer.",
    ],
  },
  {
    version: "0.0.36",
    date: "2026-04-19",
    changes: [
      "Embeds : pour chaque message du modèle, tu peux indiquer un nom et une photo dédiés dans la section Profil ; sinon l’aperçu garde le nom et la photo du bot comme avant.",
    ],
  },
  {
    version: "0.0.35",
    date: "2026-04-19",
    changes: [
      "Embeds : dans l’aperçu, les boutons et les menus se comportent comme dans Discord (clic, liste déroulante, lien qui ouvre un onglet).",
    ],
  },
  {
    version: "0.0.34",
    date: "2026-04-19",
    changes: [
      "Embeds : les actions (monter, dupliquer, supprimer…) pour Message, Embed et Composants sont dans la ligne de titre et apparaissent au survol — plus de titre en double.",
      "Embeds : après un clic sur une action, la barre ne reste plus affichée sans survol (correction du focus).",
    ],
  },
  {
    version: "0.0.33",
    date: "2026-04-19",
    changes: [
      "Embeds : tu peux définir jusqu’à 10 messages dans un modèle ; chaque message a ses embeds et plusieurs groupes « Composants 1, 2… » (comme les embeds), avec un compteur global 5 lignes max par message Discord.",
    ],
  },
  {
    version: "0.0.32",
    date: "2026-04-19",
    changes: [
      "Embeds : la section « Message » regroupe tout le contenu du message (texte, embeds, composants) pour le replier d’un coup ; correction du changement entre bouton et bouton lien.",
    ],
  },
  {
    version: "0.0.31",
    date: "2026-04-19",
    changes: [
      "Embeds : tu peux ajouter jusqu’à 5 lignes sous le message, avec boutons, liens, ou menus (liste, membres, rôles, salons…), comme sur Discohook — avec aperçu.",
    ],
  },
  {
    version: "0.0.30",
    date: "2026-04-19",
    changes: [
      "Embeds : éditeur en sections comme sur Discohook (message, fil, profil, plusieurs embeds, boutons à venir), texte au-dessus des embeds, jusqu’à 10 embeds par modèle.",
    ],
  },
  {
    version: "0.0.29",
    date: "2026-04-19",
    changes: [
      "Embeds : l’aperçu affiche une vraie ligne de message avec la photo et le nom du bot (comme dans Discord), quand le bot est sur le serveur.",
    ],
  },
  {
    version: "0.0.28",
    date: "2026-04-19",
    changes: [
      "Embeds : aperçu plus proche de Discord (couleurs, texte), mise en forme du type gras ou code, et insertion de salons / rôles quand le bot est présent.",
    ],
  },
  {
    version: "0.0.27",
    date: "2026-04-19",
    changes: [
      "Page Embeds : tu peux créer, modifier et supprimer des modèles de messages enrichis, avec aperçu comme sur Discord.",
    ],
  },
  {
    version: "0.0.26",
    date: "2026-04-19",
    changes: [
      "Vue d’ensemble : le titre de la carte d’apparence affiche « Apparence du bot » (sans répéter « sur ce serveur »).",
    ],
  },
  {
    version: "0.0.25",
    date: "2026-04-19",
    changes: [
      "Apparence du bot : libellés « Nom », « Photo » et « Bannière » sans répéter « sur ce serveur » (déjà indiqué au-dessus).",
    ],
  },
  {
    version: "0.0.24",
    date: "2026-04-19",
    changes: [
      "Menu des serveurs : le nom (et l’icône) se mettent à jour comme sur Discord quand Vex est déjà sur le serveur — pense à rafraîchir la page après un renommage.",
    ],
  },
  {
    version: "0.0.23",
    date: "2026-04-19",
    changes: [
      "Vue d’ensemble : le titre de la carte des chiffres Vex affiche « Informations Bot ».",
    ],
  },
  {
    version: "0.0.22",
    date: "2026-04-19",
    changes: [
      "Vue d’ensemble : la carte d’activité Vex est alignée sur celle du serveur (même mise en page, grille des chiffres plus équilibrée).",
    ],
  },
  {
    version: "0.0.21",
    date: "2026-04-19",
    changes: [
      "Vue d’ensemble : sur grand écran, la carte d’activité Vex est à droite de celle du serveur Discord.",
    ],
  },
  {
    version: "0.0.20",
    date: "2026-04-19",
    changes: [
      "Vue d’ensemble : titre de la carte « activité » simplifié pour éviter la répétition avec un sous-titre.",
    ],
  },
  {
    version: "0.0.19",
    date: "2026-04-19",
    changes: [
      "Menu des serveurs : les serveurs où Vex est déjà prêt apparaissent en premier dans la liste.",
    ],
  },
  {
    version: "0.0.18",
    date: "2026-04-19",
    changes: [
      "Apparence du bot : le nom, la photo et la bannière affichent l’état actuel (serveur ou valeurs par défaut du bot).",
    ],
  },
  {
    version: "0.0.17",
    date: "2026-04-19",
    changes: ["Texte un peu plus court dans la section apparence du bot sur la vue d’ensemble."],
  },
  {
    version: "0.0.16",
    date: "2026-04-19",
    changes: [
      "Sur la vue d’ensemble : tu peux régler la photo, la bannière et le nom du bot uniquement sur le serveur choisi (si Discord le permet).",
    ],
  },
  {
    version: "0.0.15",
    date: "2026-04-19",
    changes: ["Petit texte d’aide au survol de la pastille « Prêt » ajusté."],
  },
  {
    version: "0.0.14",
    date: "2026-04-19",
    changes: [
      "Menu des serveurs : la pastille quand le bot est présent affiche « Prêt » au lieu de « Vex ».",
    ],
  },
  {
    version: "0.0.13",
    date: "2026-04-19",
    changes: [
      "Photos des serveurs dans le menu : affichage plus fiable (taille d’image adaptée à Discord).",
    ],
  },
  {
    version: "0.0.12",
    date: "2026-04-19",
    changes: [
      "Menu des serveurs : photo du serveur, liste déroulante plus lisible, pastille quand Vex est déjà présent.",
    ],
  },
  {
    version: "0.0.11",
    date: "2026-04-19",
    changes: [
      "Vue d’ensemble : infos regroupées par thème et petites icônes pour repérer chaque ligne plus vite.",
    ],
  },
  {
    version: "0.0.10",
    date: "2026-04-19",
    changes: [
      "Vue d’ensemble : libellés des salons un peu plus clairs, sans le total qui mélangeait tout.",
    ],
  },
  {
    version: "0.0.9",
    date: "2026-04-19",
    changes: [
      "La vue d’ensemble affiche mieux le nombre de membres et détaille les salons (catégories, texte, vocaux, forums).",
    ],
  },
  {
    version: "0.0.8",
    date: "2026-04-19",
    changes: [
      "La vue d’ensemble affiche des infos sur ton serveur et sur Vex quand c’est possible.",
    ],
  },
  {
    version: "0.0.7",
    date: "2026-04-19",
    changes: [
      "Tu peux choisir le serveur à configurer depuis le menu en haut, quand tu es connecté.",
    ],
  },
  {
    version: "0.0.6",
    date: "2026-04-19",
    changes: ["Quelques ajustements en coulisses pour préparer la suite."],
  },
  {
    version: "0.0.5",
    date: "2026-04-19",
    changes: [
      "Navigation entre les sections du panneau et écran de connexion quand c’est nécessaire.",
    ],
  },
  {
    version: "0.0.4",
    date: "2026-04-19",
    changes: ["Organisation de base du bot Discord (structure prête pour la suite)."],
  },
  {
    version: "0.0.3",
    date: "2026-04-19",
    changes: ["Fiabilisation du chargement des réglages côté service."],
  },
  {
    version: "0.0.2",
    date: "2026-04-19",
    changes: ["Préparation de la connexion Discord côté service (base technique)."],
  },
  {
    version: "0.0.1",
    date: "2026-04-19",
    changes: ["Mise en place du panneau et des couleurs de base."],
  },
];
