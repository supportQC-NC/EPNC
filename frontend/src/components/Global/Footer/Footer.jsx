// src/components/Global/Footer/Footer.jsx
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
      </div>
    </footer>
  );
};

export default Footer;
