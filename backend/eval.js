// backend/eval.js
//
// Évaluation du moteur de rapprochement.
//
//   npm run eval                  → rapport sur les personas de démonstration
//   npm run eval -- --csv         → exporte la matrice complète en CSV
//   npm run eval -- --detail      → détaille chaque désaccord avec l'étiquetage
//
// ══════════════════════════════════════════════════════════════════════════
//  POURQUOI CE FICHIER EXISTE
// ══════════════════════════════════════════════════════════════════════════
// « Notre rapprochement est pertinent » est une affirmation. « Voici la matrice
// de confusion, voici les trois erreurs et pourquoi » est une preuve. Le
// règlement note explicitement la pertinence, l'explicabilité et l'ABSENCE DE
// FAUX POSITIFS : sans chiffre, aucun des trois ne se démontre.
//
// L'étiquetage ci-dessous est fait À LA MAIN, à partir du métier, et
// INDÉPENDAMMENT de ce que produit le moteur. C'est la seule façon qu'il ait
// une valeur : une vérité terrain dérivée du score qu'on veut mesurer ne
// mesure rien du tout.
//
// ⚠️ Les étiquettes portent sur des FAMILLES de postes, pas sur des offres
// précises. Le corpus se renouvelle intégralement en quelques semaines : une
// vérité terrain accrochée à une référence d'annonce serait périmée avant le
// rendu. On étiquette donc « ce persona devrait bien matcher un poste de
// gestion budgétaire », et le script retrouve les offres correspondantes dans
// le corpus du jour.
import "./loadEnv.js";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import connectDB from "./config/db.js";
import Profil from "./models/ProfilModel.js";
import User from "./models/UserModel.js";
import Avp from "./models/AvpModel.js";
import { rapprocherToutes } from "./services/matchingService.js";

// ── Vérité terrain ────────────────────────────────────────────────────────
//
// Pour chaque persona : les familles de postes qui devraient ressortir
// (`pertinent`), celles qui sont défendables (`limite`), et celles qui seraient
// une erreur manifeste (`horsSujet`). Les motifs sont des expressions
// recherchées dans l'intitulé du poste.
const ETIQUETTES = {
  "melanie.tarrou@example.com": {
    role: "Reconversion — secrétariat médical vers l'administratif",
    pertinent: ["secretaire", "assistant", "gestionnaire administratif", "accueil"],
    limite: ["gestionnaire", "charge d'accueil", "agent administratif"],
    horsSujet: ["ingenieur", "medecin", "technicien", "chirurgien", "professeur"],
  },
  "kevin.poadja@example.com": {
    role: "Sortie d'études — BTS informatique",
    pertinent: ["informatique", "support", "technicien informatique", "systeme"],
    limite: ["technicien", "assistant"],
    horsSujet: ["medecin", "directeur", "chef de service", "juriste", "infirmier"],
  },
  "sylvain.berthier@example.com": {
    role: "Surqualifié — ingénieur télécoms, 20 ans",
    pertinent: ["ingenieur", "responsable", "chef de projet", "reseau", "telecom"],
    limite: ["directeur", "charge d'etudes", "coordonnateur"],
    horsSujet: ["secretaire", "agent d'entretien", "medecin", "infirmier"],
  },
  "claire.vasseur@example.com": {
    role: "Hors territoire — juriste en droit public",
    pertinent: ["juriste", "juridique", "droit", "contentieux"],
    limite: ["charge d'etudes", "conseiller", "reglementation"],
    horsSujet: ["technicien", "medecin", "agent d'exploitation", "infirmier"],
  },
  "jb.wamytan@example.com": {
    role: "Sans diplôme, 15 ans d'expérience — exploitation",
    pertinent: ["exploitation", "distribution", "prepose", "courrier", "logistique"],
    limite: ["agent", "conducteur", "magasinier"],
    horsSujet: ["juriste", "ingenieur", "medecin", "professeur", "directeur"],
  },
  "teddy.nekiriai@example.com": {
    role: "Technique — fibre optique",
    pertinent: ["technicien", "fibre", "reseau", "maintenance", "telecom"],
    limite: ["agent technique", "installateur"],
    horsSujet: ["juriste", "medecin", "secretaire", "professeur", "comptable"],
  },
  "lea.ouetcho@example.com": {
    role: "Administratif — gestion budgétaire",
    pertinent: ["budget", "gestionnaire", "comptab", "financier", "controleur"],
    limite: ["administratif", "assistant de gestion"],
    horsSujet: ["technicien", "medecin", "ingenieur", "infirmier", "chirurgien"],
  },
  "maeva.wema@example.com": {
    role: "Relation client — accueil et conseil",
    pertinent: ["clientele", "accueil", "conseiller", "relation"],
    limite: ["charge de", "mediateur", "agent d'accueil"],
    horsSujet: ["ingenieur", "medecin", "technicien", "chirurgien", "professeur"],
  },
};

const normaliser = (t) =>
  (t || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

// Classe une offre pour un persona, selon l'étiquetage. `null` = non étiqueté,
// donc exclu de la mesure : compter comme « hors sujet » tout ce qu'on n'a pas
// nommé gonflerait artificiellement la précision.
const classeAttendue = (intitule, etiquettes) => {
  const n = normaliser(intitule);
  const contient = (liste) => liste.some((m) => n.includes(normaliser(m)));

  if (contient(etiquettes.pertinent)) return "pertinent";
  if (contient(etiquettes.horsSujet)) return "horsSujet";
  if (contient(etiquettes.limite)) return "limite";
  return null;
};

// Classe obtenue, à partir du verdict du moteur.
const classeObtenue = (resultat) => {
  if (resultat.ecarte) return "horsSujet";
  if (!resultat.fiable) return null; // non évaluable : hors mesure
  if (resultat.score >= 70) return "pertinent";
  if (resultat.score >= 45) return "limite";
  return "horsSujet";
};

const CLASSES = ["pertinent", "limite", "horsSujet"];

const LIBELLES = {
  pertinent: "pertinent",
  limite: "limite",
  horsSujet: "hors sujet",
};

const pct = (n, d) => (d === 0 ? "—" : `${Math.round((n / d) * 100)} %`);

const run = async () => {
  await connectDB();

  const detaille = process.argv.includes("--detail");
  const csv = process.argv.includes("--csv");

  // Offres OUVERTES seulement. Une offre close est écartée pour clôture — une
  // exclusion mécanique qui n'apprend rien sur la qualité du rapprochement, et
  // qui noierait le signal sous quarante exclusions sans intérêt.
  const avps = await Avp.find({
    $or: [{ dateLimite: null }, { dateLimite: { $gte: new Date() } }],
  });
  const enBase = await Avp.countDocuments();
  console.log(
    `📦 Corpus : ${avps.length} offres ouvertes (sur ${enBase} en base)\n`,
  );

  // Matrice de confusion : attendu × obtenu.
  const matrice = Object.fromEntries(
    CLASSES.map((a) => [a, Object.fromEntries(CLASSES.map((o) => [o, 0]))]),
  );

  const desaccords = [];
  const lignesCsv = [
    "persona,offre,employeur,attendu,obtenu,score,fiabilite,ecarte,motif",
  ];
  let nonEvaluables = 0;
  let nonEtiquetees = 0;

  for (const [email, etiquettes] of Object.entries(ETIQUETTES)) {
    const user = await User.findOne({ email });
    if (!user) {
      console.warn(`⚠️  ${email} introuvable — lancez npm run data:comptes-test`);
      continue;
    }

    const profil = await Profil.findOne({ user: user._id });
    if (!profil) {
      console.warn(`⚠️  Profil manquant pour ${email}`);
      continue;
    }

    const { retenus, ecartes } = await rapprocherToutes(profil, avps);
    const tous = [...retenus, ...ecartes];

    let mesurees = 0;

    for (const r of tous) {
      const attendu = classeAttendue(r.avpIntitule, etiquettes);
      if (!attendu) {
        nonEtiquetees += 1;
        continue;
      }

      const obtenu = classeObtenue(r);
      if (!obtenu) {
        nonEvaluables += 1;
        continue;
      }

      matrice[attendu][obtenu] += 1;
      mesurees += 1;

      if (csv) {
        lignesCsv.push(
          [
            `"${user.prenom} ${user.nom}"`,
            `"${(r.avpIntitule || "").replace(/"/g, "'")}"`,
            `"${r.avpDirection || ""}"`,
            attendu,
            obtenu,
            r.score ?? "",
            r.fiabilite ?? "",
            r.ecarte ? "oui" : "non",
            `"${(r.motifsExclusion || []).join(" ; ").replace(/"/g, "'")}"`,
          ].join(","),
        );
      }

      if (attendu !== obtenu) {
        desaccords.push({
          persona: `${user.prenom} ${user.nom}`,
          offre: r.avpIntitule,
          attendu,
          obtenu,
          score: r.score,
          fiabilite: r.fiabilite,
          motifs: r.motifsExclusion,
        });
      }
    }

    console.log(
      `👤 ${(user.prenom + " " + user.nom).padEnd(20)} ${mesurees.toString().padStart(3)} offres mesurées — ${etiquettes.role}`,
    );
  }

  // ── Matrice de confusion ────────────────────────────────────────────
  console.log("\n═══ MATRICE DE CONFUSION ═══\n");
  console.log(
    "attendu \\ obtenu".padEnd(18) +
      CLASSES.map((c) => LIBELLES[c].padStart(12)).join(""),
  );

  for (const a of CLASSES) {
    console.log(
      LIBELLES[a].padEnd(18) +
        CLASSES.map((o) => String(matrice[a][o]).padStart(12)).join(""),
    );
  }

  // ── Précision et rappel, par classe ─────────────────────────────────
  console.log("\n═══ PRÉCISION ET RAPPEL ═══\n");
  console.log(
    "classe".padEnd(14) +
      "précision".padStart(12) +
      "rappel".padStart(10) +
      "attendus".padStart(11) +
      "prédits".padStart(10),
  );

  let totalJustes = 0;
  let total = 0;

  for (const c of CLASSES) {
    const vraisPositifs = matrice[c][c];
    const predits = CLASSES.reduce((t, a) => t + matrice[a][c], 0);
    const attendus = CLASSES.reduce((t, o) => t + matrice[c][o], 0);

    totalJustes += vraisPositifs;
    total += attendus;

    console.log(
      LIBELLES[c].padEnd(14) +
        pct(vraisPositifs, predits).padStart(12) +
        pct(vraisPositifs, attendus).padStart(10) +
        String(attendus).padStart(11) +
        String(predits).padStart(10),
    );
  }

  console.log(`\nExactitude globale : ${pct(totalJustes, total)} (${totalJustes}/${total})`);

  // ── LE chiffre qui compte ───────────────────────────────────────────
  //
  // Un faux positif, ici, c'est un poste hors sujet présenté comme pertinent.
  // C'est l'erreur que le règlement sanctionne le plus, et la seule qui fasse
  // perdre sa confiance à un candidat : on l'isole plutôt que de la noyer dans
  // une exactitude moyenne.
  const fauxPositifs = matrice.horsSujet.pertinent;
  const totalHorsSujet = CLASSES.reduce((t, o) => t + matrice.horsSujet[o], 0);

  console.log(
    `\n🎯 Faux positifs (hors sujet présentés comme pertinents) : ${fauxPositifs} sur ${totalHorsSujet} — ${pct(fauxPositifs, totalHorsSujet)}`,
  );

  const fauxNegatifs = matrice.pertinent.horsSujet;
  const totalPertinents = CLASSES.reduce((t, o) => t + matrice.pertinent[o], 0);
  console.log(
    `   Faux négatifs (pertinents écartés)                    : ${fauxNegatifs} sur ${totalPertinents} — ${pct(fauxNegatifs, totalPertinents)}`,
  );

  console.log(
    `\nℹ️  ${nonEvaluables} paire(s) non évaluables (offre sans attendus publiés), ${nonEtiquetees} hors étiquetage.`,
  );

  // ── Désaccords ──────────────────────────────────────────────────────
  if (desaccords.length > 0) {
    console.log(`\n═══ ${desaccords.length} DÉSACCORDS ═══`);
    const aMontrer = detaille ? desaccords : desaccords.slice(0, 12);

    for (const d of aMontrer) {
      console.log(
        `\n  ${d.persona} · « ${d.offre} »` +
          `\n    attendu ${LIBELLES[d.attendu]}, obtenu ${LIBELLES[d.obtenu]}` +
          (d.score !== null && d.score !== undefined
            ? ` (score ${d.score}/100 sur ${d.fiabilite} pts)`
            : "") +
          (d.motifs?.length ? `\n    motif : ${d.motifs.join(" ; ")}` : ""),
      );
    }

    if (!detaille && desaccords.length > aMontrer.length) {
      console.log(
        `\n  … et ${desaccords.length - aMontrer.length} autres. Relancez avec --detail.`,
      );
    }
  }

  if (csv) {
    const fichier = path.join(path.resolve(), "evaluation.csv");
    fs.writeFileSync(fichier, lignesCsv.join("\n"), "utf8");
    console.log(`\n📄 Matrice complète : ${fichier} (${lignesCsv.length - 1} lignes)`);
  }

  console.log("");
};

run()
  .catch((e) => {
    console.error(`❌ ${e.message}`);
    process.exitCode = 1;
  })
  .finally(() => mongoose.connection.close());
