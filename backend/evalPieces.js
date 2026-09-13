// backend/evalPieces.js
//
// Évaluation de la QUALITÉ DES PIÈCES produites.
//
//   npm run eval:pieces                    → 3 personas × 2 offres, lettres
//   npm run eval:pieces -- --personas 8    → élargir l'échantillon
//   npm run eval:pieces -- --offres 3
//   npm run eval:pieces -- --cv            → mesurer aussi les CV
//   npm run eval:pieces -- --texte         → afficher les lettres produites
//
// ══════════════════════════════════════════════════════════════════════════
//  POURQUOI CE SECOND BANC DE MESURE
// ══════════════════════════════════════════════════════════════════════════
// `npm run eval` mesure le RAPPROCHEMENT. Or le jury du hackathon dépouille
// **CV et lettre à l'aveugle**, comme un recruteur : 25 des 100 points se
// jouent là, sur des documents lus hors de tout contexte technique. C'est le
// plus gros bloc du barème, et le seul qu'aucune matrice de confusion
// n'éclaire.
//
// ══════════════════════════════════════════════════════════════════════════
//  CE QUI EST MESURÉ SANS MODÈLE DE LANGUE — ET C'EST L'ESSENTIEL
// ══════════════════════════════════════════════════════════════════════════
// Les contraintes produit sont ÉCRITES dans les prompts : 250-300 mots,
// vocabulaire interdit, première phrase sur le poste. Écrire une contrainte
// dans un prompt n'est pas la faire respecter — un modèle l'oublie, surtout en
// fin de texte.
//
// Ce script les vérifie donc SUR LA SORTIE, de façon déterministe, à partir
// des mêmes tableaux que ceux qui construisent le prompt
// (`VOCABULAIRE_INTERDIT`, `OUVERTURES_INTERDITES`, `LETTRE_MOTS`). Une
// seconde copie des listes ici aurait divergé du prompt au premier ajout, et
// la mesure aurait validé une contrainte qui n'est plus demandée.
//
// La note de la passe de critique est relevée en plus, mais elle est
// secondaire : c'est un modèle qui juge un modèle. Les chiffres opposables
// sont les déterministes.
//
// ⚠️ Ce script APPELLE LE MODÈLE, donc il coûte et il prend du temps. Les
// valeurs par défaut sont volontairement petites ; on élargit quand on veut un
// chiffre publiable.

import "./loadEnv.js";
import mongoose from "mongoose";
import connectDB from "./config/db.js";
import Profil from "./models/ProfilModel.js";
import User from "./models/UserModel.js";
import Avp from "./models/AvpModel.js";
import { rapprocher } from "./services/matchingService.js";
import {
  GENERATEURS,
  VOCABULAIRE_INTERDIT,
  OUVERTURES_INTERDITES,
  LETTRE_MOTS,
  // Les contrôles vivent dans le service, pas ici : ils y servent AUSSI à
  // faire taire un reproche du critique démontrablement faux. Deux copies
  // auraient fini par rendre deux verdicts opposés sur la même lettre.
  corpsDeLettre,
  compterMots,
  premierePhrase,
  ouvreSurLePoste,
  inventionCredible,
} from "./services/redactionService.js";
import { premiereAccroche } from "./services/envoiService.js";
import { reordonner } from "./services/cvPdfService.js";
import { iaDisponible } from "./services/modeleService.js";

const arg = (nom, defaut) => {
  const i = process.argv.indexOf(`--${nom}`);
  if (i === -1) return defaut;
  const v = process.argv[i + 1];
  return v && !v.startsWith("--") ? Number(v) : true;
};

const OPTIONS = {
  personas: Number(arg("personas", 3)),
  offres: Number(arg("offres", 2)),
  cv: process.argv.includes("--cv"),
  texte: process.argv.includes("--texte"),
};

const normaliser = (t) =>
  (t || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

// ── Les contrôles déterministes ───────────────────────────────────────────

const controlerLettre = (texte) => {
  const corps = corpsDeLettre(texte);
  const mots = compterMots(corps);
  const p1 = premierePhrase(corps);
  const plat = normaliser(texte);

  const vocabulaire = VOCABULAIRE_INTERDIT.filter((t) =>
    plat.includes(normaliser(t)),
  );
  const ouvertures = OUVERTURES_INTERDITES.filter((t) =>
    normaliser(p1).startsWith(normaliser(t)),
  );

  return {
    mots,
    longueurOk: mots >= LETTRE_MOTS.min && mots <= LETTRE_MOTS.max,
    dansLaCible: mots >= LETTRE_MOTS.cible[0] && mots <= LETTRE_MOTS.cible[1],
    vocabulaire,
    ouvertures,
    ouvreSurLeCandidat: !ouvreSurLePoste(texte),
    // Un objet est attendu : c'est ce qu'un service RH lit en premier pour
    // classer le courrier.
    objet: /^\s*objet\s*:/im.test(texte || ""),
    premierePhrase: p1.slice(0, 120),
  };
};

// ── Contrôle du CV ────────────────────────────────────────────────────────
//
// ══════════════════════════════════════════════════════════════════════════
//  LE CV EMPLOYEUR EST RENDU DEPUIS LE PROFIL, PAS DEPUIS UN TEXTE DE MODÈLE
// ══════════════════════════════════════════════════════════════════════════
// `cvPdf()` compose expériences, formations et compétences à partir du
// document `Profil`. L'invention y est donc structurellement impossible : on
// ne peut pas écrire sur ce CV un employeur qui n'est pas en base.
//
// UNE seule exception, et c'est elle qu'on mesure : **l'accroche**. Elle est
// extraite du texte produit par le modèle (`premiereAccroche`) et posée en
// tête du CV. C'est le seul endroit du document où une phrase inventée peut
// atteindre l'employeur.
// L'extrait est-il couvert par ce texte de référence ? Même principe que
// `inventionCredible`, appliqué à l'offre.
const contientLesMots = (extrait, reference) => {
  const ref = normaliser(reference);
  const mots = normaliser(extrait)
    .split(/\s+/)
    .filter((m) => m.length > 4);
  if (mots.length === 0) return false;
  return mots.filter((m) => ref.includes(m)).length / mots.length >= 0.3;
};

const controlerCv = (contenu, profil, user, avp) => {
  const accroche = premiereAccroche(contenu) || "";

  const plat = normaliser(contenu);
  const vocabulaire = VOCABULAIRE_INTERDIT.filter((t) =>
    plat.includes(normaliser(t)),
  );

  return {
    accroche: accroche.slice(0, 140),
    // `inventionCredible` renvoie `true` quand l'extrait N'EST PAS traçable au
    // profil — c'est-à-dire quand il y a lieu de s'inquiéter.
    // ⚠️ Comparée au profil ET À L'OFFRE. Une accroche de CV NOMME le poste
    // visé — c'est même tout son intérêt : « recentrée sur le poste ». La
    // confronter au seul profil faisait passer « le poste d'assistant
    // administratif à la Direction du travail » pour une invention, alors que
    // ces mots viennent de l'annonce.
    accrocheTracable: accroche
      ? !inventionCredible(accroche, profil, user) ||
        contientLesMots(accroche, `${avp.intitule} ${avp.direction || ""} ${avp.service || ""}`)
      : null,
    vocabulaire,
  };
};

// ── Le banc ───────────────────────────────────────────────────────────────

const pourcent = (n, total) => (total ? Math.round((100 * n) / total) : 0);

const barre = (n, total, largeur = 24) => {
  const plein = total ? Math.round((n / total) * largeur) : 0;
  return "█".repeat(plein) + "·".repeat(largeur - plein);
};

const lancer = async () => {
  if (!iaDisponible()) {
    console.error(
      "\n⚠️  OPENAI_API_KEY absente : les pièces seraient des brouillons assemblés,\n" +
        "    et les mesurer ne dirait rien de la qualité rédactionnelle.\n",
    );
    process.exit(1);
  }

  await connectDB();

  const profils = await Profil.find({ visibleRecruteurs: true })
    .limit(OPTIONS.personas)
    .lean();

  if (profils.length === 0) {
    console.error("Aucun profil de démonstration. Lancez `npm run data:comptes-test`.");
    process.exit(1);
  }

  const avps = await Avp.find({ dateLimite: { $gte: new Date() } });

  console.log(
    `\n═══ QUALITÉ DES PIÈCES ═══\n` +
      `${profils.length} persona(s) × ${OPTIONS.offres} offre(s)` +
      `${OPTIONS.cv ? " · lettres et CV" : " · lettres"}\n`,
  );

  const resultats = [];

  for (const profil of profils) {
    const user = await User.findById(profil.user).lean();

    // On mesure sur les MEILLEURS rapprochements de chaque persona, pas sur des
    // offres tirées au sort : c'est la situation réelle d'usage. Une lettre
    // pour un poste hors de portée serait mauvaise pour une raison qui ne
    // regarde pas la rédaction.
    const notes = [];
    for (const a of avps) {
      const r = await rapprocher(profil, a);
      if (r.fiable && !r.motifsExclusion?.length) notes.push({ a, r });
    }
    notes.sort((x, y) => y.r.score - x.r.score);

    const retenues = notes.slice(0, OPTIONS.offres);
    const nom = `${user?.prenom || ""} ${user?.nom || ""}`.trim();

    for (const { a, r } of retenues) {
      const pieces = OPTIONS.cv ? ["lettre", "cv"] : ["lettre"];

      for (const piece of pieces) {
        process.stdout.write(`  ${nom} → ${a.intitule.slice(0, 46)}… [${piece}] `);

        try {
          const { contenu, critique } = await GENERATEURS[piece](
            profil,
            a,
            user,
            r,
          );

          const controle =
            piece === "lettre"
              ? controlerLettre(contenu)
              : piece === "cv"
                ? controlerCv(contenu, profil, user, a)
                : null;

          // La MATIÈRE disponible pour écrire : le nombre de correspondances
          // que le rapprochement a trouvées. C'est ce que la lettre a le droit
          // de citer — tout le reste serait du remplissage, que les consignes
          // interdisent.
          const preuves = (r.composantes || []).reduce(
            (t, c) => t + (c.evidences?.length || 0),
            0,
          );

          resultats.push({
            nom, offre: a.intitule, piece, critique, controle, contenu,
            preuves, score: r.score,
          });

          console.log(
            piece === "lettre"
              ? `${controle.mots} mots · ${controle.vocabulaire.length + controle.ouvertures.length + (controle.ouvreSurLeCandidat ? 1 : 0)} écart(s) · note ${critique?.note ?? "—"}/10`
              : `note ${critique?.note ?? "—"}/10`,
          );
        } catch (e) {
          console.log(`ÉCHEC — ${e.message}`);
          resultats.push({ nom, offre: a.intitule, piece, erreur: e.message });
        }
      }
    }
  }

  // ── Rapport ─────────────────────────────────────────────────────────
  const lettres = resultats.filter((x) => x.piece === "lettre" && x.controle);
  const n = lettres.length;

  if (n === 0) {
    console.log("\nAucune lettre produite.");
    await mongoose.disconnect();
    return;
  }

  console.log(`\n═══ CONFORMITÉ AUX CONTRAINTES PRODUIT ═══`);
  console.log(`(vérifiée sur la sortie, sans modèle de langue — ${n} lettres)\n`);

  const controles = [
    ["Longueur dans les bornes", lettres.filter((x) => x.controle.longueurOk).length],
    [`Longueur dans la cible ${LETTRE_MOTS.cible.join("–")}`, lettres.filter((x) => x.controle.dansLaCible).length],
    ["Objet présent", lettres.filter((x) => x.controle.objet).length],
    ["Aucun mot interdit", lettres.filter((x) => x.controle.vocabulaire.length === 0).length],
    ["Aucune ouverture interdite", lettres.filter((x) => x.controle.ouvertures.length === 0).length],
    ["1re phrase sur le POSTE", lettres.filter((x) => !x.controle.ouvreSurLeCandidat).length],
  ];

  for (const [libelle, ok] of controles) {
    console.log(
      `  ${barre(ok, n)}  ${String(pourcent(ok, n)).padStart(3)} %  ${libelle}  (${ok}/${n})`,
    );
  }

  // Les mots interdits réellement rencontrés : c'est ce qui dit quoi corriger
  // dans le prompt, plutôt qu'un taux global.
  const fautifs = new Map();
  for (const l of lettres) {
    for (const m of l.controle.vocabulaire) fautifs.set(m, (fautifs.get(m) || 0) + 1);
  }
  if (fautifs.size) {
    console.log(`\n  Mots interdits rencontrés :`);
    [...fautifs.entries()]
      .sort((a, b) => b[1] - a[1])
      .forEach(([m, c]) => console.log(`    ${String(c).padStart(3)} × « ${m} »`));
  }

  const surCandidat = lettres.filter((x) => x.controle.ouvreSurLeCandidat);
  if (surCandidat.length) {
    console.log(`\n  Lettres ouvrant sur le candidat :`);
    surCandidat.slice(0, 5).forEach((l) =>
      console.log(`    « ${l.controle.premierePhrase} »`),
    );
  }

  // ── Longueur ────────────────────────────────────────────────────────
  const longueurs = lettres.map((x) => x.controle.mots).sort((a, b) => a - b);
  const mediane = longueurs[Math.floor(longueurs.length / 2)];
  console.log(
    `\n  Longueur : ${longueurs[0]} – ${longueurs[longueurs.length - 1]} mots, médiane ${mediane}`,
  );

  // ── Longueur et matière disponible ──────────────────────────────────
  //
  // ══════════════════════════════════════════════════════════════════════
  //  UNE LETTRE COURTE EST-ELLE UN DÉFAUT DE RÉDACTION, OU UN MANQUE DE
  //  MATIÈRE ?
  // ══════════════════════════════════════════════════════════════════════
  // La question n'est pas rhétorique. Si la longueur suit le nombre de
  // correspondances trouvées, alors les lettres courtes sont HONNÊTES : il n'y
  // avait pas de quoi en écrire davantage, et allonger reviendrait à remplir —
  // ce que les consignes interdisent explicitement.
  // Si elle n'y est pas corrélée, c'est un défaut de rédaction, et il se
  // corrige dans le prompt.
  const paires = lettres
    .filter((x) => typeof x.preuves === "number")
    .map((x) => [x.preuves, x.controle.mots]);

  // ⚠️ Six paires au minimum. Un coefficient de corrélation calculé sur trois
  // points est du bruit : il atteint ±0,9 par accident, et on en tirerait une
  // conclusion sur la conduite du modèle.
  if (paires.length >= 6) {
    const moy = (v) => v.reduce((a, b) => a + b, 0) / v.length;
    const xs = paires.map((p) => p[0]);
    const ys = paires.map((p) => p[1]);
    const mx = moy(xs), my = moy(ys);
    const cov = paires.reduce((t, [x, y]) => t + (x - mx) * (y - my), 0);
    const sx = Math.sqrt(xs.reduce((t, x) => t + (x - mx) ** 2, 0));
    const sy = Math.sqrt(ys.reduce((t, y) => t + (y - my) ** 2, 0));
    const r = sx && sy ? cov / (sx * sy) : 0;

    console.log(`
═══ LONGUEUR ET MATIÈRE DISPONIBLE ═══
`);
    console.log(`  preuves → mots`);
    paires
      .sort((a, b) => a[0] - b[0])
      .forEach(([p, m]) => console.log(`    ${String(p).padStart(2)} preuve(s)  ${String(m).padStart(4)} mots`));
    // ⚠️ Le SIGNE compte autant que la force. Une première version testait
    // `Math.abs(r)` : une corrélation NÉGATIVE — plus de correspondances, des
    // lettres plus courtes, soit exactement l'anomalie qu'on cherche — était
    // alors annoncée comme « la longueur suit la matière ». Un indicateur qui
    // félicite le défaut qu'il doit détecter est pire que pas d'indicateur.
    const lecture =
      r <= -0.3
        ? "→ ANOMALIE : plus il y a de matière, PLUS COURTE est la lettre."
        : r >= 0.6
          ? "→ la longueur SUIT la matière : les lettres courtes sont honnêtes."
          : r >= 0.3
            ? "→ lien faible : la matière explique une partie seulement."
            : "→ AUCUN lien : la brièveté est un défaut de rédaction, pas un manque de matière.";

    console.log(`
  Corrélation : r = ${r.toFixed(2)}  ${lecture}`);
    console.log(`  (sur ${paires.length} lettres)`);
  }

  // ── La passe de critique ────────────────────────────────────────────
  const notes = resultats.filter((x) => x.critique?.note).map((x) => x.critique.note);
  if (notes.length) {
    const moy = notes.reduce((a, b) => a + b, 0) / notes.length;
    const reecrites = resultats.filter((x) => x.critique?.reecrite).length;
    const inventions = resultats.filter((x) => x.critique?.inventions?.length).length;

    console.log(`\n═══ PASSE DE CRITIQUE ═══`);
    console.log(`  Note moyenne  : ${moy.toFixed(1)}/10  (${notes.length} pièces)`);
    console.log(`  Réécrites     : ${reecrites}`);
    console.log(
      `  🔴 Inventions signalées : ${inventions}` +
        (inventions === 0
          ? "  — aucune information absente du profil"
          : "  ⚠️  À INSPECTER : une invention dans une lettre est signée par le candidat"),
    );

    // 🔴 Les inventions, en toutes lettres. Un taux ne sert à rien ici : il
    // faut LIRE ce qui a été signalé pour trancher entre une vraie invention
    // (grave) et un faux positif de la passe de critique (à corriger dans le
    // prompt du critique). Les afficher est le seul moyen d'instruire.
    const signalees = resultats.filter((x) => x.critique?.inventions?.length);
    if (signalees.length) {
      console.log(`
  🔴 Inventions signalées, à trancher une par une :`);
      for (const r of signalees) {
        console.log(`
    ${r.nom} → ${r.offre.slice(0, 50)}`);
        for (const inv of r.critique.inventions) console.log(`      • ${inv}`);
      }
    }

    // Les reproches récurrents : c'est là qu'on voit ce qui est
    // SYSTÉMATIQUEMENT faible, par opposition à un mauvais tirage.
    const reproches = new Map();
    for (const r of resultats) {
      for (const p of r.critique?.problemes || []) {
        const cle = p.toLowerCase().slice(0, 60);
        reproches.set(cle, (reproches.get(cle) || 0) + 1);
      }
    }
    const recurrents = [...reproches.entries()].filter(([, c]) => c > 1);
    if (recurrents.length) {
      console.log(`\n  Reproches récurrents :`);
      recurrents
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .forEach(([p, c]) => console.log(`    ${c} × ${p}…`));
    }
  }

  // ── Le CV ───────────────────────────────────────────────────────────
  const cvs = resultats.filter((x) => x.piece === "cv" && x.controle);

  if (cvs.length) {
    console.log(`
═══ LE CV ═══
`);

    // L'invariant structurel, éprouvé sans modèle ni base : quel que soit
    // l'ordre proposé, aucune expérience ne disparaît du CV.
    const L = ["a", "b", "c", "d"];
    const ordres = [[3, 0, 2, 1], [0, 1, 2, 3], null, [1, 0], [0, 0, 2, 3], [0, 1, 2, 9], [-1, 1, 2, 3]];
    const intacts = ordres.filter((o) => {
      const r = reordonner(L, o);
      return r.length === L.length && L.every((x) => r.includes(x));
    }).length;
    console.log(
      `  ${barre(intacts, ordres.length)}  ${pourcent(intacts, ordres.length)} %  ` +
        `Aucune expérience perdue au réordonnancement  (${intacts}/${ordres.length} ordres, dont ${ordres.length - 3} fautifs)`,
    );

    const tracables = cvs.filter((x) => x.controle.accrocheTracable).length;
    const propres = cvs.filter((x) => x.controle.vocabulaire.length === 0).length;
    console.log(
      `  ${barre(tracables, cvs.length)}  ${pourcent(tracables, cvs.length)} %  Accroche traçable au profil  (${tracables}/${cvs.length})`,
    );
    console.log(
      `  ${barre(propres, cvs.length)}  ${pourcent(propres, cvs.length)} %  Aucun mot interdit  (${propres}/${cvs.length})`,
    );

    const douteuses = cvs.filter((x) => x.controle.accrocheTracable === false);
    if (douteuses.length) {
      console.log(`
  🔴 Accroches non traçables au profil :`);
      douteuses.forEach((x) => console.log(`    « ${x.controle.accroche} »`));
    }

    console.log(
      `
  Rappel : le reste du CV (expériences, formations, compétences) est
` +
        `  composé depuis le profil en base, jamais depuis un texte de modèle.
` +
        `  L'accroche est la seule surface mesurée ici.`,
    );
  }

  if (OPTIONS.texte) {
    console.log(`\n═══ LES LETTRES ═══`);
    for (const l of lettres) {
      console.log(`\n───── ${l.nom} → ${l.offre} ─────\n${l.contenu}`);
    }
  }

  console.log(
    `\n⚠️  Les pourcentages ci-dessus sont DÉTERMINISTES et rejouables.\n` +
      `    La note de critique est un modèle qui juge un modèle : à lire comme\n` +
      `    une tendance, jamais comme une preuve.\n`,
  );

  await mongoose.disconnect();
};

lancer().catch(async (e) => {
  console.error(`\n❌ ${e.message}`);
  await mongoose.disconnect();
  process.exit(1);
});
