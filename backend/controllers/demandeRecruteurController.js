// backend/controllers/demandeRecruteurController.js
//
// Demandes d'ouverture de compte recruteur : dépôt public, instruction par un
// administrateur, décision notifiée par courriel.

import crypto from "crypto";
import asyncHandler from "../middleware/asyncHandler.js";
import DemandeRecruteur, { STATUTS } from "../models/DemandeRecruteurModel.js";
import User from "../models/UserModel.js";
import { RecruteurProfil } from "../models/RecruteurModel.js";
import { EMPLOYEURS } from "../config/employeurs.js";
import { APP_NAME } from "../config/application.js";
import sendEmail from "../utils/sendEmail.js";

const FRONT = () => process.env.FRONTEND_URL || "http://localhost:3000";

// Courrier de modération, même forme sobre que partout ailleurs.
const envoyer = async ({ email, subject, titre, paragraphes }) => {
  try {
    await sendEmail({
      email,
      subject,
      text: [titre, "", ...paragraphes].join("\n\n").replace(/<[^>]+>/g, ""),
      html:
        `<h2 style="font:600 18px system-ui,sans-serif">${titre}</h2>` +
        paragraphes
          .map(
            (p) =>
              `<p style="font:14px/1.6 system-ui,sans-serif;color:#222">${p}</p>`,
          )
          .join(""),
    });
    return { envoye: true, erreur: "" };
  } catch (erreur) {
    console.warn(`⚠️  Courriel non remis à ${email} : ${erreur.message}`);
    return { envoye: false, erreur: erreur.message };
  }
};

// ── Dépôt, côté public ────────────────────────────────────────────────────

// @desc    Déposer une demande de compte recruteur
// @route   POST /api/demandes-recruteur
// @access  Public
const deposer = asyncHandler(async (req, res) => {
  const {
    prenom,
    nom,
    email,
    telephone,
    organisation,
    employeurCode,
    fonction,
    siteOrganisation,
    motivation,
  } = req.body;

  const manquants = [
    ["prénom", prenom],
    ["nom", nom],
    ["adresse email", email],
    ["organisation", organisation],
    ["fonction", fonction],
    ["motivation", motivation],
  ]
    .filter(([, v]) => !String(v || "").trim())
    .map(([libelle]) => libelle);

  if (manquants.length) {
    res.status(400);
    throw new Error(`Champs obligatoires manquants : ${manquants.join(", ")}.`);
  }

  const adresse = String(email).toLowerCase().trim();

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adresse)) {
    res.status(400);
    throw new Error("Cette adresse email n'est pas valide.");
  }

  const existante = await DemandeRecruteur.findOne({
    email: adresse,
    statut: "en_attente",
  });

  if (existante) {
    res.status(409);
    throw new Error(
      "Une demande est déjà en cours d'examen pour cette adresse. Vous recevrez une réponse par courriel.",
    );
  }

  // Un compte déjà recruteur : on le dit plutôt que d'ouvrir un dossier
  // inutile. Pour une adresse sans compte, ou avec un compte candidat, on
  // n'en dit RIEN — confirmer l'existence d'un compte à un inconnu permettrait
  // d'énumérer les comptes de la plateforme.
  const compte = await User.findOne({ email: adresse });
  if (compte && ["recruteur", "admin"].includes(compte.role)) {
    res.status(409);
    throw new Error(
      "Cette adresse dispose déjà d'un accès recruteur. Connectez-vous, ou utilisez « mot de passe oublié ».",
    );
  }

  const demande = await DemandeRecruteur.create({
    prenom: prenom.trim(),
    nom: nom.trim(),
    email: adresse,
    telephone: (telephone || "").trim(),
    organisation: organisation.trim(),
    employeurCode: employeurCode || null,
    fonction: fonction.trim(),
    siteOrganisation: (siteOrganisation || "").trim(),
    motivation: motivation.trim(),
  });

  console.log(`📨 Demande de compte recruteur : ${adresse} (${organisation})`);

  await envoyer({
    email: adresse,
    subject: `${APP_NAME} — votre demande d'accès recruteur`,
    titre: "Votre demande est enregistrée",
    paragraphes: [
      `Bonjour ${demande.prenom},`,
      `Nous avons bien reçu votre demande d'accès recruteur pour ${demande.organisation}.`,
      `Un administrateur va l'examiner. L'accès recruteur donne accès aux parcours et aux coordonnées de personnes qui cherchent un emploi : c'est pourquoi il n'est pas automatique, et pourquoi chaque demande est vérifiée.`,
      `Vous recevrez notre réponse par courriel, acceptée ou non, avec son motif.`,
    ],
  });

  res.status(201).json({
    // Pas de « Demande transmise » ici : l'écran l'affiche déjà en titre, et
    // le répéter juste en dessous donne l'impression d'un accusé de réception
    // automatique. Ce message dit la SUITE.
    message:
      "Un administrateur va l'examiner et vous répondra par courriel, dans un sens ou dans l'autre. Un accusé de réception vient de partir vers votre adresse.",
  });
});

// @desc    Les employeurs répertoriés, pour le formulaire public
// @route   GET /api/demandes-recruteur/employeurs
// @access  Public
const listerEmployeurs = asyncHandler(async (req, res) => {
  res.json(EMPLOYEURS.map((e) => ({ code: e.code, nom: e.nomComplet })));
});

// ── Instruction, côté administration ──────────────────────────────────────

// @desc    Les demandes
// @route   GET /api/demandes-recruteur
// @access  Privé / Admin
const lister = asyncHandler(async (req, res) => {
  const filtre = {};
  if (STATUTS.includes(req.query.statut)) filtre.statut = req.query.statut;

  const demandes = await DemandeRecruteur.find(filtre)
    .populate("decidePar", "prenom nom")
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  // Un compte existe-t-il déjà pour cette adresse ? L'administrateur doit le
  // savoir : accepter créera un compte, ou promouvra celui qui existe.
  const comptes = new Map(
    (
      await User.find(
        { email: { $in: demandes.map((d) => d.email) } },
        "email role isActive",
      ).lean()
    ).map((u) => [u.email, u]),
  );

  const parStatut = Object.fromEntries(STATUTS.map((s) => [s, 0]));
  for (const l of await DemandeRecruteur.aggregate([
    { $group: { _id: "$statut", n: { $sum: 1 } } },
  ])) {
    parStatut[l._id] = l.n;
  }

  res.json({
    parStatut,
    demandes: demandes.map((d) => ({
      ...d,
      decidePar: d.decidePar
        ? `${d.decidePar.prenom} ${d.decidePar.nom}`.trim()
        : null,
      compteExistant: comptes.get(d.email)
        ? {
            role: comptes.get(d.email).role,
            isActive: comptes.get(d.email).isActive,
          }
        : null,
    })),
  });
});

// @desc    Accepter ou refuser une demande
// @route   PUT /api/demandes-recruteur/:id
// @access  Privé / Admin
//
// ⚠️ À l'acceptation, on ne fabrique JAMAIS de mot de passe pour la personne.
// On crée le compte avec un secret aléatoire inutilisable, puis on lui envoie
// un lien de définition — le même mécanisme que « mot de passe oublié ».
// Envoyer un mot de passe par courriel reviendrait à le laisser en clair dans
// deux boîtes mail et dans les journaux du serveur.
const decider = asyncHandler(async (req, res) => {
  const { statut, motif } = req.body;

  if (!["acceptee", "refusee"].includes(statut)) {
    res.status(400);
    throw new Error("Décision inconnue : attendu « acceptee » ou « refusee ».");
  }

  if (!motif?.trim()) {
    res.status(400);
    throw new Error(
      "Écrivez le motif : il est envoyé tel quel au demandeur, et c'est ce qui lui permet de comprendre — ou de refaire une demande recevable.",
    );
  }

  const demande = await DemandeRecruteur.findById(req.params.id);
  if (!demande) {
    res.status(404);
    throw new Error("Demande introuvable.");
  }

  if (demande.statut !== "en_attente") {
    res.status(409);
    throw new Error("Cette demande a déjà été instruite.");
  }

  let paragraphes;
  let titre;
  let sujet;

  if (statut === "acceptee") {
    let compte = await User.findOne({ email: demande.email });
    let lien;

    if (compte) {
      // Compte existant : on promeut plutôt que de dupliquer. La personne
      // garde son mot de passe et son historique.
      compte.role = "recruteur";
      compte.isActive = true;
      await compte.save({ validateBeforeSave: false });

      lien = `${FRONT()}/login`;
      paragraphes = [
        `Bonjour ${demande.prenom},`,
        `Votre demande d'accès recruteur pour ${demande.organisation} est <strong>acceptée</strong>.`,
        `<strong>Motif :</strong><br>${motif}`,
        `Votre compte existant a été étendu : connectez-vous comme d'habitude, l'espace recruteur apparaîtra. ${lien}`,
      ];
    } else {
      // Compte à créer. Mot de passe aléatoire jamais communiqué : il sert
      // uniquement à satisfaire la contrainte du schéma, et la personne
      // définit le sien par le lien ci-dessous.
      compte = await User.create({
        email: demande.email,
        password: crypto.randomBytes(32).toString("hex"),
        prenom: demande.prenom,
        nom: demande.nom,
        role: "recruteur",
      });

      const jeton = compte.getResetPasswordToken();
      // Le lien de première connexion vaut plus longtemps qu'un simple oubli
      // de mot de passe : quelqu'un qui reçoit cette réponse ne l'attendait
      // pas forcément dans les trente minutes.
      compte.resetPasswordExpire = Date.now() + 7 * 24 * 60 * 60 * 1000;
      await compte.save({ validateBeforeSave: false });

      lien = `${FRONT()}/reset-password/${jeton}`;

      paragraphes = [
        `Bonjour ${demande.prenom},`,
        `Votre demande d'accès recruteur pour ${demande.organisation} est <strong>acceptée</strong>.`,
        `<strong>Motif :</strong><br>${motif}`,
        `Votre compte est créé. Définissez votre mot de passe avec ce lien, valable sept jours :<br><a href="${lien}">${lien}</a>`,
        `Un rappel qui compte : l'espace recruteur donne accès aux parcours et aux coordonnées de personnes qui cherchent un emploi. Elles vous les confient pour être contactées à propos d'un poste, et pour rien d'autre.`,
      ];
    }

    // Profil recruteur pré-rempli avec ce qui a été déclaré : la personne ne
    // doit pas resaisir ce qu'elle vient d'écrire dans le formulaire.
    await RecruteurProfil.findOneAndUpdate(
      { user: compte._id },
      {
        user: compte._id,
        organisation: demande.organisation,
        employeurCode: demande.employeurCode,
        fonction: demande.fonction,
        telephone: demande.telephone,
      },
      { upsert: true, setDefaultsOnInsert: true },
    );

    demande.compte = compte._id;
    titre = "Votre accès recruteur est ouvert";
    sujet = `${APP_NAME} — accès recruteur accordé`;
  } else {
    paragraphes = [
      `Bonjour ${demande.prenom},`,
      `Votre demande d'accès recruteur pour ${demande.organisation} n'a <strong>pas été retenue</strong>.`,
      `<strong>Motif :</strong><br>${motif}`,
      `Si votre situation change, ou si un élément manquait à votre demande, vous pouvez en déposer une nouvelle : ${FRONT()}/devenir-recruteur`,
      `Vous pouvez aussi répondre à ce message si vous pensez qu'il s'agit d'une erreur.`,
    ];
    titre = "Votre demande d'accès recruteur";
    sujet = `${APP_NAME} — réponse à votre demande`;
  }

  const courriel = await envoyer({
    email: demande.email,
    subject: sujet,
    titre,
    paragraphes,
  });

  demande.statut = statut;
  demande.motifDecision = motif;
  demande.decidePar = req.user._id;
  demande.decideLe = new Date();
  demande.courrielEnvoye = courriel.envoye;
  demande.courrielErreur = courriel.erreur;
  await demande.save();

  console.log(
    `⚖️  Demande recruteur ${demande.email} → ${statut} par ${req.user.email}`,
  );

  res.json({
    message: courriel.envoye
      ? `Décision enregistrée et transmise à ${demande.email}.`
      : `Décision enregistrée, mais le courriel n'a pas pu être remis : ${courriel.erreur}`,
    courriel,
  });
});

export { deposer, listerEmployeurs, lister, decider };
