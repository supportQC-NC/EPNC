// backend/routes/profilRoutes.js
import express from "express";
import { getMonProfil, updateMonProfil } from "../controllers/profilController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Le profil est toujours celui de la personne connectée : aucun identifiant
// dans l'URL. C'est ce qui rend impossible, par construction, de lire le
// profil de quelqu'un d'autre en changeant un chiffre dans l'adresse.
router.use(protect);

router.route("/").get(getMonProfil).put(updateMonProfil);

export default router;
