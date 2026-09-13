// src/screens/RecruteurScreen/SuggestionCarte.jsx
//
// Une suggestion, et POURQUOI elle est faite.
//
// Le « pourquoi » n'est pas un ornement : c'est ce qui distingue un outil d'un
// oracle. Un recruteur qui voit « 78 % » sans explication ne peut ni vérifier,
// ni corriger — il peut seulement croire ou ignorer. En nommant les compétences
// communes et d'où vient leur poids (« déclarée », ou le nom d'un profil qu'il
// a lui-même enregistré), on lui rend la main sur le classement.
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  useGetListesQuery,
  useAjouterCandidatListeMutation,
} from "../../slices/recruteurEspaceApiSlice";
import { messageErreur } from "../../utils/erreurApi";
import "./recruteur.css";

const initiales = (prenom, nom) =>
  [prenom, nom]
    .filter(Boolean)
    .map((m) => m[0]?.toUpperCase())
    .join("");

const SuggestionCarte = ({ suggestion }) => {
  const { candidat, score, communes, nbCommunes } = suggestion;
  const { data: listes } = useGetListesQuery();
  const [ajouter, { isLoading }] = useAjouterCandidatListeMutation();

  const [ouvert, setOuvert] = useState(false);
  const [erreur, setErreur] = useState("");
  const [ajoutee, setAjoutee] = useState(null);

  const enregistrer = async (listeId, nom) => {
    setErreur("");
    try {
      await ajouter({ id: listeId, profilId: candidat.id }).unwrap();
      setAjoutee(nom);
      setOuvert(false);
    } catch (err) {
      setErreur(messageErreur(err, "Impossible d'ajouter ce profil."));
    }
  };

  return (
    <article className="suggestion">
      <div className="suggestion-haut">
        {candidat.photo ? (
          <img className="candidat-photo" src={candidat.photo} alt="" />
        ) : (
          <div className="candidat-photo candidat-photo--vide" aria-hidden="true">
            {initiales(candidat.prenom, candidat.nom)}
          </div>
        )}

        <div className="candidat-identite">
          <h3 className="suggestion-nom">
            <Link to={`/vivier/${candidat.id}`}>
              {candidat.prenom} {candidat.nom}
            </Link>
          </h3>
          {candidat.titre && <p className="candidat-titre">{candidat.titre}</p>}
          <p className="candidat-lieu">
            {[candidat.ville, candidat.province].filter(Boolean).join(" · ")}
          </p>
        </div>

        <div className="suggestion-score">
          <span className="suggestion-score-valeur">{score}</span>
          <span className="suggestion-score-sur">/100</span>
        </div>
      </div>

      {/* La justification, toujours visible. La replier derrière un « voir
          pourquoi » reviendrait à traiter l'explication comme un détail. */}
      <div className="suggestion-pourquoi">
        <p className="suggestion-pourquoi-titre">
          {nbCommunes} compétence{nbCommunes > 1 ? "s" : ""} correspond
          {nbCommunes > 1 ? "ent" : ""} à ce que vous cherchez :
        </p>
        <ul>
          {communes.map((c, i) => (
            <li key={i}>
              <strong>{c.declaree}</strong>
              {c.origines.length > 0 && (
                <span className="suggestion-origine">
                  {c.origines.includes("déclarée")
                    ? " — vous l'avez déclarée"
                    : ` — aussi chez ${c.origines.filter((o) => o !== "déclarée").join(", ")}`}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {erreur && (
        <p className="message message-erreur" role="alert">
          {erreur}
        </p>
      )}

      <div aria-live="polite">
        {ajoutee && (
          <p className="suggestion-confirmation">
            Ajouté à « {ajoutee} ».{" "}
            <Link to="/recruteur/listes">Voir la liste</Link>
          </p>
        )}
      </div>

      <div className="actions suggestion-actions">
        <Link to={`/vivier/${candidat.id}`} className="btn btn-secondaire btn-compact">
          Voir le parcours
        </Link>

        {ouvert ? (
          <div className="suggestion-listes">
            {listes?.length ? (
              <>
                <p className="suggestion-listes-titre">Ajouter à :</p>
                <ul>
                  {listes.map((l) => (
                    <li key={l._id}>
                      <button
                        type="button"
                        className="btn btn-secondaire btn-compact"
                        onClick={() => enregistrer(l._id, l.nom)}
                        disabled={isLoading}
                      >
                        {l.nom} ({l.nbEntrees})
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="suggestion-listes-titre">
                Aucune liste. <Link to="/recruteur/listes">Créez-en une</Link>.
              </p>
            )}
            <button
              type="button"
              className="btn btn-secondaire btn-compact"
              onClick={() => setOuvert(false)}
            >
              Annuler
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-principal btn-compact"
            onClick={() => setOuvert(true)}
          >
            Mettre de côté
          </button>
        )}
      </div>
    </article>
  );
};

export default SuggestionCarte;
