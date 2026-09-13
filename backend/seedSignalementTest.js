// backend/seedSignalementTest.js
//
// Crée un dossier de signalement de démonstration, pour éprouver l'écran de
// modération sans avoir à refaire le parcours à la main.
//
//   node backend/seedSignalementTest.js
//
// ⚠️ Vide la collection des signalements avant d'écrire : c'est un outil de
// mise au point, pas un script d'exploitation.
import "./loadEnv.js";
import mongoose from "mongoose";
import connectDB from "./config/db.js";
import User from "./models/UserModel.js";
import Signalement from "./models/SignalementModel.js";

const run = async () => {
  await connectDB();

  try {
    const { deletedCount } = await Signalement.deleteMany({});
    console.log(`🗑️  ${deletedCount} signalement(s) supprimé(s)`);

    const signalant = await User.findOne({ email: "recruteur@example.com" });
    const cible = await User.findOne({ email: "kevin.poadja@example.com" });

    if (!signalant || !cible) {
      throw new Error(
        "Comptes de démonstration absents. Lancez d'abord : npm run data:comptes-test",
      );
    }

    // On repart aussi d'un dossier disciplinaire vierge, sinon les tests
    // successifs s'empilent et le seuil est atteint sans qu'on comprenne.
    cible.avertissements = [];
    cible.masqueLe = null;
    cible.regulariserAvant = null;
    await cible.save({ validateBeforeSave: false });

    await Signalement.create({
      signalePar: signalant._id,
      roleSignalant: signalant.role,
      cible: cible._id,
      cibleNom: cible.nom,
      ciblePrenom: cible.prenom,
      cibleEmail: cible.email,
      cibleRole: cible.role,
      motif: "informations_fausses",
      details:
        "Le BTS est annoncé comme obtenu en 2025, mais l'établissement confirme une sortie sans diplôme.",
    });

    console.log(`✅ Dossier créé : ${signalant.email} → ${cible.email}`);
    console.log("   Écran : /admin/moderation");
  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

run();
