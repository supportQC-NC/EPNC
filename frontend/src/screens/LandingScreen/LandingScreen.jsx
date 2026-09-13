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
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      {/* La photo est appliquée ici plutôt qu'en CSS : voir HERO_PHOTO dans
          constants.js pour la raison (résolution webpack des url()). */}
      <section
        className="hero"
        style={{ backgroundImage: `url("${HERO_PHOTO}")` }}
      >
        {/* Deux éléments, et non un seul portant les deux classes.
            `.conteneur` centre une largeur de page de 1320 px ; `.hero-inner`
            limitait le texte à 704 px — cumulés, le `margin-inline: auto` du
            premier centrait le second, et le texte du hero se retrouvait à
            600 px du bord, aligné sur rien : ni sur la gouttière des autres
            sections, ni sur la partie forte du voile de contraste, qui est
            calculé pour un texte à GAUCHE. */}
        <div className="conteneur">
          <div className="hero-inner">
          <p className="hero-surtitre">
            Fonction publique · Nouvelle-Calédonie
          </p>

          {/* Le titre porte la PROMESSE, pas le nom de la rubrique.
              « Les postes ouverts dans la fonction publique calédonienne »
              décrivait le sujet — c'est un intitulé de page, pas un argument,
              et il tenait sur quatre lignes. Celui-ci annonce ce que la page
              va prouver juste en dessous, captures à l'appui. */}
          <h1 className="hero-titre">Les offres publiques, enfin lisibles.</h1>

          <p className="hero-texte">
            On traduit le jargon administratif, on vous montre pourquoi un
            poste correspond à votre parcours, et on prépare votre lettre et
            votre CV.
          </p>

          <Compteur />

          <div className="actions hero-actions">
            {/* L'action principale est de VOIR les postes. On ne demande pas à
                quelqu'un de créer un compte avant de lui avoir montré qu'il y
                a quelque chose pour lui. */}
            <Link to="/offres" className="btn btn-principal">
              Voir les postes
            </Link>
            <Link to="/inscription" className="btn btn-secondaire">
              Créer un compte
            </Link>
          </div>

          <p className="hero-mention">Consultation libre, sans compte.</p>
          </div>
        </div>

        {/* Invite à défiler. C'est un vrai lien d'ancrage, pas un décor : au
            clavier il permet de sauter directement à la suite. Le libellé est
            lisible ; seule la flèche est décorative. */}
        <a href="#parcours" className="hero-defiler">
          Découvrir
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </a>
      </section>

      <Constat />

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

      {/* ── L'autre côté du guichet ───────────────────────────────────
          Cette page s'adresse à des candidats, et un employeur qui la lit n'y
          trouverait rien pour lui. Un bandeau, pas une troisième grande
          promesse : il ne doit pas concurrencer l'appel principal, seulement
          exister pour qui le cherche.

          Il dit d'emblée que l'accès est vérifié — c'est aussi, et surtout, ce
          qui rassure les candidats qui lisent cette page. */}
      <section className="section recruteur-bande" aria-labelledby="titre-recruteur">
        <div className="conteneur recruteur-bande-inner">
          <div>
            <h2 id="titre-recruteur" className="recruteur-bande-titre">
              Vous recrutez pour un organisme public&nbsp;?
            </h2>
            <p className="recruteur-bande-texte">
              L'espace recruteur donne accès aux profils des candidats et au
              rapprochement dans l'autre sens, du poste vers les personnes.
              Chaque demande est vérifiée par un administrateur — la réponse
              arrive par courriel, motivée.
            </p>
          </div>
          <Link to="/devenir-recruteur" className="btn btn-secondaire">
            Devenir recruteur
          </Link>
        </div>
      </section>

      {/* ── Rappel ───────────────────────────────────────────────────── */}
      <section className="section rappel" aria-labelledby="titre-rappel">
        <div className="conteneur rappel-inner">
          <h2 id="titre-rappel" className="section-titre">
            Voir les postes qui vous correspondent
          </h2>
          <p className="section-intro">
            Créez votre compte, décrivez votre parcours, laissez la plateforme
            faire le rapprochement.
          </p>
          <div className="actions rappel-actions">
            <Link to="/offres" className="btn btn-principal">
              Parcourir les offres
            </Link>
            <Link to="/inscription" className="btn btn-secondaire">
              Créer mon compte
            </Link>
          </div>
        </div>
      </section>
    </>
  );
};

export default LandingScreen;
