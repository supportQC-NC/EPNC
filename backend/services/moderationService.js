// backend/services/moderationService.js
//
// Les conséquences d'une décision de modération, et les courriers qui les
// accompagnent.
//
// ══════════════════════════════════════════════════════════════════════════
//  UNE SANCTION QUI N'EST PAS EXPLIQUÉE N'EN EST PAS UNE
// ══════════════════════════════════════════════════════════════════════════
// Chaque mesure prise ici s'accompagne d'un courrier qui dit : ce qui est
// reproché, ce qui a été décidé, ce qu'il reste à faire, et comment contester.
// Sans cela, quelqu'un voit son profil disparaître sans comprendre, et n'a
// aucun moyen de se défendre.
//
// L'ENVOI NE DOIT JAMAIS FAIRE ÉCHOUER LA DÉCISION. Une adresse invalide, un
// serveur SMTP en panne : la mesure reste prise, l'échec est tracé, et
// l'administrateur le voit. L'inverse — annuler une décision de modération
// parce qu'un email n'est pas parti — serait absurde.

import User from "../models/UserModel.js";
import Profil from "../models/ProfilModel.js";
import sendEmail from "../utils/sendEmail.js";
import { APP_NAME } from "../config/application.js";

// Nombre d'avertissements actifs au-delà duquel le profil cesse d'être
// visible. Trois, parce que deux laissent trop peu de place à l'erreur et que
// quatre transforment l'avertissement en formalité.
export const SEUIL_MASQUAGE = 3;

// Jours laissés pour prendre contact avant suppression du compte.
//
// Quinze jours : assez pour quelqu'un en congés ou hors réseau, assez court
// pour que la mesure garde un sens. La valeur est ici, pas dispersée dans le
// code — et l'échéance est STOCKÉE sur le compte, pour qu'un changement de
// durée ne déplace pas une date déjà annoncée à quelqu'un.
export const DELAI_REGULARISATION_JOURS = 15;

const FRONT = () => process.env.FRONTEND_URL || "http://localhost:3000";

const jour = (d) =>
  new Date(d).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

// Courrier en texte simple, encadré du minimum de HTML.
//
// Pas de gabarit élaboré : ces messages annoncent une mesure, ils ne vendent
// rien. Un texte sobre passe aussi les filtres anti-spam, ce qu'une carte
// colorée fait moins bien.
const courrier = (titre, paragraphes) => ({
  text: [titre, "", ...paragraphes].join("\n\n"),
  html:
    `<h2 style="font:600 18px system-ui,sans-serif">${titre}</h2>` +
    paragraphes
      .map(
        (p) =>
          `<p style="font:14px/1.6 system-ui,sans-serif;color:#222">${p.replace(/\n/g, "<br>")}</p>`,
      )
      .join(""),
});

/**
 * Envoie un courrier de modération sans jamais lever.
 * Renvoie ce qui s'est passé, pour que le dossier en garde la trace.
 */
const envoyer = async ({ email, subject, titre, paragraphes }) => {
  try {
    const r = await sendEmail({ email, subject, ...courrier(titre, paragraphes) });
    return { envoye: true, simule: Boolean(r?.simule), erreur: "" };
  } catch (erreur) {
    console.warn(`⚠️  Courrier de modération non remis à ${email} : ${erreur.message}`);
    return { envoye: false, simule: false, erreur: erreur.message };
  }
};

// ── Avertissements ────────────────────────────────────────────────────────

/**
 * Ajoute un avertissement et applique le seuil.
 *
 * Renvoie l'état obtenu : combien d'avertissements actifs, si le profil vient
 * d'être masqué, et jusqu'à quand la personne peut régulariser.
 */
export const avertir = async ({ cible, motif, par, signalement }) => {
  cible.avertissements.push({
    motif,
    donnePar: par?._id || null,
    signalement: signalement?._id || null,
  });

  const actifs = cible.avertissementsActifs().length;
  let masqueMaintenant = false;

  if (actifs >= SEUIL_MASQUAGE && !cible.masqueLe) {
    cible.masqueLe = new Date();
    cible.regulariserAvant = new Date(
      Date.now() + DELAI_REGULARISATION_JOURS * 24 * 60 * 60 * 1000,
    );
    masqueMaintenant = true;

    // Le masquage est la conséquence du seuil, pas une mesure séparée : on
    // l'applique ici pour qu'il ne puisse pas être oublié.
    const profil = await Profil.findOne({ user: cible._id });
    if (profil) {
      profil.visibleRecruteurs = false;
      await profil.save();
    }
  }

  await cible.save({ validateBeforeSave: false });

  // ── Le courrier ────────────────────────────────────────────────────
  const restants = SEUIL_MASQUAGE - actifs;

  const paragraphes = [
    `Bonjour ${cible.prenom},`,
    `Un signalement concernant votre compte sur ${APP_NAME} a été examiné et jugé fondé. Un avertissement a été porté à votre dossier.`,
    `<strong>Ce qui est reproché :</strong><br>${motif}`,
  ];

  if (masqueMaintenant) {
    paragraphes.push(
      `Vous en êtes à ${actifs} avertissements. Votre profil n'est donc plus visible par les recruteurs.`,
      `<strong>Vous avez jusqu'au ${jour(cible.regulariserAvant)}</strong> pour nous contacter et régulariser votre situation. Passé ce délai, votre compte sera supprimé.`,
      `Cela n'a rien de définitif : vous pourrez recréer un compte avec la même adresse email, et repartir sur un dossier vierge.`,
    );
  } else {
    paragraphes.push(
      `Vous en êtes à ${actifs} avertissement${actifs > 1 ? "s" : ""}. À ${SEUIL_MASQUAGE}, votre profil cessera d'être visible par les recruteurs — il vous en reste donc ${restants}.`,
    );
  }

  paragraphes.push(
    `<strong>Si vous contestez cette décision</strong>, répondez à ce message en expliquant ce qui vous paraît inexact. Un administrateur réexaminera le dossier.`,
    `Vous pouvez consulter l'état de votre compte depuis votre espace : ${FRONT()}/espace`,
  );

  const courriel = await envoyer({
    email: cible.email,
    subject: masqueMaintenant
      ? `${APP_NAME} — votre profil n'est plus visible`
      : `${APP_NAME} — avertissement sur votre compte`,
    titre: masqueMaintenant
      ? "Votre profil n'est plus visible"
      : "Avertissement sur votre compte",
    paragraphes,
  });

  return {
    actifs,
    masqueMaintenant,
    regulariserAvant: cible.regulariserAvant,
    courriel,
  };
};

/**
 * Lève tous les avertissements actifs et rend le compte à son état normal.
 *
 * C'est le geste de la régularisation : quelqu'un a pris contact, s'est
 * expliqué, a corrigé. Les avertissements restent au dossier — on ne réécrit
 * pas l'histoire — mais cessent de compter.
 */
export const regulariser = async ({ cible, motif, par }) => {
  const maintenant = new Date();

  for (const a of cible.avertissements) {
    if (!a.leveLe) {
      a.leveLe = maintenant;
      a.leveMotif = motif;
    }
  }

  const etaitMasque = Boolean(cible.masqueLe);
  cible.masqueLe = null;
  cible.regulariserAvant = null;
  await cible.save({ validateBeforeSave: false });

  // ⚠️ On ne REND PAS le profil visible automatiquement. La visibilité est un
  // choix de la personne (voir ProfilModel) : la rétablir d'office déciderait
  // à sa place. On l'invite à le refaire.
  const courriel = await envoyer({
    email: cible.email,
    subject: `${APP_NAME} — votre compte est régularisé`,
    titre: "Votre compte est régularisé",
    paragraphes: [
      `Bonjour ${cible.prenom},`,
      `Votre situation a été régularisée${par ? "" : ""}. Les avertissements portés à votre dossier ne comptent plus.`,
      motif ? `<strong>Motif :</strong><br>${motif}` : "",
      etaitMasque
        ? `Votre profil peut à nouveau être rendu visible aux recruteurs : la case se trouve en bas de votre profil, section « Visibilité auprès des recruteurs ». Nous ne l'avons pas recochée à votre place — c'est votre choix.`
        : "",
      `Votre espace : ${FRONT()}/profil`,
    ].filter(Boolean),
  });

  return { courriel };
};

// ── Information du signalant ──────────────────────────────────────────────

/**
 * Informe le signalant du verdict.
 *
 * ⚠️ Le courrier dit si le signalement était FONDÉ ou NON, et pourquoi. Il ne
 * dit JAMAIS ce qui a été décidé sur la personne visée : ce serait faire du
 * signalement un moyen de savoir qui a été sanctionné.
 */
export const informerSignalant = async ({ signalement, fonde, decision }) => {
  const signalant = await User.findById(signalement.signalePar);
  if (!signalant) return { envoye: false, erreur: "Signalant introuvable." };

  const cible = `${signalement.ciblePrenom} ${signalement.cibleNom}`.trim();

  const courriel = await envoyer({
    email: signalant.email,
    subject: `${APP_NAME} — suite donnée à votre signalement`,
    titre: "Suite donnée à votre signalement",
    paragraphes: [
      `Bonjour ${signalant.prenom},`,
      `Vous avez signalé le compte de ${cible}. Le dossier a été examiné.`,
      fonde
        ? `<strong>Votre signalement a été jugé fondé.</strong> Les mesures appropriées ont été prises. Nous ne pouvons pas vous dire lesquelles : ce qui touche le compte d'une autre personne ne regarde qu'elle et nous.`
        : `<strong>Votre signalement n'a pas été retenu.</strong>`,
      `<strong>Motif de la décision :</strong><br>${decision}`,
      `<strong>Si vous n'êtes pas d'accord</strong>, vous pouvez demander un réexamen depuis vos signalements : ${FRONT()}/mes-signalements`,
      `Merci d'avoir pris le temps de signaler. C'est ce qui permet de garder la plateforme utilisable.`,
    ],
  });

  return courriel;
};

// ── Échéances ─────────────────────────────────────────────────────────────

/**
 * Supprime les comptes dont le délai de régularisation est écoulé.
 *
 * Appelée par `npm run moderation:echeances` (tâche planifiée) et depuis
 * l'écran de modération. Idempotente.
 *
 * ⚠️ La suppression est RÉELLE, et l'adresse email n'est pas bloquée : la
 * personne peut recréer un compte et repartir d'un dossier vierge. Bannir une
 * adresse à vie pour trois avertissements serait hors de proportion — et
 * inefficace, il suffit d'une autre adresse.
 */
export const traiterEcheances = async ({ simulation = false } = {}) => {
  const echus = await User.find({
    regulariserAvant: { $ne: null, $lte: new Date() },
    role: { $ne: "admin" },
  });

  const traites = [];

  for (const user of echus) {
    traites.push({
      email: user.email,
      nom: `${user.prenom} ${user.nom}`.trim(),
      echeance: user.regulariserAvant,
      avertissements: user.avertissementsActifs().length,
    });

    if (simulation) continue;

    // Dernier courrier AVANT la suppression : après, on n'a plus l'adresse.
    await envoyer({
      email: user.email,
      subject: `${APP_NAME} — suppression de votre compte`,
      titre: "Votre compte a été supprimé",
      paragraphes: [
        `Bonjour ${user.prenom},`,
        `Le délai qui vous était laissé pour régulariser votre situation est écoulé sans que nous ayons eu de vos nouvelles. Votre compte sur ${APP_NAME} a été supprimé, ainsi que votre profil et vos candidatures.`,
        `<strong>Vous pouvez recréer un compte avec cette même adresse email</strong>, dès maintenant, et repartir d'un dossier vierge : ${FRONT()}/inscription`,
        `Si vous pensez qu'il s'agit d'une erreur, écrivez-nous en répondant à ce message.`,
      ],
    });

    // Le profil part avec le compte : le laisser derrière créerait un profil
    // orphelin, visible nulle part mais toujours en base.
    await Profil.deleteOne({ user: user._id });
    await User.deleteOne({ _id: user._id });

    console.log(`🗑️  Compte supprimé pour non-régularisation : ${user.email}`);
  }

  return { total: traites.length, traites };
};

/**
 * Comptes sous le coup d'une échéance, pour l'écran de modération.
 * L'administrateur doit voir venir : un compte supprimé sans qu'on ait vu
 * l'échéance arriver est une occasion manquée de reprendre contact.
 */
export const echeancesAVenir = async () => {
  const users = await User.find(
    { regulariserAvant: { $ne: null } },
    "prenom nom email role masqueLe regulariserAvant avertissements",
  )
    .sort({ regulariserAvant: 1 })
    .lean();

  return users.map((u) => ({
    _id: u._id,
    nom: `${u.prenom} ${u.nom}`.trim(),
    email: u.email,
    role: u.role,
    masqueLe: u.masqueLe,
    regulariserAvant: u.regulariserAvant,
    avertissements: (u.avertissements || []).filter((a) => !a.leveLe).length,
    joursRestants: Math.ceil(
      (new Date(u.regulariserAvant) - Date.now()) / (24 * 60 * 60 * 1000),
    ),
  }));
};

/** Message libre envoyé par un administrateur à l'une des parties. */
export const contacter = async ({ destinataire, objet, message, par }) => {
  const courriel = await envoyer({
    email: destinataire.email,
    subject: `${APP_NAME} — ${objet}`,
    titre: objet,
    paragraphes: [
      `Bonjour ${destinataire.prenom},`,
      message,
      `Vous pouvez répondre directement à ce message.`,
    ],
  });

  return { ...courriel, par: par?.email || null };
};
