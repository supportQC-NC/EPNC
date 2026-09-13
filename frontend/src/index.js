// src/index.js
import React from "react";
import ReactDOM from "react-dom/client";
import {
  createBrowserRouter,
  createRoutesFromElements,
  Route,
  RouterProvider,
} from "react-router-dom";
import { Provider } from "react-redux";

import store from "./store";
import App from "./App";
import "./index.css";

import PrivateRoute from "./components/Utils/PrivateRoute";
import PublicOnlyRoute from "./components/Utils/PublicOnlyRoute";
import AdminRoute from "./components/Utils/AdminRoute";
import RecruteurRoute from "./components/Utils/RecruteurRoute";

import LandingScreen from "./screens/LandingScreen/LandingScreen";
import OffresScreen from "./screens/OffresScreen/OffresScreen";
import OffreDetailScreen from "./screens/OffreDetailScreen/OffreDetailScreen";
import MetiersScreen from "./screens/MetiersScreen/MetiersScreen";
import MetierDetailScreen from "./screens/MetiersScreen/MetierDetailScreen";
import LoginScreen from "./screens/LoginScreen/LoginScreen";
import RegisterScreen from "./screens/RegisterScreen/RegisterScreen";
import ForgotPasswordScreen from "./screens/ForgotPasswordScreen/ForgotPasswordScreen";
import DevenirRecruteurScreen from "./screens/DevenirRecruteurScreen/DevenirRecruteurScreen";
import ResetPasswordScreen from "./screens/ResetPasswordScreen/ResetPasswordScreen";
import EspaceScreen from "./screens/EspaceScreen/EspaceScreen";
import ProfilScreen from "./screens/ProfilScreen/ProfilScreen";
import EntretienScreen from "./screens/EntretienScreen/EntretienScreen";
import CandidaturesScreen from "./screens/CandidaturesScreen/CandidaturesScreen";
import CandidatureDetailScreen from "./screens/CandidatureDetailScreen/CandidatureDetailScreen";
import AssistantScreen from "./screens/AssistantScreen/AssistantScreen";
import MesSignalementsScreen from "./screens/MesSignalementsScreen/MesSignalementsScreen";
import AlertesScreen from "./screens/AlertesScreen/AlertesScreen";
import MatchsScreen from "./screens/MatchsScreen/MatchsScreen";
import VivierScreen from "./screens/VivierScreen/VivierScreen";
import CandidatDetailScreen from "./screens/VivierScreen/CandidatDetailScreen";
import CandidatsOffreScreen from "./screens/VivierScreen/CandidatsOffreScreen";
import EspaceRecruteurScreen from "./screens/RecruteurScreen/EspaceRecruteurScreen";
import SuggestionsScreen from "./screens/RecruteurScreen/SuggestionsScreen";
import ListesScreen from "./screens/RecruteurScreen/ListesScreen";
import ProfilRecruteurScreen from "./screens/RecruteurScreen/ProfilRecruteurScreen";
import NotFoundScreen from "./screens/NotFoundScreen/NotFoundScreen";

import AdminLayout from "./screens/admin/AdminLayout";
import AdminDashboardScreen from "./screens/admin/AdminDashboardScreen";
import AdminUtilisateursScreen from "./screens/admin/AdminUtilisateursScreen";
import AdminSourcesScreen from "./screens/admin/AdminSourcesScreen";
import AdminDonneesScreen from "./screens/admin/AdminDonneesScreen";
import AdminEnvoiScreen from "./screens/admin/AdminEnvoiScreen";
import AdminModerationScreen from "./screens/admin/AdminModerationScreen";
import AdminDemandesScreen from "./screens/admin/AdminDemandesScreen";
import AdminIntegrationScreen from "./screens/admin/AdminIntegrationScreen";
import AdminSmtpScreen from "./screens/admin/AdminSmtpScreen";
import AdminUtilisateurFormScreen from "./screens/admin/AdminUtilisateurFormScreen";

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route path="/" element={<App />}>
      {/* ── Public ───────────────────────────────────────────────────── */}
      <Route index element={<LandingScreen />} />

      {/* Vitrine publique : la liste des offres et l'aperçu d'une offre sont
          consultables sans compte. Seule la fiche complète est réservée. */}
      <Route path="/offres" element={<OffresScreen />} />

      {/* Référentiel des métiers : donnée publique, consultable sans compte.
          La fiche s'enrichit d'une analyse d'écart pour qui est connecté. */}
      <Route path="/metiers" element={<MetiersScreen />} />
      <Route path="/metiers/:code" element={<MetierDetailScreen />} />
      <Route path="/offres/:slug" element={<OffreDetailScreen />} />

      {/* Demande d'accès recruteur. HORS de PublicOnlyRoute : un candidat déjà
          connecté peut très bien demander un accès recruteur, et le renvoyer
          vers son espace sans explication serait incompréhensible. */}
      <Route path="/devenir-recruteur" element={<DevenirRecruteurScreen />} />

      {/* Réinitialisation : volontairement HORS de PublicOnlyRoute.
          Le lien arrive par email et doit fonctionner même si un compte est
          encore en cache dans ce navigateur — c'est justement le cas de
          quelqu'un qui ne se souvient plus de son mot de passe. */}
      <Route path="/reset-password/:token" element={<ResetPasswordScreen />} />

      {/* ── Visiteurs non connectés uniquement ───────────────────────── */}
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/inscription" element={<RegisterScreen />} />
        <Route path="/mot-de-passe-oublie" element={<ForgotPasswordScreen />} />
      </Route>

      {/* ── Privé ────────────────────────────────────────────────────── */}
      <Route element={<PrivateRoute />}>
        <Route path="/espace" element={<EspaceScreen />} />
        <Route path="/profil" element={<ProfilScreen />} />
        <Route path="/entretien" element={<EntretienScreen />} />
        <Route path="/candidatures" element={<CandidaturesScreen />} />
        <Route path="/candidatures/:id" element={<CandidatureDetailScreen />} />
        <Route path="/matchs" element={<MatchsScreen />} />
        <Route path="/assistant" element={<AssistantScreen />} />
        <Route path="/alertes" element={<AlertesScreen />} />
        <Route path="/mes-signalements" element={<MesSignalementsScreen />} />
        {/* À venir : /matchs (rapprochement profil ↔ offres) */}
      </Route>

      {/* ── Espace recruteur ─────────────────────────────────────────── */}
      {/* Le vivier : le rapprochement dans l'autre sens, du poste vers les
          profils. Réservé aux recruteurs et aux administrateurs. */}
      <Route element={<RecruteurRoute />}>
        <Route path="/recruteur" element={<EspaceRecruteurScreen />} />
        <Route path="/recruteur/suggestions" element={<SuggestionsScreen />} />
        <Route path="/recruteur/listes" element={<ListesScreen />} />
        <Route path="/recruteur/profil" element={<ProfilRecruteurScreen />} />
        <Route path="/vivier" element={<VivierScreen />} />
        {/* Chemin fixe AVANT le chemin paramétré : sans cela, « offres »
            serait pris pour un identifiant de profil. */}
        <Route
          path="/vivier/offres/:slug"
          element={<CandidatsOffreScreen />}
        />
        <Route path="/vivier/:id" element={<CandidatDetailScreen />} />
      </Route>

      {/* ── Administration ───────────────────────────────────────────── */}
      {/* Routes imbriquées : AdminLayout porte la sous-navigation, commune à
          tous les écrans de la section. */}
      <Route element={<AdminRoute />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboardScreen />} />
          <Route path="utilisateurs" element={<AdminUtilisateursScreen />} />
          <Route path="sources" element={<AdminSourcesScreen />} />
          <Route path="donnees" element={<AdminDonneesScreen />} />
          <Route path="envoi" element={<AdminEnvoiScreen />} />
          <Route path="moderation" element={<AdminModerationScreen />} />
          <Route path="demandes" element={<AdminDemandesScreen />} />
          <Route path="integration" element={<AdminIntegrationScreen />} />
          <Route path="email" element={<AdminSmtpScreen />} />
          {/* "nouveau" AVANT ":id", sinon il serait pris pour un identifiant. */}
          <Route
            path="utilisateurs/nouveau"
            element={<AdminUtilisateurFormScreen />}
          />
          <Route
            path="utilisateurs/:id"
            element={<AdminUtilisateurFormScreen />}
          />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundScreen />} />
    </Route>,
  ),
);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>
  </React.StrictMode>,
);
