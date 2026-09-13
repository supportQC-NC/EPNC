// src/components/Global/Footer/Footer.jsx
import { Link } from "react-router-dom";
import { APP_NAME } from "../../../constants";

const Footer = () => {
  return (
    <footer className="pied">
      <div className="conteneur">
        <p>
          <strong>{APP_NAME}</strong> — les postes ouverts dans la fonction
          publique calédonienne.
        </p>
        <p>
          Offres issues des avis de vacance de poste publics de plusieurs
          employeurs calédoniens — OPT-NC, Nouvelle-Calédonie, provinces,
          hôpitaux, communes — normalisées au format{" "}
          <a
            href="https://schema.org/JobPosting"
            target="_blank"
            rel="noreferrer noopener"
          >
            schema.org/JobPosting
          </a>
          . L'employeur est indiqué sur chaque offre. Service indépendant,
          sans lien officiel avec aucun de ces employeurs. Les profils utilisés
          en démonstration sont fictifs.
        </p>

        {/* Les pages légales vivent dans le pied de page, à l'endroit où on
            les cherche. Elles sont publiques : quelqu'un qui veut savoir ce
            qu'on fait de ses données ne doit pas créer un compte pour le
            lire. */}
        <nav className="pied-legal" aria-label="Informations légales">
          <Link to="/mentions-legales">Mentions légales</Link>
          <Link to="/confidentialite">Vos données</Link>
          <Link to="/devenir-recruteur">Devenir recruteur</Link>
        </nav>
      </div>
    </footer>
  );
};

export default Footer;
