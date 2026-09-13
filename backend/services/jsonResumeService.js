// backend/services/jsonResumeService.js
//
// Export du profil au format JSON Resume (jsonresume.org).
//
// POURQUOI : c'est la contrepartie, côté candidat, de schema.org/JobPosting
// côté offre. Le profil que quelqu'un a saisi ici lui appartient ; il doit
// pouvoir le reprendre ailleurs — autre plateforme, ATS, générateur de CV —
// sans ressaisie. Une plateforme qui retient les données de ses utilisateurs
// par le format est une plateforme qu'on ne quitte pas : ce n'est pas ce qu'on
// construit.
//
// L'export est « ciblé » : le bloc `meta` indique l'offre pour laquelle il a
// été produit et pointe vers le JobPosting source. Un consommateur tiers sait
// donc à quoi ce CV répond, sans avoir à le deviner.

// Les dates du profil sont en texte libre (« 2019 », « mars 2021 ») — un
// candidat ne se souvient pas du jour exact. JSON Resume accepte une date
// partielle réduite à l'année ; on n'émet donc le champ que si l'on sait lire
// une année, et on ne l'invente jamais.
const annee = (texte) => {
  const trouve = String(texte || "").match(/\b(19|20)\d{2}\b/);
  return trouve ? trouve[0] : undefined;
};

const NIVEAUX_COMPETENCE = {
  notions: "Notions",
  pratique: "Pratique",
  maitrise: "Maîtrise",
  expert: "Expert",
};

const NIVEAUX_LANGUE = {
  notions: "Notions",
  courant: "Courant",
  bilingue: "Bilingue",
  maternelle: "Langue maternelle",
};

// Retire les clés vides : un JSON Resume truffé de `""` et de `null` passe mal
// les validateurs et se lit mal. Absent vaut mieux que vide.
const propre = (objet) => {
  if (Array.isArray(objet)) {
    const liste = objet.map(propre).filter((v) => v !== undefined);
    return liste.length ? liste : undefined;
  }

  if (objet && typeof objet === "object") {
    const sortie = {};
    for (const [cle, valeur] of Object.entries(objet)) {
      const v = propre(valeur);
      if (v !== undefined) sortie[cle] = v;
    }
    return Object.keys(sortie).length ? sortie : undefined;
  }

  if (objet === "" || objet === null) return undefined;
  return objet;
};

/**
 * Construit le JSON Resume d'un profil.
 * `avp` est optionnel : sans lui, l'export est générique ; avec lui, `meta`
 * indique la cible.
 */
export const versJsonResume = (profil, user, avp = null) => {
  const resume = {
    $schema:
      "https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json",

    basics: {
      name: `${user.prenom} ${user.nom}`.trim(),
      // `label` est le champ prevu par le standard pour l'intitule que la
      // personne se donne. C'est la premiere ligne que lit un recruteur.
      label: profil.basics?.titre,
      // `image` accepte une URL ou une donnee encodee. On y met la vignette
      // telle qu'elle est stockee : l'export reste autonome, sans dependre
      // d'un serveur d'images qui pourrait disparaitre.
      image: profil.basics?.photo || undefined,
      email: user.email,
      phone: profil.basics?.telephone,
      summary: profil.basics?.accroche,
      location: {
        address: profil.basics?.adresse,
        postalCode: profil.basics?.codePostal,
        city: profil.basics?.ville,
        region: profil.basics?.province,
        countryCode: "NC",
      },
      profiles: (profil.basics?.liens || []).map((l) => ({
        network: l.reseau,
        url: l.url,
      })),
    },

    work: (profil.experiences || []).map((e) => ({
      name: e.employeur,
      position: e.poste,
      location: e.lieu,
      startDate: annee(e.debut),
      // Une expérience en cours n'a pas de date de fin : l'omettre est la
      // façon dont JSON Resume l'exprime.
      endDate: e.enCours ? undefined : annee(e.fin),
      summary: e.description,
      highlights: e.realisations,
    })),

    education: (profil.formations || []).map((f) => ({
      institution: f.etablissement,
      studyType: f.niveau,
      area: f.intitule,
      endDate: f.enCours ? undefined : annee(f.annee),
    })),

    skills: (profil.competences || []).map((c) => ({
      name: c.nom,
      level: NIVEAUX_COMPETENCE[c.niveau] || c.niveau,
    })),

    languages: (profil.langues || []).map((l) => ({
      language: l.nom,
      fluency: NIVEAUX_LANGUE[l.niveau] || l.niveau,
    })),

    interests: (profil.interets || []).map((i) => ({
      name: i.nom,
      keywords: i.motsCles,
    })),

    meta: {
      // `canonical` et `version` font partie du standard ; le reste est une
      // extension assumée, tolérée par le schéma et utile à qui reçoit.
      version: "v1.0.0",
      lastModified: (profil.updatedAt || new Date()).toISOString(),
      producteur: "Emploi Public NC",
      ...(avp
        ? {
            cible: {
              intitule: avp.intitule,
              reference: avp.idAvp,
              employeur: avp.direction,
              jobPosting: `/api/avps/${avp.slug}/jobposting`,
            },
          }
        : {}),
    },
  };

  // Les aspirations n'ont pas d'équivalent normalisé : elles vont dans `meta`
  // plutôt que d'être forcées dans un champ qui ne veut pas dire ça.
  const aspirations = propre({
    projet: profil.aspirations?.projet,
    famillesVisees: profil.aspirations?.famillesVisees,
    typesContrat: profil.aspirations?.typesContrat,
    disponibilite: profil.contraintes?.disponibilite,
    mobilite: profil.contraintes?.mobilite,
    permis: profil.basics?.permis,
  });

  if (aspirations) resume.meta.recherche = aspirations;

  return propre(resume);
};

// ══════════════════════════════════════════════════════════════════════════
//  LE SENS INVERSE : JSON Resume → profil
// ══════════════════════════════════════════════════════════════════════════
//
// POURQUOI ici, et pas dans un fichier à part : les deux directions doivent se
// lire l'une sous l'autre. Un champ ajouté à l'export et oublié à l'import
// (ou l'inverse) devient une perte de données silencieuse ; côte à côte,
// l'oubli se voit à la relecture.
//
// Deux usages, un seul code :
//   1. un candidat importe son JSON Resume au lieu de tout ressaisir — le
//      règlement insiste sur le candidat *sans* CV, et ressaisir un parcours
//      est précisément ce qui décourage ;
//   2. un ATS nous envoie un candidat pour le confronter aux offres
//      (`POST /api/integration/rapprochement`). Il ne connaît pas nos champs,
//      il connaît JSON Resume.
//
// 🔴 RIEN N'EST INVENTÉ. Ce qui ne se rattache à aucun champ n'est pas deviné :
// il est REMONTÉ dans `ignores[]`. Un import qui « comprend » à moitié et
// complète le reste au jugé produit un CV que le candidat n'a pas écrit — et
// c'est sa signature qui sera dessous.

// Tables inverses des libellés d'export. Construites à partir des tables
// directes plutôt que réécrites : deux listes jumelles finissent toujours par
// diverger.
const inverse = (table) =>
  Object.fromEntries(
    Object.entries(table).map(([cle, libelle]) => [libelle.toLowerCase(), cle]),
  );

const CLES_COMPETENCE = inverse(NIVEAUX_COMPETENCE);
const CLES_LANGUE = inverse(NIVEAUX_LANGUE);

// JSON Resume laisse `level` et `fluency` en texte libre : on y trouve nos
// propres libellés, mais aussi « Advanced », « B2 », « courant ». On reconnaît
// ce qu'on sait reconnaître et, à défaut, on prend le niveau MÉDIAN plutôt que
// le plus haut — surévaluer un niveau déclaré fausse le rapprochement dans le
// sens qui trompe le candidat.
const niveauCompetence = (texte) => {
  const t = String(texte || "").trim().toLowerCase();
  if (!t) return "pratique";
  if (CLES_COMPETENCE[t]) return CLES_COMPETENCE[t];
  // « Expert » et « Master » seulement : « Advanced » se range un cran en
  // dessous. Dans l'usage courant de JSON Resume, l'échelle monte
  // Beginner → Intermediate → Advanced → Expert ; traduire « Advanced » par
  // notre plus haut niveau surévaluerait la personne, ce qui est précisément
  // le sens d'erreur qui la trompe (elle se voit proposer un poste hors de
  // portée, et l'apprend à l'entretien).
  if (/\bexpert\b|\bmaster\b/.test(t)) return "expert";
  if (/ma[îi]tris|confirm|proficient|avanc|advanced/.test(t)) return "maitrise";
  if (/notion|d[ée]butant|beginner|basic|novice/.test(t)) return "notions";
  return "pratique";
};

const niveauLangue = (texte) => {
  const t = String(texte || "").trim().toLowerCase();
  if (!t) return "notions";
  if (CLES_LANGUE[t]) return CLES_LANGUE[t];
  if (/maternell|native|c2/.test(t)) return "maternelle";
  if (/bilingue|bilingual|c1/.test(t)) return "bilingue";
  if (/courant|fluent|b2|b1|professionnel/.test(t)) return "courant";
  return "notions";
};

// Les provinces sont une énumération fermée côté modèle : une valeur hors
// liste ferait échouer la validation Mongoose à l'enregistrement, c'est-à-dire
// APRÈS que la personne a cru son import réussi.
const PROVINCES = [
  "Province Sud",
  "Province Nord",
  "Province des îles Loyauté",
  "Hors territoire",
];

const province = (region) => {
  const t = String(region || "").trim().toLowerCase();
  if (!t) return "";
  const trouve = PROVINCES.find((p) => p.toLowerCase() === t);
  if (trouve) return trouve;
  if (/sud|south/.test(t)) return "Province Sud";
  if (/nord|north/.test(t)) return "Province Nord";
  if (/[îi]les|loyaut/.test(t)) return "Province des îles Loyauté";
  return "";
};

const chaine = (v) => (typeof v === "string" ? v.trim() : "");

// `highlights`, `keywords` : le standard les veut en tableau de chaînes, la
// réalité livre parfois une chaîne unique ou des objets.
const tableauDeTextes = (v) => {
  if (Array.isArray(v)) {
    return v
      .map((x) => (typeof x === "string" ? x.trim() : chaine(x?.name)))
      .filter(Boolean);
  }
  const t = chaine(v);
  return t ? [t] : [];
};

/**
 * Traduit un document JSON Resume en profil.
 *
 * Retourne `{ profil, identite, ignores, avertissements }` :
 *   - `profil`      : objet à la forme de `ProfilModel`, directement utilisable
 *                     par `rapprocher()` sans passer par la base ;
 *   - `identite`    : nom et email, qui vivent sur le COMPTE et pas sur le
 *                     profil — l'appelant décide s'il s'en sert ;
 *   - `ignores`     : les sections non reprises, à montrer à l'utilisateur ;
 *   - `avertissements` : ce qui a été INTERPRÉTÉ et mérite une relecture.
 */
export const depuisJsonResume = (resume) => {
  if (!resume || typeof resume !== "object" || Array.isArray(resume)) {
    throw new Error(
      "Ce fichier n'est pas un document JSON Resume : un objet JSON était attendu.",
    );
  }

  const ignores = [];
  const avertissements = [];

  const b = resume.basics || {};
  const loc = b.location || {};

  // Sections du standard que nous ne stockons pas. Les taire donnerait
  // l'impression d'un import complet ; les nommer laisse la personne juger.
  for (const [cle, libelle] of [
    ["awards", "distinctions"],
    ["certificates", "certifications"],
    ["publications", "publications"],
    ["volunteer", "bénévolat"],
    ["references", "références"],
    ["projects", "projets"],
  ]) {
    if (Array.isArray(resume[cle]) && resume[cle].length > 0) {
      ignores.push(
        `${libelle} (${resume[cle].length}) — section « ${cle} » non reprise`,
      );
    }
  }

  const profil = {
    basics: {
      titre: chaine(b.label),
      // On ne rapatrie PAS `image` : une URL distante dans un champ affiché
      // partout est un traceur offert au serveur qui l'héberge, et une donnée
      // encodée peut peser plusieurs mégaoctets. La photo se choisit dans
      // l'écran de profil, où elle est redimensionnée.
      photo: "",
      telephone: chaine(b.phone),
      adresse: chaine(loc.address),
      codePostal: chaine(loc.postalCode),
      ville: chaine(loc.city),
      province: province(loc.region),
      accroche: chaine(b.summary),
      // Le permis n'existe pas dans le standard. Notre propre export le range
      // dans `meta.recherche` : on le relit là, et nulle part ailleurs.
      permis: tableauDeTextes(resume.meta?.recherche?.permis),
      liens: (Array.isArray(b.profiles) ? b.profiles : [])
        .map((p) => ({ reseau: chaine(p?.network), url: chaine(p?.url) }))
        .filter((l) => l.url),
    },

    experiences: (Array.isArray(resume.work) ? resume.work : []).map((e) => ({
      poste: chaine(e?.position),
      employeur: chaine(e?.name) || chaine(e?.company),
      lieu: chaine(e?.location),
      debut: chaine(e?.startDate),
      fin: chaine(e?.endDate),
      // Pas de date de fin = poste en cours. C'est la convention du standard,
      // et la seule lecture possible : « fin inconnue » ne s'en distingue pas.
      enCours: !chaine(e?.endDate),
      description: chaine(e?.summary),
      realisations: tableauDeTextes(e?.highlights),
    })),

    formations: (Array.isArray(resume.education) ? resume.education : []).map(
      (f) => ({
        intitule: chaine(f?.area),
        etablissement: chaine(f?.institution),
        niveau: chaine(f?.studyType),
        annee: chaine(f?.endDate),
        enCours: !chaine(f?.endDate),
      }),
    ),

    competences: (Array.isArray(resume.skills) ? resume.skills : []).flatMap(
      (c) => {
        const nom = chaine(c?.name);
        if (!nom) return [];
        // `keywords` porte souvent le détail réel (« JavaScript », « React »)
        // quand `name` n'est qu'une catégorie (« Développement »). On garde
        // les deux : perdre les mots-clés perdrait la matière du rapprochement.
        const motsCles = tableauDeTextes(c?.keywords);
        const niveau = niveauCompetence(c?.level);
        return [
          { nom, niveau },
          ...motsCles
            .filter((m) => m.toLowerCase() !== nom.toLowerCase())
            .map((m) => ({ nom: m, niveau })),
        ];
      },
    ),

    langues: (Array.isArray(resume.languages) ? resume.languages : []).map(
      (l) => ({ nom: chaine(l?.language), niveau: niveauLangue(l?.fluency) }),
    ),

    interets: (Array.isArray(resume.interests) ? resume.interests : []).map(
      (i) => ({ nom: chaine(i?.name), motsCles: tableauDeTextes(i?.keywords) }),
    ),

    aspirations: {
      famillesVisees: tableauDeTextes(resume.meta?.recherche?.famillesVisees),
      typesContrat: tableauDeTextes(resume.meta?.recherche?.typesContrat),
      projet: chaine(resume.meta?.recherche?.projet),
    },

    contraintes: {
      disponibilite: chaine(resume.meta?.recherche?.disponibilite),
      mobilite: chaine(resume.meta?.recherche?.mobilite),
    },
  };

  // Une entrée sans intitulé ne dit rien et encombrerait le CV.
  profil.experiences = profil.experiences.filter((e) => e.poste || e.employeur);
  profil.formations = profil.formations.filter(
    (f) => f.intitule || f.etablissement,
  );
  profil.competences = profil.competences.filter((c) => c.nom);
  profil.langues = profil.langues.filter((l) => l.nom);
  profil.interets = profil.interets.filter((i) => i.nom);

  // Avertissements : ce qui a été INTERPRÉTÉ, pas simplement recopié. C'est
  // exactement ce qu'une personne doit relire avant de valider son import.
  if (loc.region && !profil.basics.province) {
    avertissements.push(
      `La région « ${loc.region} » ne correspond à aucune province calédonienne : le champ est resté vide.`,
    );
  }

  const sansDate = profil.experiences.filter((e) => !e.debut).length;
  if (sansDate > 0) {
    avertissements.push(
      `${sansDate} expérience${sansDate > 1 ? "s n'ont" : " n'a"} pas de date de début : à compléter pour que l'ancienneté compte.`,
    );
  }

  if (!profil.basics.titre) {
    avertissements.push(
      "Aucun intitulé (basics.label) : c'est la première ligne que lit un recruteur, pensez à la renseigner.",
    );
  }

  const vide =
    profil.experiences.length === 0 &&
    profil.formations.length === 0 &&
    profil.competences.length === 0;

  if (vide) {
    throw new Error(
      "Ce document ne contient ni expérience, ni formation, ni compétence : il n'y a rien à importer.",
    );
  }

  return {
    profil,
    identite: { nom: chaine(b.name), email: chaine(b.email) },
    ignores,
    avertissements,
  };
};
