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
      "Les avis de vacance de poste ouverts à l'OPT-NC, normalisés au format schema.org/JobPosting et republiés en open data. Aucune saisie manuelle, aucune offre inventée.",
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
        <div className="conteneur hero-inner">
          <p className="hero-surtitre">
            Fonction publique · Nouvelle-Calédonie
          </p>

          <h1 className="hero-titre">
            Les postes ouverts dans la fonction publique calédonienne.
          </h1>

          <p className="hero-texte">
            Trouvez celui qui correspond à votre parcours, et partez avec un
            dossier prêt à envoyer.
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
