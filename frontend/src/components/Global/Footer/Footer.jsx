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
          Offres issues des avis de vacance de poste publics de l'OPT-NC, au
          format{" "}
          <a
            href="https://schema.org/JobPosting"
            target="_blank"
            rel="noreferrer noopener"
          >
            schema.org/JobPosting
          </a>
          . Service indépendant, sans lien officiel avec l'employeur. Les
          profils utilisés en démonstration sont fictifs.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
