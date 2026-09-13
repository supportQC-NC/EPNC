import mongoose from "mongoose";

// Profil candidat.
//
// Le schéma suit la structure de JSON Resume (jsonresume.org) — `basics`,
// `work`, `education`, `skills`, `languages` — avec des noms français et
// quelques champs propres au contexte calédonien (province, permis, mobilité).
//
// Pourquoi ce standard : c'est la contrepartie de schema.org/JobPosting côté
// offre. Le cœur de l'application ne connaît que ces deux formats, ce qui rend
// un profil exportable et réutilisable ailleurs — il appartient à la personne,
// pas à la plateforme.

const experienceSchema = new mongoose.Schema(
  {
    poste: { type: String, trim: true, default: "" },
    employeur: { type: String, trim: true, default: "" },
    lieu: { type: String, trim: true, default: "" },
    // Dates en texte libre (« 2019 », « mars 2021 ») plutôt qu'en Date : un
    // candidat ne se souvient pas toujours du jour exact, et un sélecteur de
    // date qui exige une précision qu'on n'a pas fait abandonner le formulaire.
    debut: { type: String, trim: true, default: "" },
    fin: { type: String, trim: true, default: "" },
    enCours: { type: Boolean, default: false },
    description: { type: String, trim: true, default: "" },
    realisations: { type: [String], default: [] },
  },
  { _id: true },
);

const formationSchema = new mongoose.Schema(
  {
    intitule: { type: String, trim: true, default: "" },
    etablissement: { type: String, trim: true, default: "" },
    niveau: { type: String, trim: true, default: "" },
    annee: { type: String, trim: true, default: "" },
    enCours: { type: Boolean, default: false },
  },
  { _id: true },
);

const competenceSchema = new mongoose.Schema(
  {
    nom: { type: String, trim: true, default: "" },
    niveau: {
      type: String,
      enum: ["notions", "pratique", "maitrise", "expert"],
      default: "pratique",
    },
  },
  { _id: true },
);

const langueSchema = new mongoose.Schema(
  {
    nom: { type: String, trim: true, default: "" },
    niveau: {
      type: String,
      enum: ["notions", "courant", "bilingue", "maternelle"],
      default: "courant",
    },
  },
  { _id: true },
);

const profilSchema = new mongoose.Schema(
  {
    // Un seul profil par compte. L'index unique le garantit au niveau de la
    // base, pas seulement dans le code.
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    // Identité et contact. Nom, prénom et email vivent sur le compte
    // (UserModel) et ne sont pas dupliqués ici : deux sources pour la même
    // donnée finissent toujours par diverger.
    basics: {
      telephone: { type: String, trim: true, default: "" },
      ville: { type: String, trim: true, default: "" },
      province: {
        type: String,
        enum: ["", "Province Sud", "Province Nord", "Province des îles Loyauté", "Hors territoire"],
        default: "",
      },
      // Accroche : deux ou trois phrases sur soi. C'est la matière première de
      // la lettre de candidature.
      accroche: { type: String, trim: true, default: "" },
      permis: { type: [String], default: [] },
    },

    experiences: { type: [experienceSchema], default: [] },
    formations: { type: [formationSchema], default: [] },
    competences: { type: [competenceSchema], default: [] },
    langues: { type: [langueSchema], default: [] },

    // Ce que la personne cherche. Sans cette section, le rapprochement ne sait
    // pas distinguer « ce que je sais faire » de « ce que je veux faire » —
    // et propose des postes techniquement justes mais sans intérêt pour elle.
    aspirations: {
      famillesVisees: { type: [String], default: [] },
      typesContrat: { type: [String], default: [] },
      projet: { type: String, trim: true, default: "" },
    },

    contraintes: {
      disponibilite: { type: String, trim: true, default: "" },
      mobilite: { type: String, trim: true, default: "" },
    },
  },
  { timestamps: true },
);

// Complétude du profil, en pourcentage.
//
// Elle sert à deux choses : indiquer à la personne ce qu'il reste à remplir, et
// avertir avant de lancer un rapprochement sur un profil trop maigre — un
// matching calculé sur trois lignes ne vaut rien et décrédibilise l'outil.
// Les poids reflètent ce qui compte vraiment pour rapprocher un profil d'une
// fiche de poste : l'expérience et les compétences d'abord.
profilSchema.methods.completude = function () {
  const criteres = [
    { rempli: Boolean(this.basics?.accroche), poids: 15 },
    { rempli: Boolean(this.basics?.ville), poids: 5 },
    { rempli: Boolean(this.basics?.telephone), poids: 5 },
    { rempli: this.experiences?.length > 0, poids: 30 },
    { rempli: this.formations?.length > 0, poids: 15 },
    { rempli: this.competences?.length >= 3, poids: 20 },
    { rempli: this.langues?.length > 0, poids: 5 },
    { rempli: Boolean(this.aspirations?.projet), poids: 5 },
  ];

  return criteres.reduce((t, c) => t + (c.rempli ? c.poids : 0), 0);
};

const Profil = mongoose.model("Profil", profilSchema);

export default Profil;
