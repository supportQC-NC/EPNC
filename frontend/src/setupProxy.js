// src/setupProxy.js
//
// Proxy du serveur de DÉVELOPPEMENT uniquement (`npm start` / `npm run dev`).
// En production, Express sert lui-même le build : ce fichier n'est pas utilisé.
//
// POURQUOI CE FICHIER EN PLUS DU CHAMP "proxy" DE package.json
// Le champ "proxy" ne relaie PAS les requêtes de NAVIGATION — celles dont
// l'en-tête `Accept` contient `text/html`. CRA suppose qu'elles visent
// l'application React et sert index.html à la place. Résultat : ouvrir une URL
// d'API dans un nouvel onglet (téléchargement d'un PDF de candidature, export
// d'un dossier) tombe sur le routeur React, qui affiche « introuvable » alors
// que le backend répond très bien.
//
// Ce middleware est enregistré AVANT le proxy de package.json et relaie /api
// sans condition, ce qui rétablit les ouvertures en nouvel onglet.
const { createProxyMiddleware } = require("http-proxy-middleware");

const CIBLE = process.env.REACT_APP_API_TARGET || "http://localhost:5000";

module.exports = function (app) {
  app.use(
    "/api",
    createProxyMiddleware({
      target: CIBLE,
      changeOrigin: true,
      xfwd: true,
      // Les documents produits par l'API (CV, lettre, dossier complet) peuvent
      // être longs à générer : on laisse du temps.
      proxyTimeout: 120000,
      timeout: 120000,
      logLevel: "warn",
    }),
  );
};
