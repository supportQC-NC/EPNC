// backend/routes/candidatureRoutes.js
import express from "express";
import {
  listerMesCandidatures,
  getCandidature,
  creerCandidature,
  genererPiece,
  preparerDossier,
  modifierPiece,
  changerStatut,
  telechargerPiece,
  telechargerDossier,
  exporterJsonResume,
  envoyerCandidature,
  supprimerCandidature,
} from "../controllers/candidatureController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.route("/").get(listerMesCandidatures).post(creerCandidature);

router.route("/:id").get(getCandidature).delete(supprimerCandidature);

router.patch("/:id/statut", changerStatut);

// ── Fonction ④ : les sorties ────────────────────────────────────────────
// Trois formes, parce que les besoins ne sont pas les mêmes : une pièce seule
// à relire, le dossier complet à conserver, la transmission à l'employeur.
// Les quatre pièces d'un coup : le geste qui transforme une alerte en dossier.
router.post("/:id/preparer", preparerDossier);
router.get("/:id/dossier", telechargerDossier);
router.get("/:id/resume.json", exporterJsonResume);
router.post("/:id/envoi", envoyerCandidature);

// ⚠️ Chemin fixe AVANT le chemin paramétré : sans cela, « dossier » serait pris
// pour un identifiant de candidature. Les routes ci-dessus le respectent — elles
// sont toutes sous /:id, jamais à la racine du routeur.

// POST = produire la pièce, PUT = enregistrer une réécriture manuelle.
router.route("/:id/pieces/:piece").post(genererPiece).put(modifierPiece);

router.get("/:id/pieces/:piece/pdf", telechargerPiece);

export default router;
