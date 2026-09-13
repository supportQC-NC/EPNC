// backend/veille.js
//
// Un tour de veille depuis la console.
//
//   npm run veille                 → rapproche et envoie les alertes immédiates
//   npm run veille -- --quotidien  → envoie les récapitulatifs quotidiens
//
// La veille se déclenche normalement à l'ingestion (voir ingestionService).
// Ce script sert à deux choses que l'ingestion ne couvre pas :
//   - le RÉCAPITULATIF QUOTIDIEN, pour qui n'a pas choisi l'alerte immédiate ;
//   - le RATTRAPAGE, quand un envoi a échoué ou qu'un profil vient d'être
//     complété — les offres n'ont pas bougé, mais le rapprochement, si.
//
// À brancher sur une tâche planifiée quotidienne.
import "./loadEnv.js";
import mongoose from "mongoose";
import connectDB from "./config/db.js";
import { tourDeVeille } from "./services/veilleService.js";

const quotidien = process.argv.includes("--quotidien");

const run = async () => {
  await connectDB();

  try {
    const r = await tourDeVeille({
      frequences: quotidien ? ["quotidien"] : ["immediat"],
    });

    console.log("");
    console.log(
      `🔔 Candidats  : ${r.candidats.notifications} alerte(s) pour ${r.candidats.candidats} personne(s) · ${r.candidats.examinees} offre(s) examinées`,
    );
    console.log(
      `🔔 Recruteurs : ${r.recruteurs.notifications} alerte(s) pour ${r.recruteurs.recruteurs} personne(s) · ${r.recruteurs.examines} profil(s) examinés`,
    );
    console.log(
      `📧 Courriels  : ${r.envois.envoyes} envoyé(s) sur ${r.envois.destinataires} destinataire(s)` +
        (r.envois.echecs ? ` · ${r.envois.echecs} échec(s)` : ""),
    );
    console.log("");
  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

run();
