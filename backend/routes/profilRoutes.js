// backend/routes/profilRoutes.js
import express from "express";
import {
  getMonProfil,
  updateMonProfil,
  apercuImport,
  importerProfil,
} from "../controllers/profilController.js";
import {
  getEntretien,
  mettreEnFormeExperience,
  mettreEnFormeFormations,
  mettreEnFormeRecherche,
} from "../controllers/entretienController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Le profil est toujours celui de la personne connectée : aucun identifiant
// dans l'URL. C'est ce qui rend impossible, par construction, de lire le
// profil de quelqu'un d'autre en changeant un chiffre dans l'adresse.
router.use(protect);

router.route("/").get(getMonProfil).put(updateMonProfil);

// Import d'un JSON Resume. Chemin fixe, donc sans ambiguïté avec la racine.
// L'aperçu n'écrit rien : il existe pour que la personne voie ce qui sera
// remplacé et ce qui a été interprété, AVANT que ce soit son CV.
router.post("/import/apercu", apercuImport);
router.post("/import", importerProfil);

// L'entretien guidé : la porte pour qui n'a pas de CV. Ces routes PROPOSENT,
// elles n'écrivent rien — l'enregistrement passe par PUT /api/profil, comme
// pour la saisie manuelle.
router.get("/entretien", getEntretien);
router.post("/entretien/experience", mettreEnFormeExperience);
router.post("/entretien/formations", mettreEnFormeFormations);
router.post("/entretien/recherche", mettreEnFormeRecherche);

export default router;
