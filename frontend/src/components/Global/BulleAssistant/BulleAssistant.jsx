// src/components/Global/BulleAssistant/BulleAssistant.jsx
//
// L'assistant, en bulle permanente.
//
// ══════════════════════════════════════════════════════════════════════════
//  POURQUOI UNE BULLE PLUTÔT QU'UNE ENTRÉE DE MENU
// ══════════════════════════════════════════════════════════════════════════
// Rangé dans la navigation, l'assistant ne sert qu'à ceux qui pensent à
// l'ouvrir — c'est-à-dire à ceux qui n'en ont pas besoin. Or le moment où une
// question se pose n'est pas « quand on décide d'aller voir l'assistant » :
// c'est devant une fiche de poste qu'on ne comprend pas, devant un score qu'on
// trouve injuste, devant un formulaire de profil qu'on ne sait pas remplir.
//
// La bulle suit la personne d'un écran à l'autre et garde la conversation
// ouverte. Poser une question ne coûte plus une navigation, donc plus une
// décision.
//
// ══════════════════════════════════════════════════════════════════════════
//  CE QU'ELLE NE FAIT PAS
// ══════════════════════════════════════════════════════════════════════════
// Elle ne s'ouvre JAMAIS toute seule. Un panneau qui surgit au bout de dix
// secondes est la raison pour laquelle ces dispositifs se ferment sans être
// lus. Elle ne remplace pas non plus `/assistant` : l'historique complet, la
// gestion des conversations et l'avertissement d'usage y restent — la bulle
// est un raccourci vers la conversation en cours, pas un second outil.
//
// 🔴 Elle n'apparaît pas pour un visiteur non connecté : l'assistant ne vaut
// que parce qu'il connaît le profil, les offres ouvertes et l'état des
// candidatures de la personne. Sans compte, il serait un agent conversationnel
// générique de plus, et c'est précisément ce qu'on ne veut pas être.
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  useGetEtatAssistantQuery,
  useEnvoyerMessageMutation,
} from "../../../slices/assistantApiSlice";
import { messageErreur } from "../../../utils/erreurApi";
import "./BulleAssistant.css";

// Suggestions d'amorce. Elles ne sont pas décoratives : devant un champ vide,
// la plupart des gens ne savent pas ce qu'on a le droit de demander à un
// assistant, et referment. Trois exemples concrets lèvent la question.
const AMORCES = [
  "Quels postes correspondent à mon profil ?",
  "Que veut dire « attaché » dans une offre ?",
  "Comment améliorer mon profil ?",
];

const BulleAssistant = () => {
  const { userInfo } = useSelector((state) => state.auth);
  const { pathname } = useLocation();

  const [ouvert, setOuvert] = useState(false);
  const [question, setQuestion] = useState("");
  const [conversation, setConversation] = useState(null);
  const [erreur, setErreur] = useState("");

  const filRef = useRef(null);
  const champRef = useRef(null);
  const declencheurRef = useRef(null);

  // `skip` tant que personne n'est connecté : sans cela, chaque visiteur
  // anonyme déclencherait un appel voué au 401 sur toutes les pages publiques.
  const { data: etat } = useGetEtatAssistantQuery(undefined, {
    skip: !userInfo,
  });
  const [envoyer, { isLoading: envoi }] = useEnvoyerMessageMutation();

  // Défilement vers le dernier message. Sans cela, la réponse arrive sous la
  // ligne de flottaison du panneau et donne l'impression que rien n'a changé.
  useEffect(() => {
    if (filRef.current) filRef.current.scrollTop = filRef.current.scrollHeight;
  }, [conversation?.messages?.length, ouvert]);

  // Le focus entre dans le panneau à l'ouverture, et REVIENT sur le bouton à
  // la fermeture. Sans ce retour, un utilisateur au clavier se retrouve
  // projeté en haut du document après avoir fermé.
  useEffect(() => {
    if (ouvert) champRef.current?.focus();
    else declencheurRef.current?.focus({ preventScroll: true });
  }, [ouvert]);

  // Échap ferme, comme tout élément surgissant. L'écouteur est posé sur le
  // document : la touche doit fonctionner même si le focus a glissé hors du
  // panneau.
  useEffect(() => {
    if (!ouvert) return;
    const surTouche = (e) => {
      if (e.key === "Escape") setOuvert(false);
    };
    document.addEventListener("keydown", surTouche);
    return () => document.removeEventListener("keydown", surTouche);
  }, [ouvert]);

  // Pas de bulle pour un visiteur anonyme, ni sur l'écran complet de
  // l'assistant — s'y superposer à lui-même n'aurait aucun sens.
  if (!userInfo || pathname.startsWith("/assistant")) return null;

  // L'assistant est hors service (pas de clé de modèle configurée) : on
  // n'affiche rien plutôt qu'un bouton qui s'excusera une fois ouvert.
  if (etat && !etat.disponible) return null;

  // Tant que l'avertissement d'usage n'a pas été accepté, la bulle renvoie
  // vers l'écran complet. On ne fait pas accepter un avertissement dans un
  // panneau de 360 px : il doit être lu.
  const aValider = Boolean(etat && !etat.avertissementAccepte);

  const poser = async (texte) => {
    const propre = (texte || "").trim();
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
      // La question est rendue au champ : la retaper après une panne réseau
      // est le genre de détail qui fait abandonner.
      setQuestion(propre);
    }
  };

  const messages = conversation?.messages || [];

  return (
    <div className={`agent${ouvert ? " agent--ouvert" : ""}`}>
      {ouvert && (
        <section
          className="agent-panneau"
          role="dialog"
          aria-label="Assistant Emploi Public NC"
        >
          {/* `div` et non `header` : dans un élément portant `role="dialog"`,
              un `<header>` n'est plus « scopé » par son sectionnement et
              devient un landmark `banner` — soit une SECONDE bannière dans le
              document, à côté de l'en-tête du site. Relevé par axe
              (`landmark-no-duplicate-banner`). Le titre du panneau est déjà
              porté par `aria-label` sur le dialogue. */}
          <div className="agent-entete">
            <div>
              <p className="agent-titre">Assistant</p>
              <p className="agent-sous-titre">
                Il connaît votre profil et les postes ouverts
              </p>
            </div>
            <button
              type="button"
              className="agent-fermer"
              onClick={() => setOuvert(false)}
              aria-label="Fermer l'assistant"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>

          {/* `tabIndex={0}` : cette zone défile, elle doit donc pouvoir
              recevoir le focus, sinon la conversation est inatteignable au
              clavier dès qu'elle dépasse la hauteur du panneau — on peut
              écrire, mais pas relire. Relevé par axe
              (`scrollable-region-focusable`, impact « serious »).
              `role="log"` : le fil s'enrichit par le bas, c'est exactement ce
              que ce rôle décrit. */}
          <div
            className="agent-fil"
            ref={filRef}
            tabIndex={0}
            role="log"
            aria-label="Conversation avec l'assistant"
          >
            {aValider ? (
              <div className="agent-vide">
                <p>
                  Avant la première utilisation, un avertissement sur les
                  limites de l'assistant est à lire.
                </p>
                <Link to="/assistant" className="btn btn-principal btn-compact">
                  Ouvrir l'assistant
                </Link>
              </div>
            ) : messages.length === 0 ? (
              <div className="agent-vide">
                <p>Posez votre question. Par exemple :</p>
                <ul className="agent-amorces">
                  {AMORCES.map((a) => (
                    <li key={a}>
                      <button type="button" onClick={() => poser(a)}>
                        {a}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              messages.map((m, i) => (
                <div
                  key={i}
                  // `utilisateur` et non `user` : c'est la valeur de l'enum du
                  // modèle Conversation. Comparer à « user » rangeait TOUS les
                  // messages du côté de l'assistant.
                  className={`agent-message agent-message--${m.role === "utilisateur" ? "moi" : "lui"}`}
                >
                  {m.contenu}
                </div>
              ))
            )}

            {/* `aria-live` : sans lui, l'arrivée d'une réponse est invisible
                pour un lecteur d'écran, qui attend devant un panneau muet. */}
            <div aria-live="polite" className="sr-only">
              {envoi ? "L'assistant rédige une réponse." : ""}
            </div>

            {envoi && (
              <div className="agent-message agent-message--lui agent-attente">
                <span />
                <span />
                <span />
              </div>
            )}

            {erreur && (
              <p className="agent-erreur" role="alert">
                {erreur}
              </p>
            )}
          </div>

          {!aValider && (
            <form
              className="agent-saisie"
              onSubmit={(e) => {
                e.preventDefault();
                poser(question);
              }}
            >
              <label htmlFor="agent-question" className="sr-only">
                Votre question
              </label>
              <input
                id="agent-question"
                ref={champRef}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Votre question…"
                autoComplete="off"
              />
              <button
                type="submit"
                className="agent-envoyer"
                disabled={envoi || !question.trim()}
                aria-label="Envoyer"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </button>
            </form>
          )}

          {messages.length > 0 && (
            <p className="agent-pied">
              <Link to="/assistant">Voir la conversation en entier</Link>
            </p>
          )}
        </section>
      )}

      <button
        type="button"
        ref={declencheurRef}
        className="agent-declencheur"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        aria-label={ouvert ? "Fermer l'assistant" : "Ouvrir l'assistant"}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {ouvert ? (
            <path d="M18 6L6 18M6 6l12 12" />
          ) : (
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          )}
        </svg>
        {/* Le libellé n'est visible que fermé : une agent sans mot est une
            icône de plus, qu'on n'ose pas cliquer. */}
        {!ouvert && <span className="agent-libelle">Une question ?</span>}
      </button>
    </div>
  );
};

export default BulleAssistant;
