// backend/controllers/cleApiController.js
//
// Gestion des clés d'API, côté administration.

import asyncHandler from "../middleware/asyncHandler.js";
import CleApi, { PORTEES } from "../models/CleApiModel.js";

// @desc    Les clés existantes et les portées disponibles
// @route   GET /api/admin/cles
// @access  Privé / Admin
const listerCles = asyncHandler(async (req, res) => {
  const cles = await CleApi.find({})
    .populate("creeePar", "prenom nom")
    .sort({ createdAt: -1 })
    .lean();

  res.json({
    // Le catalogue des portées vient du serveur : l'écran d'administration ne
    // réécrit pas la liste, sinon il finirait par proposer une portée qui
    // n'existe plus.
    portees: PORTEES,
    cles: cles.map((c) => ({
      ...c,
      creeePar: c.creeePar ? `${c.creeePar.prenom} ${c.creeePar.nom}`.trim() : null,
    })),
  });
});

// @desc    Créer une clé
// @route   POST /api/admin/cles
// @access  Privé / Admin
//
// 🔴 C'est le SEUL moment où le secret existe en clair. Il n'est pas stocké,
// donc pas re-consultable : perdu, il faut en créer une autre. C'est
// délibéré — une clé qu'un administrateur peut relire six mois plus tard est
// une clé que n'importe qui ayant accès à l'écran peut relire aussi.
const creerCle = asyncHandler(async (req, res) => {
  const { nom, organisation, contact, portees } = req.body;

  if (!nom?.trim()) {
    res.status(400);
    throw new Error(
      "Donnez un nom à cette clé : c'est lui que vous chercherez le jour où il faudra la révoquer.",
    );
  }

  const demandees = Array.isArray(portees) ? portees : [];
  const inconnues = demandees.filter((p) => !Object.keys(PORTEES).includes(p));

  if (inconnues.length) {
    res.status(400);
    throw new Error(`Portée inconnue : ${inconnues.join(", ")}.`);
  }

  if (demandees.length === 0) {
    res.status(400);
    throw new Error(
      "Choisissez au moins une portée. Une clé sans permission ne sert à rien et fera croire à une panne.",
    );
  }

  const { cle, secret } = CleApi.fabriquer({
    nom: nom.trim(),
    organisation: (organisation || "").trim(),
    contact: (contact || "").trim(),
    portees: demandees,
    creeePar: req.user._id,
  });

  await cle.save();

  console.log(`🔑 Clé d'API créée : « ${cle.nom} » par ${req.user.email}`);

  res.status(201).json({
    message:
      "Clé créée. Copiez-la maintenant : elle n'est pas conservée en clair et ne pourra plus être affichée.",
    secret,
    cle: { ...cle.toObject(), empreinte: undefined },
  });
});

// @desc    Révoquer une clé
// @route   DELETE /api/admin/cles/:id
// @access  Privé / Admin
//
// Révocation, pas suppression : la ligne reste, avec sa date et son motif. On
// doit pouvoir répondre à « qui avait accès, et jusqu'à quand ».
const revoquerCle = asyncHandler(async (req, res) => {
  const cle = await CleApi.findById(req.params.id);

  if (!cle) {
    res.status(404);
    throw new Error("Clé introuvable.");
  }

  if (!cle.active) {
    res.status(409);
    throw new Error("Cette clé est déjà révoquée.");
  }

  cle.active = false;
  cle.revoqueeLe = new Date();
  cle.motifRevocation = (req.body?.motif || "").trim();
  await cle.save();

  console.log(`🔒 Clé d'API révoquée : « ${cle.nom} » par ${req.user.email}`);

  res.json({ message: `La clé « ${cle.nom} » ne fonctionne plus.` });
});

export { listerCles, creerCle, revoquerCle };
