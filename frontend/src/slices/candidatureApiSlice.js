// src/slices/candidatureApiSlice.js
import { apiSlice } from "./apiSlice";
import { CANDIDATURES_URL } from "../constants";

export const candidatureApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getCandidatures: builder.query({
      query: () => ({ url: CANDIDATURES_URL }),
      providesTags: ["CandidatureListe"],
    }),

    getCandidature: builder.query({
      query: (id) => ({ url: `${CANDIDATURES_URL}/${id}` }),
      providesTags: (r, e, id) => [{ type: "Candidature", id }],
    }),

    creerCandidature: builder.mutation({
      query: (avpSlug) => ({
        url: CANDIDATURES_URL,
        method: "POST",
        body: { avpSlug },
      }),
      invalidatesTags: ["CandidatureListe"],
    }),

    genererPiece: builder.mutation({
      query: ({ id, piece }) => ({
        url: `${CANDIDATURES_URL}/${id}/pieces/${piece}`,
        method: "POST",
      }),
      invalidatesTags: (r, e, { id }) => [
        { type: "Candidature", id },
        "CandidatureListe",
      ],
    }),

    modifierPiece: builder.mutation({
      query: ({ id, piece, contenu }) => ({
        url: `${CANDIDATURES_URL}/${id}/pieces/${piece}`,
        method: "PUT",
        body: { contenu },
      }),
      invalidatesTags: (r, e, { id }) => [
        { type: "Candidature", id },
        "CandidatureListe",
      ],
    }),

    changerStatut: builder.mutation({
      query: ({ id, statut, note }) => ({
        url: `${CANDIDATURES_URL}/${id}/statut`,
        method: "PATCH",
        body: { statut, note },
      }),
      invalidatesTags: (r, e, { id }) => [
        { type: "Candidature", id },
        "CandidatureListe",
      ],
    }),

    // Fonction ④ : la candidature part.
    //
    // L'envoi invalide la candidature ET la liste : le statut passe à
    // « envoyée » côté serveur, et un écran de suivi qui afficherait encore
    // « brouillon » ferait renvoyer le dossier une seconde fois.
    envoyerCandidature: builder.mutation({
      query: (id) => ({ url: `${CANDIDATURES_URL}/${id}/envoi`, method: "POST" }),
      invalidatesTags: (r, e, id) => [
        { type: "Candidature", id },
        "CandidatureListe",
      ],
    }),

    supprimerCandidature: builder.mutation({
      query: (id) => ({ url: `${CANDIDATURES_URL}/${id}`, method: "DELETE" }),
      invalidatesTags: ["CandidatureListe"],
    }),
  }),
});

// Les téléchargements ne passent pas par RTK Query : ce sont des fichiers
// binaires, pas des données à mettre en cache dans le store. On construit
// l'URL et on laisse le navigateur faire son travail — le cookie de session
// part avec la navigation, et `setupProxy.js` relaie bien les requêtes de
// navigation vers le backend (c'est précisément la raison d'être de ce
// fichier).
export const urlPiecePdf = (id, piece) =>
  `${CANDIDATURES_URL}/${id}/pieces/${piece}/pdf`;

export const urlDossierZip = (id) => `${CANDIDATURES_URL}/${id}/dossier`;

export const urlJsonResume = (id) => `${CANDIDATURES_URL}/${id}/resume.json`;

export const {
  useGetCandidaturesQuery,
  useGetCandidatureQuery,
  useCreerCandidatureMutation,
  useGenererPieceMutation,
  useModifierPieceMutation,
  useChangerStatutMutation,
  useEnvoyerCandidatureMutation,
  useSupprimerCandidatureMutation,
} = candidatureApiSlice;
