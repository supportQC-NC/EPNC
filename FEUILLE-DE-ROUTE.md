# HackAVP — Feuille de route

> Analyse du règlement + reconnaissance de la donnée réelle + plan de bataille.
> Stack : **MongoDB** (base interne) + **React (CRA)** + **Node/Express**.
> Rédigé le 12 septembre. Rendu : **mercredi 21 octobre, 23h59**. Restant : **5 semaines et 4 jours**, en soirée.

---

## 0. Ce que dit la donnée réelle (reconnaissance faite le 12/09)

J'ai ouvert le dataset avant d'écrire le plan. Trois faits changent complètement la stratégie.

### 🔴 Fait n°1 — le corpus fait **9 offres**, pas des milliers

`opt-nc/odata-avps` → **9 lignes**, 71 Ko de JSONL, 61 Ko d'embeddings. Taille annoncée par Hugging Face : `< 1K`. 62 téléchargements le mois dernier.

Conséquences, toutes majeures :

- **Toute infrastructure de recherche vectorielle est disqualifiée.** Atlas Vector Search, index HNSW, base vectorielle dédiée : pour 9 vecteurs, c'est le « bazouka pour une mouche » que le critère *Adéquation moyens/résultats /5* punit explicitement. Un `cosine()` de 10 lignes en JavaScript pur suffit, et il faut **l'assumer et l'expliquer** dans l'article — c'est un point gagné, pas une faiblesse.
- **La recherche n'est pas le problème.** Trouver le bon poste parmi 9 est trivial ; un humain le fait en 5 minutes. Donc la valeur de notre projet **ne peut pas** être dans le moteur de recherche. Elle est dans la **profondeur d'analyse par offre** et la **qualité des documents produits**. C'est exactement là que pointent les 25 points de Valeur RH. Le règlement et la donnée disent la même chose.
- **On peut tout évaluer exhaustivement.** 8 profils × 9 AVP = 72 paires. C'est étiquetable à la main en une soirée. On ne fait pas un échantillonnage : on produit une **matrice de confusion complète**. Aucun autre hackathon ne permet ça.

### 🔴 Fait n°2 — le corpus **tourne entièrement** avant le rendu

Les offres présentes portent `datePosted` fin août et `validThrough` **11, 18 et 25 septembre 2026**. Le dataset n'a pas été régénéré depuis le 6 septembre.

Autrement dit : **les 9 AVP d'aujourd'hui auront quasiment tous expiré le 21 octobre.**

- Interdiction absolue de concevoir personas et démo autour d'un AVP précis. Tout doit marcher sur le corpus du jour, quel qu'il soit.
- L'archive `data/2026/MM/` (un JSON par AVP et par mois) est notre réserve : elle permet de constituer un corpus de test bien plus large que les 9 offres vivantes. À aspirer dès la semaine 1.
- Le renouvellement rapide **valide le scénario « veille + alerte »** : sur un corpus qui se renouvelle intégralement en quelques semaines, un service qui prévient le candidat a un vrai sens métier.

### 🟢 Fait n°3 — le schéma est beaucoup plus riche qu'annoncé, et pointe vers **ROME**

Champs réellement présents et exploitables :

| Champ | Ce qu'on en fait |
|---|---|
| `skills[]`, `responsibilities[]` | Attendus du poste, phrase par phrase → base du scoring et des `evidence[]`. |
| `educationRequirements.competencyRequired[]` | Compétences exigées, déjà listées. Cadeau. |
| `experienceRequirements`, `qualifications`, `physicalRequirement` | Contraintes dures et conditions. |
| **`experienceInPlaceOfEducation`** (booléen) | 💎 La donnée dit explicitement si l'expérience peut remplacer le diplôme. Exploiter ce champ = équité pour les profils sans diplôme, et maîtrise fine du schéma. Personne ne le verra. |
| `relevantOccupation.code_metier` + `fiche_metier_url` | Lien direct vers la fiche métier du référentiel OPT → pivot d'explicabilité. |
| **`relevantOccupation.occupationalCategory.codeValue`** | 💎 C'est un **code ROME** (K1901, I1306, K1205…). Passerelle vers le référentiel France Travail → un profil décrit en vocabulaire métropolitain devient rapprochable. Gros levier *Standards /6* et *Intégrabilité /8*. |
| `additionalType.corpsDomaine`, `direction`, `informationsLibres[]` | Le jargon administratif brut (« Contrôleur ou Agent d'exploitation », « corps »). C'est **la matière à traduire en langage clair** — le problème énoncé par le hackathon, littéralement dans un champ. |
| `applicationContact.email` | ⚠️ Vaut `DRH-candidature@opt.nc`. **Ne jamais câbler cette adresse en dur dans l'envoi de mail.** Une démo qui part en vrai chez la DRH de l'OPT, c'est l'accident qui disqualifie. Adresse de destination forcée par variable d'environnement, et jamais la vraie. |
| `validThrough`, `totalJobOpenings`, `directApply` | Filtres de fraîcheur et de volume. |

Le parquet d'embeddings a pour colonnes `reference`, `title`, `text`, `embeddings` — donc **le texte source embarqué est livré avec le vecteur**. Deux choses en découlent :

1. Le vecteur ne couvre que ce `text` (la description), **pas** `skills` ni `responsibilities`. La similarité sémantique fournie est donc partielle. Notre scoring ne doit pas se reposer dessus seul.
2. On peut **identifier le modèle par expérience** : ré-embarquer un `text` connu avec un modèle candidat et comparer le cosinus au vecteur fourni. Un cosinus ≈ 1.0 identifie le modèle. Taille des vecteurs déduite du fichier : **~1536 dimensions** (signature `text-embedding-3-small` / `ada-002`). **À confirmer à l'onboarding du 16/09** — c'est la question n°1 à poser.

⚠️ Licence du dataset : `unknown` / « à préciser par le propriétaire ». À faire clarifier le 16/09, surtout si on part sur la track onPrem où la cohérence des licences est notée.

---

## 1. Lecture stratégique : où sont réellement les points

| Strate | Pts | Ce qui le déclenche vraiment |
|---|---|---|
| ① Socle commun | 30 | Standards/Open Data **/6** est le plus gros critère unitaire du hackathon. Accessibilité /4 est le sujet même. |
| ② Technicité | 25 | Pertinence des ressources /8 + Intégrabilité ATS /8 = 16 pts sur des sujets que la plupart des équipes vont bâcler. |
| ② Valeur RH | 25 | Jugé **à l'aveugle** : le jury dépouille CV + lettre comme un recruteur. Zéro crédit pour le code. |
| ③ Track | 20 | Noté sur le *moyen*, pas le résultat. Le résultat du matching est déjà noté en Valeur RH. |

### Les quatre pièges du règlement

1. **« Adéquation moyens/résultats /5 »** — un critère qui **pénalise la sur-ingénierie**. Avec 9 offres, c'est le piège principal du hackathon. Sobriété assumée et argumentée.
2. **« Une pièce montrée dans la vidéo sans qu'on voie votre solution la produire n'est pas comptabilisée »** — la vidéo n'est pas une illustration, c'est la **preuve**. On construit dans l'ordre de la démo.
3. **« pourquoi tel autre rapprochement a été écarté »** — le règlement demande d'expliquer les **rejets**. Presque personne ne le fera. C'est un écran à part entière chez nous. Avec 9 AVP, on peut même montrer **les 9 verdicts** pour un profil : match, limite, écarté + raison. Luxueux et imparable.
4. **« un service de veille qui s'arrête à la notification ne concourt pas »** — quel que soit le point d'entrée choisi, la chaîne doit aller jusqu'aux documents transmis.

---

## 2. La thèse d'architecture (à décider maintenant)

**Le cœur ne connaît que deux schémas normés : `schema.org/JobPosting` côté offre, `JSON Resume` côté candidat. Tout le reste est un adaptateur.**

Une seule décision, quatre critères adressés :

- Standards & Open Data **/6** → on ne fait pas *que* consommer schema.org : c'est notre modèle interne, et on le ressort. Bonus ROME via `occupationalCategory`.
- Intégrabilité ATS **/8** → toute source publiant du JSON-LD JobPosting se branche ; tout ATS lisant du JSON Resume nous consomme.
- Réutilisabilité & essaimage **/4** → « pour brancher une autre collectivité, écrivez un adaptateur de 80 lignes ».
- Maintenabilité **/5** → un seul modèle pivot, pas de mapping ad hoc.

```
  SOURCES (adaptateurs)          CŒUR (agnostique)                 SORTIES (adaptateurs)
  ┌────────────────────┐        ┌──────────────────────┐          ┌─────────────────────┐
  │ avps-api (Apigee)  │───┐    │  MongoDB             │      ┌──▶│ ZIP (4 pièces)      │
  │ HF all_avps.jsonl  │───┤    │   avps (JobPosting)  │      │   │ Mail (adresse test) │
  │  + all_embeddings  │   ├───▶│   metiers            │      ├──▶│ JSON Resume ciblé   │
  │ archive data/2026  │───┤    │   competences        │      │   │ API REST + OpenAPI  │
  │ MCP AVPs (client)  │───┤    │   profils (Resume)   │──────┤   │ notre serveur MCP   │
  │ metiers-opt API    │───┤    │   matches (+evidence)│      └──▶│ webhook ATS         │
  │ + tout JSON-LD     │───┘    │   candidatures       │          └─────────────────────┘
  └────────────────────┘        └──────────┬───────────┘
                                           │
                                  React (CRA) — SPA
                                  candidat · recruteur · explicabilité
```

### Collections MongoDB

| Collection | Rôle | Points d'attention |
|---|---|---|
| `metiers` | Référentiel OPT (12 familles, fiches, compétences) + code ROME. Statique, seedé. | **Pivot d'explicabilité** : le score parle en compétences du référentiel public, pas en cosinus. |
| `competences` | Vocabulaire normalisé + alias/synonymes + traduction jargon ↔ langage courant. | Sert au matching *et* à l'accessibilité. |
| `avps` | JobPosting brut dans `raw` + champs normalisés + `embedding[]` + `md5_hash` + `validThrough`. | Ne jamais perdre le JSON-LD source. Garder les expirés (historique + corpus de test). |
| `profils` | JSON Resume + `embedding[]` + compétences normalisées + contraintes. | Profils **fictifs** uniquement (cf. §7). |
| `matches` | `{profil_id, avp_id, verdict, score, breakdown[], evidence[], rejet_motif, model_version, computed_at}` | Persister = score auditable + veille + démo reproductible. |
| `candidatures` | `{profil_id, avp_id, assets{lettre, cv, restitution, prepa}, statut, exported_at}` | La candidature devient un objet, pas un téléchargement fugace. C'est ce qui rend ④ crédible. |
| `ingest_runs` | Journal des synchros : source, date dataset, nb docs, durée, diff. | 2 lignes de code, effet sérieux en démo et en article. |

---

## 3. Le moteur de matching

Le règlement demande : **score explicable, peu de faux positifs, justification des écarts**. Un cosinus nu ne répond à aucun des trois — et sur 9 documents, il ne sert presque à rien.

### Score hybride, 100 points

| Composante | Poids | Source dans la donnée |
|---|---|---|
| Couverture des compétences attendues | 40 | `educationRequirements.competencyRequired[]` + `skills[]` + fiche métier |
| Adéquation aux missions | 20 | `responsibilities[]` |
| Proximité sémantique profil ↔ AVP | 15 | embeddings (rappel seulement — le vecteur ne couvre que la description) |
| Expérience / séniorité | 15 | `experienceRequirements`, `additionalType.corpsDomaine` |
| Proximité famille métier / ROME | 10 | `relevantOccupation` |
| Contraintes dures (lieu, permis, diplôme, aptitude) | — | `qualifications`, `physicalRequirement`, `jobLocation` → **filtre bloquant** |

Trois règles non négociables :

1. **Chaque point du score pointe vers deux extraits** : la phrase de l'AVP (l'attendu) et la phrase du profil (la preuve), stockées dans `evidence[]`. C'est ça, « explicable ».
2. **Les contraintes dures filtrent, elles ne pondèrent pas.** Seule façon de tenir « absence de faux positifs ». Un candidat sans permis A2 ne doit pas apparaître à 62 % sur un poste de préposé à la distribution.
3. **`experienceInPlaceOfEducation` est respecté.** Quand la donnée dit que l'expérience remplace le diplôme, le filtre diplôme se désarme. C'est un geste d'équité que la donnée autorise explicitement.

### Le geste data analyst qui fait la différence

Le corpus tient dans une matrice. On en profite : **étiqueter à la main les 72 paires (8 personas × 9 AVP)** en trois classes — pertinent / limite / hors sujet — puis mesurer à chaque itération précision, rappel et **matrice de confusion complète**, pas un échantillon.

Ça transforme « notre matching est pertinent » (affirmation) en « voici la matrice, voici les 3 erreurs et pourquoi » (preuve). Ça alimente *Qualité du matching /5*, *Maintenabilité /5*, et ça donne à l'article dev.to sa section la plus solide. Presque personne ne produira de chiffres.

Reconstituer un corpus élargi depuis l'archive `data/2026/MM/` pour éprouver la robustesse sur plus de 9 offres.

---

## 4. Les 4 fonctions obligatoires — parti pris

| # | Fonction | Parti pris | Piège à éviter |
|---|---|---|---|
| ① | Un profil entre | Trois portes : upload CV (PDF → extraction), import/saisie **JSON Resume**, **entretien guidé** pour qui n'a pas de CV. | Ne pas faire du PDF le chemin obligatoire : le règlement insiste sur le candidat *sans* CV. |
| ② | Le matching | Bidirectionnel : profil → AVP ouverts, **et** nouvel AVP → vivier (veille). Même moteur, deux entrées. Afficher **les 9 verdicts**, pas un top-3. | Ne pas masquer les rejets : ils sont notés. |
| ③ | Les 4 pièces | Lettre · CV recentré · **restitution forces/écarts** · **prépa entretien** dérivée de la restitution. | Les deux pièces « candidat » pèsent 10 pts (restitution /5 + documents /5) et sont souvent bâclées. |
| ④ | La candidature part | ZIP téléchargeable + envoi mail (**vers une adresse de test, jamais `DRH-candidature@opt.nc`**) + archivage en base avec ID. | Le jury lit **CV + lettre seuls**. Ces 2 fichiers doivent tenir debout sans contexte. |

### Qualité des documents : les règles qu'on code dans les prompts

Le jury dépouille. Un pavé poli et interchangeable part en bas de la pile. Contraintes produit, pas suggestions :

- **Lettre** : 1 page, 250–300 mots max, 3 preuves du profil **explicitement mappées aux `skills[]` / `responsibilities[]` de l'AVP**. Interdiction lexicale : « dynamique », « motivé », « passionné », « votre prestigieuse institution ». Première phrase = le poste, pas le candidat.
- **CV recentré** : ordre des rubriques piloté par l'AVP, bullets réécrits avec le vocabulaire du poste. **Aucune information absente du profil source** — traçabilité obligatoire, sinon on fabrique des mensonges.
- **Passe de critique** : un second appel LLM note la lettre sur une grille de recruteur (répond-elle au poste ? se lit-elle en 40 s ? donne-t-elle envie ?) et déclenche une réécriture sous le seuil. ~1 h de code, effet direct sur *Effet sur la décision /5*.
- **Anti-générique par construction** : on injecte les extraits exacts de l'AVP + les `evidence[]` du matching — **pas** le CV entier ni l'AVP entier.
- Rendu PDF **côté serveur** (déterministe), pas depuis le navigateur.

---

## 5. Choix de track — recommandation

**Recommandation : `🤯 SaaS no limit`**, sauf si l'équipe dispose d'une vraie machine (Mac Studio, DGX Spark, GPU 24 Go+).

L'argument décisif est dans le barème, pas dans la technique : **25 points de Valeur RH sont jugés à l'aveugle sur la qualité rédactionnelle française** d'une lettre et d'un CV. Un modèle local 7–8B produit du français visiblement plus faible qu'un modèle frontière. On perdrait sur la strate commune (notée pour tout le monde) pour gagner sur la strate track.

Nuance apportée par la reconnaissance : avec **9 documents**, la partie *matching* tourne en local sans aucune difficulté — un cosinus sur 9 vecteurs ne demande pas de GPU. La contrainte onPrem ne coûte donc rien sur ②, **uniquement sur la génération de texte**. Si quelqu'un dans l'équipe a une machine capable de faire tourner un modèle 30B+ en français correct, onPrem redevient jouable et très différenciant.

Si onPrem : deux points à traiter par écrit — (a) MongoDB Community est sous **SSPL**, non approuvée OSI, et le critère « cohérence des licences de la stack /2 » le verra ; (b) la licence du dataset AVP est `unknown`, à faire préciser.

**Décision au plus tard le 30 septembre.** Déclaration obligatoire au rendu.

---

## 6. Plan semaine par semaine

Règle : **chaque vendredi, une tranche démontrable de bout en bout**. Jamais de semaine qui finit sur « ça marchera quand X sera fini ».

### S0 — 12 → 16 sept · Décisions & onboarding
- [x] Reconnaissance de la donnée (faite — cf. §0).
- [ ] **Questions à poser à l'onboarding du 16/09** :
  1. Quel modèle a produit les embeddings du parquet ? (hypothèse : 1536 dims, famille OpenAI)
  2. Sous quelle licence le dataset est-il publié ?
  3. Quelle est la fréquence de régénération de `all_avps.jsonl` ? (dernier build : 06/09)
  4. L'API Apigee demande-t-elle une clé, et quels quotas ?
- [ ] Brancher le MCP AVPs sur un agent conversationnel, jouer 10 questions de candidat. Meilleure façon de comprendre la donnée en 1 h.
- [ ] Décider : **public cible unique**, **track**, répartition des rôles.
- [ ] Dépôt Git + `docs/` : chaque décision d'archi = une note datée. L'article dev.to s'écrira tout seul.

### S1 — 16 → 23 sept · Socle données
- [ ] Seed `metiers` + `competences` depuis `odata-referentiel-metiers` (GitHub, statique).
- [ ] Ingestion `avps` : `raw` intact + champs normalisés + `md5_hash` pour le diff.
- [ ] **Aspirer l'archive `data/2026/MM/`** pour constituer un corpus de test élargi.
- [ ] Résoudre la question du modèle d'embedding (test cosinus ≈ 1.0 sur un `text` connu). Plan B : ré-embarquer 9 docs, 10 secondes.
- [ ] **8 personas fictifs** en JSON Resume, conçus **indépendamment des AVP du moment** : reconversion, sortie de BTS, sur-qualifié, hors territoire, sans diplôme mais 15 ans d'expérience, profil technique télécoms, profil administratif, profil relation client. Ils servent de jeu de test *et* de démo *et* d'eval set.
- [ ] `npm run ingest` idempotent + `ingest_runs` journalisé.
- [ ] **Trancher CRA vs Vite** (cf. §7). Maintenant ou jamais.
- 🎯 **DoD** : ingestion depuis zéro + une requête shell qui sort les AVP proches d'un persona.

### S2 — 23 → 30 sept · Fonctions ① et ② (le moteur)
- [ ] API Express : `POST /profils`, `GET /profils/:id/matches`, `GET /avps/:id/candidats`.
- [ ] Scoring hybride complet : `breakdown[]`, `evidence[]`, filtres bloquants, `experienceInPlaceOfEducation`.
- [ ] Écran « résultats » : score, ventilation par critère, extraits AVP ↔ profil en regard.
- [ ] Écran **« les 9 verdicts »** : match / limite / écarté + motif de rejet.
- [ ] **Matrice d'évaluation 8×9 étiquetée** + `npm run eval` → précision, rappel, confusion.
- [ ] Import JSON Resume + upload PDF avec extraction.
- 🎯 **DoD** : un persona entre, tous les verdicts expliqués sortent à l'écran. **Track déclarée.**

### S3 — 30 sept → 7 oct · Fonction ③ (les 4 pièces)
- [ ] Générateur lettre + CV recentré, avec passe de critique et contraintes lexicales.
- [ ] Restitution du matching (forces / écarts / que faire de l'écart) — version candidat lisible, pas un dump JSON.
- [ ] Prépa entretien dérivée de la restitution : questions probables sur les écarts, arguments, questions à poser.
- [ ] Rendu PDF serveur + export JSON Resume ciblé.
- [ ] Cache des générations par `(profil, avp, version_prompt)` — démo fluide, budget maîtrisé.
- 🎯 **DoD** : les 4 pièces sortent en PDF pour n'importe quel couple (persona, AVP). **Faire relire la lettre par quelqu'un qui recrute pour de vrai.**

### S4 — 7 → 14 oct · Fonction ④, accessibilité, intégrabilité
- [ ] ZIP + envoi mail (adresse de test en variable d'environnement) + archivage `candidatures`.
- [ ] **Passe accessibilité** : clavier complet, `aria-live` sur les résultats asynchrones, contrastes AA, score jamais codé par la couleur seule, `lang`, gestion du focus. `eslint-plugin-jsx-a11y` + axe, zéro violation critique.
- [ ] **Reformulation en langage clair** de `corpsDomaine`, `informationsLibres[]` et de la description, avec glossaire adossé au référentiel. C'est littéralement le problème énoncé par le hackathon.
- [ ] Intégrabilité : **OpenAPI** publiée + webhook « nouvel AVP » + **notre propre serveur MCP** (`search_jobs`, `match_profile`, `generate_application`) en wrapper fin sur notre API.
- [ ] `docker compose up` → démo complète, seed comprise.
- 🎯 **DoD** : un inconnu installe et fait tourner la démo sans nous.

### S5 — 14 → 21 oct · Gel, preuve, rendu
- **Sam. 18 oct : CODE FREEZE.** Plus aucune feature.
- [ ] **Vidéo** 3–4 min : chaîne complète ① → ④, **prise continue sur la partie génération**. Script écrit avant de tourner. Une pièce non produite à l'écran n'existe pas.
- [ ] **Article dev.to** : problème → donnée → décisions d'archi → moteur → **matrice d'évaluation chiffrée** → limites assumées → comment essaimer.
- [ ] Relecture accessibilité + orthographe (l'article est noté).
- [ ] Soumission sur https://forms.gle/Fin8PMMWcpAi7yEd7 **avant le 21 à 18h**, pas à 23h30.

---

## 7. Règles et risques

| Risque | Parade |
|---|---|
| ⚠️ **Mail parti en vrai chez la DRH de l'OPT** | `applicationContact.email` = `DRH-candidature@opt.nc` est dans la donnée. Destinataire **forcé par variable d'environnement**, garde-fou en dur, jamais la vraie adresse. Le règlement le dit : ne pas candidater pour de vrai. |
| ⚠️ **Données personnelles** | Profils **fictifs** uniquement (ou le nôtre). Aucun CV de tiers sans accord écrit. La vidéo sera publique ; les données transitent par prompts et logs. |
| **Corpus expiré le jour du rendu** | Les AVP actuels expirent entre le 11 et le 25 septembre. Aucune démo, aucun persona ne doit dépendre d'une offre précise. Tester sur le corpus vivant chaque semaine. |
| Modèle d'embedding inconnu | Test cosinus sur un `text` livré dans le parquet. Plan B : ré-embarquer 9 documents (quelques secondes). Risque quasi nul vu la volumétrie. |
| API indisponible pendant la démo | Tout est en cache dans Mongo, démo hors-ligne possible. Snapshot figé avant le freeze. |
| Coût/latence LLM | Cache par `(profil, avp, version_prompt)`. Jamais de génération à froid en démo. |
| **CRA est déprécié** | `react-scripts` n'est plus maintenu (avertissement npm, audit bruyant) et, en SPA sans SSR, n'émet pas de JSON-LD indexable — dommage sur un projet dont le sujet est l'accès à l'information. Touche *Maintenabilité /5*. Deux options honnêtes : bascule Vite (≈30 min, **en S1 ou jamais**), ou garder CRA et pré-rendre les pages publiques par un petit script statique. |
| Sur-ingénierie | Le vrai piège de ce hackathon vu la volumétrie. Aucune base vectorielle, aucun orchestrateur lourd, aucune auth complète. |
| Vidéo + article sous-estimés | Bloqués en S5, freeze le 18. Non négociable. |

---

## 8. Ce qui rapporte le plus par heure investie

1. **La chaîne ①→④ complète, démontrable en continu.** Sans elle, rien d'autre ne compte.
2. **`evidence[]` sur chaque composante du score** — débloque explicabilité, restitution candidat et qualité des documents d'un seul geste.
3. **Les 9 verdicts avec motifs de rejet** — explicitement demandé, rendu possible par la petite volumétrie, presque personne ne le fera.
4. **Matrice d'évaluation 8×9 étiquetée** — transforme une affirmation en preuve, et porte l'article.
5. **Passe de critique sur la lettre** — ~1 h de code, agit sur 10 des 25 points de Valeur RH.
6. **Reformulation du jargon en langage clair** — pile le problème énoncé ; touche UX, accessibilité et valeur RH.
7. **Exploiter `experienceInPlaceOfEducation` et les codes ROME** — maîtrise fine du schéma, très visible en jury.
8. **Notre propre serveur MCP** — 2–3 h, signal fort sur *ressources /8* et *intégrabilité /8*.
9. **`docker compose up` + adaptateur de source documenté** — réutilisabilité /4 quasi gratuite.

À l'inverse, **ne pas** dépenser d'heures sur : infra vectorielle, auth complète, back-office recruteur riche, animations. Le critère *adéquation moyens/résultats* les punit.

---

## 9. Trois décisions à prendre cette semaine

1. **Track** — SaaS (recommandé) ou onPrem. Dépend du matériel disponible dans l'équipe.
2. **Public cible unique** — jeune sorti de BTS ? salarié en reconversion ? personne n'ayant jamais écrit de lettre ? Le règlement tranche : « une solution excellente pour un public précis vaut mieux qu'une solution tiède pour tout le monde ». Ce choix pilote le ton des documents et l'UX.
3. **Déclencheur** — le candidat vient chercher (app classique) ou le service le prévient (veille sur vivier) ? Le second est plus original, et le renouvellement complet du corpus en quelques semaines lui donne du sens. Mais la chaîne doit aller jusqu'aux documents transmis.

---

## 10. Ressources — URLs vérifiées

**AVP**
- API : https://apigee-optnc-prd-api.apigee.io/docs/avps/1/overview
- MCP : https://apigee-optnc-prd-api.apigee.io/docs/mcp-emploi/1/overview
- Dataset HF : https://huggingface.co/datasets/opt-nc/odata-avps (`data/all_avps.jsonl`, `data/all_embeddings.parquet`, archive `data/2026/MM/`)
- Portail : https://opt-nc.github.io/odata-avps/
- RSS : https://opt-nc.github.io/odata-avps/index.xml

**Référentiel métiers**
- API : https://apigee-optnc-prd-api.apigee.io/docs/metiers-opt/1/overview
- Site : https://opt-nc.github.io/odata-referentiel-metiers/
- Open data GitHub : https://github.com/opt-nc/odata-referentiel-metiers
- Familles : https://opt-nc.github.io/odata-referentiel-metiers/familles-metiers/

**Standards**
- schema.org/JobPosting : https://schema.org/JobPosting
- JSON Resume : https://jsonresume.org/
- data.gouv.nc (dataset AVP) : https://data.gouv.nc/explore/dataset/avis-de-vacances-de-poste-avp-drhfpnc/

**Hackathon**
- Article de référence : https://dev.to/adriens/hackavp-premier-hackathon-dedie-a-lemploi-dans-la-fonction-publique-en-ncl-3oj0
- Formulaire de soumission : https://forms.gle/Fin8PMMWcpAi7yEd7
- Vidéo d'inspiration : https://www.youtube.com/watch?v=5iPqMv49R1c
- Sites institutionnels : https://office.opt.nc/fr/emploi-et-carriere/postuler-lopt-nc/avp · https://drhfpnc.gouv.nc/avis-vacances-postes-AVP
