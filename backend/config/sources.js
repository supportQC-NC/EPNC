// backend/config/sources.js
//
// Inventaire des sources de données publiques sur lesquelles s'appuie
// l'application. C'est la source de vérité unique : l'écran d'administration,
// les scripts d'ingestion et la documentation s'y réfèrent tous.
//
// `type` :
//   donnees       — fichier ou API qu'on ingère réellement
//   flux          — flux de syndication, consommable en veille
//   site          — page publique de référence, consultée par un humain
//   documentation — portail de documentation d'API (l'API elle-même peut
//                   demander une clé ; on surveille au moins que le portail
//                   répond)

export const SOURCES = [
  // ── Avis de vacance de poste ────────────────────────────────────────
  {
    id: "hf_avps",
    nom: "Dataset Hugging Face — avis de vacance de poste",
    categorie: "Avis de vacance de poste",
    type: "donnees",
    url: "https://huggingface.co/datasets/opt-nc/odata-avps/resolve/main/data/all_avps.jsonl",
    role: "Source de vérité des offres, au format schema.org/JobPosting.",
    ingeree: true,
    collection: "avps",
    commande: "npm run data:avps",
  },
  {
    id: "hf_embeddings",
    nom: "Dataset Hugging Face — embeddings",
    categorie: "Avis de vacance de poste",
    type: "donnees",
    url: "https://huggingface.co/datasets/opt-nc/odata-avps/resolve/main/data/all_embeddings.parquet",
    role: "Vecteurs des offres, pour la recherche sémantique. Pas encore exploités.",
    ingeree: false,
  },
  {
    id: "portail_avps",
    nom: "Portail web des AVP",
    categorie: "Avis de vacance de poste",
    type: "site",
    url: "https://opt-nc.github.io/odata-avps/",
    role: "Publication JSON-LD indexable par Google for Jobs.",
    ingeree: false,
  },
  {
    id: "rss_avps",
    nom: "Flux RSS des AVP",
    categorie: "Avis de vacance de poste",
    type: "flux",
    url: "https://opt-nc.github.io/odata-avps/index.xml",
    role: "Notification des nouvelles publications, pour une veille automatique.",
    ingeree: false,
  },
  {
    id: "api_avps",
    nom: "API des AVP (Apigee)",
    categorie: "Avis de vacance de poste",
    type: "documentation",
    url: "https://apigee-optnc-prd-api.apigee.io/docs/avps/1/overview",
    role: "API officielle. Alternative au dataset, sous réserve d'une clé d'accès.",
    ingeree: false,
  },
  {
    id: "mcp_avps",
    nom: "Serveur MCP emploi",
    categorie: "Avis de vacance de poste",
    type: "documentation",
    url: "https://apigee-optnc-prd-api.apigee.io/docs/mcp-emploi/1/overview",
    role: "Branchement direct d'un agent conversationnel sur la donnée.",
    ingeree: false,
  },

  // ── Référentiel des métiers ─────────────────────────────────────────
  {
    id: "metiers_familles",
    nom: "Référentiel — familles de métiers",
    categorie: "Référentiel des métiers",
    type: "donnees",
    url: "https://raw.githubusercontent.com/opt-nc/odata-referentiel-metiers/main/data/output/csv/famille_metier.csv",
    role: "Les 12 familles de métiers de l'OPT-NC.",
    ingeree: true,
    collection: "familles",
    commande: "npm run data:metiers",
  },
  {
    id: "metiers_metiers",
    nom: "Référentiel — métiers",
    categorie: "Référentiel des métiers",
    type: "donnees",
    url: "https://raw.githubusercontent.com/opt-nc/odata-referentiel-metiers/main/data/output/csv/metier.csv",
    role: "Fiches métier, rattachées à une famille.",
    ingeree: true,
    collection: "metiers",
    commande: "npm run data:metiers",
  },
  {
    id: "metiers_competences",
    nom: "Référentiel — compétences",
    categorie: "Référentiel des métiers",
    type: "donnees",
    url: "https://raw.githubusercontent.com/opt-nc/odata-referentiel-metiers/main/data/output/csv/competence.csv",
    role: "Vocabulaire normalisé des compétences (savoir, savoir-faire…).",
    ingeree: true,
    collection: "competences",
    commande: "npm run data:metiers",
  },
  {
    id: "metiers_liaisons",
    nom: "Référentiel — liaisons métier ↔ compétence",
    categorie: "Référentiel des métiers",
    type: "donnees",
    url: "https://raw.githubusercontent.com/opt-nc/odata-referentiel-metiers/main/data/output/csv/metier_competence.csv",
    role: "Compétences attendues par métier, avec poids et niveau requis. C'est le pivot du rapprochement explicable.",
    ingeree: true,
    collection: "metiers",
    commande: "npm run data:metiers",
  },
  {
    id: "site_metiers",
    nom: "Site du référentiel des métiers",
    categorie: "Référentiel des métiers",
    type: "site",
    url: "https://opt-nc.github.io/odata-referentiel-metiers/",
    role: "Fiches métier publiées, vers lesquelles pointent les offres.",
    ingeree: false,
  },
  {
    id: "api_metiers",
    nom: "API du référentiel métiers (Apigee)",
    categorie: "Référentiel des métiers",
    type: "documentation",
    url: "https://apigee-optnc-prd-api.apigee.io/docs/metiers-opt/1/overview",
    role: "API officielle du référentiel.",
    ingeree: false,
  },

  // ── Open data de Nouvelle-Calédonie ─────────────────────────────────
  {
    id: "datagouv_avps",
    nom: "data.gouv.nc — avis de vacance de poste",
    categorie: "Open data Nouvelle-Calédonie",
    type: "donnees",
    url: "https://data.gouv.nc/api/records/1.0/search/?dataset=avis-de-vacances-de-poste-avp-drhfpnc&rows=1",
    role: "Publication historique des AVP sur le portail open data du territoire.",
    ingeree: false,
  },
];

export const trouverSource = (id) => SOURCES.find((s) => s.id === id);
