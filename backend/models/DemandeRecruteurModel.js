import mongoose from "mongoose";

// Demande d'ouverture d'un compte recruteur.
//
// ══════════════════════════════════════════════════════════════════════════
//  POURQUOI UN COMPTE RECRUTEUR NE S'OUVRE PAS TOUT SEUL
// ══════════════════════════════════════════════════════════════════════════
// Un compte candidat s'ouvre librement : la personne ne voit que des offres
// publiques et son propre dossier. Un compte recruteur, lui, donne accès au
// VIVIER — les parcours, les coordonnées et les compétences de gens réels, qui
// les ont confiés à un service public, pas à quiconque remplit un formulaire.
//
// L'inscription libre serait donc une faute : n'importe qui pourrait aspirer
// des profils en cochant « je suis recruteur ». La vérification humaine est le
// seul filtre qui vaille — et c'est aussi ce qui permet de répondre à la
// personne, acceptée ou non, avec un motif.
//
// Le formulaire demande de quoi vérifier : l'organisation, la fonction, une
// adresse professionnelle. Ce ne sont pas des cases à remplir, ce sont les
// éléments sur lesquels un administrateur va se prononcer.

export const STATUTS = ["en_attente", "acceptee", "refusee"];

const demandeSchema = new mongoose.Schema(
  {
    // ── Identité du demandeur ────────────────────────────────────────
    prenom: { type: String, required: true, trim: true },
    nom: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      // Pas d'`index: true` ici : l'index partiel unique déclaré plus bas
      // couvre déjà ce champ, et le déclarer deux fois fait grogner Mongoose
      // au démarrage.
    },
    telephone: { type: String, trim: true, default: "" },

    // ── L'organisation, et le lien avec elle ─────────────────────────
    organisation: { type: String, required: true, trim: true },
    // Rattachement au registre des employeurs quand il existe (voir
    // config/employeurs.js) : cela permet de faire remonter ses offres sur son
    // tableau de bord, et donne un premier indice de vraisemblance.
    employeurCode: { type: String, default: null },
    fonction: { type: String, required: true, trim: true },
    // Site ou page qui atteste de l'organisation. Facultatif, mais c'est
    // souvent lui qui permet de trancher en trente secondes.
    siteOrganisation: { type: String, trim: true, default: "" },

    // Ce que la personne compte faire du vivier. Demandé en toutes lettres :
    // une demande qui ne sait pas répondre à cette question n'est pas une
    // demande de recrutement.
    motivation: { type: String, required: true, trim: true },

    statut: { type: String, enum: STATUTS, default: "en_attente", index: true },

    // ── Décision ─────────────────────────────────────────────────────
    decidePar: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    decideLe: { type: Date, default: null },
    // Le motif est OBLIGATOIRE à la décision (imposé par le contrôleur) : il
    // est envoyé tel quel au demandeur. Un refus sans explication ne se
    // conteste pas, et ne s'améliore pas non plus.
    motifDecision: { type: String, trim: true, default: "" },

    // Compte créé ou promu à l'acceptation.
    compte: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    courrielEnvoye: { type: Boolean, default: false },
    courrielErreur: { type: String, default: "" },
  },
  { timestamps: true },
);

// Une seule demande EN ATTENTE par adresse : sans cela, quelqu'un d'impatient
// en dépose cinq et l'administrateur instruit cinq fois le même dossier.
// L'index partiel laisse la possibilité de redéposer après un refus — une
// situation peut changer.
demandeSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { statut: "en_attente" } },
);

demandeSchema.index({ createdAt: -1 });

const DemandeRecruteur = mongoose.model("DemandeRecruteur", demandeSchema);

export default DemandeRecruteur;
