// src/screens/AssistantScreen/AssistantScreen.jsx
import { useEffect, useRef, useState } from "react";
import {
  useGetEtatAssistantQuery,
  useAccepterAvertissementMutation,
  useGetConversationsQuery,
  useLazyGetConversationQuery,
  useEnvoyerMessageMutation,
  useSupprimerConversationMutation,
} from "../../slices/assistantApiSlice";
import AvertissementIA from "../../components/Global/AvertissementIA";
import { SUGGESTIONS } from "../../constants";
import { formaterDateCourte } from "../../utils/format";
import { messageErreur } from "../../utils/erreurApi";
import "./AssistantScreen.css";

const AssistantScreen = () => {
  const [conversation, setConversation] = useState(null);
  const [question, setQuestion] = useState("");
  const [erreur, setErreur] = useState("");

  const { data: etat } = useGetEtatAssistantQuery();
  const [accepterAvertissement, { isLoading: acceptation }] =
    useAccepterAvertissementMutation();
  const { data: conversations } = useGetConversationsQuery();
  const [chargerConversation] = useLazyGetConversationQuery();
  const [envoyer, { isLoading: envoi }] = useEnvoyerMessageMutation();
  const [supprimer] = useSupprimerConversationMutation();

  const filRef = useRef(null);

  // Défilement vers le dernier message à chaque nouvel échange. Sans cela, la
  // réponse arrive sous le pli et rien ne semble s'être passé.
  useEffect(() => {
    filRef.current?.scrollTo({
      top: filRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [conversation?.messages?.length]);

  const poser = async (texte) => {
    const propre = texte.trim();
    if (!propre || envoi) return;

    setErreur("");
    setQuestion("");

    try {
      const maj = await envoyer({
        question: propre,
        conversationId: conversation?._id,
      }).unwrap();
      setConversation(maj);
    } catch (err) {
      setErreur(messageErreur(err, "L'assistant n'a pas pu répondre."));
      // On rend la question à l'utilisateur : la perdre après un échec
      // réseau obligerait à la retaper.
      setQuestion(propre);
    }
  };

  const ouvrir = async (id) => {
    setErreur("");
    try {
      const c = await chargerConversation(id).unwrap();
      setConversation(c);
    } catch (err) {
      setErreur(messageErreur(err, "Conversation illisible."));
    }
  };

  const supprimerEtFermer = async (id) => {
    await supprimer(id).unwrap().catch(() => {});
    if (conversation?._id === id) setConversation(null);
  };

  const indisponible = etat && !etat.disponible;

  // Tant que l'avertissement n'est pas validé, la saisie est neutralisée —
  // et le serveur refuse de répondre de toute façon.
  const enAttenteValidation = Boolean(etat && !etat.avertissementAccepte);
  const bloque = indisponible || enAttenteValidation;

  return (
    <div className="conteneur assistant">
      {enAttenteValidation && (
        <AvertissementIA
          modele={etat.modele}
          enCours={acceptation}
          onAccepter={() => accepterAvertissement()}
        />
      )}

      <header className="assistant-entete">
        <h1>Assistant EPNC</h1>
        <p className="assistant-intro">
          Il connaît votre profil, les postes actuellement ouverts et vos
          dossiers en cours. Posez-lui vos questions sur votre candidature, les
          concours, ou ce qu'il vous manque pour viser un poste.
        </p>
      </header>

      {indisponible && (
        <div className="message message-erreur" role="alert">
          L'assistant est momentanément indisponible. Le reste du site
          fonctionne normalement.
        </div>
      )}

      <div className="assistant-colonnes">
        {/* ── Conversations ─────────────────────────────────────────── */}
        <aside className="assistant-historique">
          <div className="historique-entete">
            <h2>Vos échanges</h2>
            <button
              type="button"
              className="btn btn-secondaire btn-compact"
              onClick={() => {
                setConversation(null);
                setErreur("");
              }}
            >
              Nouvel échange
            </button>
          </div>

          {!conversations?.length ? (
            <p className="historique-vide">Aucun échange pour l'instant.</p>
          ) : (
            <ul className="historique-liste">
              {conversations.map((c) => (
                <li key={c._id}>
                  <button
                    type="button"
                    className={`historique-item${conversation?._id === c._id ? " historique-item--actif" : ""}`}
                    onClick={() => ouvrir(c._id)}
                  >
                    <span className="historique-titre">{c.titre}</span>
                    <span className="historique-date">
                      {formaterDateCourte(c.updatedAt)}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="btn-lien-danger historique-supprimer"
                    onClick={() => supprimerEtFermer(c._id)}
                  >
                    Supprimer
                    <span className="sr-only"> l'échange « {c.titre} »</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* ── Le fil ────────────────────────────────────────────────── */}
        <div className="assistant-fil-zone">
          <div className="assistant-fil" ref={filRef}>
            {!conversation?.messages?.length ? (
              <div className="assistant-accueil">
                <p>
                  Que puis-je faire pour vous ? Voici ce sur quoi je peux
                  répondre :
                </p>
                <ul className="suggestions">
                  {SUGGESTIONS.map((s) => (
                    <li key={s}>
                      <button
                        type="button"
                        className="suggestion"
                        onClick={() => poser(s)}
                        disabled={envoi || bloque}
                      >
                        {s}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <ul className="fil-messages">
                {conversation.messages.map((m, i) => (
                  <li
                    key={i}
                    className={`bulle bulle--${m.role}`}
                    /* Les réponses arrivent après coup : on les annonce. */
                    aria-live={m.role === "assistant" ? "polite" : undefined}
                  >
                    <span className="bulle-auteur">
                      {m.role === "utilisateur" ? "Vous" : "Assistant EPNC"}
                    </span>
                    <div className="bulle-texte">{m.contenu}</div>
                  </li>
                ))}
              </ul>
            )}

            {envoi && (
              <p className="assistant-attente" role="status">
                L'assistant rédige sa réponse…
              </p>
            )}
          </div>

          {erreur && (
            <div className="message message-erreur" role="alert">
              {erreur}
            </div>
          )}

          <form
            className="assistant-saisie"
            onSubmit={(e) => {
              e.preventDefault();
              poser(question);
            }}
          >
            <div className="champ">
              <label htmlFor="question" className="sr-only">
                Votre question
              </label>
              <textarea
                id="question"
                rows={3}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Posez votre question…"
                disabled={bloque}
                onKeyDown={(e) => {
                  // Entrée envoie, Maj+Entrée passe à la ligne — la convention
                  // attendue dans une zone de discussion.
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    poser(question);
                  }
                }}
              />
            </div>
            <button
              type="submit"
              className="btn btn-principal"
              disabled={envoi || bloque || !question.trim()}
            >
              {envoi ? "Envoi…" : "Envoyer"}
            </button>
          </form>

          {/* Mention permanente, sous la zone de saisie : elle reste visible
              quel que soit le défilement du fil. */}
          <p className="assistant-mention">
            <span className="mention-ia-pastille">IA</span>
            Les réponses sont produites automatiquement
            {etat?.modele ? ` (${etat.modele})` : ""} et{" "}
            <strong>peuvent être fausses</strong>. C'est une aide à la
            réflexion, pas un conseil officiel : vérifiez toute information
            déterminante auprès de l'employeur ou de la DRHFPNC.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AssistantScreen;
