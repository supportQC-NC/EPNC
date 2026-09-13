// src/slices/profilApiSlice.js
import { apiSlice } from "./apiSlice";
import { PROFIL_URL } from "../constants";

export const profilApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getProfil: builder.query({
      query: () => ({ url: PROFIL_URL }),
      providesTags: ["Profil"],
    }),

    updateProfil: builder.mutation({
      query: (sections) => ({ url: PROFIL_URL, method: "PUT", body: sections }),
      // "User" aussi : la photo du profil est jointe à l'identité renvoyée par
      // /api/users/profile, que SessionSync relit pour alimenter l'avatar de
      // l'en-tête. Sans cette invalidation, on change sa photo et le bandeau
      // garde l'ancienne jusqu'au prochain rechargement complet.
      invalidatesTags: ["Profil", "User"],
    }),

    // L'aperçu N'ÉCRIT RIEN : aucune invalidation de cache, sinon l'écran se
    // rechargerait comme si le profil avait changé alors qu'on n'a fait que
    // regarder.
    apercuImport: builder.mutation({
      query: (resume) => ({
        url: `${PROFIL_URL}/import/apercu`,
        method: "POST",
        body: { resume },
      }),
    }),

    importerProfil: builder.mutation({
      query: (resume) => ({
        url: `${PROFIL_URL}/import`,
        method: "POST",
        body: { resume },
      }),
      // Un import change tout le parcours : les rapprochements calculés et les
      // alertes de veille ne valent plus rien tant qu'ils n'ont pas été
      // recalculés sur le nouveau profil.
      invalidatesTags: ["Profil", "User", "Match", "Alertes"],
    }),
  }),
});

export const {
  useGetProfilQuery,
  useUpdateProfilMutation,
  useApercuImportMutation,
  useImporterProfilMutation,
} = profilApiSlice;
