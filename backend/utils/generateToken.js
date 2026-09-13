import jwt from "jsonwebtoken";

// Émet un JWT et le pose dans un cookie httpOnly nommé `token`.
//
// Pourquoi un cookie plutôt qu'un en-tête Bearer : httpOnly rend le jeton
// illisible par JavaScript, donc inexploitable par une injection XSS. En
// contrepartie le front doit envoyer `credentials: "include"` et le backend
// activer `credentials: true` côté CORS — les deux sont faits.
const generateToken = (res, userId) => {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: "24h",
  });

  res.cookie("token", token, {
    httpOnly: true,
    // En développement le front est en http://localhost : un cookie `secure`
    // ne serait jamais envoyé.
    secure: process.env.NODE_ENV !== "development",
    sameSite: "strict",
    maxAge: 24 * 60 * 60 * 1000,
  });

  return token;
};

export default generateToken;
