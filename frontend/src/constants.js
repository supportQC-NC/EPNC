// src/constants.js

// Nom complet, utilisé dans les titres de page et les emails.
export const APP_NAME = "Emploi Public NC";
// Forme courte : sigle affiché dans le logo et partout où la place manque
// (en-tête sur téléphone, onglets, pièces jointes).
export const APP_NAME_COURT = "EPNC";

// BASE_URL vide = chemins relatifs. En développement, le proxy CRA
// (src/setupProxy.js) relaie /api vers le backend ; en production, Express sert
// le build et l'API depuis la même origine. Dans les deux cas, une seule
// origine : le cookie JWT sameSite=strict passe sans réglage particulier.
export const BASE_URL = "";

export const USERS_URL = "/api/users";
export const AVPS_URL = "/api/avps";
export const ADMIN_URL = "/api/admin";
export const PROFIL_URL = "/api/profil";
export const ASSISTANT_URL = "/api/assistant";
export const MATCHS_URL = "/api/matchs";
export const METIERS_URL = "/api/metiers";

// Questions proposées au démarrage. Elles ne servent pas qu'à dépanner celui
// qui ne sait pas quoi écrire : elles annoncent le PÉRIMÈTRE de l'assistant.
// Sans elles, la première question porte une fois sur deux sur autre chose, et
// le refus donne l'impression d'un outil cassé.
export const SUGGESTIONS = [
  "Quels postes ouverts correspondent à mon profil ?",
  "Que manque-t-il à mon profil pour être crédible ?",
  "Comment se préparer à un concours de la fonction publique en Nouvelle-Calédonie ?",
  "Par quoi commencer pour monter en compétence sur ce métier ?",
];
export const CANDIDATURES_URL = "/api/candidatures";

// Statuts d'une candidature, dans l'ordre du parcours. La liste technique vit
// dans CandidatureModel côté serveur ; ici on ne fait qu'y attacher des
// libellés et une explication — un statut brut comme « sans_reponse » n'a rien
// à faire à l'écran.
export const STATUTS = [
  {
    valeur: "brouillon",
    libelle: "Brouillon",
    aide: "Vous préparez encore vos pièces.",
  },
  {
    valeur: "prete",
    libelle: "Prête à envoyer",
    aide: "Vos pièces sont relues, il ne reste qu'à les transmettre.",
  },
  {
    valeur: "envoyee",
    libelle: "Envoyée",
    aide: "Transmise à l'employeur, en attente de retour.",
  },
  {
    valeur: "entretien",
    libelle: "Entretien",
    aide: "Vous avez été convoqué.",
  },
  { valeur: "acceptee", libelle: "Retenue", aide: "C'est oui." },
  { valeur: "refusee", libelle: "Non retenue", aide: "La réponse est négative." },
  {
    valeur: "sans_reponse",
    libelle: "Sans réponse",
    aide: "Le délai est passé sans retour.",
  },
];

export const statut = (valeur) =>
  STATUTS.find((s) => s.valeur === valeur) || {
    valeur,
    libelle: valeur,
    aide: "",
  };

// Les quatre pièces, avec leur destinataire. Cette distinction est le cœur du
// dossier : deux pièces partent chez l'employeur, deux restent au candidat.
export const PIECES = [
  {
    cle: "lettre",
    libelle: "Lettre de candidature",
    pour: "employeur",
    aide: "Une page, centrée sur ce poste précis.",
  },
  {
    cle: "cv",
    libelle: "CV recentré",
    pour: "employeur",
    aide: "Votre parcours réordonné selon les attendus de l'offre.",
  },
  {
    cle: "restitution",
    libelle: "Analyse de votre candidature",
    pour: "vous",
    aide: "Vos points forts, vos écarts, et quoi en faire.",
  },
  {
    cle: "preparation",
    libelle: "Préparation à l'entretien",
    pour: "vous",
    aide: "Les questions probables et vos réponses possibles.",
  },
];

// Libellés des rôles. Le backend manipule les clés techniques, l'interface
// n'affiche jamais que ces libellés — « candidat » au singulier masculin dans
// un tableau de comptes n'est pas une étiquette acceptable.
export const ROLES = [
  { valeur: "candidat", libelle: "Candidat" },
  { valeur: "recruteur", libelle: "Recruteur" },
  { valeur: "admin", libelle: "Administrateur" },
];

export const libelleRole = (valeur) =>
  ROLES.find((r) => r.valeur === valeur)?.libelle || valeur;

// Photo de fond du hero. Déposer le fichier dans `public/images/` et n'ajuster
// que cette ligne pour en changer le nom ou le format.
//
// ⚠️ Pourquoi ici et pas dans le CSS : webpack RÉSOUT les `url()` écrites dans
// une feuille de style au moment de la compilation. Un fichier absent n'y
// produit pas un fond vide mais une erreur de module — l'application entière
// ne démarre plus. Appliquée en style en ligne depuis React, l'URL n'est pas
// résolue : si le fichier manque, le navigateur n'affiche simplement pas
// d'image et le hero garde sa couleur de repli.
export const HERO_PHOTO = "/images/bg_hero.jpg";
