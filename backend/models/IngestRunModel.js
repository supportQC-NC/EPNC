import mongoose from "mongoose";

// Journal des synchronisations.
//
// POURQUOI le conserver : « la source répond » et « nous avons reçu quelque
// chose » sont deux questions différentes, et une troisième compte autant —
// « qu'est-ce qui a changé depuis la dernière fois ». Sur un corpus qui se
// renouvelle en quelques semaines, savoir que la dernière synchro a créé 3
// offres et en a mis 42 à jour est l'information qui dit si le service vit.
//
// C'est aussi ce qui rend l'ingestion auditable : le jour où un rapprochement
// paraît faux, la première question est « sur quelles données ? ».
const ingestRunSchema = new mongoose.Schema(
  {
    // Identifiant de la source dans config/sources.js.
    source: { type: String, required: true, index: true },
    libelle: { type: String, default: "" },

    // "console" ou "administration" : savoir d'où part une synchro évite de
    // chercher longtemps pourquoi la base a bougé sans que personne n'ait
    // lancé de script.
    declencheur: {
      type: String,
      enum: ["console", "administration", "automatique"],
      default: "console",
    },
    // Compte à l'origine, quand la synchro vient de l'interface.
    par: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    statut: {
      type: String,
      enum: ["succes", "echec", "en_cours"],
      default: "en_cours",
    },

    recus: { type: Number, default: 0 },
    crees: { type: Number, default: 0 },
    majs: { type: Number, default: 0 },
    ignores: { type: Number, default: 0 },

    dureeMs: { type: Number, default: 0 },
    message: { type: String, default: "" },
    // Détail par sous-source quand une synchro en couvre plusieurs (l'archive
    // mensuelle, le référentiel et ses quatre fichiers).
    detail: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true },
);

// La question posée est toujours « quand a-t-on synchronisé pour la dernière
// fois, et qu'est-ce que ça a donné ? » — donc du plus récent au plus ancien.
ingestRunSchema.index({ createdAt: -1 });

const IngestRun = mongoose.model("IngestRun", ingestRunSchema);

export default IngestRun;
