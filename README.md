# Emploi Public NC

**Les avis de vacance de poste de la fonction publique calédonienne, traduits
en français lisible — et le dossier de candidature qui va avec.**

Candidature au hackathon **HackAVP**.

L'outil agrège les offres de **18 employeurs publics** calédoniens (OPT-NC,
Nouvelle-Calédonie, provinces, hôpitaux, communes), explique pourquoi un poste
correspond — ou non — à un parcours, et produit les pièces d'une candidature.

---

## La démonstration, en une commande

```bash
docker compose up --build
```

→ **http://localhost:5000**

La pile monte MongoDB, ingère le corpus réel depuis l'open data, crée huit
profils de démonstration fictifs, et sert l'application.

🔴 **Aucune clé n'est nécessaire.** Sans `OPENAI_API_KEY`, les pièces sortent
en **brouillons assemblés**, clairement étiquetés comme tels à l'écran. Sans
SMTP, les envois sont **simulés** et tracés en console. Le mode dégradé n'est
pas un reliquat : c'est ce qui rend la démonstration possible hors ligne, sans
budget, et sans nous.

Comptes de démonstration créés automatiquement : `admin@epnc.nc` / `demo`, plus
huit profils candidats. Le fichier `user_test.txt` liste les identifiants.

<details>
<summary>Installation sans Docker</summary>

```bash
cp exemple.env .env        # MONGO_URI et JWT_SECRET suffisent à démarrer
npm install
npm run data:tout          # référentiel métiers + offres (open data)
npm run data:comptes-test  # profils de démonstration
npm run dev                # backend :5000 + frontend :3000
```
</details>

---

## Ce que l'outil fait, et ce qu'il refuse de faire

| | |
|---|---|
| **Aucune offre inventée** | Tout vient des avis publiés en open data. Aucune saisie manuelle. |
| **Aucun score sur une offre vide** | Quand l'employeur ne publie pas ses attendus, rien n'est déduit. « Non évaluable » est une réponse. |
| **Aucune expérience ajoutée** | Les documents ne contiennent que ce qui est dans le profil. |
| **Rien n'est envoyé sans le candidat** | Les pièces sont rendues ; la transmission reste son geste. |

---

## Ce que la donnée nous a appris

Le projet a produit trois constats **mesurés**, pas estimés :

- **74 % des offres ouvertes ne décrivent pas le poste.** 139 avis sur 189 ne
  publient ni missions ni compétences attendues — vérifié directement sur
  data.gouv.nc, où 69 enregistrements sur 100 ont tous leurs champs de contenu
  vides. Ce n'est pas une lacune de l'outil, c'est la source.
- **Le référentiel métiers ne couvre pas le corpus.** Il compte 84 métiers
  télécom, poste et banque ; les offres muettes sont des postes de santé,
  d'enseignement et de sécurité. 139 d'entre elles portent le code ROME
  `N0000`, dont le libellé source est littéralement « Hors rome ».
- **38 corps et grades** suffisent à couvrir tout le catalogue — dont
  « ACDP-grille rémunération 1-sans diplôme », qui est un libellé de grille de
  paie affiché à la place d'un métier.

C'est ce qui a décidé la ligne du projet : **traduire ce qui existe, justifier
chaque rapprochement, et dire clairement ce qu'on ignore.**

---

## Mesures

Deux bancs, rejouables :

```bash
npm run eval          # le rapprochement : matrice de confusion
npm run eval:pieces   # les documents : conformité aux contraintes produit
```

| | |
|---|---|
| Exactitude du rapprochement | 45 % |
| **Faux positifs** | **0 %** — le moteur préfère se taire que se tromper |
| Lettres : objet, vocabulaire, ouverture, 1re phrase | 100 % |
| CV : aucune expérience perdue au réordonnancement | 100 % |
| Accessibilité (axe-core, 9 écrans) | **0 violation** |

L'évaluation des documents vérifie les contraintes **sans modèle de langue** :
longueur, vocabulaire interdit, première phrase sur le poste. Écrire une
contrainte dans un prompt n'est pas la faire respecter.

---

## Architecture

> **Le cœur ne connaît que deux schémas normés :
> [`schema.org/JobPosting`](https://schema.org/JobPosting) côté offre,
> [JSON Resume](https://jsonresume.org) côté candidat. Tout le reste est un
> adaptateur.**

Conséquence directe : brancher une autre collectivité demande d'écrire un
adaptateur, pas de toucher au moteur. Et l'API publique n'expose aucun
vocabulaire maison.

```
GET  /api/avps/:slug/jobposting     le JSON-LD source, intact
POST /api/integration/rapprochement un JSON Resume → des scores justifiés
GET  /api/openapi.json              le contrat (OpenAPI 3.1, 0 erreur au lint)
npm run mcp                         serveur MCP — 4 outils pour un assistant
```

MongoDB · Node/Express 5 (ESM) · React 19 · PDFKit.
Pas de base vectorielle, pas d'orchestrateur : sur 230 offres, ce serait la
sur-ingénierie que le barème sanctionne.

`CLAUDE.md` documente chaque décision et les défauts trouvés en route.

---

## Avertissements

⚠️ **Les profils de démonstration sont fictifs.** Aucun CV de tiers.

⚠️ **Aucune candidature ne part chez un vrai employeur.** Le destinataire vient
exclusivement d'une variable d'environnement de test ; les domaines `opt.nc`,
`gouv.nc` et `drhfpnc.nc` sont refusés en dur, quoi qu'on configure.

⚠️ **Ce service n'a aucun lien officiel** avec l'OPT-NC ni avec les
collectivités dont il republie les offres.

⚠️ `docker compose config` **imprime les secrets du `.env`** en clair.
Vérifiez le fichier avec `docker compose --env-file /dev/null config`.
