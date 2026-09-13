// backend/services/webhookService.js
//
// Émission des webhooks.

import crypto from "crypto";
import Webhook, { ECHECS_AVANT_SUSPENSION } from "../models/WebhookModel.js";

// Au-delà, on abandonne l'envoi. Un destinataire qui met plus de dix secondes
// à accuser réception fait le travail dans sa réponse au lieu de l'empiler :
// c'est son problème d'architecture, et il ne doit pas devenir le nôtre en
// allongeant chaque ingestion.
const DELAI_MS = 10_000;

// Trois tentatives, espacées. Un redémarrage ou un pic de charge chez le
// destinataire ne doit pas coûter un lot d'offres ; une panne durable, si —
// elle se voit alors dans `echecsConsecutifs`.
const TENTATIVES = 3;
const ATTENTE_MS = [0, 1_000, 5_000];

/**
 * Signature d'une charge utile.
 *
 * HMAC-SHA256 du corps EXACT tel qu'il part sur le réseau. On signe la chaîne
 * déjà sérialisée, jamais l'objet : deux sérialisations JSON d'un même objet
 * peuvent différer par l'ordre des clés, et le destinataire recalculerait
 * alors une signature qui ne correspond pas.
 */
export const signer = (corps, secret) =>
  `sha256=${crypto.createHmac("sha256", secret).update(corps, "utf8").digest("hex")}`;

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

// Envoie une charge utile à un abonnement, avec ses tentatives.
const emettreVers = async (abonnement, evenement, charge) => {
  const corps = JSON.stringify({
    evenement,
    emisLe: new Date().toISOString(),
    ...charge,
  });

  let derniereErreur = "";

  for (let essai = 0; essai < TENTATIVES; essai++) {
    if (ATTENTE_MS[essai]) await attendre(ATTENTE_MS[essai]);

    // `AbortController` plutôt que de faire confiance au délai par défaut de
    // `fetch` : il n'y en a pas. Sans cela, une URL qui accepte la connexion
    // et ne répond jamais bloque l'ingestion indéfiniment.
    const abandon = AbortSignal.timeout(DELAI_MS);

    try {
      const reponse = await fetch(abonnement.url, {
        method: "POST",
        signal: abandon,
        headers: {
          "Content-Type": "application/json",
          "X-EPNC-Signature": signer(corps, abonnement.secret),
          "X-EPNC-Evenement": evenement,
          // Permet au destinataire d'écarter un rejeu : deux réceptions du
          // même identifiant sont le même lot, pas deux lots.
          "X-EPNC-Livraison": crypto.randomUUID(),
          "User-Agent": "EmploiPublicNC-Webhook/1",
        },
        body: corps,
      });

      if (reponse.ok) {
        await Webhook.updateOne(
          { _id: abonnement._id },
          {
            $set: {
              dernierSucces: new Date(),
              echecsConsecutifs: 0,
              derniereErreur: "",
            },
            $inc: { nbEmissions: 1 },
          },
        );
        return { ok: true, statut: reponse.status, essais: essai + 1 };
      }

      derniereErreur = `HTTP ${reponse.status}`;

      // 4xx : le destinataire a compris et refuse. Réessayer à l'identique ne
      // changera rien — sauf pour 408 et 429, qui demandent explicitement de
      // recommencer plus tard.
      if (
        reponse.status >= 400 &&
        reponse.status < 500 &&
        ![408, 429].includes(reponse.status)
      ) {
        break;
      }
    } catch (erreur) {
      derniereErreur =
        erreur.name === "TimeoutError"
          ? `Pas de réponse en ${DELAI_MS / 1000} s`
          : erreur.message;
    }
  }

  const apres = await Webhook.findOneAndUpdate(
    { _id: abonnement._id },
    {
      $set: { dernierEchec: new Date(), derniereErreur },
      $inc: { echecsConsecutifs: 1, nbEmissions: 1 },
    },
    { new: true },
  );

  // Suspension automatique, mais JAMAIS suppression : l'abonnement reste
  // visible côté administration avec sa dernière erreur, et se réactive d'un
  // clic une fois l'URL réparée.
  if (apres && apres.echecsConsecutifs >= ECHECS_AVANT_SUSPENSION && apres.actif) {
    apres.actif = false;
    await apres.save();
    console.warn(
      `⚠️  Webhook « ${apres.nom} » suspendu après ${apres.echecsConsecutifs} échecs : ${derniereErreur}`,
    );
  }

  return { ok: false, erreur: derniereErreur };
};

/**
 * Émet un événement vers tous les abonnements actifs qui l'ont souscrit.
 *
 * 🔴 Ne lève JAMAIS. Cette fonction est appelée depuis l'ingestion : un
 * destinataire injoignable ne doit pas faire échouer un import d'offres qui,
 * lui, a parfaitement réussi. Les échecs sont tracés sur l'abonnement et
 * renvoyés à l'appelant, qui les journalise.
 */
export const emettre = async (evenement, charge) => {
  try {
    const abonnements = await Webhook.find({
      actif: true,
      evenements: evenement,
    }).select("+secret");

    if (abonnements.length === 0) return null;

    // En parallèle : un destinataire lent ne doit pas retarder les autres.
    // `allSettled` parce qu'un rejet isolé ne doit pas emporter le lot.
    const resultats = await Promise.allSettled(
      abonnements.map((a) => emettreVers(a, evenement, charge)),
    );

    const reussis = resultats.filter(
      (r) => r.status === "fulfilled" && r.value.ok,
    ).length;

    console.log(
      `📡 Webhook « ${evenement} » : ${reussis}/${abonnements.length} destinataire(s) notifié(s)`,
    );

    return {
      evenement,
      destinataires: abonnements.length,
      reussis,
      echecs: abonnements.length - reussis,
    };
  } catch (erreur) {
    console.warn(`⚠️  Émission de webhook impossible : ${erreur.message}`);
    return { evenement, erreur: erreur.message };
  }
};

/**
 * Émet vers UN abonnement précis, désigné par son identifiant.
 *
 * POURQUOI séparé de `emettre` : le bouton « tester » de l'administration
 * porte sur un abonnement. Passer par `emettre` enverrait la charge de test à
 * TOUS les destinataires actifs — c'est-à-dire à des tiers en production, pour
 * une offre qui n'a rien de nouveau. Un test doit rester un test.
 */
export const emettreVersUn = async (id, evenement, charge) => {
  const abonnement = await Webhook.findById(id).select("+secret");

  if (!abonnement) return { erreur: "Abonnement introuvable." };
  if (!abonnement.actif) return { erreur: "Abonnement suspendu." };

  try {
    return await emettreVers(abonnement, evenement, charge);
  } catch (erreur) {
    return { ok: false, erreur: erreur.message };
  }
};

/**
 * La charge utile de « avp.publie ».
 *
 * Volontairement RÉSUMÉE : l'intégrateur reçoit de quoi savoir ce qui est
 * arrivé et où le chercher, pas le corpus entier. Le JSON-LD complet est à un
 * appel de distance, sur une URL qu'on lui donne — pousser quarante fiches
 * intégrales ferait une charge de plusieurs mégaoctets dont il n'utiliserait
 * que les références.
 */
export const chargeAvpPublie = (source, nouvelles) => ({
  lot: { source, nouvelles: nouvelles.length },
  offres: nouvelles.slice(0, 100).map((a) => ({
    idAvp: a.idAvp,
    slug: a.slug,
    intitule: a.intitule,
    employeur: a.employeur
      ? { code: a.employeur.code, nom: a.employeur.nom }
      : null,
    direction: a.direction || null,
    lieu: a.lieu || null,
    typeContrat: a.typeContrat || null,
    datePubliee: a.datePubliee,
    dateLimite: a.dateLimite,
    jobPosting: `/api/avps/${a.slug}/jobposting`,
  })),
});
