// backend/services/suggestionService.js
//
// Suggestions de candidats pour un recruteur.
//
// ══════════════════════════════════════════════════════════════════════════
//  EXPLICABLE, COMME LE RESTE — SINON ÇA NE SERT À RIEN
// ══════════════════════════════════════════════════════════════════════════
// Une recommandation opaque (« 87 % de correspondance ») ne se vérifie pas,
// ne se corrige pas, et n'apprend rien à celui qui la lit. Le reste du projet
// justifie chaque point d'un score en désignant ce qui répond à quoi ; il n'y
// a aucune raison de faire autrement ici.
//
// Chaque suggestion dit donc : les compétences partagées, et avec QUI du
// vivier enregistré le candidat se rapproche. Le recruteur peut contredire —
// et c'est ce qui fait la différence entre un outil et un oracle.
//
// LE SIGNAL VIENT DE DEUX SOURCES, dosables par le recruteur :
//
//   1. Ce qu'il a DÉCLARÉ chercher (compétences, métiers, territoires). Seule
//      source disponible sur un compte neuf.
//   2. Ce qu'il a ENREGISTRÉ dans ses listes. Bien plus fiable dès qu'il y a
//      quelques profils : mettre quelqu'un de côté est un geste coûteux, donc
//      sincère.
//
// `poidsHistorique` règle le dosage. Ni de l'apprentissage, ni un modèle : une
// somme pondérée de compétences partagées, que l'on peut recalculer à la main
// sur un coin de table. Vu le volume — quelques dizaines de profils — tout
// autre choix serait la sur-ingénierie que le barème sanctionne.

import { motsUtiles, motsCommuns } from "./matchingService.js";

// Deux libellés de compétence désignent-ils la même chose ?
//
// « Rédaction administrative » et « Rédaction de courriers administratifs »
// doivent se rejoindre ; « Rédaction administrative » et « Gestion de projet »
// non. On exige la moitié des mots porteurs du plus court des deux.
const memeCompetence = (a, b) => {
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

  return communs >= 2 && communs >= Math.ceil(court / 2);
};

// Poids d'une compétence selon le niveau déclaré : un expert compte davantage
// qu'un débutant quand il s'agit de dire ce qu'un recruteur recherche.
const POIDS_NIVEAU = { notions: 0.5, pratique: 1, maitrise: 1.5, expert: 2 };

/**
 * Construit le « profil de recherche » du recruteur : une table
 * compétence → poids, et l'origine de chaque poids.
 *
 * L'origine est conservée pour pouvoir l'afficher. Sans elle, on saurait
 * qu'une compétence pèse, sans pouvoir dire pourquoi.
 */
export const profilDeRecherche = (recruteur, listes) => {
  const poids = new Map();
  const origines = new Map();

  const ajouter = (libelle, valeur, origine) => {
    if (!libelle?.trim()) return;

    // On agrège sur un libellé EXISTANT s'il désigne la même chose, plutôt que
    // de créer une entrée par graphie. Sinon « Rédaction administrative » et
    // « Rédaction de courriers administratifs » comptent deux fois pour la
    // même compétence, et le classement penche vers les profils bavards.
    const cle =
      [...poids.keys()].find((k) => memeCompetence(k, libelle)) || libelle;

    poids.set(cle, (poids.get(cle) || 0) + valeur);

    if (!origines.has(cle)) origines.set(cle, new Set());
    origines.get(cle).add(origine);
  };

  const part = Math.min(100, Math.max(0, recruteur?.poidsHistorique ?? 50)) / 100;

  // 1. Ce qui est déclaré. Poids plein quand l'historique est à zéro.
  for (const c of recruteur?.recherche?.competences || []) {
    ajouter(c, 2 * (1 - part) + 1, "déclarée");
  }
  for (const m of recruteur?.recherche?.metiers || []) {
    ajouter(m, 1.5 * (1 - part) + 0.5, "métier visé");
  }
  for (const m of recruteur?.recherche?.motsCles || []) {
    ajouter(m, 1 * (1 - part) + 0.3, "mot-clé");
  }

  // 2. Ce qui a été enregistré. Chaque candidat mis de côté vote avec ses
  // compétences.
  let nbEnregistres = 0;

  for (const liste of listes || []) {
    for (const entree of liste.entrees || []) {
      const profil = entree.profil;
      // `profil` est peuplé ; s'il ne l'est pas, l'entrée pointe vers un
      // profil supprimé et ne doit pas voter.
      if (!profil?.competences) continue;

      nbEnregistres += 1;

      for (const c of profil.competences) {
        ajouter(
          c.nom,
          (POIDS_NIVEAU[c.niveau] || 1) * part,
          `${entree.prenom} ${entree.nom}`.trim() || "un profil enregistré",
        );
      }
    }
  }

  return {
    poids,
    origines,
    nbEnregistres,
    // Sans aucun signal, les suggestions n'ont pas de sens : l'interface doit
    // le dire plutôt que d'afficher un classement arbitraire.
    exploitable: poids.size > 0,
  };
};

/**
 * Classe des candidats selon le profil de recherche.
 *
 * `dejaEnregistres` : les identifiants déjà présents dans une liste. On ne
 * suggère pas quelqu'un qu'on a déjà mis de côté — c'est le reproche le plus
 * immédiat qu'on puisse faire à une recommandation.
 */
export const suggerer = (candidats, recherche, dejaEnregistres = new Set()) => {
  if (!recherche.exploitable) return [];

  // Poids total, pour ramener le score sur 100. On borne le dénominateur : un
  // recruteur qui a enregistré trente profils accumule un poids total énorme,
  // et aucun candidat ne pourrait en couvrir une part notable. On compare donc
  // à ce qu'un très bon profil peut raisonnablement couvrir.
  const poidsTries = [...recherche.poids.values()].sort((a, b) => b - a);
  const plafond =
    poidsTries.slice(0, 8).reduce((t, v) => t + v, 0) || 1;

  const classes = [];

  for (const candidat of candidats) {
    if (dejaEnregistres.has(String(candidat.id))) continue;

    const communes = [];
    let total = 0;

    for (const [libelle, valeur] of recherche.poids) {
      const trouvee = (candidat.competences || []).find((c) =>
        memeCompetence(libelle, c.nom),
      );

      if (trouvee) {
        total += valeur;
        communes.push({
          recherchee: libelle,
          declaree: trouvee.nom,
          // Pourquoi cette compétence compte : déclarée par le recruteur, ou
          // portée par des profils qu'il a enregistrés.
          origines: [...(recherche.origines.get(libelle) || [])].slice(0, 3),
        });
      }
    }

    if (communes.length === 0) continue;

    classes.push({
      candidat,
      score: Math.min(100, Math.round((total / plafond) * 100)),
      // Triées par poids décroissant : la première ligne doit être la raison
      // principale, pas la première rencontrée.
      communes: communes
        .sort(
          (a, b) =>
            (recherche.poids.get(b.recherchee) || 0) -
            (recherche.poids.get(a.recherchee) || 0),
        )
        .slice(0, 5),
      nbCommunes: communes.length,
    });
  }

  return classes.sort((a, b) => b.score - a.score || b.nbCommunes - a.nbCommunes);
};
