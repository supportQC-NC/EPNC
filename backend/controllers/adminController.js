// backend/controllers/adminController.js
import asyncHandler from "../middleware/asyncHandler.js";
import User from "../models/UserModel.js";
import Avp from "../models/AvpModel.js";
import { etatDesSources } from "../services/sourcesService.js";
import {
  executerIngestion,
  journalIngestion,
  sourcesIngerables,
} from "../services/ingestionService.js";
import {
  etatEnvoi,
  modeEnvoi,
  productionAutorisee,
  CLE_MODE,
} from "../services/envoiService.js";
import { ecrireParametre } from "../models/ParametreModel.js";
import {
  reglages,
  diagnostic,
  testerConnexion,
  envoyerTest,
  smtpConfigure,
} from "../services/smtpService.js";

// @desc    Chiffres du tableau de bord d'administration
// @route   GET /api/admin/dashboard
// @access  Privé / Admin
//
// Une seule requête HTTP pour toute la page : un tableau de bord qui déclenche
// huit appels rend l'écran lent à afficher et impossible à lire pendant qu'il
// se remplit par morceaux.
const getDashboard = asyncHandler(async (req, res) => {
  const maintenant = new Date();
  const ilYaSeptJours = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Filtre « offre ouverte » : pas de date limite, ou date limite à venir.
  // Répété tel quel dans avpController — même définition partout, sinon les
  // chiffres du tableau de bord contrediraient la liste publique.
  const filtreOuvertes = {
    $or: [{ dateLimite: null }, { dateLimite: { $gte: maintenant } }],
  };

  // Promise.all : les requêtes sont indépendantes, les enchaîner ne ferait
  // qu'additionner les allers-retours vers la base.
  const [
    totalComptes,
    comptesActifs,
    inscriptionsRecentes,
    repartitionRoles,
    derniersInscrits,
    derniereConnexion,
    totalOffres,
    offresOuvertes,
    offreLaPlusRecente,
    prochaineCloture,
    derniereSynchro,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ isActive: true }),
    User.countDocuments({ createdAt: { $gte: ilYaSeptJours } }),
    User.aggregate([{ $group: { _id: "$role", total: { $sum: 1 } } }]),
    User.find({}, "prenom nom email role isActive createdAt")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
    User.findOne({ lastLogin: { $ne: null } }, "prenom nom lastLogin")
      .sort({ lastLogin: -1 })
      .lean(),
    Avp.countDocuments(),
    Avp.countDocuments(filtreOuvertes),
    Avp.findOne({}, "intitule slug datePubliee").sort({ datePubliee: -1 }).lean(),
    Avp.findOne(
      { dateLimite: { $gte: maintenant } },
      "intitule slug dateLimite",
    )
      .sort({ dateLimite: 1 })
      .lean(),
    // `updatedAt` du document touché le plus récemment = dernier passage du
    // script d'ingestion. Approximation assumée tant qu'il n'y a pas de
    // journal de synchronisation dédié.
    Avp.findOne({}, "updatedAt").sort({ updatedAt: -1 }).lean(),
  ]);

  // L'agrégation ne renvoie que les rôles PRÉSENTS en base. On repart de la
  // liste des rôles possibles pour qu'un rôle à zéro s'affiche quand même :
  // « recruteurs : 0 » est une information, une ligne absente est une
  // ambiguïté.
  const roles = User.schema.path("role").enumValues;
  const parRole = Object.fromEntries(roles.map((r) => [r, 0]));
  repartitionRoles.forEach(({ _id, total }) => {
    if (_id in parRole) parRole[_id] = total;
  });

  res.json({
    comptes: {
      total: totalComptes,
      actifs: comptesActifs,
      desactives: totalComptes - comptesActifs,
      inscriptionsRecentes,
      parRole,
      derniersInscrits,
      derniereConnexion,
    },
    offres: {
      total: totalOffres,
      ouvertes: offresOuvertes,
      cloturees: totalOffres - offresOuvertes,
      laPlusRecente: offreLaPlusRecente,
      prochaineCloture,
      derniereSynchro: derniereSynchro?.updatedAt || null,
    },
  });
});

// @desc    État des sources de données publiques
// @route   GET /api/admin/sources
// @access  Privé / Admin
//
// Réponse volontairement lente (quelques secondes) : elle interroge réellement
// chaque source. Un écran qui afficherait un état mis en cache dirait « tout va
// bien » pendant une panne.
const getSources = asyncHandler(async (req, res) => {
  res.json(await etatDesSources());
});

// @desc    Configuration SMTP et anomalies détectées
// @route   GET /api/admin/smtp
// @access  Privé / Admin
//
// Le mot de passe n'est JAMAIS renvoyé, seulement sa présence. Un écran
// d'administration n'a aucune raison de faire transiter un secret par le
// réseau pour afficher un état.
const getSmtp = asyncHandler(async (req, res) => {
  res.json({
    configure: smtpConfigure(),
    reglages: reglages(),
    anomalies: diagnostic(),
  });
});

// @desc    Tester la connexion SMTP (sans envoyer de message)
// @route   POST /api/admin/smtp/test
// @access  Privé / Admin
const testerSmtp = asyncHandler(async (req, res) => {
  res.json(await testerConnexion());
});

// @desc    Envoyer un email de test
// @route   POST /api/admin/smtp/envoi
// @access  Privé / Admin
const envoyerSmtpTest = asyncHandler(async (req, res) => {
  const destinataire = String(req.body.destinataire || "").trim();

  // Vérification volontairement sommaire : le serveur SMTP validera bien mieux
  // que nous. Il s'agit seulement d'éviter un aller-retour pour un champ vide
  // ou manifestement erroné.
  if (!destinataire || !destinataire.includes("@")) {
    res.status(400);
    throw new Error("Indiquez une adresse email de destination valide.");
  }

  res.json(await envoyerTest(destinataire));
});

// =============================================================================
// INGESTION DEPUIS L'INTERFACE
// =============================================================================
//
// Le même code que `npm run data:*`. Personne ne devrait avoir besoin d'un
// terminal pour rafraîchir un catalogue d'offres — mais la console reste
// indispensable à l'installation et pour une tâche planifiée. Voir l'en-tête
// de ingestionService.js.

// @desc    Sources synchronisables et journal des dernières synchros
// @route   GET /api/admin/ingestion
// @access  Privé / Admin
const getIngestion = asyncHandler(async (req, res) => {
  res.json({
    sources: sourcesIngerables(),
    ...(await journalIngestion()),
  });
});

// @desc    Lancer une synchronisation
// @route   POST /api/admin/ingestion/:source
// @access  Privé / Admin
//
// Synchrone, volontairement : une ingestion dure quelques secondes à une
// minute, et l'administrateur veut le compte-rendu, pas un « c'est parti ».
// Une file d'attente ici serait de la sur-ingénierie — et ferait perdre le
// message d'erreur, qui est précisément ce qu'on vient chercher quand une
// source tombe.
const lancerIngestion = asyncHandler(async (req, res) => {
  try {
    const resultat = await executerIngestion(req.params.source, {
      declencheur: "administration",
      par: req.user._id,
    });

    res.json(resultat);
  } catch (erreur) {
    // L'échec est déjà journalisé par le service ; on ne le perd pas, on le
    // rend lisible.
    res.status(502);
    throw new Error(
      `Synchronisation impossible : ${erreur.message}`,
    );
  }
});

// =============================================================================
// MODE D'ENVOI DES CANDIDATURES
// =============================================================================

// @desc    Mode d'envoi courant
// @route   GET /api/admin/envoi
// @access  Privé / Admin
const getEnvoi = asyncHandler(async (req, res) => {
  res.json({
    ...(await etatEnvoi()),
    adresseTest: process.env.CANDIDATURE_EMAIL_TEST?.trim() || null,
  });
});

// @desc    Basculer entre test et production
// @route   PUT /api/admin/envoi
// @access  Privé / Admin
//
// 🔴 Le passage en production fait partir les candidatures chez de VRAIS
// recruteurs. Il exige donc, en plus de ce geste, `ENVOI_PRODUCTION_AUTORISE`
// dans l'environnement du serveur : deux clés, deux niveaux d'accès. Un
// administrateur seul ne peut pas ouvrir la production depuis son navigateur,
// et une copie de la base ne l'emporte pas avec elle.
const changerModeEnvoi = asyncHandler(async (req, res) => {
  const { mode } = req.body;

  if (!["test", "production"].includes(mode)) {
    res.status(400);
    throw new Error("Mode inconnu : attendu « test » ou « production ».");
  }

  if (mode === "production" && !productionAutorisee()) {
    res.status(403);
    throw new Error(
      "Le mode production n'est pas autorisé sur ce serveur. Posez " +
        "ENVOI_PRODUCTION_AUTORISE=true dans l'environnement, puis redémarrez. " +
        "Tant que ce n'est pas fait, aucune candidature ne peut partir chez un " +
        "recruteur réel — y compris depuis cet écran.",
    );
  }

  await ecrireParametre(CLE_MODE, mode, req.user);

  console.log(
    `⚙️  Mode d'envoi des candidatures : ${await modeEnvoi()} ` +
      `(changé par ${req.user.email})`,
  );

  res.json(await etatEnvoi());
});

export {
  getDashboard,
  getSources,
  getSmtp,
  testerSmtp,
  envoyerSmtpTest,
  getIngestion,
  lancerIngestion,
  getEnvoi,
  changerModeEnvoi,
};
