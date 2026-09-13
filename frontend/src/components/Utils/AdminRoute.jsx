// src/components/Utils/AdminRoute.jsx
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { accueilDuRole } from "./accueilDuRole";

// Garde d'affichage pour les écrans d'administration.
//
// ⚠️ Elle ne protège RIEN. Le rôle vient du cache local, qu'un utilisateur peut
// modifier dans son navigateur : forcer `role: "admin"` dans localStorage suffit
// à faire apparaître ces écrans. La seule protection réelle est le middleware
// `admin` du backend, qui refuse chaque requête — les écrans s'afficheraient
// alors vides d'erreurs en erreurs. Cette garde évite simplement de proposer
// une porte qui ne s'ouvre pas.
const AdminRoute = () => {
  const { userInfo } = useSelector((state) => state.auth);
  const location = useLocation();

  if (!userInfo) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Quelqu'un de connecté mais sans le rôle est renvoyé vers son espace, pas
  // vers la connexion : il est déjà identifié, lui redemander ses identifiants
  // ne réglerait rien et donnerait à croire à une session expirée.
  if (userInfo.role !== "admin") {
    return <Navigate to={accueilDuRole(userInfo)} replace />;
  }

  return <Outlet />;
};

export default AdminRoute;
