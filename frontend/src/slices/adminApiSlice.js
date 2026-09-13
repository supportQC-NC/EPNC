// src/slices/adminApiSlice.js
import { apiSlice } from "./apiSlice";
import { ADMIN_URL, USERS_URL } from "../constants";

export const adminApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getDashboard: builder.query({
      query: () => ({ url: `${ADMIN_URL}/dashboard` }),
      // Le tableau de bord compte les comptes : toute écriture sur un compte
      // le périme. Sans ce lien, les chiffres resteraient faux après une
      // création ou une suppression jusqu'au prochain rechargement.
      providesTags: ["Dashboard"],
    }),

    getSources: builder.query({
      query: () => ({ url: `${ADMIN_URL}/sources` }),
      // Pas de `providesTags` : cet écran interroge les serveurs distants en
      // direct. Un résultat conservé en cache dirait « tout va bien » pendant
      // une panne — c'est exactement ce qu'il ne doit pas faire.
      keepUnusedDataFor: 0,
    }),

    getSmtp: builder.query({
      query: () => ({ url: `${ADMIN_URL}/smtp` }),
      providesTags: ["Smtp"],
    }),

    testerSmtp: builder.mutation({
      query: () => ({ url: `${ADMIN_URL}/smtp/test`, method: "POST" }),
    }),

    envoyerSmtpTest: builder.mutation({
      query: (destinataire) => ({
        url: `${ADMIN_URL}/smtp/envoi`,
        method: "POST",
        body: { destinataire },
      }),
    }),

    getUsers: builder.query({
      query: (params) => ({ url: USERS_URL, params }),
      providesTags: ["UserList"],
    }),

    getUser: builder.query({
      query: (id) => ({ url: `${USERS_URL}/${id}` }),
      providesTags: (result, error, id) => [{ type: "User", id }],
    }),

    createUser: builder.mutation({
      query: (data) => ({ url: USERS_URL, method: "POST", body: data }),
      invalidatesTags: ["UserList", "Dashboard"],
    }),

    updateUser: builder.mutation({
      query: ({ id, ...data }) => ({
        url: `${USERS_URL}/${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "User", id },
        "UserList",
        "Dashboard",
      ],
    }),

    deleteUser: builder.mutation({
      query: (id) => ({ url: `${USERS_URL}/${id}`, method: "DELETE" }),
      invalidatesTags: ["UserList", "Dashboard"],
    }),

    toggleUserActive: builder.mutation({
      query: (id) => ({
        url: `${USERS_URL}/${id}/toggle-active`,
        method: "PATCH",
      }),
      invalidatesTags: (result, error, id) => [
        { type: "User", id },
        "UserList",
        "Dashboard",
      ],
    }),
  }),
});

export const {
  useGetDashboardQuery,
  useGetSourcesQuery,
  useGetSmtpQuery,
  useTesterSmtpMutation,
  useEnvoyerSmtpTestMutation,
  useGetUsersQuery,
  useGetUserQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
  useToggleUserActiveMutation,
} = adminApiSlice;
