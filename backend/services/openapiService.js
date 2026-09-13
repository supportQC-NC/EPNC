// backend/services/openapiService.js
//
// La description machine de l'API publique.
//
// ══════════════════════════════════════════════════════════════════════════
//  POURQUOI UN MODULE, ET PAS UN FICHIER openapi.yaml
// ══════════════════════════════════════════════════════════════════════════
// Une spec posée à côté du code est une spec qui ment au bout de trois
// semaines : on ajoute un champ, on oublie le YAML, et l'intégrateur code
// contre une documentation périmée. Ici, la version vient de `package.json`,
// l'URL du serveur de l'environnement, et les portées de `CleApiModel` —
// c'est-à-dire de la source qui fait autorité. Ce qui reste écrit à la main,
// ce sont les formes de réponse, et elles sont couvertes par les appels de
// test.
//
// ══════════════════════════════════════════════════════════════════════════
//  CE QU'ON DOCUMENTE, ET CE QU'ON NE DOCUMENTE PAS
// ══════════════════════════════════════════════════════════════════════════
// Pas les soixante routes internes de l'application web. Un intégrateur ne
// appellera jamais `/api/profil` ni `/api/moderation/signalements` : les
// décrire n'aiderait personne et créerait une promesse de stabilité qu'on ne
// veut pas tenir sur des routes qui bougent avec l'interface.
//
// On décrit deux surfaces, et seulement elles :
//   1. la donnée OUVERTE — les offres et le référentiel, sans clé ;
//   2. la surface MACHINE — rapprochement et production de pièces, sous clé.

import { PORTEES } from "../models/CleApiModel.js";

// OpenAPI 3.1, pas 3.0. La version 3.1 s'aligne sur JSON Schema 2020-12, ce
// qui permet de référencer par URL les schémas publics que nous utilisons
// (schema.org, JSON Resume) au lieu d'en recopier une version qui divergerait.
const VERSION_OPENAPI = "3.1.0";

const JOB_POSTING = "https://schema.org/JobPosting";
const JSON_RESUME =
  "https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json";

const DESCRIPTION = `
API d'**Emploi Public NC** — les avis de vacance de poste de la fonction
publique calédonienne, le rapprochement expliqué avec un candidat, et la
production des pièces d'une candidature.

## Deux formats, aucun vocabulaire maison

Vous n'avez aucun champ à apprendre ici.

- Les offres sortent en [schema.org/JobPosting](${JOB_POSTING}), et
  \`GET /api/avps/{slug}/jobposting\` renvoie le JSON-LD **d'origine**, intact.
- Les candidats entrent en [JSON Resume](https://jsonresume.org) — le format
  que votre ATS sait déjà produire — et ressortent dans le même format.

## Ce que l'API ne fait pas

Elle ne crée aucun compte, n'enregistre pas le candidat que vous soumettez, et
n'envoie rien à un employeur. Un profil transmis vit le temps de la requête.
La transmission d'une candidature reste un geste du candidat.

## Ce qu'il faut savoir avant d'afficher un score

Chaque rapprochement porte une **fiabilité** : la part du barème (sur 100)
réellement applicable à cette offre. Sur le corpus réel, une majorité d'avis
ne publie ni attendus ni missions — ces offres sont renvoyées comme
*non évaluables* plutôt que notées au hasard. Un score de 70 calculé sur
40 points de barème ne se présente pas comme un score de 70 sur 100.
`.trim();

// Réponse d'erreur : une seule forme dans toute l'application, celle que pose
// `errorMiddleware`. La décrire une fois et la référencer partout évite de
// laisser croire qu'elle change d'une route à l'autre.
const ERREUR = {
  type: "object",
  properties: {
    message: {
      type: "string",
      description:
        "Message destiné à être affiché tel quel. Il s'adresse à un humain, pas à un développeur.",
    },
  },
  required: ["message"],
};

const reponseErreur = (code, description) => ({
  [code]: {
    description,
    content: { "application/json": { schema: { $ref: "#/components/schemas/Erreur" } } },
  },
});

export const documentOpenApi = ({ version = "0.0.0", urlPublique } = {}) => ({
  openapi: VERSION_OPENAPI,

  info: {
    title: "Emploi Public NC — API",
    version,
    summary:
      "Offres publiques en schema.org/JobPosting, rapprochement expliqué à partir d'un JSON Resume.",
    description: DESCRIPTION,
    license: {
      // Déclarée parce que le règlement note la cohérence des licences : une
      // API sans licence explicite n'est pas réutilisable, quoi qu'en dise le
      // discours sur l'ouverture.
      name: "MIT",
      identifier: "MIT",
    },
    contact: { name: "Emploi Public NC" },
  },

  servers: [
    {
      url: urlPublique || "http://localhost:5000",
      description: "Serveur courant",
    },
  ],

  tags: [
    {
      name: "Offres",
      description:
        "Donnée ouverte. Aucune clé n'est demandée : ce sont des avis de vacance publics, republiés au format standard.",
    },
    {
      name: "Référentiel",
      description:
        "Le référentiel métiers de l'OPT-NC : familles, métiers, compétences attendues avec leur poids. C'est le vocabulaire dans lequel les rapprochements sont justifiés.",
    },
    {
      name: "Intégration",
      description:
        "Surface machine, sous clé d'API. Soumettre un candidat, obtenir des rapprochements justifiés, produire les pièces.",
    },
  ],

  paths: {
    "/api/avps": {
      get: {
        tags: ["Offres"],
        operationId: "listerOffres",
        summary: "Le catalogue des offres",
        description:
          "Toutes les offres, de la plus récente à la plus ancienne, avec la répartition par employeur et le rythme de publication. Les offres closes sont **conservées** et renvoyées par défaut : sur un corpus qui se renouvelle en quelques semaines, les masquer donnerait souvent une liste vide.",
        security: [],
        parameters: [
          {
            name: "ouvertes",
            in: "query",
            description: "`1` pour ne renvoyer que les offres encore ouvertes.",
            schema: { type: "string", enum: ["1"] },
          },
          {
            name: "employeur",
            in: "query",
            description:
              "Code d'employeur (`opt-nc`, `province-sud`, `nouvelle-caledonie`…). La liste des codes est dans la réponse, champ `employeurs`.",
            schema: { type: "string" },
          },
        ],
        responses: {
          200: {
            description: "Le catalogue.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    total: { type: "integer" },
                    ouvertes: { type: "integer" },
                    cloturees: { type: "integer" },
                    employeurs: {
                      type: "array",
                      description: "Répartition par organisation publique.",
                      items: {
                        type: "object",
                        properties: {
                          code: { type: ["string", "null"] },
                          nom: { type: "string" },
                          total: { type: "integer" },
                          ouvertes: { type: "integer" },
                        },
                      },
                    },
                    offres: {
                      type: "array",
                      items: { $ref: "#/components/schemas/OffreResume" },
                    },
                  },
                },
              },
            },
          },
          ...reponseErreur(
            500,
            "Le catalogue n'a pas pu être lu. La forme de l'erreur est la même partout dans l'API.",
          ),
        },
      },
    },

    "/api/avps/{slug}": {
      get: {
        tags: ["Offres"],
        operationId: "getOffre",
        summary: "L'aperçu d'une offre",
        description:
          "Aperçu public. Les missions, compétences attendues et qualifications sont réservées aux comptes connectés de l'application web ; pour les obtenir en machine, passez par `/jobposting`, qui sert la donnée source telle qu'elle est publiée.",
        security: [],
        parameters: [{ $ref: "#/components/parameters/Slug" }],
        responses: {
          200: {
            description: "L'offre.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/OffreResume" },
              },
            },
          },
          ...reponseErreur(404, "Aucune offre ne porte cette référence."),
        },
      },
    },

    "/api/avps/{slug}/jobposting": {
      get: {
        tags: ["Offres"],
        operationId: "getOffreJsonLd",
        summary: "L'offre en JSON-LD schema.org, telle que publiée",
        description:
          "Le JSON-LD **d'origine**, conservé intact depuis l'ingestion. Aucune de nos transformations n'y apparaît : c'est le point d'entrée à privilégier pour un ATS, un moteur d'indexation ou un agrégateur.",
        security: [],
        parameters: [{ $ref: "#/components/parameters/Slug" }],
        responses: {
          200: {
            description: "Le JobPosting source.",
            content: {
              "application/ld+json": {
                schema: {
                  type: "object",
                  externalDocs: { url: JOB_POSTING, description: "schema.org/JobPosting" },
                },
              },
            },
          },
          ...reponseErreur(404, "Aucune offre ne porte cette référence."),
        },
      },
    },

    "/api/metiers": {
      get: {
        tags: ["Référentiel"],
        operationId: "listerMetiers",
        summary: "Les métiers du référentiel",
        description:
          "Les familles et les métiers, avec leurs compétences attendues, leur poids et le niveau requis. C'est ce référentiel qui rend un rapprochement explicable dans un vocabulaire public et opposable, plutôt qu'en score opaque.",
        security: [],
        responses: {
          200: { description: "Familles et métiers." },
          ...reponseErreur(500, "Le référentiel n'a pas pu être lu."),
        },
      },
    },

    "/api/metiers/{code}": {
      get: {
        tags: ["Référentiel"],
        operationId: "getMetier",
        summary: "Une fiche métier",
        security: [],
        parameters: [
          {
            name: "code",
            in: "path",
            required: true,
            schema: { type: "string", examples: ["OP045"] },
          },
        ],
        responses: {
          200: { description: "La fiche et ses compétences." },
          ...reponseErreur(404, "Métier inconnu."),
        },
      },
    },

    "/api/integration/rapprochement": {
      post: {
        tags: ["Intégration"],
        operationId: "rapprocherCandidat",
        summary: "Confronter un candidat au catalogue",
        description:
          "Envoyez un JSON Resume, recevez les offres classées **avec leurs preuves** : chaque point attribué renvoie à un attendu de l'annonce et à l'élément du parcours qui le couvre.\n\nTrois catégories sortent, et la distinction compte :\n\n- `resultats` — les offres notées ;\n- `ecartes` — celles dont le candidat est **exclu**, chacune avec son motif (un permis exigé, des candidatures closes). Une contrainte dure exclut, elle ne pénalise pas : quelqu'un sans le permis requis ne doit pas apparaître à 62 %, il ne doit pas apparaître ;\n- `corpus.nonEvaluables` — celles que l'employeur n'a pas assez décrites pour être notées. Elles ne sont ni retenues ni rejetées.\n\nAucun compte n'est créé, aucun profil n'est enregistré, rien n'est transmis à un employeur.",
        security: [{ cleApi: ["rapprochement:calculer"] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  resume: { $ref: "#/components/schemas/JsonResume" },
                  options: {
                    type: "object",
                    properties: {
                      limite: {
                        type: "integer",
                        default: 20,
                        maximum: 100,
                        description: "Nombre de résultats notés. Les écartés ne sont jamais tronqués.",
                      },
                      scoreMinimal: {
                        type: "integer",
                        description: "Seuil en dessous duquel une offre n'est pas renvoyée. 45 correspond à « candidature défendable ».",
                      },
                      employeur: { type: "string", description: "Restreindre à un employeur." },
                      inclureCloturees: {
                        type: "boolean",
                        default: false,
                        description: "Inclure les offres dont la date limite est passée.",
                      },
                    },
                  },
                },
                required: ["resume"],
              },
            },
          },
        },
        responses: {
          200: {
            description: "Les rapprochements.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ReponseRapprochement" },
              },
            },
          },
          ...reponseErreur(400, "Le document n'est pas un JSON Resume exploitable."),
          ...reponseErreur(401, "Clé absente ou inconnue."),
          ...reponseErreur(403, "La clé ne porte pas la portée « rapprochement:calculer »."),
        },
      },
    },

    "/api/integration/dossier": {
      post: {
        tags: ["Intégration"],
        operationId: "produireDossier",
        summary: "Produire les pièces d'une candidature",
        description:
          "Produit la lettre et le CV recentrés sur une offre, à partir du JSON Resume soumis.\n\n⚠️ Lisez toujours `pieces.<nom>.source` : `ia` signifie rédigé par un modèle, `assemble` signifie brouillon assemblé hors ligne parce qu'aucune clé de modèle n'est configurée. Présenter un assemblage comme une rédaction tromperait votre utilisateur.\n\nLes pièces sont **retournées, jamais transmises**.",
        security: [{ cleApi: ["dossier:produire"] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  resume: { $ref: "#/components/schemas/JsonResume" },
                  slug: {
                    type: "string",
                    description: "Référence de l'offre visée, telle que renvoyée par le rapprochement.",
                  },
                  pieces: {
                    type: "array",
                    items: {
                      type: "string",
                      enum: ["lettre", "cv", "restitution", "preparation"],
                    },
                    default: ["lettre", "cv"],
                    description:
                      "`lettre` et `cv` s'adressent à l'employeur ; `restitution` (forces et écarts) et `preparation` (entretien) s'adressent au candidat.",
                  },
                  pdf: {
                    type: "boolean",
                    default: false,
                    description: "Joindre aussi chaque pièce en PDF encodé en base64.",
                  },
                },
                required: ["resume", "slug"],
              },
            },
          },
        },
        responses: {
          200: { description: "Les pièces produites." },
          ...reponseErreur(400, "JSON Resume invalide, ou offre non précisée."),
          ...reponseErreur(404, "Offre inconnue."),
          ...reponseErreur(401, "Clé absente ou inconnue."),
          ...reponseErreur(403, "La clé ne porte pas la portée « dossier:produire »."),
        },
      },
    },
  },

  // ── Webhooks ──────────────────────────────────────────────────────────
  //
  // `webhooks` est un champ de premier rang depuis OpenAPI 3.1 : on décrit ce
  // que NOUS envoyons chez l'intégrateur, dans le même document que ce qu'il
  // peut nous demander. Le déclarer ailleurs (un README, une page de doc)
  // reviendrait à laisser la moitié du contrat hors du contrat.
  webhooks: {
    avpPublie: {
      post: {
        operationId: "avpPublie",
        // La sécurité d'un webhook n'est pas une clé que le destinataire
        // présente : c'est la SIGNATURE que nous apposons, et qu'il vérifie.
        // La déclarer ici plutôt que de laisser `security` vide dit à
        // l'intégrateur qu'il a quelque chose à faire — et le linter a raison
        // d'exiger que ce soit explicite.
        security: [{ signatureWebhook: [] }],
        summary: "Un lot de nouvelles offres vient d'être ingéré",
        description:
          "Émis **une fois par lot**, jamais une fois par offre : quarante avis ingérés ne doivent pas produire quarante requêtes chez vous.\n\nLe déclencheur est l'ingestion, seul moment où l'on sait quelles offres sont *nouvelles*. Comparer des dates a posteriori renotifierait tout le catalogue au premier décalage d'horloge.\n\n**Vérifiez la signature** : l'en-tête `X-EPNC-Signature` porte `sha256=<hmac>`, HMAC-SHA256 du corps brut avec le secret convenu. Sans cette vérification, n'importe qui connaissant votre URL peut vous injecter de fausses offres.",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  evenement: { type: "string", const: "avp.publie" },
                  emisLe: { type: "string", format: "date-time" },
                  lot: {
                    type: "object",
                    properties: {
                      source: { type: "string" },
                      nouvelles: { type: "integer" },
                    },
                  },
                  offres: {
                    type: "array",
                    items: { $ref: "#/components/schemas/OffreResume" },
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description:
              "Accusé de réception. Toute réponse 2xx convient ; au-delà, l'envoi est réessayé puis abandonné, et l'échec est visible côté administration.",
          },
        },
      },
    },
  },

  components: {
    securitySchemes: {
      cleApi: {
        type: "http",
        scheme: "bearer",
        description: `Clé d'API en en-tête \`Authorization: Bearer epnc_…\`.

⚠️ **Jamais dans l'URL.** Une clé en paramètre de requête se retrouve dans les journaux du serveur, ceux du reverse proxy, l'historique du navigateur et l'en-tête \`Referer\` envoyé aux tiers. L'API refuse explicitement cette forme.

L'en-tête \`X-API-Key\` est accepté pour les clients qui ne savent écrire que celui-là.

Portées disponibles :
${Object.entries(PORTEES)
  .map(([cle, texte]) => `- \`${cle}\` — ${texte}`)
  .join("\n")}

La lecture du catalogue et du référentiel ne demande **aucune** clé : ce sont des données publiques.`,
      },

      signatureWebhook: {
        type: "apiKey",
        in: "header",
        name: "X-EPNC-Signature",
        description: `Signature des webhooks que **nous** émettons vers votre URL : \`sha256=<hmac>\`, HMAC-SHA256 du corps brut avec le secret convenu à l'enregistrement.

Vérifiez-la avant de traiter la charge utile, et à temps constant (\`crypto.timingSafeEqual\`, pas \`===\`). Sans cette vérification, quiconque connaît votre URL peut vous injecter de fausses offres ; avec une comparaison naïve, la durée de la réponse laisse deviner la signature octet par octet.`,
      },
    },

    parameters: {
      Slug: {
        name: "slug",
        in: "path",
        required: true,
        description: "Référence de l'offre.",
        schema: { type: "string", examples: ["26-64152-mprh"] },
      },
    },

    schemas: {
      Erreur: ERREUR,

      JsonResume: {
        type: "object",
        description:
          "Document au format JSON Resume. Les sections `awards`, `certificates`, `publications`, `volunteer`, `references` et `projects` ne sont pas exploitées : elles sont signalées dans `import.sectionsIgnorees` plutôt que silencieusement écartées.",
        externalDocs: { url: JSON_RESUME, description: "Schéma JSON Resume v1.0.0" },
      },

      OffreResume: {
        type: "object",
        properties: {
          idAvp: { type: "string", description: "Référence de l'avis chez l'employeur." },
          slug: { type: "string" },
          intitule: { type: "string" },
          employeur: {
            type: "object",
            properties: {
              code: { type: ["string", "null"] },
              nom: { type: "string" },
            },
            description:
              "L'organisation qui recrute. À ne pas confondre avec `direction`, qui est le service **interne** à cet employeur.",
          },
          direction: { type: ["string", "null"] },
          lieu: { type: ["string", "null"] },
          typeContrat: { type: ["string", "null"] },
          datePubliee: { type: ["string", "null"], format: "date-time" },
          dateLimite: { type: ["string", "null"], format: "date-time" },
          metier: {
            type: ["object", "null"],
            description:
              "Rattachement au référentiel, quand l'employeur le publie. Absent sur la majorité des avis hors OPT-NC.",
          },
        },
      },

      Evidence: {
        type: "object",
        description:
          "Une preuve : ce que l'offre attend, et ce qui le couvre dans le parcours. C'est ce qui distingue un score d'une opinion.",
        properties: {
          attendu: { type: "string", description: "L'attendu, tel qu'écrit dans l'annonce ou le référentiel." },
          couvertPar: { type: "string", description: "L'élément du parcours qui le couvre." },
          origine: {
            type: "string",
            description: "D'où vient la preuve : compétence déclarée, expérience, formation.",
          },
          niveauRequis: { type: ["integer", "null"] },
          niveauDeclare: { type: ["integer", "null"] },
          suffisant: { type: ["boolean", "null"] },
        },
      },

      Composante: {
        type: "object",
        properties: {
          cle: {
            type: "string",
            enum: ["referentiel", "attendusOffre", "experience", "affinite"],
          },
          libelle: { type: "string" },
          points: { type: "integer" },
          maximum: { type: "integer" },
          applicable: {
            type: "boolean",
            description:
              "`false` = composante **neutralisée**, pas nulle. Une offre sans métier rattaché n'est pas pénalisée pour une donnée que l'employeur n'a pas fournie : le score est ramené aux composantes applicables.",
          },
          note: { type: "string" },
          evidences: { type: "array", items: { $ref: "#/components/schemas/Evidence" } },
          manques: { type: "array", items: { type: "object" } },
        },
      },

      ReponseRapprochement: {
        type: "object",
        properties: {
          candidat: {
            type: "object",
            properties: {
              nom: { type: ["string", "null"] },
              intitule: { type: ["string", "null"] },
            },
          },
          corpus: {
            type: "object",
            properties: {
              offresExaminees: { type: "integer" },
              retenues: { type: "integer" },
              ecartees: { type: "integer" },
              nonEvaluables: {
                type: "integer",
                description:
                  "Offres dont l'employeur ne publie pas assez d'attendus pour être notées. Ni retenues, ni rejetées.",
              },
            },
          },
          resultats: {
            type: "array",
            items: {
              type: "object",
              properties: {
                offre: { $ref: "#/components/schemas/OffreResume" },
                score: { type: "integer", minimum: 0, maximum: 100 },
                fiabilite: {
                  type: "integer",
                  description:
                    "Part du barème (sur 100) réellement applicable. En dessous de 40, l'offre est classée non évaluable et n'apparaît pas ici.",
                },
                verdict: { type: ["object", "null"] },
                composantes: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Composante" },
                },
              },
            },
          },
          ecartes: {
            type: "array",
            description:
              "Les offres dont le candidat est exclu, **avec le motif**. Expliquer un rejet est demandé par le règlement du hackathon, et c'est ce qui rend une exclusion contestable.",
            items: {
              type: "object",
              properties: {
                offre: { $ref: "#/components/schemas/OffreResume" },
                motifs: { type: "array", items: { type: "string" } },
              },
            },
          },
          import: {
            type: "object",
            properties: {
              sectionsIgnorees: { type: "array", items: { type: "string" } },
              avertissements: {
                type: "array",
                items: { type: "string" },
                description: "Ce qui a été INTERPRÉTÉ à la lecture du JSON Resume, et mérite relecture.",
              },
            },
          },
        },
      },
    },
  },

  externalDocs: {
    description: "schema.org/JobPosting et JSON Resume, les deux schémas pivots.",
    url: JOB_POSTING,
  },
});

export default documentOpenApi;
