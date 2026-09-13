import mongoose from "mongoose";

// Conversation avec l'assistant.
//
// Les échanges sont conservés : quelqu'un qui prépare une candidature revient
// sur plusieurs jours, et reperdre le fil à chaque visite rend l'assistant
// inutilisable. C'est aussi ce qui permet de reprendre un conseil donné la
// semaine précédente.
const messageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["utilisateur", "assistant"],
      required: true,
    },
    contenu: { type: String, required: true },
    date: { type: Date, default: Date.now },
  },
  { _id: false },
);

const conversationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // Titre dérivé de la première question. Une liste de conversations
    // intitulées « Conversation 1, 2, 3 » n'aide personne à retrouver la
    // bonne.
    titre: { type: String, default: "Nouvelle conversation" },
    messages: { type: [messageSchema], default: [] },
  },
  { timestamps: true },
);

// Tri de la liste : la conversation la plus récemment utilisée d'abord.
conversationSchema.index({ user: 1, updatedAt: -1 });

const Conversation = mongoose.model("Conversation", conversationSchema);

export default Conversation;
