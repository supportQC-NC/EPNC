// src/screens/NotFoundScreen/NotFoundScreen.jsx
import { Link } from "react-router-dom";

const NotFoundScreen = () => {
  return (
    <div className="conteneur espace">
      <h1>Page introuvable</h1>
      <p className="espace-intro">
        Cette adresse ne correspond à aucune page. Le lien est peut-être ancien,
        ou l'offre qu'il désignait n'est plus diffusée.
      </p>
      <div className="actions">
        <Link to="/offres" className="btn btn-principal">
          Voir les postes ouverts
        </Link>
        <Link to="/" className="btn btn-secondaire">
          Revenir à l'accueil
        </Link>
      </div>
    </div>
  );
};

export default NotFoundScreen;
