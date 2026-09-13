// src/utils/format.js

// Libellés des types de contrat schema.org. La donnée sort en anglais
// technique (FULL_TIME) : l'afficher tel quel à un candidat calédonien serait
// exactement le travers que ce projet cherche à corriger.
const CONTRATS = {
  FULL_TIME: "Temps plein",
  PART_TIME: "Temps partiel",
  CONTRACTOR: "Prestation",
  TEMPORARY: "Temporaire",
  INTERN: "Stage",
  VOLUNTEER: "Bénévolat",
  PER_DIEM: "Vacation",
  OTHER: "Autre",
};

export const libelleContrat = (valeur) => {
  if (!valeur) return null;
  return CONTRATS[valeur] || valeur;
};

const formateurDate = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export const formaterDate = (valeur) => {
  if (!valeur) return null;
  const d = new Date(valeur);
  return Number.isNaN(d.getTime()) ? null : formateurDate.format(d);
};

const formateurCourt = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

// Format compact pour les tableaux : « 12/09/2026 ». Dans une colonne, la
// forme longue (« 12 septembre 2026 ») fait exploser la largeur et se lit
// moins vite qu'elle ne se compare.
export const formaterDateCourte = (valeur) => {
  if (!valeur) return null;
  const d = new Date(valeur);
  return Number.isNaN(d.getTime()) ? null : formateurCourt.format(d);
};

// Valeur pour l'attribut `dateTime` de <time> : format machine, indépendant de
// la langue. C'est ce que lisent les moteurs et les technologies d'assistance.
export const dateIso = (valeur) => {
  if (!valeur) return undefined;
  const d = new Date(valeur);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
};

// Message d'échéance lisible : « Clôturée » ou « Plus que N jours ».
// En deçà, l'échéance cesse d'être une information et devient une urgence.
//
// Sept jours parce que c'est le délai en dessous duquel on ne peut plus
// « y revenir la semaine prochaine » : préparer un dossier demande de relire
// une lettre et un CV, pas dix minutes.
export const URGENCE_JOURS = 7;

// Jours restants avant une date limite, ou `null` si la date est absente ou
// illisible.
//
// ⚠️ Comparaison au JOUR, pas à l'heure. Sur une différence brute en
// millisecondes, une offre qui ferme demain à minuit affiche « 0 jour » dès
// qu'il est 15 h — et « dernier jour » au lieu de « demain » avance l'échéance
// d'une journée dans la tête de la personne.
//
// Cette fonction vivait aussi, recopiée, dans `EspaceScreen`. Deux calculs
// d'échéance finissent par ne plus dire la même chose le jour où l'un des deux
// est ajusté, et l'espace candidat annoncerait alors une autre date que la
// liste des offres.
export const joursAvant = (dateLimite) => {
  if (!dateLimite) return null;
  const fin = new Date(dateLimite);
  if (Number.isNaN(fin.getTime())) return null;

  fin.setHours(23, 59, 59, 999);
  return Math.ceil((fin.getTime() - Date.now()) / 86400000);
};

export const echeance = (dateLimite) => {
  const jours = joursAvant(dateLimite);
  if (jours === null) return null;

  if (jours < 0) return "Candidatures closes";
  if (jours === 0) return "Dernier jour";
  if (jours === 1) return "Plus qu'un jour";
  return `Plus que ${jours} jours`;
};
