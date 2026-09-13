// backend/middleware/authMiddleware.js
import jwt from "jsonwebtoken";
import asyncHandler from "./asyncHandler.js";
import User from "../models/UserModel.js";

// ⚠️ Les messages des 401 sont affichés TELS QUELS par le front (il ne les
// réécrit pas) : ils doivent dire à la personne ce qu'elle a à faire.
// « Token non valide » ne veut rien dire pour un candidat — il faut lui
// demander de se reconnecter.
const MSG_SESSION = "Session expirée : reconnectez-vous.";

// Exige un jeton valide. Pose `req.user` (sans le mot de passe).
const protect = asyncHandler(async (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    res.status(401);
    throw new Error(MSG_SESSION);
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    res.status(401);
    // Jeton illisible ou expiré : le cookie est encore là mais ne vaut plus
    // rien. Se reconnecter en pose un neuf.
    throw new Error(MSG_SESSION);
  }

  req.user = await User.findById(decoded.userId);

  // Jeton valide mais compte INCONNU : compte supprimé, ou jeton émis sur une
  // autre base (le JWT_SECRET est souvent partagé entre environnements, pas les
  // utilisateurs). Sans ce garde-fou, `req.user` reste null et la première
  // lecture de `.role` renvoie une 500 illisible au lieu de redemander une
  // connexion.
  if (!req.user) {
    res.status(401);
    throw new Error(MSG_SESSION);
  }

  // Compte désactivé : le jeton reste cryptographiquement valide jusqu'à son
  // expiration, c'est donc ici qu'on coupe l'accès — pas seulement au login.
  if (!req.user.isActive) {
    res.status(401);
    throw new Error("Votre compte a été désactivé. Contactez un administrateur.");
  }

  next();
});

// Réserve une route aux administrateurs.
const admin = (req, res, next) => {
  if (req.user && req.user.role === "admin") return next();
  res.status(403);
  throw new Error("Accès réservé aux administrateurs");
};

// Réserve une route à une liste de rôles : checkRole("admin", "recruteur").
// Point d'extension prévu : quand les droits deviendront plus fins qu'un rôle
// (par module, par périmètre), c'est ici que se branchera le contrôle — la
// signature des routes n'aura pas à changer.
const checkRole =
  (...roles) =>
  (req, res, next) => {
    if (req.user && roles.includes(req.user.role)) return next();
    res.status(403);
    throw new Error("Vous n'avez pas les droits pour cette action");
  };

export { protect, admin, checkRole };
