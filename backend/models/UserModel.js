import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Email requis"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    // `select: false` : le mot de passe n'est JAMAIS chargé par défaut. Toute
    // lecture qui en a besoin doit le demander explicitement
    // (`.select("+password")`) — c'est le cas de la connexion et du changement
    // de mot de passe, nulle part ailleurs.
    password: {
      type: String,
      required: [true, "Mot de passe requis"],
      minlength: 6,
      select: false,
    },
    nom: {
      type: String,
      required: [true, "Nom requis"],
      trim: true,
    },
    prenom: {
      type: String,
      required: [true, "Prénom requis"],
      trim: true,
    },
    // Rôles :
    //  - "admin"     : administration de la plateforme (comptes, référentiels).
    //  - "recruteur" : côté employeur — consulte les rapprochements et les
    //                  candidatures reçues.
    //  - "candidat"  : côté candidat — dépose son profil, consulte ses matchs,
    //                  génère et envoie ses pièces de candidature.
    role: {
      type: String,
      enum: ["admin", "recruteur", "candidat"],
      default: "candidat",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    // Date à laquelle la personne a pris connaissance des limites de la
    // rédaction automatique, avant d'utiliser l'assistant.
    //
    // Conservée côté serveur et non dans le navigateur : c'est une prise de
    // connaissance, pas une préférence d'affichage. Elle doit survivre à un
    // changement d'appareil, à un vidage de cache, et rester vérifiable — si
    // l'on doit un jour démontrer que l'avertissement a bien été présenté,
    // une case cochée dans un localStorage ne prouve rien.
    avertissementIaAccepteLe: {
      type: Date,
      default: null,
    },
    // ── Modération ────────────────────────────────────────────────
    //
    // Les avertissements sont CUMULATIFS et NOMINATIFS : chacun porte son
    // motif et qui l'a donné. Un compte sanctionné sans qu'on puisse dire
    // pourquoi ni par qui n'est pas défendable — ni devant la personne, ni
    // devant qui que ce soit d'autre.
    avertissements: {
      type: [
        {
          motif: { type: String, required: true },
          donnePar: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
          },
          signalement: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Signalement",
            default: null,
          },
          date: { type: Date, default: Date.now },
          // Un avertissement levé reste au dossier mais ne compte plus.
          // L'effacer réécrirait l'histoire ; le neutraliser suffit.
          leveLe: { type: Date, default: null },
          leveMotif: { type: String, default: "" },
        },
      ],
      default: [],
    },

    // Posée au troisième avertissement actif : le profil cesse d'être visible
    // et la personne dispose d'un délai pour régulariser.
    masqueLe: { type: Date, default: null },
    // Échéance au-delà de laquelle le compte est supprimé faute de contact.
    // Stockée plutôt que recalculée : la durée du délai peut changer, mais
    // l'échéance annoncée à quelqu'un ne doit pas bouger sous ses pieds.
    regulariserAvant: { type: Date, default: null, index: true },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    // Réinitialisation de mot de passe : on ne stocke que le HACHÉ du jeton.
    // Le jeton en clair n'existe que dans l'email envoyé — une fuite de la base
    // ne permet donc pas de réinitialiser un compte.
    resetPasswordToken: {
      type: String,
      default: null,
    },
    resetPasswordExpire: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Hachage du mot de passe avant enregistrement.
// Sortie anticipée si le mot de passe n'a pas changé : sans elle, chaque
// `save()` (mise à jour du profil, horodatage de connexion…) re-hacherait le
// haché existant et rendrait le compte inaccessible.
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Avertissements qui comptent encore : les levés restent au dossier mais
// n'entrent plus dans le décompte.
userSchema.methods.avertissementsActifs = function () {
  return (this.avertissements || []).filter((a) => !a.leveLe);
};

userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Génère un jeton de réinitialisation valable 30 minutes.
// Renvoie le jeton EN CLAIR (à mettre dans le lien de l'email) et stocke son
// empreinte SHA-256 dans le document.
userSchema.methods.getResetPasswordToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");
  this.resetPasswordToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  this.resetPasswordExpire = Date.now() + 30 * 60 * 1000;
  return resetToken;
};

// Filet de sécurité : même si un contrôleur renvoie le document entier, les
// champs sensibles ne partent pas dans la réponse.
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpire;
  return obj;
};

const User = mongoose.model("User", userSchema);

export default User;
