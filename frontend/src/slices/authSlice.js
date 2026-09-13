// src/slices/authSlice.js
import { createSlice } from "@reduxjs/toolkit";

const CLE = "userInfo";

// Le compte est mis en cache dans localStorage pour que l'interface s'affiche
// tout de suite au rechargement, sans attendre un aller-retour serveur.
//
// ⚠️ Ce cache n'est PAS une preuve d'authentification : la vraie session est le
// cookie httpOnly, que le JavaScript ne peut pas lire. Le cache peut donc
// survivre à une session expirée. Deux garde-fous :
//   1. SessionSync revalide le profil auprès de l'API au montage ;
//   2. apiSlice purge l'état dès qu'une réponse 401 arrive.
// Rien de sensible ici : uniquement identité et rôle, jamais de jeton.
const lireCache = () => {
  try {
    const brut = localStorage.getItem(CLE);
    return brut ? JSON.parse(brut) : null;
  } catch {
    // Navigation privée, stockage bloqué ou JSON corrompu : on démarre
    // déconnecté plutôt que de planter au chargement de l'application.
    return null;
  }
};

const ecrireCache = (valeur) => {
  try {
    if (valeur === null) localStorage.removeItem(CLE);
    else localStorage.setItem(CLE, JSON.stringify(valeur));
  } catch {
    // Stockage indisponible : l'application reste utilisable le temps de la
    // session, elle ne se souviendra simplement pas au rechargement.
  }
};

const initialState = {
  userInfo: lireCache(),
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials: (state, action) => {
      state.userInfo = action.payload;
      ecrireCache(action.payload);
    },
    logout: (state) => {
      state.userInfo = null;
      ecrireCache(null);
    },
  },
});

export const { setCredentials, logout } = authSlice.actions;

export default authSlice.reducer;
