import dotenv from "dotenv"; dotenv.config();
import mongoose from "mongoose";
await mongoose.connect(process.env.MONGO_URI);
const { structurerExperience, structurerFormations, structurerRecherche, rapprocherCompetences } =
  await import("./backend/services/entretienService.js");

const RECITS = [
  "J'ai tenu la caisse et receptionne les livraisons dans le magasin de mon oncle a Kone, les samedis pendant trois ans. Je faisais aussi les commandes quand il n'etait pas la.",
  "Je m'occupe de ma grand-mere depuis 2019 : les rendez-vous medicaux, les papiers de la CAFAT, les courses. J'ai appris a remplir des dossiers administratifs compliques.",
  "J'entraine l'equipe de foot des jeunes du quartier tous les mercredis depuis 5 ans, une vingtaine de gamins. J'organise les deplacements et je gere le materiel.",
];

for (const r of RECITS) {
  console.log("\n" + "=".repeat(70));
  console.log("RECIT :", r.slice(0, 90) + "...");
  try {
    const res = await structurerExperience(r);
    console.log("  source     :", res.source);
    console.log("  poste      :", res.proposition.poste);
    console.log("  employeur  :", res.proposition.employeur || "(vide)");
    console.log("  lieu       :", res.proposition.lieu || "(vide)");
    console.log("  dates      :", res.proposition.debut || "(vide)", "->", res.proposition.fin || (res.proposition.enCours ? "en cours" : "(vide)"));
    console.log("  description:", res.proposition.description);
    if (res.proposition.realisations.length) console.log("  realisations:", res.proposition.realisations);
    const comp = await rapprocherCompetences(res.competences);
    console.log("  COMPETENCES :");
    comp.forEach((c) => console.log(`     « ${c.dite} »${c.referentiel ? `  ->  referentiel : ${c.referentiel}` : "  (aucun terme du referentiel assez proche)"}`));
    if (res.manquant.length) console.log("  a demander :", res.manquant);
  } catch (e) {
    console.log("  ERREUR :", e.message);
  }
}

console.log("\n" + "=".repeat(70));
console.log("RECIT TROP COURT (doit refuser proprement)");
try { await structurerExperience("j'ai bosse"); } catch (e) { console.log("  ->", e.message); }

console.log("\nFORMATIONS : \"J'ai le brevet. J'ai passe le PSC1 en 2022 avec la Croix-Rouge. Pas d'autre diplome.\"");
const f = await structurerFormations("J'ai le brevet. J'ai passe le PSC1 en 2022 avec la Croix-Rouge. Pas d'autre diplome.");
f.formations.forEach((x) => console.log("   -", JSON.stringify(x)));

console.log("\nAUCUN DIPLOME : \"Je n'ai aucun diplome.\"");
const f2 = await structurerFormations("Je n'ai aucun diplome.");
console.log("   ->", f2.formations.length, "formation(s) — liste vide attendue");

console.log("\nRECHERCHE : \"J'aimerais travailler dans un bureau, plutot vers Noumea ou Dumbea. Je ne peux pas travailler de nuit.\"");
console.log("  ", JSON.stringify(await structurerRecherche("J'aimerais travailler dans un bureau, plutot vers Noumea ou Dumbea. Je ne peux pas travailler de nuit."), null, 1));
process.exit(0);
