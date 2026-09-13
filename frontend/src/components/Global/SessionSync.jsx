// src/components/Global/SessionSync.jsx
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useGetProfileQuery } from "../../slices/userApiSlice";
import { setCredentials } from "../../slices/authSlice";

// Revalide la session au chargement de l'application.
//
// Le cookie JWT est httpOnly : impossible de savoir en JavaScript s'il est
// encore valide. Le cache localStorage peut donc afficher « connecté » alors
// que la session est morte depuis longtemps (24 h d'expiration, compte
// désactivé, redémarrage sur une autre base…).
//
// Ce composant appelle GET /api/users/profile une fois au montage :
//   - la session tient  → on rafraîchit l'identité et le rôle en cache ;
//   - elle ne tient plus → l'API répond 401 et apiSlice purge l'état.
// Il n'affiche rien.
const SessionSync = () => {
  const dispatch = useDispatch();
  const { userInfo } = useSelector((state) => state.auth);

  // `skip` : inutile d'interroger l'API pour un visiteur qui n'a jamais été
  // connecté — ce serait une 401 systématique sur la page d'accueil publique.
  const { data } = useGetProfileQuery(undefined, { skip: !userInfo });

  useEffect(() => {
    if (data) dispatch(setCredentials(data));
  }, [data, dispatch]);

  return null;
};

export default SessionSync;
