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
import {
  listerCles,
  creerCle,
  revoquerCle,
} from "../controllers/cleApiController.js";
import {
  listerWebhooks,
  creerWebhook,
  basculerWebhook,
  supprimerWebhook,
  testerWebhook,
} from "../controllers/webhookController.js";
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

// Clés d'API : l'accès machine. Sous /admin parce que décider qui consomme
// la plateforme est un acte d'exploitation, pas un réglage d'utilisateur.
router.route("/cles").get(listerCles).post(creerCle);
router.delete("/cles/:id", revoquerCle);

router.route("/webhooks").get(listerWebhooks).post(creerWebhook);
// Chemin fixe avant chemin paramétré : « :id/test » est plus spécifique, il
// doit être déclaré avant la route qui accepte n'importe quel :id.
router.post("/webhooks/:id/test", testerWebhook);
router.route("/webhooks/:id").put(basculerWebhook).delete(supprimerWebhook);

router.get("/smtp", getSmtp);
router.post("/smtp/test", testerSmtp);
router.post("/smtp/envoi", envoyerSmtpTest);

export default router;
