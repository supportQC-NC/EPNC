// backend/routes/userRoutes.js
import express from "express";
import {
  authUser,
  registerUser,
  logoutUser,
  getUserProfile,
  updateUserProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  toggleUserActive,
} from "../controllers/userControlleur.js";
import { protect, admin } from "../middleware/authMiddleware.js";

const router = express.Router();

// ── Public ──────────────────────────────────────────────────────────────
// ⚠️ Ces routes doivent rester AVANT toute route paramétrée (`/:id`), sinon
// "login" serait pris pour un identifiant. La règle vaut pour tout ajout
// futur : chemin fixe d'abord, chemin paramétré ensuite.
router.post("/login", authUser);
router.post("/register", registerUser);
router.post("/forgot-password", forgotPassword);
router.put("/reset-password/:token", resetPassword);

// Déconnexion volontairement publique : elle doit rester possible avec un
// jeton expiré ou absent.
router.post("/logout", logoutUser);

// ── Privé (compte connecté) — self-service ──────────────────────────────
// Également avant `/:id` : sans cela, "profile" serait interprété comme un
// identifiant de compte.
router.get("/profile", protect, getUserProfile);
router.put("/profile", protect, updateUserProfile);
router.put("/profile/password", protect, changePassword);

// ── Administration des comptes ──────────────────────────────────────────
router.route("/").get(protect, admin, getUsers).post(protect, admin, createUser);

router
  .route("/:id")
  .get(protect, admin, getUserById)
  .put(protect, admin, updateUser)
  .delete(protect, admin, deleteUser);

router.patch("/:id/toggle-active", protect, admin, toggleUserActive);

export default router;
