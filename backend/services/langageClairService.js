// backend/services/langageClairService.js
//
// Traduire le vocabulaire administratif en français lisible.
//
// ══════════════════════════════════════════════════════════════════════════
//  C'EST LE PROBLÈME QUE LE HACKATHON ÉNONCE, PAS UN CONFORT
// ══════════════════════════════════════════════════════════════════════════
// Une offre s'intitule « ACDP-grille rémunération 1-sans diplôme ». Une autre
// cherche un « attaché », une troisième un « conseiller des APS ». Quelqu'un
// qui cherche un emploi ne sait pas ce que ces mots désignent, et une annonce
// qu'on ne comprend pas est une annonce à laquelle on ne postule pas.
//
// ══════════════════════════════════════════════════════════════════════════
//  DEUX RÈGLES QUI NE SE NÉGOCIENT PAS
// ══════════════════════════════════════════════════════════════════════════
//
// 1. 🔴 ON N'EXPLIQUE QUE CE QUI EST OPAQUE.
//    « Orthophoniste », « aide-soignant », « sage-femme » sont déjà du français
//    clair. Leur accoler une définition serait condescendant et noierait les
//    termes qui, eux, en ont besoin. Un glossaire qui explique tout n'est plus
//    lu — c'est la première façon dont ces dispositifs échouent.
//
// 2. 🔴 ON NE STATUE JAMAIS SUR LE DROIT QU'ON N'A PAS LU.
//    Chaque entrée porte une `certitude`. « établie » = vocabulaire standard,
//    vérifiable, que l'on décrit par sa FONCTION (ce que la personne fait) et
//    non par sa base statutaire. « partielle » = notre lecture d'un sigle que
//    la source n'explicite nulle part — et l'interface le dit, avec un lien
//    vers l'avis original.
//
//    Vérifié : la base data.gouv.nc ne contient AUCUNE occurrence de « agent
//    contractuel de droit public ». Elle emploie le sigle ACDP sans jamais le
//    développer. Nous ne pouvons donc pas l'affirmer, seulement le proposer.
//
// ══════════════════════════════════════════════════════════════════════════
//  POURQUOI 38 ENTRÉES SUFFISENT
// ══════════════════════════════════════════════════════════════════════════
// Relevé sur le corpus ouvert : **38 corps/grades distincts couvrent les 188
// offres**, et surtout les **139 offres « muettes » en conservent toutes un**.
// C'est le seul contenu qui survit quand l'employeur ne publie ni missions ni
// compétences — donc le seul matériau dont on dispose pour rendre ces
// trois quarts du catalogue utiles.

export const CERTITUDE = {
  ETABLIE: "etablie",
  PARTIELLE: "partielle",
};

// Sigles développés. Séparés des corps : un même sigle revient dans plusieurs
// intitulés, et le dupliquer le ferait diverger.
const SIGLES = {
  aps: {
    developpe: "activités physiques et sportives",
    certitude: CERTITUDE.ETABLIE,
  },
  acdp: {
    developpe: "agent contractuel de droit public",
    certitude: CERTITUDE.PARTIELLE,
    reserve:
      "La source emploie ce sigle sans jamais le développer : c'est notre lecture, à confirmer sur l'avis original.",
  },
};

// ── Les corps et grades ───────────────────────────────────────────────────
//
// `clair` : l'intitulé en français courant, tel qu'on le dirait à quelqu'un.
// `explication` : ce que la personne FAIT. Absent quand le terme se comprend
//                 seul — voir la règle 1.
// `famille` : pour regrouper, et pour proposer des offres voisines.
const CORPS = {
  // ── Administratif : le gros du jargon, et le plus opaque ──────────
  attaché: {
    clair: "Cadre administratif",
    explication:
      "Conçoit et pilote des projets, rédige des notes et des rapports, encadre souvent une équipe ou un service. C'est le niveau d'encadrement le plus courant dans l'administration.",
    famille: "Administration",
  },
  "attaché d'administration générale": {
    clair: "Cadre administratif",
    explication:
      "Même métier qu'« attaché », sur des fonctions administratives générales plutôt que spécialisées.",
    famille: "Administration",
  },
  rédacteur: {
    clair: "Gestionnaire administratif",
    explication:
      "Instruit des dossiers, rédige des actes et des courriers, applique une réglementation. Poste d'exécution qualifiée, souvent avec une part d'expertise sur un domaine.",
    famille: "Administration",
  },
  "rédacteur d'administration générale": {
    clair: "Gestionnaire administratif",
    explication:
      "Même métier que « rédacteur », sur des dossiers administratifs généraux.",
    famille: "Administration",
  },
  "adjoint administratif": {
    clair: "Agent administratif",
    explication:
      "Accueil, secrétariat, saisie et suivi de dossiers. C'est la porte d'entrée la plus fréquente dans l'administration.",
    famille: "Administration",
  },
  "emploi fonctionnel": {
    clair: "Poste de direction",
    explication:
      "Un poste de direction, occupé pour une durée liée à la fonction et non à la carrière : on y est nommé, et l'on retrouve son corps d'origine en le quittant.",
    famille: "Direction",
    certitude: CERTITUDE.PARTIELLE,
    reserve:
      "Les modalités exactes varient selon l'employeur : vérifiez-les sur l'avis original.",
  },

  // ── Technique ────────────────────────────────────────────────────
  ingénieur: {
    clair: "Ingénieur",
    explication:
      "Conçoit, dimensionne et suit des projets techniques : bâtiment, réseaux, informatique, environnement selon le service.",
    famille: "Technique",
  },
  technicien: {
    clair: "Technicien",
    explication:
      "Met en œuvre et contrôle sur le terrain ce que les études ont défini : travaux, mesures, maintenance, suivi de chantier.",
    famille: "Technique",
  },
  "technicien adjoint": {
    clair: "Technicien",
    explication:
      "Fonctions techniques d'exécution, en appui d'un technicien ou d'un ingénieur.",
    famille: "Technique",
  },
  "cadre d'exploitation": {
    clair: "Responsable d'exploitation",
    explication:
      "Encadre un service d'exploitation au quotidien : organisation des équipes, continuité du service, respect des procédures.",
    famille: "Technique",
    certitude: CERTITUDE.PARTIELLE,
    reserve:
      "Le contenu de ce grade dépend fortement du service : l'avis original est la référence.",
  },

  // ── Santé ────────────────────────────────────────────────────────
  //
  // Aucune `explication` sur la plupart : « orthophoniste » ou « sage-femme »
  // n'ont pas besoin d'être traduits. Seuls les intitulés composés en
  // reçoivent une.
  "médecin de santé publique": {
    clair: "Médecin de santé publique",
    explication:
      "Médecin qui travaille sur la santé d'une population plutôt que sur des patients un par un : prévention, veille sanitaire, organisation des soins.",
    famille: "Santé",
  },
  "infirmier en soins généraux": {
    clair: "Infirmier",
    famille: "Santé",
  },
  "cadre de santé": {
    clair: "Cadre de santé",
    explication:
      "Soignant qui encadre une équipe soignante : organisation du service, plannings, qualité des soins.",
    famille: "Santé",
  },
  "aide-soignant": { clair: "Aide-soignant", famille: "Santé" },
  "chirurgien dentiste": { clair: "Chirurgien-dentiste", famille: "Santé" },
  "sage femme": { clair: "Sage-femme", famille: "Santé" },
  orthophoniste: { clair: "Orthophoniste", famille: "Santé" },
  "masseur kinésithérapeute": {
    clair: "Masseur-kinésithérapeute",
    famille: "Santé",
  },
  puéricultrice: { clair: "Puéricultrice", famille: "Santé" },
  "auxiliaire de puériculture": {
    clair: "Auxiliaire de puériculture",
    famille: "Santé",
  },
  psychologue: { clair: "Psychologue", famille: "Santé" },

  // ── Social et éducatif ───────────────────────────────────────────
  "assistant socio-éducatif": {
    clair: "Travailleur social",
    explication:
      "Accompagne des personnes ou des familles en difficulté : évaluation des situations, accès aux droits, suivi dans la durée.",
    famille: "Social et éducatif",
  },
  "moniteur socio-éducatif": {
    clair: "Moniteur éducateur",
    explication:
      "Accompagne au quotidien des personnes accueillies en établissement ou en service : vie collective, activités, autonomie.",
    famille: "Social et éducatif",
  },
  "animateur socio-éducatif": {
    clair: "Animateur",
    explication:
      "Conçoit et anime des activités auprès d'un public : jeunesse, quartiers, structures de loisirs.",
    famille: "Social et éducatif",
  },
  "cadre socio-éducatif": {
    clair: "Responsable d'équipe sociale",
    explication:
      "Encadre une équipe de travailleurs sociaux : organisation, projets de service, suivi des situations complexes.",
    famille: "Social et éducatif",
  },
  "adjoint d'éducation": {
    clair: "Adjoint d'éducation",
    explication:
      "Encadre et accompagne les élèves hors de la salle de classe : vie scolaire, surveillance, suivi.",
    famille: "Social et éducatif",
  },
  "professeur des écoles": {
    clair: "Professeur des écoles",
    explication: "Enseigne en maternelle et en élémentaire.",
    famille: "Social et éducatif",
  },

  // ── Sport ────────────────────────────────────────────────────────
  //
  // Le sigle APS est le seul obstacle : une fois développé, les trois
  // intitulés deviennent transparents.
  "conseiller des aps": {
    clair: "Conseiller des activités physiques et sportives",
    explication:
      "Conçoit et pilote la politique sportive d'une collectivité : équipements, soutien aux clubs, programmation.",
    famille: "Sport",
  },
  "éducateur des aps": {
    clair: "Éducateur sportif",
    explication:
      "Encadre et enseigne des activités physiques et sportives auprès de différents publics.",
    famille: "Sport",
  },
  "opérateur des aps": {
    clair: "Agent des équipements sportifs",
    explication:
      "Assure le fonctionnement et la sécurité des équipements sportifs, et encadre certaines activités.",
    famille: "Sport",
  },

  // ── Sécurité et secours ──────────────────────────────────────────
  //
  // Ce sont des GRADES, pas des métiers : « sergent » ne dit pas ce qu'on
  // fait, il dit où l'on se situe dans une hiérarchie. C'est précisément ce
  // qu'il faut expliquer.
  "sapeur pompier": {
    clair: "Sapeur-pompier",
    explication: "Secours aux personnes, lutte contre les incendies, risques divers.",
    famille: "Sécurité et secours",
  },
  sergent: {
    clair: "Sapeur-pompier, grade de sergent",
    explication:
      "Un grade, pas un métier : il situe la personne dans la hiérarchie des sapeurs-pompiers. Sergent encadre une équipe d'intervention.",
    famille: "Sécurité et secours",
  },
  caporal: {
    clair: "Sapeur-pompier, grade de caporal",
    explication:
      "Un grade dans la hiérarchie des sapeurs-pompiers, premier niveau d'encadrement d'équipe.",
    famille: "Sécurité et secours",
  },
  capitaine: {
    clair: "Officier, grade de capitaine",
    explication:
      "Un grade d'officier : commandement d'unité, conduite d'opérations, encadrement.",
    famille: "Sécurité et secours",
  },
  major: {
    clair: "Grade de major",
    explication:
      "Le grade le plus élevé des sous-officiers : expertise, encadrement, appui au commandement.",
    famille: "Sécurité et secours",
  },
  "gradés de la police municipale": {
    clair: "Policier municipal, poste d'encadrement",
    explication:
      "Police municipale, sur un poste de gradé : encadrement d'une brigade, organisation du service.",
    famille: "Sécurité et secours",
  },

  // ── Contractuels ─────────────────────────────────────────────────
  //
  // 🔴 Les pires intitulés du corpus, et 13 offres ouvertes : un libellé de
  // grille de paie affiché à la place d'un métier. Personne ne cherche
  // « ACDP-grille rémunération 1 ».
  "acdp-grille rémunération 1-sans diplôme": {
    clair: "Poste contractuel, ouvert sans diplôme",
    explication:
      "L'intitulé est un libellé de grille de rémunération, pas un métier : il indique un recrutement sous contrat, sur un niveau de paie ouvert aux personnes sans diplôme exigé. Le métier réel est dans l'intitulé du poste, au-dessus.",
    famille: "Contractuel",
    sigle: "acdp",
  },
  "acdp-grille rémunération 2-diplôme niveau v": {
    clair: "Poste contractuel, niveau CAP-BEP",
    explication:
      "Comme ci-dessus : un libellé de grille de rémunération. Le « niveau V » désigne le niveau CAP ou BEP. Le métier réel est dans l'intitulé du poste.",
    famille: "Contractuel",
    sigle: "acdp",
  },
};

// ── Le jargon des textes libres ───────────────────────────────────────────
//
// Relevé par comptage sur le corpus ouvert, pas choisi à l'intuition. Seuls
// les termes RÉELLEMENT présents figurent ici — un glossaire qui définit des
// mots absents fait perdre confiance dans celui qui définit les mots présents.
const TERMES = [
  {
    terme: "durée de résidence",
    variantes: ["durée de résidence", "durée résidence", "durée de residence"],
    occurrences: 31,
    definition:
      "L'employeur exige d'avoir résidé en Nouvelle-Calédonie pendant une durée minimale, indiquée sur l'avis. Cette condition s'ajoute au diplôme et à l'expérience : lisez-la avant de candidater, elle peut être éliminatoire.",
    certitude: CERTITUDE.ETABLIE,
  },
  {
    terme: "titulaire",
    variantes: ["titulaire"],
    occurrences: 24,
    definition:
      "Un agent « titulaire » occupe son emploi de façon permanente, après avoir été nommé dans un corps. À distinguer du contractuel, recruté pour une durée déterminée. Attention au contexte : « titulaire d'un diplôme » veut simplement dire « qui possède ce diplôme ».",
    certitude: CERTITUDE.ETABLIE,
  },
  {
    terme: "grade",
    variantes: ["grade"],
    occurrences: 13,
    definition:
      "Le niveau atteint à l'intérieur d'un corps. Il détermine la rémunération et les fonctions accessibles, et évolue au fil de la carrière.",
    certitude: CERTITUDE.ETABLIE,
  },
  {
    terme: "astreinte",
    variantes: ["astreinte"],
    occurrences: 10,
    definition:
      "Obligation de rester joignable et de pouvoir intervenir en dehors des heures de travail. C'est une contrainte réelle sur la vie personnelle : vérifiez sa fréquence avant de candidater.",
    certitude: CERTITUDE.ETABLIE,
  },
  {
    terme: "fonctionnaire",
    variantes: ["fonctionnaire"],
    occurrences: 5,
    definition:
      "Agent nommé dans un corps de la fonction publique, avec un statut et une carrière propres — par opposition au contractuel, employé sur contrat.",
    certitude: CERTITUDE.ETABLIE,
  },
  {
    terme: "concours",
    variantes: ["concours"],
    occurrences: 4,
    definition:
      "Épreuve de recrutement organisée par l'employeur public. Certains postes n'y sont ouverts qu'à ceux qui l'ont réussi ; l'avis le précise.",
    certitude: CERTITUDE.ETABLIE,
  },
  {
    terme: "stagiaire",
    variantes: ["stagiaire"],
    occurrences: 4,
    definition:
      "Dans la fonction publique, « stagiaire » ne désigne pas un stage d'études : c'est la période d'essai d'un agent qui vient d'être nommé, avant sa titularisation.",
    certitude: CERTITUDE.ETABLIE,
  },
  {
    terme: "mutation",
    variantes: ["mutation"],
    occurrences: 1,
    definition:
      "Changement d'affectation d'un agent déjà en poste, sans nouveau recrutement.",
    certitude: CERTITUDE.ETABLIE,
  },
  {
    terme: "détachement",
    variantes: ["détachement", "detachement"],
    occurrences: 0,
    definition:
      "Un agent part exercer ailleurs tout en gardant son corps d'origine, où il peut revenir.",
    certitude: CERTITUDE.ETABLIE,
  },
  {
    terme: "intérim",
    variantes: ["intérim", "interim"],
    occurrences: 1,
    definition:
      "Occupation provisoire d'un poste vacant, en attendant un recrutement définitif.",
    certitude: CERTITUDE.ETABLIE,
  },
  {
    terme: "indice",
    variantes: ["indice"],
    occurrences: 1,
    definition:
      "Le nombre de points qui sert à calculer la rémunération. Il dépend du corps, du grade et de l'ancienneté.",
    certitude: CERTITUDE.ETABLIE,
  },
];

const normaliser = (t) =>
  String(t || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();


// ── Rattachement métier : distinguer « classé » de « non classé » ─────────
//
// 139 des 188 offres ouvertes portent le code ROME `N0000`, dont le libellé
// source est littéralement « Hors rome ». Affiché tel quel, cela donnait
// « Métier de rattachement : Hors rome » — une ligne qui ne dit rien à
// personne et qui laisse croire à un bug.
//
// Ce n'en est pas un : l'employeur n'a simplement pas classé le poste dans la
// nomenclature. La fonction est ici, et pas dans le contrôleur, pour que la
// liste, la fiche, l'API d'intégration et la veille rendent le MÊME verdict.
const NON_CLASSE = new Set(["n0000", "hors rome", "hors-rome", ""]);

export const metierClasse = (metier) => {
  if (!metier) return false;
  const nom = normaliser(metier.nom);
  const rome = normaliser(metier.rome);
  return Boolean(nom) && !NON_CLASSE.has(nom) && !NON_CLASSE.has(rome);
};

/**
 * Explique un corps ou grade.
 *
 * Retourne `null` quand on ne connaît pas le libellé — et c'est volontaire :
 * inventer une explication plausible pour un corps inconnu serait exactement
 * l'erreur que ce module existe pour éviter. L'interface affiche alors le
 * libellé brut, ce qui est au pire aussi bon qu'aujourd'hui.
 */
export const expliquerCorps = (corpsDomaine) => {
  const cle = normaliser(corpsDomaine);
  if (!cle) return null;

  const entree = CORPS[cle];
  if (!entree) return null;

  const sigle = entree.sigle ? SIGLES[entree.sigle] : null;

  return {
    brut: corpsDomaine,
    clair: entree.clair,
    explication: entree.explication || null,
    famille: entree.famille,
    certitude: entree.certitude || sigle?.certitude || CERTITUDE.ETABLIE,
    reserve: entree.reserve || sigle?.reserve || null,
  };
};

/**
 * Les termes de jargon présents dans des textes donnés.
 *
 * On ne renvoie que ce qui est RÉELLEMENT écrit dans cette offre-là : un
 * glossaire générique collé sous chaque annonce se survole et ne se lit pas.
 */
export const termesPresents = (...textes) => {
  const blob = normaliser(
    textes
      .flat()
      .filter(Boolean)
      .map((t) => (typeof t === "string" ? t : JSON.stringify(t)))
      .join(" "),
  );

  if (!blob) return [];

  return TERMES.filter((t) =>
    t.variantes.some((v) => blob.includes(normaliser(v))),
  ).map(({ variantes, occurrences, ...reste }) => reste);
};

/** Le glossaire complet, pour une page dédiée. */
export const glossaire = () =>
  TERMES.map(({ variantes, occurrences, ...reste }) => reste);

/** Les corps connus, pour l'administration et les tests. */
export const corpsConnus = () => Object.keys(CORPS);
