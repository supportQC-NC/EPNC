// backend/services/matchingService.js
//
// Rapprochement entre un profil et un avis de vacance de poste.
//
// PRINCIPE DIRECTEUR : chaque point du score doit pouvoir être justifié en
// désignant ce qui, dans le profil, répond à quoi, dans l'attendu. Un score
// sans justification ne vaut rien — ni pour le candidat, qui ne sait pas quoi
// en faire, ni pour un jury, qui ne peut pas le vérifier.
//
// Le pivot est le RÉFÉRENTIEL MÉTIERS de l'OPT-NC : l'offre pointe vers un code
// métier, le métier porte ses compétences attendues avec un poids et un niveau
// requis. On raisonne donc dans un vocabulaire public et opposable, pas dans
// une similarité opaque.

import { Metier } from "../models/MetierModel.js";

// ── Barème ────────────────────────────────────────────────────────────────
// Les compétences du référentiel pèsent le plus : ce sont les seules qui
// soient pondérées et hiérarchisées par l'employeur lui-même.
const BAREME = {
  referentiel: 45,
  attendusOffre: 25,
  experience: 15,
  affinite: 15,
};

// Niveaux déclarés dans un profil, convertis sur l'échelle du référentiel.
const NIVEAUX = { notions: 1, pratique: 2, maitrise: 3, expert: 4 };

// Mots trop courants pour porter du sens dans un rapprochement. Sans cette
// liste, « gestion des données » et « gestion des stocks » se ressemblent.
const MOTS_VIDES = new Set([
  "dans", "avec", "pour", "leur", "leurs", "cette", "celui", "elles",
  "etre", "avoir", "faire", "selon", "entre", "chaque", "autre", "autres",
  "plus", "moins", "tous", "toute", "toutes", "entreprise", "service",
  "services", "travail", "poste", "mission", "missions", "capacite",
  "connaissance", "connaissances", "maitrise", "niveau",
  "notions", "matiere", "techniques", "technique", "outils", "outil",
  "domaine", "domaines", "general", "generale", "divers", "varies",
]);

// Normalisation : minuscules, sans accents, sans ponctuation. Indispensable —
// « Maîtrise » et « maitrise » désignent la même chose, et le référentiel comme
// les fiches de poste mélangent les deux graphies.
const normaliser = (texte) =>
  (texte || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const motsUtiles = (texte) =>
  new Set(
    normaliser(texte)
      .split(" ")
      .filter((m) => m.length > 3 && !MOTS_VIDES.has(m)),
  );

// Mesure ASYMÉTRIQUE : quelle part de l'attendu se retrouve dans le profil ?
//
// La bonne question n'est pas « ces deux textes se ressemblent-ils » mais
// « l'attendu est-il couvert ». Un indice de Jaccard classique divisait par
// l'union des mots : une expérience décrite en trois lignes, forcément riche
// en vocabulaire, faisait chuter le score alors qu'elle couvrait l'attendu.
// « Rédaction de procédures et de notes juridiques » face à « Techniques de
// rédaction claire, structurée et opérationnelle (notes, avis, procédures) »
// tombait sous le seuil — trois mots en commun noyés dans l'union.
const couvrance = (attendu, source) => {
  const na = normaliser(attendu);
  const nb = normaliser(source);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (nb.includes(na) || na.includes(nb)) return 0.9;

  const ma = motsUtiles(attendu);
  const mb = motsUtiles(source);
  if (ma.size === 0 || mb.size === 0) return 0;

  let communs = 0;
  for (const m of ma) if (mb.has(m)) communs++;

  return communs / ma.size;
};

// Proximité symétrique, pour comparer deux libellés de même nature (deux
// intitulés de métier, deux noms de famille). Là, l'union a du sens.
const proximite = (a, b) => {
  const na = normaliser(a);
  const nb = normaliser(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.9;

  const ma = motsUtiles(a);
  const mb = motsUtiles(b);
  if (ma.size === 0 || mb.size === 0) return 0;

  let communs = 0;
  for (const m of ma) if (mb.has(m)) communs++;
  if (communs === 0) return 0;

  return communs / new Set([...ma, ...mb]).size;
};

// Seuil de reconnaissance. En deçà, on considère qu'il n'y a pas de
// recouvrement : mieux vaut un écart signalé à tort qu'un point accordé à tort,
// car c'est le faux positif qui décrédibilise le score.
const SEUIL_PROXIMITE = 0.34;

// Cherche dans le profil ce qui répond le mieux à un attendu.
// Renvoie la meilleure correspondance et sa force, ou null.
const chercherDansProfil = (attendu, sources) => {
  let meilleur = null;

  for (const source of sources) {
    const force = couvrance(attendu, source.libelle);
    if (force >= SEUIL_PROXIMITE && (!meilleur || force > meilleur.force)) {
      meilleur = { ...source, force };
    }
  }

  return meilleur;
};

// Tout ce que le profil peut opposer à un attendu, avec son origine — c'est
// l'origine qui sera citée dans la justification.
const sourcesDuProfil = (profil) => [
  ...(profil.competences || []).map((c) => ({
    libelle: c.nom,
    origine: "compétence déclarée",
    niveau: NIVEAUX[c.niveau] || 2,
  })),
  ...(profil.experiences || []).map((e) => ({
    libelle: `${e.poste || ""} ${e.description || ""}`.trim(),
    // Pour la citation, on préfère l'intitulé seul : la description entière
    // serait illisible dans une justification.
    citation: e.poste || "Expérience professionnelle",
    origine: "expérience",
    niveau: 3,
  })),
  ...(profil.formations || []).map((f) => ({
    libelle: `${f.intitule || ""} ${f.niveau || ""}`.trim(),
    citation: f.intitule || "Formation",
    origine: "formation",
    niveau: 3,
  })),
];

// ── Filtres bloquants ────────────────────────────────────────────────────
//
// Ils EXCLUENT, ils ne pénalisent pas. C'est la seule façon de tenir l'absence
// de faux positifs : quelqu'un qui ne peut pas occuper le poste ne doit pas
// apparaître à 62 %, il ne doit pas apparaître du tout — avec la raison.
const filtresBloquants = (profil, avp) => {
  const motifs = [];

  if (!avp.estOuverte?.() && avp.dateLimite && avp.dateLimite < new Date()) {
    motifs.push("Les candidatures sont closes pour ce poste.");
  }

  // Permis exigés, lus dans le champ `qualifications` de la fiche.
  //
  // ⚠️ La détection se fait sur le texte D'ORIGINE, en exigeant des MAJUSCULES.
  // Première version, elle travaillait sur le texte normalisé en minuscules :
  // « Permis B, A2 + aptitude à la conduite d'un deux roues » faisait
  // apparaître un permis « A » (dans « à la ») et un permis « D » (dans
  // « d'un »), et le candidat se voyait écarté pour des permis qui n'étaient
  // pas demandés. Les codes de permis sont toujours en capitales ; les mots
  // français qui les imitent ne le sont jamais.
  const brut = avp.qualifications || "";

  if (/permis/i.test(brut)) {
    // On ne lit que le segment qui suit « permis », jusqu'à une ponctuation
    // forte : au-delà, la phrase parle d'autre chose.
    const segment = brut.slice(brut.search(/permis/i)).split(/[.;]/)[0];

    const requis = [
      ...new Set(
        (segment.match(/\b([A-E][0-9]?)\b/g) || []).map((p) => p.toUpperCase()),
      ),
    ];

    const detenus = (profil.basics?.permis || []).map((p) =>
      p.toUpperCase().trim(),
    );

    const manquants = requis.filter((p) => !detenus.includes(p));

    if (manquants.length > 0) {
      motifs.push(
        `Permis ${manquants.join(" et ")} exigé${manquants.length > 1 ? "s" : ""} — absent de votre profil.`,
      );
    }
  }

  return motifs;
};

// ── Les quatre composantes ───────────────────────────────────────────────

// 1. Compétences du référentiel métier, pondérées par l'employeur.
const composanteReferentiel = (profil, metier, sources) => {
  if (!metier || !metier.competences?.length) {
    return {
      cle: "referentiel",
      libelle: "Compétences du référentiel métier",
      points: 0,
      maximum: BAREME.referentiel,
      applicable: false,
      note: "Cette offre n'est rattachée à aucun métier du référentiel.",
      evidences: [],
      manques: [],
    };
  }

  const poidsTotal = metier.competences.reduce(
    (t, c) => t + (c.poids || 1),
    0,
  );
  let acquis = 0;
  const evidences = [];
  const manques = [];

  for (const attendue of metier.competences) {
    const poids = attendue.poids || 1;
    const trouve = chercherDansProfil(attendue.nom, sources);

    if (!trouve) {
      manques.push({
        attendu: attendue.nom,
        niveauRequis: attendue.niveauRequis,
      });
      continue;
    }

    // Le niveau compte : détenir une compétence attendue au niveau 4 quand on
    // la déclare au niveau 2 ne vaut pas la totalité des points. La moitié est
    // acquise par la détention, l'autre par le niveau.
    const requis = attendue.niveauRequis || 1;
    const ratioNiveau = Math.min(1, (trouve.niveau || 2) / requis);
    const part = poids * (0.5 + 0.5 * ratioNiveau);

    acquis += part;

    evidences.push({
      attendu: attendue.nom,
      niveauRequis: attendue.niveauRequis,
      couvertPar: trouve.citation || trouve.libelle,
      origine: trouve.origine,
      niveauDeclare: trouve.niveau,
      suffisant: (trouve.niveau || 2) >= requis,
    });
  }

  // Calibrage : couvrir 60 % des attendus pondérés vaut la note maximale.
  //
  // Le référentiel décrit TOUT ce qu'un métier mobilise — vingt-deux
  // compétences pour un chargé d'études. Aucun candidat réel ne les détient
  // toutes, et exiger 100 % ferait plafonner tout le monde autour de 20/45 :
  // un barème où personne ne peut réussir ne hiérarchise plus rien. Couvrir
  // six attendus pondérés sur dix, c'est déjà être largement dans la cible.
  const CIBLE = 0.6;
  const couverture = acquis / poidsTotal;

  return {
    cle: "referentiel",
    libelle: "Compétences du référentiel métier",
    points: Math.round(
      Math.min(1, couverture / CIBLE) * BAREME.referentiel,
    ),
    maximum: BAREME.referentiel,
    applicable: true,
    couverture: Math.round(couverture * 100),
    note: `${evidences.length} compétence${evidences.length > 1 ? "s" : ""} sur ${metier.competences.length} attendue${metier.competences.length > 1 ? "s" : ""} pour le métier « ${metier.nom} ».`,
    evidences,
    // On ne montre que les manques les plus lourds : les lister tous noierait
    // l'essentiel.
    manques: manques.slice(0, 8),
  };
};

// 2. Attendus écrits dans la fiche de poste elle-même.
const composanteAttendus = (avp, sources) => {
  const attendus = [
    ...(avp.competencesAttendues || []),
    ...(avp.savoirFaire || []),
  ];

  if (!attendus.length) {
    return {
      cle: "attendusOffre",
      libelle: "Attendus de la fiche de poste",
      points: 0,
      maximum: BAREME.attendusOffre,
      applicable: false,
      note: "La fiche ne liste aucun attendu explicite.",
      evidences: [],
      manques: [],
    };
  }

  const evidences = [];
  const manques = [];

  for (const attendu of attendus) {
    const trouve = chercherDansProfil(attendu, sources);
    if (trouve) {
      evidences.push({
        attendu,
        couvertPar: trouve.citation || trouve.libelle,
        origine: trouve.origine,
      });
    } else {
      manques.push({ attendu });
    }
  }

  // Même calibrage que pour le référentiel, pour la même raison. Une fiche de
  // poste liste volontiers quatorze attendus, dont plusieurs relèvent du
  // savoir-être (« autonomie », « rigueur », « sens du service public ») que
  // personne ne déclare comme compétence. Couvrir la moitié des attendus
  // explicites, c'est déjà répondre solidement à l'annonce.
  const CIBLE = 0.5;
  const couverture = evidences.length / attendus.length;

  return {
    cle: "attendusOffre",
    libelle: "Attendus de la fiche de poste",
    points: Math.round(
      Math.min(1, couverture / CIBLE) * BAREME.attendusOffre,
    ),
    maximum: BAREME.attendusOffre,
    applicable: true,
    couverture: Math.round(couverture * 100),
    note: `${evidences.length} attendu${evidences.length > 1 ? "s" : ""} couvert${evidences.length > 1 ? "s" : ""} sur ${attendus.length}.`,
    evidences,
    manques: manques.slice(0, 8),
  };
};

// 3. Expérience : volume et proximité avec l'intitulé du poste.
const composanteExperience = (profil, avp) => {
  const experiences = profil.experiences || [];
  const evidences = [];

  if (!experiences.length) {
    return {
      cle: "experience",
      libelle: "Expérience professionnelle",
      points: 0,
      maximum: BAREME.experience,
      applicable: true,
      note: "Aucune expérience renseignée dans votre profil.",
      evidences: [],
      manques: [{ attendu: avp.experienceRequise || "Expérience professionnelle" }],
    };
  }

  // Deux expériences suffisent à saturer la part « volume » : au-delà, c'est
  // la pertinence qui compte, pas l'accumulation.
  const volume = Math.min(1, experiences.length / 2) * (BAREME.experience * 0.4);

  let meilleure = 0;
  for (const e of experiences) {
    const p = Math.max(
      proximite(avp.intitule, e.poste || ""),
      proximite(avp.metier?.nom || "", e.poste || ""),
    );
    if (p > meilleure) {
      meilleure = p;
      if (p >= SEUIL_PROXIMITE) {
        evidences.length = 0;
        evidences.push({
          attendu: `Poste visé : ${avp.intitule}`,
          couvertPar: e.poste,
          origine: "expérience",
        });
      }
    }
  }

  const pertinence = meilleure * (BAREME.experience * 0.6);

  return {
    cle: "experience",
    libelle: "Expérience professionnelle",
    points: Math.round(volume + pertinence),
    maximum: BAREME.experience,
    applicable: true,
    note:
      meilleure >= SEUIL_PROXIMITE
        ? "Une de vos expériences est proche de l'intitulé du poste."
        : `${experiences.length} expérience${experiences.length > 1 ? "s" : ""}, aucune directement comparable à ce poste.`,
    evidences,
    manques: [],
  };
};

// 4. Affinité : le poste correspond-il à ce que la personne CHERCHE ?
//
// Sans cette composante, on propose des postes techniquement justes et sans
// intérêt pour la personne — ce qui est la façon la plus sûre de la faire
// renoncer à l'outil.
const composanteAffinite = (profil, avp) => {
  const evidences = [];
  let points = 0;
  let maximum = 0;

  const familles = profil.aspirations?.famillesVisees || [];
  const projet = profil.aspirations?.projet || "";

  // Chaque moitié n'entre dans le barème QUE si la personne a fourni la
  // donnée correspondante. Compter sur 15 points une famille visée qu'on n'a
  // jamais demandée reviendrait à sanctionner un champ vide — et à faire
  // plafonner tout le monde à deux tiers du score.
  if (familles.length > 0) {
    maximum += BAREME.affinite / 2;

    const famillesOffre = avp.familles || [];
    const familleVisee = familles.find((f) =>
      famillesOffre.some((fo) => proximite(f, fo) > 0.6),
    );

    if (familleVisee) {
      points += BAREME.affinite / 2;
      evidences.push({
        attendu: `Famille de métiers : ${famillesOffre.join(", ")}`,
        couvertPar: familleVisee,
        origine: "famille visée",
      });
    }
  }

  if (projet) {
    maximum += BAREME.affinite / 2;

    // Couvrance asymétrique : on demande si l'objet du poste se retrouve dans
    // le projet, pas si les deux textes se ressemblent — le projet est
    // toujours bien plus long qu'un intitulé.
    const p = Math.max(
      couvrance(avp.intitule, projet),
      couvrance(avp.metier?.nom || "", projet),
    );

    if (p >= SEUIL_PROXIMITE) {
      points += BAREME.affinite / 2;
      evidences.push({
        attendu: "Votre projet professionnel",
        couvertPar: "recoupe l'objet de ce poste",
        origine: "projet",
      });
    }
  }

  return {
    cle: "affinite",
    libelle: "Correspondance avec votre projet",
    points: Math.round(points),
    maximum: Math.round(maximum),
    applicable: maximum > 0,
    note:
      maximum === 0
        ? "Vous n'avez pas indiqué ce que vous cherchez : cette composante est neutralisée. Renseignez la section « Ce que vous cherchez » pour qu'elle compte."
        : evidences.length
          ? "Ce poste rejoint ce que vous cherchez."
          : "Rien dans ce que vous avez déclaré chercher ne pointe vers ce poste.",
    evidences,
    manques: [],
  };
};

// Verdict lisible. Les seuils sont assumés et affichés : un score nu ne dit
// pas s'il faut candidater.
const verdict = (score) => {
  if (score >= 70)
    return { niveau: "solide", texte: "Votre profil répond à l'essentiel des attendus." };
  if (score >= 45)
    return {
      niveau: "jouable",
      texte: "Candidature défendable, à condition d'assumer les écarts.",
    };
  return {
    niveau: "eloigne",
    texte: "Ce poste est loin de votre profil actuel.",
  };
};

/**
 * Compare un profil à un MÉTIER du référentiel, indépendamment de toute offre.
 *
 * C'est la contrepartie du rapprochement offre par offre, et elle est au moins
 * aussi utile : le corpus ne compte qu'une poignée de postes ouverts à un
 * instant donné, alors que le référentiel en décrit quatre-vingts. Quelqu'un
 * peut donc viser un métier des mois avant qu'un poste s'ouvre, et savoir
 * exactement ce qu'il lui reste à acquérir.
 */
export const analyserMetier = (profil, metier) => {
  const sources = sourcesDuProfil(profil);
  const attendues = metier.competences || [];

  const acquises = [];
  const aAcquerir = [];
  let poidsTotal = 0;
  let poidsAcquis = 0;

  for (const c of attendues) {
    const poids = c.poids || 1;
    poidsTotal += poids;

    const trouve = chercherDansProfil(c.nom, sources);
    const requis = c.niveauRequis || 1;

    if (!trouve) {
      aAcquerir.push({
        nom: c.nom,
        poids,
        niveauRequis: requis,
        // Ce qui pèse le plus est ce par quoi commencer : on le dit.
        priorite: poids >= 3 ? "forte" : poids >= 2 ? "moyenne" : "faible",
      });
      continue;
    }

    const niveau = trouve.niveau || 2;
    poidsAcquis += poids * (0.5 + 0.5 * Math.min(1, niveau / requis));

    acquises.push({
      nom: c.nom,
      poids,
      niveauRequis: requis,
      niveauDeclare: niveau,
      suffisant: niveau >= requis,
      couvertPar: trouve.citation || trouve.libelle,
      origine: trouve.origine,
    });
  }

  // Les manques sont triés par poids : la liste se lit comme un plan de
  // progression, pas comme un inventaire.
  aAcquerir.sort((a, b) => b.poids - a.poids);

  return {
    couverture: poidsTotal > 0 ? Math.round((poidsAcquis / poidsTotal) * 100) : 0,
    nbAttendues: attendues.length,
    acquises,
    aAcquerir,
    // Compétences à renforcer : détenues, mais sous le niveau requis.
    aRenforcer: acquises.filter((c) => !c.suffisant),
  };
};

/**
 * Rapproche un profil d'une offre.
 * `metiers` : index optionnel (Map code → métier) pour éviter une requête par
 * offre lorsqu'on en traite plusieurs.
 */
export const rapprocher = async (profil, avp, metiers = null) => {
  const codeMetier = avp.metier?.code;
  const metier = codeMetier
    ? metiers
      ? metiers.get(codeMetier)
      : await Metier.findOne({ code: codeMetier }).lean()
    : null;

  const motifsExclusion = filtresBloquants(profil, avp);
  const sources = sourcesDuProfil(profil);

  // Cohérence du rattachement métier.
  //
  // L'offre porte un code métier ET un libellé. Sur le corpus réel, les deux
  // divergent parfois : une fiche « Chargé d'études protection des données »
  // annonce « Chargé d'études juridiques » mais son code OP007 renvoie, au
  // référentiel, à « Chargé d'études marketing ». Noter un profil juridique
  // sur des compétences marketing produirait un score absurde — et
  // inexplicable, ce qui est pire.
  //
  // On ne corrige pas la donnée de l'employeur : on constate l'incohérence,
  // on neutralise la composante concernée, et on le dit. Le score se calcule
  // alors sur les composantes restantes.
  // Deux signaux doivent concorder pour conclure à une incohérence — un seul
  // suffirait à neutraliser des rattachements parfaitement valides.
  //   1. les intitulés divergent (« Chargé d'études juridiques » / « … marketing ») ;
  //   2. la FAMILLE du métier au référentiel n'est pas parmi celles de l'offre.
  // Le second est le plus solide : « Coordonateur » et « Chargé » de
  // l'exploitation commerciale ont des intitulés différents mais la même
  // famille — c'est le même métier, renommé.
  const nomOffre = avp.metier?.nom;

  const intitulesDivergent =
    Boolean(metier && nomOffre) && proximite(nomOffre, metier.nom) < 0.6;

  const familleDiverge =
    Boolean(metier?.familleCode) &&
    (avp.familles || []).length > 0 &&
    !(avp.familles || []).some(
      (f) => proximite(f, metier.familleCode.replace(/_/g, " ")) >= 0.5,
    );

  const rattachementIncoherent = intitulesDivergent && familleDiverge;

  const composanteRef = rattachementIncoherent
    ? {
        cle: "referentiel",
        libelle: "Compétences du référentiel métier",
        points: 0,
        maximum: BAREME.referentiel,
        applicable: false,
        note: `Rattachement incohérent : l'offre annonce le métier « ${nomOffre} », mais son code ${metier.code} correspond à « ${metier.nom} » au référentiel. Les compétences attendues n'étant pas fiables ici, cette composante est neutralisée.`,
        evidences: [],
        manques: [],
      }
    : composanteReferentiel(profil, metier, sources);

  const composantes = [
    composanteRef,
    composanteAttendus(avp, sources),
    composanteExperience(profil, avp),
    composanteAffinite(profil, avp),
  ];

  // Le score est ramené sur les composantes APPLICABLES : une offre sans
  // métier rattaché ne doit pas être pénalisée pour une donnée manquante côté
  // employeur.
  const applicables = composantes.filter((c) => c.applicable);
  const obtenus = applicables.reduce((t, c) => t + c.points, 0);
  const possibles = applicables.reduce((t, c) => t + c.maximum, 0);
  const score = possibles > 0 ? Math.round((obtenus / possibles) * 100) : 0;

  return {
    avpSlug: avp.slug,
    avpIntitule: avp.intitule,
    avpDirection: avp.direction,
    avpLieu: avp.lieu,
    dateLimite: avp.dateLimite,
    ouverte: avp.estOuverte ? avp.estOuverte() : true,
    metier: metier ? { code: metier.code, nom: metier.nom } : null,
    rattachementIncoherent,

    ecarte: motifsExclusion.length > 0,
    motifsExclusion,

    score: motifsExclusion.length > 0 ? null : score,
    verdict: motifsExclusion.length > 0 ? null : verdict(score),
    composantes,
  };
};

/**
 * Rapproche un profil de plusieurs offres, du meilleur score au moins bon.
 * Les offres écartées sont renvoyées à part, avec leur motif : le règlement
 * demande d'expliquer pourquoi un rapprochement a été ÉCARTÉ, pas seulement
 * pourquoi il a été retenu.
 */
export const rapprocherToutes = async (profil, avps) => {
  const codes = [
    ...new Set(avps.map((a) => a.metier?.code).filter(Boolean)),
  ];

  // Un seul aller-retour en base pour tous les métiers concernés.
  const metiers = new Map(
    (await Metier.find({ code: { $in: codes } }).lean()).map((m) => [m.code, m]),
  );

  const tous = await Promise.all(
    avps.map((avp) => rapprocher(profil, avp, metiers)),
  );

  return {
    retenus: tous
      .filter((r) => !r.ecarte)
      .sort((a, b) => b.score - a.score),
    ecartes: tous.filter((r) => r.ecarte),
  };
};
