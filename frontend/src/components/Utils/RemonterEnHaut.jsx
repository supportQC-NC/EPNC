// src/components/Utils/RemonterEnHaut.jsx
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// Remet le défilement en haut à chaque changement de page.
//
// React Router ne le fait pas : il remplace le contenu sans toucher à la
// position de défilement. Conséquence observée — on parcourt la liste des
// offres, on clique sur la septième, et on atterrit au milieu des missions
// de la fiche, sans titre ni contexte. Le navigateur, lui, remonte en haut
// sur une navigation classique : c'est le comportement attendu.
//
// Les ancres (#parcours) sont préservées : elles ont une cible explicite, et
// les ramener en haut annulerait le clic.
const RemonterEnHaut = () => {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) return;

    // `instant` : un défilement animé depuis le bas d'une longue page donne
    // l'impression d'un écran qui part tout seul.
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname, hash]);

  return null;
};

export default RemonterEnHaut;
