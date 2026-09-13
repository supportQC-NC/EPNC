// src/screens/AlertesScreen/AlertesScreen.jsx
//
// Les alertes de la veille.
//
// ══════════════════════════════════════════════════════════════════════════
//  CHAQUE ALERTE MÈNE AUX PIÈCES, PAS À UNE ANNONCE
// ══════════════════════════════════════════════════════════════════════════
// Le règlement l'impose et le bon sens aussi : prévenir quelqu'un qu'un poste
// existe, c'est déplacer le problème. Le bouton principal de chaque alerte ne
// dit donc pas « voir l'offre » mais « préparer mon dossier » — un geste, et
// les quatre pièces sont écrites.
//
// Chaque alerte porte aussi ses PREUVES : ce qui, dans l'annonce, répond à
// quoi dans le parcours. Une alerte sans justification est indiscernable d'une
// publicité, et trois alertes hors sujet suffisent à faire classer
// l'expéditeur en indésirable.
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  useGetAlertesQuery,
  useMarquerLuesMutation,
  useMajPreferencesVeilleMutation,
  usePreparerDossierMutation,
} from "../../slices/veilleApiSlice";
import { useCreerCandidatureMutation } from "../../slices/candidatureApiSlice";
import { messageErreur } from "../../utils/erreurApi";
import { formaterDate, dateIso } from "../../utils/format";
import "./AlertesScreen.css";

const FREQUENCES = [
  { valeur: "immediat", libelle: "Dès qu'un poste correspond" },
  { valeur: "quotidien", libelle: "Un récapitulatif par jour" },
  { valeur: "jamais", libelle: "Jamais par courriel" },
];

const Alerte = ({ a, onPreparer, enCours }) => (
  <article className={`alerte${a.lu ? "" : " alerte--nouvelle"}`}>
    <div className="alerte-haut">
      <div>
        {!a.lu && <span className="alerte-pastille">Nouveau</span>}
        <h2 className="alerte-titre">
          {a.type === "offre" ? (
            <Link to={`/offres/${a.avpSlug}`}>{a.avpIntitule}</Link>
          ) : (
            <Link to={`/vivier/${a.profilId}`}>{a.profilNom}</Link>
          )}
        </h2>
        <p className="alerte-meta">
          {a.type === "offre"
            ? [a.employeur, a.lieu].filter(Boolean).join(" · ")
            : [a.profilTitre, a.lieu].filter(Boolean).join(" · ")}
        </p>
      </div>

      <div className="alerte-score">
        <span className="alerte-score-valeur">{a.score}</span>
        <span className="alerte-score-sur">/100</span>
        {a.fiabilite && a.fiabilite < 100 && (
          <span className="alerte-score-assiette">
            sur {a.fiabilite} points de barème
          </span>
        )}
      </div>
    </div>

    {a.verdict && <p className="alerte-verdict">{a.verdict}</p>}

    {a.preuves?.length > 0 && (
      <div className="alerte-preuves">
        <p className="alerte-preuves-titre">Ce qui correspond</p>
        <ul>
          {a.preuves.map((p, i) => (
            <li key={i}>
              <span className="alerte-attendu">{p.attendu}</span>
              <span className="alerte-fleche" aria-hidden="true">
                →
              </span>
              <span className="alerte-preuve">{p.couvertPar}</span>
            </li>
          ))}
        </ul>
      </div>
    )}

    <p className="alerte-date">
      <time dateTime={dateIso(a.createdAt)}>{formaterDate(a.createdAt)}</time>
      {a.dateLimite && (
        <>
          {" · candidatures jusqu'au "}
          <time dateTime={dateIso(a.dateLimite)}>
            {formaterDate(a.dateLimite)}
          </time>
        </>
      )}
    </p>

    {/* Une alerte survit à ce qu'elle annonçait : on le dit plutôt que de la
        masquer, sinon la personne cherche une alerte qu'elle a vue. */}
    {a.type === "offre" && !a.encoreOuverte ? (
      <p className="alerte-close">
        Les candidatures pour ce poste sont closes. La fiche reste consultable.
      </p>
    ) : (
      <div className="actions alerte-actions">
        {a.type === "offre" ? (
          <>
            <button
              type="button"
              className="btn btn-principal btn-compact"
              onClick={() => onPreparer(a)}
              disabled={enCours}
            >
              {enCours ? "Préparation…" : "Préparer mon dossier"}
            </button>
            <Link
              to={`/offres/${a.avpSlug}`}
              className="btn btn-secondaire btn-compact"
            >
              Voir la fiche
            </Link>
          </>
        ) : (
          <Link
            to={`/vivier/${a.profilId}`}
            className="btn btn-principal btn-compact"
          >
            Voir le parcours
          </Link>
        )}
      </div>
    )}
  </article>
);

const AlertesScreen = () => {
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useGetAlertesQuery();
  const [marquerLues] = useMarquerLuesMutation();
  const [majPreferences] = useMajPreferencesVeilleMutation();
  const [creerCandidature] = useCreerCandidatureMutation();
  const [preparer] = usePreparerDossierMutation();

  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(null);

  // Le geste complet, en un clic : créer la candidature, produire les quatre
  // pièces, ouvrir le dossier. C'est ce que « ne pas s'arrêter à la
  // notification » veut dire concrètement.
  const preparerDossier = async (alerte) => {
    setErreur("");
    setEnCours(alerte._id);

    try {
      const candidature = await creerCandidature(alerte.avpSlug).unwrap();
      await preparer(candidature._id).unwrap();
      navigate(`/candidatures/${candidature._id}`);
    } catch (err) {
      setErreur(messageErreur(err, "Impossible de préparer ce dossier."));
    } finally {
      setEnCours(null);
    }
  };

  if (isLoading) {
    return (
      <div className="conteneur alertes">
        <p role="status">Chargement de vos alertes…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="conteneur alertes">
        <div className="message message-erreur" role="alert">
          {messageErreur(error, "Impossible de charger vos alertes.")}
        </div>
      </div>
    );
  }

  const { preferences, alertes, nonLues } = data;

  return (
    <div className="conteneur alertes">
      <header className="alertes-entete">
        <h1>Vos alertes</h1>
        <p className="alertes-intro">
          Les postes publiés depuis votre dernière visite qui correspondent à
          votre profil. Chaque correspondance est justifiée : vous voyez ce
          qui, dans l'annonce, répond à quoi dans votre parcours.
        </p>
      </header>

      {erreur && (
        <div className="message message-erreur" role="alert">
          {erreur}
        </div>
      )}

      {/* ── Préférences ─────────────────────────────────────────────── */}
      <section className="carte alertes-reglages" aria-labelledby="titre-reglages">
        <h2 id="titre-reglages">Quand vous prévenir</h2>

        <label className="profil-bascule">
          <input
            type="checkbox"
            checked={preferences.actif}
            onChange={(e) => majPreferences({ actif: e.target.checked })}
          />
          <span>Me prévenir quand un poste correspond à mon profil</span>
        </label>

        {preferences.actif && (
          <div className="alertes-reglages-grille">
            <div className="champ">
              <label htmlFor="frequence">Par courriel</label>
              <select
                id="frequence"
                value={preferences.frequence}
                onChange={(e) => majPreferences({ frequence: e.target.value })}
              >
                {FREQUENCES.map((f) => (
                  <option key={f.valeur} value={f.valeur}>
                    {f.libelle}
                  </option>
                ))}
              </select>
              <span className="champ-aide">
                Un seul courriel par lot de publications, jamais un par offre.
              </span>
            </div>

            <div className="champ">
              <label htmlFor="seuil">
                Ne me prévenir qu'au-dessus de{" "}
                <strong>{preferences.scoreMinimal}/100</strong>
              </label>
              <input
                id="seuil"
                type="range"
                min="0"
                max="90"
                step="5"
                value={preferences.scoreMinimal}
                onChange={(e) =>
                  majPreferences({ scoreMinimal: Number(e.target.value) })
                }
                aria-describedby="aide-seuil"
              />
              {/* La valeur est écrite dans le libellé : un curseur seul n'est
                  pas lisible par tout le monde. */}
              <span id="aide-seuil" className="champ-aide">
                45 correspond au seuil « candidature défendable ». Montez-le si
                vous recevez des propositions hors sujet, baissez-le si vous
                préférez tout voir.
              </span>
            </div>
          </div>
        )}
      </section>

      {/* ── Les alertes ─────────────────────────────────────────────── */}
      <div className="alertes-barre">
        <p className="alertes-compte" aria-live="polite">
          {alertes.length} alerte{alertes.length > 1 ? "s" : ""}
          {nonLues > 0 && ` · ${nonLues} non lue${nonLues > 1 ? "s" : ""}`}
        </p>

        {nonLues > 0 && (
          <button
            type="button"
            className="btn btn-secondaire btn-compact"
            onClick={() => marquerLues()}
          >
            Tout marquer comme lu
          </button>
        )}
      </div>

      {alertes.length === 0 ? (
        <p className="alertes-vide">
          {preferences.actif
            ? "Aucune alerte pour l'instant. Vous serez prévenu dès qu'un poste correspondra à votre profil — les offres sont vérifiées à chaque publication."
            : "La veille est désactivée. Activez-la ci-dessus pour être prévenu quand un poste correspond."}
        </p>
      ) : (
        <ul className="alertes-liste">
          {alertes.map((a) => (
            <li key={a._id}>
              <Alerte
                a={a}
                onPreparer={preparerDossier}
                enCours={enCours === a._id}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AlertesScreen;
