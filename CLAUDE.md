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
npm run eval:pieces        # conformité des lettres produites (appelle le modèle)
npm run mcp                # serveur MCP (stdio) — 4 outils, pour un assistant
docker compose up --build  # la démonstration complète, sans aucune clé
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

   🔴 **Cocher ne suffit pas : il faut avoir lu ce qu'on partage.**
   `backend/config/vivier.js` porte la liste exacte de ce qui sort — et la
   seule. Elle est servie avec le profil (`profil.vivier`) et affichée **en
   entier, dépliée, avant la décision** (`ConsentementVivier.jsx`). L'ancienne
   rédaction disait « votre parcours, vos compétences et vos coordonnées » :
   c'était vrai et incomplet — la case ouvrait aussi la **photo dès la liste**,
   le **CV en PDF**, l'**export JSON Resume** et le **rapprochement du profil
   avec les postes du recruteur, écarts compris**. On ne consent pas à ce
   qu'on ne nous a pas dit.

   Trois conséquences dans le code, à ne pas défaire :

   - `PUT /api/profil` **refuse** `visibleRecruteurs: true` si le corps ne
     porte pas `consentementVivier` égal à `VERSION_CONSENTEMENT_VIVIER`. La
     garde est côté serveur : un import, un script ou un futur écran distrait
     ne peuvent pas exposer quelqu'un à qui rien n'a été montré.
   - **Le consentement est daté par le serveur** (`accepteLe`), et le retrait
     aussi (`retireLe`, la trace de l'acceptation étant conservée). Un booléen
     sans date ne permet ni de dire depuis quand un profil était visible, ni
     de répondre à « je n'ai jamais autorisé ça ».
   - **Accepter demande deux gestes, retirer un seul.** Et la section n'a pas
     de bouton « Enregistrer » : le geste EST la décision, sinon on laisse
     quelqu'un devant une case cochée alors que rien n'est partagé — ou
     l'inverse.

   Si la liste change, **changer `VERSION_CONSENTEMENT_VIVIER`**. Les
   consentements antérieurs passent alors `aJour: false` : l'écran le signale
   et demande de relire. Le profil **n'est pas masqué d'office** — faire
   disparaître quelqu'un d'un vivier sans qu'il ait rien demandé serait une
   décision prise à sa place.

   ⚠️ Préfixe CSS **`partage-`**, jamais `vivier-` : l'écran recruteur possède
   déjà `.vivier-liste`, et c'est une **grille**. Écrite `.vivier-liste`,
   l'énumération du consentement s'affichait sur trois colonnes, sans puces,
   dans le désordre de lecture — sur la page même qui demande de lire avant
   d'accepter. (Même famille de bug que `.bulle` côté assistant.)
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

### L'assistant en bulle permanente — `BulleAssistant`

Rangé dans la navigation, l'assistant ne servait qu'à ceux qui pensaient à
l'ouvrir — c'est-à-dire à ceux qui n'en avaient pas besoin. Le moment où une
question se pose, c'est devant une fiche qu'on ne comprend pas ou un score
qu'on trouve injuste, pas quand on décide d'aller voir l'assistant.

La bulle est montée dans `App`, **hors de `.app`** (position fixe, aucun
contexte d'empilement hérité), et se masque d'elle-même : pas de compte, pas de
modèle configuré, ou déjà sur `/assistant`.

- 🔴 **Elle ne s'ouvre jamais toute seule.** Un panneau qui surgit au bout de
  dix secondes est la raison pour laquelle ces dispositifs se ferment sans être
  lus.
- 🔴 **Rien pour un visiteur anonyme** : l'assistant ne vaut que parce qu'il
  connaît le profil, les offres ouvertes et les candidatures. Sans compte, il
  serait un agent conversationnel générique de plus.
- L'avertissement d'usage n'est **pas** accepté depuis la bulle : un panneau de
  360 px n'est pas l'endroit où l'on fait lire un avertissement. Elle renvoie
  vers l'écran complet.
- Échap ferme, et le focus **revient sur le déclencheur** — sans ce retour, un
  utilisateur au clavier est projeté en haut du document.
- L'entrée « Assistant » a quitté la navigation principale ; l'écran complet
  (historique, conversations) vit dans le menu du compte sous « Mes
  conversations ».

⚠️ **Collision de classes CSS évitée de justesse** : `AssistantScreen` utilise
déjà `.bulle`, `.bulle--utilisateur`, `.bulle-texte` pour ses messages. Le
widget utilise donc le préfixe `.agent-*`. Sans ce renommage, le
`position: fixed` du widget se serait appliqué à **chaque message** de l'écran
complet.

⚠️ Le rôle d'un message est `"utilisateur"` / `"assistant"` (enum du modèle
`Conversation`), **pas** `"user"`. Comparer à « user » rangeait tous les
messages du même côté du fil.

### La refonte du hero et des deux publics

**La photo de fond a été retirée.** Une poignée de main sur un bureau disait
« entreprise » ; le sujet de l'outil est de rendre lisible un texte
administratif. C'était l'élément le plus générique de la page, le plus lourd à
charger, et il repoussait le produit au troisième écran.

Le hero est désormais une **composition partagée** : la promesse à gauche, une
**vraie capture de l'écran de rapprochement** à droite. Un visiteur décide en
quelques secondes s'il a affaire à une plaquette ou à un outil.

Supprimé avec la photo, et non laissé en place : `min-height: 100svh` (qui
forçait un vide en bas et repoussait la suite hors de portée), le calque
`::before` de contraste et les règles `.hero-defiler` du lien « Découvrir ».
Du CSS qui ne s'applique plus à rien est du CSS qu'on croit encore actif.

### « Vous renseignez. L'outil adapte. Le recruteur comprend. »

C'est la phrase qui résume l'outil, et elle manquait. Elle titre une section en
**deux colonnes à poids égal** — l'outil n'a pas un public principal et un
public toléré :

| Pour les candidats | Pour les recruteurs |
|---|---|
| Un profil, autant de CV que de postes | Des dossiers qui se comparent, pas qui se déchiffrent |
| Rempli une fois, réutilisé partout | Une mise en page identique d'un dossier à l'autre |
| Les expériences proches du poste remontent | Une lettre qui cite vos attendus |
| Aucune expérience ne disparaît | Le vivier : du poste vers les profils |

⚠️ Les deux promesses viennent d'**une seule décision technique** : le profil
est stocké en JSON Resume et le CV est **composé** à partir de lui, jamais
rédigé au fil de l'eau. Les présenter comme deux fonctionnalités distinctes
raterait ce qui les relie.

⚠️ La mention « l'accès recruteur est vérifié » est placée **avant** le bouton :
en dessous, elle remontait l'action de sa propre hauteur et désalignait les
deux colonnes de 27 px. Vérifié après correction : écart nul.

L'ancienne bande « Vous recrutez pour un organisme public ? » a été retirée —
elle disait, plus bas et plus discrètement, ce que cette section dit
maintenant à poids égal.

Accessibilité de la page refondue : **0 violation**, 37 règles passées, et le
membre bleu du titre mesuré à **7,35:1**.

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
| **Entretien guidé**, pour qui n'a pas de CV | ✅ | `EntretienScreen` · `entretienService` |
| Upload CV PDF → extraction | ❌ (volontairement dernier) | — |

### L'entretien guidé — `entretienService.js` · `/entretien`

C'est la porte sur laquelle le règlement insiste, et la plus difficile : les
deux autres supposent qu'on a déjà mis son parcours en forme, c'est-à-dire
qu'on sait ce qu'est une « réalisation » et comment nommer un poste.

🔴 **Trois règles, et elles tiennent tout :**

1. **Aucun fait n'est ajouté.** Le modèle reformule, il n'enrichit jamais : ni
   durée devinée, ni employeur complété, ni compétence « qu'on a forcément
   quand on a fait ça ». Ce qui manque remonte dans `manquant[]` et s'affiche
   comme une question, pas comme une erreur. Vérifié à l'essai : employeur et
   dates restent VIDES quand le récit ne les donne pas.
2. **Rien n'est enregistré sans validation.** Les routes `/entretien/*`
   **n'écrivent pas** ; l'enregistrement passe par `PUT /api/profil` au
   récapitulatif. Un entretien qui remplit le profil au fil de l'eau produit un
   CV que son auteur découvre — et ne peut pas défendre en entretien d'embauche.
3. **Ça marche sans modèle de langue.** Sans `OPENAI_API_KEY`, les réponses
   sont reprises telles quelles, et l'écran le dit **avant** que la personne
   raconte. Une panne d'API ne doit pas fermer la seule porte ouverte aux gens
   sans CV.

Mesuré sur trois récits réels de gens sans CV (commerce familial, aide à un
proche, encadrement sportif bénévole) : intitulés justes (« Aide familiale »,
« Employé de magasin »), descriptions à la première personne, et surtout des
**compétences extraites d'activités qui ne figurent jamais sur un CV**. « Je
n'ai aucun diplôme » renvoie correctement une liste vide.

⚠️ `memeCompetence` a été **déplacée dans `matchingService`** et exportée : elle
servait à `suggestionService`, puis à l'entretien. Une seconde copie aurait
divergé au premier ajustement de seuil.

⚠️ Défaut trouvé à l'essai, et corrigé dans la règle partagée : « Gestion des
livraisons » était rapproché de « Gestion de l'information » — le mot
« gestion » portait tout le rapprochement. `memeCompetence` exige désormais,
en plus des deux mots communs, que le libellé **le plus long** soit couvert au
tiers. Sans cette borne, deux mots communs suffisaient à rapprocher un libellé
de deux mots d'un libellé de quatorze. `npm run eval` inchangé (45 %, 0 % de
faux positifs) : cette fonction n'est pas dans le chemin de scoring.

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

## 16. La page d'accueil — montrer, pas promettre

`LandingScreen` · captures dans `public/images/captures/`.

C'est la page qui doit faire comprendre la plus-value en trente secondes, à
quelqu'un qui n'a jamais entendu parler de l'outil. Trois partis pris :

### 1. Le constat avant la promesse

Trois chiffres, **recalculés à chaque visite** depuis l'API : 18 employeurs,
**74 % des offres ouvertes ne décrivent pas le poste**, 38 corps et grades.

`GET /api/avps` expose `sansDetail`, calculé avec le **même critère** que
`diagnostiquerContenu` (§ 14) : sans cela, la page d'accueil annoncerait un
pourcentage pendant que la fiche d'offre en appliquerait un autre. Et le
chiffre reste vivant — écrit en dur, il serait faux avant le rendu, le corpus
se renouvelant en quelques semaines.

### 2. Trois preuves en images, pas des arguments

Les captures sont de **vraies captures de l'application sur le corpus réel**.
C'est la même exigence que la vidéo du concours : une chose montrée sans être
produite par l'outil ne compte pas.

⚠️ Elles sont **recadrées sur leur zone utile** (~550-680 px) et affichées à
peu près à leur taille réelle. Une capture pleine largeur réduite de moitié ne
prouve rien : on y voit qu'il existe « un écran », pas ce qu'il contient.

⚠️ Leur `alt` **décrit ce qu'elles montrent** : c'est du contenu informatif,
pas une décoration. Un `alt=""` priverait un lecteur d'écran de l'argument
lui-même.

⚠️ Le cadre de fenêtre n'est pas un ornement : les captures sont en thème
sombre et la page peut s'afficher en thème clair. Le cadre assume son propre
fond, l'image ne flotte pas.

⚠️ Une section sur deux inverse l'ordre **visuel** (`order`), jamais l'ordre du
document : au clavier et au lecteur d'écran, le texte précède toujours sa
capture.

### 3. « Ce que cet outil ne fera jamais »

Aucune offre inventée · aucun score sur une offre vide · aucune expérience
ajoutée à votre place · rien n'est envoyé sans vous.

Tous les outils de cette catégorie promettent la même chose ; aucun ne dit ce
qu'il refuse de faire. C'est pourtant ce qu'un candidat a besoin de savoir
avant de confier son parcours, et ce qui résume le mieux les invariants du
projet (§ 17).

Chaque titre commence par « Aucun » ou « Rien » : l'information reste entière
sans la couleur du liseré.

### Le logo

`LOGO` dans `constants.js` → `public/images/logo.png`. **Absent, l'en-tête garde
le sigle « EPNC »** : `Header` bascule sur `onError`. Un `<img>` sans fichier
afficherait une icône cassée sur chaque page — pire que pas de logo. Déposer le
fichier suffit à l'activer, aucun code à toucher. Voir
`public/images/README.md`, qui rappelle aussi qu'un logo ne doit reprendre
aucun emblème officiel : l'application n'a **aucun lien** avec l'OPT-NC ni les
collectivités dont elle republie les offres.

## 17. L'accessibilité — mesurée, pas affirmée

4 points au barème, et c'est le **sujet même du hackathon** : l'accès à
l'information. Les commentaires du dépôt revendiquaient l'accessibilité depuis
le début ; elle n'avait jamais été mesurée.

### Comment rejouer l'audit

Aucune dépendance ajoutée : `axe-core` est injecté depuis un CDN dans la page
ouverte, et l'audit tourne sur le DOM réel — c'est-à-dire sur ce qu'un
utilisateur a sous les yeux, pas sur un rendu de test.

```js
// Dans la console du navigateur, sur n'importe quel écran :
await new Promise((ok) => { const s = document.createElement("script");
  s.src = "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js";
  s.onload = ok; document.head.appendChild(s); });
document.querySelectorAll("details").forEach((d) => (d.open = true)); // déplier
(await axe.run(document, { resultTypes: ["violations"] })).violations;
```

⚠️ **Déplier les `<details>` et ouvrir les panneaux avant d'auditer.** Les
violations les plus graves trouvées ici n'existaient que panneau ouvert : un
audit sur l'état replié aurait rendu un rapport vert et faux.

### Relevé du 13/09/2026 — 8 écrans, **0 violation**

`/` · `/offres` · `/offres/:slug` · `/matchs` · `/profil` · `/entretien` ·
`/espace` · `/candidatures` · `/alertes` — 45 à 46 règles passées par écran.

### Les cinq défauts trouvés, et ce qu'ils apprennent

**1. `opacity` pour dire « désactivé » casse le contraste en silence.**
`.composante--neutre` portait `opacity: 0.75`. Le texte `--texte-doux`
(#a2adb9), parfaitement conforme seul, se compositait en **#727b85 → 4,2:1**
au lieu des 4,5 exigés. **278 éléments en faute, sur l'écran qui porte la valeur
du produit.** Rien dans la feuille de style ne le signalait : la couleur du
texte y est irréprochable, c'est l'opacité du parent qui la dégrade.
→ L'état se dit désormais par un trait en pointillés, un fond retiré et le mot
« neutralisée ». Contraste mesuré après correction : **7,38:1**.

**2. Un `<header>` dans un `role="dialog"` devient une seconde bannière.**
Le panneau de la bulle assistant créait un second landmark `banner` à côté de
l'en-tête du site (`landmark-no-duplicate-banner`). Dans un élément portant un
rôle explicite, le `<header>` n'est plus « scopé » par son sectionnement.
→ Un `<div>` ; le titre est déjà porté par l'`aria-label` du dialogue.

**3. Une zone qui défile doit pouvoir recevoir le focus.**
`.agent-fil` (impact *serious*) : au clavier, on pouvait écrire dans la bulle
mais pas **relire** la conversation dès qu'elle dépassait la hauteur du
panneau. → `tabIndex={0}` + `role="log"` + contour de focus rentrant (l'
`overflow: hidden` du panneau rognerait un contour extérieur).

**4. Sauter un niveau de titre.** `h2` (intitulé du poste) → `h4`
(composantes), sur 189 éléments. La navigation par titres est la façon dont un
lecteur d'écran parcourt une page longue. → `h3`.

**5. `m.role === "user"`** rangeait tous les messages du même côté du fil —
défaut fonctionnel trouvé au passage (l'enum du modèle est `"utilisateur"`).

⚠️ **Quatre défauts sur cinq venaient de code écrit le jour même**, en ayant
l'accessibilité à l'esprit. C'est l'argument pour l'audit outillé : la
vigilance ne remplace pas la mesure.

### Le clavier — vérifié séparément

Un audit automatique couvre environ un tiers des critères ; l'ordre de
tabulation n'en fait pas partie. Relevé sur la page d'accueil :

- **15 éléments focalisables, 15 avec un contour de focus visible** ;
- **aucun `tabindex` positif** — un seul suffirait à désorganiser tout l'ordre
  du document ;
- le **lien d'évitement arrive en premier**, la bulle assistant en dernier ;
- une seule « remontée » visuelle dans l'ordre : le déclencheur de la bulle,
  qui est en `position: fixed`. Ce n'est pas un défaut — un widget flottant
  doit venir **après** tout le contenu, sinon il s'interpose dans la
  tabulation de chaque page.

Panneau de la bulle ouvert : le focus entre sur le champ de saisie, l'ordre
interne est fermeture → fil → amorces → saisie, et `aria-expanded` suit l'état.

⚠️ Le panneau est **délibérément non modal** (pas d'`aria-modal`, pas de
piège à focus). Enfermer le focus serait contraire à sa raison d'être : on
l'ouvre pour poser une question **sur la page qu'on est en train de lire**, et
il faut pouvoir y retourner.

### Ce qui reste

Une relecture au lecteur d'écran des écrans de rapprochement — la seule chose
qu'aucun outil ne remplace.

## 18. L'évaluation — `npm run eval`

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

## 19. La qualité des pièces — `npm run eval:pieces`

`backend/evalPieces.js`. Le jury dépouille **CV et lettre à l'aveugle**, comme
un recruteur : **25 des 100 points** s'y jouent, et aucune matrice de confusion
ne les éclaire.

```bash
npm run eval:pieces                    # 3 personas × 2 offres, lettres
npm run eval:pieces -- --personas 8    # échantillon plus large
npm run eval:pieces -- --cv --texte    # CV compris, et afficher les lettres
```

### Ce qui est mesuré SANS modèle de langue

Les contraintes produit sont écrites dans les prompts. **Les écrire n'est pas
les faire respecter.** Le script les vérifie sur la sortie, de façon
déterministe : longueur, vocabulaire interdit, ouvertures interdites, présence
de l'objet, première phrase sur le poste.

⚠️ `VOCABULAIRE_INTERDIT`, `OUVERTURES_INTERDITES` et `LETTRE_MOTS` sont
**exportés par `redactionService` et servent à construire le prompt**. Une
seconde copie dans le script d'évaluation aurait divergé au premier ajout — et
la mesure aurait alors validé une contrainte qui n'est plus demandée.

La note de la passe de critique est relevée en plus, mais c'est **un modèle qui
juge un modèle** : une tendance, jamais une preuve. Les chiffres opposables sont
les déterministes.

### Ce que la première mesure a trouvé — 13/09/2026

**1. Aucune lettre n'atteignait la longueur demandée.** 155–199 mots, médiane
**175**, pour une cible de 250–300. Toutes trop courtes d'environ 40 %.

Deux causes, trouvées l'une après l'autre :

- le prompt disait « 250 à 300 mots **maximum** » — un plafond sans plancher,
  que le modèle optimise par la brièveté ;
- surtout, **un comptage de mots n'est pas une consigne exécutable** : un
  modèle ne compte pas ses mots. → Remplacé par un **plan en quatre
  paragraphes** (le poste · la preuve principale · les deux autres preuves · la
  disponibilité), avec le nombre de phrases attendu pour chacun. Un plan, lui,
  se suit.

🔎 **Le chiffre qui a failli trancher — et la leçon qu'il a coûtée.**
Fallait-il pousser plus loin, ou les lettres étaient-elles courtes faute de
matière ? On a mesuré la corrélation entre le nombre de correspondances
trouvées et la longueur produite. Un relevé a donné **r = 0,81** — « allonger
reviendrait à remplir ». Conclusion tentante : abaisser la cible.

🔴 **C'était du bruit.** Sur huit lettres, le même coefficient a donné
0,26 · 0,56 · **0,81** · 0,52 · −0,92 · −0,18. On avait retenu la valeur qui
arrangeait. La cible a été abaissée, puis **remise à 250-300**.

✅ **Tranché sur 35 lettres** (`--personas 7 --offres 5`) : **r = 0,41**. Un
lien réel mais faible — la matière disponible explique environ **17 %** de la
variance de longueur. Autrement dit :

- la brièveté n'est **pas** expliquée par un manque d'arguments (la thèse
  « les lettres sont aussi longues que la vérité le permet » est fausse) ;
- mais elle n'est **pas** arbitraire non plus.

Il reste un **plafond de comportement du modèle** autour de 230 mots : médiane
231, étendue 166-260, et seulement **14 % atteignent 250-300**. La cible ne
bouge pas ; l'écart est un défaut ouvert, désormais **caractérisé** au lieu
d'être supposé.

⚠️ **La règle, au-delà de ce fichier** : on ne déplace pas une cible sur la foi
d'une statistique qu'on n'a pas éprouvée sur assez de points.

**2. 🔴 Le modèle ALTÉRAIT un chiffre du profil.** Le profil de Mélanie Tarrou
porte « délai de traitement divisé par deux » ; une lettre annonçait
« réduction du temps de traitement **de 30 %** ». C'est un mensonge chiffré
dans un document que le candidat signe, et qu'un recruteur vérifie en
entretien — la faute la plus grave que ce projet puisse commettre.
→ Règle ajoutée : **les chiffres se recopient, ils ne se convertissent jamais**.

**3. 🔴 Le critique accusait d'invention des phrases tirées du profil.**
« Formation de trois remplaçantes successives » y figure **mot pour mot** ;
« stage à la mairie de Dumbéa » et « inventaire du parc » aussi. Or **toute**
invention signalée déclenche une réécriture : une fausse accusation faisait
donc supprimer un argument vrai, et la lettre ressortait plus courte et plus
pauvre. Ce défaut expliquait, en partie, le n° 1.

→ Deux parades, dont une déterministe :
   - le prompt du critique distingue un **fait fabriqué** d'une **reformulation
     fidèle** et d'une **phrase de liaison** ;
   - `inventionCredible()` vérifie **sans modèle** que les mots porteurs de
     l'extrait accusé ne se retrouvent pas dans le profil (seuil aux deux
     tiers, via `motsUtiles` et `memeRacine` — les primitives du moteur, pas
     une troisième implémentation).

   ⚠️ Le seuil penche du côté de la PRUDENCE : en cas de doute, l'accusation
   est conservée. Rater une vraie invention est plus grave que supprimer un bon
   argument.

**4. Le critique reprochait une faute que la lettre ne commettait pas.**
« La lettre ne commence pas par une phrase sur le poste » — alors que le
contrôle déterministe disait 100 % conformes. Et un reproche qui subsiste
déclenche une réécriture : la lettre était refaite pour corriger un défaut
imaginaire.
→ `ouvreSurLePoste()` **fait autorité sur l'avis du modèle** : quand le
contrôle passe, tout reproche portant sur l'ouverture est écarté. Ces contrôles
vivent dans `redactionService` et sont importés par le banc de mesure — une
copie aurait fini par rendre deux verdicts opposés sur la même lettre.

⚠️ Au passage, deux bugs d'écriture attrapés par les tests : les `` de la
regex d'ouverture avaient été écrits comme de vrais caractères de **retour
arrière** (0x08), et sans limites de mot « Maîtriser » était pris pour « ma »,
« Former » pour « fort ». Le détecteur est désormais couvert par huit cas.

### Le CV — mesuré là où c'est utile

⚠️ **Le CV envoyé à l'employeur n'est pas un texte de modèle.** `cvPdf()`
compose expériences, formations et compétences depuis le document `Profil`.
L'invention y est **structurellement impossible** : on ne peut pas écrire sur ce
CV un employeur qui n'est pas en base.

Deux choses seulement méritent donc d'être contrôlées, et elles le sont :

**1. L'invariant du réordonnancement.** Le CV remonte les expériences les plus
pertinentes pour le poste. Un ordre partiel ou fautif — indices en double,
liste tronquée, indice hors bornes — ferait **disparaître une expérience** du CV
d'une personne, sans avertissement : elle enverrait un document amputé de son
premier emploi en croyant l'avoir relu.

`reordonner()` refuse en bloc tout ordre qui n'est pas une permutation complète
et valide, et rend la liste intacte. **Un CV mal ordonné reste un CV vrai ; un
CV amputé est un faux.** La fonction a été sortie de `cvPdf` et exportée pour
être éprouvée — une garantie non testée n'en est pas une. **7 ordres testés,
dont 4 fautifs : aucune perte.**

**2. L'accroche**, seul fragment du CV employeur issu du modèle
(`premiereAccroche`). Sa traçabilité est vérifiée contre le profil **et contre
l'offre** : une accroche de CV nomme le poste visé — c'est tout son intérêt. La
confronter au seul profil faisait passer « le poste d'assistant administratif à
la Direction du travail » pour une invention, alors que ces mots viennent de
l'annonce.

### Deux défauts du banc de mesure lui-même

**🔴 Un indicateur qui félicitait le défaut qu'il devait détecter.** La
corrélation longueur/matière était lue en valeur absolue (`Math.abs(r)`) : une
corrélation **négative** — plus de correspondances, des lettres plus courtes,
soit exactement l'anomalie recherchée — était annoncée comme « la longueur suit
la matière ». Le signe compte autant que la force.

**Un coefficient sur trois points est du bruit.** Il atteint ±0,9 par accident.
Le rapport exige désormais **six lettres au minimum** avant d'afficher une
corrélation.

⚠️ Ces deux-là sont les plus insidieux de toute la session : un banc de mesure
faux ne se signale pas, il rassure.

### Relevé courant — **35 lettres**, 8 CV

| Contrôle | Départ | Maintenant |
|---|---|---|
| Longueur dans les bornes | 0 % | **94 %** |
| Longueur dans la cible 250–300 | 0 % | 14 % ← plafond du modèle |
| Objet présent | 100 % | **100 %** |
| Aucun mot interdit | 100 % | 91 % (« rigoureux » ×3) |
| Aucune ouverture interdite | 100 % | **100 %** |
| 1re phrase sur le POSTE | 100 % | **100 %** |
| Longueur médiane | 175 | **231** |
| Inventions signalées | 3 | **2, toutes deux fausses** (voir ci-dessous) |
| CV — aucune expérience perdue | — | **100 %** (7 ordres, dont 4 fautifs) |
| CV — accroche traçable | — | **100 %** |

Reproche récurrent utile, enfin : « formules creuses et superlatifs » (5×).
Contrairement aux précédents, celui-là est vrai et actionnable.

⚠️ **Ne pas ajuster `LETTRE_MOTS` pour faire monter un pourcentage.** La
tentation s'est présentée dans cette session même, avec un argument
statistique qui paraissait solide ; il n'a pas résisté à une mesure plus large.

### Le garde-fou anti-fausse-accusation, deuxième passe

Sur 35 lettres, deux accusations d'invention subsistaient — et **les deux
étaient fausses** : « plus de 900 raccordements » et « refonte du circuit de
contrôle des délibérations » figurent **mot pour mot** dans les profils. Elles
échappaient au filtre par la règle « moins de trois mots porteurs, on ne
conclut pas ».

→ `inventionCredible()` cherche désormais d'abord une **suite de cinq mots
consécutifs** reprise du profil. Le modèle enveloppe souvent la citation d'une
amorce (« Contribuant ainsi à la refonte du circuit… »), ce qui faisait échouer
une recherche littérale stricte.

⚠️ **Limite assumée** : une PARAPHRASE sémantique n'est pas rattrapée.
« réduction des délais de moitié » face à « délai de traitement divisé par
deux » reste signalée. Le filtre penche du côté de la prudence — rater une
vraie invention est plus grave que provoquer une réécriture inutile. Couvert
par 7 cas de test, dont 6 passent et 1 est ce faux positif connu.

## 20. La livraison — `docker compose up`

`Dockerfile` · `compose.yaml` · `.dockerignore` · `README.md`.

L'exigence de la feuille de route : **« un inconnu installe et fait tourner la
démo sans nous »**. C'est le critère *réutilisabilité et essaimage*, et surtout
la condition pour qu'un jury regarde le projet plutôt que la vidéo.

### Les partis pris

- **Une seule image, pas un conteneur par couche.** En production, `server.js`
  sert déjà le build CRA en statique : même origine, donc pas de CORS, pas de
  reverse proxy, et le cookie de session passe sans réglage. Un nginx devant un
  front séparé résoudrait un problème que nous n'avons pas.
- **Build en deux étapes** : les `node_modules` du front (react-scripts
  compris) ne partent pas dans l'image finale, seul `build/` en sort.
- `CI=false` à la compilation : react-scripts traite les avertissements comme
  des erreurs en intégration continue, et un avertissement de lint ne doit pas
  empêcher quelqu'un de faire tourner la démo.
- **L'ingestion est un service à part** qui s'exécute puis s'arrête. Le corpus
  se renouvelle : on le rafraîchit par `docker compose run --rm donnees` sans
  rien reconstruire. Et un `|| true` sur chaque étape — une source indisponible
  ne doit pas empêcher la pile de monter sur les données déjà en base.
- **Mongo n'est pas exposée sur l'hôte.** Publier 27017 sur la machine de
  quelqu'un pour une démonstration, ce serait ouvrir une base sans mot de passe
  sur son réseau.
- 🔴 **Aucune clé n'est requise.** `OPENAI_API_KEY`, SMTP : tous en
  `${VAR:-}`. Sans eux, l'application démarre et se démontre en mode dégradé.
  C'est ce qui rend la démo possible hors ligne et sans budget.

### ⚠️ `docker compose config` imprime les secrets

Les `${VAR:-}` sont interpolés depuis le `.env` du dossier. La commande qui
sert à **vérifier** le fichier a donc imprimé, en clair et sur la sortie
standard, la clé OpenAI, le mot de passe SMTP et le `JWT_SECRET`.

C'est arrivé pendant le développement ; les secrets ont été révoqués. Vérifier
le fichier sans environnement :

```bash
docker compose --env-file /dev/null config
```

Le `.env` n'a jamais été suivi par git (vérifié : absent de l'index et de
l'historique) — l'exposition s'est limitée à un terminal.

### État

Le fichier est **validé** (`docker compose config` passe, toutes les options
résolvent correctement sans aucune clé) mais **jamais exécuté** : le démon
Docker n'était pas lancé sur la machine de développement. `docker compose up
--build` reste à éprouver au moins une fois avant le rendu — c'est la seule
chose qui prouve le critère.

## 21. Les pages légales et le consentement

`LegalScreen/MentionsLegalesScreen` · `LegalScreen/ConfidentialiteScreen` ·
bloc de consentement dans `RegisterScreen`. Publiques toutes les deux :
quelqu'un qui veut savoir ce qu'on fait de ses données ne doit pas créer un
compte pour le lire.

### Écrites à partir du code, pas d'un modèle type

Chaque affirmation correspond à quelque chose de vérifiable dans le dépôt : les
champs des modèles Mongoose, les appels sortants, les suppressions en cascade.
Une politique copiée sur un générateur décrit un service imaginaire — et c'est
ce qui la rend inutile le jour où quelqu'un pose une vraie question.

### 🔴 Le tiers est annoncé EN PREMIER

Le contenu du profil est transmis à **OpenAI** au moment où une pièce est
produite. C'est l'information qui peut faire changer d'avis quelqu'un **avant**
qu'il ne saisisse son parcours — elle ouvre donc la page de confidentialité, et
figure dans le bloc de consentement à l'inscription.

Et la limite est dite avec : cette transmission n'a lieu **qu'à la demande de
rédaction**. Consulter, remplir son profil ou voir ses correspondances
n'envoie rien.

### Ce que les pages disent, et qui est vrai dans le code

| Affirmation | Où c'est vérifiable |
|---|---|
| Le mot de passe n'est lisible par personne | `select: false` + hachage |
| Par défaut, aucun recruteur ne voit le profil | `visibleRecruteurs: false` |
| Les coordonnées n'apparaissent pas dans les listes | `recruteurController` |
| Supprimer son compte efface profil et candidatures | cascade dans `userControlleur` |
| Vos données s'emportent | export JSON Resume (§ 13) |
| Aucun cookie publicitaire ni traceur | un seul cookie, de session |

Cette dernière ligne justifie l'**absence de bandeau cookies** : le site n'en
dépose aucun qui en exigerait un. Poser un bandeau « nous respectons votre vie
privée » alors qu'il n'y a rien à consentir serait du théâtre.

### ⚠️ Les mentions manquantes se VOIENT

Éditeur, contact et hébergeur dépendent de qui exploite le service : personne
ne peut les deviner. Ils apparaissent en rouge, précédés d'un ⚠, avec la classe
`.legal-attente`. **Un faux nom d'éditeur serait pire qu'une mention
manquante** : il désignerait un responsable qui n'existe pas. Trois champs
restent à compléter avant toute mise en ligne.

### Le consentement dit ce qu'il engage

La case n'est **pas pré-cochée** — un consentement par défaut n'en est pas un —
et le bouton reste désactivé tant qu'elle ne l'est pas. Trois lignes la
précèdent : ce à quoi sert le compte, qui voit le profil (personne par défaut),
et la transmission au tiers. Une case « j'accepte les CGU » cochée sans rien
lire ne vaut rien, ni juridiquement ni moralement.

Le consentement n'est **pas envoyé au serveur ni stocké** : ce qui compte est
qu'il ait été donné ici en connaissance de cause. L'enregistrer comme une
donnée de plus n'ajouterait rien — sinon une donnée de plus.

### ⚠️ Ce qui reste à faire trancher par un juriste

Le régime applicable en Nouvelle-Calédonie **n'est pas celui de la France
métropolitaine** : la collectivité a ses propres compétences, et le RGPD ne s'y
applique pas de la même manière. Les pages ci-dessus décrivent **fidèlement ce
que le service fait** — ce qui est la partie utile et vérifiable — mais leur
cadrage réglementaire (base légale, mentions obligatoires, autorité compétente,
durées imposées) doit être validé par quelqu'un de compétent avant mise en
ligne. Je ne l'ai pas fait et je ne peux pas le faire.

Accessibilité des deux pages : **0 violation**, 36 règles passées, vérifié à
404 px de large.

## 22. Invariants de sécurité et de données

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

## 23. Conventions

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

## 24. État d'avancement

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

1. **La longueur des lettres** (§ 19) — médiane 231, plafond du modèle autour
   de 230 mots, 14 % atteignent la cible. **Caractérisé** sur 35 lettres
   (r = 0,41) : ni manque de matière, ni brièveté arbitraire. Piste non
   explorée : un modèle plus capable que `gpt-4o-mini`.
2. **Accessibilité : la part que l'outil ne voit pas** (§ 17) — l'audit axe
   est passé, 0 violation sur 8 écrans. Restent le parcours **au clavier seul**
   et une relecture au lecteur d'écran.
3. **Passe de design** — il reste l'espace candidat et le tableau de bord
   recruteur ; accueil, fiche d'offre et liste des offres sont traités.
4. **Embeddings** (`all_embeddings.parquet`) — optionnel, et à ne faire qu'en
   rappel : le vecteur ne couvre que la description, ni `skills` ni
   `responsibilities`.
5. **Livraison** — `Dockerfile`, `compose.yaml` et `README.md` sont écrits et
   le compose est **validé** ; il reste à l'**exécuter au moins une fois**
   (§ 20), puis la vidéo et l'article dev.to. Gel du code au **18 octobre**.

**Décisions encore ouvertes** : track (SaaS recommandé — 25 points de valeur RH se
jouent sur la qualité du français) à déclarer **avant le 30 septembre** ; public
cible unique ; CRA conservé ou bascule Vite (`react-scripts` n'est plus maintenu —
touche *Maintenabilité /5*).

⚠️ **Ne plus enrichir l'espace recruteur.** La feuille de route déconseille
explicitement un « back-office recruteur riche » (critère *adéquation
moyens/résultats /5*). Ce qui existe est défendable — le vivier est demandé par
le règlement — mais chaque ajout se paie désormais sur ce critère.
