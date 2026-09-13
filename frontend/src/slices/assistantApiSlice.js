// src/slices/assistantApiSlice.js
import { apiSlice } from "./apiSlice";
import { ASSISTANT_URL } from "../constants";

export const assistantApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getEtatAssistant: builder.query({
      query: () => ({ url: `${ASSISTANT_URL}/etat` }),
      providesTags: ["EtatAssistant"],
    }),

    accepterAvertissement: builder.mutation({
      query: () => ({ url: `${ASSISTANT_URL}/avertissement`, method: "POST" }),
      invalidatesTags: ["EtatAssistant"],
    }),

    getConversations: builder.query({
      query: () => ({ url: `${ASSISTANT_URL}/conversations` }),
      providesTags: ["ConversationListe"],
    }),

    getConversation: builder.query({
      query: (id) => ({ url: `${ASSISTANT_URL}/conversations/${id}` }),
      providesTags: (r, e, id) => [{ type: "Conversation", id }],
    }),

    envoyerMessage: builder.mutation({
      query: ({ question, conversationId }) => ({
        url: `${ASSISTANT_URL}/messages`,
        method: "POST",
        body: { question, conversationId },
      }),
      // La réponse contient la conversation complète : la liste est invalidée
      // (le titre et la date de tri changent), mais pas la conversation
      // elle-même, que l'écran reçoit directement.
      invalidatesTags: ["ConversationListe"],
    }),

    supprimerConversation: builder.mutation({
      query: (id) => ({
        url: `${ASSISTANT_URL}/conversations/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["ConversationListe"],
    }),
  }),
});

export const {
  useGetEtatAssistantQuery,
  useAccepterAvertissementMutation,
  useGetConversationsQuery,
  useLazyGetConversationQuery,
  useEnvoyerMessageMutation,
  useSupprimerConversationMutation,
} = assistantApiSlice;
