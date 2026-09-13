// src/slices/demandeRecruteurApiSlice.js
//
// Les demandes d'accès recruteur, côté administration.
//
// Le DÉPÔT n'est pas ici : il est public, et passe par un `fetch` direct dans
// DevenirRecruteurScreen. Le faire transiter par ce slice l'aurait soumis au
// traitement du 401 (purge de la session, redirection vers la connexion), ce
// qui n'a aucun sens pour un formulaire ouvert à des visiteurs sans compte.
import { apiSlice } from "./apiSlice";
import { DEMANDES_RECRUTEUR_URL } from "../constants";

export const demandeRecruteurApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getDemandesRecruteur: builder.query({
      query: (statut) => ({
        url: DEMANDES_RECRUTEUR_URL,
        params: statut ? { statut } : undefined,
      }),
      providesTags: ["DemandesRecruteur"],
    }),

    deciderDemandeRecruteur: builder.mutation({
      query: ({ id, ...corps }) => ({
        url: `${DEMANDES_RECRUTEUR_URL}/${id}`,
        method: "PUT",
        body: corps,
      }),
      // Une acceptation crée ou promeut un compte : la liste des comptes et le
      // tableau de bord ne disent plus la vérité tant qu'ils ne sont pas
      // rechargés.
      invalidatesTags: ["DemandesRecruteur", "UserList", "Dashboard"],
    }),
  }),
});

export const {
  useGetDemandesRecruteurQuery,
  useDeciderDemandeRecruteurMutation,
} = demandeRecruteurApiSlice;
