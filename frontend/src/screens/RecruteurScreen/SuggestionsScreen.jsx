// src/screens/RecruteurScreen/SuggestionsScreen.jsx
//
// Toutes les suggestions, et les critères sur lesquels elles reposent.
//
// Les critères sont affichés EN PREMIER, avec leur poids et leur origine. Un
// classement dont on ne voit pas les règles ne se corrige pas : on ne peut que
// le subir. En les montrant, on transforme « l'outil me propose ça » en « je
// lui ai demandé ça, et je peux changer d'avis ».
import { Link } from "react-router-dom";
import { useGetSuggestionsQuery } from "../../slices/recruteurEspaceApiSlice";
import { messageErreur } from "../../utils/erreurApi";
import SuggestionCarte from "./SuggestionCarte";
import "./recruteur.css";

const SuggestionsScreen = () => {
  const { data, isLoading, isError, error } = useGetSuggestionsQuery();

  if (isLoading) {
    return (
      <div className="conteneur conteneur--large recruteur">
        <p role="status">Calcul des suggestions…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="conteneur conteneur--large recruteur">
        <div className="message message-erreur" role="alert">
          {messageErreur(error, "Impossible de calculer les suggestions.")}
        </div>
      </div>
    );
  }

  return (
    <div className="conteneur conteneur--large recruteur">
      <header className="recruteur-entete">
        <h1>Profils à regarder</h1>
        <p className="recruteur-intro">
          Classés selon ce que vous avez déclaré chercher et les profils que
          vous avez mis de côté. Les candidats déjà enregistrés n'y figurent
          pas.
        </p>
      </header>

      {!data.exploitable ? (
        <p className="recruteur-vide">
          L'outil n'a pas encore de quoi vous proposer quelque chose. Indiquez
          les compétences que vous recherchez, ou mettez quelques profils de
          côté depuis <Link to="/vivier">les candidats</Link>.{" "}
          <Link to="/recruteur/profil">Configurer mon profil</Link>.
        </p>
      ) : (
        <>
          <section className="carte" aria-labelledby="titre-criteres">
            <h2 id="titre-criteres">Sur quoi repose ce classement</h2>
            <p className="recruteur-intro">
              {data.nbEnregistres > 0
                ? `${data.nbEnregistres} profil${data.nbEnregistres > 1 ? "s" : ""} que vous avez enregistré${data.nbEnregistres > 1 ? "s" : ""} ${data.nbEnregistres > 1 ? "pèsent" : "pèse"} pour ${data.poidsHistorique} % dans le calcul.`
                : "Aucun profil enregistré pour l'instant : seuls vos critères déclarés comptent."}{" "}
              <Link to="/recruteur/profil">Ajuster</Link>.
            </p>

            <ul className="criteres-liste">
              {data.criteres.map((c) => (
                <li key={c.libelle}>
                  <span className="critere-libelle">{c.libelle}</span>
                  {/* Le poids est écrit, pas seulement représenté : une barre
                      seule ne se lit ni au lecteur d'écran, ni comparée. */}
                  <span className="critere-poids">poids {c.poids}</span>
                  {c.origines.length > 0 && (
                    <span className="critere-origine">
                      {c.origines.join(", ")}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <p className="vivier-compte" aria-live="polite">
            {data.total} profil{data.total > 1 ? "s" : ""} correspond
            {data.total > 1 ? "ent" : ""} à ces critères
            {data.total > data.suggestions.length &&
              ` · les ${data.suggestions.length} premiers sont affichés`}
          </p>

          {data.total === 0 ? (
            <p className="recruteur-vide">
              Aucun profil du vivier ne correspond. Élargissez vos critères
              depuis <Link to="/recruteur/profil">votre profil</Link>.
            </p>
          ) : (
            <ul className="suggestions-liste suggestions-liste--large">
              {data.suggestions.map((s) => (
                <li key={s.candidat.id}>
                  <SuggestionCarte suggestion={s} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
};

export default SuggestionsScreen;
