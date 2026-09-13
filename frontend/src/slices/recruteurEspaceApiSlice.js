// src/slices/recruteurEspaceApiSlice.js
import { apiSlice } from "./apiSlice";
import { RECRUTEUR_URL } from "../constants";

export const recruteurEspaceApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getTableauDeBordRecruteur: builder.query({
      query: () => ({ url: `${RECRUTEUR_URL}/tableau-de-bord` }),
      providesTags: ["TableauRecruteur"],
    }),

    getProfilRecruteur: builder.query({
      query: () => ({ url: `${RECRUTEUR_URL}/profil` }),
      providesTags: ["ProfilRecruteur"],
    }),

    majProfilRecruteur: builder.mutation({
      query: (corps) => ({
        url: `${RECRUTEUR_URL}/profil`,
        method: "PUT",
        body: corps,
      }),
      // Les critères de recherche pilotent le classement : les changer périme
      // les suggestions et le tableau de bord, pas seulement le formulaire.
      invalidatesTags: ["ProfilRecruteur", "Suggestions", "TableauRecruteur"],
    }),

    getListes: builder.query({
      query: () => ({ url: `${RECRUTEUR_URL}/listes` }),
      providesTags: ["Listes"],
    }),

    creerListe: builder.mutation({
      query: (corps) => ({ url: `${RECRUTEUR_URL}/listes`, method: "POST", body: corps }),
      invalidatesTags: ["Listes", "TableauRecruteur"],
    }),

    majListe: builder.mutation({
      query: ({ id, ...corps }) => ({
        url: `${RECRUTEUR_URL}/listes/${id}`,
        method: "PUT",
        body: corps,
      }),
      invalidatesTags: ["Listes", "TableauRecruteur"],
    }),

    supprimerListe: builder.mutation({
      query: (id) => ({ url: `${RECRUTEUR_URL}/listes/${id}`, method: "DELETE" }),
      invalidatesTags: ["Listes", "TableauRecruteur", "Suggestions"],
    }),

    // Enregistrer un candidat change ce que l'outil comprend de la recherche :
    // les suggestions doivent être recalculées, et le profil enregistré ne doit
    // plus apparaître dedans.
    ajouterCandidatListe: builder.mutation({
      query: ({ id, profilId, note }) => ({
        url: `${RECRUTEUR_URL}/listes/${id}/candidats`,
        method: "POST",
        body: { profilId, note },
      }),
      invalidatesTags: ["Listes", "Suggestions", "TableauRecruteur"],
    }),

    retirerCandidatListe: builder.mutation({
      query: ({ id, profilId }) => ({
        url: `${RECRUTEUR_URL}/listes/${id}/candidats/${profilId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Listes", "Suggestions", "TableauRecruteur"],
    }),

    getSuggestions: builder.query({
      query: () => ({ url: `${RECRUTEUR_URL}/suggestions` }),
      providesTags: ["Suggestions"],
    }),
  }),
});

export const {
  useGetTableauDeBordRecruteurQuery,
  useGetProfilRecruteurQuery,
  useMajProfilRecruteurMutation,
  useGetListesQuery,
  useCreerListeMutation,
  useMajListeMutation,
  useSupprimerListeMutation,
  useAjouterCandidatListeMutation,
  useRetirerCandidatListeMutation,
  useGetSuggestionsQuery,
} = recruteurEspaceApiSlice;
