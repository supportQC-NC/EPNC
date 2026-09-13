// backend/controllers/entretienController.js
//
// L'entretien guidé : mise en forme des réponses, étape par étape.
//
// ══════════════════════════════════════════════════════════════════════════
//  AUCUNE DE CES ROUTES N'ÉCRIT DANS LE PROFIL
// ══════════════════════════════════════════════════════════════════════════
// Elles PROPOSENT. L'enregistrement passe par `PUT /api/profil`, comme pour la
// saisie manuelle — c'est-à-dire après que la personne a vu, corrigé et
// validé ce qui allait être écrit.
//
// Ce n'est pas une précaution de style. Un entretien qui remplit le profil au
// fil de l'eau produit un CV que son auteur découvre à la fin, et qu'il ne
// peut pas défendre en entretien d'embauche. Ici, chaque phrase du profil est
// passée devant ses yeux avant d'exister.
//
// Conséquence utile : ces routes sont sans effet de bord, donc rejouables.
// Reformuler trois fois la même réponse ne laisse aucune trace.

import asyncHandler from "../middleware/asyncHandler.js";
import {
  ETAPES,
  structurerExperience,
  structurerFormations,
  structurerRecherche,
  rapprocherCompetences,
} from "../services/entretienService.js";
import { iaDisponible } from "../services/modeleService.js";

// @desc    Les étapes de l'entretien
// @route   GET /api/profil/entretien
// @access  Privé
//
// Les questions viennent du SERVEUR, pas de l'interface. Elles sont le cœur du
// dispositif — c'est leur formulation qui décide si quelqu'un comprend que son
// bénévolat compte — et les dupliquer côté client les ferait diverger le jour
// où on les retouche.
const getEntretien = asyncHandler(async (req, res) => {
  res.json({
    etapes: ETAPES,
    // Annoncé d'emblée : l'interface doit prévenir AVANT que la personne
    // raconte sa vie, pas après, que ses réponses seront reprises telles
    // quelles faute de modèle disponible.
    reformulation: iaDisponible(),
  });
});

// @desc    Mettre en forme un récit d'expérience
// @route   POST /api/profil/entretien/experience
// @access  Privé
const mettreEnFormeExperience = asyncHandler(async (req, res) => {
  const recit = req.body?.recit;

  let resultat;
  try {
    resultat = await structurerExperience(recit);
  } catch (erreur) {
    // Récit trop court, ou mise en forme illisible : c'est une réponse à
    // corriger, pas une panne. 422 plutôt que 500, et le message est affiché
    // tel quel à la personne.
    res.status(422);
    throw erreur;
  }

  // Les compétences repérées dans le récit, rapprochées du vocabulaire du
  // référentiel. C'est le geste central pour quelqu'un sans CV : « je tenais
  // la caisse » devient une compétence que le moteur sait confronter à une
  // offre.
  const competences = await rapprocherCompetences(resultat.competences);

  res.json({ ...resultat, competences });
});

// @desc    Mettre en forme des formations
// @route   POST /api/profil/entretien/formations
// @access  Privé
const mettreEnFormeFormations = asyncHandler(async (req, res) => {
  res.json(await structurerFormations(req.body?.recit));
});

// @desc    Mettre en forme le projet professionnel
// @route   POST /api/profil/entretien/recherche
// @access  Privé
const mettreEnFormeRecherche = asyncHandler(async (req, res) => {
  res.json(await structurerRecherche(req.body?.recit));
});

export {
  getEntretien,
  mettreEnFormeExperience,
  mettreEnFormeFormations,
  mettreEnFormeRecherche,
};
