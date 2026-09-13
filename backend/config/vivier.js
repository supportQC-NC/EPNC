// backend/config/vivier.js
//
// Ce qu'un recruteur voit d'un profil rendu visible — la liste exacte, et la
// seule source de cette liste.
//
// ══════════════════════════════════════════════════════════════════════════
//  POURQUOI CETTE LISTE EXISTE, ET POURQUOI ELLE VIT ICI
// ══════════════════════════════════════════════════════════════════════════
// Jusqu'ici, la case « rendre mon profil consultable » était accompagnée d'une
// phrase : « les recruteurs voient votre parcours, vos compétences et vos
// coordonnées ». C'est vrai, mais c'est incomplet — et l'incomplet, sur un
// partage de données personnelles, se lit comme un mensonge par omission le
// jour où quelqu'un découvre le reste.
//
// Ce qui manquait à cette phrase, vérifié dans `recruteurController.js` :
//
//   · la PHOTO apparaît dès la liste de recherche, pas seulement sur la fiche ;
//   · le CV COMPLET se télécharge en PDF (`GET /candidats/:id/cv`) ;
//   · le profil s'exporte aussi en JSON Resume (`/candidats/:id/resume.json`) ;
//   · le profil est RAPPROCHÉ des postes ouverts du recruteur, avec le détail
//     des écarts — c'est-à-dire, littéralement, ce qui manque à la personne.
//
// Personne ne peut consentir à ce qu'on ne lui a pas dit. La liste est donc
// écrite en toutes lettres, dans l'ordre de ce que le recruteur obtient sans
// effort d'abord, et servie à l'écran telle quelle.
//
// ⚠️ CETTE LISTE DÉCRIT LE CODE, ELLE NE LE CONTRAINT PAS. Si un jour une
// route recruteur expose autre chose, c'est ici qu'il faut l'ajouter — et
// changer VERSION, sans quoi les consentements déjà donnés porteront sur un
// texte qui ne décrit plus le service.

// Version du texte de consentement.
//
// Format : année-mois de la rédaction. Elle est stockée avec le consentement
// (`Profil.consentementVivier.version`). Quand elle change, les personnes qui
// avaient accepté l'ancienne rédaction sont signalées à l'écran et invitées à
// reconfirmer — leur profil n'est PAS masqué d'office : les faire disparaître
// d'un vivier sans qu'elles aient rien demandé serait une décision prise à
// leur place, et l'inverse de ce que cette page défend.
export const VERSION_CONSENTEMENT_VIVIER = "2026-09";

// Ce qui est visible dès la LISTE de recherche, sans ouvrir la fiche.
// Source : `recruteurController.carte()`.
export const VIVIER_LISTE = [
  "Votre prénom, votre nom et votre photo si vous en avez mis une",
  "Votre titre, votre accroche, votre ville et votre province",
  "Vos six premières compétences, avec leur niveau",
  "Votre poste actuel ou le plus récent",
  "Vos langues, vos permis, votre disponibilité et votre mobilité",
];

// Ce qui sort UNIQUEMENT quand le recruteur ouvre la fiche détaillée.
// Source : `recruteurController.getCandidat()` et les routes de pièces.
export const VIVIER_FICHE = [
  "Votre adresse électronique, votre téléphone et votre adresse postale",
  "Vos expériences et vos formations, en entier",
  "Toutes vos compétences, vos langues, vos centres d'intérêt",
  "Ce que vous cherchez, vos contraintes et vos liens",
  "Votre CV complet, téléchargeable en PDF",
  "Votre profil au format JSON Resume, téléchargeable",
];

// Ce que le recruteur peut FAIRE de ce profil, au-delà de le lire.
export const VIVIER_USAGES = [
  "Vous rapprocher de ses postes ouverts, avec le détail de ce qui correspond et de ce qui manque",
  "Vous mettre de côté dans une liste nommée, qu'il est seul à voir",
  "Vous contacter à propos d'un poste — et pour rien d'autre",
];

// Ce qui NE sort JAMAIS, quoi qu'il arrive. Le dire est aussi utile que le
// reste : c'est ce qui distingue un vivier d'un fichier revendu.
export const VIVIER_JAMAIS = [
  "Vos candidatures, vos lettres et vos brouillons : ils ne sortent que si vous les envoyez vous-même",
  "Vos coordonnées dans une liste de résultats — il faut ouvrir votre fiche, et c'est un geste",
  "Quoi que ce soit à un recruteur non vérifié : chaque accès est instruit un par un par un administrateur",
];

// Bloc unique servi à l'interface et aux pages légales : une seule rédaction,
// un seul endroit à corriger.
export const CONSENTEMENT_VIVIER = {
  version: VERSION_CONSENTEMENT_VIVIER,
  liste: VIVIER_LISTE,
  fiche: VIVIER_FICHE,
  usages: VIVIER_USAGES,
  jamais: VIVIER_JAMAIS,
};
