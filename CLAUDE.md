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

| Source | Volume | Schéma | Commande |
|---|---|---|---|
| HF `all_avps.jsonl` | **2** offres ouvertes | schema.org JobPosting | `data:avps` |
| HF archive `data/2026/MM/` | **45** offres (juin→sept), 43 avec métier | JobPosting, sans `id_avp` — c'est `identifier` | `data:archive` |
| data.gouv.nc DRHFPNC | **185 ouvertes / 19 573** au total | schéma plat, traduit en JobPosting | `data:datagouv` |
| Référentiel métiers | 12 familles, ~80 métiers, 409 compétences | CSV | `data:metiers` |
| RSS · API Apigee · embeddings | — | — | non exploités |

**230 offres en base, 189 ouvertes, 18 employeurs distincts.** Deux constats de qualité de donnée, à
garder en tête et bons pour l'article :

- **139 des 185 avis DRHFPNC ouverts ne publient rien de structuré** : ni
  attendus, ni missions, ni description. Tout vit dans le PDF (`url_pdf`). Ce
  n'est pas un défaut de l'adaptateur, c'est la source.
- **29 offres sur 230 portent un code métier OPT**, mais **225 portent un code
  ROME**. Le référentiel OPT ne couvre donc que les offres de l'OPT ; le ROME
  est le seul pivot commun aux deux employeurs. C'est la passerelle à exploiter.

⚠️ data.gouv.nc expose de vraies adresses nominatives d'agents — même garde-fou
que pour l'OPT (voir §7).

`FEUILLE-DE-ROUTE.md` contient l'analyse du règlement, le barème complet et le
plan semaine par semaine. Le consulter avant d'arbitrer une priorité.

## 2. Stack et commandes

MongoDB · Node/Express 5 (ESM) · React 19 (CRA) + Redux Toolkit Query.

```bash
npm run dev                # backend (nodemon) + frontend, en parallèle
npm run data:tout          # les quatre sources, dans le bon ordre
npm run data:metiers       # référentiel des métiers
npm run data:avps          # offres ouvertes (Hugging Face)
npm run data:archive       # archive mensuelle (Hugging Face)
npm run data:datagouv      # avis DRHFPNC (data.gouv.nc)
npm run data:import        # compte admin depuis SEED_ADMIN_*
npm run data:comptes-test  # 10 comptes de démonstration + user_test.txt
npm run eval               # matrice de confusion du rapprochement
npm run mcp                # serveur MCP (stdio) — 4 outils, pour un assistant
npm run veille             # tour de veille (-- --quotidien pour les récapitulatifs)
npm run moderation:echeances  # échéances de régularisation (simulation par défaut)
```

Ordre à froid : `.env` → `data:tout` → `data:comptes-test` → `dev`.

Toute l'ingestion vit dans `services/ingestionService.js` et s'exécute aussi
depuis `/admin/donnees` — **le même code**, jamais deux implémentations. La
console reste indispensable à l'installation (avant qu'aucun compte n'existe)
et pour une tâche planifiée ; l'interface évite d'ouvrir un terminal pour
rafraîchir un catalogue. Chaque exécution est journalisée (`IngestRun`).

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

### 🔴 Le pivot ne couvre qu'une fraction du corpus — mesuré le 13/09/2026

Le référentiel métiers est présenté ci-dessus comme LE pivot. C'est vrai pour
l'OPT-NC, et faux pour le reste du catalogue. Mesure faite en rejouant
`rapprocher()` pour trois personas sur les **188 offres ouvertes**, résultat
identique pour les trois :

| Barème applicable | Offres | Ce que voit l'utilisateur |
|---|---|---|
| 23 pts | **139 (74 %)** | « Non évaluable » — aucun score publié |
| 48 pts | 47 | score sans composante référentiel |
| 93 pts | **2** | le moteur complet |

La composante `referentiel` — 45 des 100 points — est donc active sur **2 offres
sur 188**.

**Trois pistes explorées, trois impasses, toutes vérifiées :**

1. *Joindre par code ROME.* Impossible : les 84 documents `Metier` ne stockent
   pas le champ `rome` (0 sur 84).
2. *Même en le stockant.* 139 des 185 avis DRHFPNC portent le code `N0000`,
   dont le libellé source est littéralement **« Hors rome »**.
3. *Rattacher par libellé de corps/grade.* Les 139 offres muettes se répartissent
   en 35 corps — `médecin de santé publique` (18), `infirmier en soins généraux`
   (17), `attaché` (16), `assistant socio-éducatif` (8), `professeur des écoles`
   (4), `sapeur pompier`… Le référentiel OPT est un référentiel **télécom, poste
   et banque** (« Qualifieur réseaux », « Analyste LCBFT », « Chargé du
   dédouanement »). Rapprocher « orthophoniste » de l'un d'eux ne rescue rien, et
   « attaché » → « Assistant administratif » fabriquerait un score confiant et
   faux : exactement le faux positif que le règlement sanctionne.

Et la donnée manque **à la source**, pas chez nous : sur 100 avis publiés
interrogés directement sur data.gouv.nc, **69 ont tous leurs champs de contenu
vides** (`mission`, `savoir`, `savoirfaire`, `activitesprincipales`,
`presentation` = `""`) — les mêmes 69 que les « Hors rome ». Il n'y a ni PDF à
extraire ni champ à récupérer : la DRHFPNC publie un intitulé, un lieu, un
corps/grade, et rien d'autre.

⚠️ **Ne pas retenter ces trois pistes.** Et surtout : ne pas « améliorer » le
taux de couverture en desserrant les seuils de rapprochement de libellés — ce
serait échanger un silence honnête contre des faux positifs, dans le seul
critère où le règlement demande explicitement l'inverse.

Ce 74 % n'est pas qu'une limite à subir : c'est un **résultat d'analyse sur un
jeu open data public**, à porter dans l'article et la vidéo à côté de la matrice
de confusion. Ce qui doit être irréprochable, c'est la façon dont l'interface
l'assume — « cet employeur ne publie pas le détail de ce poste » plutôt qu'un
score inventé ou un blanc.

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
- **Les `evidences[]` du matching sont injectées dans le prompt**, mais pas
  n'importe comment. Les **correspondances** sont données comme matière à citer
  (chacune relie un attendu de l'annonce à un élément réel du parcours) ; les
  **écarts** sont donnés comme *pistes à vérifier*, avec consigne explicite de
  les confronter au profil avant d'en conclure quoi que ce soit.

  Le garde-fou vient d'un incident : une version antérieure joignait le
  rapprochement **par mots** de ce fichier, et le modèle l'a suivi contre le
  profil — « vous n'avez pas de formation juridique bac+3 » à une candidate
  titulaire d'une licence de droit. Ne jamais donner un écart automatique comme
  un fait. Mesuré : la lettre passe de **4/10 à 6/10** à la passe de critique.
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

## 7. Les employeurs — l'application n'est pas mono-employeur

`backend/config/employeurs.js`. **18 organisations publiques distinctes** dans
le corpus : OPT-NC (45 offres), Nouvelle-Calédonie/DRHFPNC (76), Province Nord
(41), Province Sud (28), CHT, UNC, communes, Congrès, ISEE…

- L'employeur est lu dans `hiringOrganization.name` (les deux sources le
  renseignent), rattaché à un registre, et stocké dans `Avp.employeur`.
- ⚠️ **L'OPT apparaît sous deux graphies** selon la source. Sans l'alias, le
  même employeur serait compté et filtrable deux fois.
- `employeur` ≠ `direction` : la direction est le service **interne** à
  l'employeur. Les confondre laisse croire que tout vient du même endroit.
- Un employeur absent du registre est affiché **sous son vrai nom**, jamais
  rangé dans « Autre ».
- Toute phrase de l'interface qui attribue les offres à l'OPT seul est
  **fausse** depuis l'ajout de data.gouv.nc. Les mentions du *référentiel des
  métiers*, elles, restent exactes : ce référentiel est bien celui de l'OPT-NC.

## 8. L'espace recruteur (le vivier)

`recruteurController.js` · `/api/recruteur` · écran `/vivier`. C'est la seconde
direction du rapprochement, que le règlement demande explicitement.

Deux règles qui ne se négocient pas :

1. **Seuls les profils dont la personne a coché « visible par les recruteurs »**
   apparaissent. Le défaut est `false` : on crée un compte pour chercher un
   poste, pas pour figurer dans un annuaire. Les 8 personas de démonstration
   sont à `true` parce qu'ils sont fictifs.
2. **Les coordonnées ne sortent que sur la fiche détaillée**, jamais dans la
   liste — une liste qui les porterait se moissonne en une requête.

`GET /api/recruteur/offres/:slug/candidats` rapproche le vivier d'une offre avec
**le même moteur** que côté candidat, écartés et motifs compris. Deux moteurs
auraient fini par rendre deux verdicts différents sur le même couple.

La garde est `checkRole("recruteur", "admin")` posée une fois sur le routeur.
`RecruteurRoute` côté front n'est qu'un confort d'affichage.

## 9. L'espace de travail du recruteur

`recruteurEspaceController.js` · `suggestionService.js` · `/recruteur`.

- **Profil recruteur** (`RecruteurModel`) — un recruteur ne décrit pas un
  parcours, il décrit un **besoin**. Pas d'expérience ni de diplôme :
  organisation, fonction, compétences et métiers recherchés, territoires.
  Modèle distinct de `ProfilModel`, et c'est délibéré.
- **Listes nommées** — mettre de côté maintenant, décider plus tard. Le nom est
  libre (« À rappeler après le 15 ») parce que « Favoris » ne dit rien.
  L'identité du candidat est recopiée dans l'entrée : si la personne retire sa
  visibilité, la liste affiche « profil retiré » au lieu d'une ligne morte.
- **Suggestions** — somme pondérée de compétences partagées, dosée par
  `poidsHistorique` entre ce qui est **déclaré** et ce qui est **enregistré**.
  Recalculable à la main : ni apprentissage, ni modèle. Sur quelques dizaines
  de profils, tout le reste serait de la sur-ingénierie.

⚠️ **Chaque suggestion dit POURQUOI** — les compétences communes, et d'où vient
leur poids (« vous l'avez déclarée », ou le nom d'un profil enregistré). Un
classement dont on ne voit pas les règles ne se corrige pas, il se subit. Ne
jamais replier cette justification derrière un « voir pourquoi ».

⚠️ `memeCompetence()` exige **deux mots communs** dès que les deux libellés en
comptent plusieurs. Avec un seul, « Rédaction administrative » et « Gestion
administrative de dossiers » fusionnaient en un critère — observé à l'écran.

Les critères déclarés **classent**, ils ne **filtrent** pas : un filtre ferait
disparaître des profils que le recruteur n'a pas pensé à décrire.

## 10. La veille — le scénario qui donne son sens au projet

`VeilleModel` · `veilleService.js` · écran `/alertes` · `npm run veille`.

Le corpus se renouvelle **intégralement** en quelques semaines : quelqu'un qui
consulte la plateforme une fois n'y reviendra pas au bon moment. C'est
exactement le problème que le hackathon énonce.

🔴 **Le règlement : « un service de veille qui s'arrête à la notification ne
concourt pas ».** Chaque alerte mène donc aux **quatre pièces**, pas à une
annonce. Le bouton principal dit « Préparer mon dossier » :
`POST /api/candidatures/:id/preparer` produit les quatre pièces en une fois,
**sans écraser** celles déjà écrites — sinon un clic de trop efface une lettre
retravaillée.

**Le déclencheur est l'ingestion**, et nulle part ailleurs : c'est le seul
moment où l'on sait quelles offres sont **nouvelles**. `enregistrerAvps`
remonte les documents créés ; les comparer par date plus tard re-notifierait
tout le corpus au premier décalage d'horloge. Un échec de la veille ne fait
jamais échouer l'ingestion.

Règles à ne pas défaire :

- **On part des PROFILS, pas des documents de veille.** Ces documents ne
  naissent qu'à la première visite de l'écran : la version initiale ne trouvait
  donc personne, et surtout pas les comptes neufs. La veille est active par
  défaut, sauf désactivation explicite.
- **Un courriel par personne et par LOT**, jamais par offre. Quarante offres
  ingérées ne doivent pas produire quarante courriels.
- **Chaque alerte porte ses preuves** — attendu de l'annonce → élément du
  parcours. Sans justification, une alerte est indiscernable d'une publicité,
  et trois alertes hors sujet suffisent à faire classer l'expéditeur en
  indésirable.
- **Jamais d'alerte sur une offre close**, ni sur un profil masqué par la
  modération. Une notification survit à ce qu'elle annonçait : l'écran le dit
  au lieu de la masquer.
- **Une notification par personne et par offre** (index unique partiel) : la
  veille est idempotente, le script rejouable.
- `scoreMinimal` à **45** par défaut — le seuil « candidature défendable ».

## 11. La modération

`SignalementModel` · `moderationController.js` · `/admin/moderation`.
Le bouton « Signaler ce compte » est en bas de la fiche candidat
(`BoutonSignaler`), ouvert à tout compte connecté.

🔴 **Un signalement n'entraîne AUCUNE sanction automatique.** Un signalement
ouvre un **dossier** ; toute mesure est un geste humain, tracé, réversible.

### La gradation — `moderationService.js`

| Étape | Effet |
|---|---|
| Avertissement | Porté au dossier, avec son motif. Courriel à la personne. |
| 3ᵉ avertissement (`SEUIL_MASQUAGE`) | Profil retiré du vivier **automatiquement**, délai de **15 jours** (`DELAI_REGULARISATION_JOURS`) ouvert. |
| Délai écoulé | Compte supprimé (`npm run moderation:echeances`, **simulation par défaut**). |
| Après suppression | La personne peut **recréer un compte avec le même email**, dossier vierge. L'adresse n'est jamais bloquée. |
| Régularisation | Les avertissements sont **levés**, pas effacés — on ne réécrit pas l'histoire. Le profil n'est **pas** remis visible d'office : c'est le choix de la personne. |

L'échéance est **stockée** sur le compte, pas recalculée : changer la durée du
délai ne doit pas déplacer une date déjà annoncée à quelqu'un.

### Ce que chacun apprend

- **La personne visée** reçoit le motif exact, son nombre d'avertissements, ce
  qu'il lui reste avant le seuil, l'échéance, et comment contester.
- **Le signalant** apprend si son signalement a été **retenu ou non**, et le
  motif — mais **jamais les mesures prises**. Lui dire « ce compte a été
  désactivé » ferait du signalement un moyen de savoir qui a été sanctionné.
- **Ni l'un ni l'autre** n'apprend l'identité de l'autre : la personne visée ne
  sait pas qui l'a signalée (représailles), et le signalant ne voit pas le
  dossier disciplinaire.

⚠️ Le motif écrit par l'administrateur **est** le texte envoyé aux deux
parties. Un motif pour le dossier et un autre pour les intéressés, et l'on ne
sait plus ce qui leur a été dit.

### Recours

Ouvert **aux deux parties**, et il **rouvre le dossier** (`statut: en_cours`).
Une décision sans recours n'est pas une décision, c'est une sanction. Un seul
recours par dossier.

Autres règles, à ne pas défaire :

- **L'envoi d'un courriel ne fait jamais échouer une décision.** Adresse
  invalide, SMTP en panne : la mesure reste prise, l'échec est tracé et visible
  dans le dossier. L'inverse serait absurde.
- **Pas de signalement anonyme**, et **un seul dossier ouvert** par signalant
  et par cible (index unique partiel). Sans quoi rien n'empêche d'en déposer
  cinquante sur la même personne.
- **Une décision écrite est obligatoire** pour clore un dossier. Un dossier
  clos sans motif ne se relit pas six mois plus tard et ne se défend pas.
- **Les mesures sont une liste fermée** (`MESURES`), jamais du texte libre,
  et ne sont proposées que si elles ont du sens sur l'état réel du compte.
- **Un compte administrateur ne se modère pas depuis cet écran** — la
  modération vise les usages du service, pas les droits d'exploitation.
- La cible est le **compte**, pas le profil : c'est sur lui que portent les
  décisions, et un profil peut être recréé.

## 12. L'ouverture d'un compte recruteur

`DemandeRecruteurModel` · `demandeRecruteurController.js` ·
`/devenir-recruteur` (public) · `/admin/demandes` (instruction).

🔴 **Un compte recruteur ne s'ouvre jamais tout seul.** Un compte candidat, si :
la personne n'y voit que des offres publiques et son propre dossier. Un compte
recruteur donne accès au **vivier** — parcours, compétences et coordonnées de
gens réels, confiés à un service public et pas à quiconque coche « je suis
recruteur ». L'inscription libre serait une faille, pas une commodité.

### Le parcours

| Étape | Ce qui se passe |
|---|---|
| Dépôt (public) | Six champs obligatoires : prénom, nom, email, organisation, fonction, **motivation**. Le formulaire dit d'abord *pourquoi* il les demande — sans quoi « motivation » produit « je souhaite recruter ». |
| Accusé de réception | Courriel immédiat au demandeur. |
| Instruction (admin) | L'écran montre le dossier, pas une ligne de tableau : organisation, fonction, site, et en toutes lettres l'usage annoncé du vivier. |
| Décision | **Motif obligatoire** (refusé côté serveur sans lui) : il part *tel quel* dans le courriel. Un refus sans motif ne se conteste ni ne s'améliore. |
| Acceptation | Compte **créé** (ou **promu** s'il existe) + `RecruteurProfil` pré-rempli avec ce qui a été déclaré. |

### Deux règles à ne pas affaiblir

- 🔴 **Aucun mot de passe n'est jamais fabriqué ni envoyé.** Le compte est créé
  avec `crypto.randomBytes(32)` inutilisable, et la personne reçoit un lien de
  définition valable **7 jours** — plus long qu'un oubli de mot de passe, parce
  qu'on ne guette pas une réponse qu'on n'attendait pas dans les trente minutes.
- **Pas d'énumération de comptes.** Le dépôt ne dit « cette adresse a déjà un
  accès » que pour un compte *recruteur ou admin* (l'information est utile et
  sans risque). Pour une adresse inconnue ou un compte candidat, il ne dit
  **rien** : confirmer l'existence d'un compte à un inconnu suffirait à
  cartographier la plateforme.

Une seule demande **en attente** par adresse (index partiel unique). Après un
refus, on peut redéposer — une situation change.

### Le logo d'organisation

`RecruteurProfil.logo`, base64, même mécanique que la photo candidat
(`components/Form/PhotoProfil`, `variante="logo"`). Deux différences qui
comptent :

- Le rendu n'est **jamais recadré en rond** : un logo détouré perd son nom.
  `object-fit: contain` sur fond blanc.
- ⚠️ Le canevas est **rempli en blanc avant le dessin**. Le JPEG ignore la
  transparence : sans ce fond, tout logo PNG détouré — c'est-à-dire presque
  tous — ressortait dans un rectangle **noir**. Bug trouvé au premier essai
  réel, invisible sur un portrait (une photo est opaque).

## 13. L'intégrabilité — la surface machine

`openapiService.js` · `integrationController.js` · `webhookService.js` ·
`backend/mcp.js` · `CleApiModel` · `WebhookModel`.

C'est le critère **Intégrabilité ATS /8**, le plus gros du barème après
Standards/6. Trois portes, un seul moteur derrière.

### 🔴 La règle qui tient tout

**Aucun de ces fichiers ne contient de logique métier.** L'API HTTP, le serveur
MCP et le webhook appellent `rapprocher()` et `GENERATEURS[…]` — le même code
que l'application web. Écrire ici une variante « adaptée au chat » ou
« simplifiée pour l'ATS » produirait deux moteurs, donc deux verdicts
différents sur le même couple profil/offre, et le jour où l'un est corrigé
l'autre ment. Même règle que l'ingestion, appelable en CLI comme depuis
l'administration.

### Aucun vocabulaire maison

Un intégrateur n'apprend **aucun** champ inventé : il envoie un `JSON Resume`,
il reçoit du `schema.org/JobPosting`. C'est la thèse d'architecture (§3) rendue
exécutable — si le cœur ne connaît que deux schémas normés, l'API publique ne
peut en exposer aucun autre.

`jsonResumeService` porte donc **les deux sens**, dans le même fichier et
volontairement — et le sens « entrant » sert **deux portes à la fois** : l'API
machine, et l'import de parcours côté candidat (§ 14 bis). Un seul convertisseur,
deux usages : un champ ajouté à l'export et oublié à l'import est une perte
de données silencieuse ; côte à côte, l'oubli se voit à la relecture. Vérifié
par aller-retour sur un profil réel — zéro perte sur les 10 champs contrôlés.

⚠️ `depuisJsonResume()` **n'invente rien**. Ce qui ne se rattache à aucun champ
part dans `ignores[]`, ce qui a été *interprété* part dans `avertissements[]`.
Et les niveaux ne sont jamais surévalués : « Advanced » vaut `maitrise`, pas
`expert` — l'échelle courante monte Beginner → Intermediate → Advanced →
Expert, et surévaluer un candidat le trompe dans le sens qui se paie à
l'entretien.

### Les trois portes

| Porte | Point d'entrée | Authentification |
|---|---|---|
| Donnée ouverte | `GET /api/avps`, `/api/avps/:slug/jobposting`, `/api/metiers` | **aucune** |
| API machine | `POST /api/integration/rapprochement` · `/dossier` | clé d'API |
| Assistant | `npm run mcp` — 4 outils MCP | locale (stdio) |
| Notification | webhook `avp.publie` | HMAC sortant |

La **lecture n'est jamais sous clé** : ce sont des données publiques, et les
redoubler derrière une clé signifierait « nos données ouvertes ne sont ouvertes
qu'à ceux que nous connaissons ». Une clé n'est demandée que pour ce qui coûte
— le calcul et la rédaction.

### Ce que l'API ne fait pas, et le dit

Ni compte créé, ni profil enregistré, ni envoi à un employeur. Le profil reçu
**vit le temps de la requête**. Un ATS nous transmet un dossier qu'il détient
déjà pour obtenir une analyse ; il n'a pas mandat pour inscrire cette personne
chez nous ni candidater en son nom. C'est écrit dans la réponse (`avertissement`),
parce que c'est la question que se pose l'intégrateur.

Il n'existe **aucune portée d'écriture** sur les comptes, les profils ou la
modération (`PORTEES` est une liste fermée).

### Clés d'API — `CleApiModel`

- Le secret n'existe en clair **qu'une fois**, dans la réponse à sa création.
  On stocke l'empreinte SHA-256. Perdu, il faut en refaire une : une clé qu'un
  administrateur peut relire six mois plus tard est une clé que quiconque a
  accès à l'écran peut relire aussi.
- SHA-256 nu, pas bcrypt : 32 octets aléatoires ne se devinent pas par
  dictionnaire, et un bcrypt à chaque requête serait payé pour rien.
- Préfixe `epnc_` : une clé tombée dans un journal ou un dépôt Git se reconnaît,
  et les détecteurs de secrets savent l'attraper.
- ⚠️ **Jamais dans l'URL**, et le refus est explicite : sans ce message,
  l'intégrateur qui a essayé conclut « l'API ne marche pas » et recommence — en
  laissant sa clé dans les journaux à chaque essai.
- **Révocation, jamais suppression** : on doit pouvoir répondre à « qui avait
  accès, et jusqu'à quand ».

### Webhook `avp.publie` — `webhookService.js`

Déclenché par **l'ingestion**, au même endroit que la veille et pour la même
raison : c'est le seul moment où l'on sait quelles offres sont *nouvelles*.
Émis **une fois par lot**, jamais une fois par offre.

- Signature `X-EPNC-Signature: sha256=<hmac>` sur le **corps sérialisé**, pas
  sur l'objet : deux sérialisations d'un même objet peuvent différer par
  l'ordre des clés, et le destinataire recalculerait une signature qui ne
  correspond pas.
- 3 tentatives espacées ; les 4xx ne sont **pas** réessayés (sauf 408 et 429) —
  le destinataire a compris et refuse.
- `AbortSignal.timeout` explicite : `fetch` n'a **aucun** délai par défaut, et
  une URL qui accepte la connexion sans jamais répondre bloquerait l'ingestion.
- Suspension automatique après 10 échecs, mais l'abonnement **reste visible**
  avec sa dernière erreur. Un webhook qui échoue en silence est pire que pas de
  webhook : le destinataire se croit à jour.
- 🔴 **Un destinataire injoignable ne fait jamais échouer une ingestion.**
  Vérifié : 1 abonné valide + 1 mort → le lot passe, l'échec est tracé.
- Le secret est stocké **en clair**, contrairement aux clés : il faut le relire
  pour signer. Ce n'est pas un secret de même nature — il n'ouvre aucun accès
  chez nous, il prouve seulement au destinataire que le message vient de nous.

### Serveur MCP — `npm run mcp`

Quatre outils : `chercher_offres`, `detail_offre`, `rapprocher_profil`,
`produire_lettre`. Testé avec un vrai client MCP, pas seulement démarré.

- ⚠️ **Rien sur `stdout`** : le transport stdio y fait passer le protocole
  lui-même, et un `console.log` égaré casse la session sans message
  exploitable. Tout passe par `stderr` (`trace()`).
- L'assistant reçoit des **phrases**, pas du JSON brut : c'est un lecteur de
  langue, et un mur d'accolades le pousse à inventer des résumés.
- La **fiabilité accompagne toujours le score** dans le texte rendu, sinon
  l'assistant présentera un 60/100 calculé sur 40 points comme un 60 sur 100.
- `produire_lettre` **refuse** de produire pour une offre dont le profil est
  exclu par une contrainte dure. Donner une belle lettre pour un poste
  inaccessible fait perdre son temps à quelqu'un.

### OpenAPI — `/api/openapi.json`

OpenAPI **3.1** (aligné sur JSON Schema 2020-12, donc les schémas publics se
référencent par URL au lieu d'être recopiés puis de diverger). Généré par un
module, pas déposé en YAML : la version vient de `package.json`, l'URL du
serveur de la requête, les portées de `CleApiModel`. Une spec qui vit à côté du
code ment au bout de trois semaines.

Les **webhooks sont déclarés dans le même document** (champ de premier rang en
3.1) : décrire ailleurs ce que nous envoyons laisserait la moitié du contrat
hors du contrat.

Validé par `npx @redocly/cli lint` — **0 erreur**. Restent 3 avertissements
assumés : `localhost` dans `servers` (c'est l'URL réelle du serveur courant,
elle est dynamique) et deux `operation-4xx-response` sur `/api/avps` et
`/api/metiers`, qui n'ont aucun 4xx réel — en documenter un serait mentir pour
faire taire un linter.

On ne documente **pas** les soixante routes internes de l'application web : un
intégrateur n'appellera jamais `/api/profil`, et les décrire créerait une
promesse de stabilité sur des routes qui bougent avec l'interface.

## 14. Le langage clair — traduire l'administration

`langageClairService.js` · `avpController.vueComplete` · fiche d'offre.

C'est **le problème que le hackathon énonce**, pas un confort d'interface. Une
offre s'intitule « ACDP-grille rémunération 1-sans diplôme » ; une autre cherche
un « attaché » ; une troisième un « conseiller des APS ». Une annonce qu'on ne
comprend pas est une annonce à laquelle on ne postule pas.

### Pourquoi 38 entrées suffisent

Relevé sur le corpus ouvert : **38 corps/grades distincts couvrent les 188
offres**, et les **139 offres muettes en conservent toutes un**. C'est le seul
contenu qui survit quand l'employeur ne publie ni missions ni compétences —
donc le seul matériau disponible pour rendre ces trois quarts du catalogue
utiles. Couverture mesurée : **188/188 (100 %)**.

Le glossaire est bâti **par comptage sur le corpus**, jamais à l'intuition. Un
glossaire qui définit des mots absents fait perdre confiance dans celui qui
définit les mots présents. Termes de jargon retenus : ceux réellement écrits
dans les textes (`durée de résidence` ×30, `titulaire` ×15, `grade` ×12,
`astreinte` ×6…), soit 42 offres sur 188 qui en contiennent au moins un.

### Deux règles qui ne se négocient pas

1. 🔴 **On n'explique que ce qui est opaque.** « Orthophoniste »,
   « aide-soignant », « sage-femme » sont déjà du français clair : leur accoler
   une définition serait condescendant et noierait les termes qui en ont
   besoin. Un glossaire qui explique tout n'est plus lu.
2. 🔴 **On ne statue jamais sur le droit qu'on n'a pas lu.** Chaque entrée porte
   une `certitude` : `etablie` (vocabulaire standard, décrit par sa **fonction**
   — ce que la personne fait — et non par sa base statutaire) ou `partielle`
   (notre lecture, affichée comme telle avec renvoi à l'avis original).
   21 offres sur 188 portent une réserve visible.

   Vérifié : la base data.gouv.nc ne contient **aucune** occurrence de « agent
   contractuel de droit public ». Elle emploie le sigle ACDP sans jamais le
   développer — nous le proposons, nous ne l'affirmons pas.

⚠️ Le **libellé d'origine est toujours conservé** à côté de la traduction
(« appelé "attaché" dans l'avis officiel »). C'est lui qui figure sur l'avis, sur
le formulaire de candidature et dans la bouche du service RH : le masquer
perdrait la personne au moment où elle en a besoin. On traduit, on ne remplace
pas.

### « Hors rome » — le jargon qui fuyait

139 offres sur 188 portent le code ROME `N0000`, dont le libellé source est
littéralement « Hors rome ». La fiche affichait donc **« Métier de
rattachement : Hors rome »** — une ligne qui n'apprend rien et fait douter du
reste de la page.

`metierClasse()` tranche, et le contrôleur expose `metier.classe`. La décision
est prise **à un seul endroit** pour que la liste, la fiche, l'API
d'intégration et la veille rendent le même verdict.

### L'offre muette, dite plutôt que subie

`vueComplete` renvoie un diagnostic `contenu: { publie[], absent[], muette }`.
Calculé côté serveur, parce que c'est le même verdict qui sert à l'interface, à
l'API et à la veille : trois lectures indépendantes de « cette offre est-elle
vide ? » finiraient par diverger.

La fiche dit alors trois choses, dans cet ordre : **ce qui manque**, **que ça
vient de l'employeur et non de nous**, et **ce qu'on peut faire quand même**.
La troisième est la plus importante — constater sans proposer de suite, c'est
laisser quelqu'un devant une porte fermée.

⚠️ Corrigé au passage : le verdict « non évaluable » renvoyait vers « la fiche
de poste, à lire directement ». Or sur ces offres-là **la fiche est vide elle
aussi** — on envoyait la personne lire une page blanche. Il oriente désormais
vers le corps indiqué et vers le service qui recrute.

## 15. Les portes d'entrée du profil — fonction ①

Le règlement est explicite sur ce point : **ne pas faire du CV le chemin
obligatoire**, parce qu'il insiste sur le candidat *sans* CV. Une seule porte,
c'est la fonction ① à moitié traitée.

| Porte | État | Fichier |
|---|---|---|
| Saisie manuelle, section par section | ✅ | `ProfilScreen` |
| **Import JSON Resume** | ✅ | `ImportJsonResume` · `depuisJsonResume()` |
| Entretien guidé, pour qui n'a pas de CV | ❌ **à faire** | — |
| Upload CV PDF → extraction | ❌ (volontairement dernier) | — |

### L'import ne s'écrit jamais sans montrer

Deux routes, jamais une seule : `POST /api/profil/import/apercu` **n'écrit
rien**, `POST /api/profil/import` écrit. La raison n'est pas cosmétique :

- l'import **remplace** un parcours que la personne a peut-être mis une heure à
  saisir. Le nombre d'expériences, de formations et de compétences qui vont
  être effacées est annoncé **avant**, pas après ;
- `depuisJsonResume()` **interprète** : une expérience sans date de fin devient
  « en cours », « Advanced » devient `maitrise`, une région inconnue reste
  vide. Ces lectures deviendront le CV de quelqu'un — elles remontent dans
  `avertissements[]` et sont affichées à relire ;
- les sections du standard non reprises (`awards`, `certificates`,
  `publications`, `volunteer`, `references`, `projects`) remontent dans
  `ignores[]` plutôt que de disparaître en silence.

⚠️ **La photo et `visibleRecruteurs` ne sont jamais touchés par un import.** La
photo parce qu'aucun JSON Resume ne la porte sous notre forme — l'écraser
supprimerait sans le dire une image choisie. La visibilité parce que c'est une
décision, pas une donnée de CV : un fichier importé ne doit jamais pouvoir
exposer quelqu'un dans le vivier à son insu.

Mesuré de bout en bout dans le navigateur : profil vide → **95 % de complétude**
après import d'un JSON Resume étranger ; réimport sur profil rempli →
l'avertissement d'écrasement s'affiche avec le décompte exact.

## 16. L'évaluation — `npm run eval`

`backend/eval.js`. Une vérité terrain étiquetée **à la main** (8 personas ×
familles de postes), confrontée aux verdicts du moteur. Matrice de confusion,
précision, rappel. `-- --csv` exporte la matrice, `-- --detail` liste tous les
désaccords.

L'étiquetage porte sur des **familles de postes**, pas sur des références
d'annonces : le corpus se renouvelle en quelques semaines, une vérité terrain
accrochée à une offre précise serait périmée avant le rendu.

**Relevé du 13/09/2026** (189 offres ouvertes, 89 paires mesurées) :
exactitude **45 %**, **faux positifs 0 %**, faux négatifs 88 %.

Le moteur est **prudent** : il rate des rapprochements justes plutôt que d'en
inventer. C'est l'arbitrage voulu — le règlement note « l'absence de faux
positifs », et un score flatteur qui envoie quelqu'un candidater à un poste
hors de portée détruit la confiance bien plus qu'un silence.

### Ce que l'évaluation a fait trouver

Quatre défauts réels, invisibles sans mesure. Aucun n'est un réglage de seuil :

1. **Pas de racinisation.** « Accueillir » ne rejoignait pas « accueil »,
   « administratives » pas « administratifs ». Rappel à 0 %. → `memeRacine()`
   compare les préfixes.
2. **Un attendu devait tenir dans UNE ligne du profil.** Deux lignes qui le
   couvrent ensemble ne comptaient pas. → `chercherDansProfil()` mesure contre
   l'ensemble du profil, et cite la ligne la plus contributive.
3. **Les missions étaient comparées en bloc.** 200 mots d'annonce contre 40 de
   parcours : la couverture ne pouvait mathématiquement pas franchir le seuil.
   → mission par mission.
4. **Le seuil de 0,34 était un artefact.** Un attendu de trois mots exigeait
   deux correspondances (1/3 = 0,333). → `attenduCouvert()` raisonne en nombre
   de mots.
5. **La racinisation à 0,75 était trop lâche sur les mots longs.**
   « INFORMATIQUE » et « INFORMATION » se confondaient (9 lettres communes
   exigées sur 12) : un profil de relation client se voyait proposer un poste
   d'ingénieur SI à 69/100. Repéré non pas par l'évaluation mais **sur une
   alerte de veille réelle**. → ratio porté à **0,85**. Coût mesuré : −1 point
   d'exactitude, pour un faux positif grave en moins. L'arbitrage est assumé.

⚠️ **Ne pas régler les seuils pour embellir la matrice.** Ce serait du
surapprentissage sur notre propre étiquetage. Les gains ci-dessus viennent tous
de défauts nommés ; s'il faut bouger un seuil, il faut d'abord pouvoir dire
pourquoi il était faux.

⚠️ Les libellés du moteur sont **sans destinataire** (« le parcours », pas
« votre parcours ») : le même rapprochement est lu par le candidat ET par le
recruteur.

## 17. Invariants de sécurité et de données

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

## 18. Conventions

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

### Mise en page

- **Deux largeurs.** `.conteneur` (1320 px) pour le texte suivi — fiches,
  formulaires, articles. `.conteneur--large` (1600 px) pour les écrans de
  **données** : listes d'offres, vivier, grilles de cartes, tableaux
  d'administration. Une grille gagne une colonne à 1600 px ; un paragraphe
  étalé sur 1600 px devient illisible. La distinction est portée par l'écran,
  jamais par une largeur unique imposée à tous.
- **La navigation dépend du RÔLE.** `Header.NAVIGATION` porte une liste par
  rôle ; ce qui relève du compte (profil, réglages, déconnexion) vit dans le
  menu sous le nom. Un recruteur ne doit pas voir « Mes candidatures ».
  N'ajoutez pas un lien « pour tout le monde » : choisissez à qui il sert.
- **Le menu se replie sous 1100 px, l'identité jamais.** Ranger « Se
  connecter » derrière un bouton obligerait un visiteur à deviner où l'on se
  connecte.
- **L'apparence des contrôles de formulaire est GLOBALE**, pas accrochée à
  `.champ`. Un `<select>` écrit hors de ce conteneur s'affichait avec
  l'apparence native du système — fond clair sur thème sombre, pas de chevron.
  `.champ` ne porte plus que la mise en page (empilement, compression).
- `exemple.env` doit documenter **toute** variable lue par le code, même vide, et
  être mis à jour dans le même commit.

## 19. État d'avancement

**Fait** — socle d'authentification et d'administration ; ingestion idempotente
des trois sources (**230 offres, 188 ouvertes, 18 employeurs**) ; profil
candidat enrichi ; moteur de rapprochement explicable avec écartés motivés et
fiabilité du score ; fiches métier avec analyse d'écart ; les quatre pièces avec
passe de critique et `evidences[]` injectées ; assistant conversationnel ; suivi
des candidatures ; **fonction ④ complète** ; **vivier et espace recruteur** ;
**veille** déclenchée par l'ingestion ; **modération graduée** avec recours ;
**matrice d'évaluation** (`npm run eval`) ; **ouverture contrôlée des comptes
recruteurs** (§ 12) ; **intégrabilité complète** (§ 13 : OpenAPI 3.1 validée,
API machine sous clé, webhook signé, serveur MCP, import JSON Resume).

**Manquant — par ordre d'impact sur le barème :**

1. **L'entretien guidé** (§ 15) — la porte d'entrée pour qui n'a **pas** de CV.
   C'est celle sur laquelle le règlement insiste, et la dernière qui manque à la
   fonction ①. L'assistant conversationnel existe déjà mais conseille ; il ne
   collecte pas un parcours.
2. **Mesurer la qualité des pièces** — un `npm run eval:pieces` sur le modèle de
   `npm run eval` : générer lettre et CV pour les 8 personas, collecter les notes
   de la passe de critique, repérer ce qui est *systématiquement* faible. Vise
   les **25 points de Valeur RH**, jugés à l'aveugle — le plus gros bloc restant.
3. **Accessibilité** — passe axe + `eslint-plugin-jsx-a11y`, zéro violation
   critique. 4 points, et c'est le sujet même du hackathon.
4. **Passe de design** — page d'accueil (la fiche d'offre est traitée, § 14).
5. **Embeddings** (`all_embeddings.parquet`) — optionnel, et à ne faire qu'en
   rappel : le vecteur ne couvre que la description, ni `skills` ni
   `responsibilities`.
6. **Livraison** — `docker compose up`, vidéo, article dev.to. Gel du code au
   **18 octobre**.

**Décisions encore ouvertes** : track (SaaS recommandé — 25 points de valeur RH se
jouent sur la qualité du français) à déclarer **avant le 30 septembre** ; public
cible unique ; CRA conservé ou bascule Vite (`react-scripts` n'est plus maintenu —
touche *Maintenabilité /5*).

⚠️ **Ne plus enrichir l'espace recruteur.** La feuille de route déconseille
explicitement un « back-office recruteur riche » (critère *adéquation
moyens/résultats /5*). Ce qui existe est défendable — le vivier est demandé par
le règlement — mais chaque ajout se paie désormais sur ce critère.
