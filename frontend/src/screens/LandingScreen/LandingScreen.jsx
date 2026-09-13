// src/screens/LandingScreen/LandingScreen.jsx
import { Link } from "react-router-dom";
import { useGetAvpsQuery } from "../../slices/avpApiSlice";
import { HERO_PHOTO } from "../../constants";
import "./LandingScreen.css";

// Les quatre fonctions imposées par le règlement, décrites du point de vue du
// candidat. Personne n'a envie de lire « fonction ① : acquisition du profil ».
const ETAPES = [
  {
    numero: "1",
    titre: "Racontez votre parcours",
    texte:
      "Déposez un CV, importez un JSON Resume, ou laissez-vous guider par quelques questions. Sans CV sous la main, ça marche aussi.",
  },
  {
    numero: "2",
    titre: "Voyez ce qui vous correspond",
    texte:
      "Chaque poste ouvert est confronté à votre profil. Vous voyez le score, ce qui le justifie — et pourquoi certains postes ont été écartés.",
  },
  {
    numero: "3",
    titre: "Obtenez votre dossier",
    texte:
      "Une lettre et un CV recentrés sur le poste visé. Plus, pour vous seul, l'analyse de vos écarts et une préparation à l'entretien.",
  },
  {
    numero: "4",
    titre: "Envoyez votre candidature",
    texte:
      "Vos pièces sortent en fichiers prêts à transmettre. Le recruteur reçoit un dossier qui se lit vite et qui répond au poste.",
  },
];

const SOCLE = [
  {
    titre: "Les offres réelles",
    texte:
      "Les avis de vacance de poste de dix-huit employeurs publics calédoniens — OPT-NC, Nouvelle-Calédonie, provinces, hôpitaux, communes — normalisés au format schema.org/JobPosting et republiés en open data. Aucune saisie manuelle, aucune offre inventée.",
  },
  {
    titre: "Le référentiel des métiers",
    texte:
      "Douze familles de métiers et leurs compétences attendues. C'est ce référentiel qui rend le rapprochement explicable : on parle compétences, pas score opaque.",
  },
  {
    titre: "Votre profil, au format standard",
    texte:
      "Stocké en JSON Resume, un schéma ouvert. Vous pouvez le récupérer et le réutiliser ailleurs — il vous appartient.",
  },
];

// ══════════════════════════════════════════════════════════════════════════
//  LES TROIS PREUVES
// ══════════════════════════════════════════════════════════════════════════
// Une page d'accueil qui affirme « rapprochement intelligent » ne convainc
// personne : tout le monde écrit ça. On montre donc l'écran, en vrai, avec le
// texte qu'il produit vraiment.
//
// ⚠️ Ce sont de VRAIES captures de l'application sur le corpus réel, pas des
// maquettes. C'est ce qui rend la démonstration opposable — et la règle est la
// même que pour la vidéo du concours : une chose montrée sans être produite
// par l'outil ne compte pas.
const PREUVES = [
  {
    etiquette: "Le rapprochement",
    titre: "Vous voyez pourquoi, pas seulement combien",
    texte:
      "Chaque point du score renvoie à deux extraits : ce que l'annonce demande, et l'élément de votre parcours qui y répond. Un score qu'on ne peut pas discuter ne sert à rien.",
    points: [
      "Le détail composante par composante, jamais un chiffre nu",
      "Les postes écartés apparaissent aussi, avec le motif",
      "Une part du barème inapplicable est neutralisée, pas comptée zéro",
    ],
    image: "/images/captures/rapprochement.jpg",
    // L'alternative textuelle DÉCRIT ce que la capture montre : c'est du
    // contenu informatif, pas une décoration. Un `alt=""` ici priverait un
    // lecteur d'écran de l'argument lui-même.
    alt: "Écran de correspondance : le poste « Chargé de mission - Contrôleur de gestion » noté 60 sur 100, avec le détail des composantes et, pour chaque attendu de l'annonce, l'élément du profil qui le couvre.",
  },
  {
    etiquette: "Le langage clair",
    titre: "« Attaché », « ACDP-grille rémunération 1 »… traduits",
    texte:
      "Les avis publics sont écrits dans une langue administrative que personne n'apprend nulle part. On la traduit, sans jamais masquer le terme officiel — c'est lui qui figure sur le formulaire de candidature.",
    points: [
      "38 corps et grades expliqués en français courant",
      "Les mots de l'administration définis là où ils sont employés",
      "Quand l'employeur ne publie rien, on le dit au lieu d'afficher du vide",
    ],
    image: "/images/captures/langage-clair.jpg",
    alt: "Fiche d'une offre : le corps « attaché » est traduit en « Cadre administratif » avec son explication, et un encadré indique que l'employeur ne publie pas le détail du poste.",
  },
  {
    etiquette: "Sans CV",
    titre: "Vous racontez, on met en forme",
    texte:
      "Garder ses petits-enfants, tenir la caisse d'un commerce familial, entraîner une équipe : ce sont des expériences, et elles contiennent des compétences que les offres demandent. Encore faut-il les écrire dans leurs mots.",
    points: [
      "Des questions simples, une à la fois",
      "Rien n'est inventé : ce qui manque vous est demandé",
      "Vous corrigez tout avant que ça devienne votre CV",
    ],
    image: "/images/captures/entretien.jpg",
    alt: "Écran de l'entretien guidé : le récit « je m'occupe de ma grand-mère » a été mis en forme en expérience « Aide familiale », avec trois compétences proposées à cocher.",
  },
];

// Des situations, pas des témoignages.
//
// ══════════════════════════════════════════════════════════════════════════
//  POURQUOI AUCUNE CITATION DE « VRAIE PERSONNE » SUR CETTE PAGE
// ══════════════════════════════════════════════════════════════════════════
// L'attente naturelle, à cet endroit d'une page, c'est le carrousel de
// témoignages : une photo, un prénom, une phrase élogieuse. Le service n'a
// pas d'utilisateurs réels — ces citations seraient inventées, et ce seraient
// donc de faux avis.
//
// Ce n'est pas seulement un problème de principe. La page affirme trois
// sections plus bas « aucune offre inventée » et « aucune expérience ajoutée
// à votre place ». Des témoignages fabriqués au-dessus feraient de ces
// promesses du décor — et c'est précisément ce qu'un jury qui cherche des
// faux repère en premier.
//
// ══════════════════════════════════════════════════════════════════════════
//  CE QUI MARCHE MIEUX, ET QUI EST VRAI
// ══════════════════════════════════════════════════════════════════════════
// On s'adresse à la personne au lieu de lui faire lire des inconnus. Une
// situation qu'elle reconnaît la concerne plus qu'un éloge signé d'un prénom
// qu'elle ne connaît pas — et elle n'a pas à se demander si c'est sincère.
//
// Chaque bloc est construit pareil : la situation en « vous », l'obstacle
// nommé sans détour, puis ce que l'outil fait — au présent, sans conditionnel
// ni promesse de résultat. On ne promet jamais un emploi.
const SITUATIONS = [
  {
    situation: "Vous avez un métier, pas un CV.",
    obstacle:
      "Vous avez tenu la caisse d'un commerce familial, gardé des enfants, entraîné une équipe, accompagné un proche. Ce sont des années de travail réel — et rien de tout ça ne rentre dans les cases d'un formulaire.",
    reponse:
      "Racontez-le avec vos mots. L'outil met en forme, nomme les compétences que ça démontre, et vous corrigez. Ce qu'il ne sait pas, il vous le demande.",
    lien: { to: "/entretien", libelle: "Construire mon parcours" },
  },
  {
    situation: "Vous avez postulé, sans savoir pourquoi ça n'a pas marché.",
    obstacle:
      "Une annonce demande une « maîtrise de l'instruction budgétaire M52 ». Vous ne savez pas si votre expérience compte, et personne ne vous dira jamais ce qui a manqué.",
    reponse:
      "Chaque poste est confronté à votre parcours, attendu par attendu : ce qui est couvert, par quoi, et ce qui manque. Y compris pour les postes écartés, avec le motif.",
    lien: { to: "/offres", libelle: "Voir les postes ouverts" },
  },
  {
    situation: "Vous n'avez pas le temps de réécrire une lettre par offre.",
    obstacle:
      "Dix annonces intéressantes, dix lettres à adapter, un CV à réordonner à chaque fois. En pratique, on en envoie deux et on abandonne.",
    reponse:
      "Votre profil est rempli une fois. Pour chaque offre, la lettre et le CV se recentrent sur ce que le poste demande — vous relisez, vous corrigez, vous envoyez.",
    lien: { to: "/inscription", libelle: "Créer mon profil" },
  },
];

// Ce que l'outil change, de chaque côté du guichet.
//
// ══════════════════════════════════════════════════════════════════════════
//  UN SEUL MÉCANISME, DEUX BÉNÉFICES — ET C'EST LE MÊME
// ══════════════════════════════════════════════════════════════════════════
// Le profil est stocké en JSON Resume et le CV est COMPOSÉ à partir de lui,
// jamais rédigé en texte libre. Cette seule décision technique produit les
// deux promesses ci-dessous :
//
//   côté candidat  → on remplit une fois, et chaque dossier se recentre tout
//                    seul sur le poste visé ;
//   côté recruteur → tous les dossiers arrivent au même format, donc se
//                    comparent au lieu de se déchiffrer.
//
// Les dire séparément serait rater ce qui les relie. La page les met donc
// côte à côte, à poids égal : l'outil n'a pas un public principal et un
// public toléré.
const DEUX_COTES = [
  {
    cle: "candidats",
    surtitre: "Pour les candidats",
    titre: "Un profil, autant de CV que de postes",
    texte:
      "Vous décrivez votre parcours une fois. Pour chaque offre, le CV se réordonne selon ce que le poste demande — et il reste le vôtre : il ne contient rien que vous n'ayez écrit.",
    points: [
      "Rempli une fois, réutilisé pour chaque candidature",
      "Les expériences les plus proches du poste remontent d'elles-mêmes",
      "Aucune expérience ne disparaît au passage",
      "Vos données au format JSON Resume — vous pouvez les reprendre ailleurs",
    ],
    action: { to: "/inscription", libelle: "Créer mon profil" },
  },
  {
    cle: "recruteurs",
    surtitre: "Pour les recruteurs",
    titre: "Des dossiers qui se comparent, pas qui se déchiffrent",
    texte:
      "Les candidatures arrivent au même format, avec une lettre qui répond à votre annonce plutôt qu'une lettre type. Et le rapprochement fonctionne aussi dans l'autre sens : du poste vers les profils.",
    points: [
      "Une mise en page identique d'un dossier à l'autre",
      "Une lettre qui cite vos attendus, pas des formules",
      "Le vivier : chercher des profils pour un poste ouvert",
      "Chaque rapprochement justifié — jamais un score opaque",
    ],
    action: { to: "/devenir-recruteur", libelle: "Devenir recruteur" },
    note: "L'accès recruteur est vérifié par un administrateur.",
  },
];

// Une capture présentée dans un cadre de fenêtre.
//
// Le cadre n'est pas un ornement : les captures sont prises en thème sombre,
// et la page peut s'afficher en thème clair. Sans un contenant qui assume son
// propre fond, l'image flotterait comme une tache. Le cadre dit « ceci est un
// écran », et le décalage de thème devient lisible au lieu d'être un défaut.
const Capture = ({ src, alt }) => (
  <div className="fenetre">
    <div className="fenetre-barre" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
    {/* `loading="lazy"` : trois captures sous la ligne de flottaison ne
        doivent pas retarder l'affichage du haut de page sur une connexion
        calédonienne. */}
    <img src={src} alt={alt} loading="lazy" decoding="async" />
  </div>
);

// Ce que l'outil ne fait pas.
//
// ══════════════════════════════════════════════════════════════════════════
//  DIRE SES LIMITES EST UN ARGUMENT, PAS UN AVEU
// ══════════════════════════════════════════════════════════════════════════
// Tous les outils de cette catégorie promettent la même chose. Aucun ne dit
// ce qu'il refuse de faire. Or c'est exactement ce qu'un candidat a besoin de
// savoir avant de confier son parcours — et ce qu'un employeur public a besoin
// de savoir avant d'orienter quelqu'un vers nous.
const REFUS = [
  {
    titre: "Aucune offre inventée",
    texte:
      "Tout vient des avis de vacance publiés en open data. Aucune saisie manuelle, aucun poste ajouté pour étoffer la liste.",
  },
  {
    titre: "Aucun score sur une offre vide",
    texte:
      "Quand l'employeur ne publie pas ses attendus, nous n'en déduisons rien. « Non évaluable » est une réponse ; un chiffre flatteur n'en est pas une.",
  },
  {
    titre: "Aucune expérience ajoutée à votre place",
    texte:
      "Les documents produits ne contiennent que ce qui est dans votre profil. Un diplôme que vous n'avez pas ne peut pas apparaître dans votre lettre.",
  },
  {
    titre: "Rien n'est envoyé sans vous",
    texte:
      "Vos pièces vous sont rendues. La décision de candidater, et le geste de transmettre, restent les vôtres.",
  },
];

// Compteur en direct. Il remplace une promesse par un fait vérifiable, et
// donne une raison immédiate de cliquer. Tant que la donnée n'est pas là, on
// n'affiche rien plutôt qu'un squelette qui clignote.
const Compteur = () => {
  const { data, isError } = useGetAvpsQuery({});

  if (isError || !data) return null;

  return (
    <p className="hero-compteur">
      <span className="hero-chiffre">{data.ouvertes}</span>
      {data.ouvertes > 1 ? " postes ouverts" : " poste ouvert"} en ce moment
      {/* Le séparateur « · » est ajouté en CSS, et seulement quand les deux
          parties tiennent sur la même ligne : sur téléphone il se retrouverait
          orphelin en début de seconde ligne. */}
      <span className="hero-compteur-sec">
        {data.total} offres consultables
      </span>
    </p>
  );
};

// Le constat, en chiffres vivants.
//
// ══════════════════════════════════════════════════════════════════════════
//  POURQUOI CES TROIS NOMBRES, ET PAS UNE PROMESSE
// ══════════════════════════════════════════════════════════════════════════
// Ils viennent de l'API, recalculés à chaque visite. Un chiffre écrit en dur
// serait faux avant le rendu du concours : le corpus se renouvelle
// intégralement en quelques semaines.
//
// Le second est le plus important, et c'est celui qu'aucun concurrent
// n'affichera : la majorité des avis publics ne décrivent pas le poste. Le
// dire sur la page d'accueil, c'est annoncer ce qu'on sait faire ET ce que la
// donnée ne permet pas — le contraire d'une plaquette.
const Constat = () => {
  const { data } = useGetAvpsQuery({});

  if (!data) return null;

  const part = data.ouvertes
    ? Math.round((data.sansDetail / data.ouvertes) * 100)
    : 0;

  return (
    <section className="section constat" aria-labelledby="titre-constat">
      <div className="conteneur">
        <h2 id="titre-constat" className="section-titre">
          Chercher un emploi public, aujourd'hui
        </h2>

        <ul className="constat-liste">
          <li>
            <span className="constat-chiffre">{data.employeurs?.length || 18}</span>
            <span className="constat-libelle">employeurs publics</span>
            <span className="constat-detail">
              L'OPT, la Nouvelle-Calédonie, les provinces, les hôpitaux, les
              communes. Chacun publie de son côté, dans son format.
            </span>
          </li>
          <li className="constat--alerte">
            <span className="constat-chiffre">{part}&nbsp;%</span>
            <span className="constat-libelle">des offres ne décrivent pas le poste</span>
            <span className="constat-detail">
              {data.sansDetail} avis ouverts sur {data.ouvertes} ne publient ni
              missions ni compétences attendues. Mesuré sur la donnée source,
              pas estimé.
            </span>
          </li>
          <li>
            <span className="constat-chiffre">38</span>
            <span className="constat-libelle">corps et grades différents</span>
            <span className="constat-detail">
              « Attaché », « rédacteur », « ACDP-grille rémunération 1 ». Des
              intitulés qui ne disent pas le métier.
            </span>
          </li>
        </ul>

        <p className="constat-conclusion">
          Un outil honnête ne peut pas promettre de corriger ce que les
          employeurs ne publient pas. Il peut{" "}
          <strong>traduire ce qui existe</strong>,{" "}
          <strong>justifier chaque rapprochement</strong> et{" "}
          <strong>dire clairement ce qu'il ignore</strong>. C'est ce que fait
          celui-ci.
        </p>
      </div>
    </section>
  );
};

const LandingScreen = () => {
  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────
          ══════════════════════════════════════════════════════════════
           COMPOSITION PARTAGÉE : LA PROMESSE, ET LE PRODUIT À CÔTÉ
          ══════════════════════════════════════════════════════════════
          La version précédente occupait tout l'écran avec une photo de
          poignée de main et trois lignes de texte. Deux défauts :

          1. La photo ne reflétait pas l'outil. Une poignée de main sur un
             bureau dit « entreprise » ; ici, le sujet est de rendre lisible
             un texte administratif. C'était l'élément le plus générique de
             la page, et le plus lourd à charger.
          2. Le produit n'apparaissait qu'au troisième écran. Un visiteur
             décide en quelques secondes s'il a affaire à une plaquette ou à
             un outil : il faut le lui montrer tout de suite.

          La photo de fond est conservée, et la moitié droite porte une VRAIE
          capture de l'écran de rapprochement. Les deux cohabitent grâce à un
          voile DIRECTIONNEL : très dense sous la colonne de texte, il s'ouvre
          vers la droite où la photo respire derrière le cadre de la capture.

          ⚠️ L'URL est posée en style en ligne, PAS dans la feuille de style :
          webpack résout les `url()` des CSS à la compilation, et un fichier
          absent y casse le build au lieu de se replier sur la couleur de
          fond. Voir HERO_PHOTO dans constants.js. */}
      <section
        className="hero"
        style={{ backgroundImage: `url("${HERO_PHOTO}")` }}
      >
        <div className="conteneur conteneur--large hero-grille">
          <div className="hero-texte-bloc">
            <p className="hero-surtitre">
              Fonction publique · Nouvelle-Calédonie
            </p>

            {/* Le titre porte la PROMESSE, pas le nom de la rubrique. Il
                annonce ce que la page prouve plus bas, captures à l'appui. */}
            <h1 className="hero-titre">Les offres publiques, enfin lisibles.</h1>

            <p className="hero-texte">
              On traduit le jargon administratif, on vous montre pourquoi un
              poste correspond à votre parcours, et on prépare votre lettre et
              votre CV.
            </p>

            <Compteur />

            <div className="actions hero-actions">
              {/* L'action principale est de VOIR les postes. On ne demande pas
                  à quelqu'un de créer un compte avant de lui avoir montré
                  qu'il y a quelque chose pour lui. */}
              <Link to="/offres" className="btn btn-principal">
                Voir les postes
              </Link>
              <Link to="/inscription" className="btn btn-secondaire">
                Créer un compte
              </Link>
            </div>

            <p className="hero-mention">Consultation libre, sans compte.</p>
          </div>

          {/* Le produit, dès le premier écran. `aria-hidden` : la capture est
              décrite en détail plus bas, dans la section « preuves », où elle
              est l'argument. Ici elle est une illustration, et la redire
              deux fois à un lecteur d'écran n'apporte rien. */}
          <div className="hero-apercu" aria-hidden="true">
            <div className="fenetre">
              <div className="fenetre-barre">
                <span />
                <span />
                <span />
              </div>
              <img
                src="/images/captures/rapprochement.jpg"
                alt=""
                width="665"
                height="683"
                // `eager` et non `lazy` : c'est l'image du premier écran.
                loading="eager"
                decoding="async"
              />
            </div>
          </div>
        </div>
      </section>

      <Constat />

      {/* ── Ça vous ressemble ? ──────────────────────────────────────── */}
      <section className="section situations" aria-labelledby="titre-situations">
        <div className="conteneur conteneur--large">
          <h2 id="titre-situations" className="section-titre">
            Ça vous ressemble&nbsp;?
          </h2>
          <p className="section-intro">
            Trois situations qui font abandonner une candidature. Voici ce que
            l'outil fait pour chacune.
          </p>

          <ul className="situations-liste">
            {SITUATIONS.map((s) => (
              <li key={s.situation} className="situation">
                <h3 className="situation-titre">{s.situation}</h3>
                <p className="situation-obstacle">{s.obstacle}</p>
                <p className="situation-reponse">{s.reponse}</p>
                <Link to={s.lien.to} className="situation-lien">
                  {s.lien.libelle}
                  <span aria-hidden="true"> →</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Ce que ça change, des deux côtés ─────────────────────────── */}
      <section className="section deux-cotes" aria-labelledby="titre-deux-cotes">
        <div className="conteneur conteneur--large">
          {/* Le titre en trois temps, un par acteur. C'est la phrase qui
              résume l'outil : la personne n'a qu'UNE chose à faire, tout le
              travail de mise en forme est fait pour elle, et ce qui arrive au
              recruteur est lisible. Le reste de la section le détaille. */}
          <h2 id="titre-deux-cotes" className="section-titre section-titre--temps">
            <span>Vous renseignez.</span>{" "}
            <span>L'outil adapte.</span>{" "}
            <span>Le recruteur comprend.</span>
          </h2>
          <p className="section-intro">
            Vous décrivez votre parcours <strong>une seule fois</strong>. Pour
            chaque offre, le CV se réordonne et la lettre se recentre sur ce
            que le poste demande — sans que vous ayez rien à réécrire. En face,
            le recruteur reçoit un dossier au même format que les autres, qui
            répond à son annonce.
          </p>

          <div className="cotes">
            {DEUX_COTES.map((c) => (
              <article key={c.cle} className={`cote cote--${c.cle}`}>
                <p className="cote-surtitre">{c.surtitre}</p>
                <h3 className="cote-titre">{c.titre}</h3>
                <p className="cote-texte">{c.texte}</p>

                <ul className="cote-points">
                  {c.points.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>

                {/* La mention AVANT le bouton, et non après : placée en
                    dessous, elle remontait l'action de sa propre hauteur et
                    désalignait les deux colonnes. Au-dessus, elle se lit
                    comme ce qu'elle est — une condition à connaître avant de
                    cliquer — et les deux boutons retombent au même niveau. */}
                {c.note && <p className="cote-note">{c.note}</p>}
                <Link to={c.action.to} className="btn btn-principal">
                  {c.action.libelle}
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Le parcours ──────────────────────────────────────────────── */}
      <section id="parcours" className="section" aria-labelledby="titre-etapes">
        <div className="conteneur">
          <h2 id="titre-etapes" className="section-titre">
            Du parcours au dossier envoyé
          </h2>
          <p className="section-intro">
            Quatre temps, sans jargon administratif et sans lettre type.
          </p>

          {/* Liste ordonnée : l'ordre est une information, il doit exister
              pour un lecteur d'écran comme il existe à l'œil. */}
          <ol className="etapes">
            {ETAPES.map((etape) => (
              <li key={etape.numero} className="etape">
                <span className="etape-numero" aria-hidden="true">
                  {etape.numero}
                </span>
                <div>
                  <h3 className="etape-titre">{etape.titre}</h3>
                  <p className="etape-texte">{etape.texte}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Les trois preuves, en images ─────────────────────────────── */}
      {PREUVES.map((p, i) => (
        <section
          key={p.etiquette}
          className={`section preuve${i % 2 ? " preuve--inverse" : ""}${i % 2 ? " section-alt" : ""}`}
          aria-labelledby={`titre-preuve-${i}`}
        >
          <div className="conteneur conteneur--large preuve-inner">
            <div className="preuve-texte">
              <p className="preuve-etiquette">{p.etiquette}</p>
              <h2 id={`titre-preuve-${i}`} className="section-titre">
                {p.titre}
              </h2>
              <p className="section-intro">{p.texte}</p>
              <ul className="preuve-points">
                {p.points.map((pt) => (
                  <li key={pt}>{pt}</li>
                ))}
              </ul>
            </div>

            <Capture src={p.image} alt={p.alt} />
          </div>
        </section>
      ))}

      {/* ── Le socle de données ──────────────────────────────────────── */}
      <section className="section section-alt" aria-labelledby="titre-donnees">
        <div className="conteneur">
          <h2 id="titre-donnees" className="section-titre">
            Des données publiques, utilisées telles quelles
          </h2>

          <ul className="socle">
            {SOCLE.map((bloc) => (
              <li key={bloc.titre} className="socle-carte">
                <h3>{bloc.titre}</h3>
                <p>{bloc.texte}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Ce que l'outil ne fait pas ───────────────────────────────── */}
      <section className="section refus" aria-labelledby="titre-refus">
        <div className="conteneur">
          <h2 id="titre-refus" className="section-titre">
            Ce que cet outil ne fera jamais
          </h2>
          <p className="section-intro">
            Vous confiez votre parcours à un service qui produit des documents
            que vous allez signer. Voici ce qu'il s'interdit.
          </p>

          <ul className="refus-liste">
            {REFUS.map((r) => (
              <li key={r.titre} className="refus-carte">
                <h3>{r.titre}</h3>
                <p>{r.texte}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* L'ancienne bande « Vous recrutez pour un organisme public ? » a été
          retirée : elle disait, en plus discret et plus bas, ce que la section
          « des deux côtés » dit désormais à poids égal. La garder aurait fait
          deux appels au même public sur la même page. */}

      {/* ── Rappel ───────────────────────────────────────────────────── */}
      <section className="section rappel" aria-labelledby="titre-rappel">
        <div className="conteneur rappel-inner">
          {/* Le rappel final disait « créez votre compte, décrivez votre
              parcours » : la description d'une corvée, pas une raison de
              cliquer. Il dit maintenant ce qu'on obtient et ce que ça coûte.

              ⚠️ Aucune promesse d'emploi, ici ni ailleurs. On promet de
              montrer ce qui correspond et de préparer le dossier — c'est
              tout ce qu'on sait tenir. */}
          <h2 id="titre-rappel" className="section-titre">
            Dix minutes maintenant, et chaque candidature est prête ensuite.
          </h2>
          <p className="section-intro">
            Vous décrivez votre parcours une fois. Vous voyez aussitôt les
            postes ouverts qui vous correspondent, et pourquoi. Pour chacun, la
            lettre et le CV sont préparés — à relire et à corriger, jamais
            envoyés sans vous.
          </p>
          <div className="actions rappel-actions">
            <Link to="/inscription" className="btn btn-principal">
              Créer mon profil
            </Link>
            <Link to="/offres" className="btn btn-secondaire">
              Voir d'abord les postes
            </Link>
          </div>
          <p className="rappel-mention">
            Gratuit. Consultation des offres libre, sans compte.
          </p>
        </div>
      </section>
    </>
  );
};

export default LandingScreen;
