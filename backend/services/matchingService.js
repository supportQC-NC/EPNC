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

export const motsUtiles = (texte) =>
  new Set(
    normaliser(texte)
      .split(" ")
      .filter((m) => m.length > 3 && !MOTS_VIDES.has(m)),
  );

// Deux mots désignent-ils la même chose, à la flexion près ?
//
// ══════════════════════════════════════════════════════════════════════════
//  POURQUOI CETTE FONCTION EXISTE — MESURÉ, PAS SUPPOSÉ
// ══════════════════════════════════════════════════════════════════════════
// La première version comparait les mots à l'identique. `npm run eval` a
// montré ce que ça coûtait : rappel de 0 % sur la classe « pertinent », 69
// rapprochements justes manqués sur 69. En regardant une paire au hasard —
// une secrétaire médicale face à un poste d'assistant administratif, noté
// 31/100 — la cause saute aux yeux :
//
//   attendu « Accueillir et prendre en charge le public »
//   profil  « Accueil et relation au public »            → non trouvé
//
//   attendu « Maîtrise de l'organisation et des procédures ADMINISTRATIVES »
//   profil  « Rédaction de courriers ADMINISTRATIFS »    → non trouvé
//
// Le français fléchit : accueil/accueillir, administratif/administratives,
// gestion/gestionnaire. Une comparaison exacte les traite comme des mots sans
// rapport, et le moteur conclut que le candidat ne couvre rien.
//
// On compare donc les PRÉFIXES plutôt que les mots entiers. Pas de vraie
// racinisation — il faudrait un dictionnaire, pour un gain marginal sur ce
// volume — mais un préfixe commun proportionnel à la longueur du plus court
// des deux mots. C'est suffisant pour la flexion, et assez exigeant pour ne
// pas rapprocher n'importe quoi.
export const memeRacine = (a, b) => {
  if (a === b) return true;

  const court = Math.min(a.length, b.length);

  // En dessous de cinq lettres, un préfixe commun ne prouve rien :
  // « cadre » et « cadeau » partagent « cad ».
  if (court < 5) return false;

  // 85 % du mot le plus court, avec un plancher à cinq caractères.
  //
  // ⚠️ Le ratio était de 0,75, et c'était trop lâche sur les mots longs : à
  // douze lettres, il n'en exigeait que neuf, si bien que « INFORMATIQUE » et
  // « INFORMATION » se confondaient. Repéré sur une alerte de veille — un
  // profil de relation client se voyait proposer un poste d'ingénieur en
  // systèmes d'information à 69/100, « Diplôme de niveau 7 en informatique »
  // étant réputé couvert par « conduite d'entretiens de recueil
  // d'information ». C'est précisément le faux positif que le règlement
  // sanctionne, et le genre d'alerte qui fait classer l'expéditeur en
  // indésirable.
  //
  // À 0,85 : « informatique » exige onze lettres communes et ne rejoint plus
  // « information », tandis que « accueil » / « accueillir » et
  // « administratif » / « administratives » continuent de se retrouver.
  const exige = Math.max(5, Math.ceil(court * 0.85));

  return a.slice(0, exige) === b.slice(0, exige);
};

// Nombre de mots de `attendus` qui trouvent leur équivalent dans `sources`.
export const motsCommuns = (attendus, sources) => {
  let communs = 0;
  for (const m of attendus) {
    for (const s of sources) {
      if (memeRacine(m, s)) {
        communs += 1;
        break;
      }
    }
  }
  return communs;
};

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

  return motsCommuns(ma, mb) / ma.size;
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

  const communs = motsCommuns(ma, mb);
  if (communs === 0) return 0;

  // Union approchée : les mots communs sont comptés une fois.
  return communs / (ma.size + mb.size - communs);
};

// Seuil de reconnaissance, pour les mesures qui restent proportionnelles
// (ressemblance de deux intitulés, couverture d'une mission).
const SEUIL_PROXIMITE = 0.34;

// Un attendu est-il couvert ?
//
// ══════════════════════════════════════════════════════════════════════════
//  UNE RÈGLE EN NOMBRE DE MOTS, PAS EN POURCENTAGE
// ══════════════════════════════════════════════════════════════════════════
// Le seuil proportionnel de 0,34 produisait un effet de bord invisible mais
// systématique : un attendu de TROIS mots utiles exigeait DEUX correspondances,
// puisque 1/3 = 0,333 tombe juste sous la barre. Or les attendus de trois mots
// sont les plus fréquents des fiches de poste. `npm run eval` l'a rendu
// visible — le rappel restait à zéro quoi qu'on change ailleurs.
//
// La règle ci-dessous dit la même chose qu'un lecteur humain :
//   - deux mots porteurs en commun suffisent ;
//   - un seul suffit s'il représente la moitié de l'attendu (« Rédaction
//     administrative » couvert par « Rédaction de courriers administratifs »).
//
// Elle reste exigeante : un mot isolé noyé dans un attendu de cinq ne compte
// pas. C'est ce qui tient l'absence de faux positifs, mesurée à chaque
// exécution de l'évaluation.
const attenduCouvert = (communs, total) => {
  if (total === 0) return false;
  if (communs >= 2) return true;
  return communs >= 1 && communs / total >= 0.5;
};

// Cherche dans le profil ce qui répond à un attendu.
//
// ══════════════════════════════════════════════════════════════════════════
//  UN ATTENDU PEUT ÊTRE COUVERT PAR PLUSIEURS LIGNES DU PROFIL
// ══════════════════════════════════════════════════════════════════════════
// Première version, on cherchait la MEILLEURE source unique : un attendu
// n'était couvert que si une seule ligne du profil le portait à elle seule.
// `npm run eval` a montré la limite sur un cas net :
//
//   attendu « Maîtrise de l'organisation et des procédures administratives »
//   profil  « Gestion administrative de dossiers »    → 1 mot sur 3
//           « Planification et gestion d'agendas »    → 1 mot sur 3
//
// Chacune sous le seuil, l'attendu déclaré non couvert — alors que les deux
// ensemble y répondent, et que c'est ainsi qu'un recruteur lit un CV : il ne
// cherche pas la ligne qui dit tout, il rassemble.
//
// On mesure donc la couverture contre l'ENSEMBLE du profil. L'exigence ne
// baisse pas — il faut toujours qu'une part suffisante des mots de l'attendu
// se retrouve quelque part — mais elle cesse de porter sur une ligne unique.
//
// La CITATION, elle, reste la meilleure source individuelle : une preuve doit
// désigner un élément précis du parcours, pas « votre profil en général ».
const chercherDansProfil = (attendu, sources) => {
  if (!sources.length) return null;

  const mots = motsUtiles(attendu);
  if (mots.size === 0) return null;

  // Tous les mots du profil, d'un bloc.
  const tousLesMots = new Set();
  for (const source of sources) {
    for (const m of motsUtiles(source.libelle)) tousLesMots.add(m);
  }

  const communs = motsCommuns(mots, tousLesMots);
  if (!attenduCouvert(communs, mots.size)) return null;

  const force = communs / mots.size;

  // Quelle ligne du profil contribue le plus ? C'est elle qu'on citera.
  let meilleure = null;
  for (const source of sources) {
    const part = couvrance(attendu, source.libelle);
    if (!meilleure || part > meilleure.part) meilleure = { source, part };
  }

  return { ...meilleure.source, force };
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

// Deux libellés de compétence désignent-ils la même chose ?
//
// « Rédaction administrative » et « Rédaction de courriers administratifs »
// doivent se rejoindre ; « Rédaction administrative » et « Gestion de projet »
// non. On exige la moitié des mots porteurs du plus court des deux.
export const memeCompetence = (a, b) => {
  const ma = motsUtiles(a);
  const mb = motsUtiles(b);
  if (ma.size === 0 || mb.size === 0) return false;

  const communs = motsCommuns(ma, mb);
  const court = Math.min(ma.size, mb.size);

  // ⚠️ DEUX mots communs au minimum dès que les deux libellés en comptent
  // plusieurs.
  //
  // La première version se contentait de la moitié du plus court, donc d'UN
  // seul mot pour un libellé de deux. Résultat observé à l'écran :
  // « Rédaction administrative » et « Gestion administrative de dossiers »
  // étaient fusionnées en un seul critère — elles partagent « administrative »
  // et rien d'autre. Deux compétences distinctes comptées comme une, et un
  // recruteur qui ne retrouvait pas le critère qu'il venait de saisir.
  //
  // Un seul mot ne suffit que si l'un des deux libellés EST ce mot
  // (« Comptabilité » face à « Comptabilité publique »).
  if (court === 1) return communs >= 1;

  if (communs < 2 || communs < Math.ceil(court / 2)) return false;

  // ⚠️ Le libellé le PLUS LONG doit aussi être couvert, au tiers au moins.
  //
  // Sans cette borne, la règle ne contraint que le côté court : deux mots
  // communs suffisaient à rapprocher n'importe quel libellé de deux mots d'un
  // libellé de quatorze. Observé à l'essai de l'entretien guidé —
  // « Organisation d'activités » était rapproché de « Connaissance de
  // l'organisation et des processus de l'Office applicables à l'activité
  // relation client ». Les deux mots communs y sont, et les deux sens sont
  // étrangers : « organisation » y désigne l'institution, pas le fait
  // d'organiser.
  //
  // Au tiers, « Rédaction administrative » rejoint toujours « Rédaction de
  // courriers administratifs » (2 sur 3), et « Gestion logistique » rejoint
  // « Maîtrise des SIG et des outils de gestion logistique » (2 sur 3, les
  // mots vides étant écartés).
  const long = Math.max(ma.size, mb.size);

  return communs >= Math.ceil(long / 3);
};

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
      note: "Aucune expérience renseignée dans ce profil.",
      evidences: [],
      manques: [{ attendu: avp.experienceRequise || "Expérience professionnelle" }],
    };
  }

  // Deux expériences suffisent à saturer la part « volume » : au-delà, c'est
  // la pertinence qui compte, pas l'accumulation.
  const volume = Math.min(1, experiences.length / 2) * (BAREME.experience * 0.4);

  // ══════════════════════════════════════════════════════════════════════
  //  LA PERTINENCE NE SE JUGE PAS SUR LE SEUL INTITULÉ
  // ══════════════════════════════════════════════════════════════════════
  // Première version, cette composante comparait l'intitulé du poste à
  // l'intitulé de l'expérience, et rien d'autre. `npm run eval` a montré ce
  // que ça coûtait : une secrétaire médicale face à un poste d'assistant
  // administratif obtenait « aucune expérience directement comparable »,
  // alors que douze ans de gestion de dossiers et d'accueil du public
  // répondent exactement aux missions de l'annonce.
  //
  // Un intitulé fait trois mots ; les missions d'une fiche de poste en font
  // deux cents. C'est là qu'est le signal. On confronte donc CHAQUE
  // expérience — intitulé ET description — aux missions de l'offre, et l'on
  // retient le meilleur rapprochement des deux mesures.
  const missions = avp.missions || [];

  // ⚠️ Les missions sont confrontées UNE PAR UNE, jamais en bloc.
  //
  // Première tentative, on concaténait les quinze missions d'une fiche en un
  // seul texte, puis on mesurait combien de ses mots se retrouvaient dans le
  // parcours. Deux cents mots d'annonce face à quarante mots d'expérience :
  // la couverture ne pouvait mathématiquement pas franchir le seuil, et
  // l'expérience plafonnait à 7/15 même pour un profil taillé pour le poste.
  // Mission par mission, la question redevient sensée : « celle-ci,
  // l'a-t-il déjà faite ? »
  const parcours = experiences.map((e) => ({
    intitule: e.poste || "",
    texte: `${e.poste || ""} ${e.description || ""} ${(e.realisations || []).join(" ")}`.trim(),
  }));

  let missionsCouvertes = 0;
  let porteuse = null;

  for (const mission of missions) {
    const motsMission = motsUtiles(mission);
    const trouve = parcours.find((p) =>
      attenduCouvert(
        motsCommuns(motsMission, motsUtiles(p.texte)),
        motsMission.size,
      ),
    );
    if (trouve) {
      missionsCouvertes += 1;
      if (!porteuse) porteuse = trouve;
    }
  }

  // Couvrir 40 % des missions vaut la note pleine. Même raisonnement que pour
  // les autres composantes : une fiche de poste décrit tout ce que le poste
  // mobilise, y compris ce qu'on apprend en arrivant. Exiger la totalité
  // ferait plafonner tout le monde et ne hiérarchiserait plus rien.
  const CIBLE_MISSIONS = 0.4;
  const partMissions = missions.length
    ? Math.min(1, missionsCouvertes / missions.length / CIBLE_MISSIONS)
    : 0;

  // Ressemblance des intitulés : symétrique, deux libellés de même nature.
  let meilleurIntitule = 0;
  let porteuseIntitule = null;

  for (const p of parcours) {
    const proche = Math.max(
      proximite(avp.intitule, p.intitule),
      proximite(avp.metier?.nom || "", p.intitule),
    );
    if (proche > meilleurIntitule) {
      meilleurIntitule = proche;
      porteuseIntitule = p;
    }
  }

  const meilleure = Math.max(meilleurIntitule, partMissions);

  if (partMissions >= meilleurIntitule && missionsCouvertes > 0 && porteuse) {
    evidences.push({
      attendu: `${missionsCouvertes} mission${missionsCouvertes > 1 ? "s" : ""} sur ${missions.length} de ce poste`,
      couvertPar: porteuse.intitule || "Expérience professionnelle",
      origine: "expérience",
    });
  } else if (meilleurIntitule >= SEUIL_PROXIMITE && porteuseIntitule) {
    evidences.push({
      attendu: `Poste visé : ${avp.intitule}`,
      couvertPar: porteuseIntitule.intitule,
      origine: "expérience",
    });
  }

  const pertinence = meilleure * (BAREME.experience * 0.6);

  return {
    cle: "experience",
    libelle: "Expérience professionnelle",
    points: Math.round(volume + pertinence),
    maximum: BAREME.experience,
    applicable: true,
    note:
      missionsCouvertes > 0
        ? `${missionsCouvertes} des ${missions.length} missions de ce poste sont recoupées par le parcours.`
        : meilleurIntitule >= SEUIL_PROXIMITE
          ? "Un poste précédent est proche de l'intitulé."
          : `${experiences.length} expérience${experiences.length > 1 ? "s" : ""}, aucune ne recoupe les missions de ce poste.`,
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
        attendu: "Projet professionnel",
        couvertPar: "recoupe l'objet de ce poste",
        origine: "projet",
      });
    }
  }

  return {
    cle: "affinite",
    libelle: "Correspondance avec le projet professionnel",
    points: Math.round(points),
    maximum: Math.round(maximum),
    applicable: maximum > 0,
    note:
      maximum === 0
        ? "Aucun projet professionnel renseigné : cette composante est neutralisée. La section « Ce que vous cherchez » du profil la réactive."
        : evidences.length
          ? "Ce poste rejoint le projet déclaré."
          : "Rien dans le projet déclaré ne pointe vers ce poste.",
    evidences,
    manques: [],
  };
};

// Part du barème réellement applicable, en dessous de laquelle un score ne
// veut plus rien dire.
//
// CONSTAT DE TERRAIN : sur les 185 avis ouverts de data.gouv.nc, 139 ne
// publient AUCUN attendu, aucune mission et aucune description — tout le
// contenu vit dans le PDF, et les champs structurés sont absents. Ces offres ne
// sont rattachées à aucun métier du référentiel OPT non plus. Il ne reste alors
// que l'expérience et l'affinité, soit 23 des 100 points du barème.
//
// Or 14 points sur 23 s'affichaient « 61/100 », à côté d'une offre complète
// notée 61/100 sur les 100 points. Les deux chiffres ne mesurent pas la même
// chose, et rien ne le disait. C'est exactement le faux positif que le
// règlement sanctionne : un score flatteur obtenu parce que l'employeur n'a
// rien publié.
//
// En dessous de ce seuil, on ne publie donc PAS de score. Dire « cette offre ne
// contient pas assez d'informations » est plus utile, et plus honnête, qu'un
// nombre sur lequel personne ne peut s'appuyer.
const FIABILITE_MINIMALE = 40;

// Verdict lisible. Les seuils sont assumés et affichés : un score nu ne dit
// pas s'il faut candidater.
const verdict = (score, fiabilite) => {
  if (fiabilite < FIABILITE_MINIMALE) {
    return {
      niveau: "indetermine",
      // ⚠️ Ne PAS renvoyer vers « la fiche de poste » : sur ces offres-là, la
      // fiche est vide elle aussi — c'est précisément la raison du verdict.
      // La première version le faisait, et envoyait donc la personne lire une
      // page blanche. On oriente vers ce qui existe vraiment : le corps ou
      // grade indiqué, et le service qui recrute.
      texte:
        "Cette offre ne publie ni compétences attendues ni missions : il n'y a " +
        "pas de quoi calculer un rapprochement honnête, et nous préférons ne " +
        "rien annoncer. Le corps indiqué sur la fiche dit le type de fonctions ; " +
        "pour le reste, contacter le service qui recrute est la démarche la " +
        "plus sûre.",
    };
  }

  if (score >= 70)
    return { niveau: "solide", texte: "Le profil répond à l'essentiel des attendus." };
  if (score >= 45)
    return {
      niveau: "jouable",
      texte: "Candidature défendable, à condition d'assumer les écarts.",
    };
  return {
    niveau: "eloigne",
    texte: "Ce poste est loin du profil actuel.",
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

  // Le barème total vaut 100 points : la somme des maxima applicables se lit
  // donc directement comme un pourcentage de fiabilité.
  const fiabilite = possibles;
  const fiable = fiabilite >= FIABILITE_MINIMALE;

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

    // Le score n'est publié QUE s'il repose sur assez de matière. Renvoyer
    // `null` plutôt qu'un nombre bas force l'interface à dire pourquoi — elle
    // ne peut pas afficher un chiffre par défaut.
    score: motifsExclusion.length > 0 || !fiable ? null : score,
    // Le score brut reste disponible : il sert au classement interne et à
    // l'évaluation, sans jamais être présenté comme un résultat au candidat.
    scoreBrut: motifsExclusion.length > 0 ? null : score,
    fiabilite,
    fiable,
    verdict: motifsExclusion.length > 0 ? null : verdict(score, fiabilite),
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
    // Tri sur le score BRUT : `score` peut être nul quand l'offre est trop
    // pauvre, et `b.score - a.score` sur des `null` renvoie NaN — l'ordre
    // devenait alors celui de la base, c'est-à-dire aucun.
    // Les offres non évaluables passent derrière toutes les autres : elles ne
    // sont pas mauvaises, elles ne sont simplement pas jugeables.
    retenus: tous
      .filter((r) => !r.ecarte)
      .sort((a, b) => {
        if (a.fiable !== b.fiable) return a.fiable ? -1 : 1;
        return (b.scoreBrut ?? 0) - (a.scoreBrut ?? 0);
      }),
    ecartes: tous.filter((r) => r.ecarte),
  };
};
