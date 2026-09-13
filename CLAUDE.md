# CLAUDE.md

Repères pour travailler sur ce dépôt. À lire avant toute modification.

## 1. Ce qu'est ce projet

**Emploi Public NC (EPNC)** — plateforme qui rapproche des candidats des **avis de
vacance de poste (AVP)** de la fonction publique calédonienne (OPT-NC), explique
chaque rapprochement, et produit les pièces d'une candidature.

C'est une candidature au hackathon **HackAVP** (rendu : **21 octobre 2026, 23h59**).
Deux conséquences permanentes sur les décisions techniques :

- **Le corpus vivant est minuscule et il tourne vite.** Relevé le 13/09/2026 :
  `all_avps.jsonl` ne contient plus que **2 offres** (contre 9 le 12/09), qui
  expirent les 18 et 25 septembre. Toute infrastructure lourde (base vectorielle,
  index HNSW, orchestrateur) est disqualifiée par le critère *Adéquation
  moyens/résultats /5*. Un `cosine()` de dix lignes suffirait, et c'est un
  argument à assumer, pas une faiblesse.
- **Aucune démo, aucun persona, aucun test ne doit dépendre d'une offre précise** :
  elle aura expiré au moment du rendu. C'est une contrainte vérifiée, pas une
  précaution théorique — le corpus a perdu 7 offres sur 9 en une journée.

### Volumétrie réelle des sources (relevé du 13/09/2026)

| Source | Volume | Schéma | État |
|---|---|---|---|
| HF `all_avps.jsonl` | **2** offres ouvertes | schema.org JobPosting | ingérée |
| HF archive `data/2026/MM/` | **45** offres (juin→sept), 43 avec métier, 40 avec code ROME | JobPosting, sans `id_avp` (utiliser `identifier`) | **non ingérée** |
| data.gouv.nc DRHFPNC | **185 ouvertes / 19 573** au total | schéma plat, `codeemploirome` présent | **non ingérée** |
| RSS | 1 entrée | — | non exploitée |
| API Apigee | portail joignable, API sous clé | — | non exploitée |

L'archive et data.gouv.nc sont la seule façon d'avoir un corpus démontrable et
un jeu d'évaluation qui tienne. ⚠️ data.gouv.nc expose de vraies adresses
nominatives d'agents — même garde-fou que pour l'OPT (voir §7).

`FEUILLE-DE-ROUTE.md` contient l'analyse du règlement, le barème complet et le
plan semaine par semaine. Le consulter avant d'arbitrer une priorité.

## 2. Stack et commandes

MongoDB · Node/Express 5 (ESM) · React 19 (CRA) + Redux Toolkit Query.

```bash
npm run dev            # backend (nodemon) + frontend, en parallèle
npm run server         # backend seul, port 5000
npm run client         # frontend seul, port 3000
npm run data:import    # crée le compte admin depuis SEED_ADMIN_* (idempotent)
npm run data:destroy   # supprime TOUS les comptes
npm run data:avps      # ingère les AVP (Hugging Face JSONL) — `-- --purge` pour vider d'abord
npm run data:metiers   # ingère le référentiel métiers (CSV GitHub)
```

Ordre de mise en route à froid : `.env` → `data:metiers` → `data:avps` → `data:import` → `dev`.

## 3. Architecture — la thèse à ne pas casser

> **Le cœur ne connaît que deux schémas normés : `schema.org/JobPosting` côté
> offre, `JSON Resume` côté candidat. Tout le reste est un adaptateur.**

C'est ce qui porte quatre critères du barème (Standards /6, Intégrabilité /8,
Réutilisabilité /4, Maintenabilité /5). Concrètement :

- `backend/services/avpNormaliser.js` est le **seul** fichier à réécrire pour
  brancher une autre source de JobPosting. Rien d'autre ne connaît la forme
  d'origine.
- `AvpModel.raw` conserve le JSON-LD **intact**. On n'y touche jamais : c'est lui
  que ressort `GET /api/avps/:slug/jobposting`.
- `ProfilModel` suit la structure JSON Resume (`basics`, expériences, formations,
  compétences, langues) avec des noms français.

```
backend/
  config/       db.js · sources.js (inventaire unique des sources publiques)
  models/       Avp · Profil · Candidature · User · Metier/Famille/Competence · Conversation
  services/     avpNormaliser · matchingService · redactionService · modeleService
                assistantService · sourcesService · smtpService
  controllers/  un par domaine     routes/  un routeur par domaine
  middleware/   authMiddleware (protect/admin) · asyncHandler · errorMiddleware
  ingestAvps.js ingestMetiers.js seeder.js
frontend/src/
  screens/      un dossier par écran, CSS colocalisé
  slices/       RTK Query, un slice par domaine (apiSlice = socle + tagTypes)
  constants.js  libellés, statuts, pièces, URLs d'API
```

## 4. Le moteur de rapprochement

`backend/services/matchingService.js` — **c'est le cœur noté du projet.**

Pivot : le **référentiel métiers OPT**. L'offre porte un `code_metier`, le métier
porte ses compétences avec **poids** et **niveau requis**. Le score se formule donc
dans un vocabulaire public et opposable, jamais en similarité opaque.

Barème interne (100 pts ramenés aux composantes *applicables*) :
`referentiel 45 · attendusOffre 25 · experience 15 · affinite 15`.

Règles qu'il ne faut pas affaiblir :

1. **Chaque point pointe vers deux extraits** — l'attendu de l'offre et la preuve
   du profil (`evidences[]`). Un score sans justification ne vaut rien.
2. **Les contraintes dures filtrent, elles ne pondèrent pas** (`filtresBloquants`).
   Quelqu'un sans le permis exigé ne doit pas apparaître à 62 % : il ne doit pas
   apparaître, avec le motif. C'est la seule façon de tenir « absence de faux
   positifs ».
3. **Les écartés sont renvoyés à part avec leur motif** (`rapprocherToutes`). Le
   règlement demande d'expliquer les **rejets** — presque personne ne le fera.
4. **Composante non applicable = neutralisée, pas à zéro.** Une offre sans métier
   rattaché ne doit pas être pénalisée pour une donnée manquante côté employeur.
5. **Calibrage assumé** : couvrir 60 % des attendus pondérés vaut la note maximale.
   Le référentiel décrit tout ce qu'un métier mobilise ; exiger 100 % ferait
   plafonner tout le monde et ne hiérarchiserait plus rien.

Pièges déjà rencontrés et corrigés — ne pas les réintroduire :

- La détection de permis lit le texte **d'origine en majuscules**. Sur le texte
  normalisé, « permis B, A2 + aptitude à la conduite **d'un** deux roues » faisait
  apparaître un permis « A » et un permis « D ».
- `couvrance()` est **asymétrique** (part de l'attendu couverte), pas un Jaccard :
  une expérience décrite en trois lignes faisait chuter le score alors qu'elle
  couvrait l'attendu.
- Un rattachement métier incohérent (intitulé **et** famille divergents) neutralise
  la composante référentiel au lieu de noter un profil juridique sur des
  compétences marketing.

`analyserMetier()` compare un profil à un **métier** indépendamment de toute offre :
le référentiel décrit ~80 métiers là où 9 postes sont ouverts.

## 5. La rédaction des pièces

`backend/services/redactionService.js` produit les quatre pièces attendues :
`lettre` · `cv` (→ employeur) · `restitution` · `preparation` (→ candidat).

- **Deux modes** : `OPENAI_API_KEY` renseignée → rédaction par le modèle
  (`source: "ia"`) ; clé absente → **brouillon assemblé** hors ligne
  (`source: "assemble"`, préfixé d'un avertissement visible). Le mode dégradé
  n'est pas un reliquat : il garde la démo possible sans clé et sans réseau.
- **Aucun repli silencieux** : si l'appel au modèle échoue, l'erreur remonte à
  l'écran. Quelqu'un qui croit lire un texte rédigé enverrait un assemblage.
- **Passe de critique** (lettre et CV seulement) : un second appel note la pièce
  « en recruteur » sur 10 en JSON strict ; sous `CRITIQUE_SEUIL` (défaut 7) **ou**
  dès qu'une invention est signalée, une réécriture est produite — puis **renotée**,
  et on garde la meilleure des deux versions.
- **Ne jamais joindre le rapprochement par mots au prompt.** Il l'a été : le modèle
  l'a suivi contre le profil et a écrit « vous n'avez pas de formation juridique
  bac+3 » à une candidate titulaire d'une licence de droit. Une heuristique plus
  faible que le modèle ne doit pas l'orienter.
- Les contraintes produit (250–300 mots, première phrase sur le poste, vocabulaire
  interdit) sont **dans les prompts**, pas dans la documentation. Le jury dépouille
  CV + lettre **à l'aveugle** : 25 points s'y jouent.

## 6. La sortie du système (fonction ④)

`backend/services/envoiService.js` — trois sorties, et leur différence est le sujet :

| Sortie | Route | Contenu |
|---|---|---|
| Une pièce | `GET /api/candidatures/:id/pieces/:piece/pdf` | un PDF |
| Le dossier | `GET /api/candidatures/:id/dossier` | ZIP : `1-a-transmettre/` (lettre, CV) · `2-pour-vous/` (analyse, prépa) · `profil.json` · `LISEZ-MOI.txt` |
| Le profil | `GET /api/candidatures/:id/resume.json` | JSON Resume ciblé sur l'offre |
| L'envoi | `POST /api/candidatures/:id/envoi` | email : **lettre et CV, rien d'autre** |

- **L'employeur ne reçoit que la lettre et le CV**, et **aucune mention de la
  façon dont ils ont été produits** — c'est écrit dans le règlement. Les PDF
  destinés à l'employeur ne portent donc ni titre d'outil, ni pied de page ; ceux
  destinés au candidat s'annoncent, eux, comme des documents de préparation.
  Voir `pdfService.POUR_EMPLOYEUR`.
- **`replyTo` = l'email du candidat.** Le message part de la boîte technique, mais
  l'employeur doit pouvoir répondre à la personne.
- **PDF reproductibles** : la date inscrite dans le document est celle de la
  génération de la pièce, pas l'heure courante. Régénérer une pièce inchangée
  redonne le même fichier octet pour octet (vérifié).
- **Sans SMTP, l'envoi est simulé**, pas en échec : la chaîne complète s'exécute,
  les PDF sont produits, le message est tracé en console. `envois[].simule`
  conserve la distinction, et l'interface **doit** l'afficher — croire avoir
  envoyé une candidature qui n'est jamais partie est la pire issue possible.
- PDFKit, pas un navigateur sans interface : 300 Ko contre 300 Mo de Chromium
  pour quatre documents en texte suivi. `archiver` 8 n'exporte plus de fabrique
  par défaut — on importe `{ ZipArchive }`.

## 7. Invariants de sécurité et de données

- 🔴 **Aucune adresse de recrutement réelle ne doit être joignable par le code.**
  Les fiches en contiennent : `DRH-candidature@opt.nc` dans `raw.applicationContact`
  côté OPT-NC, `drhfpnc.recrutement@gouv.nc` et des adresses nominatives d'agents
  côté data.gouv.nc. Trois verrous, à ne jamais affaiblir :
  1. `applicationContact` n'apparaît dans **aucune vue applicative**
     (`avpController.vuePublique` / `vueComplete`).
  2. Le destinataire d'un envoi vient **exclusivement** de `CANDIDATURE_EMAIL_TEST`,
     jamais de l'offre. Variable vide = envoi impossible, volontairement.
  3. `envoiService.DOMAINES_INTERDITS` refuse `opt.nc`, `gouv.nc` et `drhfpnc.nc`
     quoi qu'on ait configuré, et le contrôle est répété juste avant le `sendMail`.

  Une candidature de démo partie chez une vraie DRH disqualifie le projet et fait
  perdre son temps à une personne réelle.
- **Profils fictifs uniquement** (ou le nôtre). Aucun CV de tiers. La vidéo sera
  publique et les données transitent par des prompts.
- Le profil et les candidatures sont **toujours ceux de la personne connectée** :
  aucun identifiant de profil dans l'URL, filtre systématique `{ _id, user }`, et
  une ressource d'autrui renvoie **404, jamais 403**.
- Le mot de passe est `select: false` ; le jeton de réinitialisation n'existe en
  clair que dans l'email (SHA-256 en base).
- JWT en **cookie httpOnly** : `credentials: "include"` côté RTK Query,
  `credentials: true` côté CORS. Le 401 est traité une fois pour toutes dans
  `apiSlice`, sauf sur `/login` et `/register`.
- **Cloisonnement public / privé** : liste et aperçu des offres publics ; missions,
  compétences attendues et qualifications réservés aux comptes. C'est ce qui
  justifie la création d'un compte.
- Les offres **clôturées sont conservées** : historique, corpus de test, et calcul
  du rythme de publication (`rythmePublication`).

## 8. Conventions

- **Tout est en français** : noms de fichiers, variables, fonctions, commentaires,
  messages d'erreur. `rapprocher`, `composanteReferentiel`, `motifsExclusion`.
  Exceptions conservées telles quelles : les champs schema.org dans `raw`, et
  l'API Mongoose.
- **ESM partout** (`"type": "module"`), `import`/`export` nommés.
- **Les commentaires expliquent POURQUOI, jamais QUOI.** Le style du dépôt
  documente les décisions et les bugs évités, souvent avec le cas réel qui les a
  motivés. C'est délibéré : l'article dev.to (noté) s'écrit à partir de là. Un
  commentaire qui paraphrase la ligne suivante n'a pas sa place.
- Les messages d'erreur du backend sont **affichés tels quels** par le front. Ils
  s'adressent à un candidat, pas à un développeur : « Session expirée :
  reconnectez-vous », pas « Token non valide ».
- **Routes fixes avant routes paramétrées**, sans exception (`/login` avant `/:id`,
  `/competences/liste` avant `/:code`).
- Les libellés affichés vivent dans `frontend/src/constants.js` ; les listes
  techniques (statuts, pièces) ont **une seule source** côté serveur, que le front
  se contente d'habiller.
- Accessibilité : lien d'évitement, `role="status"` / `role="alert"` sur les états
  asynchrones, `aria-labelledby` sur les sections. Toute nouvelle vue doit suivre —
  c'est 4 points au barème et le sujet même du hackathon.
- `exemple.env` doit documenter **toute** variable lue par le code, même vide, et
  être mis à jour dans le même commit.

## 9. État d'avancement

**Fait** — socle d'authentification et d'administration (comptes, SMTP, supervision
des sources) ; ingestion idempotente des AVP et du référentiel métiers ; profil
candidat ; moteur de rapprochement explicable avec écartés motivés ; fiches métier
avec analyse d'écart ; production des quatre pièces avec passe de critique ;
assistant conversationnel contextualisé ; suivi des candidatures ;
**fonction ④ complète** (PDF, ZIP, export JSON Resume, envoi email avec
garde-fou destinataire et mode simulé) — la chaîne ①→④ est démontrable de
bout en bout.

**Manquant — par ordre d'impact sur le barème :**

1. **Corpus** — l'archive HF (45 offres) et data.gouv.nc (185 ouvertes) ne sont
   pas ingérées. Avec 2 offres vivantes, la démo et l'évaluation sont trop
   maigres. L'archive demande ~30 lignes dans `ingestAvps.js` ; data.gouv.nc
   demande un second normaliseur, et prouve au passage que l'architecture
   essaime (*Réutilisabilité /4*).
2. **Jeu d'évaluation** — 8 personas fictifs en JSON Resume + matrice étiquetée
   persona × AVP + `npm run eval` (précision, rappel, confusion). C'est ce qui
   transforme « notre matching est pertinent » en preuve chiffrée. Dépend du
   point 1 : une matrice sur 2 offres ne prouve rien.
3. **Injecter les `evidences[]` du matching dans les prompts de rédaction** —
   aujourd'hui `redactionService` envoie la fiche et le profil entiers, alors que
   `matchingService` a déjà isolé les extraits qui se répondent. ~2 h, agit sur
   *Qualité des documents /5*, *Restitution /5* et *Effet sur la décision /5*.
4. **Intégrabilité /8** — OpenAPI publiée, webhook « nouvel AVP », serveur MCP en
   wrapper fin sur l'API existante.
5. **Entrée du profil** — import JSON Resume et upload de CV PDF ; aujourd'hui la
   saisie manuelle est la seule porte, alors que le règlement insiste sur le
   candidat *sans* CV.
6. **Reformulation du jargon en langage clair** (`corpsDomaine`,
   `informationsLibres`) — c'est littéralement le problème énoncé par le hackathon.
7. **Embeddings** (`all_embeddings.parquet`) non exploités — optionnel, et à ne
   faire qu'en rappel : le vecteur ne couvre que la description, pas `skills` ni
   `responsibilities`.
8. **Livraison** — `docker compose up`, passe axe/`eslint-plugin-jsx-a11y`, vidéo,
   article dev.to. Gel du code au **18 octobre**.

**Décisions encore ouvertes** : track (SaaS recommandé — 25 points de valeur RH se
jouent sur la qualité du français) à déclarer **avant le 30 septembre** ; public
cible unique ; CRA conservé ou bascule Vite (`react-scripts` n'est plus maintenu —
touche *Maintenabilité /5*).
