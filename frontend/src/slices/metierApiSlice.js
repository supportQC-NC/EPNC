// src/slices/metierApiSlice.js
import { apiSlice } from "./apiSlice";
import { METIERS_URL } from "../constants";

export const metierApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getReferentiel: builder.query({
      query: () => ({ url: METIERS_URL }),
      // Le référentiel ne bouge qu'à l'ingestion : inutile de le redemander
      // à chaque visite.
      keepUnusedDataFor: 600,
      providesTags: ["Referentiel"],
    }),

    getMetier: builder.query({
      query: (code) => ({ url: `${METIERS_URL}/${code}` }),
      // L'écart dépend du profil : une modification de profil doit le périmer.
      providesTags: (r, e, code) => [{ type: "Metier", id: code }, "Profil"],
    }),

    getCompetencesReferentiel: builder.query({
      query: () => ({ url: `${METIERS_URL}/competences/liste` }),
      keepUnusedDataFor: 600,
    }),
  }),
});

export const {
  useGetReferentielQuery,
  useGetMetierQuery,
  useGetCompetencesReferentielQuery,
} = metierApiSlice;
