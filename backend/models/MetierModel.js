import mongoose from "mongoose";

// Famille de métiers (12 chez l'OPT-NC).
const familleSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    libelle: { type: String, required: true },
    description: { type: String, default: "" },
  },
  { timestamps: true },
);

// Compétence du référentiel.
//
// `groupe` distingue savoir / savoir-faire / savoir-être. C'est le vocabulaire
// normalisé auquel se rattachent les attendus des fiches de poste : c'est lui
// qui permettra d'expliquer un rapprochement en termes du référentiel public
// plutôt qu'en score opaque.
const competenceSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    nom: { type: String, required: true },
    groupe: { type: String, default: null },
    referentiel: { type: String, default: null },
  },
  { timestamps: true },
);

// Métier, avec les compétences qu'il attend.
//
// Les liaisons sont imbriquées plutôt que stockées dans une collection à part :
// on ne les lit jamais autrement que par métier, et une jointure à chaque
// rapprochement coûterait sans rien apporter. Le poids et le niveau requis
// viennent du référentiel — ce sont eux qui pondéreront le score.
const metierSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    nom: { type: String, required: true },
    familleCode: { type: String, default: null, index: true },
    statut: { type: String, default: null },
    actif: { type: Boolean, default: true },
    competences: {
      type: [
        {
          code: String,
          nom: String,
          poids: Number,
          niveauRequis: Number,
          _id: false,
        },
      ],
      default: [],
    },
  },
  { timestamps: true },
);

export const Famille = mongoose.model("Famille", familleSchema);
export const Competence = mongoose.model("Competence", competenceSchema);
export const Metier = mongoose.model("Metier", metierSchema);
