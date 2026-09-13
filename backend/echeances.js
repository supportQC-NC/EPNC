// backend/echeances.js
//
// Applique les échéances de régularisation : supprime les comptes dont le
// délai est écoulé sans que la personne ait pris contact.
//
//   npm run moderation:echeances              → liste SANS rien supprimer
//   npm run moderation:echeances -- --appliquer → supprime réellement
//
// ⚠️ Le défaut est la SIMULATION. Un script de suppression qui supprime au
// premier lancement, c'est la commande qu'on tape une fois de trop.
//
// À brancher sur une tâche planifiée quotidienne. Sans elle, les délais
// s'accumulent sans conséquence et l'annonce faite aux personnes — « passé ce
// délai, votre compte sera supprimé » — devient fausse.
import "./loadEnv.js";
import mongoose from "mongoose";
import connectDB from "./config/db.js";
import { traiterEcheances, echeancesAVenir } from "./services/moderationService.js";

const appliquer = process.argv.includes("--appliquer");

const run = async () => {
  await connectDB();

  try {
    const aVenir = await echeancesAVenir();

    console.log(`\n📋 ${aVenir.length} compte(s) sous échéance :\n`);
    for (const c of aVenir) {
      const etat =
        c.joursRestants > 0
          ? `${c.joursRestants} jour(s) restant(s)`
          : `ÉCHU depuis ${-c.joursRestants} jour(s)`;
      console.log(
        `   ${c.email.padEnd(34)} ${String(c.avertissements)} avert. · ${etat}`,
      );
    }

    const r = await traiterEcheances({ simulation: !appliquer });

    console.log("");
    if (!appliquer) {
      console.log(
        `🔎 SIMULATION — ${r.total} compte(s) seraient supprimés.` +
          (r.total ? " Relancez avec --appliquer pour le faire." : ""),
      );
    } else {
      console.log(`🗑️  ${r.total} compte(s) supprimé(s).`);
    }
    console.log("");
  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

run();
