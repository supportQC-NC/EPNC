// backend/services/sourcesService.js
//
// Contrôle d'état des sources publiques, et inventaire de ce qui a réellement
// été reçu en base.
//
// Deux questions différentes, et l'écran d'administration doit répondre aux
// deux : « la source répond-elle ? » (est-elle joignable aujourd'hui) et
// « qu'avons-nous reçu ? » (combien de documents, ingérés quand). Une source
// joignable dont on n'a jamais rien ingéré n'est pas un système qui marche.

import { SOURCES } from "../config/sources.js";
import Avp from "../models/AvpModel.js";
import { Famille, Competence, Metier } from "../models/MetierModel.js";

// Court : c'est un tableau de bord, pas un test de disponibilité. Une source
// qui met plus de dix secondes est de toute façon inutilisable en ingestion.
const DELAI_MS = 10000;

const sonder = async (source) => {
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), DELAI_MS);
  const depart = Date.now();

  try {
    // HEAD d'abord : inutile de télécharger 70 Ko de JSONL pour savoir qu'un
    // serveur répond.
    let reponse = await fetch(source.url, {
      method: "HEAD",
      redirect: "follow",
      signal: controleur.signal,
    });

    // Repli en GET dès que HEAD échoue, quel que soit le code.
    //
    // La règle voudrait un 405 « méthode non autorisée ». En pratique, les
    // portails Apigee répondent 403 à un HEAD et 200 au même GET : se fier au
    // code aurait fait afficher « injoignable » sur trois sources qui
    // fonctionnent parfaitement. Un faux négatif sur un tableau de bord de
    // supervision est pire que pas de tableau du tout — on cesse d'y croire.
    if (!reponse.ok) {
      reponse = await fetch(source.url, {
        method: "GET",
        redirect: "follow",
        signal: controleur.signal,
      });
    }

    clearTimeout(minuteur);

    return {
      statut: reponse.ok ? "ok" : "erreur",
      code: reponse.status,
      ms: Date.now() - depart,
      message: reponse.ok ? null : `${reponse.status} ${reponse.statusText}`,
    };
  } catch (erreur) {
    clearTimeout(minuteur);

    return {
      statut: "erreur",
      code: null,
      ms: Date.now() - depart,
      message:
        erreur.name === "AbortError"
          ? `Pas de réponse en moins de ${DELAI_MS / 1000} s`
          : erreur.message,
    };
  }
};

// Ce que contient réellement la base, par collection alimentée.
const inventaire = async () => {
  const [avps, familles, competences, metiers, dernierAvp, dernierMetier] =
    await Promise.all([
      Avp.countDocuments(),
      Famille.countDocuments(),
      Competence.countDocuments(),
      Metier.countDocuments(),
      Avp.findOne({}, "updatedAt").sort({ updatedAt: -1 }).lean(),
      Metier.findOne({}, "updatedAt").sort({ updatedAt: -1 }).lean(),
    ]);

  return {
    avps: { total: avps, majLe: dernierAvp?.updatedAt || null },
    familles: { total: familles, majLe: dernierMetier?.updatedAt || null },
    competences: { total: competences, majLe: dernierMetier?.updatedAt || null },
    metiers: { total: metiers, majLe: dernierMetier?.updatedAt || null },
  };
};

export const etatDesSources = async () => {
  // Les sondes partent en parallèle : à la file, douze sources à une seconde
  // chacune feraient attendre douze secondes devant un écran vide.
  const [sondes, contenu] = await Promise.all([
    Promise.all(SOURCES.map((s) => sonder(s))),
    inventaire(),
  ]);

  const sources = SOURCES.map((s, i) => ({
    ...s,
    sonde: sondes[i],
    recu: s.collection ? contenu[s.collection] || null : null,
  }));

  const joignables = sources.filter((s) => s.sonde.statut === "ok").length;
  const ingerees = sources.filter((s) => s.ingeree);
  const ingereesVides = ingerees.filter((s) => !s.recu || s.recu.total === 0);

  return {
    resume: {
      total: sources.length,
      joignables,
      injoignables: sources.length - joignables,
      ingerees: ingerees.length,
      // Une source ingérable dont la collection est vide : le script n'a
      // jamais tourné, ou il a échoué. C'est l'alerte utile de cet écran.
      ingereesVides: ingereesVides.length,
      documentsEnBase: Object.values(contenu).reduce((t, c) => t + c.total, 0),
    },
    contenu,
    sources,
  };
};
