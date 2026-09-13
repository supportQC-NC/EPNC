// backend/controllers/moderationController.js
//
// Signalements et modération.
//
// Deux publics, deux niveaux d'accès :
//   - un utilisateur connecté SIGNALE, est informé du VERDICT une fois le
//     dossier clos, et peut le contester ;
//   - un administrateur INSTRUIT, décide, écrit, et répond aux recours.
//
// Le signalant n'apprend jamais LES MESURES prises sur la personne visée :
// seulement si son signalement était fondé, et pourquoi.
//
// Voir l'en-tête de SignalementModel pour le principe : un signalement ouvre
// un dossier, il ne déclenche aucune sanction automatique.

import asyncHandler from "../middleware/asyncHandler.js";
import Signalement, {
  MOTIFS,
  LIBELLES_MOTIFS,
  STATUTS,
} from "../models/SignalementModel.js";
import User from "../models/UserModel.js";
import Profil from "../models/ProfilModel.js";
import {
  avertir,
  regulariser,
  informerSignalant,
  contacter,
  traiterEcheances,
  echeancesAVenir,
  SEUIL_MASQUAGE,
  DELAI_REGULARISATION_JOURS,
} from "../services/moderationService.js";

// Mesures qu'un administrateur peut prendre en clôturant un dossier. La liste
// est fermée : une action de modération doit être nommée, pas improvisée en
// texte libre, sinon le journal devient illisible.
const MESURES = {
  aucune: "Aucune mesure",
  // L'avertissement est la mesure NORMALE : graduée, expliquée, et cumulative.
  // Au troisième, le profil cesse d'être visible et un délai s'ouvre — voir
  // moderationService. C'est ce qui évite d'avoir à choisir entre « rien » et
  // « on coupe tout ».
  avertir: "Avertissement (le 3e masque le profil)",
  regulariser: "Lever les avertissements (régularisation)",
  masquer_profil: "Profil retiré du vivier",
  desactiver_compte: "Compte désactivé",
  reactiver_compte: "Compte réactivé",
};

// ── Côté utilisateur ──────────────────────────────────────────────────────

// @desc    Signaler un compte
// @route   POST /api/moderation/signalements
// @access  Privé (tout compte connecté)
const signaler = asyncHandler(async (req, res) => {
  const { cibleId, motif, details } = req.body;

  if (!MOTIFS.includes(motif)) {
    res.status(400);
    throw new Error("Motif de signalement inconnu.");
  }

  if (String(cibleId) === String(req.user._id)) {
    res.status(400);
    throw new Error("Vous ne pouvez pas vous signaler vous-même.");
  }

  const cible = await User.findById(cibleId);
  if (!cible) {
    res.status(404);
    throw new Error("Ce compte n'existe pas.");
  }

  // Un dossier déjà ouvert sur cette personne par cette personne : on le met à
  // jour plutôt que d'en créer un second. L'index unique partiel le refuserait
  // de toute façon, mais un message clair vaut mieux qu'une erreur de base.
  const ouvert = await Signalement.findOne({
    signalePar: req.user._id,
    cible: cible._id,
    statut: { $in: ["nouveau", "en_cours"] },
  });

  if (ouvert) {
    res.status(409);
    throw new Error(
      "Vous avez déjà signalé ce compte, et le dossier est encore en cours d'examen.",
    );
  }

  const signalement = await Signalement.create({
    signalePar: req.user._id,
    roleSignalant: req.user.role,
    cible: cible._id,
    cibleNom: cible.nom,
    ciblePrenom: cible.prenom,
    cibleEmail: cible.email,
    cibleRole: cible.role,
    motif,
    details: details || "",
  });

  console.log(
    `🚩 Signalement ${signalement._id} : ${req.user.email} → ${cible.email} (${motif})`,
  );

  // ⚠️ La réponse ne dit RIEN de l'état du compte visé, ni des signalements
  // déjà déposés par d'autres. Renvoyer « ce compte a déjà été signalé
  // 3 fois » transformerait le signalement en outil de renseignement.
  res.status(201).json({
    message:
      "Signalement transmis. Un administrateur l'examinera, et vous recevrez un courriel vous indiquant s'il a été retenu — sans le détail des mesures prises, qui ne regardent que la personne concernée et nous.",
  });
});

// @desc    Les dossiers qui me concernent — déposés PAR moi ou SUR moi
// @route   GET /api/moderation/mes-signalements
// @access  Privé
//
// ⚠️ Deux vues très différentes dans une seule route :
//   - ce que j'ai signalé : je vois le verdict et le motif, jamais les mesures ;
//   - ce qui a été signalé SUR moi : je vois ce qui m'est reproché, ce qui a
//     été décidé, et je peux contester. Cacher à quelqu'un ce qu'on lui
//     reproche rendrait tout recours impossible.
const mesSignalements = asyncHandler(async (req, res) => {
  const [deposes, recus] = await Promise.all([
    Signalement.find({ signalePar: req.user._id }).sort({ createdAt: -1 }).lean(),
    Signalement.find({
      cible: req.user._id,
      // Un dossier encore à l'examen n'est pas communiqué : rien n'a été
      // décidé, et l'annoncer inquiéterait sans motif.
      statut: { $in: ["traite", "rejete"] },
    })
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  const utilisateur = await User.findById(req.user._id).lean();

  res.json({
    // État de mon propre compte : c'est ici qu'on apprend qu'on est sous le
    // coup d'avertissements, et jusqu'à quand on peut régulariser.
    monCompte: {
      avertissements: (utilisateur.avertissements || [])
        .filter((a) => !a.leveLe)
        .map((a) => ({ motif: a.motif, date: a.date })),
      masqueLe: utilisateur.masqueLe,
      regulariserAvant: utilisateur.regulariserAvant,
    },

    deposes: deposes.map((s) => ({
      _id: s._id,
      nom: `${s.ciblePrenom} ${s.cibleNom}`.trim(),
      motif: LIBELLES_MOTIFS[s.motif] || s.motif,
      date: s.createdAt,
      clos: ["traite", "rejete"].includes(s.statut),
      // Le VERDICT, pas les mesures.
      verdict:
        s.statut === "traite"
          ? "retenu"
          : s.statut === "rejete"
            ? "non retenu"
            : "en cours d'examen",
      decision: ["traite", "rejete"].includes(s.statut) ? s.decision : "",
      recoursPossible:
        ["traite", "rejete"].includes(s.statut) && !s.appel?.deposeLe,
      recoursDepose: Boolean(s.appel?.deposeLe),
      reponseRecours: s.appel?.repondu ? s.appel.reponse : "",
    })),

    recus: recus.map((s) => ({
      _id: s._id,
      motif: LIBELLES_MOTIFS[s.motif] || s.motif,
      date: s.createdAt,
      // ⚠️ On ne dit PAS qui a signalé. Le dire exposerait un recruteur à des
      // représailles, et dissuaderait de signaler.
      fonde: s.statut === "traite",
      decision: s.decision,
      recoursPossible: !s.appel?.deposeLe,
      recoursDepose: Boolean(s.appel?.deposeLe),
      reponseRecours: s.appel?.repondu ? s.appel.reponse : "",
    })),
  });
});

// ── Côté administration ───────────────────────────────────────────────────

// @desc    Les signalements à instruire
// @route   GET /api/moderation/signalements
// @access  Privé / Admin
const listerSignalements = asyncHandler(async (req, res) => {
  const filtre = {};
  if (req.query.statut && STATUTS.includes(req.query.statut)) {
    filtre.statut = req.query.statut;
  }

  const signalements = await Signalement.find(filtre)
    .populate("signalePar", "prenom nom email role")
    .populate("cible", "prenom nom email role isActive")
    .populate("traitePar", "prenom nom")
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  // Profils encore visibles parmi les comptes visés : l'administrateur doit
  // savoir si le retrait du vivier est encore une mesure disponible.
  const cibles = signalements.map((s) => s.cible?._id).filter(Boolean);
  const visibles = new Set(
    (
      await Profil.find({ user: { $in: cibles }, visibleRecruteurs: true }, "user").lean()
    ).map((p) => String(p.user)),
  );

  // Dossier disciplinaire de chaque personne visée : un administrateur qui
  // instruit doit savoir si c'est un premier écart ou le troisième.
  const avertissementsParCible = new Map(
    (
      await User.find(
        { _id: { $in: cibles } },
        "avertissements masqueLe regulariserAvant",
      ).lean()
    ).map((u) => [
      String(u._id),
      {
        actifs: (u.avertissements || []).filter((a) => !a.leveLe).length,
        total: (u.avertissements || []).length,
        masqueLe: u.masqueLe,
        regulariserAvant: u.regulariserAvant,
      },
    ]),
  );

  const parStatut = Object.fromEntries(STATUTS.map((s) => [s, 0]));
  for (const s of await Signalement.aggregate([
    { $group: { _id: "$statut", n: { $sum: 1 } } },
  ])) {
    parStatut[s._id] = s.n;
  }

  res.json({
    parStatut,
    motifs: LIBELLES_MOTIFS,
    mesures: MESURES,
    seuil: SEUIL_MASQUAGE,
    delaiJours: DELAI_REGULARISATION_JOURS,
    signalements: signalements.map((s) => ({
      _id: s._id,
      motif: s.motif,
      motifLibelle: LIBELLES_MOTIFS[s.motif] || s.motif,
      details: s.details,
      statut: s.statut,
      createdAt: s.createdAt,
      signalePar: s.signalePar
        ? {
            nom: `${s.signalePar.prenom} ${s.signalePar.nom}`.trim(),
            email: s.signalePar.email,
            role: s.signalePar.role,
          }
        : { nom: "Compte supprimé", email: "", role: null },
      cible: {
        _id: s.cible?._id || null,
        // Sur un compte supprimé, la copie prise au dépôt prend le relais :
        // un dossier doit rester instruisible.
        nom: s.cible
          ? `${s.cible.prenom} ${s.cible.nom}`.trim()
          : `${s.ciblePrenom} ${s.cibleNom}`.trim(),
        email: s.cible?.email || s.cibleEmail,
        role: s.cible?.role || s.cibleRole,
        isActive: s.cible?.isActive ?? null,
        existe: Boolean(s.cible),
        visibleRecruteurs: visibles.has(String(s.cible?._id)),
      },
      traitePar: s.traitePar
        ? `${s.traitePar.prenom} ${s.traitePar.nom}`.trim()
        : null,
      traiteLe: s.traiteLe,
      decision: s.decision,
      mesures: (s.mesures || []).map((m) => MESURES[m] || m),
      // Le signalant a-t-il été informé ? Un dossier clos dont le courrier
      // n'est jamais parti laisse quelqu'un sans réponse : il faut le voir.
      informeLe: s.informeLe,
      informeErreur: s.informeErreur,
      // Dossier disciplinaire de la personne visée, au moment de l'examen.
      avertissements: avertissementsParCible.get(String(s.cible?._id)) || null,
      appel: s.appel?.deposeLe
        ? {
            parQui: s.appel.parQui,
            message: s.appel.message,
            deposeLe: s.appel.deposeLe,
            repondu: s.appel.repondu,
            reponse: s.appel.reponse,
          }
        : null,
      echanges: (s.echanges || []).map((e) => ({
        vers: e.vers,
        objet: e.objet,
        date: e.date,
        simule: e.simule,
      })),
    })),
  });
});

// @desc    Instruire un signalement
// @route   PUT /api/moderation/signalements/:id
// @access  Privé / Admin
//
// C'est ICI que les mesures s'appliquent — jamais ailleurs, jamais
// automatiquement. Chaque clôture exige un motif écrit : un dossier clos sans
// explication ne se relit pas six mois plus tard.
const instruireSignalement = asyncHandler(async (req, res) => {
  const { statut, decision, mesures = [] } = req.body;

  if (!STATUTS.includes(statut)) {
    res.status(400);
    throw new Error("Statut inconnu.");
  }

  const inconnues = mesures.filter((m) => !MESURES[m]);
  if (inconnues.length) {
    res.status(400);
    throw new Error(`Mesure inconnue : ${inconnues.join(", ")}.`);
  }

  if (["traite", "rejete"].includes(statut) && !decision?.trim()) {
    res.status(400);
    throw new Error(
      "Écrivez la décision : un dossier clos sans motif est inexploitable plus tard.",
    );
  }

  const signalement = await Signalement.findById(req.params.id);
  if (!signalement) {
    res.status(404);
    throw new Error("Signalement introuvable.");
  }

  const appliquees = [];
  // Ce qui est renvoyé à l'administrateur : il doit voir ce que la personne a
  // reçu, et si le courrier est parti.
  const effets = [];

  const cible = await User.findById(signalement.cible);

  for (const mesure of mesures) {
    if (mesure === "aucune" || !cible) continue;

    // Un administrateur ne se modère pas depuis cet écran : la modération vise
    // les usages du service, pas les droits d'exploitation. Cela évite aussi
    // de se verrouiller soi-même dehors.
    if (cible.role === "admin") {
      res.status(403);
      throw new Error(
        "Un compte administrateur ne se modère pas depuis cet écran. Passez par la gestion des comptes.",
      );
    }

    if (mesure === "avertir") {
      const r = await avertir({
        cible,
        // Le motif de l'avertissement est CELUI DE LA DÉCISION : c'est ce
        // texte que la personne recevra. Écrire un motif pour le dossier et un
        // autre pour l'intéressé serait le meilleur moyen de ne plus savoir
        // ce qui lui a été dit.
        motif: decision,
        par: req.user,
        signalement,
      });

      appliquees.push(mesure);
      effets.push({
        mesure,
        avertissementsActifs: r.actifs,
        seuil: SEUIL_MASQUAGE,
        masqueMaintenant: r.masqueMaintenant,
        regulariserAvant: r.regulariserAvant,
        courriel: r.courriel,
      });

      if (r.masqueMaintenant) appliquees.push("masquer_profil");
      continue;
    }

    if (mesure === "regulariser") {
      const r = await regulariser({ cible, motif: decision, par: req.user });
      appliquees.push(mesure);
      effets.push({ mesure, courriel: r.courriel });
      continue;
    }

    if (mesure === "desactiver_compte" || mesure === "reactiver_compte") {
      cible.isActive = mesure === "reactiver_compte";
      await cible.save({ validateBeforeSave: false });
      appliquees.push(mesure);
      continue;
    }

    if (mesure === "masquer_profil") {
      const profil = await Profil.findOne({ user: cible._id });
      if (profil) {
        profil.visibleRecruteurs = false;
        await profil.save();
        appliquees.push(mesure);
      }
    }
  }

  signalement.statut = statut;
  signalement.decision = decision || "";
  signalement.mesures = appliquees;

  if (["traite", "rejete"].includes(statut)) {
    signalement.traitePar = req.user._id;
    signalement.traiteLe = new Date();
  }

  // Le signalant est informé dès que le dossier est CLOS, pas avant : lui
  // écrire « en cours d'examen » ne lui apprend rien et multiplie les
  // courriers.
  let courrielSignalant = null;

  if (["traite", "rejete"].includes(statut) && !signalement.informeLe) {
    courrielSignalant = await informerSignalant({
      signalement,
      fonde: statut === "traite",
      decision,
    });

    if (courrielSignalant.envoye) signalement.informeLe = new Date();
    else signalement.informeErreur = courrielSignalant.erreur || "";
  }

  await signalement.save();

  // Trace en console : les décisions de modération doivent laisser une trace
  // hors de la base, consultable même si l'on n'a pas accès à l'interface.
  console.log(
    `⚖️  Signalement ${signalement._id} → ${statut} par ${req.user.email}` +
      (appliquees.length ? ` · mesures : ${appliquees.join(", ")}` : ""),
  );

  res.json({
    message: "Dossier mis à jour.",
    _id: signalement._id,
    effets,
    courrielSignalant,
  });
});

// @desc    Écrire à l'une des parties depuis l'application
// @route   POST /api/moderation/signalements/:id/contact
// @access  Privé / Admin
//
// Instruire un dossier demande souvent de poser une question avant de décider.
// Sans cela, l'administrateur sort de l'outil pour écrire depuis sa messagerie,
// et l'échange disparaît du dossier — c'est-à-dire au moment où il compte le
// plus.
const contacterPartie = asyncHandler(async (req, res) => {
  const { vers, objet, message } = req.body;

  if (!["signalant", "cible"].includes(vers)) {
    res.status(400);
    throw new Error("Destinataire inconnu.");
  }

  if (!objet?.trim() || !message?.trim()) {
    res.status(400);
    throw new Error("Un objet et un message sont nécessaires.");
  }

  const signalement = await Signalement.findById(req.params.id);
  if (!signalement) {
    res.status(404);
    throw new Error("Signalement introuvable.");
  }

  const destinataire = await User.findById(
    vers === "cible" ? signalement.cible : signalement.signalePar,
  );

  if (!destinataire) {
    res.status(404);
    throw new Error("Ce compte n'existe plus.");
  }

  const r = await contacter({ destinataire, objet, message, par: req.user });

  signalement.echanges.push({
    vers,
    adresse: destinataire.email,
    objet,
    message,
    par: req.user._id,
    simule: r.simule,
  });
  await signalement.save();

  res.json({
    message: r.envoye
      ? r.simule
        ? "Message tracé (serveur d'envoi non configuré) : rien n'est réellement parti."
        : `Message envoyé à ${destinataire.email}.`
      : `Le message n'a pas pu être remis : ${r.erreur}`,
    envoye: r.envoye,
    simule: r.simule,
  });
});

// @desc    Contester une décision
// @route   POST /api/moderation/signalements/:id/appel
// @access  Privé (le signalant ou la personne visée)
//
// Une décision sans recours n'est pas une décision, c'est une sanction. Les
// DEUX parties peuvent contester : le signalant dont le dossier a été rejeté,
// et la personne visée par une mesure.
const faireAppel = asyncHandler(async (req, res) => {
  const { message } = req.body;

  if (!message?.trim()) {
    res.status(400);
    throw new Error("Expliquez ce qui vous paraît inexact.");
  }

  const signalement = await Signalement.findById(req.params.id);
  if (!signalement) {
    res.status(404);
    throw new Error("Dossier introuvable.");
  }

  const estSignalant = String(signalement.signalePar) === String(req.user._id);
  const estCible = String(signalement.cible) === String(req.user._id);

  if (!estSignalant && !estCible) {
    // 404 plutôt que 403 : inutile de confirmer à un tiers qu'un dossier
    // existe sous cet identifiant.
    res.status(404);
    throw new Error("Dossier introuvable.");
  }

  if (!["traite", "rejete"].includes(signalement.statut)) {
    res.status(409);
    throw new Error(
      "Ce dossier n'est pas encore clos : il n'y a pas encore de décision à contester.",
    );
  }

  if (signalement.appel?.deposeLe) {
    res.status(409);
    throw new Error("Un recours a déjà été déposé sur ce dossier.");
  }

  signalement.appel = {
    parQui: estSignalant ? "signalant" : "cible",
    message,
    deposeLe: new Date(),
    repondu: false,
  };

  // Le dossier rouvre : un recours qui laisserait le dossier « traité » ne
  // reviendrait jamais devant personne.
  signalement.statut = "en_cours";
  await signalement.save();

  console.log(
    `📣 Recours sur le signalement ${signalement._id} par ${req.user.email} (${signalement.appel.parQui})`,
  );

  res.status(201).json({
    message:
      "Votre recours est enregistré. Le dossier est rouvert et sera réexaminé.",
  });
});

// @desc    Les comptes sous le coup d'une échéance
// @route   GET /api/moderation/echeances
// @access  Privé / Admin
const getEcheances = asyncHandler(async (req, res) => {
  res.json({
    seuil: SEUIL_MASQUAGE,
    delaiJours: DELAI_REGULARISATION_JOURS,
    comptes: await echeancesAVenir(),
  });
});

// @desc    Appliquer les échéances dépassées
// @route   POST /api/moderation/echeances
// @access  Privé / Admin
//
// `simulation: true` liste ce qui SERAIT supprimé sans rien faire. Une action
// irréversible doit pouvoir se regarder avant de se déclencher.
const appliquerEcheances = asyncHandler(async (req, res) => {
  const r = await traiterEcheances({ simulation: Boolean(req.body?.simulation) });

  res.json({
    ...r,
    simulation: Boolean(req.body?.simulation),
    message: req.body?.simulation
      ? `${r.total} compte(s) seraient supprimés.`
      : `${r.total} compte(s) supprimé(s).`,
  });
});

export {
  signaler,
  mesSignalements,
  listerSignalements,
  instruireSignalement,
  contacterPartie,
  faireAppel,
  getEcheances,
  appliquerEcheances,
};
