// 404 — aucune route ne correspond.
const notFound = (req, res, next) => {
  const error = new Error(`Introuvable - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

// Gestionnaire d'erreurs global. Traduit les erreurs Mongoose en messages
// lisibles : le front affiche `message` tel quel.
const errorHandler = (err, req, res, next) => {
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message;

  // ObjectId mal formé
  if (err.name === "CastError" && err.kind === "ObjectId") {
    statusCode = 404;
    message = "Ressource non trouvée";
  }

  // Erreur de validation de schéma
  if (err.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(", ");
  }

  // Violation d'index unique (email déjà pris, typiquement)
  if (err.code === 11000) {
    statusCode = 400;
    message = "Cette valeur est déjà utilisée";
  }

  res.status(statusCode).json({
    message,
    stack: process.env.NODE_ENV === "production" ? null : err.stack,
  });
};

export { notFound, errorHandler };
