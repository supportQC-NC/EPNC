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

// Centre d'interet. `motsCles` reprend la structure `interests[].keywords` de
// JSON Resume : « Sport » seul ne dit rien, « Sport — arbitrage, encadrement
// d'une equipe de jeunes » dit quelque chose d'utile a un recruteur.
const interetSchema = new mongoose.Schema(
  {
    nom: { type: String, trim: true, default: "" },
    motsCles: { type: [String], default: [] },
  },
  { _id: true },
);

// Lien externe (JSON Resume `basics.profiles`).
const lienSchema = new mongoose.Schema(
  {
    reseau: { type: String, trim: true, default: "" },
    url: { type: String, trim: true, default: "" },
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
      // Intitule que la personne se donne (« Conseillere clientele »,
      // « Technicien fibre optique »). C'est le `label` de JSON Resume, et la
      // premiere ligne que lit un recruteur sous le nom. Sans lui, un CV
      // s'ouvre sur un nom seul, et il faut lire trois paragraphes pour savoir
      // de quel metier on parle.
      titre: { type: String, trim: true, default: "" },

      // PHOTO — stockee en base64 dans le document.
      //
      // POURQUOI PAS UN FICHIER SUR DISQUE : il faudrait un dossier monte, une
      // route statique, une regle de nettoyage a la suppression du compte, et
      // un volume a declarer dans docker compose. Pour une vignette de
      // quelques dizaines de kilo-octets, c'est beaucoup de mecanique.
      // L'image est redimensionnee A 320 px DANS LE NAVIGATEUR avant l'envoi
      // (voir ProfilScreen) : ce qui arrive ici pese ~30 Ko, la sauvegarde de
      // la base emporte les photos avec elle, et il n'y a pas de fichier
      // orphelin possible.
      //
      // La photo n'est JAMAIS obligatoire : en France comme ici, un CV sans
      // photo est parfaitement recevable, et l'exiger ouvre la porte a une
      // discrimination a l'embauche.
      photo: { type: String, default: "" },

      telephone: { type: String, trim: true, default: "" },
      // Adresse postale. Facultative : elle sert au CV et au courrier, pas au
      // rapprochement. Beaucoup de candidats ne souhaitent pas la publier.
      adresse: { type: String, trim: true, default: "" },
      codePostal: { type: String, trim: true, default: "" },
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
      liens: { type: [lienSchema], default: [] },
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

    // Centres d'interet. Ils ne pesent pas dans le rapprochement — ce serait
    // ouvrir la porte a des biais que personne ne saurait justifier — mais ils
    // font partie d'un CV, et c'est souvent par eux qu'un entretien commence.
    interets: { type: [interetSchema], default: [] },

    contraintes: {
      disponibilite: { type: String, trim: true, default: "" },
      mobilite: { type: String, trim: true, default: "" },
    },

    // VISIBILITE AUPRES DES RECRUTEURS.
    //
    // Par defaut : NON. Quelqu'un cree un compte pour chercher un poste, pas
    // pour etre listé dans un annuaire consultable par des employeurs. Rendre
    // son profil visible est une decision separee, explicite et reversible —
    // et la seule facon honnete de constituer un vivier.
    visibleRecruteurs: { type: Boolean, default: false, index: true },
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
    { rempli: Boolean(this.basics?.titre), poids: 5 },
    { rempli: Boolean(this.basics?.ville), poids: 5 },
    { rempli: Boolean(this.basics?.telephone), poids: 5 },
    { rempli: this.experiences?.length > 0, poids: 30 },
    // La formation pèse moins que l'expérience, et c'est délibéré : la donnée
    // elle-même prévoit que l'expérience puisse remplacer le diplôme
    // (`experienceInPlaceOfEducation`). Un barème qui exigerait un diplôme
    // pour être « complet » irait contre ce que dit l'employeur.
    { rempli: this.formations?.length > 0, poids: 10 },
    { rempli: this.competences?.length >= 3, poids: 20 },
    { rempli: this.langues?.length > 0, poids: 5 },
    { rempli: Boolean(this.aspirations?.projet), poids: 5 },
  ];

  // Le total des poids doit rester a 100 : sans ce controle, ajouter un
  // critere fait silencieusement depasser les 100 % et la barre de progression
  // deborde. Mieux vaut le dire au developpeur que de le laisser a l'ecran.
  const total = criteres.reduce((t, c) => t + c.poids, 0);
  if (total !== 100) {
    console.warn(
      `⚠️  Profil.completude : les poids totalisent ${total}, pas 100.`,
    );
  }

  return Math.min(
    100,
    Math.round(
      (criteres.reduce((t, c) => t + (c.rempli ? c.poids : 0), 0) / total) * 100,
    ),
  );
};

const Profil = mongoose.model("Profil", profilSchema);

export default Profil;
