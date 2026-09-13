// Enveloppe un contrôleur asynchrone pour que toute promesse rejetée parte
// dans `next()` — donc dans errorHandler — au lieu de rester silencieuse.
// Évite un try/catch dans chaque contrôleur.
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;
