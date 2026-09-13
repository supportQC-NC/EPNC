// backend/controllers/recruteurController.js
//
// Le vivier, côté employeur.
//
// ══════════════════════════════════════════════════════════════════════════
//  DEUX RÈGLES QUI NE SE NÉGOCIENT PAS
// ══════════════════════════════════════════════════════════════════════════
// 1. Seuls les profils dont la personne a EXPLICITEMENT coché « visible par
//    les recruteurs » apparaissent ici. Le défaut est « non » : quelqu'un crée
//    un compte pour chercher un poste, pas pour figurer dans un annuaire
//    consultable par des employeurs.
// 2. Les coordonnées (email, téléphone, adresse) ne sortent QUE sur la fiche
//    détaillée, jamais dans la liste. Une liste qui les porterait se moissonne
//    en une requête ; il faut que consulter un profil soit un geste, pas un
//    effet de bord d'un chargement de page.
//
// Le règlement du hackathon demande un rapprochement BIDIRECTIONNEL : du
// profil vers les postes, et du poste vers le vivier. C'est cette seconde
// direction.

import asyncHandler from "../middleware/asyncHandler.js";
import Profil from "../models/ProfilModel.js";
import Avp from "../models/AvpModel.js";
import { rapprocher } from "../services/matchingService.js";
import { cvPdf } from "../services/cvPdfService.js";
import { versJsonResume } from "../services/jsonResumeService.js";

// Complétude en dessous de laquelle un profil n'est pas proposé.
//
// Ce n'est pas une brimade : un profil de trois lignes fait perdre son temps
// au recruteur ET dessert le candidat, qui apparaît vide à côté de parcours
// détaillés. Mieux vaut l'inviter à compléter que le montrer ainsi.
const COMPLETUDE_MINIMALE = 30;

const normaliser = (texte) =>
  (texte || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

// Carte de liste : ce qu'un recruteur a besoin de voir pour décider s'il
// ouvre la fiche. Volontairement SANS coordonnées (cf. règle 2).
const carte = (profil) => {
  const experiences = profil.experiences || [];

  return {
    id: profil._id,
    prenom: profil.user?.prenom || "",
    nom: profil.user?.nom || "",
    titre: profil.basics?.titre || "",
    photo: profil.basics?.photo || "",
    ville: profil.basics?.ville || "",
    province: profil.basics?.province || "",
    accroche: profil.basics?.accroche || "",
    // Les six premières compétences : au-delà, les cartes n'ont plus la même
    // hauteur et la liste devient illisible.
    competences: (profil.competences || []).slice(0, 6).map((c) => ({
      nom: c.nom,
      niveau: c.niveau,
    })),
    nbCompetences: (profil.competences || []).length,
    nbExperiences: experiences.length,
    // Poste actuel ou le plus récent : c'est le premier repère que cherche un
    // recruteur qui parcourt une liste.
    posteActuel:
      experiences.find((e) => e.enCours)?.poste || experiences[0]?.poste || "",
    langues: (profil.langues || []).map((l) => l.nom),
    permis: profil.basics?.permis || [],
    disponibilite: profil.contraintes?.disponibilite || "",
    mobilite: profil.contraintes?.mobilite || "",
    completude: profil.completude ? profil.completude() : null,
    majLe: profil.updatedAt,
  };
};

// @desc    Les profils consultables, filtrés
// @route   GET /api/recruteur/candidats
// @access  Privé / recruteur ou admin
//
// Filtres : `q` (texte libre), `competence`, `province`, `ville`,
// `disponibilite`. Ils se combinent — un recruteur cherche rarement sur un
// seul critère.
const listerCandidats = asyncHandler(async (req, res) => {
  const { q, competence, province, ville, permis } = req.query;

  const filtre = { visibleRecruteurs: true };

  // Les filtres exacts passent en base ; les filtres textuels sont appliqués
  // ensuite, en mémoire. Le vivier se compte en dizaines de profils : monter
  // un index de recherche plein texte pour cela serait exactement la
  // sur-ingénierie que le barème sanctionne.
  if (province) filtre["basics.province"] = province;

  const profils = await Profil.find(filtre)
    .populate("user", "prenom nom email isActive")
    .sort({ updatedAt: -1 });

  const termes = normaliser(q);
  const termeCompetence = normaliser(competence);
  const termeVille = normaliser(ville);

  const retenus = profils.filter((profil) => {
    // Compte désactivé : le profil ne doit plus apparaître, même resté visible.
    if (!profil.user || profil.user.isActive === false) return false;
    if (profil.completude() < COMPLETUDE_MINIMALE) return false;

    if (termeVille && !normaliser(profil.basics?.ville).includes(termeVille)) {
      return false;
    }

    if (permis && !(profil.basics?.permis || []).includes(permis.toUpperCase())) {
      return false;
    }

    if (
      termeCompetence &&
      !(profil.competences || []).some((c) =>
        normaliser(c.nom).includes(termeCompetence),
      )
    ) {
      return false;
    }

    if (termes) {
      // La recherche libre balaie tout ce qui décrit le parcours — intitulé,
      // accroche, postes, formations, compétences. Chercher « juridique » ne
      // doit pas rater quelqu'un dont c'est le diplôme et non la compétence
      // déclarée.
      const corpus = normaliser(
        [
          profil.basics?.titre,
          profil.basics?.accroche,
          ...(profil.experiences || []).map(
            (e) => `${e.poste || ""} ${e.employeur || ""} ${e.description || ""}`,
          ),
          ...(profil.formations || []).map(
            (f) => `${f.intitule || ""} ${f.niveau || ""}`,
          ),
          ...(profil.competences || []).map((c) => c.nom),
          profil.aspirations?.projet,
        ]
          .filter(Boolean)
          .join(" "),
      );

      // Tous les mots doivent être présents : « gestion budgétaire » ne doit
      // pas ramener tous ceux qui font de la « gestion ».
      if (!termes.split(/\s+/).every((mot) => corpus.includes(mot))) return false;
    }

    return true;
  });

  // Vocabulaire réellement présent dans le vivier, pour alimenter les filtres.
  // Proposer une liste de compétences dont aucune ne ramène de résultat est la
  // meilleure façon de faire croire que l'outil est vide.
  const competencesDisponibles = [
    ...new Set(
      profils
        .filter((p) => p.completude() >= COMPLETUDE_MINIMALE)
        .flatMap((p) => (p.competences || []).map((c) => c.nom))
        .filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b, "fr"));

  const provincesDisponibles = [
    ...new Set(profils.map((p) => p.basics?.province).filter(Boolean)),
  ].sort();

  res.json({
    total: retenus.length,
    totalVisibles: profils.length,
    filtres: {
      competences: competencesDisponibles,
      provinces: provincesDisponibles,
    },
    candidats: retenus.map(carte),
  });
});

// @desc    Fiche détaillée d'un candidat
// @route   GET /api/recruteur/candidats/:id
// @access  Privé / recruteur ou admin
//
// C'est ICI, et seulement ici, que sortent les coordonnées.
const getCandidat = asyncHandler(async (req, res) => {
  const profil = await Profil.findOne({
    _id: req.params.id,
    visibleRecruteurs: true,
  }).populate("user", "prenom nom email isActive");

  // Un profil masqué ou un compte désactivé renvoie 404, jamais 403 : inutile
  // de confirmer à un recruteur qu'un profil existe mais lui échappe.
  if (!profil || !profil.user || profil.user.isActive === false) {
    res.status(404);
    throw new Error("Ce profil n'est pas consultable.");
  }

  res.json({
    ...carte(profil),
    // Identifiant du COMPTE, distinct de celui du profil : c'est sur le compte
    // que portent les mesures de modération, et un profil peut être recréé.
    userId: profil.user._id,
    // Coordonnées : uniquement à ce niveau.
    email: profil.user.email,
    telephone: profil.basics?.telephone || "",
    adresse: profil.basics?.adresse || "",
    codePostal: profil.basics?.codePostal || "",
    liens: profil.basics?.liens || [],
    experiences: profil.experiences || [],
    formations: profil.formations || [],
    competencesCompletes: profil.competences || [],
    languesCompletes: profil.langues || [],
    interets: profil.interets || [],
    aspirations: profil.aspirations || {},
    contraintes: profil.contraintes || {},
  });
});

// Nom de fichier sans accent ni espace : un CV nommé « CV_Wéma Maéva.pdf »
// devient illisible selon la messagerie qui le transporte.
const nomFichierCv = (candidat, extension) => {
  const propre = (v) =>
    String(v || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  return `CV_${propre(candidat.nom)}-${propre(candidat.prenom)}.${extension}`;
};

// Charge un profil consultable, ou échoue avec le même 404 que partout : on ne
// confirme jamais à un recruteur qu'un profil existe mais lui échappe.
const profilConsultable = async (id, res) => {
  const profil = await Profil.findOne({
    _id: id,
    visibleRecruteurs: true,
  }).populate("user", "prenom nom email isActive");

  if (!profil || !profil.user || profil.user.isActive === false) {
    res.status(404);
    throw new Error("Ce profil n'est pas consultable.");
  }

  return profil;
};

// @desc    Le CV d'un candidat, en PDF
// @route   GET /api/recruteur/candidats/:id/cv
// @access  Privé / recruteur ou admin
//
// Le MÊME rendu que celui envoyé aux employeurs par le candidat : une seule
// mise en page, un seul fichier de code. Un recruteur qui télécharge ici doit
// voir exactement le document qu'il recevrait par courriel — deux rendus
// distincts finiraient par diverger, et le candidat ne saurait plus lequel le
// représente.
//
// La différence est qu'il n'y a pas d'offre visée : le CV est générique, dans
// l'ordre du profil. On ne réordonne pas au hasard.
const telechargerCv = asyncHandler(async (req, res) => {
  const profil = await profilConsultable(req.params.id, res);

  const donnees = await cvPdf({
    profil,
    user: profil.user,
    avp: null,
    date: profil.updatedAt,
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Length", donnees.length);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${nomFichierCv(profil.user, "pdf")}"`,
  );
  res.send(donnees);
});

// @desc    Le profil d'un candidat au format JSON Resume
// @route   GET /api/recruteur/candidats/:id/resume.json
// @access  Privé / recruteur ou admin
//
// C'est le pendant, côté employeur, de l'export dont dispose le candidat : un
// ATS qui lit du JSON Resume peut reprendre ce profil sans ressaisie. C'est
// exactement ce que le critère « intégrabilité » attend.
const telechargerResume = asyncHandler(async (req, res) => {
  const profil = await profilConsultable(req.params.id, res);

  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${nomFichierCv(profil.user, "json")}"`,
  );
  res.type("application/json").send(
    JSON.stringify(versJsonResume(profil, profil.user), null, 2),
  );
});

// @desc    Les candidats du vivier rapprochés d'une offre
// @route   GET /api/recruteur/offres/:slug/candidats
// @access  Privé / recruteur ou admin
//
// LA SECONDE DIRECTION DU RAPPROCHEMENT. Le moteur est exactement le même que
// côté candidat — mêmes composantes, mêmes preuves, mêmes filtres bloquants —
// simplement parcouru dans l'autre sens. Deux moteurs auraient fini par rendre
// deux verdicts différents sur le même couple, ce qu'aucun des deux camps
// n'aurait pu s'expliquer.
const candidatsPourOffre = asyncHandler(async (req, res) => {
  const avp = await Avp.findOne({ slug: req.params.slug });

  if (!avp) {
    res.status(404);
    throw new Error("Cette offre n'existe pas ou n'est plus diffusée.");
  }

  const profils = await Profil.find({ visibleRecruteurs: true }).populate(
    "user",
    "prenom nom email isActive",
  );

  const utilisables = profils.filter(
    (p) => p.user && p.user.isActive !== false && p.completude() >= COMPLETUDE_MINIMALE,
  );

  const resultats = await Promise.all(
    utilisables.map(async (profil) => ({
      candidat: carte(profil),
      rapprochement: await rapprocher(profil, avp),
    })),
  );

  const retenus = resultats
    .filter((r) => !r.rapprochement.ecarte)
    .sort((a, b) => {
      // Même règle que côté candidat : les profils non évaluables passent
      // derrière, et le tri se fait sur le score brut — `score` peut être nul.
      if (a.rapprochement.fiable !== b.rapprochement.fiable)
        return a.rapprochement.fiable ? -1 : 1;
      return (b.rapprochement.scoreBrut ?? 0) - (a.rapprochement.scoreBrut ?? 0);
    });

  res.json({
    offre: {
      slug: avp.slug,
      intitule: avp.intitule,
      employeur: avp.employeur,
      direction: avp.direction,
      lieu: avp.lieu,
    },
    total: resultats.length,
    retenus,
    // Les écartés sont renvoyés avec leur motif, comme côté candidat : un
    // recruteur doit pouvoir vérifier POURQUOI un profil n'apparaît pas,
    // sinon il soupçonnera l'outil de lui cacher des gens.
    ecartes: resultats.filter((r) => r.rapprochement.ecarte),
  });
});

export {
  listerCandidats,
  getCandidat,
  telechargerCv,
  telechargerResume,
  candidatsPourOffre,
};
