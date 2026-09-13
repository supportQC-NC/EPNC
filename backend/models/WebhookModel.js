import crypto from "crypto";
import mongoose from "mongoose";

// Abonnement à un webhook.
//
// ══════════════════════════════════════════════════════════════════════════
//  POURQUOI UN WEBHOOK PLUTÔT QUE « VENEZ NOUS INTERROGER »
// ══════════════════════════════════════════════════════════════════════════
// Un ATS qui veut nos nouvelles offres n'a que deux options : nous appeler en
// boucle, ou être prévenu. L'interrogation en boucle coûte à tout le monde —
// des centaines de requêtes par jour pour découvrir, une fois par semaine,
// qu'un lot est arrivé — et elle arrive toujours trop tard ou trop souvent.
//
// Ici, la question ne se pose même pas : le corpus se renouvelle par LOTS,
// quelques fois par semaine, à des moments imprévisibles. C'est le cas d'usage
// exact d'un webhook.

export const EVENEMENTS = {
  "avp.publie": "Un lot de nouvelles offres vient d'être ingéré",
};

const webhookSchema = new mongoose.Schema(
  {
    nom: { type: String, required: true, trim: true },

    // L'URL appelée. En HTTPS exclusivement hors développement : une charge
    // utile signée mais transmise en clair reste lisible par tout
    // intermédiaire, et la signature ne protège que de l'altération.
    url: { type: String, required: true, trim: true },

    evenements: {
      type: [String],
      default: ["avp.publie"],
      validate: {
        validator: (v) => v.every((e) => Object.keys(EVENEMENTS).includes(e)),
        message: "Événement inconnu.",
      },
    },

    // 🔴 Le secret de signature. Stocké EN CLAIR, contrairement aux clés
    // d'API — et c'est volontaire : il faut le relire à chaque émission pour
    // calculer le HMAC. Une empreinte ne permettrait pas de signer.
    //
    // Ce n'est donc pas un secret de même nature qu'un mot de passe : il
    // n'ouvre aucun accès chez nous. Il prouve seulement au destinataire que
    // le message vient bien de nous. Compromis, il permet d'usurper notre
    // signature, pas d'entrer.
    secret: { type: String, required: true, select: false },

    actif: { type: Boolean, default: true },

    // ── Santé de l'abonnement ────────────────────────────────────────
    //
    // Un webhook qui échoue en silence est pire que pas de webhook : le
    // destinataire croit être à jour. On garde donc de quoi répondre à
    // « depuis quand est-ce cassé, et pourquoi ».
    dernierSucces: { type: Date, default: null },
    dernierEchec: { type: Date, default: null },
    derniereErreur: { type: String, default: "" },
    echecsConsecutifs: { type: Number, default: 0 },
    nbEmissions: { type: Number, default: 0 },

    creeePar: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

// Au-delà, l'abonnement est suspendu automatiquement. Continuer à pousser des
// lots vers une URL morte pendant des mois ralentit chaque ingestion et remplit
// les journaux de bruit.
export const ECHECS_AVANT_SUSPENSION = 10;

webhookSchema.statics.nouveauSecret = () =>
  `whsec_${crypto.randomBytes(24).toString("hex")}`;

const Webhook = mongoose.model("Webhook", webhookSchema);

export default Webhook;
