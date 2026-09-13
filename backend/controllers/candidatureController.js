// backend/controllers/candidatureController.js
import asyncHandler from "../middleware/asyncHandler.js";
import Candidature, { STATUTS } from "../models/CandidatureModel.js";
import Avp from "../models/AvpModel.js";
import Profil from "../models/ProfilModel.js";
import { GENERATEURS } from "../services/redactionService.js";
import { iaDisponible, modeleUtilise } from "../services/modeleService.js";
import {
  dossierZip,
  piecePdfSeule,
  envoyerDossier,
  etatEnvoi,
  piecesManquantes,
} from "../services/envoiService.js";
import { versJsonResume } from "../services/jsonResumeService.js";

const PIECES = ["lettre", "cv", "restitution", "preparation"];

// Toutes les routes de ce contrôleur ne voient QUE les candidatures de la
// personne connectée. Le filtre est systématiquement `{ _id, user }` : une
// candidature d'autrui renvoie 404, jamais 403 — inutile de confirmer à
// quelqu'un qu'un identifiant existe.
const trouverSienne = async (req) =>
  Candidature.findOne({ _id: req.params.id, user: req.user._id });

// @desc    Mes candidatures
// @route   GET /api/candidatures
// @access  Privé
const listerMesCandidatures = asyncHandler(async (req, res) => {
  const candidatures = await Candidature.find({ user: req.user._id })
    .sort({ updatedAt: -1 })
    .lean();

  // Compteurs par statut, calculés ici : le suivi en a besoin sur chaque
  // écran, et les recalculer côté client à partir d'une liste tronquée
  // donnerait des chiffres faux le jour où la liste sera paginée.
  const parStatut = Object.fromEntries(STATUTS.map((s) => [s, 0]));
  candidatures.forEach((c) => {
    parStatut[c.statut] = (parStatut[c.statut] || 0) + 1;
  });

  res.json({
    total: candidatures.length,
    parStatut,
    candidatures: candidatures.map((c) => ({
      _id: c._id,
      avpSlug: c.avpSlug,
      avpIntitule: c.avpIntitule,
      avpDirection: c.avpDirection,
      statut: c.statut,
      envoyeeLe: c.envoyeeLe,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      // On expose l'état d'avancement, pas le contenu : la liste n'a pas
      // besoin de charger quatre textes longs par ligne.
      piecesRemplies: PIECES.filter((p) => Boolean(c.pieces?.[p]?.contenu)).length,
    })),
  });
});

// @desc    Une candidature, avec ses pièces
// @route   GET /api/candidatures/:id
// @access  Privé
const getCandidature = asyncHandler(async (req, res) => {
  const candidature = await trouverSienne(req);

  if (!candidature) {
    res.status(404);
    throw new Error("Candidature introuvable");
  }

  // L'offre est nécessaire pour connaître la destination en mode production :
  // c'est elle qui porte l'adresse du recruteur. Elle peut avoir disparu de la
  // base — l'écran doit rester consultable, seule la destination manquera.
  const avp = await Avp.findById(candidature.avp);

  // L'interface doit savoir si la rédaction assistée est active : le même
  // écran annonce soit un texte rédigé, soit un brouillon assemblé, et se
  // tromper de message est pire que de n'en afficher aucun.
  //
  // `envoi` est renvoyé avec la candidature pour que le bouton d'envoi puisse
  // annoncer la destination AVANT le clic, et se désactiver avec un motif
  // lisible plutôt que d'échouer après coup.
  res.json({
    ...candidature.toObject(),
    redaction: {
      assistee: iaDisponible(),
      modele: iaDisponible() ? modeleUtilise() : null,
    },
    envoi: {
      ...(await etatEnvoi(avp)),
      manquantes: piecesManquantes(candidature),
    },
  });
});

// @desc    Préparer une candidature pour une offre
// @route   POST /api/candidatures
// @access  Privé
const creerCandidature = asyncHandler(async (req, res) => {
  const { avpSlug } = req.body;

  const avp = await Avp.findOne({ slug: avpSlug });
  if (!avp) {
    res.status(404);
    throw new Error("Cette offre n'existe pas ou n'est plus diffusée.");
  }

  // L'interface masque déjà le bouton sur une offre clôturée ; cette garde est
  // la seule qui protège vraiment. Sans elle, un lien gardé en favori ou une
  // requête directe créerait un dossier qu'aucun employeur ne recevra.
  if (!avp.estOuverte()) {
    res.status(409);
    throw new Error(
      "Les candidatures pour ce poste sont closes. Consultez les offres encore ouvertes.",
    );
  }

  // Une candidature par personne et par offre. On renvoie l'existante plutôt
  // qu'une erreur : le geste de l'utilisateur (« préparer ma candidature »)
  // doit toujours le mener au bon endroit, qu'il l'ait déjà fait ou non.
  const existante = await Candidature.findOne({
    user: req.user._id,
    avp: avp._id,
  });

  if (existante) return res.json(existante);

  const candidature = await Candidature.create({
    user: req.user._id,
    avp: avp._id,
    avpSlug: avp.slug,
    avpIntitule: avp.intitule,
    avpDirection: avp.direction,
    statut: "brouillon",
    historique: [{ statut: "brouillon", note: "Candidature créée" }],
  });

  res.status(201).json(candidature);
});

// @desc    Produire une pièce
// @route   POST /api/candidatures/:id/pieces/:piece
// @access  Privé
//
// L'assemblage actuel est fait par redactionService, sans IA. Voir l'en-tête
// de ce fichier de service pour le point de branchement du modèle.
const genererPiece = asyncHandler(async (req, res) => {
  const { piece } = req.params;

  if (!PIECES.includes(piece)) {
    res.status(400);
    throw new Error("Pièce inconnue");
  }

  const candidature = await trouverSienne(req);
  if (!candidature) {
    res.status(404);
    throw new Error("Candidature introuvable");
  }

  const avp = await Avp.findById(candidature.avp);
  if (!avp) {
    res.status(409);
    throw new Error(
      "L'offre d'origine n'est plus en base : impossible de produire cette pièce.",
    );
  }

  const profil = await Profil.findOne({ user: req.user._id });
  if (!profil || profil.completude() < 30) {
    res.status(400);
    throw new Error(
      "Votre profil est trop incomplet pour produire un document utile. Complétez-le d'abord.",
    );
  }

  // `await` : la rédaction par le modèle est un appel réseau. Sans lui, on
  // enregistrerait une promesse à la place du texte.
  const { contenu, source, modele, critique } = await GENERATEURS[piece](
    profil,
    avp,
    req.user,
  );

  candidature.pieces[piece] = {
    contenu,
    source,
    modele: modele || null,
    critique: critique || undefined,
    genereLe: new Date(),
  };
  await candidature.save();

  res.json(candidature);
});

// @desc    Enregistrer une pièce réécrite à la main
// @route   PUT /api/candidatures/:id/pieces/:piece
// @access  Privé
const modifierPiece = asyncHandler(async (req, res) => {
  const { piece } = req.params;

  if (!PIECES.includes(piece)) {
    res.status(400);
    throw new Error("Pièce inconnue");
  }

  const candidature = await trouverSienne(req);
  if (!candidature) {
    res.status(404);
    throw new Error("Candidature introuvable");
  }

  candidature.pieces[piece] = {
    ...candidature.pieces[piece]?.toObject?.(),
    contenu: req.body.contenu || "",
    // Dès qu'un humain y touche, la pièce lui appartient : on ne la
    // réétiquettera pas « assemblée » ou « rédigée par IA ».
    source: "manuel",
    modifieLe: new Date(),
  };

  await candidature.save();

  res.json(candidature);
});

// @desc    Changer le statut
// @route   PATCH /api/candidatures/:id/statut
// @access  Privé
const changerStatut = asyncHandler(async (req, res) => {
  const { statut, note } = req.body;

  if (!STATUTS.includes(statut)) {
    res.status(400);
    throw new Error("Statut inconnu");
  }

  const candidature = await trouverSienne(req);
  if (!candidature) {
    res.status(404);
    throw new Error("Candidature introuvable");
  }

  candidature.statut = statut;
  candidature.historique.push({ statut, note: note || "" });

  // La date d'envoi n'est posée qu'une fois : repasser par « envoyée » après
  // un retour employeur ne doit pas réécrire la date réelle d'envoi, sur
  // laquelle se calculent les délais de réponse.
  if (statut === "envoyee" && !candidature.envoyeeLe) {
    candidature.envoyeeLe = new Date();
  }

  await candidature.save();

  res.json(candidature);
});

// =============================================================================
// FONCTION ④ — LA CANDIDATURE SORT DU SYSTÈME
// =============================================================================

// Charge d'un coup les trois documents dont toute sortie a besoin, et échoue
// avec un message utilisable plutôt qu'en lisant `undefined` trois lignes plus
// loin.
const chargerPourSortie = async (req, res) => {
  const candidature = await trouverSienne(req);
  if (!candidature) {
    res.status(404);
    throw new Error("Candidature introuvable");
  }

  const avp = await Avp.findById(candidature.avp);
  if (!avp) {
    res.status(409);
    throw new Error(
      "L'offre d'origine n'est plus en base : impossible de constituer le dossier.",
    );
  }

  const profil = await Profil.findOne({ user: req.user._id });
  if (!profil) {
    res.status(400);
    throw new Error("Votre profil est introuvable.");
  }

  return { candidature, avp, profil };
};

// Envoi d'un fichier binaire en téléchargement.
//
// `Content-Length` est posé explicitement : sans lui, le navigateur ne peut pas
// afficher de progression, et certains clients de messagerie refusent une pièce
// jointe de taille inconnue.
const telecharger = (res, { nom, donnees }, type) => {
  res.setHeader("Content-Type", type);
  res.setHeader("Content-Length", donnees.length);
  res.setHeader("Content-Disposition", `attachment; filename="${nom}"`);
  res.send(donnees);
};

// @desc    Télécharger une pièce en PDF
// @route   GET /api/candidatures/:id/pieces/:piece/pdf
// @access  Privé
const telechargerPiece = asyncHandler(async (req, res) => {
  const { piece } = req.params;

  if (!PIECES.includes(piece)) {
    res.status(400);
    throw new Error("Pièce inconnue");
  }

  const { candidature, avp, profil } = await chargerPourSortie(req, res);

  const fichier = await piecePdfSeule(candidature, avp, req.user, profil, piece);

  if (!fichier) {
    res.status(409);
    throw new Error(
      "Cette pièce n'a pas encore été produite : il n'y a rien à télécharger.",
    );
  }

  telecharger(res, fichier, "application/pdf");
});

// @desc    Télécharger le dossier complet en ZIP
// @route   GET /api/candidatures/:id/dossier
// @access  Privé
//
// Les quatre pièces en PDF, rangées en deux dossiers — ce qui part chez
// l'employeur, ce qui reste au candidat — plus le profil en JSON Resume.
const telechargerDossier = asyncHandler(async (req, res) => {
  const { candidature, avp, profil } = await chargerPourSortie(req, res);

  const archive = await dossierZip(candidature, avp, req.user, profil);

  if (archive.pieces.length === 0) {
    res.status(409);
    throw new Error(
      "Aucune pièce n'a encore été produite : le dossier serait vide.",
    );
  }

  telecharger(res, archive, "application/zip");
});

// @desc    Exporter mon profil au format JSON Resume, ciblé sur cette offre
// @route   GET /api/candidatures/:id/resume.json
// @access  Privé
const exporterJsonResume = asyncHandler(async (req, res) => {
  const { avp, profil } = await chargerPourSortie(req, res);

  res.setHeader(
    "Content-Disposition",
    `attachment; filename="profil_${avp.slug}.json"`,
  );
  res.type("application/json").send(
    JSON.stringify(versJsonResume(profil, req.user, avp), null, 2),
  );
});

// @desc    Transmettre la candidature à l'employeur
// @route   POST /api/candidatures/:id/envoi
// @access  Privé
//
// ⚠️ Le destinataire n'est JAMAIS lu depuis l'offre : il vient de
// CANDIDATURE_EMAIL_TEST, et envoiService refuse tout domaine d'employeur
// public réel. Voir l'en-tête de ce service.
const envoyerCandidature = asyncHandler(async (req, res) => {
  const { candidature, avp, profil } = await chargerPourSortie(req, res);

  let trace;
  try {
    trace = await envoyerDossier(candidature, avp, req.user, profil);
  } catch (erreur) {
    // Le service distingue « mal configuré » (503) de « pièces manquantes »
    // (400). Sans ce relais, tout remonterait en 500 et l'écran afficherait
    // « erreur serveur » à quelqu'un à qui il manque simplement une lettre.
    res.status(erreur.statusCode || 500);
    throw erreur;
  }

  candidature.envois.push({
    destinataire: trace.destinataire,
    mode: trace.mode,
    pieces: trace.pieces,
    simule: trace.simule,
    messageId: trace.messageId,
    date: trace.envoyeLe,
  });

  // Le passage au statut « envoyée » est AUTOMATIQUE : demander à la personne
  // de le faire à la main après coup, c'est garantir un suivi faux. La date
  // d'envoi, elle, n'est posée qu'une fois (cf. changerStatut).
  if (!candidature.envoyeeLe) candidature.envoyeeLe = trace.envoyeLe;
  candidature.statut = "envoyee";
  candidature.historique.push({
    statut: "envoyee",
    date: trace.envoyeLe,
    note: trace.simule
      ? `Envoi SIMULÉ vers ${trace.destinataire} (SMTP non configuré) — ${trace.pieces.join(", ")}`
      : `Transmise à ${trace.destinataire}${trace.reel ? " (recruteur réel)" : " (adresse de test)"} — ${trace.pieces.join(", ")}`,
  });

  await candidature.save();

  res.json({ candidature, envoi: trace });
});

// @desc    Supprimer une candidature
// @route   DELETE /api/candidatures/:id
// @access  Privé
const supprimerCandidature = asyncHandler(async (req, res) => {
  const candidature = await trouverSienne(req);

  if (!candidature) {
    res.status(404);
    throw new Error("Candidature introuvable");
  }

  await candidature.deleteOne();

  res.json({ message: "Candidature supprimée", _id: req.params.id });
});

export {
  listerMesCandidatures,
  getCandidature,
  creerCandidature,
  genererPiece,
  modifierPiece,
  changerStatut,
  telechargerPiece,
  telechargerDossier,
  exporterJsonResume,
  envoyerCandidature,
  supprimerCandidature,
};
