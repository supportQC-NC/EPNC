// backend/services/veilleService.js
//
// La veille : rapprocher les nouveautés des profils, prévenir, et mener aux
// pièces.
//
// ══════════════════════════════════════════════════════════════════════════
//  UNE ALERTE QUI S'ARRÊTE À « UN POSTE CORRESPOND » NE SERT À RIEN
// ══════════════════════════════════════════════════════════════════════════
// Le règlement le dit, et l'expérience aussi : prévenir quelqu'un qu'un poste
// existe, c'est déplacer le problème, pas le résoudre. La personne sait qu'il
// y a une offre, et se retrouve devant une page blanche.
//
// Chaque notification porte donc :
//   - le score ET son assiette (calculé sur combien de points de barème) ;
//   - les PREUVES : ce qui, dans l'annonce, répond à quoi, dans le parcours ;
//   - un lien qui mène directement à la préparation du dossier.
//
// C'est ce qui distingue une alerte utile d'une notification publicitaire —
// et un candidat qui reçoit trois fois du bruit classe l'expéditeur en
// indésirable, ce qui condamne toutes les alertes suivantes.

import Profil from "../models/ProfilModel.js";
import User from "../models/UserModel.js";
import Avp from "../models/AvpModel.js";
import { Veille, Notification } from "../models/VeilleModel.js";
import { RecruteurProfil, ListeCandidats } from "../models/RecruteurModel.js";
import { rapprocher } from "./matchingService.js";
import { profilDeRecherche, suggerer } from "./suggestionService.js";
import sendEmail from "../utils/sendEmail.js";
import { APP_NAME } from "../config/application.js";

// En dessous, un rapprochement ne veut rien dire : on ne prévient pas quelqu'un
// sur la foi d'un profil de trois lignes.
const COMPLETUDE_MINIMALE = 30;

// Nombre d'offres détaillées dans un courriel. Au-delà, on renvoie vers
// l'application : un courriel de quarante offres ne se lit pas.
const MAX_DETAIL = 5;

const FRONT = () => process.env.FRONTEND_URL || "http://localhost:3000";

const jour = (d) =>
  d
    ? new Date(d).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
      })
    : null;

/** Préférences de veille, créées au premier besoin. */
const veilleDe = async (userId) =>
  (await Veille.findOne({ user: userId })) ||
  (await Veille.create({ user: userId }));

// Les trois meilleures preuves d'un rapprochement.
//
// On prend celles des composantes APPLICABLES, en commençant par la plus
// lourde : une preuve tirée du référentiel métier vaut mieux qu'une
// correspondance d'intitulé.
const meilleuresPreuves = (rapprochement) => {
  const preuves = [];
  // Une même ligne du profil couvre souvent plusieurs attendus. Répéter
  // « → Accueil et relation au public » trois fois de suite dans une alerte
  // donne l'impression d'un rapprochement plus riche qu'il ne l'est.
  const dejaCitees = new Set();

  for (const c of rapprochement.composantes || []) {
    if (!c.applicable) continue;
    for (const e of c.evidences || []) {
      if (!e.attendu || !e.couvertPar) continue;
      if (dejaCitees.has(e.couvertPar)) continue;

      dejaCitees.add(e.couvertPar);
      preuves.push({ attendu: e.attendu, couvertPar: e.couvertPar });
      if (preuves.length === 3) return preuves;
    }
  }

  return preuves;
};

// ── Veille candidat : de nouvelles offres ─────────────────────────────────

/**
 * Rapproche des offres de tous les profils qui veillent, et crée les
 * notifications correspondantes.
 *
 * `avps` : les offres à examiner (typiquement celles qu'une ingestion vient de
 * créer). Ne renvoie AUCUN courriel — l'envoi est une étape séparée, pour que
 * l'ingestion ne dépende pas de la disponibilité du serveur de messagerie.
 */
export const veillerPourCandidats = async (avps) => {
  if (!avps?.length) return { examinees: 0, notifications: 0, candidats: 0 };

  // Seules les offres encore ouvertes : prévenir quelqu'un d'un poste dont les
  // candidatures sont closes est la faute la plus visible que puisse commettre
  // une veille.
  const ouvertes = avps.filter((a) =>
    a.estOuverte ? a.estOuverte() : !a.dateLimite || a.dateLimite >= new Date(),
  );

  if (!ouvertes.length) {
    return { examinees: 0, notifications: 0, candidats: 0 };
  }

  // ⚠️ ON PART DES PROFILS, PAS DES PRÉFÉRENCES DE VEILLE.
  //
  // Première version, on listait les documents `Veille` actifs — et la veille
  // ne trouvait personne. Ces documents ne sont créés qu'à la première visite
  // de l'écran des alertes : un compte neuf, celui qui a justement le plus
  // besoin d'être prévenu, n'en avait aucun.
  //
  // La veille est active par défaut (voir VeilleModel) : elle s'applique donc
  // à tout le monde, sauf à ceux qui l'ont explicitement désactivée.
  const profils = await Profil.find({}).populate(
    "user",
    "prenom nom email role isActive masqueLe",
  );

  const parUser = new Map(
    (await Veille.find({}).lean()).map((v) => [String(v.user), v]),
  );

  let notifications = 0;
  let candidats = 0;

  for (const profil of profils) {
    const user = profil.user;

    // Un compte désactivé ou sous le coup d'une mesure ne reçoit pas
    // d'alertes : lui proposer des postes pendant que son profil est masqué
    // serait incohérent.
    if (!user || !user.isActive || user.masqueLe) continue;
    if (user.role !== "candidat") continue;
    if (profil.completude() < COMPLETUDE_MINIMALE) continue;

    // Préférences existantes, ou le défaut du modèle. On ne CRÉE pas le
    // document ici : une veille qui écrirait un document par profil à chaque
    // passage ferait grossir la base sans rien apporter.
    const veille = parUser.get(String(user._id));
    if (veille && !veille.actif) continue;

    const scoreMinimal = veille?.scoreMinimal ?? 45;
    let nouvelles = 0;

    for (const avp of ouvertes) {
      // Déjà signalée ? L'index unique le refuserait, mais une vérification
      // explicite évite de calculer un rapprochement pour rien.
      const deja = await Notification.exists({
        user: user._id,
        avpSlug: avp.slug,
      });
      if (deja) continue;

      const r = await rapprocher(profil, avp);

      // On ne prévient ni sur un profil écarté (contrainte dure), ni sur un
      // score non publiable (offre trop pauvre pour être jugée).
      if (r.ecarte || r.score === null) continue;
      if (r.score < scoreMinimal) continue;

      await Notification.create({
        user: user._id,
        type: "offre",
        avpSlug: avp.slug,
        avpIntitule: avp.intitule,
        employeur: avp.employeur?.nom || null,
        lieu: avp.lieu,
        dateLimite: avp.dateLimite,
        score: r.score,
        fiabilite: r.fiabilite,
        verdict: r.verdict?.texte || "",
        preuves: meilleuresPreuves(r),
      });

      notifications += 1;
      nouvelles += 1;
    }

    if (nouvelles > 0) candidats += 1;

    if (veille) {
      await Veille.updateOne(
        { user: user._id },
        { derniereVerification: new Date() },
      );
    }
  }

  return { examinees: ouvertes.length, notifications, candidats };
};

// ── Veille recruteur : de nouveaux profils ────────────────────────────────

/**
 * Signale aux recruteurs les profils récemment devenus visibles qui
 * correspondent à ce qu'ils cherchent.
 *
 * Le classement est celui des suggestions — même service, mêmes règles. Deux
 * logiques de rapprochement auraient fini par se contredire entre l'écran et
 * l'alerte.
 */
export const veillerPourRecruteurs = async ({ depuis = null } = {}) => {
  const filtre = { visibleRecruteurs: true };

  // Par défaut, les profils mis à jour dans les sept derniers jours : sans
  // borne, la première exécution signalerait tout le vivier à tout le monde.
  filtre.updatedAt = {
    $gte: depuis || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  };

  const nouveaux = await Profil.find(filtre).populate(
    "user",
    "prenom nom isActive",
  );

  if (!nouveaux.length) return { examines: 0, notifications: 0, recruteurs: 0 };

  const candidats = nouveaux
    .filter((p) => p.user?.isActive !== false && p.completude() >= COMPLETUDE_MINIMALE)
    .map((p) => ({
      id: p._id,
      prenom: p.user?.prenom || "",
      nom: p.user?.nom || "",
      titre: p.basics?.titre || "",
      ville: p.basics?.ville || "",
      competences: (p.competences || []).map((c) => ({
        nom: c.nom,
        niveau: c.niveau,
      })),
    }));

  // Ici aussi : on part des profils RECRUTEUR, pas des documents de veille.
  const profilsRecruteurs = await RecruteurProfil.find({}).populate(
    "user",
    "prenom nom email role isActive",
  );

  const parUser = new Map(
    (await Veille.find({}).lean()).map((v) => [String(v.user), v]),
  );

  let notifications = 0;
  let recruteurs = 0;

  for (const recruteur of profilsRecruteurs) {
    const user = recruteur.user;
    if (!user || !user.isActive) continue;
    if (!["recruteur", "admin"].includes(user.role)) continue;

    const v = parUser.get(String(user._id));
    if (v && !v.actif) continue;

    const listes = await ListeCandidats.find({ user: user._id }).populate({
      path: "entrees.profil",
      select: "competences",
    });

    const recherche = profilDeRecherche(recruteur, listes);
    if (!recherche.exploitable) continue;

    const dejaEnregistres = new Set(
      listes.flatMap((l) =>
        l.entrees.map((e) => String(e.profil?._id || e.profil)),
      ),
    );

    const suggestions = suggerer(candidats, recherche, dejaEnregistres);
    let nouvelles = 0;

    for (const s of suggestions) {
      if (s.score < (v?.scoreMinimal ?? 45)) continue;

      const deja = await Notification.exists({
        user: user._id,
        profilId: s.candidat.id,
      });
      if (deja) continue;

      await Notification.create({
        user: user._id,
        type: "profil",
        profilId: s.candidat.id,
        profilNom: `${s.candidat.prenom} ${s.candidat.nom}`.trim(),
        profilTitre: s.candidat.titre,
        lieu: s.candidat.ville,
        score: s.score,
        verdict: `${s.nbCommunes} compétence${s.nbCommunes > 1 ? "s" : ""} correspondent à vos critères.`,
        preuves: s.communes.slice(0, 3).map((c) => ({
          attendu: c.recherchee,
          couvertPar: c.declaree,
        })),
      });

      notifications += 1;
      nouvelles += 1;
    }

    if (nouvelles > 0) recruteurs += 1;
  }

  return { examines: candidats.length, notifications, recruteurs };
};

// ── Envoi des courriels ───────────────────────────────────────────────────

// Le corps d'une alerte candidat.
//
// ⚠️ Chaque offre porte son lien de PRÉPARATION, pas un lien de consultation.
// C'est toute la différence : « voir l'offre » laisse la personne devant une
// annonce, « préparer mon dossier » l'amène aux quatre pièces.
const corpsOffres = (user, notifications) => {
  const detaillees = notifications.slice(0, MAX_DETAIL);
  const reste = notifications.length - detaillees.length;

  const blocs = detaillees.map((n) => {
    const preuves = n.preuves
      .map((p) => `• ${p.attendu} → ${p.couvertPar}`)
      .join("<br>");

    return [
      `<strong>${n.avpIntitule}</strong>`,
      [n.employeur, n.lieu].filter(Boolean).join(" · "),
      `Correspondance : <strong>${n.score}/100</strong>${n.fiabilite < 100 ? ` (calculé sur ${n.fiabilite} points de barème)` : ""}`,
      preuves ? `Ce qui correspond :<br>${preuves}` : "",
      n.dateLimite ? `Candidatures jusqu'au ${jour(n.dateLimite)}` : "",
      `➜ <a href="${FRONT()}/offres/${n.avpSlug}">Préparer mon dossier pour ce poste</a>`,
    ]
      .filter(Boolean)
      .join("<br>");
  });

  return [
    `Bonjour ${user.prenom},`,
    notifications.length === 1
      ? `Un poste vient d'être publié et correspond à votre profil.`
      : `${notifications.length} postes viennent d'être publiés et correspondent à votre profil.`,
    ...blocs,
    reste > 0
      ? `Et ${reste} autre${reste > 1 ? "s" : ""} — voir dans votre espace : ${FRONT()}/alertes`
      : "",
    `Chaque correspondance est justifiée : vous voyez ce qui, dans l'annonce, répond à quoi dans votre parcours. Si une alerte vous paraît hors sujet, remontez le seuil depuis vos préférences : ${FRONT()}/alertes`,
  ].filter(Boolean);
};

const corpsProfils = (user, notifications) => {
  const blocs = notifications.slice(0, MAX_DETAIL).map((n) => {
    const preuves = n.preuves
      .map((p) => `• ${p.couvertPar}`)
      .join("<br>");

    return [
      `<strong>${n.profilNom}</strong>${n.profilTitre ? ` — ${n.profilTitre}` : ""}`,
      n.lieu || "",
      `Correspondance : <strong>${n.score}/100</strong>`,
      preuves ? `Compétences qui correspondent :<br>${preuves}` : "",
      `➜ <a href="${FRONT()}/vivier/${n.profilId}">Voir le parcours</a>`,
    ]
      .filter(Boolean)
      .join("<br>");
  });

  return [
    `Bonjour ${user.prenom},`,
    notifications.length === 1
      ? `Un profil correspondant à vos critères vient d'être publié dans le vivier.`
      : `${notifications.length} profils correspondant à vos critères viennent d'être publiés dans le vivier.`,
    ...blocs,
    `Vos critères et le classement : ${FRONT()}/recruteur/suggestions`,
  ];
};

/**
 * Envoie les notifications non encore expédiées, groupées par personne.
 *
 * ⚠️ Un courriel par PERSONNE et par lot, jamais par notification. Une synchro
 * qui ajoute quarante offres ne doit pas produire quarante courriels — c'est
 * le meilleur moyen d'être classé en indésirable.
 */
export const envoyerAlertes = async ({ frequences = ["immediat"] } = {}) => {
  const enAttente = await Notification.find({ envoyeLe: null }).lean();
  if (!enAttente.length) return { destinataires: 0, envoyes: 0, echecs: 0 };

  // Regroupement par personne.
  const parUser = new Map();
  for (const n of enAttente) {
    const cle = String(n.user);
    if (!parUser.has(cle)) parUser.set(cle, []);
    parUser.get(cle).push(n);
  }

  let envoyes = 0;
  let echecs = 0;
  let destinataires = 0;

  for (const [userId, notifications] of parUser) {
    const veille = await Veille.findOne({ user: userId });

    // `frequences` permet au script quotidien de ne traiter que les personnes
    // qui ont demandé un récapitulatif, sans toucher aux alertes immédiates
    // déjà parties.
    if (!veille?.parEmail || !frequences.includes(veille.frequence)) continue;

    const user = await User.findById(userId);
    if (!user || !user.isActive) continue;

    destinataires += 1;

    const offres = notifications.filter((n) => n.type === "offre");
    const profils = notifications.filter((n) => n.type === "profil");

    const paragraphes =
      offres.length > 0 ? corpsOffres(user, offres) : corpsProfils(user, profils);

    const sujet =
      offres.length > 0
        ? offres.length === 1
          ? `${APP_NAME} — un poste correspond à votre profil`
          : `${APP_NAME} — ${offres.length} postes correspondent à votre profil`
        : `${APP_NAME} — ${profils.length} profil${profils.length > 1 ? "s" : ""} pour vos recrutements`;

    try {
      await sendEmail({
        email: user.email,
        subject: sujet,
        text: paragraphes.join("\n\n").replace(/<[^>]+>/g, ""),
        html: paragraphes
          .map(
            (p) =>
              `<p style="font:14px/1.6 system-ui,sans-serif;color:#222">${p}</p>`,
          )
          .join(""),
      });

      await Notification.updateMany(
        { _id: { $in: notifications.map((n) => n._id) } },
        { envoyeLe: new Date() },
      );
      await Veille.updateOne({ user: userId }, { dernierEnvoi: new Date() });

      envoyes += 1;
    } catch (erreur) {
      // Un échec d'envoi ne doit pas marquer les notifications comme
      // expédiées : elles repartiront au prochain passage. Elles restent
      // visibles dans l'application entre-temps.
      console.warn(`⚠️  Alerte non remise à ${user.email} : ${erreur.message}`);
      echecs += 1;
    }
  }

  return { destinataires, envoyes, echecs };
};

/**
 * Un tour complet : rapprocher, puis envoyer.
 * `avps` absent → on examine les offres ouvertes récemment publiées.
 */
export const tourDeVeille = async ({ avps = null, frequences } = {}) => {
  const offres =
    avps ||
    (await Avp.find({
      $or: [{ dateLimite: null }, { dateLimite: { $gte: new Date() } }],
    }));

  const candidats = await veillerPourCandidats(offres);
  const recruteurs = await veillerPourRecruteurs({});
  const envois = await envoyerAlertes(frequences ? { frequences } : {});

  return { candidats, recruteurs, envois };
};
