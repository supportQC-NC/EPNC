// src/components/Utils/PublicOnlyRoute.jsx
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { accueilDuRole } from "./accueilDuRole";

// Écrans réservés aux visiteurs NON connectés (connexion, inscription, mot de
// passe oublié). Quelqu'un déjà connecté qui y arrive par un lien ou par
// l'historique est renvoyé vers son espace plutôt que de voir un formulaire de
// connexion sans objet.
const PublicOnlyRoute = () => {
  const { userInfo } = useSelector((state) => state.auth);
  const location = useLocation();

  // Si la personne venait d'une offre (le mur transmet la page d'origine), on
  // l'y renvoie plutôt que sur l'espace : elle a cliqué pour lire cette fiche.
  const destination =
    location.state?.from?.pathname || accueilDuRole(userInfo);

  return userInfo ? <Navigate to={destination} replace /> : <Outlet />;
};

export default PublicOnlyRoute;
