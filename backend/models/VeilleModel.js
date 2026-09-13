import mongoose from "mongoose";

// La veille : préférences d'alerte, et notifications produites.
//
// ══════════════════════════════════════════════════════════════════════════
//  POURQUOI LA VEILLE EST LE CŒUR DU PROJET, ET PAS UN SUPPLÉMENT
// ══════════════════════════════════════════════════════════════════════════
// Le corpus se renouvelle INTÉGRALEMENT en quelques semaines : les offres
// visibles aujourd'hui auront disparu dans un mois. Un candidat qui consulte
// la plateforme une fois n'y reviendra probablement pas au bon moment — et
// c'est précisément le problème que le hackathon énonce, l'accès à
// l'information.
//
// ⚠️ Le règlement est explicite : « un service de veille qui s'arrête à la
// notification ne concourt pas ». Prévenir ne suffit pas. La notification doit
// mener aux PIÈCES DE CANDIDATURE, sans quoi on a seulement déplacé le
// problème : la personne sait qu'un poste existe, et reste devant une page
// blanche.

// ── Préférences ───────────────────────────────────────────────────────────

const veilleSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    // Activée par défaut : quelqu'un qui remplit un profil sur un site
    // d'emploi veut être prévenu quand un poste correspond. L'inverse — devoir
    // cocher une case pour être alerté — revient à n'alerter personne.
    //
    // Ce n'est pas contradictoire avec `visibleRecruteurs`, décoché par
    // défaut : recevoir une information chez soi et être listé dans un
    // annuaire consultable par des tiers ne sont pas le même geste.
    actif: { type: Boolean, default: true },

    // Score en dessous duquel on ne dérange pas.
    //
    // 45 par défaut, soit le seuil « candidature défendable » du moteur de
    // rapprochement. En dessous, prévenir revient à envoyer du bruit — et
    // quelques alertes hors sujet suffisent à faire classer l'expéditeur en
    // indésirable, ce qui condamne toutes les suivantes.
    scoreMinimal: { type: Number, default: 45, min: 0, max: 100 },

    parEmail: { type: Boolean, default: true },

    // "immediat" : un courriel par LOT d'ingestion, jamais par offre. Une
    //              synchro qui ajoute quarante offres ne doit pas produire
    //              quarante courriels.
    // "quotidien": accumulation, un envoi par jour.
    // "jamais"   : notifications dans l'application seulement.
    frequence: {
      type: String,
      enum: ["immediat", "quotidien", "jamais"],
      default: "immediat",
    },

    derniereVerification: { type: Date, default: null },
    dernierEnvoi: { type: Date, default: null },
  },
  { timestamps: true },
);

// ── Notifications ─────────────────────────────────────────────────────────

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // "offre"  : une offre correspond au profil du candidat.
    // "profil" : un profil correspond à ce que cherche le recruteur.
    type: { type: String, enum: ["offre", "profil"], required: true },

    // ── Côté candidat ────────────────────────────────────────────────
    avpSlug: { type: String, default: null },
    avpIntitule: { type: String, default: null },
    employeur: { type: String, default: null },
    lieu: { type: String, default: null },
    dateLimite: { type: Date, default: null },

    // ── Côté recruteur ───────────────────────────────────────────────
    profilId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Profil",
      default: null,
    },
    profilNom: { type: String, default: null },
    profilTitre: { type: String, default: null },

    // ── Le rapprochement, recopié ────────────────────────────────────
    //
    // On COPIE le score et les preuves plutôt que de les recalculer à
    // l'affichage. Deux raisons : le calcul sur une liste de notifications
    // coûterait un rapprochement complet par ligne, et surtout l'offre peut
    // avoir été retirée — une notification doit rester lisible après la
    // disparition de ce qu'elle annonçait.
    score: { type: Number, default: null },
    fiabilite: { type: Number, default: null },
    verdict: { type: String, default: "" },
    // Trois preuves au plus : ce qui, dans l'annonce, répond à quoi, dans le
    // parcours. C'est ce qui distingue « un poste correspond » d'une alerte
    // publicitaire.
    preuves: {
      type: [
        {
          attendu: String,
          couvertPar: String,
          _id: false,
        },
      ],
      default: [],
    },

    lu: { type: Boolean, default: false },
    luLe: { type: Date, default: null },
    // Notification reprise dans un courriel : distinguer les deux évite de
    // réenvoyer la même chose au prochain lot.
    envoyeLe: { type: Date, default: null },
  },
  { timestamps: true },
);

// Une notification par personne et par offre : une réingestion qui met à jour
// une offre déjà signalée ne doit pas la re-signaler. C'est la contrainte qui
// rend la veille idempotente, et le script d'ingestion rejouable sans
// conséquence.
notificationSchema.index(
  { user: 1, avpSlug: 1 },
  { unique: true, partialFilterExpression: { avpSlug: { $type: "string" } } },
);

notificationSchema.index({ user: 1, lu: 1, createdAt: -1 });

export const Veille = mongoose.model("Veille", veilleSchema);
export const Notification = mongoose.model("Notification", notificationSchema);
