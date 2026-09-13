// backend/services/avpNormaliser.js
//
// Traduit un JobPosting schema.org de l'OPT-NC vers les champs de premier
// niveau du modèle Avp. Isolé dans un service pour une raison précise : le jour
// où l'on branche une autre source (data.gouv.nc, un autre employeur public,
// n'importe quel site publiant du JSON-LD), c'est le SEUL fichier à écrire.
// Le reste de l'application ne connaît que la forme normalisée.

// Les champs schema.org sont parfois un objet, parfois une liste, parfois
// absents. Ces aides évitent d'écrire la même défense partout.
const texte = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);

const liste = (v) => {
  if (Array.isArray(v)) return v.filter((x) => typeof x === "string" && x.trim());
  if (typeof v === "string" && v.trim()) return [v.trim()];
  return [];
};

const date = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

// "3134-26-1264/SR" → "3134-26-1264-sr"
// Les identifiants OPT contiennent une barre oblique : telle quelle, elle
// couperait le chemin de l'URL en deux segments.
export const slugifier = (idAvp) =>
  String(idAvp)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const normaliserAvp = (raw) => {
  const idAvp = texte(raw.id_avp) || texte(raw.identifier);
  if (!idAvp) return null; // ligne inexploitable : on la saute plutôt que de créer un document bancal

  const additional = raw.additionalType || {};
  const occupation = raw.relevantOccupation || {};
  const categorieRome = occupation.occupationalCategory || {};
  const lieu = raw.jobLocation?.address?.addressLocality || null;

  return {
    idAvp,
    slug: slugifier(idAvp),

    intitule: texte(raw.title) || texte(raw.name) || "Poste sans intitulé",
    description: texte(raw.description) || "",
    direction: texte(additional.direction),
    corpsDomaine: texte(additional.corpsDomaine),
    service: texte(raw.employmentUnit?.name),
    lieu: texte(lieu),
    familles: liste(raw.occupationalCategory),

    metier: {
      nom: texte(occupation.name),
      code: texte(occupation.code_metier),
      ficheUrl: texte(occupation.fiche_metier_url),
      rome: texte(categorieRome.codeValue),
      romeLibelle: texte(categorieRome.name),
    },

    typeContrat: texte(raw.employmentType),
    nbPostes:
      typeof raw.totalJobOpenings === "number" ? raw.totalJobOpenings : null,
    datePubliee: date(raw.datePosted),
    dateLimite: date(raw.validThrough),

    missions: liste(raw.responsibilities),
    competencesAttendues: liste(raw.educationRequirements?.competencyRequired),
    savoirFaire: liste(raw.skills),
    experienceRequise: texte(raw.experienceRequirements),
    qualifications: texte(raw.qualifications),
    contraintePhysique: texte(raw.physicalRequirement),
    experienceRemplaceDiplome: raw.experienceInPlaceOfEducation === true,

    md5Source: texte(raw.md5_hash),
    raw,
  };
};
