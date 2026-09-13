// src/slices/veilleApiSlice.js
import { apiSlice } from "./apiSlice";
import { VEILLE_URL, CANDIDATURES_URL } from "../constants";

export const veilleApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getAlertes: builder.query({
      query: () => ({ url: `${VEILLE_URL}/alertes` }),
      providesTags: ["Alertes"],
    }),

    marquerLues: builder.mutation({
      query: (ids) => ({
        url: `${VEILLE_URL}/alertes`,
        method: "PATCH",
        body: ids ? { ids } : {},
      }),
      invalidatesTags: ["Alertes"],
    }),

    majPreferencesVeille: builder.mutation({
      query: (corps) => ({
        url: `${VEILLE_URL}/preferences`,
        method: "PUT",
        body: corps,
      }),
      invalidatesTags: ["Alertes"],
    }),

    lancerTourVeille: builder.mutation({
      query: () => ({ url: `${VEILLE_URL}/tour`, method: "POST" }),
      invalidatesTags: ["Alertes"],
    }),

    // Le geste qui transforme une alerte en dossier : les quatre pièces d'un
    // coup. C'est ce qui empêche la veille de s'arrêter à la notification.
    preparerDossier: builder.mutation({
      query: (id) => ({ url: `${CANDIDATURES_URL}/${id}/preparer`, method: "POST" }),
      invalidatesTags: (r, e, id) => [
        { type: "Candidature", id },
        "CandidatureListe",
      ],
    }),
  }),
});

export const {
  useGetAlertesQuery,
  useMarquerLuesMutation,
  useMajPreferencesVeilleMutation,
  useLancerTourVeilleMutation,
  usePreparerDossierMutation,
} = veilleApiSlice;
