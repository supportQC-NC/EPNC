// backend/controllers/integrationController.js
//
// L'API machine : ce qu'un ATS, un portail partenaire ou un agent consomme.
//
// ══════════════════════════════════════════════════════════════════════════
//  DEUX STANDARDS, ZÉRO VOCABULAIRE MAISON
// ══════════════════════════════════════════════════════════════════════════
// Un intégrateur n'apprend AUCUN champ inventé ici. Il envoie un document
// `JSON Resume` — le format que son outil sait déjà produire — et reçoit des
// offres `schema.org/JobPosting`. C'est toute la thèse d'architecture du
// projet, rendue exécutable : si le cœur ne connaît que deux schémas normés,
// alors l'API publique ne peut en exposer aucun autre.
//
// ══════════════════════════════════════════════════════════════════════════
//  CE QUE CETTE API NE FAIT PAS
// ══════════════════════════════════════════════════════════════════════════
// Elle **ne crée pas de compte**, **n'enregistre pas le candidat soumis** et
// **n'envoie rien à un employeur**. Un ATS nous transmet un dossier qu'il
// détient déjà, pour obtenir une analyse ; il n'a pas mandat pour inscrire
// cette personne sur notre plateforme, ni pour candidater en son nom.
//
// Concrètement : le profil reçu vit le temps de la requête et n'est jamais
// écrit en base. C'est aussi ce qui rend l'endpoint sans effet de bord, donc
// rejouable et testable.

import asyncHandler from "../middleware/asyncHandler.js";
import Avp from "../models/AvpModel.js";
import { Metier } from "../models/MetierModel.js";
import { depuisJsonResume, versJsonResume } from "../services/jsonResumeService.js";
import { rapprocher } from "../services/matchingService.js";
import { GENERATEURS } from "../services/redactionService.js";
import { lettrePdf } from "../services/pdfService.js";
import { cvPdf } from "../services/cvPdfService.js";

// Plafond de résultats. Une intégration qui demande « tout » recevrait 188
// rapprochements avec leurs preuves — plusieurs mégaoctets de JSON pour une
// information que personne ne lit au-delà des vingt premières lignes.
const LIMITE_DEFAUT = 20;
const LIMITE_MAX = 100;

// Le profil reçu n'est pas un document Mongoose : il n'a donc pas la méthode
// `estOuverte()` que `filtresBloquants` interroge sur l'OFFRE. Les offres, elles,
// viennent bien de la base — rien à simuler de ce côté.

// Construit l'objet « utilisateur » attendu par les générateurs à partir de
// l'identité portée par le JSON Resume. Aucun compte n'est créé : c'est un
// porteur d'identité, le temps de la requête.
const utilisateurEphemere = (identite) => {
  const morceaux = (identite.nom || "").trim().split(/\s+/);
  return {
    prenom: morceaux[0] || "",
    nom: morceaux.slice(1).join(" ") || "",
    email: identite.email || "",
  };
};

// Lit et traduit le JSON Resume du corps de requête, en transformant toute
// erreur de conversion en 400 — c'est une faute de l'appelant, pas du serveur.
const lireResume = (req, res) => {
  const resume = req.body?.resume ?? req.body;

  try {
    return depuisJsonResume(resume);
  } catch (e) {
    res.status(400);
    throw e;
  }
};

// @desc    Confronter un candidat au catalogue des offres
// @route   POST /api/integration/rapprochement
// @access  Clé d'API — portée « rapprochement:calculer »
const rapprochement = asyncHandler(async (req, res) => {
  const { profil, identite, ignores, avertissements } = lireResume(req, res);

  const o = req.body?.options || {};
  const limite = Math.min(Number(o.limite) || LIMITE_DEFAUT, LIMITE_MAX);
  const scoreMinimal = Number.isFinite(Number(o.scoreMinimal))
    ? Number(o.scoreMinimal)
    : 0;

  const filtre = {};
  // Par défaut : seulement les offres ouvertes. Une intégration qui ne
  // précise rien veut des postes auxquels on peut encore postuler.
  if (o.inclureCloturees !== true) {
    filtre.$or = [{ dateLimite: null }, { dateLimite: { $gte: new Date() } }];
  }
  if (o.employeur) filtre["employeur.code"] = String(o.employeur);

  const offres = await Avp.find(filtre);

  // Index des métiers chargé UNE fois : `rapprocher` accepte une Map pour
  // éviter une requête par offre. Sur 188 offres, c'est 188 allers-retours
  // économisés.
  const metiers = new Map(
    (await Metier.find({}).lean()).map((m) => [m.code, m]),
  );

  const retenus = [];
  const ecartes = [];
  // Les offres que le moteur refuse de noter, faute de matière publiée par
  // l'employeur. Elles ne sont ni retenues ni écartées : elles sont
  // INÉVALUABLES, et le taire laisserait croire que le catalogue se réduit à
  // ce qu'on sait scorer.
  let nonEvaluables = 0;

  for (const avp of offres) {
    const r = await rapprocher(profil, avp, metiers);

    const entree = {
      offre: {
        reference: avp.idAvp,
        intitule: avp.intitule,
        employeur: avp.employeur?.nom || null,
        lieu: avp.lieu || null,
        dateLimite: avp.dateLimite,
        jobPosting: `/api/avps/${avp.slug}/jobposting`,
        slug: avp.slug,
      },
    };

    if (r.motifsExclusion?.length) {
      // 🔴 Les écartés sortent AVEC leur motif. Le règlement demande
      // d'expliquer les rejets, et c'est aussi ce qui distingue un moteur
      // d'un filtre : « permis C exigé, absent du profil » se vérifie et se
      // conteste ; une absence dans une liste, non.
      ecartes.push({ ...entree, motifs: r.motifsExclusion });
      continue;
    }

    if (!r.fiable) {
      nonEvaluables++;
      continue;
    }

    if (r.score < scoreMinimal) continue;

    retenus.push({
      ...entree,
      score: r.score,
      // La fiabilité est la part du barème réellement applicable. La publier
      // n'est pas un détail de tuyauterie : un score de 70 calculé sur 40
      // points de barème ne vaut pas un 70 calculé sur 100, et un intégrateur
      // qui l'ignore présentera les deux côte à côte.
      fiabilite: r.fiabilite,
      verdict: r.verdict,
      composantes: (r.composantes || []).map((c) => ({
        cle: c.cle,
        libelle: c.libelle,
        points: c.points,
        maximum: c.maximum,
        applicable: c.applicable,
        note: c.note,
        // Les preuves : chaque point renvoie à un attendu de l'offre et à
        // l'élément du parcours qui le couvre.
        evidences: c.evidences || [],
        manques: c.manques || [],
      })),
    });
  }

  retenus.sort((a, b) => b.score - a.score);

  res.json({
    candidat: {
      nom: identite.nom || null,
      intitule: profil.basics.titre || null,
    },
    corpus: {
      offresExaminees: offres.length,
      retenues: retenus.length,
      ecartees: ecartes.length,
      // Exposé en toutes lettres : sur le corpus réel, c'est la majorité.
      nonEvaluables,
      note:
        nonEvaluables > 0
          ? `${nonEvaluables} offre(s) ne publient pas assez d'attendus pour être notées. Elles ne sont ni retenues ni rejetées : la plateforme ne devine pas ce que l'employeur n'a pas écrit.`
          : undefined,
    },
    resultats: retenus.slice(0, limite),
    // Les écartés ne sont pas tronqués par `limite` : ils sont peu nombreux
    // par construction, et c'est la partie qu'on ne veut surtout pas cacher.
    ecartes,
    import: {
      sectionsIgnorees: ignores,
      avertissements,
    },
  });
});

// @desc    Produire les pièces d'une candidature pour un candidat soumis
// @route   POST /api/integration/dossier
// @access  Clé d'API — portée « dossier:produire »
const dossier = asyncHandler(async (req, res) => {
  const { profil, identite } = lireResume(req, res);
  const user = utilisateurEphemere(identite);

  const slug = String(req.body?.slug || "").trim();
  if (!slug) {
    res.status(400);
    throw new Error(
      "Indiquez l'offre visée dans « slug » (celui renvoyé par /api/integration/rapprochement ou /api/avps).",
    );
  }

  const avp = await Avp.findOne({ slug });
  if (!avp) {
    res.status(404);
    throw new Error(`Aucune offre ne porte la référence « ${slug} ».`);
  }

  // Les pièces demandées. Par défaut la lettre et le CV — les deux seules
  // destinées à l'employeur. `restitution` et `preparation` s'adressent au
  // candidat et n'ont de sens que si l'ATS les lui retransmet.
  const PIECES = ["lettre", "cv", "restitution", "preparation"];
  const demandees = Array.isArray(req.body?.pieces)
    ? req.body.pieces.filter((p) => PIECES.includes(p))
    : ["lettre", "cv"];

  if (demandees.length === 0) {
    res.status(400);
    throw new Error(`Pièces reconnues : ${PIECES.join(", ")}.`);
  }

  // Le rapprochement nourrit la rédaction : c'est lui qui fournit les
  // correspondances à citer. Sans lui, la lettre paraphrase l'annonce.
  const rapprochementOffre = await rapprocher(profil, avp);

  const date = new Date();
  const pieces = {};

  for (const piece of demandees) {
    const { contenu, source, modele, critique } = await GENERATEURS[piece](
      profil,
      avp,
      user,
      rapprochementOffre,
    );

    pieces[piece] = {
      contenu,
      // `source` distingue une pièce rédigée par le modèle d'un brouillon
      // assemblé hors ligne. Le taire ferait passer un assemblage pour une
      // rédaction — l'intégrateur doit pouvoir prévenir son utilisateur.
      source,
      modele: modele || null,
      critique: critique || null,
    };
  }

  // PDF sur demande seulement : un ATS restitue en général dans sa propre
  // charte, et joindre systématiquement quatre PDF en base64 quadruplerait la
  // réponse pour rien.
  if (req.body?.pdf === true) {
    for (const piece of Object.keys(pieces)) {
      const binaire =
        piece === "cv"
          ? await cvPdf({ profil, user, avp, date })
          : piece === "lettre"
            ? await lettrePdf({ texte: pieces[piece].contenu, avp, user, profil, date })
            : null;

      if (binaire) pieces[piece].pdfBase64 = binaire.toString("base64");
    }
  }

  res.json({
    offre: {
      reference: avp.idAvp,
      intitule: avp.intitule,
      employeur: avp.employeur?.nom || null,
      jobPosting: `/api/avps/${avp.slug}/jobposting`,
    },
    rapprochement: {
      score: rapprochementOffre.score,
      fiabilite: rapprochementOffre.fiabilite,
      fiable: rapprochementOffre.fiable,
      verdict: rapprochementOffre.verdict,
      motifsExclusion: rapprochementOffre.motifsExclusion || [],
    },
    pieces,
    // Le profil ciblé, au standard : l'ATS peut le reverser dans son propre
    // dossier candidat sans relire notre format.
    resume: versJsonResume(profil, user, avp),
    // ⚠️ Dit explicitement, parce que c'est la question que se pose
    // l'intégrateur : non, nous n'avons rien envoyé.
    avertissement:
      "Ces pièces sont produites et retournées, jamais transmises à l'employeur. La transmission reste un geste du candidat.",
  });
});

export { rapprochement, dossier };
