// backend/controllers/profilController.js
import asyncHandler from "../middleware/asyncHandler.js";
import Profil from "../models/ProfilModel.js";

// Forme renvoyée au client : le document, plus la complétude calculée.
// Elle est calculée côté serveur pour que l'interface et un éventuel autre
// consommateur (application mobile, export) voient le même chiffre.
const sortie = (profil) => ({
  ...profil.toObject(),
  completude: profil.completude(),
});

// @desc    Mon profil (créé vide s'il n'existe pas encore)
// @route   GET /api/profil
// @access  Privé
//
// Création implicite à la première lecture : sans elle, le front devrait gérer
// un état « pas encore de profil » distinct d'un « profil vide », pour une
// différence qui n'a aucun sens côté utilisateur.
const getMonProfil = asyncHandler(async (req, res) => {
  let profil = await Profil.findOne({ user: req.user._id });

  if (!profil) {
    profil = await Profil.create({ user: req.user._id });
  }

  res.json(sortie(profil));
});

// @desc    Enregistrer mon profil
// @route   PUT /api/profil
// @access  Privé
//
// Enregistrement par section : le client envoie ce qu'il a modifié. Les
// sections absentes du corps ne sont pas touchées — deux onglets ouverts ne
// s'écrasent donc pas mutuellement sur des parties qu'ils n'ont pas éditées.
const updateMonProfil = asyncHandler(async (req, res) => {
  const profil =
    (await Profil.findOne({ user: req.user._id })) ||
    (await Profil.create({ user: req.user._id }));

  const sections = [
    "basics",
    "experiences",
    "formations",
    "competences",
    "langues",
    "aspirations",
    "contraintes",
  ];

  for (const section of sections) {
    if (req.body[section] !== undefined) {
      profil.set(section, req.body[section]);
    }
  }

  await profil.save();

  res.json(sortie(profil));
});

export { getMonProfil, updateMonProfil };
