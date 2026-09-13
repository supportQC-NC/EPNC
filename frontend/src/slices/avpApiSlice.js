// src/slices/avpApiSlice.js
import { apiSlice } from "./apiSlice";
import { AVPS_URL } from "../constants";

export const avpApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // Liste publique. `ouvertesSeules` est optionnel : on n'ajoute le
    // paramètre que s'il est demandé, pour garder des URLs (et donc des clés
    // de cache) stables.
    getAvps: builder.query({
      query: ({ ouvertesSeules } = {}) => ({
        url: AVPS_URL,
        params: ouvertesSeules ? { ouvertes: "1" } : undefined,
      }),
      providesTags: ["Avp"],
    }),

    // Aperçu public d'une offre.
    getAvpApercu: builder.query({
      query: (slug) => ({ url: `${AVPS_URL}/${slug}` }),
      providesTags: (result, error, slug) => [{ type: "Avp", id: slug }],
    }),

    // Fiche complète — nécessite un compte. Appelée avec `skip` tant que
    // personne n'est connecté, sinon chaque visiteur déclencherait une 401.
    getAvpComplet: builder.query({
      query: (slug) => ({ url: `${AVPS_URL}/${slug}/complet` }),
      providesTags: (result, error, slug) => [{ type: "AvpComplet", id: slug }],
    }),
  }),
});

export const {
  useGetAvpsQuery,
  useGetAvpApercuQuery,
  useGetAvpCompletQuery,
} = avpApiSlice;
