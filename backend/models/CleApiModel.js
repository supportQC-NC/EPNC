import crypto from "crypto";
import mongoose from "mongoose";

// Clé d'API : l'accès machine à la plateforme.
//
// ══════════════════════════════════════════════════════════════════════════
//  POURQUOI UN SECOND MÉCANISME D'AUTHENTIFICATION
// ══════════════════════════════════════════════════════════════════════════
// Toute l'API existante s'authentifie par un **cookie httpOnly** posé à la
// connexion. C'est le bon choix pour une application web — le jeton n'est pas
// lisible en JavaScript, donc pas volable par injection. Mais un cookie
// suppose un navigateur, une session, une personne devant l'écran.
//
// Un ATS qui interroge nos offres toutes les nuits n'a rien de tout cela. Sans
// un second mécanisme, « intégrable » resterait une affirmation : la seule
// façon de nous consommer serait de piloter un navigateur, ce qui n'est pas
// une intégration, c'est un contournement.
//
// D'où la clé d'API : un secret long, présenté en en-tête, rattaché à un
// consommateur nommé et à une portée explicite.

// Ce qu'une clé a le droit de faire. Liste FERMÉE : une portée en texte libre
// finit par contenir « admin » un jour de fatigue.
//
// ⚠️ Il n'existe volontairement AUCUNE portée d'écriture sur les comptes, les
// profils ou la modération. Une intégration lit le catalogue, soumet un
// candidat qu'elle détient déjà, et récupère des documents. Elle ne crée pas
// d'utilisateur et ne sanctionne personne.
export const PORTEES = {
  "offres:lire": "Lire le catalogue des offres et le référentiel métiers",
  "rapprochement:calculer":
    "Confronter un candidat (JSON Resume) aux offres et obtenir les scores justifiés",
  "dossier:produire":
    "Produire les pièces d'une candidature (lettre, CV) pour un candidat soumis",
};

const cleApiSchema = new mongoose.Schema(
  {
    // À qui appartient cette clé. Un nom lisible, pas un identifiant : quand
    // il faudra révoquer, c'est « l'ATS de la province Sud » qu'on cherchera
    // dans la liste, pas un UUID.
    nom: { type: String, required: true, trim: true },
    organisation: { type: String, trim: true, default: "" },
    contact: { type: String, trim: true, default: "" },

    // 🔴 Le secret n'est JAMAIS stocké en clair — même principe que les mots de
    // passe et que le jeton de réinitialisation. Une base exfiltrée ne doit pas
    // livrer des clés utilisables. On garde l'empreinte SHA-256, et le secret
    // n'existe en clair qu'une fois, dans la réponse à sa création.
    //
    // SHA-256 sans sel ici, contrairement aux mots de passe : une clé fait 32
    // octets aléatoires, elle n'est pas devinable par dictionnaire, et le coût
    // d'un bcrypt à chaque requête d'API serait payé pour rien.
    empreinte: { type: String, required: true, unique: true, select: false },

    // Les premiers caractères, en clair, pour que la liste soit identifiable.
    // Trop courts pour servir à quoi que ce soit.
    prefixe: { type: String, required: true },

    portees: {
      type: [String],
      default: ["offres:lire"],
      validate: {
        validator: (v) => v.every((p) => Object.keys(PORTEES).includes(p)),
        message: "Portée inconnue.",
      },
    },

    // Révocation plutôt que suppression : on doit pouvoir répondre à « cette
    // clé a-t-elle existé, et qui s'en servait ». Une ligne effacée ne répond
    // à rien.
    active: { type: Boolean, default: true },
    revoqueeLe: { type: Date, default: null },
    motifRevocation: { type: String, default: "" },

    // Traces d'usage. Minimales et volontairement non nominatives : on compte
    // les appels et on date le dernier, on ne journalise pas les candidats
    // soumis. Un registre de qui a postulé où serait une donnée personnelle
    // que personne ne nous a demandé de conserver.
    creeePar: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    dernierAppel: { type: Date, default: null },
    nbAppels: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// Fabrique une clé. Retourne le secret EN CLAIR : c'est le seul instant où il
// existe, l'appelant doit l'afficher immédiatement et ne plus jamais pouvoir
// le relire.
cleApiSchema.statics.fabriquer = function (champs) {
  // Préfixe parlant : une clé trouvée dans un journal ou un dépôt Git se
  // reconnaît au premier coup d'œil, et les outils de détection de secrets
  // savent l'attraper.
  const secret = `epnc_${crypto.randomBytes(32).toString("hex")}`;

  const cle = new this({
    ...champs,
    empreinte: empreinteDe(secret),
    prefixe: secret.slice(0, 13),
  });

  return { cle, secret };
};

export const empreinteDe = (secret) =>
  crypto.createHash("sha256").update(String(secret)).digest("hex");

const CleApi = mongoose.model("CleApi", cleApiSchema);

export default CleApi;
