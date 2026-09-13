// backend/routes/recruteurRoutes.js
import express from "express";
import {
  listerCandidats,
  getCandidat,
  telechargerCv,
  telechargerResume,
  candidatsPourOffre,
} from "../controllers/recruteurController.js";
import {
  getProfilRecruteur,
  majProfilRecruteur,
  listerListes,
  creerListe,
  majListe,
  supprimerListe,
  ajouterCandidat,
  retirerCandidat,
  getSuggestions,
  getTableauDeBord,
} from "../controllers/recruteurEspaceController.js";
import { protect, checkRole } from "../middleware/authMiddleware.js";

const router = express.Router();

// Réservé aux recruteurs et aux administrateurs. La garde est posée une fois
// pour toutes sur le routeur : répétée route par route, on finit toujours par
// en oublier une — et ici, l'oubli exposerait des profils de candidats.
//
// `checkRole` existait déjà dans authMiddleware, sans usage. C'est exactement
// le cas prévu.
router.use(protect, checkRole("recruteur", "admin"));

// ── Espace de travail du recruteur ──────────────────────────────────────
// ⚠️ Chemins FIXES avant les chemins paramétrés : sans cela, « profil » ou
// « suggestions » seraient pris pour des identifiants de candidat.
router.get("/tableau-de-bord", getTableauDeBord);
router.get("/suggestions", getSuggestions);
router.route("/profil").get(getProfilRecruteur).put(majProfilRecruteur);

router.route("/listes").get(listerListes).post(creerListe);
router.route("/listes/:id").put(majListe).delete(supprimerListe);
router.post("/listes/:id/candidats", ajouterCandidat);
router.delete("/listes/:id/candidats/:profilId", retirerCandidat);

// ── Le vivier ───────────────────────────────────────────────────────────
router.get("/candidats", listerCandidats);
router.get("/candidats/:id", getCandidat);
router.get("/candidats/:id/cv", telechargerCv);
router.get("/candidats/:id/resume.json", telechargerResume);

// Le rapprochement dans l'autre sens : d'une offre vers le vivier.
router.get("/offres/:slug/candidats", candidatsPourOffre);

export default router;
