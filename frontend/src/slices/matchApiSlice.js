// src/slices/matchApiSlice.js
import { apiSlice } from "./apiSlice";
import { MATCHS_URL } from "../constants";

export const matchApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getMatchs: builder.query({
      query: ({ toutes } = {}) => ({
        url: MATCHS_URL,
        params: toutes ? { toutes: "1" } : undefined,
      }),
      // Le rapprochement dépend du profil : toute modification le périme.
      providesTags: ["Match", "Profil"],
    }),
  }),
});

export const { useGetMatchsQuery } = matchApiSlice;
