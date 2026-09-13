// backend/services/ingestionService.js
//
// Toute l'ingestion, au même endroit, appelable de DEUX façons :
//
//   - en ligne de commande  : `npm run data:avps`, `npm run data:metiers`…
//   - depuis l'administration : un bouton « Mettre à jour »
//
// ══════════════════════════════════════════════════════════════════════════
//  POURQUOI LES DEUX, ET PAS SEULEMENT LE BOUTON
// ══════════════════════════════════════════════════════════════════════════
// La console reste indispensable :
//   - elle fonctionne AVANT que l'application ait le moindre compte, donc à
//     l'installation — c'est le premier geste de qui déploie le projet ;
//   - elle est branchable sur une tâche planifiée (cron, GitHub Actions) sans
//     inventer une authentification machine ;
//   - elle ne dépend pas du serveur web, donc elle survit à une panne du front.
//
// Le bouton était néanmoins ce qui manquait : personne ne devrait avoir besoin
// d'un terminal pour rafraîchir un catalogue d'offres. La logique étant ici,
// les deux chemins exécutent EXACTEMENT le même code — deux implémentations
// auraient fini par diverger, et le bouton aurait cessé de prouver quoi que
// ce soit.

import Avp from "../models/AvpModel.js";
import IngestRun from "../models/IngestRunModel.js";
import { Famille, Competence, Metier } from "../models/MetierModel.js";
import { normaliserAvp } from "./avpNormaliser.js";
import {
  versJobPosting,
  telechargerDataGouv,
} from "./dataGouvNormaliser.js";
import { parserCsv, versBooleen, versNombre } from "../utils/csv.js";
import { trouverSource } from "../config/sources.js";

// ── Écriture commune ──────────────────────────────────────────────────────

// Enregistre un lot d'offres normalisées. Renvoie le compte des créations et
// des mises à jour — c'est la seule information vraiment utile sur un corpus
// qui tourne : combien d'offres sont NOUVELLES.
const enregistrerAvps = async (documents) => {
  let crees = 0;
  let majs = 0;

  for (const doc of documents) {
    const res = await Avp.findOneAndUpdate({ idAvp: doc.idAvp }, doc, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
      includeResultMetadata: true,
    });

    if (res.lastErrorObject?.updatedExisting) majs += 1;
    else crees += 1;
  }

  return { crees, majs };
};

const telechargerTexte = async (url, quoi) => {
  const reponse = await fetch(url, { redirect: "follow" });

  if (!reponse.ok) {
    throw new Error(
      `${quoi} : téléchargement impossible (HTTP ${reponse.status} ${reponse.statusText}).`,
    );
  }

  return reponse.text();
};

// JSONL : une ligne = un objet. Une ligne illisible ne doit pas faire échouer
// l'ingestion entière — on la signale et on continue.
const lireJsonl = (texte) => {
  const lignes = texte.split("\n").filter((l) => l.trim());
  const objets = [];
  let rejetees = 0;

  for (const ligne of lignes) {
    try {
      objets.push(JSON.parse(ligne));
    } catch {
      rejetees += 1;
    }
  }

  return { objets, rejetees };
};

// ── Source 1 : offres ouvertes du dataset Hugging Face ────────────────────

const HF_JSONL =
  process.env.AVP_DATASET_URL ||
  "https://huggingface.co/datasets/opt-nc/odata-avps/resolve/main/data/all_avps.jsonl";

const ingererHfLive = async () => {
  const { objets, rejetees } = lireJsonl(
    await telechargerTexte(HF_JSONL, "Dataset Hugging Face"),
  );

  const documents = objets.map(normaliserAvp).filter(Boolean);
  const { crees, majs } = await enregistrerAvps(documents);

  return {
    recus: objets.length,
    crees,
    majs,
    ignores: objets.length - documents.length + rejetees,
    message: `${objets.length} offre(s) publiée(s) dans le dataset.`,
  };
};

// ── Source 2 : archive mensuelle Hugging Face ─────────────────────────────
//
// C'est la réserve du projet. Le fichier des offres ouvertes est tombé à deux
// entrées le 13/09/2026 ; l'archive, elle, conserve un fichier par offre et par
// mois depuis juin. Sans elle, il n'y a ni démonstration crédible, ni jeu
// d'évaluation qui tienne — et le règlement note explicitement la qualité du
// rapprochement.

const HF_ARBRE =
  "https://huggingface.co/api/datasets/opt-nc/odata-avps/tree/main/data/2026";
const HF_FICHIER =
  "https://huggingface.co/datasets/opt-nc/odata-avps/resolve/main/";

const ingererHfArchive = async () => {
  const mois = await (await fetch(HF_ARBRE, { redirect: "follow" })).json();

  if (!Array.isArray(mois)) {
    throw new Error("Archive Hugging Face : arborescence illisible.");
  }

  const detail = {};
  let recus = 0;
  let crees = 0;
  let majs = 0;
  let ignores = 0;

  for (const dossier of mois.filter((m) => m.type === "directory")) {
    const fichiers = await (
      await fetch(
        `https://huggingface.co/api/datasets/opt-nc/odata-avps/tree/main/${dossier.path}`,
        { redirect: "follow" },
      )
    ).json();

    const documents = [];

    for (const fichier of fichiers.filter((f) => f.type === "file")) {
      const brut = await (
        await fetch(HF_FICHIER + fichier.path, { redirect: "follow" })
      ).json();

      recus += 1;

      // ⚠️ Les fichiers d'archive ne portent PAS `id_avp` — seulement
      // `identifier`. Le normaliseur commun accepte les deux : c'est
      // exactement ce pour quoi il a été écrit.
      const doc = normaliserAvp(brut);

      if (!doc) {
        ignores += 1;
        continue;
      }

      // La provenance est tracée : ces offres sont pour la plupart expirées, et
      // l'on doit pouvoir les distinguer des offres vivantes sans comparer des
      // dates.
      doc.source = `huggingface:opt-nc/odata-avps#archive/${dossier.path.split("/").pop()}`;
      documents.push(doc);
    }

    const r = await enregistrerAvps(documents);
    crees += r.crees;
    majs += r.majs;
    detail[dossier.path.split("/").pop()] = {
      recus: fichiers.length,
      ...r,
    };
  }

  return {
    recus,
    crees,
    majs,
    ignores,
    detail,
    message: `${recus} offre(s) archivée(s) sur ${Object.keys(detail).length} mois.`,
  };
};

// ── Source 3 : data.gouv.nc (DRHFPNC) ─────────────────────────────────────
//
// Un autre employeur public, un tout autre schéma — et pourtant aucune ligne à
// changer dans le cœur : l'adaptateur produit du JobPosting, le normaliseur
// commun fait le reste.

const ingererDataGouv = async ({ statut = "PUBLIE", maximum = 1000 } = {}) => {
  const enregistrements = await telechargerDataGouv({ statut, maximum });

  const documents = enregistrements
    .map(versJobPosting)
    .filter(Boolean)
    .map((jobPosting) => {
      const doc = normaliserAvp(jobPosting);
      if (doc) doc.source = "data.gouv.nc:avis-de-vacances-de-poste-avp-drhfpnc";
      return doc;
    })
    .filter(Boolean);

  const { crees, majs } = await enregistrerAvps(documents);

  return {
    recus: enregistrements.length,
    crees,
    majs,
    ignores: enregistrements.length - documents.length,
    message:
      `${enregistrements.length} avis DRHFPNC` +
      (statut ? ` au statut ${statut}` : "") +
      `, traduits en schema.org/JobPosting.`,
  };
};

// ── Source 4 : référentiel des métiers ────────────────────────────────────

const telechargerCsv = async (id) => {
  const source = trouverSource(id);
  return parserCsv(await telechargerTexte(source.url, source.nom));
};

const upsertLot = async (modele, docs, cle) => {
  if (!docs.length) return { crees: 0, majs: 0 };

  const r = await modele.bulkWrite(
    docs.map((d) => ({
      updateOne: { filter: { [cle]: d[cle] }, update: { $set: d }, upsert: true },
    })),
  );

  return { crees: r.upsertedCount || 0, majs: r.modifiedCount || 0 };
};

const ingererMetiers = async () => {
  const [familles, metiers, competences, liaisons] = await Promise.all([
    telechargerCsv("metiers_familles"),
    telechargerCsv("metiers_metiers"),
    telechargerCsv("metiers_competences"),
    telechargerCsv("metiers_liaisons"),
  ]);

  const rf = await upsertLot(
    Famille,
    familles.map((f) => ({
      code: f.famille_metier_id,
      libelle: f.libelle,
      description: f.description || "",
    })),
    "code",
  );

  const rc = await upsertLot(
    Competence,
    competences.map((c) => ({
      code: c.code_competence,
      nom: c.nom_competence,
      groupe: c.groupe_competence_id || null,
      referentiel: c.referentiel_competence_id || null,
    })),
    "code",
  );

  const nomParCode = new Map(
    competences.map((c) => [c.code_competence, c.nom_competence]),
  );

  const parMetier = new Map();
  for (const l of liaisons) {
    // Une liaison désactivée décrit un attendu qui n'a plus cours : la
    // conserver fausserait le rapprochement.
    if (!versBooleen(l.est_actif)) continue;

    if (!parMetier.has(l.code_metier)) parMetier.set(l.code_metier, []);
    parMetier.get(l.code_metier).push({
      code: l.code_competence,
      nom: nomParCode.get(l.code_competence) || l.code_competence,
      poids: versNombre(l.poids),
      niveauRequis: versNombre(l.niveau_requis),
    });
  }

  const rm = await upsertLot(
    Metier,
    metiers.map((m) => ({
      code: m.code_metier,
      nom: m.nom_metier,
      familleCode: m.famille_metier_id || null,
      statut: m.statut_metier_id || null,
      actif: versBooleen(m.metier_actif),
      competences: (parMetier.get(m.code_metier) || []).sort(
        (a, b) => (b.poids || 0) - (a.poids || 0),
      ),
    })),
    "code",
  );

  const sansCompetence = await Metier.countDocuments({
    competences: { $size: 0 },
  });

  return {
    recus: familles.length + metiers.length + competences.length,
    crees: rf.crees + rc.crees + rm.crees,
    majs: rf.majs + rc.majs + rm.majs,
    ignores: 0,
    detail: { familles: rf, competences: rc, metiers: rm },
    message:
      `${familles.length} familles, ${metiers.length} métiers, ${competences.length} compétences.` +
      (sansCompetence > 0
        ? ` ⚠️ ${sansCompetence} métier(s) sans aucune compétence rattachée.`
        : ""),
  };
};

// ── Registre ──────────────────────────────────────────────────────────────

export const INGESTIONS = {
  hf_avps: { libelle: "Offres ouvertes (Hugging Face)", executer: ingererHfLive },
  hf_archive: {
    libelle: "Archive mensuelle (Hugging Face)",
    executer: ingererHfArchive,
  },
  datagouv_avps: {
    libelle: "Avis DRHFPNC (data.gouv.nc)",
    executer: ingererDataGouv,
  },
  referentiel_metiers: {
    libelle: "Référentiel des métiers",
    executer: ingererMetiers,
  },
};

export const sourcesIngerables = () =>
  Object.entries(INGESTIONS).map(([id, { libelle }]) => ({ id, libelle }));

/**
 * Lance une ingestion et la journalise, quoi qu'il arrive.
 *
 * Le journal est écrit AUSSI en cas d'échec : une synchro qui a planté est
 * précisément celle qu'on cherche trois jours plus tard, et elle ne laisserait
 * sinon aucune trace.
 */
export const executerIngestion = async (
  id,
  { declencheur = "console", par = null, options = {} } = {},
) => {
  const ingestion = INGESTIONS[id];

  if (!ingestion) {
    throw new Error(`Source inconnue : ${id}`);
  }

  const depart = Date.now();
  let journal = null;

  try {
    journal = await IngestRun.create({
      source: id,
      libelle: ingestion.libelle,
      declencheur,
      par,
      statut: "en_cours",
    });
  } catch {
    // Une base indisponible pour le journal ne doit pas empêcher d'essayer
    // l'ingestion ; on continue sans trace plutôt que de tout arrêter.
  }

  try {
    const resultat = await ingestion.executer(options);
    const dureeMs = Date.now() - depart;

    if (journal) {
      Object.assign(journal, { ...resultat, statut: "succes", dureeMs });
      await journal.save();
    }

    return { id, libelle: ingestion.libelle, statut: "succes", dureeMs, ...resultat };
  } catch (erreur) {
    const dureeMs = Date.now() - depart;

    if (journal) {
      Object.assign(journal, {
        statut: "echec",
        message: erreur.message,
        dureeMs,
      });
      await journal.save();
    }

    const echec = new Error(erreur.message);
    echec.ingestion = { id, libelle: ingestion.libelle, statut: "echec", dureeMs };
    throw echec;
  }
};

/** Les dernières synchronisations, et la dernière réussie par source. */
export const journalIngestion = async (limite = 20) => {
  const [recentes, parSource] = await Promise.all([
    IngestRun.find().sort({ createdAt: -1 }).limit(limite).lean(),
    IngestRun.aggregate([
      { $match: { statut: "succes" } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: "$source", derniere: { $first: "$$ROOT" } } },
    ]),
  ]);

  return {
    recentes,
    derniereParSource: Object.fromEntries(
      parSource.map((l) => [l._id, l.derniere]),
    ),
  };
};
