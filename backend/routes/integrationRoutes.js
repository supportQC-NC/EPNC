import express from "express";
import { cleApi } from "../middleware/cleApiMiddleware.js";
import { rapprochement, dossier } from "../controllers/integrationController.js";

const router = express.Router();

// L'API machine. Chaque route exige sa portée, déclarée une fois ici : une
// permission vérifiée dans le corps du contrôleur finit par être oubliée dans
// le contrôleur suivant.
//
// ⚠️ La LECTURE du catalogue n'est volontairement pas ici. Les offres sont de
// la donnée publique, déjà servies sans clé par `GET /api/avps` et
// `GET /api/avps/:slug/jobposting`. Les redoubler derrière une clé
// signifierait « nos données ouvertes ne sont ouvertes qu'à ceux que nous
// connaissons », et créerait surtout un second chemin de code à maintenir.
// Une clé n'est demandée que pour ce qui coûte : le calcul et la rédaction.

router.post("/rapprochement", cleApi("rapprochement:calculer"), rapprochement);
router.post("/dossier", cleApi("dossier:produire"), dossier);

export default router;
