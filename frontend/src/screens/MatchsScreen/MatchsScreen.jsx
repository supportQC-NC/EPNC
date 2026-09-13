// src/screens/MatchsScreen/MatchsScreen.jsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { useGetMatchsQuery } from "../../slices/matchApiSlice";
import { formaterDate, dateIso } from "../../utils/format";
import { messageErreur } from "../../utils/erreurApi";
import "./MatchsScreen.css";

// Une composante du score, avec sa jauge et ses justifications.
const Composante = ({ composante }) => {
  const { libelle, points, maximum, applicable, note, evidences, manques } =
    composante;

  const part = maximum > 0 ? Math.round((points / maximum) * 100) : 0;

  return (
    <li className={`composante${applicable ? "" : " composante--neutre"}`}>
      <div className="composante-haut">
        <h4>{libelle}</h4>
        <span className="composante-points">
          {applicable ? `${points}/${maximum}` : "neutralisée"}
        </span>
      </div>

      {applicable && (
        <div
          className="jauge jauge--fine"
          role="progressbar"
          aria-valuenow={points}
          aria-valuemin={0}
          aria-valuemax={maximum}
          aria-label={`${libelle} : ${points} sur ${maximum}`}
        >
          <div className="jauge-remplie" style={{ width: `${part}%` }} />
        </div>
      )}

      <p className="composante-note">{note}</p>

      {evidences?.length > 0 && (
        <details className="justification">
          <summary>
            Ce qui est couvert ({evidences.length})
          </summary>
          <ul className="justification-liste">
            {evidences.map((e, i) => (
              <li key={i}>
                <span className="justification-attendu">{e.attendu}</span>
                <span className="justification-lien">
                  couvert par <strong>{e.couvertPar}</strong>
                  {e.origine ? ` — ${e.origine}` : ""}
                  {e.suffisant === false && (
                    <span className="justification-insuffisant">
                      {" "}
                      · niveau déclaré inférieur à l'attendu
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {manques?.length > 0 && (
        <details className="justification justification--manque">
          <summary>Ce qui manque ({manques.length})</summary>
          <ul className="justification-liste">
            {manques.map((m, i) => (
              <li key={i}>
                <span className="justification-attendu">{m.attendu}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
  );
};

const MatchsScreen = () => {
  const [toutes, setToutes] = useState(false);
  const { data, isLoading, isError, error } = useGetMatchsQuery({ toutes });

  if (isLoading) {
    return (
      <div className="conteneur conteneur--large matchs">
        <p role="status">Rapprochement en cours…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="conteneur conteneur--large matchs">
        <div className="message message-erreur" role="alert">
          {messageErreur(error, "Le rapprochement a échoué.")}
        </div>
        <Link to="/profil" className="btn btn-principal">
          Compléter mon profil
        </Link>
      </div>
    );
  }

  return (
    <div className="conteneur conteneur--large matchs">
      <header className="matchs-entete">
        <h1>Les postes qui vous correspondent</h1>
        <p className="matchs-intro">
          Chaque score se décompose, et chaque point se justifie : vous voyez ce
          qui est couvert, par quoi, et ce qui manque. Rien n'est calculé dans
          votre dos.
        </p>

        <label className="matchs-filtre">
          <input
            type="checkbox"
            checked={toutes}
            onChange={(e) => setToutes(e.target.checked)}
          />
          Inclure les offres clôturées
        </label>
      </header>

      {/* ── Retenus ──────────────────────────────────────────────────── */}
      {data.retenus.length === 0 ? (
        <p className="matchs-vide">
          Aucun poste ouvert ne peut vous être proposé pour le moment.
        </p>
      ) : (
        <ul className="matchs-liste">
          {data.retenus.map((m) => (
            <li key={m.avpSlug}>
              <article className={`match match--${m.verdict.niveau}`}>
                <div className="match-haut">
                  <div>
                    <h2 className="match-titre">
                      <Link to={`/offres/${m.avpSlug}`}>{m.avpIntitule}</Link>
                    </h2>
                    <p className="match-meta">
                      {[m.avpDirection, m.avpLieu].filter(Boolean).join(" · ")}
                    </p>
                  </div>

                  {/* Pas de score quand l'offre n'en publie pas les moyens.
                      Afficher « 61/100 » calculé sur 23 points de barème, à
                      côté d'un 61/100 calculé sur 100, ferait passer une offre
                      vide pour une bonne correspondance. */}
                  <div className="match-score">
                    {m.score === null ? (
                      <span className="match-score-absent">
                        Non évaluable
                      </span>
                    ) : (
                      <>
                        <span className="match-score-valeur">{m.score}</span>
                        <span className="match-score-sur">/100</span>
                        {m.fiabilite < 100 && (
                          <span className="match-score-assiette">
                            calculé sur {m.fiabilite} points de barème
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <p className={`match-verdict match-verdict--${m.verdict.niveau}`}>
                  {m.verdict.texte}
                </p>

                {/* Incohérence dans la donnée publique : on le dit, plutôt que
                    de laisser croire à un score complet. */}
                {m.rattachementIncoherent && (
                  <p className="match-alerte">
                    Le métier déclaré par l'offre ne correspond pas à son code
                    au référentiel. La composante « compétences du référentiel »
                    a donc été neutralisée : le score porte sur le reste.
                  </p>
                )}

                <ul className="composantes">
                  {m.composantes.map((c) => (
                    <Composante key={c.cle} composante={c} />
                  ))}
                </ul>

                <div className="actions match-actions">
                  <Link
                    to={`/offres/${m.avpSlug}`}
                    className="btn btn-secondaire btn-compact"
                  >
                    Voir la fiche
                  </Link>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}

      {/* ── Écartés ──────────────────────────────────────────────────── */}
      {/* Le règlement demande d'expliquer pourquoi un rapprochement a été
          écarté, pas seulement pourquoi il a été retenu. */}
      {data.ecartes.length > 0 && (
        <section className="ecartes" aria-labelledby="titre-ecartes">
          <h2 id="titre-ecartes">
            Écartés ({data.ecartes.length}) — et pourquoi
          </h2>
          <p className="ecartes-intro">
            Ces postes ne vous sont pas proposés. Un poste écarté n'est pas un
            jugement sur votre profil : c'est une condition qui n'est pas
            remplie, et elle est dite.
          </p>

          <ul className="ecartes-liste">
            {data.ecartes.map((m) => (
              <li key={m.avpSlug} className="ecarte">
                <h3>
                  <Link to={`/offres/${m.avpSlug}`}>{m.avpIntitule}</Link>
                </h3>
                <ul className="ecarte-motifs">
                  {m.motifsExclusion.map((motif, i) => (
                    <li key={i}>{motif}</li>
                  ))}
                </ul>
                {m.dateLimite && (
                  <p className="ecarte-date">
                    Date limite :{" "}
                    <time dateTime={dateIso(m.dateLimite)}>
                      {formaterDate(m.dateLimite)}
                    </time>
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="matchs-pied">
        Profil complété à {data.completude} %. Plus il est précis, plus le
        rapprochement l'est. <Link to="/profil">Compléter mon profil</Link>
      </p>
    </div>
  );
};

export default MatchsScreen;
