import mongoose from "mongoose";

// Profil recruteur, et listes de candidats mises de côté.
//
// ══════════════════════════════════════════════════════════════════════════
//  UN RECRUTEUR N'EST PAS UN CANDIDAT SANS CV
// ══════════════════════════════════════════════════════════════════════════
// Il serait tentant de réutiliser `ProfilModel` en laissant les champs vides.
// Ce serait une erreur : un recruteur ne décrit pas un parcours, il décrit un
// BESOIN. Ses champs ne sont pas « expériences » et « formations » mais
// « quels métiers je recrute », « sur quel territoire », « pour quelle
// organisation ». Deux objets différents, deux modèles.
//
// Ce besoin déclaré sert à deux choses : filtrer par défaut le vivier, et
// amorcer les suggestions tant qu'aucun candidat n'a été enregistré — sans
// lui, un recruteur qui arrive sur un compte neuf ne voit rien de pertinent.

const recruteurProfilSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    // Pour qui il recrute. `employeurCode` se rattache au registre des
    // employeurs (config/employeurs.js) quand l'organisation en fait partie ;
    // `organisation` reste libre pour tous les autres cas.
    organisation: { type: String, trim: true, default: "" },
    employeurCode: { type: String, default: null, index: true },

    // Logo de l'organisation, en base64, comme la photo de profil candidat :
    // redimensionné dans le navigateur avant l'envoi, stocké avec le document.
    // Pas de dossier à monter, pas de fichier orphelin, et la sauvegarde de la
    // base emporte les images avec elle.
    logo: { type: String, default: "" },
    fonction: { type: String, trim: true, default: "" },
    telephone: { type: String, trim: true, default: "" },

    // ── Ce qu'il cherche ────────────────────────────────────────────
    //
    // Ces critères ne FILTRENT pas la liste par défaut : ils la CLASSENT.
    // Un filtre dur ferait disparaître des profils que le recruteur n'a pas
    // pensé à décrire — et c'est précisément ce qu'un vivier doit éviter.
    recherche: {
      competences: { type: [String], default: [] },
      metiers: { type: [String], default: [] },
      provinces: { type: [String], default: [] },
      motsCles: { type: [String], default: [] },
      // Note libre : le contexte que les listes ci-dessus ne capturent pas.
      note: { type: String, trim: true, default: "" },
    },

    // Poids accordé aux candidats déjà enregistrés dans les suggestions.
    //
    // Réglable parce que les deux extrêmes sont légitimes : un recruteur qui
    // sait exactement ce qu'il cherche veut que ses critères déclarés priment ;
    // un autre préfère que l'outil apprenne de ce qu'il met de côté. À 50, les
    // deux comptent autant.
    poidsHistorique: { type: Number, default: 50, min: 0, max: 100 },
  },
  { timestamps: true },
);

// Complétude, sur le même principe que côté candidat : elle sert à dire ce
// qu'il reste à renseigner pour que les suggestions aient du sens.
recruteurProfilSchema.methods.completude = function () {
  const criteres = [
    { rempli: Boolean(this.organisation), poids: 20 },
    { rempli: Boolean(this.fonction), poids: 15 },
    { rempli: this.recherche?.competences?.length > 0, poids: 30 },
    { rempli: this.recherche?.metiers?.length > 0, poids: 20 },
    { rempli: this.recherche?.provinces?.length > 0, poids: 15 },
  ];

  return criteres.reduce((t, c) => t + (c.rempli ? c.poids : 0), 0);
};

// ── Listes de candidats ───────────────────────────────────────────────────
//
// Des dossiers nommés par le recruteur : « À rappeler », « Pour le poste de
// gestionnaire », « Profils techniques ». C'est le geste naturel de quelqu'un
// qui dépouille — mettre de côté maintenant, décider plus tard.
//
// Ce sont aussi le SIGNAL des suggestions : ce qu'on enregistre dit ce qu'on
// cherche, souvent mieux qu'une liste de mots-clés.

const entreeSchema = new mongoose.Schema(
  {
    profil: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Profil",
      required: true,
    },
    // Copie de l'identité au moment de l'ajout.
    //
    // Un candidat peut retirer la visibilité de son profil : la liste doit
    // alors montrer « profil retiré » plutôt qu'une ligne vide dont personne
    // ne sait qui elle désignait. Ce n'est pas une fuite — le recruteur avait
    // déjà consulté ce nom.
    nom: { type: String, default: "" },
    prenom: { type: String, default: "" },
    titre: { type: String, default: "" },
    // Pourquoi on l'a mis de côté. La question qu'on se pose trois semaines
    // plus tard, et à laquelle un nom seul ne répond pas.
    note: { type: String, trim: true, default: "" },
    ajouteLe: { type: Date, default: Date.now },
  },
  { _id: false },
);

const listeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    nom: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    // Rattachement facultatif à une offre : « les candidats que je retiens
    // pour CE poste » est le cas le plus fréquent.
    avpSlug: { type: String, default: null },
    avpIntitule: { type: String, default: null },
    entrees: { type: [entreeSchema], default: [] },
  },
  { timestamps: true },
);

// Un même nom de liste ne peut pas exister deux fois chez la même personne :
// « À rappeler » en double, et on ne sait plus dans laquelle on a rangé qui.
listeSchema.index({ user: 1, nom: 1 }, { unique: true });

export const RecruteurProfil = mongoose.model(
  "RecruteurProfil",
  recruteurProfilSchema,
);

export const ListeCandidats = mongoose.model("ListeCandidats", listeSchema);
