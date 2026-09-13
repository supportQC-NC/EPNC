// src/slices/integrationApiSlice.js
//
// Clés d'API et abonnements aux webhooks — la surface machine, côté
// administration.
import { apiSlice } from "./apiSlice";
import { ADMIN_URL } from "../constants";

export const integrationApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getCles: builder.query({
      query: () => ({ url: `${ADMIN_URL}/cles` }),
      providesTags: ["ClesApi"],
    }),

    creerCle: builder.mutation({
      query: (corps) => ({ url: `${ADMIN_URL}/cles`, method: "POST", body: corps }),
      invalidatesTags: ["ClesApi"],
    }),

    revoquerCle: builder.mutation({
      query: ({ id, motif }) => ({
        url: `${ADMIN_URL}/cles/${id}`,
        method: "DELETE",
        body: { motif },
      }),
      invalidatesTags: ["ClesApi"],
    }),

    getWebhooks: builder.query({
      query: () => ({ url: `${ADMIN_URL}/webhooks` }),
      providesTags: ["Webhooks"],
    }),

    creerWebhook: builder.mutation({
      query: (corps) => ({ url: `${ADMIN_URL}/webhooks`, method: "POST", body: corps }),
      invalidatesTags: ["Webhooks"],
    }),

    basculerWebhook: builder.mutation({
      query: ({ id, actif }) => ({
        url: `${ADMIN_URL}/webhooks/${id}`,
        method: "PUT",
        body: { actif },
      }),
      invalidatesTags: ["Webhooks"],
    }),

    supprimerWebhook: builder.mutation({
      query: (id) => ({ url: `${ADMIN_URL}/webhooks/${id}`, method: "DELETE" }),
      invalidatesTags: ["Webhooks"],
    }),

    testerWebhook: builder.mutation({
      query: (id) => ({ url: `${ADMIN_URL}/webhooks/${id}/test`, method: "POST" }),
      // Le test met à jour la santé de l'abonnement (dernier succès, dernière
      // erreur) : sans invalidation, l'écran continuerait d'afficher l'état
      // d'avant le test, c'est-à-dire l'inverse de ce qu'on vient de vérifier.
      invalidatesTags: ["Webhooks"],
    }),
  }),
});

export const {
  useGetClesQuery,
  useCreerCleMutation,
  useRevoquerCleMutation,
  useGetWebhooksQuery,
  useCreerWebhookMutation,
  useBasculerWebhookMutation,
  useSupprimerWebhookMutation,
  useTesterWebhookMutation,
} = integrationApiSlice;
