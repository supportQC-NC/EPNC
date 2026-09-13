// backend/services/entretienService.js
//
// L'entretien guidé : construire un parcours avec quelqu'un qui n'a pas de CV.
//
// ══════════════════════════════════════════════════════════════════════════
//  C'EST LA PORTE QUE LE RÈGLEMENT RÉCLAME
// ══════════════════════════════════════════════════════════════════════════
// Le hackathon insiste sur le candidat *sans* CV. Or les deux autres portes du
// profil (saisie manuelle, import JSON Resume) supposent toutes deux qu'on a
// déjà mis son parcours en forme — c'est-à-dire qu'on sait ce qu'est une
// « réalisation », comment nommer un poste, quelles compétences déclarer.
//
// Quelqu'un qui a gardé des enfants, tenu la caisse du magasin d'un oncle et
// entraîné l'équipe de foot du quartier n'a rien de tout cela. Il a pourtant un
// parcours, et des compétences réelles — elles n'ont simplement jamais été
// écrites dans le vocabulaire qu'un recruteur lit.
//
// Cet entretien fait ce travail-là, et seulement celui-là : il TRADUIT ce que
// la personne raconte. Il ne le complète pas.
//
// ══════════════════════════════════════════════════════════════════════════
//  TROIS RÈGLES QUI NE SE NÉGOCIENT PAS
// ══════════════════════════════════════════════════════════════════════════
//
// 1. 🔴 AUCUN FAIT N'EST AJOUTÉ. Le modèle reformule, il n'enrichit jamais.
//    Pas de durée devinée, pas d'employeur complété, pas de compétence
//    « qu'on a forcément quand on a fait ça ». Le texte produit sera signé par
//    la personne au bas d'une lettre : une invention ici devient un mensonge
//    en entretien d'embauche.
//
// 2. 🔴 RIEN N'EST ENREGISTRÉ SANS VALIDATION. Chaque proposition revient à
//    l'écran, modifiable, et n'est écrite que si la personne la confirme. Un
//    entretien qui remplit le profil tout seul produit un CV que son auteur
//    découvre — et ne peut pas défendre.
//
// 3. 🔴 ÇA MARCHE SANS MODÈLE DE LANGUE. Sans `OPENAI_API_KEY`, l'entretien
//    reste utilisable : les réponses sont reprises telles quelles, sans
//    reformulation, et c'est dit. La démo ne dépend pas d'une clé, et une
//    panne d'API ne ferme pas la seule porte ouverte aux gens sans CV.

import { appelerModele, iaDisponible } from "./modeleService.js";
import { memeCompetence } from "./matchingService.js";
import { Competence } from "../models/MetierModel.js";

// ── Les étapes ────────────────────────────────────────────────────────────
//
// Volontairement PEU NOMBREUSES et fermées. Un entretien ouvert « racontez-moi
// votre vie » produit un texte qu'on ne sait pas découper, et met la personne
// en difficulté : on ne sait pas répondre à une question sans bord.
//
// Chaque question est écrite pour quelqu'un qui ne s'est jamais pensé comme un
// candidat. D'où les exemples : ils disent, sans le dire, que le bénévolat et
// l'aide familiale comptent.
export const ETAPES = [
  {
    cle: "experiences",
    titre: "Ce que vous avez fait",
    question:
      "Racontez une chose que vous avez faite, avec vos mots. Ce que vous faisiez au quotidien, pour qui, et pendant combien de temps.",
    aide: "Un emploi, bien sûr — mais aussi un stage, du bénévolat, un coup de main régulier dans l'entreprise ou l'exploitation d'un proche, s'occuper de quelqu'un, encadrer une équipe sportive ou une association. Tout cela compte, et c'est rarement écrit sur un CV.",
    exemple:
      "J'ai tenu la caisse et réceptionné les livraisons dans le magasin de mon oncle à Koné, les samedis pendant trois ans. Je faisais aussi les commandes quand il n'était pas là.",
    repetable: true,
  },
  {
    cle: "formations",
    titre: "Ce que vous avez appris",
    question:
      "Avez-vous suivi une formation, un diplôme, un certificat, un permis, une habilitation ?",
    aide: "Un diplôme scolaire, mais aussi une formation courte, un stage de secourisme, un permis, une habilitation électrique, une formation suivie dans une association. Si vous n'avez aucun diplôme, dites-le : ce n'est pas rédhibitoire, et beaucoup de postes sont ouverts sans diplôme exigé.",
    exemple: "J'ai le brevet. J'ai passé le PSC1 en 2022 avec la Croix-Rouge.",
    repetable: true,
    facultative: true,
  },
  {
    cle: "recherche",
    titre: "Ce que vous cherchez",
    question: "Quel genre de travail cherchez-vous, et où ?",
    aide: "Même vague, c'est utile : « quelque chose avec du contact », « du travail de bureau », « pas de nuit ». Cela sert à écarter les postes qui ne vous intéressent pas, pas à vous y enfermer.",
    exemple:
      "J'aimerais travailler dans un bureau, plutôt vers Nouméa. Je ne peux pas travailler de nuit.",
  },
];

// ── Structuration d'une réponse ───────────────────────────────────────────

const SOCLE_EXPERIENCE = `Tu aides une personne qui n'a pas de CV à mettre en forme ce qu'elle vient de raconter, pour un dossier de candidature dans la fonction publique calédonienne.

RÈGLE ABSOLUE — tu REFORMULES, tu n'AJOUTES RIEN :
- Aucun fait qui ne soit pas dans le récit. Pas de durée, pas de date, pas d'employeur, pas de lieu, pas de chiffre inventés.
- Si une information manque, laisse le champ vide. N'écris jamais « XXX », « à compléter » ou une estimation.
- N'ajoute aucune compétence que le récit ne montre pas. « A tenu une caisse » montre l'encaissement et la relation client ; cela ne montre pas la comptabilité.

CE QUE TU FAIS :
- Tu donnes un intitulé de poste simple et honnête, en français courant. Pas de titre ronflant : « Employé de magasin », pas « Responsable des opérations commerciales ».
- Tu écris la description à la première personne du singulier, au passé, en une à trois phrases sobres.
- Tu extrais les compétences RÉELLEMENT montrées par le récit, en les nommant comme un référentiel métier le ferait.
- Le bénévolat, l'aide familiale et les activités associatives sont des expériences à part entière : traite-les comme telles, sans les minorer ni les gonfler.

Réponds en JSON strict :
{"poste":"","employeur":"","lieu":"","debut":"","fin":"","enCours":false,"description":"","realisations":["",""],"competences":["",""],"manquant":["ce qu'il faudrait demander à la personne pour compléter"]}`;

const SOCLE_FORMATION = `Tu mets en forme ce qu'une personne vient de dire sur ses formations, pour un dossier de candidature.

RÈGLE ABSOLUE — tu REFORMULES, tu n'AJOUTES RIEN. Aucun diplôme, établissement, niveau ou année qui ne soit pas dit. Si la personne déclare n'avoir aucun diplôme, renvoie une liste vide : c'est une réponse valable, pas une erreur.

Une personne peut mentionner plusieurs choses en une phrase : sépare-les.
Un permis, une habilitation ou une attestation de secourisme sont des formations à retenir.

Réponds en JSON strict :
{"formations":[{"intitule":"","etablissement":"","niveau":"","annee":"","enCours":false}]}`;

const SOCLE_RECHERCHE = `Tu mets en forme ce qu'une personne vient de dire sur le travail qu'elle cherche.

RÈGLE ABSOLUE — tu REFORMULES, tu n'AJOUTES RIEN. N'invente ni métier précis, ni secteur, ni contrainte qui ne soit pas exprimée.

"provinces" ne peut contenir que ces valeurs exactes : "Province Sud", "Province Nord", "Province des îles Loyauté". Nouméa, Dumbéa, Mont-Dore, Païta et Bourail sont en Province Sud ; Koné, Koumac, Poindimié et Houaïlou en Province Nord ; Lifou, Maré et Ouvéa en Province des îles Loyauté. Si aucun lieu n'est cité, renvoie une liste vide.

Réponds en JSON strict :
{"projet":"","provinces":[],"mobilite":"","disponibilite":""}`;

// Le modèle renvoie parfois une valeur absente, nulle ou d'un autre type que
// celui annoncé. On normalise ici plutôt qu'à chaque point d'usage : une seule
// lecture défensive, au lieu de dix `?.` disséminés.
const texte = (v) => (typeof v === "string" ? v.trim() : "");
const liste = (v) =>
  Array.isArray(v) ? v.map(texte).filter(Boolean) : [];

const appeler = async (socle, recit, etiquette) => {
  const brut = await appelerModele(socle, recit, {
    // Température basse : on met en forme, on n'écrit pas. Plus elle monte,
    // plus le modèle « complète » — c'est-à-dire invente.
    temperature: 0.2,
    maxTokens: 700,
    json: true,
    etiquette,
  });

  try {
    return JSON.parse(brut);
  } catch {
    // Le mode JSON strict rend ce cas rare, mais pas impossible. On préfère
    // une erreur explicite à un objet vide qui ferait croire à un récit
    // incompréhensible.
    throw new Error(
      "La mise en forme a échoué. Reformulez votre réponse, ou saisissez-la directement dans le formulaire.",
    );
  }
};

/**
 * Met en forme un récit d'expérience.
 *
 * Retourne toujours `{ proposition, source, manquant }` :
 *   - `source: "ia"` = reformulé par le modèle ;
 *   - `source: "brut"` = repris tel quel, faute de modèle disponible.
 * L'appelant DOIT afficher cette distinction : une personne qui croit son
 * texte relu alors qu'il ne l'est pas enverra un récit parlé à un recruteur.
 */
export const structurerExperience = async (recit) => {
  const dit = texte(recit);

  if (dit.length < 15) {
    throw new Error(
      "Racontez un peu plus : ce que vous faisiez, pour qui, et pendant combien de temps.",
    );
  }

  if (!iaDisponible()) {
    // Mode dégradé assumé : le récit devient la description, sans traduction.
    // C'est moins bon, et c'est dit à l'écran — mais la porte reste ouverte.
    return {
      source: "brut",
      proposition: {
        poste: "",
        employeur: "",
        lieu: "",
        debut: "",
        fin: "",
        enCours: false,
        description: dit,
        realisations: [],
      },
      competences: [],
      manquant: [
        "Donnez un intitulé à cette expérience et complétez les dates : la mise en forme automatique n'est pas disponible.",
      ],
    };
  }

  const r = await appeler(SOCLE_EXPERIENCE, dit, "entretien:experience");

  return {
    source: "ia",
    proposition: {
      poste: texte(r.poste),
      employeur: texte(r.employeur),
      lieu: texte(r.lieu),
      debut: texte(r.debut),
      fin: texte(r.fin),
      enCours: Boolean(r.enCours),
      description: texte(r.description),
      realisations: liste(r.realisations),
    },
    competences: liste(r.competences),
    // Ce qu'il faudrait demander en plus. Affiché comme des questions, pas
    // comme des erreurs : la personne a bien répondu, il manque juste des
    // éléments qu'un recruteur cherchera.
    manquant: liste(r.manquant),
  };
};

/** Met en forme un récit de formations. */
export const structurerFormations = async (recit) => {
  const dit = texte(recit);

  if (!dit) return { source: "brut", formations: [] };

  if (!iaDisponible()) {
    return {
      source: "brut",
      formations: [{ intitule: dit, etablissement: "", niveau: "", annee: "", enCours: false }],
    };
  }

  const r = await appeler(SOCLE_FORMATION, dit, "entretien:formation");

  return {
    source: "ia",
    formations: (Array.isArray(r.formations) ? r.formations : [])
      .map((f) => ({
        intitule: texte(f?.intitule),
        etablissement: texte(f?.etablissement),
        niveau: texte(f?.niveau),
        annee: texte(f?.annee),
        enCours: Boolean(f?.enCours),
      }))
      .filter((f) => f.intitule),
  };
};

const PROVINCES = [
  "Province Sud",
  "Province Nord",
  "Province des îles Loyauté",
];

/** Met en forme ce que la personne cherche. */
export const structurerRecherche = async (recit) => {
  const dit = texte(recit);

  if (!dit) return { source: "brut", projet: "", provinces: [], mobilite: "", disponibilite: "" };

  if (!iaDisponible()) {
    return { source: "brut", projet: dit, provinces: [], mobilite: "", disponibilite: "" };
  }

  const r = await appeler(SOCLE_RECHERCHE, dit, "entretien:recherche");

  return {
    source: "ia",
    projet: texte(r.projet),
    // Filtré contre la liste fermée : le modèle propose parfois « Nouméa » ou
    // « Grand Nouméa », qui feraient échouer la validation Mongoose au moment
    // de l'enregistrement — c'est-à-dire après que la personne a cru avoir fini.
    provinces: liste(r.provinces).filter((p) => PROVINCES.includes(p)),
    mobilite: texte(r.mobilite),
    disponibilite: texte(r.disponibilite),
  };
};

// ── Rapprochement des compétences avec le référentiel ─────────────────────

/**
 * Rapproche des compétences dites en langage courant du vocabulaire du
 * référentiel métiers.
 *
 * POURQUOI : c'est tout l'enjeu pour quelqu'un sans CV. « Je tenais la caisse »
 * devient « Relation client » — un terme que le moteur de rapprochement sait
 * confronter aux attendus d'une offre, et qu'un recruteur reconnaît. Sans
 * cette traduction, l'expérience existe mais reste invisible.
 *
 * ⚠️ On ne REMPLACE jamais le mot de la personne : on PROPOSE le terme du
 * référentiel à côté, et c'est elle qui tranche. Substituer d'office
 * reviendrait à lui faire déclarer une compétence qu'elle n'a pas dite.
 *
 * ⚠️ La comparaison passe par `memeCompetence` (matchingService), la MÊME
 * règle que les suggestions du recruteur. Une première version comparait les
 * mots de plus de trois lettres avec un seuil de similarité, et produisait à
 * l'essai : « Gestion des livraisons » → « Gestion de l'information »,
 * « Gestion des soins » → « Gestion de l'information ». Le mot « gestion »
 * portait tout le rapprochement à lui seul — exactement le défaut que la règle
 * des deux mots communs a été écrite pour corriger. Une suggestion absurde
 * décrédibilise toutes les autres, et la personne cesse de les lire.
 */
export const rapprocherCompetences = async (competences) => {
  const dites = liste(competences);
  if (dites.length === 0) return [];

  const referentiel = await Competence.find({}, "nom").lean();

  return dites.map((dite) => ({
    dite,
    referentiel: referentiel.find((c) => memeCompetence(dite, c.nom))?.nom || null,
  }));
};
