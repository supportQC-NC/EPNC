import mongoose from "mongoose";

// Avis de vacance de poste.
//
// PRINCIPE : le document source schema.org/JobPosting est conservé INTACT dans
// `raw`. Les champs de premier niveau en sont dérivés, uniquement pour trier,
// filtrer et afficher sans traverser le JSON-LD à chaque requête.
// On ne modifie jamais `raw` — c'est notre source de vérité, et c'est elle qui
// repartira telle quelle vers un ATS ou un autre consommateur.
const avpSchema = new mongoose.Schema(
  {
    // Identifiant métier OPT ("3134-26-1264/SR"). Contient une barre oblique :
    // inutilisable dans une URL, d'où `slug`.
    idAvp: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    // Forme URL de idAvp ("3134-26-1264-sr"). C'est ce que voit le visiteur.
    slug: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // ── Champs dérivés (affichage et tri) ─────────────────────────────
    intitule: { type: String, required: true, trim: true },
    description: { type: String, default: "" },

    // QUI RECRUTE. Déterminant depuis que l'application agrège plusieurs
    // employeurs publics : l'OPT-NC et la fonction publique calédonienne sont
    // deux organisations distinctes, avec deux procédures de candidature
    // différentes. Les confondre tromperait le candidat sur la personne à qui
    // il écrit. Voir backend/config/employeurs.js.
    employeur: {
      code: { type: String, default: "inconnu", index: true },
      nom: { type: String, default: "Employeur non précisé" },
      nomComplet: { type: String, default: "" },
      type: { type: String, default: null },
      url: { type: String, default: null },
    },

    // Direction ou service AU SEIN de l'employeur — pas l'employeur lui-même.
    direction: { type: String, default: null },
    corpsDomaine: { type: String, default: null },
    service: { type: String, default: null },
    lieu: { type: String, default: null },
    // Familles de métiers du référentiel OPT (occupationalCategory).
    familles: { type: [String], default: [] },
    // Métier de rattachement (relevantOccupation).
    metier: {
      nom: { type: String, default: null },
      code: { type: String, default: null },
      ficheUrl: { type: String, default: null },
      // Code ROME (occupationalCategory.codeValue) — passerelle vers le
      // référentiel France Travail.
      rome: { type: String, default: null },
      romeLibelle: { type: String, default: null },
    },
    typeContrat: { type: String, default: null },
    nbPostes: { type: Number, default: null },
    datePubliee: { type: Date, default: null },
    dateLimite: { type: Date, default: null },

    // ── Contenu détaillé (réservé aux comptes connectés) ──────────────
    missions: { type: [String], default: [] },
    competencesAttendues: { type: [String], default: [] },
    savoirFaire: { type: [String], default: [] },
    experienceRequise: { type: String, default: null },
    qualifications: { type: String, default: null },
    contraintePhysique: { type: String, default: null },
    // La donnée indique explicitement quand l'expérience peut remplacer le
    // diplôme. Champ décisif pour ne pas écarter injustement un profil.
    experienceRemplaceDiplome: { type: Boolean, default: false },

    // ── Traçabilité ───────────────────────────────────────────────────
    // md5 du PDF source, fourni par le dataset : sert à détecter qu'une offre
    // a changé sans comparer tout le document.
    md5Source: { type: String, default: null },
    source: { type: String, default: "huggingface:opt-nc/odata-avps" },
    raw: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);

// Tri par défaut de la liste publique : de la plus récente à la plus ancienne.
avpSchema.index({ datePubliee: -1 });

// Une offre est « ouverte » tant que sa date limite n'est pas passée.
// Méthode plutôt que champ stocké : un booléen en base serait faux dès le
// lendemain de l'ingestion.
avpSchema.methods.estOuverte = function () {
  if (!this.dateLimite) return true;
  return this.dateLimite.getTime() >= Date.now();
};

const Avp = mongoose.model("Avp", avpSchema);

export default Avp;
