// backend/controllers/matchController.js
import asyncHandler from "../middleware/asyncHandler.js";
import Avp from "../models/AvpModel.js";
import Profil from "../models/ProfilModel.js";
import { rapprocher, rapprocherToutes } from "../services/matchingService.js";

// Sous ce seuil de complétude, le rapprochement ne veut rien dire : il
// comparerait une fiche de poste détaillée à trois lignes. Afficher un score
// dans ces conditions décrédibilise l'outil bien plus qu'un message honnête.
const COMPLETUDE_MINIMALE = 30;

const chargerProfil = async (req, res) => {
  const profil = await Profil.findOne({ user: req.user._id });

  if (!profil || profil.completude() < COMPLETUDE_MINIMALE) {
    res.status(400);
    throw new Error(
      `Votre profil est trop incomplet (${profil?.completude() || 0} %) pour un rapprochement utile. Complétez-le : au minimum votre présentation, une expérience et trois compétences.`,
    );
  }

  return profil;
};

// @desc    Rapprocher mon profil de toutes les offres
// @route   GET /api/matchs
// @access  Privé
//
// `toutes=1` inclut les offres clôturées, qui sont alors écartées avec leur
// motif : elles restent instructives sur ce que l'employeur recherche.
const getMatchs = asyncHandler(async (req, res) => {
  const profil = await chargerProfil(req, res);

  const filtre =
    req.query.toutes === "1"
      ? {}
      : { $or: [{ dateLimite: null }, { dateLimite: { $gte: new Date() } }] };

  const avps = await Avp.find(filtre).sort({ datePubliee: -1 });

  const { retenus, ecartes } = await rapprocherToutes(profil, avps);

  res.json({
    completude: profil.completude(),
    total: retenus.length + ecartes.length,
    retenus,
    ecartes,
  });
});

// @desc    Détail du rapprochement pour une offre
// @route   GET /api/matchs/:slug
// @access  Privé
const getMatch = asyncHandler(async (req, res) => {
  const profil = await chargerProfil(req, res);

  const avp = await Avp.findOne({ slug: req.params.slug });
  if (!avp) {
    res.status(404);
    throw new Error("Cette offre n'existe pas ou n'est plus diffusée.");
  }

  res.json(await rapprocher(profil, avp));
});

export { getMatchs, getMatch };
