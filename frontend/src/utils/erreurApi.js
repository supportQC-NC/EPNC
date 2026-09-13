// src/utils/erreurApi.js

// Traduit une erreur RTK Query en message lisible.
//
// POURQUOI CENTRALISER : chaque écran écrivait `err?.data?.message || "…"`.
// Or `err.data` n'existe QUE si le serveur a répondu avec du JSON. Quand il ne
// répond pas du tout — backend arrêté, proxy de développement coupé, réseau
// tombé — il n'y a pas de `data`, et tous les écrans affichaient leur repli
// générique (« Connexion impossible. Réessayez. »). Ce message envoie chercher
// une faute de frappe dans un mot de passe alors que le serveur est éteint.
//
// Les formes d'erreur produites par fetchBaseQuery :
//   { status: "FETCH_ERROR" }    → la requête n'a jamais abouti
//   { status: "TIMEOUT_ERROR" }  → pas de réponse à temps
//   { status: "PARSING_ERROR", originalStatus } → réponse non-JSON (du HTML,
//        typiquement : le proxy a servi index.html au lieu d'atteindre l'API)
//   { status: 401 | 404 | 500…, data } → réponse HTTP normale

const SERVEUR_INJOIGNABLE =
  process.env.NODE_ENV === "development"
    ? "Le serveur ne répond pas. Vérifiez qu'il est démarré (npm run dev), puis rechargez la page."
    : "Le service est momentanément indisponible. Réessayez dans quelques instants.";

// 502/503/504 : c'est un intermédiaire qui répond (proxy de développement,
// reverse proxy en production), pas l'application. Le backend est arrêté,
// planté, ou pas encore prêt. Le remède est toujours le même — le démarrer —
// et c'est ce qu'il faut dire, plutôt que de citer un code HTTP.
const estPasserelleMuette = (code) => code === 502 || code === 503 || code === 504;

export const messageErreur = (err, repli = "Une erreur est survenue.") => {
  if (!err) return repli;

  if (err.status === "FETCH_ERROR") return SERVEUR_INJOIGNABLE;

  if (err.status === "TIMEOUT_ERROR") {
    return "Le serveur met trop de temps à répondre. Réessayez dans un instant.";
  }

  if (err.status === "PARSING_ERROR") {
    if (estPasserelleMuette(err.originalStatus)) return SERVEUR_INJOIGNABLE;

    return process.env.NODE_ENV === "development"
      ? `Réponse inattendue du serveur (code ${err.originalStatus}) : ce n'est pas du JSON. Vérifiez que la route existe côté API.`
      : repli;
  }

  if (estPasserelleMuette(err.status)) return SERVEUR_INJOIGNABLE;

  // Message renvoyé par notre API (errorMiddleware) : c'est le cas nominal,
  // et c'est lui qui doit primer.
  if (typeof err.data?.message === "string" && err.data.message.trim()) {
    return err.data.message;
  }

  if (typeof err.data === "string" && err.data.trim()) return err.data;

  if (err.status === 404) return "Cette ressource est introuvable.";

  if (typeof err.status === "number" && err.status >= 500) {
    return "Le serveur a rencontré une erreur. Réessayez dans un instant.";
  }

  return repli;
};
