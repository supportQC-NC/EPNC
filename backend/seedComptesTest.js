// backend/seedComptesTest.js
//
// Comptes de démonstration : un administrateur, un recruteur, et huit profils
// candidats.
//
//   npm run data:comptes-test              → crée (ou remet à l'état initial)
//   npm run data:comptes-test -- --purge   → supprime les comptes de test
//
// ══════════════════════════════════════════════════════════════════════════
//  CES PROFILS SONT FICTIFS, ET CE N'EST PAS UNE PRÉCAUTION DE FORME
// ══════════════════════════════════════════════════════════════════════════
// Le règlement interdit d'utiliser le CV d'un tiers sans accord écrit, la
// vidéo de démonstration sera publique, et ces données transitent par des
// prompts et des journaux. Aucune personne réelle ne doit figurer ici.
//
// Les adresses sont en `@example.com`, domaine réservé par la RFC 2606 et
// garanti non routable : même une erreur de configuration ne peut pas écrire
// à quelqu'un.
//
// ══════════════════════════════════════════════════════════════════════════
//  LES HUIT PROFILS NE SONT PAS DÉCORATIFS
// ══════════════════════════════════════════════════════════════════════════
// Ils couvrent les situations qui mettent le rapprochement en difficulté, et
// serviront de jeu d'évaluation : reconversion, sortie d'études, profil
// surqualifié, candidat hors territoire, expérience sans diplôme, profil
// technique, profil administratif, profil relation client.
//
// Ils sont conçus INDÉPENDAMMENT des offres du moment : le corpus se renouvelle
// en quelques semaines, un persona taillé pour une offre précise ne vaudrait
// rien au moment du rendu.
import "./loadEnv.js";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import connectDB from "./config/db.js";
import User from "./models/UserModel.js";
import Profil from "./models/ProfilModel.js";
import { VERSION_CONSENTEMENT_VIVIER } from "./config/vivier.js";

// Mot de passe commun, volontairement évident : ce sont des comptes de
// démonstration sur une base de développement. Il ne doit JAMAIS servir
// ailleurs, et ces comptes n'ont rien à faire sur une base réelle.
const MOT_DE_PASSE = "Test2026!";

const DOMAINE = "example.com";

const comptes = [
  // ── Exploitation ────────────────────────────────────────────────────
  {
    email: `admin@${DOMAINE}`,
    prenom: "Alex",
    nom: "Administrateur",
    role: "admin",
    note: "Accès complet : comptes, sources, ingestion, mode d'envoi, SMTP.",
  },
  {
    email: `recruteur@${DOMAINE}`,
    prenom: "Rémi",
    nom: "Recruteur",
    role: "recruteur",
    note: "Rôle recruteur. Les écrans qui lui sont propres restent à écrire.",
  },

  // ── Candidats ───────────────────────────────────────────────────────
  {
    email: `melanie.tarrou@${DOMAINE}`,
    prenom: "Mélanie",
    nom: "Tarrou",
    role: "candidat",
    note: "Reconversion : secrétariat médical vers l'administratif public.",
    profil: {
      basics: {
        titre: "Secrétaire médicale — en reconversion vers l'administratif",
        telephone: "78 21 04",
        ville: "Nouméa",
        province: "Province Sud",
        accroche:
          "Douze ans de secrétariat médical, dont six à coordonner les plannings et les dossiers d'un cabinet de six praticiens. Je cherche à mettre cette rigueur au service d'une administration, sur des missions de gestion et de relation au public.",
        permis: ["B"],
      },
      experiences: [
        {
          poste: "Secrétaire médicale référente",
          employeur: "Cabinet médical de la Vallée du Tir",
          lieu: "Nouméa",
          debut: "2018",
          enCours: true,
          description:
            "Accueil physique et téléphonique, gestion des plannings de six praticiens, constitution et suivi des dossiers patients, facturation et télétransmission.",
          realisations: [
            "Réorganisation du circuit des dossiers, délai de traitement divisé par deux",
            "Formation de trois remplaçantes successives",
          ],
        },
        {
          poste: "Secrétaire médicale",
          employeur: "Clinique Kuindo-Magnin",
          lieu: "Nouméa",
          debut: "2013",
          fin: "2018",
          description:
            "Secrétariat d'un service de consultations externes, saisie des comptes rendus, gestion des convocations.",
        },
      ],
      formations: [
        {
          intitule: "Titre professionnel de secrétaire médicale",
          etablissement: "CNAM Nouvelle-Calédonie",
          niveau: "Bac+2",
          annee: "2013",
        },
        {
          intitule: "Baccalauréat sciences et technologies de la santé",
          etablissement: "Lycée Jules Garnier",
          niveau: "Bac",
          annee: "2010",
        },
      ],
      competences: [
        { nom: "Accueil et relation au public", niveau: "expert" },
        { nom: "Gestion administrative de dossiers", niveau: "expert" },
        { nom: "Rédaction de courriers administratifs", niveau: "maitrise" },
        { nom: "Planification et gestion d'agendas", niveau: "maitrise" },
        { nom: "Bureautique et traitement de texte", niveau: "maitrise" },
        { nom: "Discrétion professionnelle et secret médical", niveau: "expert" },
      ],
      langues: [{ nom: "Français", niveau: "maternelle" }],
      aspirations: {
        famillesVisees: [],
        typesContrat: [],
        projet:
          "Rejoindre une direction administrative pour y exercer des missions de gestion de dossiers et d'accueil du public, avec la stabilité et le sens du service que je ne trouve plus dans le privé.",
      },
      contraintes: { disponibilite: "Sous trois mois", mobilite: "Grand Nouméa" },
    },
  },
  {
    email: `kevin.poadja@${DOMAINE}`,
    prenom: "Kevin",
    nom: "Poadja",
    role: "candidat",
    note: "Sortie d'études : BTS informatique, très peu d'expérience. Teste le comportement sur un profil maigre.",
    profil: {
      basics: {
        titre: "Technicien informatique junior",
        telephone: "92 40 17",
        ville: "Dumbéa",
        province: "Province Sud",
        accroche:
          "Diplômé d'un BTS services informatiques aux organisations, je cherche un premier poste où apprendre le métier au contact d'une équipe.",
        permis: ["B"],
      },
      experiences: [
        {
          poste: "Stagiaire support informatique",
          employeur: "Mairie de Dumbéa",
          lieu: "Dumbéa",
          debut: "2025",
          fin: "2025",
          description:
            "Stage de deux mois : assistance aux agents, préparation et déploiement de postes, inventaire du parc.",
        },
      ],
      formations: [
        {
          intitule: "BTS Services informatiques aux organisations",
          etablissement: "Lycée Jules Garnier",
          niveau: "Bac+2",
          annee: "2025",
        },
      ],
      competences: [
        { nom: "Support et assistance aux utilisateurs", niveau: "pratique" },
        { nom: "Installation et configuration de postes de travail", niveau: "pratique" },
        { nom: "Réseaux informatiques", niveau: "notions" },
      ],
      langues: [
        { nom: "Français", niveau: "maternelle" },
        { nom: "Anglais", niveau: "notions" },
      ],
      aspirations: {
        famillesVisees: [],
        typesContrat: [],
        projet:
          "Un premier poste technique dans le service public, pour me former sur le terrain.",
      },
      contraintes: { disponibilite: "Immédiate", mobilite: "Grand Nouméa" },
    },
  },
  {
    email: `sylvain.berthier@${DOMAINE}`,
    prenom: "Sylvain",
    nom: "Berthier",
    role: "candidat",
    note: "Surqualifié : ingénieur télécoms, vingt ans d'expérience. Doit ressortir haut, mais pas partout.",
    profil: {
      basics: {
        titre: "Ingénieur télécoms, responsable d'exploitation",
        telephone: "77 65 33",
        ville: "Nouméa",
        province: "Province Sud",
        accroche:
          "Ingénieur télécoms, vingt ans d'expérience en conception et exploitation de réseaux, dont huit à diriger une équipe d'une douzaine de techniciens.",
        permis: ["B"],
      },
      experiences: [
        {
          poste: "Responsable d'exploitation réseau",
          employeur: "Opérateur télécoms régional",
          lieu: "Nouméa",
          debut: "2016",
          enCours: true,
          description:
            "Pilotage de l'exploitation d'un réseau fixe et mobile, encadrement de douze techniciens, gestion du budget de maintenance, relations avec les prestataires.",
          realisations: [
            "Réduction de 30 % du délai moyen de rétablissement",
            "Mise en place d'une astreinte structurée et d'un plan de continuité",
          ],
        },
        {
          poste: "Ingénieur études et projets",
          employeur: "Bureau d'études télécoms",
          lieu: "Nouméa",
          debut: "2006",
          fin: "2016",
          description:
            "Dimensionnement de réseaux de transmission, rédaction de cahiers des charges, suivi de chantiers de déploiement fibre.",
        },
      ],
      formations: [
        {
          intitule: "Diplôme d'ingénieur en télécommunications",
          etablissement: "École nationale supérieure des télécommunications",
          niveau: "Bac+5",
          annee: "2005",
        },
      ],
      competences: [
        { nom: "Conception et dimensionnement de réseaux", niveau: "expert" },
        { nom: "Encadrement d'équipe technique", niveau: "expert" },
        { nom: "Gestion de projet", niveau: "expert" },
        { nom: "Rédaction de cahiers des charges", niveau: "maitrise" },
        { nom: "Pilotage budgétaire", niveau: "maitrise" },
        { nom: "Relation fournisseurs et marchés", niveau: "maitrise" },
      ],
      langues: [
        { nom: "Français", niveau: "maternelle" },
        { nom: "Anglais", niveau: "courant" },
      ],
      aspirations: {
        famillesVisees: [],
        typesContrat: [],
        projet:
          "Un poste d'encadrement ou d'expertise dans le service public, où mon expérience d'exploitation serve un intérêt collectif.",
      },
      contraintes: { disponibilite: "Sous six mois", mobilite: "Nouvelle-Calédonie" },
    },
  },
  {
    email: `claire.vasseur@${DOMAINE}`,
    prenom: "Claire",
    nom: "Vasseur",
    role: "candidat",
    note: "Hors territoire : profil solide mais condition de résidence à éprouver.",
    profil: {
      basics: {
        titre: "Juriste en droit public",
        telephone: "06 12 34 56 78",
        ville: "Bordeaux",
        province: "Hors territoire",
        accroche:
          "Juriste en droit public, sept ans en collectivité territoriale. Je prépare une installation en Nouvelle-Calédonie et cherche un poste à la hauteur de mon expérience.",
        permis: ["B"],
      },
      experiences: [
        {
          poste: "Juriste en droit public",
          employeur: "Communauté d'agglomération",
          lieu: "Bordeaux",
          debut: "2019",
          enCours: true,
          description:
            "Conseil juridique aux directions opérationnelles, rédaction et contrôle des actes, suivi des contentieux, sécurisation des marchés publics.",
          realisations: [
            "Refonte du circuit de contrôle des délibérations",
            "Animation d'un cycle de formation interne au droit des contrats publics",
          ],
        },
        {
          poste: "Chargée d'études juridiques",
          employeur: "Conseil départemental",
          lieu: "Périgueux",
          debut: "2017",
          fin: "2019",
          description:
            "Veille réglementaire, notes juridiques, appui à la rédaction de conventions.",
        },
      ],
      formations: [
        {
          intitule: "Master 2 Droit public des affaires",
          etablissement: "Université de Bordeaux",
          niveau: "Bac+5",
          annee: "2017",
        },
        {
          intitule: "Licence de droit",
          etablissement: "Université de Bordeaux",
          niveau: "Bac+3",
          annee: "2015",
        },
      ],
      competences: [
        { nom: "Droit public et droit administratif", niveau: "expert" },
        { nom: "Rédaction de notes et d'avis juridiques", niveau: "expert" },
        { nom: "Commande publique et marchés", niveau: "maitrise" },
        { nom: "Veille réglementaire", niveau: "maitrise" },
        { nom: "Gestion de contentieux", niveau: "pratique" },
      ],
      langues: [
        { nom: "Français", niveau: "maternelle" },
        { nom: "Anglais", niveau: "courant" },
      ],
      aspirations: {
        famillesVisees: [],
        typesContrat: [],
        projet:
          "Exercer le droit public en Nouvelle-Calédonie, dans une administration où la matière juridique a un poids réel.",
      },
      contraintes: {
        disponibilite: "Sous quatre mois",
        mobilite: "Installation prévue en Nouvelle-Calédonie",
      },
    },
  },
  {
    email: `jb.wamytan@${DOMAINE}`,
    prenom: "Jean-Baptiste",
    nom: "Wamytan",
    role: "candidat",
    note: "Sans diplôme mais quinze ans d'expérience. Éprouve `experienceInPlaceOfEducation` et le filtre diplôme.",
    profil: {
      basics: {
        titre: "Agent d'exploitation, référent de tournée",
        telephone: "75 88 12",
        ville: "Koné",
        province: "Province Nord",
        accroche:
          "Quinze ans sur le terrain, de la distribution du courrier à la coordination d'une équipe de tournée. J'ai appris le métier en le faisant, et je forme aujourd'hui les nouveaux arrivants.",
        permis: ["B", "A2"],
      },
      experiences: [
        {
          poste: "Agent d'exploitation, référent de tournée",
          employeur: "Service postal de proximité",
          lieu: "Koné",
          debut: "2016",
          enCours: true,
          description:
            "Organisation et exécution des tournées de distribution, gestion des aléas, accompagnement et formation des nouveaux agents, tenue des états de service.",
          realisations: [
            "Refonte du découpage des tournées du secteur nord",
            "Tutorat de six agents depuis 2019",
          ],
        },
        {
          poste: "Préposé à la distribution",
          employeur: "Service postal de proximité",
          lieu: "Poindimié",
          debut: "2010",
          fin: "2016",
          description:
            "Distribution du courrier et des colis en zone rurale, relation directe avec les usagers.",
        },
      ],
      formations: [
        {
          intitule: "Certificat d'aptitude professionnelle",
          etablissement: "Lycée professionnel de Koné",
          niveau: "CAP",
          annee: "2008",
        },
      ],
      competences: [
        { nom: "Organisation de tournées de distribution", niveau: "expert" },
        { nom: "Conduite de deux-roues et de véhicule utilitaire", niveau: "expert" },
        { nom: "Relation aux usagers", niveau: "maitrise" },
        { nom: "Tutorat et formation de nouveaux agents", niveau: "maitrise" },
        { nom: "Connaissance du territoire et des secteurs ruraux", niveau: "expert" },
      ],
      langues: [
        { nom: "Français", niveau: "maternelle" },
        { nom: "Drehu", niveau: "courant" },
      ],
      aspirations: {
        famillesVisees: [],
        typesContrat: [],
        projet:
          "Évoluer vers un poste d'encadrement d'équipe de terrain, sans quitter la Province Nord.",
      },
      contraintes: { disponibilite: "Sous deux mois", mobilite: "Province Nord" },
    },
  },
  {
    email: `teddy.nekiriai@${DOMAINE}`,
    prenom: "Teddy",
    nom: "Nékiriaï",
    role: "candidat",
    note: "Profil technique télécoms de terrain.",
    profil: {
      basics: {
        titre: "Technicien fibre optique",
        telephone: "79 33 60",
        ville: "Païta",
        province: "Province Sud",
        accroche:
          "Technicien fibre optique, six ans de raccordement et de maintenance sur le réseau calédonien. Habitué au travail en hauteur et aux interventions en autonomie.",
        permis: ["B"],
      },
      experiences: [
        {
          poste: "Technicien fibre optique",
          employeur: "Entreprise de travaux réseaux",
          lieu: "Grand Nouméa",
          debut: "2020",
          enCours: true,
          description:
            "Raccordement d'abonnés, soudure de fibres, mesures réflectométriques, diagnostic et relève de dérangements, tenue des comptes rendus d'intervention.",
          realisations: [
            "Intervention sur plus de 900 raccordements",
            "Formation de deux apprentis à la soudure et aux mesures",
          ],
        },
        {
          poste: "Aide-technicien réseaux",
          employeur: "Entreprise de travaux publics",
          lieu: "Païta",
          debut: "2018",
          fin: "2020",
          description:
            "Tirage de câbles, pose de chambres et de fourreaux, sécurisation de chantier.",
        },
      ],
      formations: [
        {
          intitule: "Titre professionnel de technicien réseaux fibre optique",
          etablissement: "Centre de formation professionnelle",
          niveau: "Bac",
          annee: "2019",
        },
      ],
      competences: [
        { nom: "Soudure et raccordement de fibre optique", niveau: "expert" },
        { nom: "Mesures et réflectométrie", niveau: "maitrise" },
        { nom: "Diagnostic de dérangements réseau", niveau: "maitrise" },
        { nom: "Lecture de plans et de schémas techniques", niveau: "maitrise" },
        { nom: "Travail en hauteur et règles de sécurité", niveau: "expert" },
      ],
      langues: [{ nom: "Français", niveau: "maternelle" }],
      aspirations: {
        famillesVisees: [],
        typesContrat: [],
        projet:
          "Intégrer un opérateur public pour travailler sur l'infrastructure du territoire, avec une perspective d'évolution technique.",
      },
      contraintes: { disponibilite: "Sous un mois", mobilite: "Grand Nouméa" },
    },
  },
  {
    email: `lea.ouetcho@${DOMAINE}`,
    prenom: "Léa",
    nom: "Ouetcho",
    role: "candidat",
    note: "Profil administratif et budgétaire.",
    profil: {
      basics: {
        titre: "Gestionnaire budgétaire",
        telephone: "76 14 92",
        ville: "Nouméa",
        province: "Province Sud",
        accroche:
          "Gestionnaire administrative et budgétaire, huit ans en collectivité. J'instruis, je contrôle et je fiabilise des dossiers dont dépend le budget d'un service.",
        permis: ["B"],
      },
      experiences: [
        {
          poste: "Gestionnaire budgétaire",
          employeur: "Collectivité territoriale",
          lieu: "Nouméa",
          debut: "2019",
          enCours: true,
          description:
            "Préparation et suivi de l'exécution budgétaire d'un service, engagement et liquidation des dépenses, contrôle des pièces justificatives, élaboration de tableaux de bord.",
          realisations: [
            "Fiabilisation du suivi des engagements, écarts de clôture divisés par quatre",
            "Automatisation des états de suivi mensuels",
          ],
        },
        {
          poste: "Assistante administrative",
          employeur: "Établissement public",
          lieu: "Nouméa",
          debut: "2016",
          fin: "2019",
          description:
            "Instruction de dossiers, rédaction de courriers et de comptes rendus, archivage et classement.",
        },
      ],
      formations: [
        {
          intitule: "Licence professionnelle Gestion des organisations",
          etablissement: "Université de la Nouvelle-Calédonie",
          niveau: "Bac+3",
          annee: "2016",
        },
        {
          intitule: "BTS Comptabilité et gestion",
          etablissement: "Lycée Blaise Pascal",
          niveau: "Bac+2",
          annee: "2014",
        },
      ],
      competences: [
        { nom: "Exécution et suivi budgétaire", niveau: "expert" },
        { nom: "Contrôle de pièces justificatives", niveau: "expert" },
        { nom: "Instruction de dossiers administratifs", niveau: "maitrise" },
        { nom: "Tableur et tableaux de bord", niveau: "maitrise" },
        { nom: "Rédaction administrative", niveau: "maitrise" },
        { nom: "Comptabilité publique", niveau: "pratique" },
      ],
      langues: [{ nom: "Français", niveau: "maternelle" }],
      aspirations: {
        famillesVisees: [],
        typesContrat: [],
        projet:
          "Prendre la responsabilité d'une cellule de gestion, avec une dimension d'encadrement.",
      },
      contraintes: { disponibilite: "Sous trois mois", mobilite: "Grand Nouméa" },
    },
  },
  {
    email: `maeva.wema@${DOMAINE}`,
    prenom: "Maéva",
    nom: "Wéma",
    role: "candidat",
    note: "Profil relation client et accueil. Sert de fil rouge pour la démonstration.",
    profil: {
      basics: {
        titre: "Conseillère clientèle référente",
        telephone: "75 43 21",
        ville: "Nouméa",
        province: "Province Sud",
        accroche:
          "Dix ans d'accueil et de conseil au guichet, dont quatre à former les nouveaux conseillers. Je sais expliquer une procédure administrative à quelqu'un qui n'y comprend rien, et c'est ce que je fais le mieux.",
        permis: ["B"],
      },
      experiences: [
        {
          poste: "Conseillère clientèle référente",
          employeur: "Agence de services aux particuliers",
          lieu: "Nouméa",
          debut: "2019",
          enCours: true,
          description:
            "Accueil et conseil au guichet, instruction de dossiers, traitement des réclamations, formation et accompagnement des nouveaux conseillers.",
          realisations: [
            "Réduction du délai d'attente moyen de douze à sept minutes",
            "Rédaction du livret d'accueil des nouveaux conseillers",
          ],
        },
        {
          poste: "Chargée de clientèle",
          employeur: "Agence de services aux particuliers",
          lieu: "Mont-Dore",
          debut: "2015",
          fin: "2019",
          description:
            "Accueil, vente de services, encaissement, suivi des dossiers clients.",
        },
      ],
      formations: [
        {
          intitule: "Licence de droit",
          etablissement: "Université de la Nouvelle-Calédonie",
          niveau: "Bac+3",
          annee: "2015",
        },
        {
          intitule: "BTS Négociation et relation client",
          etablissement: "Lycée Blaise Pascal",
          niveau: "Bac+2",
          annee: "2013",
        },
      ],
      competences: [
        { nom: "Accueil et relation au public", niveau: "expert" },
        { nom: "Traitement des réclamations", niveau: "maitrise" },
        { nom: "Instruction de dossiers", niveau: "maitrise" },
        { nom: "Rédaction administrative", niveau: "maitrise" },
        { nom: "Formation et tutorat", niveau: "maitrise" },
        { nom: "Médiation et gestion de conflit", niveau: "pratique" },
      ],
      langues: [
        { nom: "Français", niveau: "maternelle" },
        { nom: "Anglais", niveau: "notions" },
      ],
      aspirations: {
        famillesVisees: [],
        typesContrat: [],
        projet:
          "Rejoindre un service public pour continuer à accompagner les usagers, avec l'envie d'aller vers la protection des données ou la médiation administrative.",
      },
      contraintes: { disponibilite: "Sous deux mois", mobilite: "Grand Nouméa" },
    },
  },
];

const FICHIER = path.join(path.resolve(), "user_test.txt");

const ecrireFichier = () => {
  const lignes = [
    "COMPTES DE TEST — Emploi Public NC",
    "=".repeat(72),
    "",
    "⚠️  Fichier NON VERSIONNÉ (voir .gitignore). Comptes de démonstration",
    "    uniquement, sur base de développement. Ne jamais réutiliser ce mot de",
    "    passe ailleurs, et ne jamais créer ces comptes sur une base réelle.",
    "",
    "    Tous les profils sont FICTIFS. Les adresses sont en @example.com,",
    "    domaine réservé par la RFC 2606 : aucun message ne peut y parvenir.",
    "",
    `Mot de passe commun à tous les comptes : ${MOT_DE_PASSE}`,
    `Régénérer ce fichier : npm run data:comptes-test`,
    "",
    "=".repeat(72),
    "",
  ];

  for (const groupe of ["admin", "recruteur", "candidat"]) {
    const duGroupe = comptes.filter((c) => c.role === groupe);
    if (!duGroupe.length) continue;

    const titres = {
      admin: "ADMINISTRATEUR",
      recruteur: "RECRUTEUR",
      candidat: "CANDIDATS — huit situations qui mettent le rapprochement à l'épreuve",
    };

    lignes.push(titres[groupe], "-".repeat(72), "");

    for (const c of duGroupe) {
      lignes.push(`  ${c.prenom} ${c.nom}`);
      lignes.push(`    email : ${c.email}`);
      lignes.push(`    rôle  : ${c.role}`);
      lignes.push(`    note  : ${c.note}`);
      if (c.profil) {
        lignes.push(
          `    profil: ${c.profil.experiences.length} expérience(s), ` +
            `${c.profil.formations.length} formation(s), ` +
            `${c.profil.competences.length} compétence(s) — ${c.profil.basics.ville}`,
        );
      }
      lignes.push("");
    }
  }

  lignes.push(
    "=".repeat(72),
    "",
    "PARCOURS DE TEST SUGGÉRÉ",
    "",
    "  1. Connexion avec maeva.wema@example.com — profil complet, fil rouge.",
    "  2. « Mes rapprochements » : vérifier les scores, la ventilation par",
    "     critère, et la section « Écartés — et pourquoi ».",
    "  3. Ouvrir une offre, préparer une candidature, produire les 4 pièces.",
    "  4. Télécharger un PDF, puis le dossier ZIP complet.",
    "  5. Envoyer la candidature : vérifier que la destination annoncée est",
    "     bien l'adresse de test, jamais celle du recruteur.",
    "  6. Connexion admin@example.com → /admin :",
    "     - Sources : état des douze sources publiques",
    "     - Données : bouton de mise à jour, journal des synchronisations",
    "     - Envoi   : mode test / production",
    "  7. Comparer kevin.poadja (profil maigre) et sylvain.berthier",
    "     (surqualifié) sur les mêmes offres : les verdicts doivent différer",
    "     nettement, et les motifs être lisibles.",
    "",
  );

  fs.writeFileSync(FICHIER, lignes.join("\n"), "utf8");
};

const importer = async () => {
  let crees = 0;
  let majs = 0;

  for (const c of comptes) {
    const email = c.email.toLowerCase();
    let user = await User.findOne({ email }).select("+password");

    if (user) {
      // Remise à l'état initial : le mot de passe est réappliqué, le compte
      // réactivé. Un compte de test qu'on a désactivé la veille en testant la
      // désactivation ne doit pas bloquer la démonstration du lendemain.
      user.password = MOT_DE_PASSE;
      user.role = c.role;
      user.isActive = true;
      user.prenom = c.prenom;
      user.nom = c.nom;
      await user.save();
      majs += 1;
    } else {
      user = await User.create({
        email,
        password: MOT_DE_PASSE,
        prenom: c.prenom,
        nom: c.nom,
        role: c.role,
      });
      crees += 1;
    }

    if (c.profil) {
      await Profil.findOneAndUpdate(
        { user: user._id },
        {
          ...c.profil,
          user: user._id,
          // Ces profils sont FICTIFS et faits pour la démonstration : ils sont
          // visibles des recruteurs dès le départ. Un compte réel, lui, arrive
          // avec `visibleRecruteurs: false` — c'est à la personne de décider.
          visibleRecruteurs: true,
          // Le consentement va avec la visibilité, y compris ici : sans lui,
          // ces profils s'afficheraient « accord donné sur une rédaction
          // antérieure » et la démonstration montrerait un défaut qui n'existe
          // que dans le jeu d'essai.
          consentementVivier: {
            accepteLe: new Date(),
            retireLe: null,
            version: VERSION_CONSENTEMENT_VIVIER,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    }
  }

  ecrireFichier();

  console.log(`✅ ${crees} compte(s) créé(s), ${majs} remis à l'état initial`);
  console.log(`📄 Identifiants écrits dans : ${FICHIER}`);
  console.log(`🔑 Mot de passe commun : ${MOT_DE_PASSE}`);
};

const purger = async () => {
  const emails = comptes.map((c) => c.email.toLowerCase());
  const users = await User.find({ email: { $in: emails } }, "_id");

  const { deletedCount: profils } = await Profil.deleteMany({
    user: { $in: users.map((u) => u._id) },
  });
  const { deletedCount } = await User.deleteMany({ email: { $in: emails } });

  if (fs.existsSync(FICHIER)) fs.unlinkSync(FICHIER);

  console.log(`🗑️  ${deletedCount} compte(s) et ${profils} profil(s) supprimé(s)`);
};

const run = async () => {
  await connectDB();
  try {
    if (process.argv.includes("--purge")) await purger();
    else await importer();
  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

run();
