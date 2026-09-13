// backend/controllers/metierController.js
import asyncHandler from "../middleware/asyncHandler.js";
import { Famille, Metier, Competence } from "../models/MetierModel.js";
import Avp from "../models/AvpModel.js";
import Profil from "../models/ProfilModel.js";
import { analyserMetier } from "../services/matchingService.js";

// @desc    Le référentiel : familles et métiers
// @route   GET /api/metiers
// @access  Public
//
// Donnée publique, exposée telle quelle. C'est aussi ce qui rend le service
// réutilisable : n'importe qui peut consommer ce référentiel sans compte.
const listerMetiers = asyncHandler(async (req, res) => {
  const [familles, metiers, nbCompetences] = await Promise.all([
    Famille.find({}).sort({ libelle: 1 }).lean(),
    Metier.find({ actif: true }, "code nom familleCode competences")
      .sort({ nom: 1 })
      .lean(),
    Competence.countDocuments(),
  ]);

  // Nombre d'offres ouvertes par métier : c'est l'information qui transforme
  // un annuaire en outil. Un métier sans poste ouvert reste utile à viser,
  // mais il faut le savoir.
  const ouvertes = await Avp.find(
    { $or: [{ dateLimite: null }, { dateLimite: { $gte: new Date() } }] },
    "metier.code",
  ).lean();

  const offresParMetier = new Map();
  for (const a of ouvertes) {
    const c = a.metier?.code;
    if (c) offresParMetier.set(c, (offresParMetier.get(c) || 0) + 1);
  }

  res.json({
    totaux: {
      familles: familles.length,
      metiers: metiers.length,
      competences: nbCompetences,
      liaisons: metiers.reduce((t, m) => t + (m.competences?.length || 0), 0),
    },
    familles: familles.map((f) => ({
      code: f.code,
      libelle: f.libelle,
      nbMetiers: metiers.filter((m) => m.familleCode === f.code).length,
    })),
    metiers: metiers.map((m) => ({
      code: m.code,
      nom: m.nom,
      familleCode: m.familleCode,
      nbCompetences: m.competences?.length || 0,
      offresOuvertes: offresParMetier.get(m.code) || 0,
    })),
  });
});

// @desc    Une fiche métier, enrichie de l'écart si la personne est connectée
// @route   GET /api/metiers/:code
// @access  Public (enrichi si connecté)
const getMetier = asyncHandler(async (req, res) => {
  const metier = await Metier.findOne({ code: req.params.code }).lean();

  if (!metier) {
    res.status(404);
    throw new Error("Ce métier n'existe pas au référentiel.");
  }

  const famille = metier.familleCode
    ? await Famille.findOne({ code: metier.familleCode }).lean()
    : null;

  // Offres rattachées, ouvertes d'abord.
  const offres = await Avp.find(
    { "metier.code": metier.code },
    "slug intitule direction lieu datePubliee dateLimite",
  )
    .sort({ datePubliee: -1 })
    .lean();

  const maintenant = new Date();

  let ecart = null;
  if (req.user) {
    const profil = await Profil.findOne({ user: req.user._id });
    // Sous 30 % de complétude, l'analyse ne dirait rien d'exploitable : on
    // préfère l'absence de résultat à un résultat trompeur.
    if (profil && profil.completude() >= 30) {
      ecart = analyserMetier(profil, metier);
    }
  }

  res.json({
    code: metier.code,
    nom: metier.nom,
    famille: famille ? { code: famille.code, libelle: famille.libelle } : null,
    competences: metier.competences || [],
    offres: offres.map((o) => ({
      ...o,
      ouverte: !o.dateLimite || o.dateLimite >= maintenant,
    })),
    ecart,
  });
});

// @desc    Vocabulaire des compétences du référentiel
// @route   GET /api/metiers/competences/liste
// @access  Public
//
// Sert à proposer les libellés officiels dans le formulaire de profil. Une
// compétence saisie avec les mots du référentiel se rapproche exactement au
// lieu d'être devinée par ressemblance de chaînes : c'est le gain de
// précision le plus simple à obtenir sur tout le rapprochement.
const listerCompetences = asyncHandler(async (req, res) => {
  const competences = await Competence.find({}, "code nom groupe")
    .sort({ nom: 1 })
    .lean();

  res.json(competences);
});

export { listerMetiers, getMetier, listerCompetences };
