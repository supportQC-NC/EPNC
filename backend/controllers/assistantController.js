// backend/controllers/assistantController.js
import asyncHandler from "../middleware/asyncHandler.js";
import Conversation from "../models/ConversationModel.js";
import { repondre, titreDepuis } from "../services/assistantService.js";
import { iaDisponible, modeleUtilise } from "../services/modeleService.js";

// Longueur maximale d'une question.
//
// Garde-fou de coût autant que d'usage : sans plafond, un copier-coller de CV
// entier part dans chaque tour suivant via l'historique, et la facture grimpe
// sans que personne ne comprenne pourquoi.
const LONGUEUR_MAX = 2000;

// Comme pour les candidatures : on ne cherche jamais une conversation sans
// filtrer sur son propriétaire.
const trouverSienne = async (req) =>
  Conversation.findOne({ _id: req.params.id, user: req.user._id });

// @desc    État du service (l'interface doit savoir s'il est disponible)
// @route   GET /api/assistant/etat
// @access  Privé
const getEtat = asyncHandler(async (req, res) => {
  res.json({
    disponible: iaDisponible(),
    modele: iaDisponible() ? modeleUtilise() : null,
    avertissementAccepte: Boolean(req.user.avertissementIaAccepteLe),
    avertissementAccepteLe: req.user.avertissementIaAccepteLe,
  });
});

// @desc    Enregistrer la prise de connaissance de l'avertissement
// @route   POST /api/assistant/avertissement
// @access  Privé
//
// La date n'est posée qu'une fois : rouvrir l'assistant plus tard ne doit pas
// réécrire la date de la première prise de connaissance, qui est la seule qui
// ait une valeur probante.
const accepterAvertissement = asyncHandler(async (req, res) => {
  if (!req.user.avertissementIaAccepteLe) {
    req.user.avertissementIaAccepteLe = new Date();
    await req.user.save({ validateBeforeSave: false });
  }

  res.json({
    disponible: iaDisponible(),
    modele: iaDisponible() ? modeleUtilise() : null,
    avertissementAccepte: true,
    avertissementAccepteLe: req.user.avertissementIaAccepteLe,
  });
});

// @desc    Mes conversations (sans les messages)
// @route   GET /api/assistant/conversations
// @access  Privé
const listerConversations = asyncHandler(async (req, res) => {
  const conversations = await Conversation.find(
    { user: req.user._id },
    "titre updatedAt messages",
  )
    .sort({ updatedAt: -1 })
    .limit(50)
    .lean();

  res.json(
    conversations.map((c) => ({
      _id: c._id,
      titre: c.titre,
      updatedAt: c.updatedAt,
      nbMessages: c.messages?.length || 0,
    })),
  );
});

// @desc    Une conversation avec ses messages
// @route   GET /api/assistant/conversations/:id
// @access  Privé
const getConversation = asyncHandler(async (req, res) => {
  const conversation = await trouverSienne(req);

  if (!conversation) {
    res.status(404);
    throw new Error("Conversation introuvable");
  }

  res.json(conversation);
});

// @desc    Poser une question
// @route   POST /api/assistant/messages
// @access  Privé
//
// `conversationId` optionnel : absent, une conversation est créée. L'interface
// n'a donc pas à distinguer « démarrer » de « poursuivre ».
const envoyerMessage = asyncHandler(async (req, res) => {
  const { question, conversationId } = req.body;

  if (!question?.trim()) {
    res.status(400);
    throw new Error("Votre question est vide.");
  }
  if (question.length > LONGUEUR_MAX) {
    res.status(400);
    throw new Error(
      `Votre message est trop long (${question.length} caractères, maximum ${LONGUEUR_MAX}). Posez une question plus courte.`,
    );
  }
  if (!iaDisponible()) {
    res.status(503);
    throw new Error(
      "L'assistant est momentanément indisponible. Le reste du site fonctionne normalement.",
    );
  }

  // Garde réelle, pas décorative : sans elle, l'avertissement ne serait qu'une
  // fenêtre qu'on referme, contournable en appelant l'API directement.
  if (!req.user.avertissementIaAccepteLe) {
    res.status(403);
    throw new Error(
      "Vous devez d'abord prendre connaissance des limites de l'assistant.",
    );
  }

  let conversation;

  if (conversationId) {
    conversation = await trouverSienne({ ...req, params: { id: conversationId } });
    if (!conversation) {
      res.status(404);
      throw new Error("Conversation introuvable");
    }
  } else {
    conversation = await Conversation.create({
      user: req.user._id,
      titre: titreDepuis(question),
      messages: [],
    });
  }

  // L'historique est lu AVANT d'y ajouter la question courante : elle est
  // transmise à part, et l'y inclure la ferait apparaître deux fois.
  const historique = conversation.messages.map((m) => ({
    role: m.role,
    contenu: m.contenu,
  }));

  const reponse = await repondre(req.user, historique, question.trim());

  conversation.messages.push({ role: "utilisateur", contenu: question.trim() });
  conversation.messages.push({ role: "assistant", contenu: reponse });
  await conversation.save();

  res.json(conversation);
});

// @desc    Supprimer une conversation
// @route   DELETE /api/assistant/conversations/:id
// @access  Privé
const supprimerConversation = asyncHandler(async (req, res) => {
  const conversation = await trouverSienne(req);

  if (!conversation) {
    res.status(404);
    throw new Error("Conversation introuvable");
  }

  await conversation.deleteOne();

  res.json({ message: "Conversation supprimée", _id: req.params.id });
});

export {
  getEtat,
  accepterAvertissement,
  listerConversations,
  getConversation,
  envoyerMessage,
  supprimerConversation,
};
