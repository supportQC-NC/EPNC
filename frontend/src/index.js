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

import LandingScreen from "./screens/LandingScreen/LandingScreen";
import OffresScreen from "./screens/OffresScreen/OffresScreen";
import OffreDetailScreen from "./screens/OffreDetailScreen/OffreDetailScreen";
import MetiersScreen from "./screens/MetiersScreen/MetiersScreen";
import MetierDetailScreen from "./screens/MetiersScreen/MetierDetailScreen";
import LoginScreen from "./screens/LoginScreen/LoginScreen";
import RegisterScreen from "./screens/RegisterScreen/RegisterScreen";
import ForgotPasswordScreen from "./screens/ForgotPasswordScreen/ForgotPasswordScreen";
import ResetPasswordScreen from "./screens/ResetPasswordScreen/ResetPasswordScreen";
import EspaceScreen from "./screens/EspaceScreen/EspaceScreen";
import ProfilScreen from "./screens/ProfilScreen/ProfilScreen";
import CandidaturesScreen from "./screens/CandidaturesScreen/CandidaturesScreen";
import CandidatureDetailScreen from "./screens/CandidatureDetailScreen/CandidatureDetailScreen";
import AssistantScreen from "./screens/AssistantScreen/AssistantScreen";
import MatchsScreen from "./screens/MatchsScreen/MatchsScreen";
import NotFoundScreen from "./screens/NotFoundScreen/NotFoundScreen";

import AdminLayout from "./screens/admin/AdminLayout";
import AdminDashboardScreen from "./screens/admin/AdminDashboardScreen";
import AdminUtilisateursScreen from "./screens/admin/AdminUtilisateursScreen";
import AdminSourcesScreen from "./screens/admin/AdminSourcesScreen";
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
        <Route path="/candidatures" element={<CandidaturesScreen />} />
        <Route path="/candidatures/:id" element={<CandidatureDetailScreen />} />
        <Route path="/matchs" element={<MatchsScreen />} />
        <Route path="/assistant" element={<AssistantScreen />} />
        {/* À venir : /matchs (rapprochement profil ↔ offres) */}
      </Route>

      {/* ── Administration ───────────────────────────────────────────── */}
      {/* Routes imbriquées : AdminLayout porte la sous-navigation, commune à
          tous les écrans de la section. */}
      <Route element={<AdminRoute />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboardScreen />} />
          <Route path="utilisateurs" element={<AdminUtilisateursScreen />} />
          <Route path="sources" element={<AdminSourcesScreen />} />
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
