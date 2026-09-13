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
      email: user.email,
      phone: profil.basics?.telephone,
      summary: profil.basics?.accroche,
      location: {
        city: profil.basics?.ville,
        region: profil.basics?.province,
        countryCode: "NC",
      },
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
