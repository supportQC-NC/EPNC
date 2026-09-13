import { Navigate, Outlet } from "react-router-dom";
import { useSelector } from "react-redux";
import { accueilDuRole } from "./accueilDuRole";

// Réserve une branche du routeur aux recruteurs et aux administrateurs.
//
// C'est une garde d'INTERFACE : elle évite d'afficher un écran qui échouerait
// de toute façon. La vraie protection est côté serveur (recruteurRoutes pose
// `checkRole("recruteur", "admin")`), et c'est elle qui compte — un contrôle
// qui ne vit que dans le navigateur se contourne en changeant une valeur dans
// le store.
const RecruteurRoute = () => {
  const { userInfo } = useSelector((state) => state.auth);

  if (!userInfo) return <Navigate to="/login" replace />;

  return ["recruteur", "admin"].includes(userInfo.role) ? (
    <Outlet />
  ) : (
    <Navigate to={accueilDuRole(userInfo)} replace />
  );
};

export default RecruteurRoute;
