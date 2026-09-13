// src/screens/admin/AdminLayout.jsx
import { NavLink, Outlet } from "react-router-dom";
import "./admin.css";

// Coquille des écrans d'administration : un titre, une sous-navigation, et le
// contenu. La sous-navigation reste visible partout — dans un back-office, on
// passe son temps à faire l'aller-retour entre le tableau de bord et la liste.
const AdminLayout = () => {
  return (
    <div className="conteneur conteneur--large admin">
      <header className="admin-entete">
        <p className="admin-surtitre">Administration</p>
        <nav aria-label="Sections d'administration">
          <ul className="admin-onglets">
            <li>
              {/* `end` : sans lui, /admin resterait marqué actif quand on est
                  sur /admin/utilisateurs, puisque le chemin en est le préfixe. */}
              <NavLink to="/admin" end className="admin-onglet">
                Tableau de bord
              </NavLink>
            </li>
            <li>
              <NavLink to="/admin/utilisateurs" className="admin-onglet">
                Comptes
              </NavLink>
            </li>
            <li>
              <NavLink to="/admin/sources" className="admin-onglet">
                Sources de données
              </NavLink>
            </li>
            <li>
              <NavLink to="/admin/demandes" className="admin-onglet">
                Accès recruteurs
              </NavLink>
            </li>
            <li>
              <NavLink to="/admin/moderation" className="admin-onglet">
                Modération
              </NavLink>
            </li>
            <li>
              <NavLink to="/admin/donnees" className="admin-onglet">
                Données
              </NavLink>
            </li>
            <li>
              <NavLink to="/admin/envoi" className="admin-onglet">
                Candidatures
              </NavLink>
            </li>
            <li>
              <NavLink to="/admin/email" className="admin-onglet">
                Envoi d'emails
              </NavLink>
            </li>
            <li>
              <NavLink to="/admin/integration" className="admin-onglet">
                Intégration
              </NavLink>
            </li>
          </ul>
        </nav>
      </header>

      <Outlet />
    </div>
  );
};

export default AdminLayout;
