import mongoose from "mongoose";

// Statuts d'une candidature, dans l'ordre du parcours réel.
// Exportés : l'interface s'en sert pour les libellés et le filtre, et il ne
// doit exister qu'une seule liste.
export const STATUTS = [
  "brouillon",
  "prete",
  "envoyee",
  "entretien",
  "acceptee",
  "refusee",
  "sans_reponse",
];

const pieceSchema = new mongoose.Schema(
  {
    contenu: { type: String, default: "" },
    // "assemble" : brouillon construit à partir du profil et de l'offre.
    // "ia"       : rédigé par un modèle de langage (à brancher).
    // "manuel"   : réécrit à la main par le candidat.
    source: {
      type: String,
      enum: ["assemble", "ia", "manuel"],
      default: "assemble",
    },
    // Modèle ayant produit le texte, quand il y en a un. Conservé par
    // traçabilité : savoir avec quoi une pièce a été rédigée compte le jour où
    // l'on change de modèle et où la qualité varie.
    modele: { type: String, default: null },

    // Résultat de la passe de critique, quand elle a eu lieu.
    //
    // Conservé et montré au candidat : c'est ce qui transforme une génération
    // opaque en quelque chose d'auditable. Il voit ce qu'un recruteur a
    // reproché au premier jet, et si le texte a été réécrit pour y répondre.
    critique: {
      note: { type: Number, default: null },
      problemes: { type: [String], default: [] },
      inventions: { type: [String], default: [] },
      verdict: { type: String, default: "" },
      reecrite: { type: Boolean, default: false },
    },
    genereLe: { type: Date, default: null },
    modifieLe: { type: Date, default: null },
  },
  { _id: false },
);

const candidatureSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    avp: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Avp",
      required: true,
    },

    // Copie de l'offre au moment de la candidature.
    //
    // ⚠️ Ce n'est pas une duplication paresseuse : le corpus d'AVP se
    // renouvelle intégralement en quelques semaines. Sans cette copie, une
    // candidature déposée en septembre deviendrait illisible en novembre —
    // « candidature à (offre supprimée) ». L'historique doit survivre à la
    // disparition de l'offre.
    avpSlug: { type: String, required: true },
    avpIntitule: { type: String, required: true },
    avpDirection: { type: String, default: null },

    statut: {
      type: String,
      enum: STATUTS,
      default: "brouillon",
    },

    // Les quatre pièces attendues : deux pour l'employeur, deux pour le
    // candidat.
    pieces: {
      lettre: { type: pieceSchema, default: () => ({}) },
      cv: { type: pieceSchema, default: () => ({}) },
      restitution: { type: pieceSchema, default: () => ({}) },
      preparation: { type: pieceSchema, default: () => ({}) },
    },

    // Journal des changements de statut : c'est lui qui fait le « suivi ».
    // Une date d'envoi seule ne dit pas combien de temps l'employeur a mis à
    // répondre, ni combien de candidatures sont restées sans réponse.
    historique: {
      type: [
        {
          statut: { type: String, enum: STATUTS },
          date: { type: Date, default: Date.now },
          note: { type: String, default: "" },
          _id: false,
        },
      ],
      default: [],
    },

    notes: { type: String, default: "" },
    envoyeeLe: { type: Date, default: null },

    // Trace des transmissions (fonction ④).
    //
    // Un tableau et non un objet : une candidature peut être renvoyée — pièce
    // corrigée, relance. Garder seulement la dernière ferait disparaître le
    // premier envoi, qui est pourtant celui qui compte pour le délai de
    // réponse.
    //
    // `simule` distingue un envoi réel d'un envoi tracé en console faute de
    // SMTP. Sans ce drapeau, une démonstration laisserait croire qu'une
    // candidature est partie alors qu'elle n'a jamais quitté la machine.
    envois: {
      type: [
        {
          destinataire: { type: String, required: true },
          // "test" : parti à l'adresse de test. "production" : parti chez le
          // vrai recruteur. Sans cette distinction, l'historique d'une
          // candidature devient illisible dès qu'on a basculé une fois.
          mode: { type: String, enum: ["test", "production"], default: "test" },
          pieces: { type: [String], default: [] },
          simule: { type: Boolean, default: false },
          messageId: { type: String, default: null },
          date: { type: Date, default: Date.now },
          _id: false,
        },
      ],
      default: [],
    },
  },
  { timestamps: true },
);

// Une seule candidature par personne et par offre : sans cet index, un
// double-clic sur « Préparer ma candidature » en crée deux, et le suivi
// affiche des doublons que personne ne comprend.
candidatureSchema.index({ user: 1, avp: 1 }, { unique: true });

const Candidature = mongoose.model("Candidature", candidatureSchema);

export default Candidature;
