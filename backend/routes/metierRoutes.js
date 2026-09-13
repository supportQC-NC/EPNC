// backend/routes/metierRoutes.js
import express from "express";
import {
  listerMetiers,
  getMetier,
  listerCompetences,
} from "../controllers/metierController.js";
import attacherUtilisateur from "../middleware/attacherUtilisateur.js";

const router = express.Router();

router.get("/", listerMetiers);

// ⚠️ Chemin fixe AVANT le chemin paramétré, sinon « competences » serait pris
// pour un code métier.
router.get("/competences/liste", listerCompetences);

// Authentification optionnelle : la fiche est publique, et s'enrichit de
// l'analyse d'écart pour qui est connecté avec un profil rempli.
router.get("/:code", attacherUtilisateur, getMetier);

export default router;
