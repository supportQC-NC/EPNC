// src/screens/CandidaturesScreen/CandidaturesScreen.jsx
import { Link } from "react-router-dom";
import { useGetCandidaturesQuery } from "../../slices/candidatureApiSlice";
import { statut as libelleStatut, STATUTS } from "../../constants";
import { formaterDateCourte, dateIso } from "../../utils/format";
import { messageErreur } from "../../utils/erreurApi";
import "./CandidaturesScreen.css";

const CandidaturesScreen = () => {
  const { data, isLoading, isError, error } = useGetCandidaturesQuery();

  if (isLoading) {
    return (
      <div className="conteneur suivi">
        <p role="status">Chargement de vos candidatures…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="conteneur suivi">
        <div className="message message-erreur" role="alert">
          {messageErreur(error, "Impossible de charger vos candidatures.")}
        </div>
      </div>
    );
  }

  // On n'affiche que les statuts réellement présents : une rangée de sept
  // compteurs dont cinq à zéro n'apprend rien et noie les deux qui comptent.
  const compteurs = STATUTS.filter((s) => data.parStatut[s.valeur] > 0);

  return (
    <div className="conteneur suivi">
      <header className="suivi-entete">
        <h1>Mes candidatures</h1>
        <p className="suivi-intro">
          Où en est chaque dossier, et ce qu'il reste à faire.
        </p>
      </header>

      {data.total === 0 ? (
        <div className="suivi-vide">
          <h2>Aucune candidature pour l'instant</h2>
          <p>
            Parcourez les postes ouverts : depuis une offre, vous pourrez
            préparer votre dossier en un clic.
          </p>
          <Link to="/offres" className="btn btn-principal">
            Voir les postes ouverts
          </Link>
        </div>
      ) : (
        <>
          {compteurs.length > 0 && (
            <ul className="suivi-compteurs">
              {compteurs.map((s) => (
                <li key={s.valeur}>
                  <span className="suivi-compteur-valeur">
                    {data.parStatut[s.valeur]}
                  </span>
                  <span className="suivi-compteur-libelle">{s.libelle}</span>
                </li>
              ))}
            </ul>
          )}

          <ul className="suivi-liste">
            {data.candidatures.map((c) => {
              const st = libelleStatut(c.statut);
              return (
                <li key={c._id}>
                  <article className={`dossier dossier--${c.statut}`}>
                    <div className="dossier-haut">
                      <h2 className="dossier-titre">
                        <Link to={`/candidatures/${c._id}`}>{c.avpIntitule}</Link>
                      </h2>
                      <span className={`pastille pastille--${c.statut}`}>
                        {st.libelle}
                      </span>
                    </div>

                    {c.avpDirection && (
                      <p className="dossier-meta">{c.avpDirection}</p>
                    )}

                    <p className="dossier-avancement">
                      {c.piecesRemplies} pièce{c.piecesRemplies > 1 ? "s" : ""} sur 4
                      {c.envoyeeLe ? (
                        <>
                          {" · envoyée le "}
                          <time dateTime={dateIso(c.envoyeeLe)}>
                            {formaterDateCourte(c.envoyeeLe)}
                          </time>
                        </>
                      ) : (
                        <>
                          {" · modifiée le "}
                          <time dateTime={dateIso(c.updatedAt)}>
                            {formaterDateCourte(c.updatedAt)}
                          </time>
                        </>
                      )}
                    </p>

                    <Link
                      to={`/candidatures/${c._id}`}
                      className="btn btn-secondaire btn-compact"
                    >
                      Ouvrir le dossier
                      <span className="sr-only"> — {c.avpIntitule}</span>
                    </Link>
                  </article>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
};

export default CandidaturesScreen;
