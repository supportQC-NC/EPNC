// backend/routes/demandeRecruteurRoutes.js
import express from "express";
import {
  deposer,
  listerEmployeurs,
  lister,
  decider,
} from "../controllers/demandeRecruteurController.js";
import { protect, admin } from "../middleware/authMiddleware.js";

const router = express.Router();

// ── Public ──────────────────────────────────────────────────────────────
// Le dépôt est ouvert : quelqu'un qui n'a pas encore de compte doit pouvoir
// demander un accès. C'est précisément le cas d'usage.
//
// ⚠️ Chemin fixe AVANT le chemin paramétré.
router.get("/employeurs", listerEmployeurs);
router.post("/", deposer);

// ── Administration ──────────────────────────────────────────────────────
router.get("/", protect, admin, lister);
router.put("/:id", protect, admin, decider);

export default router;
