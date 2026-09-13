import mongoose from "mongoose";

// Signalements et modération.
//
// ══════════════════════════════════════════════════════════════════════════
//  UN SIGNALEMENT NE SANCTIONNE RIEN — IL OUVRE UN DOSSIER
// ══════════════════════════════════════════════════════════════════════════
// La tentation est grande d'automatiser : trois signalements et le profil
// disparaît. C'est exactement ce qu'il ne faut pas faire ici. Nous parlons de
// personnes qui cherchent un emploi : un profil masqué par accumulation
// mécanique, c'est quelqu'un qui ne comprend pas pourquoi plus personne ne le
// contacte, sans recours ni explication.
//
// Un signalement est donc UNIQUEMENT un dossier porté à l'attention d'un
// administrateur. Toute conséquence — désactivation, retrait du vivier — est
// un geste humain, tracé, réversible, avec son motif écrit.
//
// CE QUE LE SIGNALANT APPREND, ET CE QU'IL N'APPREND PAS
//
// Il est informé du VERDICT — fondé ou non fondé — et du motif rédigé, et il
// peut contester. Le tenir dans le noir n'était pas tenable : un recruteur qui
// signale un profil manifestement faux et ne voit jamais rien conclut que
// l'outil ne sert à rien, et cesse de signaler.
//
// En revanche il n'apprend JAMAIS les mesures prises sur la personne. Lui dire
// « ce compte a été désactivé » ferait du signalement un moyen de savoir qui a
// été sanctionné — et, à terme, un instrument de pression.

export const MOTIFS = [
  "informations_fausses",
  "contenu_inapproprie",
  "coordonnees_invalides",
  "doublon",
  "usurpation",
  "autre",
];

// Libellés portés côté serveur : ils apparaissent dans le journal de
// modération, et une liste dupliquée dans l'interface finirait par diverger.
export const LIBELLES_MOTIFS = {
  informations_fausses: "Informations manifestement fausses",
  contenu_inapproprie: "Contenu inapproprié ou offensant",
  coordonnees_invalides: "Coordonnées invalides ou injoignables",
  doublon: "Profil en double",
  usurpation: "Usurpation d'identité",
  autre: "Autre motif",
};

export const STATUTS = ["nouveau", "en_cours", "traite", "rejete"];

const signalementSchema = new mongoose.Schema(
  {
    // Qui signale. Conservé : un signalement anonyme ne se vérifie pas, et
    // permet le harcèlement sans coût.
    signalePar: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    roleSignalant: { type: String, default: null },

    // Qui est visé. On cible le COMPTE, pas le profil : c'est sur le compte
    // que portent les décisions (désactivation), et un profil peut être
    // recréé.
    cible: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // Copie de l'identité au moment du signalement. Sans elle, un compte
    // supprimé laisse un dossier sur « quelqu'un » — impossible à instruire.
    cibleNom: { type: String, default: "" },
    ciblePrenom: { type: String, default: "" },
    cibleEmail: { type: String, default: "" },
    cibleRole: { type: String, default: null },

    motif: { type: String, enum: MOTIFS, required: true },
    details: { type: String, trim: true, default: "" },

    statut: { type: String, enum: STATUTS, default: "nouveau", index: true },

    // ── Instruction ──────────────────────────────────────────────────
    traitePar: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    traiteLe: { type: Date, default: null },
    // La décision, écrite. Un dossier clos sans motif ne se relit pas : six
    // mois plus tard, personne ne sait pourquoi ce compte a été désactivé.
    decision: { type: String, trim: true, default: "" },
    // Ce qui a réellement été fait, pour que le journal soit vérifiable.
    mesures: { type: [String], default: [] },

    // ── Information du signalant ─────────────────────────────────────
    //
    // Le signalant est informé du VERDICT (fondé / non fondé) et de son motif,
    // jamais des mesures prises sur la personne. Un recruteur qui signale et
    // ne voit jamais rien conclut que l'outil ne sert à rien ; mais lui dire
    // « ce compte a été désactivé » ferait du signalement un moyen de savoir
    // qui a été sanctionné.
    informeLe: { type: Date, default: null },
    informeErreur: { type: String, default: "" },

    // ── Appel ────────────────────────────────────────────────────────
    //
    // Ouvert AUX DEUX PARTIES : au signalant dont le dossier a été rejeté, et
    // à la personne visée par une mesure. Une décision sans recours n'est pas
    // une décision, c'est une sanction.
    appel: {
      parQui: {
        type: String,
        enum: ["signalant", "cible", null],
        default: null,
      },
      message: { type: String, default: "" },
      deposeLe: { type: Date, default: null },
      reponse: { type: String, default: "" },
      repondu: { type: Boolean, default: false },
      reponduLe: { type: Date, default: null },
      reponduPar: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
    },

    // Échanges engagés par l'administration avec l'une des parties. Tracés :
    // « je lui ai écrit » doit pouvoir se vérifier.
    echanges: {
      type: [
        {
          vers: { type: String, enum: ["signalant", "cible"], required: true },
          adresse: { type: String, default: "" },
          objet: { type: String, default: "" },
          message: { type: String, default: "" },
          par: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
          },
          date: { type: Date, default: Date.now },
          simule: { type: Boolean, default: false },
          _id: false,
        },
      ],
      default: [],
    },
  },
  { timestamps: true },
);

// Un seul signalement OUVERT par signalant et par cible.
//
// Sans cette contrainte, rien n'empêche d'en déposer cinquante sur la même
// personne. L'index partiel ne porte que sur les dossiers non clos : une fois
// un dossier traité, un nouveau fait peut évidemment être signalé.
signalementSchema.index(
  { signalePar: 1, cible: 1 },
  {
    unique: true,
    partialFilterExpression: { statut: { $in: ["nouveau", "en_cours"] } },
  },
);

signalementSchema.index({ createdAt: -1 });

const Signalement = mongoose.model("Signalement", signalementSchema);

export default Signalement;
