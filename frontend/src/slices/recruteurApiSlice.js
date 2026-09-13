// src/slices/recruteurApiSlice.js
import { apiSlice } from "./apiSlice";
import { RECRUTEUR_URL } from "../constants";

export const recruteurApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // Les filtres vides ne sont PAS envoyés : sans ce nettoyage, chaque frappe
    // dans un champ vidé produirait une clé de cache différente (`?q=` puis
    // `?q=a` puis `?q=`), et RTK Query garderait autant d'entrées inutiles.
    getCandidats: builder.query({
      query: (filtres = {}) => {
        const params = Object.fromEntries(
          Object.entries(filtres).filter(([, v]) => v),
        );
        return {
          url: `${RECRUTEUR_URL}/candidats`,
          params: Object.keys(params).length ? params : undefined,
        };
      },
      providesTags: ["Vivier"],
    }),

    getCandidat: builder.query({
      query: (id) => ({ url: `${RECRUTEUR_URL}/candidats/${id}` }),
      providesTags: (r, e, id) => [{ type: "Candidat", id }],
    }),

    // Le rapprochement dans l'autre sens : d'une offre vers le vivier.
    getCandidatsPourOffre: builder.query({
      query: (slug) => ({ url: `${RECRUTEUR_URL}/offres/${slug}/candidats` }),
      providesTags: (r, e, slug) => [{ type: "Vivier", id: slug }],
    }),
  }),
});

// Téléchargements : ce sont des fichiers, pas des données à mettre en cache
// dans le store. On construit l'URL et on laisse le navigateur faire — le
// cookie de session part avec la navigation.
export const urlCvCandidat = (id) => `${RECRUTEUR_URL}/candidats/${id}/cv`;
export const urlResumeCandidat = (id) =>
  `${RECRUTEUR_URL}/candidats/${id}/resume.json`;

export const {
  useGetCandidatsQuery,
  useGetCandidatQuery,
  useGetCandidatsPourOffreQuery,
} = recruteurApiSlice;
