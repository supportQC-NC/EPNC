// src/slices/apiSlice.js
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { BASE_URL } from "../constants";
import { logout } from "./authSlice";

const baseQuery = fetchBaseQuery({
  baseUrl: BASE_URL,
  // Indispensable : sans cela le navigateur n'envoie pas le cookie JWT
  // httpOnly et toutes les routes privées répondent 401.
  credentials: "include",
});

// Le jeton vit dans un cookie httpOnly : le JavaScript ne peut pas savoir s'il
// a expiré. Le seul signal fiable est une 401 renvoyée par l'API. On la traite
// ICI, une fois pour toutes, plutôt que dans chaque écran : l'état Redux est
// purgé et le routeur renvoie naturellement vers /login.
//
// Exception : la connexion elle-même. Un mot de passe faux répond 401 sans que
// la session soit en cause — purger l'état à ce moment-là effacerait un compte
// déjà connecté qui se serait trompé en ressaisissant ses identifiants.
const baseQueryWithAuth = async (args, api, extraOptions) => {
  const result = await baseQuery(args, api, extraOptions);

  const url = typeof args === "string" ? args : args?.url || "";
  const estConnexion = url.includes("/login") || url.includes("/register");

  if (result?.error?.status === 401 && !estConnexion) {
    api.dispatch(logout());
  }

  return result;
};

export const apiSlice = createApi({
  baseQuery: baseQueryWithAuth,
  tagTypes: [
    "User",
    "UserList",
    "Dashboard",
    "Smtp",
    "Avp",
    // Séparé de "Avp" : la fiche complète dépend de l'état de connexion, pas
    // seulement de l'offre. Les invalider ensemble reviendrait à vider la
    // liste publique à chaque connexion.
    "AvpComplet",
    "Profil",
    "Match",
    "Referentiel",
    "Metier",
    "Candidature",
    "CandidatureListe",
    "Conversation",
    "ConversationListe",
    "EtatAssistant",
    // À compléter au fil des modules : "Match"…
  ],
  endpoints: (builder) => ({}),
});
