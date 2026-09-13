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
      invalidatesTags: ["Profil"],
    }),
  }),
});

export const { useGetProfilQuery, useUpdateProfilMutation } = profilApiSlice;
