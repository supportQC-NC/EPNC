// src/slices/moderationApiSlice.js
import { apiSlice } from "./apiSlice";
import { MODERATION_URL } from "../constants";

export const moderationApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    signaler: builder.mutation({
      query: (corps) => ({
        url: `${MODERATION_URL}/signalements`,
        method: "POST",
        body: corps,
      }),
      invalidatesTags: ["MesSignalements", "Signalements"],
    }),

    getMesSignalements: builder.query({
      query: () => ({ url: `${MODERATION_URL}/mes-signalements` }),
      providesTags: ["MesSignalements"],
    }),

    getSignalements: builder.query({
      query: (statut) => ({
        url: `${MODERATION_URL}/signalements`,
        params: statut ? { statut } : undefined,
      }),
      providesTags: ["Signalements"],
    }),

    instruireSignalement: builder.mutation({
      query: ({ id, ...corps }) => ({
        url: `${MODERATION_URL}/signalements/${id}`,
        method: "PUT",
        body: corps,
      }),
      // Une mesure peut désactiver un compte ou retirer un profil du vivier :
      // les listes de comptes, le vivier et le tableau de bord changent tous.
      invalidatesTags: [
        "Signalements",
        "UserList",
        "Dashboard",
        "Vivier",
        "Suggestions",
      ],
    }),

    contacterPartie: builder.mutation({
      query: ({ id, ...corps }) => ({
        url: `${MODERATION_URL}/signalements/${id}/contact`,
        method: "POST",
        body: corps,
      }),
      invalidatesTags: ["Signalements"],
    }),

    faireAppel: builder.mutation({
      query: ({ id, message }) => ({
        url: `${MODERATION_URL}/signalements/${id}/appel`,
        method: "POST",
        body: { message },
      }),
      // Le recours rouvre le dossier : la liste d'administration et la vue de
      // l'intéressé changent toutes les deux.
      invalidatesTags: ["Signalements", "MesSignalements"],
    }),

    getEcheances: builder.query({
      query: () => ({ url: `${MODERATION_URL}/echeances` }),
      providesTags: ["Echeances"],
    }),

    appliquerEcheances: builder.mutation({
      query: (simulation) => ({
        url: `${MODERATION_URL}/echeances`,
        method: "POST",
        body: { simulation },
      }),
      invalidatesTags: ["Echeances", "UserList", "Dashboard", "Vivier"],
    }),
  }),
});

export const {
  useSignalerMutation,
  useContacterPartieMutation,
  useFaireAppelMutation,
  useGetEcheancesQuery,
  useAppliquerEcheancesMutation,
  useGetMesSignalementsQuery,
  useGetSignalementsQuery,
  useInstruireSignalementMutation,
} = moderationApiSlice;
