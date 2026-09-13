// backend/routes/assistantRoutes.js
import express from "express";
import {
  getEtat,
  accepterAvertissement,
  listerConversations,
  getConversation,
  envoyerMessage,
  supprimerConversation,
} from "../controllers/assistantController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// L'assistant s'appuie sur le profil et les candidatures de la personne : il
// n'a aucun sens hors session.
router.use(protect);

router.get("/etat", getEtat);
router.post("/avertissement", accepterAvertissement);
router.post("/messages", envoyerMessage);

router.get("/conversations", listerConversations);
router
  .route("/conversations/:id")
  .get(getConversation)
  .delete(supprimerConversation);

export default router;
