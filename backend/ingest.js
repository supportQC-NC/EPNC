// backend/ingest.js
//
// Point d'entrée en ligne de commande de l'ingestion.
//
//   npm run data:avps       → offres ouvertes (Hugging Face)
//   npm run data:archive    → archive mensuelle (Hugging Face)
//   npm run data:datagouv   → avis DRHFPNC (data.gouv.nc)
//   npm run data:metiers    → référentiel des métiers
//   npm run data:tout       → les quatre, dans l'ordre
//
//   node backend/ingest.js hf_avps --purge     → vide les offres avant
//   node backend/ingest.js datagouv_avps --historique  → inclut les avis clos
//
// Ce fichier ne contient AUCUNE logique d'ingestion : elle vit dans
// services/ingestionService.js, partagée avec le bouton « Mettre à jour » de
// l'administration. Deux chemins, un seul code — sinon l'un des deux finit par
// mentir sur ce que fait l'autre.
import "./loadEnv.js";
import mongoose from "mongoose";
import connectDB from "./config/db.js";
import Avp from "./models/AvpModel.js";
import {
  executerIngestion,
  sourcesIngerables,
} from "./services/ingestionService.js";

const ORDRE_COMPLET = [
  // Le référentiel d'abord : c'est lui qui donne un sens aux codes métier que
  // portent les offres. Ingérer les offres avant ne casse rien, mais le
  // rapprochement reste muet tant que les métiers ne sont pas là.
  "referentiel_metiers",
  "hf_avps",
  "hf_archive",
  "datagouv_avps",
];

const drapeaux = process.argv.slice(2).filter((a) => a.startsWith("--"));
const demandees = process.argv.slice(2).filter((a) => !a.startsWith("--"));

const options = {};
if (drapeaux.includes("--historique")) {
  options.statut = null;
  options.maximum = 2000;
}

const sources = drapeaux.includes("--tout")
  ? ORDRE_COMPLET
  : demandees.length
    ? demandees
    : ORDRE_COMPLET;

const run = async () => {
  const connues = sourcesIngerables().map((s) => s.id);
  const inconnues = sources.filter((s) => !connues.includes(s));

  if (inconnues.length) {
    console.error(`❌ Source inconnue : ${inconnues.join(", ")}`);
    console.error(`   Sources disponibles : ${connues.join(", ")}`);
    process.exit(1);
  }

  await connectDB();

  try {
    if (drapeaux.includes("--purge")) {
      const { deletedCount } = await Avp.deleteMany();
      console.log(`🗑️  ${deletedCount} offre(s) supprimée(s) avant ingestion`);
    }

    for (const id of sources) {
      console.log(`\n⬇️  ${id}…`);

      try {
        const r = await executerIngestion(id, { declencheur: "console", options });
        console.log(
          `✅ ${r.libelle} — ${r.crees} créé(s), ${r.majs} mis à jour` +
            `${r.ignores ? `, ${r.ignores} ignoré(s)` : ""} en ${(r.dureeMs / 1000).toFixed(1)} s`,
        );
        if (r.message) console.log(`   ${r.message}`);
      } catch (erreur) {
        // Une source en panne ne doit pas empêcher les autres de se
        // synchroniser : on signale et on continue.
        console.error(`❌ ${id} : ${erreur.message}`);
        process.exitCode = 1;
      }
    }

    const total = await Avp.countDocuments();
    const ouvertes = await Avp.countDocuments({
      $or: [{ dateLimite: null }, { dateLimite: { $gte: new Date() } }],
    });

    console.log("");
    console.log(`📊 En base : ${total} offre(s), dont ${ouvertes} encore ouverte(s)`);
  } finally {
    await mongoose.connection.close();
  }
};

run();
