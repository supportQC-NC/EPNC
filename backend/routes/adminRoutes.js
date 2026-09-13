// backend/routes/adminRoutes.js
import express from "express";
import {
  getDashboard,
  getSources,
  getSmtp,
  testerSmtp,
  envoyerSmtpTest,
  getIngestion,
  lancerIngestion,
  getEnvoi,
  changerModeEnvoi,
} from "../controllers/adminController.js";
import { protect, admin } from "../middleware/authMiddleware.js";

const router = express.Router();

// Tout ce routeur est réservé aux administrateurs : la garde est posée une
// fois pour toutes, plutôt que répétée route par route où l'on finit
// immanquablement par en oublier une.
router.use(protect, admin);

router.get("/dashboard", getDashboard);
router.get("/sources", getSources);

router.get("/ingestion", getIngestion);
router.post("/ingestion/:source", lancerIngestion);

router.route("/envoi").get(getEnvoi).put(changerModeEnvoi);

router.get("/smtp", getSmtp);
router.post("/smtp/test", testerSmtp);
router.post("/smtp/envoi", envoyerSmtpTest);

export default router;
