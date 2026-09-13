// backend/services/envoiService.js
//
// Fonction ④ : la candidature SORT du système.
//
// Trois sorties, et la distinction entre elles est le cœur du sujet :
//
//   dossierZip()   — les QUATRE pièces + le profil en JSON Resume. Pour le
//                    candidat. C'est son dossier, il l'emporte.
//   envoyerDossier() — la lettre et le CV, en PDF, par email. Pour l'employeur.
//                    RIEN d'autre : ni l'analyse, ni la préparation d'entretien,
//                    ni la moindre mention de la façon dont les pièces ont été
//                    produites. Le règlement est explicite là-dessus.
//
// ══════════════════════════════════════════════════════════════════════════
//  🔴 DEUX MODES D'ENVOI — LIRE AVANT DE TOUCHER À CE FICHIER
// ══════════════════════════════════════════════════════════════════════════
// Les fiches de poste contiennent de VRAIES adresses de recrutement :
// `DRH-candidature@opt.nc` dans le dataset de l'OPT-NC,
// `drhfpnc.recrutement@gouv.nc` et des adresses nominatives d'agents dans
// celui de data.gouv.nc.
//
//   MODE « test » (défaut) — tout part à `CANDIDATURE_EMAIL_TEST`, et seulement
//     là. L'adresse de l'offre n'est même pas lue. Les domaines des employeurs
//     publics sont refusés, y compris si on les met dans la variable.
//
//   MODE « production » — la candidature part chez le VRAI recruteur désigné
//     par l'offre. C'est la finalité du service : un candidat réel doit pouvoir
//     postuler pour de bon.
//
// Le passage en production demande DEUX clés indépendantes, qui ne sont pas
// entre les mêmes mains :
//
//   1. `ENVOI_PRODUCTION_AUTORISE=true` dans l'environnement du serveur — un
//      geste d'exploitant, qui suppose un accès à la machine.
//   2. Le basculement explicite depuis l'administration, tracé et réversible.
//
// Aucune ne suffit seule. Une démonstration, une copie de la base ou un
// déploiement de test ne peuvent donc pas écrire à un vrai recruteur par
// accident — c'est l'incident qui ferait perdre son temps à un agent et qui,
// pendant le hackathon, disqualifierait le projet : le règlement interdit les
// candidatures de test sans intention réelle.
//
// ⚠️ Pendant toute la durée du concours, le mode doit rester « test ».
// ══════════════════════════════════════════════════════════════════════════

// ⚠️ archiver 8 n'exporte plus de fabrique par défaut : `import archiver from
// "archiver"` échoue au démarrage avec « does not provide an export named
// default ». La classe par format est le point d'entrée désormais.
import { ZipArchive } from "archiver";
import { piecePdf, nomFichier } from "./pdfService.js";
import { versJsonResume } from "./jsonResumeService.js";
import { smtpConfigure } from "./smtpService.js";
import { lireParametre } from "../models/ParametreModel.js";
import sendEmail from "../utils/sendEmail.js";

export const CLE_MODE = "envoi.mode";

const PIECES_EMPLOYEUR = ["lettre", "cv"];
const PIECES_CANDIDAT = ["restitution", "preparation"];
const TOUTES = [...PIECES_EMPLOYEUR, ...PIECES_CANDIDAT];

// Domaines des employeurs publics calédoniens. Aucune candidature produite ici
// ne doit pouvoir les atteindre, quelle que soit la configuration.
const DOMAINES_INTERDITS = ["opt.nc", "gouv.nc", "drhfpnc.nc"];

const domaine = (adresse) =>
  String(adresse || "")
    .trim()
    .toLowerCase()
    .split("@")[1] || "";

const estInterdit = (adresse) => {
  const d = domaine(adresse);
  return DOMAINES_INTERDITS.some((i) => d === i || d.endsWith("." + i));
};

/** Le mode courant, tel que posé depuis l'administration. */
export const modeEnvoi = async () => {
  const mode = await lireParametre(CLE_MODE, "test");
  // Toute valeur inattendue retombe sur « test ». Un réglage corrompu ou une
  // migration ratée ne doivent jamais ouvrir la production.
  return mode === "production" ? "production" : "test";
};

/** L'exploitant a-t-il autorisé la production sur ce serveur ? */
export const productionAutorisee = () =>
  String(process.env.ENVOI_PRODUCTION_AUTORISE).toLowerCase() === "true";

// Destinataire réel d'une offre, lu dans le document source.
//
// C'est le SEUL endroit de l'application qui lit `applicationContact`, et il
// n'est atteint qu'en mode production. Aucune vue ne l'expose (voir
// avpController), pour qu'aucun écran ni aucun futur module ne puisse le
// reprendre par mégarde.
const contactDeLOffre = (avp) => {
  const contact = avp?.raw?.applicationContact;
  const adresse = typeof contact?.email === "string" ? contact.email.trim() : "";
  return adresse || null;
};

/**
 * Détermine le destinataire, ou explique pourquoi il n'y en a pas.
 *
 * Exporté et interrogé par l'interface : la destination est annoncée AVANT le
 * clic. Un envoi qui échoue après coup passe pour une panne, alors qu'il
 * manque souvent une simple configuration.
 */
export const destinataireAutorise = async (avp = null) => {
  const mode = await modeEnvoi();

  // ── Mode production ────────────────────────────────────────────────────
  if (mode === "production") {
    if (!productionAutorisee()) {
      return {
        ok: false,
        mode,
        adresse: null,
        motif:
          "Le mode production est activé en base mais PAS autorisé sur ce serveur " +
          "(ENVOI_PRODUCTION_AUTORISE). Aucun envoi ne part tant que les deux ne " +
          "concordent pas — c'est ce qui empêche une copie de la base d'écrire à de " +
          "vrais recruteurs.",
      };
    }

    const adresse = contactDeLOffre(avp);

    if (!adresse) {
      // Surtout pas de repli sur l'adresse de test : le candidat croirait
      // avoir postulé. Mieux vaut refuser et le dire.
      return {
        ok: false,
        mode,
        adresse: null,
        motif:
          "Cette offre ne précise aucune adresse de candidature. Transmettez votre " +
          "dossier par le canal indiqué sur la fiche de poste : téléchargez l'archive " +
          "ci-dessus, elle contient vos pièces prêtes à envoyer.",
      };
    }

    return { ok: true, mode, adresse, motif: null, reel: true };
  }

  // ── Mode test ──────────────────────────────────────────────────────────
  const adresse = process.env.CANDIDATURE_EMAIL_TEST?.trim();

  if (!adresse) {
    return {
      ok: false,
      mode,
      adresse: null,
      motif:
        "Aucune adresse de test configurée (CANDIDATURE_EMAIL_TEST). " +
        "L'envoi est volontairement impossible tant qu'elle est vide : sans elle, " +
        "il n'existe aucune destination sûre pour une candidature de démonstration.",
    };
  }

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adresse)) {
    return {
      ok: false,
      mode,
      adresse: null,
      motif: `CANDIDATURE_EMAIL_TEST (« ${adresse} ») n'est pas une adresse email valide.`,
    };
  }

  if (estInterdit(adresse)) {
    return {
      ok: false,
      mode,
      adresse: null,
      motif:
        `Envoi refusé : « ${adresse} » relève d'un employeur public calédonien ` +
        `(${DOMAINES_INTERDITS.join(", ")}). Ce sont de vraies adresses de recrutement — ` +
        "une candidature de test ne doit jamais y parvenir. Utilisez une adresse qui " +
        "vous appartient, ou passez en mode production si la candidature est réelle.",
    };
  }

  return { ok: true, mode, adresse, motif: null, reel: false };
};

/** État de la chaîne d'envoi, pour l'interface et l'écran d'administration. */
export const etatEnvoi = async (avp = null) => {
  const destinataire = await destinataireAutorise(avp);

  return {
    mode: destinataire.mode,
    productionAutorisee: productionAutorisee(),
    possible: destinataire.ok,
    // Sans SMTP, l'envoi n'échoue pas : il est SIMULÉ et tracé dans la console.
    // Toute la chaîne ④ reste donc démontrable sans serveur de messagerie.
    simule: !smtpConfigure(),
    destinataire: destinataire.adresse,
    // `reel` dit si l'adresse est celle d'un vrai recruteur. L'interface DOIT
    // s'en servir pour changer de ton : on ne confirme pas de la même façon un
    // envoi de test et une candidature qui part pour de bon.
    reel: Boolean(destinataire.reel),
    motif: destinataire.motif,
    domainesInterdits: DOMAINES_INTERDITS,
  };
};

// Produit les PDF demandés. Les pièces vides sont ignorées plutôt que rendues
// en pages blanches : un dossier à trois pièces se voit, une page blanche se
// découvre chez l'employeur.
const rendre = async (candidature, avp, user, profil, pieces) => {
  const fichiers = [];

  for (const piece of pieces) {
    const contenu = candidature.pieces?.[piece]?.contenu;
    if (!contenu?.trim()) continue;

    fichiers.push({
      piece,
      nom: nomFichier(piece, user, avp.slug),
      // La date de génération de la pièce, pas l'heure courante : le PDF d'une
      // pièce inchangée est ainsi identique d'un appel à l'autre.
      date:
        candidature.pieces[piece].modifieLe ||
        candidature.pieces[piece].genereLe ||
        candidature.updatedAt,
      donnees: await piecePdf({
        piece,
        texte: contenu,
        avp,
        user,
        profil,
        date:
          candidature.pieces[piece].modifieLe ||
          candidature.pieces[piece].genereLe ||
          candidature.updatedAt,
      }),
    });
  }

  return fichiers;
};

export const piecesManquantes = (candidature, pieces = PIECES_EMPLOYEUR) =>
  pieces.filter((p) => !candidature.pieces?.[p]?.contenu?.trim());

/** PDF d'une pièce isolée (téléchargement unitaire). */
export const piecePdfSeule = async (candidature, avp, user, profil, piece) => {
  const [fichier] = await rendre(candidature, avp, user, profil, [piece]);
  return fichier || null;
};

// Note de dossier placée à la racine du ZIP.
//
// Elle dit à qui sert quoi. Sans elle, quelqu'un qui ouvre l'archive un mois
// plus tard ne sait plus laquelle des quatre pièces il a envoyée, ni laquelle
// il ne devait surtout pas envoyer.
const noteDeDossier = (candidature, avp, etat) =>
  [
    `DOSSIER DE CANDIDATURE — ${avp.intitule}`,
    avp.direction ? `Direction : ${avp.direction}` : null,
    `Référence de l'offre : ${avp.idAvp}`,
    `Dossier constitué le : ${new Date().toLocaleDateString("fr-FR")}`,
    "",
    "À TRANSMETTRE À L'EMPLOYEUR",
    "  - la lettre de candidature",
    "  - le CV recentré sur ce poste",
    "",
    "POUR VOUS, À NE PAS TRANSMETTRE",
    "  - l'analyse de votre candidature (vos points forts et vos écarts)",
    "  - la préparation à l'entretien",
    "",
    "profil.json contient votre profil au format JSON Resume (jsonresume.org).",
    "C'est un format ouvert : vous pouvez le réutiliser sur d'autres services,",
    "ou le réimporter ici plus tard. Ces données vous appartiennent.",
    "",
    etat.envoyeeLe
      ? `Candidature transmise le ${new Date(etat.envoyeeLe).toLocaleString("fr-FR")}.`
      : "Cette candidature n'a pas encore été transmise.",
    "",
    "⚠️ Relisez la lettre et le CV avant de les envoyer. Ces documents portent",
    "votre nom : c'est vous qui en répondez, pas l'outil qui les a préparés.",
  ]
    .filter((l) => l !== null)
    .join("\n");

/**
 * Constitue le dossier complet en archive ZIP : les quatre pièces en PDF, le
 * profil en JSON Resume, et une note qui dit quoi faire de chaque fichier.
 */
export const dossierZip = async (candidature, avp, user, profil) => {
  const fichiers = await rendre(candidature, avp, user, profil, TOUTES);

  const archive = new ZipArchive({ zlib: { level: 9 } });
  const morceaux = [];

  const fini = new Promise((resolve, reject) => {
    archive.on("data", (c) => morceaux.push(c));
    archive.on("end", () => resolve(Buffer.concat(morceaux)));
    archive.on("error", reject);
    // Un avertissement d'archivage (fichier introuvable, par exemple) doit
    // faire échouer le téléchargement : une archive amputée sans message est
    // pire qu'une erreur franche.
    archive.on("warning", reject);
  });

  // Les pièces employeur et candidat sont dans DEUX DOSSIERS distincts. La
  // séparation est physique, pas seulement documentaire : on ne joint pas par
  // erreur l'analyse de ses propres écarts à une candidature.
  for (const f of fichiers) {
    const dossier = PIECES_EMPLOYEUR.includes(f.piece)
      ? "1-a-transmettre"
      : "2-pour-vous";
    archive.append(f.donnees, { name: `${dossier}/${f.nom}`, date: f.date });
  }

  archive.append(
    JSON.stringify(versJsonResume(profil, user, avp), null, 2),
    { name: "profil.json", date: candidature.updatedAt },
  );

  archive.append(
    noteDeDossier(candidature, avp, { envoyeeLe: candidature.envoyeeLe }),
    { name: "LISEZ-MOI.txt", date: candidature.updatedAt },
  );

  archive.finalize();

  return {
    donnees: await fini,
    nom: `Candidature_${avp.slug}.zip`,
    pieces: fichiers.map((f) => f.piece),
  };
};

/**
 * Transmet la candidature par email : lettre et CV en pièces jointes, rien
 * d'autre.
 *
 * Renvoie toujours la trace de ce qui a été fait — y compris en mode simulé —
 * pour que la candidature en garde l'historique. Lève une erreur si le
 * destinataire n'est pas autorisé : on ne devine pas une adresse de repli.
 */
export const envoyerDossier = async (candidature, avp, user, profil) => {
  const destinataire = await destinataireAutorise(avp);

  if (!destinataire.ok) {
    const erreur = new Error(destinataire.motif);
    erreur.statusCode = 503;
    throw erreur;
  }

  const manquantes = piecesManquantes(candidature);
  if (manquantes.length > 0) {
    const erreur = new Error(
      `Impossible d'envoyer : ${manquantes.join(" et ")} — cette pièce n'a pas encore été produite.`,
    );
    erreur.statusCode = 400;
    throw erreur;
  }

  const fichiers = await rendre(
    candidature,
    avp,
    user,
    profil,
    PIECES_EMPLOYEUR,
  );

  // Second verrou, juste avant le départ, et volontairement redondant avec le
  // contrôle ci-dessus : le mode a pu changer entre les deux, et ce coût est
  // nul comparé à celui d'une candidature mal adressée.
  //
  // En mode production, l'adresse EST celle d'un employeur public — c'est
  // précisément ce qu'on veut. Le verrou ne s'applique donc qu'au mode test,
  // mais il exige alors que les deux clés soient bien présentes.
  if (destinataire.mode === "test" && estInterdit(destinataire.adresse)) {
    const erreur = new Error(
      "Envoi interrompu : en mode test, le destinataire ne peut pas être un employeur public réel.",
    );
    erreur.statusCode = 503;
    throw erreur;
  }

  if (destinataire.mode === "production" && !productionAutorisee()) {
    const erreur = new Error(
      "Envoi interrompu : le mode production n'est pas autorisé sur ce serveur.",
    );
    erreur.statusCode = 503;
    throw erreur;
  }

  const nom = `${user.prenom} ${user.nom}`.trim();
  const sujet = `Candidature — ${avp.intitule}${avp.idAvp ? ` (réf. ${avp.idAvp})` : ""}`;

  // ⚠️ Le corps du message ne mentionne NI l'outil, NI la façon dont les pièces
  // ont été produites : « l'employeur reçoit exclusivement CV et lettre, sans
  // connaissance du processus de génération ». Il est signé par le candidat.
  const texte = [
    "Madame, Monsieur,",
    "",
    `Je vous adresse ma candidature au poste de ${avp.intitule}${avp.direction ? ` au sein de ${avp.direction}` : ""}.`,
    "",
    "Vous trouverez ci-joint ma lettre de candidature et mon curriculum vitae.",
    "",
    "Je me tiens à votre disposition.",
    "",
    nom,
    user.email,
    profil?.basics?.telephone || "",
  ]
    .filter((l) => l !== "")
    .join("\n");

  const resultat = await sendEmail({
    email: destinataire.adresse,
    subject: sujet,
    text: texte,
    html: texte
      .split("\n")
      .map((l) => `<p>${l}</p>`)
      .join(""),
    replyTo: user.email,
    attachments: fichiers.map((f) => ({
      filename: f.nom,
      content: f.donnees,
      contentType: "application/pdf",
    })),
  });

  return {
    destinataire: destinataire.adresse,
    mode: destinataire.mode,
    reel: Boolean(destinataire.reel),
    pieces: fichiers.map((f) => f.piece),
    // `simule` distingue « parti pour de vrai » de « écrit dans la console ».
    // L'interface DOIT afficher la différence : croire avoir envoyé une
    // candidature qui n'est jamais partie est la pire issue possible.
    simule: Boolean(resultat?.simule),
    messageId: resultat?.messageId || null,
    envoyeLe: new Date(),
  };
};
