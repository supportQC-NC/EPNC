// backend/controllers/webhookController.js
//
// Gestion des abonnements aux webhooks, côté administration.

import asyncHandler from "../middleware/asyncHandler.js";
import Webhook, { EVENEMENTS } from "../models/WebhookModel.js";
import { emettreVersUn, chargeAvpPublie } from "../services/webhookService.js";
import Avp from "../models/AvpModel.js";

// @desc    Les abonnements
// @route   GET /api/admin/webhooks
// @access  Privé / Admin
const listerWebhooks = asyncHandler(async (req, res) => {
  // `select` par défaut exclut déjà le secret : il n'a aucune raison de
  // repasser par le réseau une fois créé.
  const webhooks = await Webhook.find({}).sort({ createdAt: -1 }).lean();

  res.json({ evenements: EVENEMENTS, webhooks });
});

// @desc    Créer un abonnement
// @route   POST /api/admin/webhooks
// @access  Privé / Admin
const creerWebhook = asyncHandler(async (req, res) => {
  const { nom, url, evenements } = req.body;

  if (!nom?.trim() || !url?.trim()) {
    res.status(400);
    throw new Error("Un nom et une URL sont nécessaires.");
  }

  let adresse;
  try {
    adresse = new URL(url.trim());
  } catch {
    res.status(400);
    throw new Error("Cette URL n'est pas valide.");
  }

  if (!["http:", "https:"].includes(adresse.protocol)) {
    res.status(400);
    throw new Error("L'URL doit être en http ou https.");
  }

  // HTTP toléré en développement seulement. Une charge utile signée mais
  // transmise en clair reste lisible par tout intermédiaire : la signature
  // protège de l'altération, pas de la lecture.
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(adresse.hostname);

  if (adresse.protocol === "http:" && !local) {
    res.status(400);
    throw new Error(
      "Une URL distante doit être en HTTPS : la signature garantit l'origine du message, pas sa confidentialité.",
    );
  }

  const demandes = Array.isArray(evenements) ? evenements : ["avp.publie"];
  const inconnus = demandes.filter((e) => !Object.keys(EVENEMENTS).includes(e));

  if (inconnus.length) {
    res.status(400);
    throw new Error(`Événement inconnu : ${inconnus.join(", ")}.`);
  }

  const secret = Webhook.nouveauSecret();

  const webhook = await Webhook.create({
    nom: nom.trim(),
    url: adresse.toString(),
    evenements: demandes,
    secret,
    creeePar: req.user._id,
  });

  console.log(`📡 Webhook créé : « ${webhook.nom} » → ${webhook.url}`);

  res.status(201).json({
    message:
      "Abonnement créé. Transmettez le secret au destinataire : il lui sert à vérifier que les envois viennent bien de nous.",
    // Le secret EST réaffichable (il est stocké en clair, voir le modèle) mais
    // on ne le renvoie qu'ici : l'exposer dans la liste le ferait traîner dans
    // toutes les réponses de l'écran d'administration.
    secret,
    webhook: { ...webhook.toObject(), secret: undefined },
  });
});

// @desc    Activer / suspendre un abonnement
// @route   PUT /api/admin/webhooks/:id
// @access  Privé / Admin
const basculerWebhook = asyncHandler(async (req, res) => {
  const webhook = await Webhook.findById(req.params.id);

  if (!webhook) {
    res.status(404);
    throw new Error("Abonnement introuvable.");
  }

  webhook.actif = Boolean(req.body?.actif);

  // Réactiver remet le compteur à zéro : sans cela, un abonnement réparé
  // serait re-suspendu au premier échec suivant, puisqu'il resterait au-dessus
  // du seuil.
  if (webhook.actif) {
    webhook.echecsConsecutifs = 0;
    webhook.derniereErreur = "";
  }

  await webhook.save();

  res.json({
    message: webhook.actif
      ? `« ${webhook.nom} » est réactivé.`
      : `« ${webhook.nom} » est suspendu.`,
  });
});

// @desc    Supprimer un abonnement
// @route   DELETE /api/admin/webhooks/:id
// @access  Privé / Admin
const supprimerWebhook = asyncHandler(async (req, res) => {
  const webhook = await Webhook.findByIdAndDelete(req.params.id);

  if (!webhook) {
    res.status(404);
    throw new Error("Abonnement introuvable.");
  }

  res.json({ message: `« ${webhook.nom} » a été supprimé.` });
});

// @desc    Envoyer un événement de test
// @route   POST /api/admin/webhooks/:id/test
// @access  Privé / Admin
//
// POURQUOI : un webhook ne se déclenche qu'à l'ingestion, c'est-à-dire
// rarement et à un moment qu'on ne choisit pas. Sans bouton de test,
// l'intégrateur ne peut pas vérifier sa vérification de signature — il
// découvrirait son erreur le jour d'un vrai lot, en le perdant.
const testerWebhook = asyncHandler(async (req, res) => {
  const webhook = await Webhook.findById(req.params.id);

  if (!webhook) {
    res.status(404);
    throw new Error("Abonnement introuvable.");
  }

  if (!webhook.actif) {
    res.status(409);
    throw new Error("Cet abonnement est suspendu : réactivez-le pour le tester.");
  }

  // De vraies offres, pas un objet factice : c'est la charge utile exacte que
  // le destinataire recevra, donc le test éprouve aussi son parsing.
  const offres = await Avp.find({
    $or: [{ dateLimite: null }, { dateLimite: { $gte: new Date() } }],
  }).limit(3);

  // Vers CET abonnement seulement : voir emettreVersUn.
  const bilan = await emettreVersUn(
    webhook._id,
    "avp.publie",
    chargeAvpPublie("test manuel", offres),
  );

  const apres = await Webhook.findById(req.params.id).lean();

  res.json({
    message: bilan?.ok
      ? `Envoi accepté par le destinataire (HTTP ${bilan.statut}, ${bilan.essais} tentative${bilan.essais > 1 ? "s" : ""}).`
      : `Envoi refusé : ${bilan?.erreur || apres?.derniereErreur || "cause inconnue"}.`,
    bilan,
  });
});

export {
  listerWebhooks,
  creerWebhook,
  basculerWebhook,
  supprimerWebhook,
  testerWebhook,
};
