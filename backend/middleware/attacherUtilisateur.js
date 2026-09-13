// backend/middleware/attacherUtilisateur.js
import jwt from "jsonwebtoken";
import User from "../models/UserModel.js";

// Authentification OPTIONNELLE.
//
// Pose `req.user` si un jeton valide accompagne la requête, et laisse passer
// sinon. Utile pour les pages dont le contenu de base est public mais qui
// s'enrichissent quand on est connecté : la fiche d'un métier est consultable
// par tous, et affiche en plus « où vous en êtes » à qui a un profil.
//
// À ne jamais confondre avec `protect` : ce middleware ne protège rien. Toute
// donnée réservée doit être gardée par `protect`.
const attacherUtilisateur = async (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) return next();

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (user?.isActive) req.user = user;
  } catch {
    // Jeton illisible ou expiré : on continue en visiteur anonyme. Renvoyer
    // une erreur ici casserait une page publique pour cause de session morte.
  }

  next();
};

export default attacherUtilisateur;
