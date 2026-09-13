// backend/services/dataGouvNormaliser.js
//
// Adaptateur du jeu « avis-de-vacances-de-poste-avp-drhfpnc » de data.gouv.nc
// (DRHFPNC — fonction publique de Nouvelle-Calédonie).
//
// ══════════════════════════════════════════════════════════════════════════
//  CE FICHIER EST LA DÉMONSTRATION DE LA THÈSE D'ARCHITECTURE
// ══════════════════════════════════════════════════════════════════════════
// Ce jeu de données n'est PAS du schema.org : c'est un enregistrement plat, aux
// noms de champs propres à l'outil de gestion RH du territoire
// (`libelleposte`, `savoirfaire`, `activitesprincipales`…).
//
// Plutôt que d'apprendre cette forme au reste de l'application, on la TRADUIT
// en `schema.org/JobPosting` — le seul format que le cœur connaisse. Trois
// conséquences immédiates :
//
//   1. Le moteur de rapprochement, la rédaction des pièces et l'affichage
//      fonctionnent sur ces offres sans une ligne de code supplémentaire.
//   2. `GET /api/avps/:slug/jobposting` publie du JSON-LD valide pour un jeu de
//      données qui n'en produit pas. Nous ne faisons pas que consommer un
//      standard : nous en dotons une source qui en manquait.
//   3. Brancher un troisième employeur public revient à écrire un fichier
//      comme celui-ci. C'est l'argument d'essaimage, démontré et non affirmé.
//
// ⚠️ Ces enregistrements contiennent de VRAIES adresses de recrutement, dont
// des adresses nominatives d'agents (`contactemail`, `collectiviteemail`).
// Elles sont conservées dans `raw` — c'est la donnée publique, on ne l'altère
// pas — mais elles ne sont exposées par aucune vue, et l'envoi en mode test les
// refuse par domaine. Voir avpController et envoiService.

const DATASET = "avis-de-vacances-de-poste-avp-drhfpnc";
const BASE = "https://data.gouv.nc/api/records/1.0/search/";

const texte = (v) => {
  const t = typeof v === "string" ? v.trim() : "";
  return t || null;
};

// Les champs longs sont des listes à puces dans un seul bloc de texte, une
// puce par ligne. On les rend au format liste attendu par schema.org.
//
// Le découpage se fait sur les SAUTS DE LIGNE, pas sur les tirets : plusieurs
// puces contiennent elles-mêmes des traits d'union (« sous-direction »,
// « mi-temps »), et découper dessus coupait les phrases en morceaux.
const puces = (v) => {
  if (typeof v !== "string" || !v.trim()) return [];

  return v
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-–—•*]\s*/, "").trim())
    // Une puce réduite à une ponctuation résiduelle n'apporte rien et
    // encombrerait le rapprochement.
    .filter((l) => l.length > 2)
    .map((l) => l.replace(/\s*[;,]\s*$/, ""));
};

const date = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

// « K1402-1 » → code ROME « K1402 ».
//
// Le suffixe désigne une déclinaison interne au référentiel calédonien ; le
// code ROME de France Travail, lui, fait cinq caractères. On garde les deux :
// le code normalisé pour rapprocher, l'original dans `raw` pour tracer.
const codeRome = (v) => {
  const trouve = String(v || "").match(/^([A-Z]\d{4})/);
  return trouve ? trouve[1] : null;
};

/**
 * Traduit un enregistrement DRHFPNC en schema.org/JobPosting.
 *
 * La sortie traverse ensuite `normaliserAvp()` comme n'importe quelle offre :
 * il n'existe qu'un seul chemin d'entrée dans la base.
 */
export const versJobPosting = (fields) => {
  if (!fields || !texte(fields.libelleposte)) return null;

  // `numero` (« 26-63594/MPRH ») est l'identifiant public imprimé sur l'avis.
  // On se rabat sur l'identifiant technique quand il manque, préfixé pour ne
  // jamais entrer en collision avec une référence OPT-NC.
  const identifier = texte(fields.numero) || `drhfpnc-${fields.id}`;

  // Missions : les activités principales portent le poste, les secondaires le
  // complètent. Les deux sont des `responsibilities` au sens de schema.org.
  const responsibilities = [
    ...puces(fields.activitesprincipales),
    ...puces(fields.activitessecondaires),
  ];

  // Conditions d'exercice, rassemblées : la durée de résidence exigée est une
  // condition d'accès aux emplois publics calédoniens, elle a sa place ici.
  const qualifications = [
    texte(fields.conditionsparticulieres),
    fields.dureeresidenceexigee
      ? `Durée de résidence exigée : ${fields.dureeresidenceexigee}.`
      : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",

    identifier,
    title: texte(fields.libelleposte),
    description: texte(fields.presentation) || texte(fields.mission) || "",

    hiringOrganization: {
      "@type": "Organization",
      name: texte(fields.libellecollectivite) || "Nouvelle-Calédonie",
    },

    employmentUnit: {
      "@type": "Organization",
      name: texte(fields.libelleservice) || texte(fields.libelledirection),
    },

    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: texte(fields.lieutravail),
        addressCountry: "NC",
      },
    },

    // `additionalType` porte chez l'OPT-NC le jargon administratif : direction
    // et corps/grade. On respecte la même convention, c'est ce que lit le
    // normaliseur commun — et c'est cette matière que l'on devra traduire en
    // langage clair.
    additionalType: {
      direction: texte(fields.libelledirection),
      corpsDomaine: texte(fields.libellecorpsgrade),
      acronymeDirection: texte(fields.acronymedirection),
    },

    responsibilities,

    // savoir → ce qu'il faut connaître ; savoir-faire et savoir-être → ce qu'il
    // faut savoir faire. Le référentiel métiers distingue les trois ; le
    // rapprochement lit les deux listes.
    educationRequirements: {
      "@type": "EducationalOccupationalCredential",
      competencyRequired: puces(fields.savoir),
    },
    skills: [...puces(fields.savoirfaire), ...puces(fields.comportements)],

    qualifications: qualifications || null,

    relevantOccupation: {
      "@type": "Occupation",
      name: texte(fields.libelleemploirome) || texte(fields.emploiresp),
      occupationalCategory: {
        "@type": "CategoryCode",
        codeValue: codeRome(fields.codeemploirome),
        name: texte(fields.libelleemploirome),
      },
    },

    totalJobOpenings:
      typeof fields.nbposteapourvoir === "number"
        ? fields.nbposteapourvoir
        : null,

    datePosted: date(fields.datemiseenligne) || date(fields.datecreation),
    validThrough: date(fields.datecloture),
    jobStartDate: date(fields.dateapourvoir),

    // ⚠️ Adresses réelles. Conservées par fidélité à la source publique, et
    // parce que le mode production en a besoin. Aucune vue ne les expose.
    applicationContact: {
      "@type": "ContactPoint",
      name: texte(fields.contact),
      email: texte(fields.contactemail) || texte(fields.collectiviteemail),
    },

    // Trace de provenance : indispensable le jour où deux sources décrivent le
    // même poste, et pour savoir quel adaptateur a produit ce document.
    sourceOrigine: {
      portail: "data.gouv.nc",
      dataset: DATASET,
      idSource: fields.id,
      codeEmploiRomeOriginal: texte(fields.codeemploirome),
      statut: texte(fields.statut),
    },
  };
};

/**
 * Télécharge les offres du portail, page par page.
 *
 * `statut` vaut PUBLIE par défaut : ce sont les seules auxquelles on peut
 * réellement candidater. Les closes (plus de 19 000) ne sont chargées que sur
 * demande explicite — elles servent de corpus d'évaluation, pas d'offres.
 */
export const telechargerDataGouv = async ({
  statut = "PUBLIE",
  maximum = 1000,
} = {}) => {
  const PAR_PAGE = 100;
  const offres = [];

  for (let debut = 0; debut < maximum; debut += PAR_PAGE) {
    const url =
      `${BASE}?dataset=${DATASET}` +
      `&rows=${Math.min(PAR_PAGE, maximum - debut)}&start=${debut}` +
      (statut ? `&refine.statut=${statut}` : "");

    const reponse = await fetch(url, { redirect: "follow" });

    if (!reponse.ok) {
      throw new Error(
        `data.gouv.nc : téléchargement impossible (HTTP ${reponse.status} ${reponse.statusText}).`,
      );
    }

    const page = await reponse.json();
    const enregistrements = page.records || [];

    offres.push(...enregistrements.map((r) => r.fields));

    // Dernière page atteinte : inutile de demander la suivante.
    if (enregistrements.length < PAR_PAGE) break;
    if (offres.length >= (page.nhits || 0)) break;
  }

  return offres;
};
