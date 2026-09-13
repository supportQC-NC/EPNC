// backend/routes/avpRoutes.js
import express from "express";
import {
  listerAvps,
  getAvpApercu,
  getAvpComplet,
  getAvpJsonLd,
} from "../controllers/avpController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// ── Public ──────────────────────────────────────────────────────────────
router.get("/", listerAvps);
router.get("/:slug", getAvpApercu);
router.get("/:slug/jobposting", getAvpJsonLd);

// ── Privé ───────────────────────────────────────────────────────────────
// La fiche complète est le premier bénéfice concret d'un compte.
router.get("/:slug/complet", protect, getAvpComplet);

export default router;
