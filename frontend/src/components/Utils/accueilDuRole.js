// src/components/Utils/accueilDuRole.js
//
// Où atterrit quelqu'un quand aucune destination précise n'est demandée.
//
// ══════════════════════════════════════════════════════════════════════════
//  POURQUOI CE FICHIER EXISTE
// ══════════════════════════════════════════════════════════════════════════
// `/espace` était écrit en dur à cinq endroits — connexion, `PublicOnlyRoute`,
// `AdminRoute`, `RecruteurRoute`, et la redirection de la racine. Un recruteur
// qui se connectait tombait donc sur l'ESPACE CANDIDAT : un écran qui lui
// proposait de compléter son parcours, de voir « les postes qui correspondent
// à votre parcours » et de se rendre visible auprès des recruteurs — c'est-à-
// dire auprès de lui-même.
//
// Le défaut existait avant, masqué par trois cartes de chiffres assez neutres
// pour passer inaperçues. Il est devenu visible le jour où l'espace s'est mis
// à s'adresser à la personne. C'est le même principe que
// `Header.NAVIGATION` (§ 23 du CLAUDE.md) : la destination dépend du RÔLE, et
// la règle vit à un seul endroit pour qu'on ne la corrige pas à trois.
//
// ⚠️ Un ADMINISTRATEUR garde `/espace`, délibérément : il doit pouvoir
// vérifier ce que voient les deux autres rôles, et le menu du compte lui donne
// d'ailleurs les entrées candidat ET recruteur. Le seul rôle qui n'a rien à
// faire sur l'espace candidat est le recruteur pur.
export const accueilDuRole = (userInfo) =>
  userInfo?.role === "recruteur" ? "/recruteur" : "/espace";

export default accueilDuRole;
