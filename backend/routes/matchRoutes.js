// backend/routes/matchRoutes.js
import express from "express";
import { getMatchs, getMatch } from "../controllers/matchController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Le rapprochement porte toujours sur le profil de la personne connectée :
// aucun identifiant de profil dans l'URL.
router.use(protect);

router.get("/", getMatchs);
router.get("/:slug", getMatch);

export default router;
