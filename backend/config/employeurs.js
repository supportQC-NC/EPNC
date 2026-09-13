// backend/config/employeurs.js
//
// Qui recrute, et sous quel nom le dire.
//
// ══════════════════════════════════════════════════════════════════════════
//  POURQUOI CE FICHIER EXISTE
// ══════════════════════════════════════════════════════════════════════════
// Tant que la seule source était le dataset de l'OPT-NC, l'application pouvait
// écrire « les offres de l'OPT-NC » sans mentir. Depuis l'ajout de
// data.gouv.nc, 185 des 230 offres émanent de la DIRECTION DES RESSOURCES
// HUMAINES ET DE LA FONCTION PUBLIQUE DE NOUVELLE-CALÉDONIE, un employeur
// distinct — et continuer à toutes les présenter comme des offres de l'OPT
// serait une affirmation fausse sur un service public.
//
// Ce n'est pas un détail de présentation :
//   - un candidat doit savoir À QUI il écrit avant de candidater ;
//   - nous n'avons aucun lien officiel avec ces employeurs et ne devons pas
//     laisser croire le contraire ;
//   - c'est le même geste que pour le reste du projet — nommer la provenance
//     de chaque donnée plutôt que de la fondre dans une masse indistincte.
//
// Le rattachement se fait sur `hiringOrganization.name`, qui vient du document
// source. On ne le devine pas : si un nom inconnu apparaît, il est affiché tel
// quel plutôt que rangé de force dans une case.

// Les employeurs réellement rencontrés dans les deux sources, relevés le
// 13/09/2026 : dix-neuf organisations distinctes. Le jeu data.gouv.nc ne
// publie pas les seuls avis du gouvernement — il couvre les provinces, les
// hôpitaux, les communes et l'université. L'application dessert donc toute la
// fonction publique calédonienne, pas un employeur unique.
//
// ⚠️ L'OPT apparaît sous DEUX graphies selon la source (« Office des postes et
// télécommunications » côté Hugging Face, « Office des Postes et des
// Télécommunications » côté data.gouv.nc). Sans l'alias, le même employeur
// serait compté deux fois et filtrable deux fois — le genre d'incohérence qui
// se voit immédiatement dans une démonstration.
export const EMPLOYEURS = [
  {
    code: "opt-nc",
    nom: "OPT-NC",
    nomComplet: "Office des postes et télécommunications de Nouvelle-Calédonie",
    type: "Établissement public",
    url: "https://www.opt.nc",
    alias: [
      "office des postes et telecommunications",
      "office des postes et des telecommunications",
      "opt-nc",
      "opt nc",
    ],
  },
  {
    code: "nouvelle-caledonie",
    nom: "Nouvelle-Calédonie",
    nomComplet:
      "Collectivité de la Nouvelle-Calédonie — recrutement assuré par la DRHFPNC",
    type: "Collectivité",
    url: "https://drhfpnc.gouv.nc",
    alias: ["nouvelle-caledonie", "nouvelle caledonie", "drhfpnc"],
  },
  {
    code: "province-sud",
    nom: "Province Sud",
    nomComplet: "Province Sud",
    type: "Collectivité",
    url: "https://www.province-sud.nc",
    alias: ["province sud"],
  },
  {
    code: "province-nord",
    nom: "Province Nord",
    nomComplet: "Province Nord",
    type: "Collectivité",
    url: "https://www.province-nord.nc",
    alias: ["province nord"],
  },
  {
    code: "province-iles",
    nom: "Province des îles",
    nomComplet: "Province des îles Loyauté",
    type: "Collectivité",
    url: "https://www.province-iles.nc",
    alias: ["province des iles loyaute", "province des iles"],
  },
  {
    code: "cht",
    nom: "CHT Gaston-Bourret",
    nomComplet: 'Centre hospitalier territorial "Gaston Bourret"',
    type: "Établissement public de santé",
    url: "https://www.cht.nc",
    alias: ['centre hospitalier territorial gaston bourret', "cht"],
  },
  {
    code: "chn",
    nom: "CH du Nord",
    nomComplet: "Centre hospitalier du Nord",
    type: "Établissement public de santé",
    url: null,
    alias: ["centre hospitalier du nord"],
  },
  {
    code: "chs",
    nom: "CHS Albert-Bousquet",
    nomComplet: 'Centre hospitalier spécialisé "Albert Bousquet"',
    type: "Établissement public de santé",
    url: null,
    alias: ["centre hospitalier specialise albert bousquet"],
  },
  {
    code: "unc",
    nom: "UNC",
    nomComplet: "Université de la Nouvelle-Calédonie",
    type: "Établissement public",
    url: "https://unc.nc",
    alias: ["universite de nouvelle caledonie", "universite de la nouvelle caledonie"],
  },
];

const normaliser = (texte) =>
  (texte || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * Identifie l'employeur d'une offre à partir de son `hiringOrganization`.
 *
 * Renvoie toujours quelque chose : un employeur connu, ou une fiche minimale
 * construite sur le nom trouvé. Un employeur non répertorié doit apparaître
 * sous son vrai nom — le ranger dans « Autre » effacerait précisément
 * l'information que ce fichier existe pour préserver.
 */
export const identifierEmployeur = (hiringOrganization) => {
  const nomSource =
    typeof hiringOrganization === "string"
      ? hiringOrganization
      : hiringOrganization?.name || null;

  if (!nomSource) {
    return {
      code: "inconnu",
      nom: "Employeur non précisé",
      nomComplet: "Employeur non précisé par la source",
      type: null,
      url: null,
    };
  }

  const cible = normaliser(nomSource);
  const connu = EMPLOYEURS.find((e) => e.alias.some((a) => normaliser(a) === cible));

  if (connu) {
    return {
      code: connu.code,
      nom: connu.nom,
      nomComplet: connu.nomComplet,
      type: connu.type,
      url: connu.url,
    };
  }

  // Employeur absent du registre : on le nomme tel que la source le nomme, et
  // on lui dérive un code stable.
  //
  // Le code retient les mots PORTEURS (« commune-poya », « congres-nouvelle »)
  // plutôt qu'une troncature à la longueur, qui produisait des identifiants
  // coupés en plein mot — illisibles dans une URL de filtre et impossibles à
  // reconnaître dans le journal.
  const MOTS_OUTILS = new Set(["de", "des", "du", "la", "le", "les", "et", "d", "l", "en", "a"]);

  const code = cible
    .split(" ")
    .filter((m) => m && !MOTS_OUTILS.has(m))
    .slice(0, 3)
    .join("-");

  return {
    code: code || "inconnu",
    nom: nomSource,
    nomComplet: nomSource,
    type: null,
    url: null,
  };
};

export const trouverEmployeur = (code) =>
  EMPLOYEURS.find((e) => e.code === code) || null;
