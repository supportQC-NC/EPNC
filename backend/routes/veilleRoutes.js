// backend/routes/veilleRoutes.js
import express from "express";
import {
  mesAlertes,
  marquerLues,
  majPreferences,
  lancerTour,
} from "../controllers/veilleController.js";
import { protect, admin } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.route("/alertes").get(mesAlertes).patch(marquerLues);
router.put("/preferences", majPreferences);

// Déclenchement manuel : la veille part normalement de l'ingestion.
router.post("/tour", admin, lancerTour);

export default router;
