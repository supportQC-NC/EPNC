// src/components/Utils/PrivateRoute.jsx
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";

// Garde côté client : elle évite d'afficher un écran vide à quelqu'un qui n'est
// pas connecté. Elle ne protège RIEN — la seule protection réelle est le
// middleware `protect` du backend. Ne jamais s'y fier pour cacher une donnée.
const PrivateRoute = () => {
  const { userInfo } = useSelector((state) => state.auth);
  const location = useLocation();

  // On mémorise la page demandée pour y revenir après connexion, au lieu de
  // renvoyer systématiquement sur l'accueil.
  return userInfo ? (
    <Outlet />
  ) : (
    <Navigate to="/login" replace state={{ from: location }} />
  );
};

export default PrivateRoute;
