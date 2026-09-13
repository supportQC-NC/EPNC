// backend/routes/moderationRoutes.js
import express from "express";
import {
  signaler,
  mesSignalements,
  listerSignalements,
  instruireSignalement,
  contacterPartie,
  faireAppel,
  getEcheances,
  appliquerEcheances,
} from "../controllers/moderationController.js";
import { protect, admin } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

// ── Tout compte connecté ────────────────────────────────────────────────
// Signaler n'est pas réservé aux recruteurs : un candidat qui repère un
// contenu inapproprié doit pouvoir le dire. La cible, elle, reste un compte.
router.post("/signalements", signaler);
router.get("/mes-signalements", mesSignalements);
// Le recours est ouvert aux DEUX parties : le contrôleur vérifie que
// l'appelant est bien l'une d'elles.
router.post("/signalements/:id/appel", faireAppel);

// ── Administration ──────────────────────────────────────────────────────
// ⚠️ Chemin fixe AVANT le chemin paramétré : « mes-signalements » ne doit pas
// être pris pour un identifiant.
router.get("/signalements", admin, listerSignalements);
router.route("/echeances").get(admin, getEcheances).post(admin, appliquerEcheances);
router.put("/signalements/:id", admin, instruireSignalement);
router.post("/signalements/:id/contact", admin, contacterPartie);

export default router;
