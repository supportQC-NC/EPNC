// backend/controllers/veilleController.js
//
// Les alertes vues par la personne, et ses préférences de veille.

import asyncHandler from "../middleware/asyncHandler.js";
import { Veille, Notification } from "../models/VeilleModel.js";
import Avp from "../models/AvpModel.js";
import { tourDeVeille } from "../services/veilleService.js";

// @desc    Mes alertes
// @route   GET /api/veille/alertes
// @access  Privé
const mesAlertes = asyncHandler(async (req, res) => {
  const notifications = await Notification.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .limit(60)
    .lean();

  // L'offre est-elle encore ouverte ? Une alerte vers un poste clôturé doit le
  // dire : c'est la faute la plus visible que puisse commettre une veille.
  const slugs = notifications.map((n) => n.avpSlug).filter(Boolean);
  const ouvertes = new Set(
    (
      await Avp.find(
        {
          slug: { $in: slugs },
          $or: [{ dateLimite: null }, { dateLimite: { $gte: new Date() } }],
        },
        "slug",
      ).lean()
    ).map((a) => a.slug),
  );

  const veille =
    (await Veille.findOne({ user: req.user._id }).lean()) ||
    (await Veille.create({ user: req.user._id })).toObject();

  res.json({
    preferences: {
      actif: veille.actif,
      scoreMinimal: veille.scoreMinimal,
      parEmail: veille.parEmail,
      frequence: veille.frequence,
      derniereVerification: veille.derniereVerification,
    },
    nonLues: notifications.filter((n) => !n.lu).length,
    alertes: notifications.map((n) => ({
      _id: n._id,
      type: n.type,
      avpSlug: n.avpSlug,
      avpIntitule: n.avpIntitule,
      employeur: n.employeur,
      lieu: n.lieu,
      dateLimite: n.dateLimite,
      profilId: n.profilId,
      profilNom: n.profilNom,
      profilTitre: n.profilTitre,
      score: n.score,
      fiabilite: n.fiabilite,
      verdict: n.verdict,
      preuves: n.preuves,
      lu: n.lu,
      createdAt: n.createdAt,
      // Une notification survit à ce qu'elle annonçait : on le dit plutôt que
      // de la masquer, sinon la personne cherche une alerte qu'elle a vue.
      encoreOuverte: n.avpSlug ? ouvertes.has(n.avpSlug) : true,
    })),
  });
});

// @desc    Marquer des alertes comme lues
// @route   PATCH /api/veille/alertes
// @access  Privé
//
// Sans identifiants, marque tout : c'est le geste « j'ai vu », et le faire
// alerte par alerte serait pénible sur une liste de vingt.
const marquerLues = asyncHandler(async (req, res) => {
  const filtre = { user: req.user._id, lu: false };
  if (Array.isArray(req.body?.ids) && req.body.ids.length) {
    filtre._id = { $in: req.body.ids };
  }

  const r = await Notification.updateMany(filtre, {
    lu: true,
    luLe: new Date(),
  });

  res.json({ marquees: r.modifiedCount });
});

// @desc    Mes préférences de veille
// @route   PUT /api/veille/preferences
// @access  Privé
const majPreferences = asyncHandler(async (req, res) => {
  const veille =
    (await Veille.findOne({ user: req.user._id })) ||
    (await Veille.create({ user: req.user._id }));

  if (typeof req.body.actif === "boolean") veille.actif = req.body.actif;
  if (typeof req.body.parEmail === "boolean") veille.parEmail = req.body.parEmail;

  if (["immediat", "quotidien", "jamais"].includes(req.body.frequence)) {
    veille.frequence = req.body.frequence;
  }

  if (req.body.scoreMinimal !== undefined) {
    // Borné ici aussi : une valeur hors bornes ne lèverait pas d'erreur mais
    // rendrait la veille muette ou bavarde, sans que personne comprenne.
    veille.scoreMinimal = Math.min(
      100,
      Math.max(0, Number(req.body.scoreMinimal) || 0),
    );
  }

  await veille.save();

  res.json({
    actif: veille.actif,
    scoreMinimal: veille.scoreMinimal,
    parEmail: veille.parEmail,
    frequence: veille.frequence,
  });
});

// @desc    Déclencher un tour de veille
// @route   POST /api/veille/tour
// @access  Privé / Admin
//
// La veille se déclenche normalement à l'ingestion. Ce déclenchement manuel
// sert à la démonstration et au rattrapage : après avoir modifié des profils,
// ou quand un envoi a échoué.
const lancerTour = asyncHandler(async (req, res) => {
  const r = await tourDeVeille({});

  res.json({
    ...r,
    message:
      `${r.candidats.notifications} alerte(s) pour ${r.candidats.candidats} candidat(s), ` +
      `${r.recruteurs.notifications} pour ${r.recruteurs.recruteurs} recruteur(s). ` +
      `${r.envois.envoyes} courriel(s) envoyé(s)` +
      (r.envois.echecs ? `, ${r.envois.echecs} échec(s).` : "."),
  });
});

export { mesAlertes, marquerLues, majPreferences, lancerTour };
