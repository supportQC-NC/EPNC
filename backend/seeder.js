// backend/seeder.js
//
// Crée le compte administrateur initial à partir des variables SEED_ADMIN_*.
//   npm run data:import   → crée (ou réactive) le compte admin
//   npm run data:destroy  → supprime TOUS les comptes
//
// Idempotent : relancer l'import ne crée pas de doublon.
import "./loadEnv.js";
import mongoose from "mongoose";
import connectDB from "./config/db.js";
import User from "./models/UserModel.js";

const { SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, SEED_ADMIN_NOM, SEED_ADMIN_PRENOM } =
  process.env;

const importerDonnees = async () => {
  if (!SEED_ADMIN_EMAIL || !SEED_ADMIN_PASSWORD) {
    console.error(
      "❌ SEED_ADMIN_EMAIL et SEED_ADMIN_PASSWORD doivent être renseignés dans .env",
    );
    process.exit(1);
  }

  const email = SEED_ADMIN_EMAIL.toLowerCase().trim();
  const existant = await User.findOne({ email });

  if (existant) {
    existant.role = "admin";
    existant.isActive = true;
    await existant.save();
    console.log(`✅ Compte admin déjà présent, réactivé : ${email}`);
    return;
  }

  await User.create({
    email,
    password: SEED_ADMIN_PASSWORD,
    nom: SEED_ADMIN_NOM || "Admin",
    prenom: SEED_ADMIN_PRENOM || "EPNC",
    role: "admin",
  });

  console.log(`✅ Compte admin créé : ${email}`);
};

const detruireDonnees = async () => {
  const { deletedCount } = await User.deleteMany();
  console.log(`🗑️  ${deletedCount} compte(s) supprimé(s)`);
};

const run = async () => {
  await connectDB();
  try {
    if (process.argv[2] === "-d") {
      await detruireDonnees();
    } else {
      await importerDonnees();
    }
  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

run();
