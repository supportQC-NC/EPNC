// src/screens/VivierScreen/CandidatsOffreScreen.jsx
//
// Le rapprochement dans l'AUTRE SENS : une offre, et les profils du vivier qui
// pourraient y répondre.
//
// C'est le même moteur que côté candidat — mêmes composantes, mêmes preuves,
// mêmes filtres bloquants. Deux moteurs auraient fini par rendre deux verdicts
// différents sur le même couple, que ni le candidat ni le recruteur n'auraient
// pu s'expliquer.
import { Link, useParams } from "react-router-dom";
import { useGetCandidatsPourOffreQuery } from "../../slices/recruteurApiSlice";
import { messageErreur } from "../../utils/erreurApi";
import "./VivierScreen.css";

const initiales = (prenom, nom) =>
  [prenom, nom]
    .filter(Boolean)
    .map((m) => m[0]?.toUpperCase())
    .join("");

// Une composante du score, avec ce qu'elle a trouvé et ce qui manque.
// Identique à l'affichage candidat : le recruteur voit exactement la même
// justification, ce qui rend une discussion possible entre les deux.
const Composante = ({ c }) => (
  <li className={`composante${c.applicable ? "" : " composante--neutre"}`}>
    <div className="composante-haut">
      <span className="composante-libelle">{c.libelle}</span>
      <span className="composante-points">
        {c.applicable ? `${c.points}/${c.maximum}` : "neutralisée"}
      </span>
    </div>
    {c.note && <p className="composante-note">{c.note}</p>}

    {c.evidences?.length > 0 && (
      <details className="composante-detail">
        <summary>Ce qui est couvert ({c.evidences.length})</summary>
        <ul>
          {c.evidences.map((e, i) => (
            <li key={i}>
              <strong>{e.attendu}</strong>
              <br />
              <span className="composante-preuve">
                → {e.couvertPar}
                {e.origine ? ` (${e.origine})` : ""}
              </span>
            </li>
          ))}
        </ul>
      </details>
    )}

    {c.manques?.length > 0 && (
      <details className="composante-detail">
        <summary>Ce qui manque ({c.manques.length})</summary>
        <ul>
          {c.manques.map((m, i) => (
            <li key={i}>{m.attendu}</li>
          ))}
        </ul>
      </details>
    )}
  </li>
);

const CandidatsOffreScreen = () => {
  const { slug } = useParams();
  const { data, isLoading, isError, error } = useGetCandidatsPourOffreQuery(slug);

  if (isLoading) {
    return (
      <div className="conteneur vivier">
        <p role="status">Rapprochement du vivier en cours…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="conteneur vivier">
        <div className="message message-erreur" role="alert">
          {messageErreur(error, "Impossible de rapprocher le vivier de cette offre.")}
        </div>
        <Link to="/vivier" className="btn btn-secondaire">
          Retour aux candidats
        </Link>
      </div>
    );
  }

  return (
    <div className="conteneur vivier">
      <p className="detail-fil">
        <Link to="/vivier">← Les candidats</Link>
        {" · "}
        <Link to={`/offres/${slug}`}>Voir la fiche de poste</Link>
      </p>

      <header className="vivier-entete">
        <p className="candidat-titre">{data.offre.employeur?.nom}</p>
        <h1>{data.offre.intitule}</h1>
        <p className="vivier-intro">
          {[data.offre.direction, data.offre.lieu].filter(Boolean).join(" · ")}
        </p>
        <p className="vivier-intro">
          Les {data.total} profils du vivier, rapprochés de ce poste par le même
          moteur que celui utilisé par les candidats. Chaque point du score
          renvoie à l'attendu de l'annonce et à ce qui le couvre dans le
          parcours.
        </p>
      </header>

      {data.retenus.length === 0 ? (
        <p className="vivier-vide">
          Aucun profil du vivier ne peut être rapproché de ce poste.
        </p>
      ) : (
        <ul className="offre-candidats">
          {data.retenus.map(({ candidat, rapprochement }) => (
            <li key={candidat.id}>
              <article
                className={`match match--${rapprochement.verdict?.niveau || "indetermine"}`}
              >
                <div className="match-haut">
                  <div className="candidat-haut">
                    {candidat.photo ? (
                      <img className="candidat-photo" src={candidat.photo} alt="" />
                    ) : (
                      <div
                        className="candidat-photo candidat-photo--vide"
                        aria-hidden="true"
                      >
                        {initiales(candidat.prenom, candidat.nom)}
                      </div>
                    )}
                    <div className="candidat-identite">
                      <h2 className="match-titre">
                        <Link to={`/vivier/${candidat.id}`}>
                          {candidat.prenom} {candidat.nom}
                        </Link>
                      </h2>
                      {candidat.titre && (
                        <p className="candidat-titre">{candidat.titre}</p>
                      )}
                      <p className="candidat-lieu">
                        {[candidat.ville, candidat.province]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  </div>

                  {/* Même règle que côté candidat : pas de score quand l'offre
                      ne publie pas de quoi en calculer un. Un chiffre bas se
                      lirait comme un jugement sur la personne, alors qu'il ne
                      juge que la complétude de l'annonce. */}
                  <div className="match-score">
                    {rapprochement.score === null ? (
                      <span className="match-score-absent">Non évaluable</span>
                    ) : (
                      <>
                        <span className="match-score-valeur">
                          {rapprochement.score}
                        </span>
                        <span className="match-score-sur">/100</span>
                        {rapprochement.fiabilite < 100 && (
                          <span className="match-score-assiette">
                            calculé sur {rapprochement.fiabilite} points de barème
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {rapprochement.verdict && (
                  <p
                    className={`match-verdict match-verdict--${rapprochement.verdict.niveau}`}
                  >
                    {rapprochement.verdict.texte}
                  </p>
                )}

                <ul className="composantes">
                  {rapprochement.composantes.map((c) => (
                    <Composante key={c.cle} c={c} />
                  ))}
                </ul>

                <div className="actions match-actions">
                  <Link
                    to={`/vivier/${candidat.id}`}
                    className="btn btn-secondaire btn-compact"
                  >
                    Voir le parcours
                  </Link>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}

      {/* Les écartés et leurs motifs, comme côté candidat. Un recruteur qui ne
          voit pas pourquoi quelqu'un manque à la liste soupçonnera l'outil de
          lui cacher des gens. */}
      {data.ecartes.length > 0 && (
        <section className="ecartes" aria-labelledby="titre-ecartes-offre">
          <h2 id="titre-ecartes-offre">
            Écartés ({data.ecartes.length}) — et pourquoi
          </h2>
          <p className="ecartes-intro">
            Ces profils ont été exclus par une contrainte dure de l'annonce, pas
            par un score insuffisant. La règle est la même dans les deux sens :
            une contrainte exclut, elle ne pénalise pas.
          </p>
          <ul className="ecartes-liste">
            {data.ecartes.map(({ candidat, rapprochement }) => (
              <li key={candidat.id} className="ecarte">
                <h3>
                  <Link to={`/vivier/${candidat.id}`}>
                    {candidat.prenom} {candidat.nom}
                  </Link>
                </h3>
                <ul className="ecarte-motifs">
                  {rapprochement.motifsExclusion.map((motif, i) => (
                    <li key={i}>{motif}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

export default CandidatsOffreScreen;
