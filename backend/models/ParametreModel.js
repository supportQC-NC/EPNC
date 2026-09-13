import mongoose from "mongoose";

// Réglages modifiables depuis l'administration, sans redéploiement.
//
// POURQUOI EN BASE ET PAS EN VARIABLE D'ENVIRONNEMENT : une variable
// d'environnement est un réglage d'INSTALLATION — elle demande un accès au
// serveur et un redémarrage. Un réglage d'EXPLOITATION, qu'un administrateur
// doit pouvoir changer depuis son navigateur, n'a pas sa place là.
//
// La distinction est respectée pour le mode d'envoi : l'AUTORISATION de passer
// en production reste une variable d'environnement (ENVOI_PRODUCTION_AUTORISE),
// parce qu'elle engage l'exploitant ; le BASCULEMENT, lui, est en base. Il faut
// donc les deux, et une démonstration ne peut pas basculer par mégarde.
const parametreSchema = new mongoose.Schema(
  {
    cle: { type: String, required: true, unique: true, index: true },
    valeur: { type: mongoose.Schema.Types.Mixed, default: null },
    modifiePar: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

const Parametre = mongoose.model("Parametre", parametreSchema);

/** Lit un réglage, ou renvoie la valeur par défaut s'il n'a jamais été posé. */
export const lireParametre = async (cle, defaut = null) => {
  const p = await Parametre.findOne({ cle }).lean();
  return p ? p.valeur : defaut;
};

/** Pose un réglage et trace qui l'a changé. */
export const ecrireParametre = async (cle, valeur, user = null) => {
  const p = await Parametre.findOneAndUpdate(
    { cle },
    { valeur, modifiePar: user?._id || null },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return p;
};

export default Parametre;
