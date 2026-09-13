// src/App.js
import { Outlet } from "react-router-dom";
import Header from "./components/Global/Header/Header";
import Footer from "./components/Global/Footer/Footer";
import SessionSync from "./components/Global/SessionSync";
import RemonterEnHaut from "./components/Utils/RemonterEnHaut";
import BulleAssistant from "./components/Global/BulleAssistant/BulleAssistant";
import "./index.css";

// Coquille commune à toutes les pages.
//
// ⚠️ Différence assumée avec QC_tools : là-bas, App affichait directement
// l'écran de connexion dès qu'aucun compte n'était présent — c'est un outil
// interne, il n'a pas de page publique. Ici, l'accueil DOIT être consultable
// sans compte : c'est une plateforme grand public, et le hackathon porte
// précisément sur l'accès à l'information. Le cloisonnement public/privé est
// donc porté par le routeur (PrivateRoute / PublicOnlyRoute), pas par App.
const App = () => {
  return (
    <>
      <SessionSync />
      <RemonterEnHaut />
      <a className="lien-evitement" href="#contenu">
        Aller au contenu principal
      </a>
      <div className="app">
        <Header />
        <main id="contenu" className="main-content" tabIndex={-1}>
          <Outlet />
        </main>
        <Footer />
      </div>

      {/* Hors de `.app` : la bulle est en position fixe et ne doit hériter
          d'aucun contexte d'empilement de la coquille. Elle se masque
          d'elle-même pour un visiteur non connecté et sur /assistant. */}
      <BulleAssistant />
    </>
  );
};

export default App;
