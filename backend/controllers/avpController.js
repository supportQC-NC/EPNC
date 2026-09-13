// backend/controllers/avpController.js
import asyncHandler from "../middleware/asyncHandler.js";
import Avp from "../models/AvpModel.js";

// Longueur de l'extrait public. Assez pour comprendre le poste, trop court
// pour se passer de la fiche complète.
const LONGUEUR_EXTRAIT = 220;

// Coupe au dernier espace pour ne pas trancher un mot en deux.
const extraire = (texte = "") => {
  const propre = String(texte).replace(/\s+/g, " ").trim();
  if (propre.length <= LONGUEUR_EXTRAIT) return propre;
  const coupe = propre.slice(0, LONGUEUR_EXTRAIT);
  return coupe.slice(0, coupe.lastIndexOf(" ")) + "…";
};

// Vue PUBLIQUE d'une offre.
//
// ⚠️ C'est ici que se joue le cloisonnement : tout ce qui n'apparaît pas dans
// cet objet est invisible sans compte. Missions, compétences attendues,
// qualifications et contact de candidature en sont volontairement absents —
// ce sont eux qui justifient la création d'un compte.
//
// `applicationContact` n'apparaît dans AUCUNE vue applicative. Ce n'est pas un
// secret — l'adresse est publique, et le document brut servi par
// /jobposting la contient, fidèlement à la source. C'est une mesure de
// prudence : tant que l'adresse ne circule pas dans nos payloads, aucun écran
// ni aucun futur module d'envoi ne peut la reprendre par mégarde et expédier
// une candidature de démonstration à la vraie DRH de l'OPT-NC.
const vuePublique = (avp) => ({
  slug: avp.slug,
  idAvp: avp.idAvp,
  intitule: avp.intitule,
  extrait: extraire(avp.description),
  direction: avp.direction,
  service: avp.service,
  lieu: avp.lieu,
  familles: avp.familles,
  metier: {
    nom: avp.metier?.nom || null,
    ficheUrl: avp.metier?.ficheUrl || null,
  },
  typeContrat: avp.typeContrat,
  nbPostes: avp.nbPostes,
  datePubliee: avp.datePubliee,
  dateLimite: avp.dateLimite,
  ouverte: avp.estOuverte(),
});

// Vue COMPLÈTE — comptes connectés uniquement.
const vueComplete = (avp) => ({
  ...vuePublique(avp),
  description: avp.description,
  corpsDomaine: avp.corpsDomaine,
  missions: avp.missions,
  competencesAttendues: avp.competencesAttendues,
  savoirFaire: avp.savoirFaire,
  experienceRequise: avp.experienceRequise,
  qualifications: avp.qualifications,
  contraintePhysique: avp.contraintePhysique,
  experienceRemplaceDiplome: avp.experienceRemplaceDiplome,
  metier: avp.metier,
});

// @desc    Liste publique des offres, de la plus récente à la plus ancienne
// @route   GET /api/avps
// @access  Public
//
// Paramètre optionnel `ouvertes=1` : ne renvoie que les offres dont la date
// limite n'est pas passée. Non filtré par défaut — sur un corpus qui se
// renouvelle en quelques semaines, masquer les offres clôturées donnerait
// souvent une page vide, ce qui informe moins qu'une liste datée et étiquetée.
const listerAvps = asyncHandler(async (req, res) => {
  const filtre = {};

  if (req.query.ouvertes === "1") {
    filtre.$or = [{ dateLimite: null }, { dateLimite: { $gte: new Date() } }];
  }

  // Tri secondaire sur idAvp : sans lui, deux offres publiées le même jour
  // (c'est la règle ici, elles arrivent par lots) remonteraient dans un ordre
  // variable d'une requête à l'autre, et la liste « sauterait » au rechargement.
  const offres = await Avp.find(filtre).sort({ datePubliee: -1, idAvp: 1 });

  const total = await Avp.countDocuments();
  const ouvertes = await Avp.countDocuments({
    $or: [{ dateLimite: null }, { dateLimite: { $gte: new Date() } }],
  });

  res.json({
    total,
    ouvertes,
    cloturees: total - ouvertes,
    rythme: await rythmePublication(),
    offres: offres.map(vuePublique),
  });
});

// Nombre de publications par mois sur les douze derniers mois.
//
// C'est l'intérêt de conserver les offres clôturées : une offre passée ne se
// candidate plus, mais elle renseigne sur le RYTHME de recrutement. Quelqu'un
// qui voit « trois postes administratifs publiés sur les quatre derniers
// mois » sait qu'il y a lieu de revenir, au lieu de conclure d'une page vide
// que l'OPT ne recrute pas.
//
// Les mois sans publication sont renvoyés à zéro : les absences font partie du
// rythme, et une série trouée se lit mal.
const rythmePublication = async () => {
  const debut = new Date();
  debut.setMonth(debut.getMonth() - 11);
  debut.setDate(1);
  debut.setHours(0, 0, 0, 0);

  const lignes = await Avp.aggregate([
    { $match: { datePubliee: { $gte: debut } } },
    {
      $group: {
        _id: {
          annee: { $year: "$datePubliee" },
          mois: { $month: "$datePubliee" },
        },
        total: { $sum: 1 },
      },
    },
  ]);

  const parCle = new Map(
    lignes.map((l) => [`${l._id.annee}-${String(l._id.mois).padStart(2, "0")}`, l.total]),
  );

  const mois = [];
  const curseur = new Date(debut);

  for (let i = 0; i < 12; i++) {
    const cle = `${curseur.getFullYear()}-${String(curseur.getMonth() + 1).padStart(2, "0")}`;
    mois.push({ mois: cle, total: parCle.get(cle) || 0 });
    curseur.setMonth(curseur.getMonth() + 1);
  }

  return mois;
};

// @desc    Aperçu public d'une offre
// @route   GET /api/avps/:slug
// @access  Public
const getAvpApercu = asyncHandler(async (req, res) => {
  const avp = await Avp.findOne({ slug: req.params.slug });

  if (!avp) {
    res.status(404);
    throw new Error("Cette offre n'existe pas ou n'est plus diffusée.");
  }

  res.json(vuePublique(avp));
});

// @desc    Fiche complète d'une offre
// @route   GET /api/avps/:slug/complet
// @access  Privé
const getAvpComplet = asyncHandler(async (req, res) => {
  const avp = await Avp.findOne({ slug: req.params.slug });

  if (!avp) {
    res.status(404);
    throw new Error("Cette offre n'existe pas ou n'est plus diffusée.");
  }

  res.json(vueComplete(avp));
});

// @desc    Document source schema.org/JobPosting, tel qu'il a été publié
// @route   GET /api/avps/:slug/jobposting
// @access  Public
//
// Ressource ouverte et assumée : la donnée est publique et normalisée. L'exposer
// telle quelle rend nos fiches réutilisables par un autre service, un ATS ou un
// moteur d'emploi — sans passer par notre interface.
const getAvpJsonLd = asyncHandler(async (req, res) => {
  const avp = await Avp.findOne({ slug: req.params.slug });

  if (!avp) {
    res.status(404);
    throw new Error("Cette offre n'existe pas ou n'est plus diffusée.");
  }

  res.type("application/ld+json").send(JSON.stringify(avp.raw, null, 2));
});

export { listerAvps, getAvpApercu, getAvpComplet, getAvpJsonLd };
