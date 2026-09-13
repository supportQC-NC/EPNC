// backend/controllers/avpController.js
import asyncHandler from "../middleware/asyncHandler.js";
import Avp from "../models/AvpModel.js";
import {
  expliquerCorps,
  termesPresents,
  metierClasse,
} from "../services/langageClairService.js";

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
  // Exposé dès la vue publique : savoir qui recrute fait partie des
  // informations qu'on ne doit pas faire payer d'un compte.
  employeur: avp.employeur,
  direction: avp.direction,
  service: avp.service,
  lieu: avp.lieu,
  familles: avp.familles,
  // `classe: false` quand l'employeur n'a pas rangé le poste dans la
  // nomenclature — le libellé source est alors « Hors rome », qu'il ne faut
  // surtout pas afficher tel quel. L'interface masque la ligne ; c'est le
  // corps/grade traduit qui porte l'information utile.
  metier: {
    nom: avp.metier?.nom || null,
    ficheUrl: avp.metier?.ficheUrl || null,
    classe: metierClasse(avp.metier),
  },
  typeContrat: avp.typeContrat,
  nbPostes: avp.nbPostes,
  datePubliee: avp.datePubliee,
  dateLimite: avp.dateLimite,
  ouverte: avp.estOuverte(),
});

// Ce que l'employeur publie RÉELLEMENT, section par section.
//
// ══════════════════════════════════════════════════════════════════════════
//  POURQUOI LE SERVEUR DIT CE QUI MANQUE, PLUTÔT QUE DE LAISSER DEVINER
// ══════════════════════════════════════════════════════════════════════════
// Jusqu'ici, un champ vide produisait une section absente : la page d'une
// offre sans missions ni compétences n'affichait qu'un titre et du blanc, et
// se lisait comme une application cassée. C'est le cas de 139 des 188 offres
// ouvertes — les trois quarts du catalogue.
//
// Or ce vide est une INFORMATION : il dit que cet employeur-là ne publie pas
// le détail de ses postes. La constater et la nommer vaut mieux que
// l'afficher en creux, et infiniment mieux que de la combler en inventant.
//
// Le diagnostic est calculé ici, côté serveur, pour une raison simple : c'est
// le même verdict qui doit servir à l'interface, à l'API d'intégration et à la
// veille. Trois lectures indépendantes de « cette offre est-elle vide ? »
// finiraient par diverger.
const SECTIONS = [
  ["description", "Présentation du poste"],
  ["missions", "Missions"],
  ["competencesAttendues", "Compétences attendues"],
  ["savoirFaire", "Savoir-faire"],
  ["qualifications", "Diplômes et habilitations"],
  ["experienceRequise", "Expérience requise"],
];

const renseigne = (v) =>
  Array.isArray(v) ? v.length > 0 : Boolean(String(v || "").trim());

const diagnostiquerContenu = (avp) => {
  const publie = [];
  const absent = [];

  for (const [champ, libelle] of SECTIONS) {
    (renseigne(avp[champ]) ? publie : absent).push(libelle);
  }

  return {
    publie,
    absent,
    // « Muette » : l'employeur ne publie NI missions NI compétences attendues.
    // Ce sont les deux sections sans lesquelles un rapprochement n'a aucun
    // fondement — le reste est du confort de lecture.
    muette:
      !renseigne(avp.missions) && !renseigne(avp.competencesAttendues),
  };
};

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

  contenu: diagnostiquerContenu(avp),

  // Le vocabulaire administratif traduit. `corps` est souvent le SEUL contenu
  // exploitable d'une offre muette : c'est lui qui permet de dire quelque
  // chose d'utile là où l'employeur n'a rien écrit.
  langageClair: {
    corps: expliquerCorps(avp.corpsDomaine),
    // Uniquement les termes présents dans CETTE offre : un glossaire générique
    // collé sous chaque annonce se survole et ne se lit pas.
    termes: termesPresents(
      avp.qualifications,
      avp.description,
      avp.missions,
      avp.competencesAttendues,
      avp.experienceRequise,
      avp.contraintePhysique,
    ),
  },
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

  // Filtre par employeur. L'application agrège plusieurs organisations
  // publiques ; quelqu'un qui vise l'OPT-NC ne doit pas avoir à trier à la
  // main parmi les avis de la fonction publique.
  if (req.query.employeur) {
    filtre["employeur.code"] = req.query.employeur;
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
    // Combien d'offres par employeur, et combien sont encore ouvertes. C'est
    // ce qui permet à l'interface de proposer un filtre honnête plutôt qu'une
    // liste où l'on découvre l'employeur offre par offre.
    employeurs: await repartitionEmployeurs(),
    rythme: await rythmePublication(),
    offres: offres.map(vuePublique),
  });
});

// Répartition des offres par employeur.
const repartitionEmployeurs = async () => {
  const maintenant = new Date();

  const lignes = await Avp.aggregate([
    {
      $group: {
        _id: "$employeur.code",
        nom: { $first: "$employeur.nom" },
        nomComplet: { $first: "$employeur.nomComplet" },
        type: { $first: "$employeur.type" },
        total: { $sum: 1 },
        ouvertes: {
          $sum: {
            $cond: [
              {
                $or: [
                  { $eq: ["$dateLimite", null] },
                  { $gte: ["$dateLimite", maintenant] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
    { $sort: { ouvertes: -1, total: -1 } },
  ]);

  return lignes.map((l) => ({
    code: l._id,
    nom: l.nom,
    nomComplet: l.nomComplet,
    type: l.type,
    total: l.total,
    ouvertes: l.ouvertes,
  }));
};

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
