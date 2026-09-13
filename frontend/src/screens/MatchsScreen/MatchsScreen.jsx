// src/screens/MatchsScreen/MatchsScreen.jsx
//
// ══════════════════════════════════════════════════════════════════════════
//  97 ÉCRANS DE HAUT, DONT 139 CARTES QUI DISENT « JE NE SAIS PAS »
// ══════════════════════════════════════════════════════════════════════════
// Mesuré sur le corpus réel, profil complet à 100 % :
//
//   hauteur de page ...... 87 793 px, soit 97 écrans
//   nœuds DOM ............ 8 864
//   cartes rendues ....... 189
//   dont NON ÉVALUABLES .. 139 (fiabilité 23 < seuil 40)
//   meilleur score ....... 44/100 — sous le seuil de candidature défendable
//
// Autrement dit : l'écran qui porte le cœur noté du projet déroulait 139
// fiches complètes — quatre composantes, quatre jauges, deux dépliants
// chacune — pour dire 139 fois « cet employeur ne publie pas de quoi noter
// ce poste ». La démonstration du rapprochement expliqué était enterrée sous
// le bruit qu'elle sert justement à dénoncer.
//
// ══════════════════════════════════════════════════════════════════════════
//  CE QUI CHANGE
// ══════════════════════════════════════════════════════════════════════════
// 1. LE CHIFFRE EST DIT EN PREMIER. « 50 postes sur 189 peuvent être évalués,
//    le plus proche est à 44/100 » : la personne sait où elle en est avant de
//    faire défiler quoi que ce soit, y compris quand la réponse est décevante.
// 2. LES ÉVALUABLES PASSENT DEVANT, PAR PAQUETS. Dix à la fois — le serveur
//    les trie déjà `fiable` d'abord puis par score, on ne recalcule rien.
// 3. LES NON ÉVALUABLES DEVIENNENT UNE LISTE COMPACTE, REPLIÉE. Il n'y a
//    RIEN à décomposer : afficher quatre composantes neutralisées 139 fois
//    n'informe personne. Un intitulé, un employeur, un lien.
//
// 🔴 Rien n'est CACHÉ pour autant : le compte des non évaluables est écrit en
// toutes lettres, le groupe s'ouvre, et le motif est rappelé. Masquer ces 139
// offres serait le défaut inverse — laisser croire que le catalogue est plus
// riche qu'il ne l'est.
import { useState } from "react";
import { Link } from "react-router-dom";
import { useGetMatchsQuery } from "../../slices/matchApiSlice";
import { formaterDate, dateIso } from "../../utils/format";
import { messageErreur } from "../../utils/erreurApi";
import "./MatchsScreen.css";

// Combien de rapprochements complets on déroule d'un coup.
//
// Dix tient en cinq à six écrans : assez pour comparer, assez court pour
// atteindre le bas. Au-delà, personne ne descend — et ceux qu'on ajoute sont
// de toute façon moins proches que ceux qu'on vient de lire.
const PAR_PAQUET = 10;

// Une composante du score, avec sa jauge et ses justifications.
const Composante = ({ composante }) => {
  const { libelle, points, maximum, applicable, note, evidences, manques } =
    composante;

  const part = maximum > 0 ? Math.round((points / maximum) * 100) : 0;

  return (
    <li className={`composante${applicable ? "" : " composante--neutre"}`}>
      <div className="composante-haut">
        {/* `h3` et non `h4` : l'intitulé du poste au-dessus est un `h2`, et un
            plan qui saute un niveau est illisible à la navigation par titres —
            c'est ainsi qu'un lecteur d'écran parcourt une page longue.
            Relevé par axe (`heading-order`). */}
        <h3>{libelle}</h3>
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
  const [combien, setCombien] = useState(PAR_PAQUET);
  const [muettesOuvertes, setMuettesOuvertes] = useState(false);
  const { data, isLoading, isError, error } = useGetMatchsQuery({ toutes });

  if (isLoading) {
    return (
      <div className="conteneur conteneur--large matchs">
        {/* C'est l'attente la plus longue de l'application : le serveur
            confronte le profil à chacune des offres ouvertes, attendu par
            attendu. Quatre secondes devant une ligne de texte sur fond vide
            se lisent comme une panne.

            Deux choses changent cela, et aucune n'est décorative : DIRE ce
            qui se passe (« chaque poste est confronté à votre parcours »),
            et OCCUPER la place de ce qui arrive. */}
        <header className="matchs-entete">
          <h1>Les postes qui vous correspondent</h1>
          <p className="matchs-intro" role="status">
            Chaque poste ouvert est confronté à votre parcours, attendu par
            attendu. Quelques secondes.
          </p>
        </header>

        <ul className="matchs-liste" aria-hidden="true">
          {Array.from({ length: 3 }, (_, i) => (
            <li key={i}>
              <div className="match-squelette">
                <div className="match-squelette-haut">
                  <span className="sq sq--titre" />
                  <span className="sq sq--score" />
                </div>
                <span className="sq sq--ligne" />
                <div className="match-squelette-grille">
                  <span className="sq sq--bloc" />
                  <span className="sq sq--bloc" />
                  <span className="sq sq--bloc" />
                </div>
              </div>
            </li>
          ))}
        </ul>
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

  // `fiable` vient du serveur (`fiabilite >= FIABILITE_MINIMALE`) : le même
  // verdict que celui qui décide d'afficher « Non évaluable » sur la carte.
  // Le recalculer ici finirait par diverger d'un seuil ajusté côté moteur.
  const evaluables = data.retenus.filter((m) => m.fiable);
  const muettes = data.retenus.filter((m) => !m.fiable);
  const meilleur = evaluables.length > 0 ? evaluables[0].score : null;
  const affiches = evaluables.slice(0, combien);
  const reste = evaluables.length - affiches.length;

  return (
    <div className="conteneur conteneur--large matchs">
      <header className="matchs-entete">
        <h1>Les postes qui vous correspondent</h1>
        <p className="matchs-intro">
          Chaque score se décompose, et chaque point se justifie&nbsp;: vous
          voyez ce qui est couvert, par quoi, et ce qui manque. Rien n'est
          calculé dans votre dos.
        </p>

        {/* Le chiffre AVANT la liste.
            Découvrir en descendant que rien n'atteint le seuil, après avoir lu
            dix fiches, est plus décourageant que de le lire tout de suite — et
            donne l'impression qu'on le cachait. */}
        {data.retenus.length > 0 && (
          <p className="matchs-bilan" role="status">
            <strong>
              {evaluables.length} poste{evaluables.length > 1 ? "s" : ""} sur{" "}
              {data.retenus.length}
            </strong>{" "}
            {evaluables.length > 1 ? "peuvent" : "peut"} être évalué
            {evaluables.length > 1 ? "s" : ""} avec votre profil
            {meilleur !== null && (
              <>
                , et le plus proche est à <strong>{meilleur}/100</strong>
              </>
            )}
            .{" "}
            {muettes.length > 0 && (
              <>
                Pour {muettes.length} autres, l'employeur ne publie ni missions
                ni compétences attendues&nbsp;: il n'y a rien à confronter à
                votre parcours.
              </>
            )}
          </p>
        )}

        <label className="matchs-filtre">
          <input
            type="checkbox"
            checked={toutes}
            onChange={(e) => setToutes(e.target.checked)}
          />
          Inclure les offres clôturées
        </label>
      </header>

      {/* ── Les évaluables, par paquets ────────────────────── */}
      {data.retenus.length === 0 ? (
        <p className="matchs-vide">
          Aucun poste ouvert ne peut vous être proposé pour le moment.
        </p>
      ) : evaluables.length === 0 ? (
        <p className="matchs-vide">
          Aucun des postes ouverts ne publie assez d'informations pour être
          confronté à votre parcours. Ce n'est pas un verdict sur votre
          profil&nbsp;: c'est ce que les employeurs publient.
        </p>
      ) : (
        <>
          <ul className="matchs-liste">
            {affiches.map((m) => (
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
                        côté d'un 61/100 calculé sur 100, ferait passer une
                        offre vide pour une bonne correspondance. */}
                    <div className="match-score">
                      <p className="match-score-chiffre">
                        <span className="match-score-valeur">{m.score}</span>
                        <span className="match-score-sur">/100</span>
                      </p>
                      {/* Une barre sous le chiffre.
                          Deux scores voisins — 44 et 33 — ne se comparent pas
                          d'un coup d'œil quand ils ne sont que des chiffres :
                          il faut lire, retenir, soustraire. La barre donne la
                          quantité à l'œil pendant que le chiffre donne la
                          valeur exacte.

                          `aria-hidden` : elle ne dit rien de plus que le
                          nombre juste au-dessus. L'annoncer deux fois
                          allongerait la lecture de chaque carte sans rien
                          apporter. */}
                      <span className="match-barre" aria-hidden="true">
                        <span
                          className="match-barre-remplie"
                          style={{ width: `${m.score}%` }}
                        />
                      </span>
                      {m.fiabilite < 100 && (
                        <span className="match-score-assiette">
                          calculé sur {m.fiabilite} points de barème
                        </span>
                      )}
                    </div>
                  </div>

                  <p
                    className={`match-verdict match-verdict--${m.verdict.niveau}`}
                  >
                    {m.verdict.texte}
                  </p>

                  {/* Incohérence dans la donnée publique : on le dit, plutôt
                      que de laisser croire à un score complet. */}
                  {m.rattachementIncoherent && (
                    <p className="match-alerte">
                      Le métier déclaré par l'offre ne correspond pas à son
                      code au référentiel. La composante « compétences du
                      référentiel » a donc été neutralisée : le score porte
                      sur le reste.
                    </p>
                  )}

                  {/* Les composantes NEUTRALISÉES sortent de la grille.
                      La composante « référentiel » pèse 45 des 100 points,
                      mais elle n'est applicable que sur 2 offres du corpus :
                      sur toutes les autres, elle occupait un quart de la
                      carte pour afficher une jauge absente et une phrase.
                      Elle passe donc en une ligne sous les composantes qui,
                      elles, portent le score.

                      🔴 Elle ne DISPARAÎT pas : « neutralisée, pas à zéro »
                      est une règle du moteur, et le motif reste écrit. Ce qui
                      change est la place qu'elle prend, pas ce qu'elle dit. */}
                  <ul className="composantes">
                    {m.composantes
                      .filter((c) => c.applicable)
                      .map((c) => (
                        <Composante key={c.cle} composante={c} />
                      ))}
                  </ul>

                  {m.composantes.some((c) => !c.applicable) && (
                    <ul className="neutralisees">
                      {m.composantes
                        .filter((c) => !c.applicable)
                        .map((c) => (
                          <li key={c.cle}>
                            <strong>{c.libelle}</strong>
                            <span className="neutralisees-etat">
                              neutralisée
                            </span>
                            <span className="neutralisees-motif">{c.note}</span>
                          </li>
                        ))}
                    </ul>
                  )}

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

          {/* Un bouton, pas un défilement infini : on doit pouvoir atteindre
              le bas de cette page — c'est là que vivent les écartés et leurs
              motifs, que le règlement demande d'exposer. */}
          {reste > 0 && (
            <div className="matchs-suite">
              <button
                type="button"
                className="btn btn-secondaire"
                onClick={() => setCombien((n) => n + PAR_PAQUET)}
              >
                Voir {Math.min(reste, PAR_PAQUET)} poste
                {Math.min(reste, PAR_PAQUET) > 1 ? "s" : ""} de plus
              </button>
              <span className="matchs-suite-reste">
                {reste} restant{reste > 1 ? "s" : ""}, du plus proche au plus
                éloigné
              </span>
            </div>
          )}
        </>
      )}

      {/* ── Les offres sans détail publié ──────────────────── */}
      {/* Repliées, mais COMPTÉES et nommées. Les masquer laisserait croire que
          le catalogue est plus riche qu'il ne l'est ; les dérouler en fiches
          complètes noyait les 50 qui valent une lecture. */}
      {muettes.length > 0 && (
        <section className="muettes" aria-labelledby="titre-muettes">
          <h2 id="titre-muettes">
            {muettes.length} postes que nous ne pouvons pas évaluer
          </h2>
          <p className="muettes-intro">
            Ces employeurs publient l'intitulé, le service et le corps concerné,
            mais ni les missions ni les compétences attendues. Nous préférons ne
            rien annoncer plutôt que de noter un poste sur ce que nous aurions
            supposé — mais ils restent ouverts, et rien ne vous empêche d'y
            candidater.
          </p>

          <button
            type="button"
            className="btn btn-secondaire btn-compact"
            onClick={() => setMuettesOuvertes((o) => !o)}
            aria-expanded={muettesOuvertes}
          >
            {muettesOuvertes ? "Masquer" : "Voir"} ces {muettes.length} postes
          </button>

          {muettesOuvertes && (
            <ul className="muettes-liste">
              {muettes.map((m) => (
                <li key={m.avpSlug}>
                  <Link to={`/offres/${m.avpSlug}`}>{m.avpIntitule}</Link>
                  {[m.avpDirection, m.avpLieu].filter(Boolean).length > 0 && (
                    <span className="muettes-meta">
                      {[m.avpDirection, m.avpLieu].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
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
