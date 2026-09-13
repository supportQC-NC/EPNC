// src/screens/OffreDetailScreen/OffreDetailScreen.jsx
import { useState } from "react";
import { Link, useParams, useLocation, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useCreerCandidatureMutation } from "../../slices/candidatureApiSlice";
import {
  useGetAvpApercuQuery,
  useGetAvpCompletQuery,
} from "../../slices/avpApiSlice";
import { formaterDate, dateIso, libelleContrat, echeance } from "../../utils/format";
import "./OffreDetailScreen.css";
import { messageErreur } from "../../utils/erreurApi";

// Petite liste à puces, rendue seulement si elle a du contenu — évite des
// titres de section vides quand un champ manque dans la donnée source.
const Bloc = ({ titre, items }) => {
  if (!items?.length) return null;
  return (
    <section className="fiche-bloc">
      <h2>{titre}</h2>
      <ul>
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </section>
  );
};

const OffreDetailScreen = () => {
  const { slug } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { userInfo } = useSelector((state) => state.auth);
  const [erreurDossier, setErreurDossier] = useState("");
  const [creerCandidature, { isLoading: creation }] = useCreerCandidatureMutation();

  // Le serveur renvoie la candidature existante si elle l'est déjà : le même
  // bouton mène toujours au bon dossier, qu'on clique une ou trois fois.
  const preparerDossier = async () => {
    setErreurDossier("");
    try {
      const dossier = await creerCandidature(slug).unwrap();
      navigate(`/candidatures/${dossier._id}`);
    } catch (err) {
      setErreurDossier(
        messageErreur(err, "Impossible de préparer le dossier pour le moment."),
      );
    }
  };

  // L'aperçu est public : il se charge pour tout le monde, y compris les
  // moteurs de recherche et les visiteurs sans compte.
  const {
    data: apercu,
    isLoading,
    isError,
    error,
  } = useGetAvpApercuQuery(slug);

  // La fiche complète n'est demandée que si un compte est présent : sans
  // `skip`, chaque visiteur déclencherait une 401 — et la purge de session
  // d'apiSlice avec elle.
  const { data: complet } = useGetAvpCompletQuery(slug, { skip: !userInfo });

  if (isLoading) return <p className="conteneur fiche" role="status">Chargement…</p>;

  if (isError) {
    return (
      <div className="conteneur fiche">
        <div className="message message-erreur" role="alert">
          {messageErreur(error, "Cette offre est introuvable.")}
        </div>
        <Link to="/offres" className="btn btn-secondaire">
          Retour aux offres
        </Link>
      </div>
    );
  }

  return (
    <div className="conteneur fiche">
      <p className="fiche-fil">
        <Link to="/offres">← Toutes les offres</Link>
      </p>

      {/* Rappel en tête de fiche. On arrive ici depuis une carte déjà barrée
          de rouge : le redire avant le titre évite qu'après quelques
          paragraphes on ait oublié pourquoi on est là. */}
      {!apercu.ouverte && (
        <div className="bandeau-cloture" role="note">
          <span className="bandeau-cloture-mot">Clôturée</span>
          <p>
            Les candidatures pour ce poste ne sont plus acceptées depuis le{" "}
            <time dateTime={dateIso(apercu.dateLimite)}>
              {formaterDate(apercu.dateLimite)}
            </time>
            . La fiche reste consultable à titre d'information.
          </p>
        </div>
      )}

      <header className="fiche-entete">
        <h1>{apercu.intitule}</h1>

        {/* Set : dans la donnée source, le service porte souvent le même nom
            que la direction (« DIRECTION GENERALE · DIRECTION GENERALE »).
            On dédoublonne sans casse ni espaces parasites plutôt que de
            choisir arbitrairement l'un des deux champs. */}
        <p className="fiche-meta">
          {[
            ...new Map(
              [
                apercu.direction,
                apercu.service,
                apercu.lieu,
                libelleContrat(apercu.typeContrat),
              ]
                .filter(Boolean)
                .map((v) => [v.trim().toLowerCase(), v.trim()]),
            ).values(),
          ].join(" · ")}
        </p>

        <div className="fiche-etats">
          {!apercu.ouverte && <span className="offre-badge">Clôturée</span>}
          {apercu.nbPostes > 1 && (
            <span className="fiche-puce">{apercu.nbPostes} postes à pourvoir</span>
          )}
          {apercu.familles?.map((f) => (
            <span key={f} className="fiche-puce fiche-puce--famille">
              {f}
            </span>
          ))}
        </div>

        <dl className="fiche-dates">
          {apercu.datePubliee && (
            <div>
              <dt>Publiée le</dt>
              <dd>
                <time dateTime={dateIso(apercu.datePubliee)}>
                  {formaterDate(apercu.datePubliee)}
                </time>
              </dd>
            </div>
          )}
          {apercu.dateLimite && (
            <div>
              <dt>Date limite</dt>
              <dd>
                <time dateTime={dateIso(apercu.dateLimite)}>
                  {formaterDate(apercu.dateLimite)}
                </time>{" "}
                <span className="fiche-echeance">— {echeance(apercu.dateLimite)}</span>
              </dd>
            </div>
          )}
          {apercu.metier?.nom && (
            <div>
              <dt>Métier de rattachement</dt>
              <dd>
                {apercu.metier.ficheUrl ? (
                  <a
                    href={apercu.metier.ficheUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    {apercu.metier.nom}
                  </a>
                ) : (
                  apercu.metier.nom
                )}
              </dd>
            </div>
          )}
        </dl>
      </header>

      {/* ── Extrait public, visible par tout le monde ─────────────────── */}
      <section className="fiche-bloc">
        <h2>Le poste</h2>
        <p>{complet ? complet.description : apercu.extrait}</p>
      </section>

      {complet ? (
        /* ── Contenu réservé aux comptes connectés ────────────────────── */
        <>
          <Bloc titre="Missions" items={complet.missions} />
          <Bloc
            titre="Compétences attendues"
            items={complet.competencesAttendues}
          />
          <Bloc titre="Savoir-faire" items={complet.savoirFaire} />

          {(complet.experienceRequise ||
            complet.qualifications ||
            complet.contraintePhysique) && (
            <section className="fiche-bloc">
              <h2>Conditions</h2>
              <dl className="fiche-conditions">
                {complet.experienceRequise && (
                  <div>
                    <dt>Expérience</dt>
                    <dd>{complet.experienceRequise}</dd>
                  </div>
                )}
                {complet.qualifications && (
                  <div>
                    <dt>Habilitations</dt>
                    <dd>{complet.qualifications}</dd>
                  </div>
                )}
                {complet.contraintePhysique && (
                  <div>
                    <dt>Conditions physiques</dt>
                    <dd>{complet.contraintePhysique}</dd>
                  </div>
                )}
              </dl>

              {/* Signal explicite présent dans la donnée source. Le mettre en
                  avant, c'est éviter qu'un profil sans diplôme s'auto-écarte
                  d'un poste qui lui est ouvert. */}
              {complet.experienceRemplaceDiplome && (
                <p className="fiche-encart">
                  Pour ce poste, l'expérience professionnelle peut remplacer le
                  diplôme exigé.
                </p>
              )}
            </section>
          )}

          {/* Le pas suivant, à l'endroit où on vient de lire le poste.
              Sur une offre clôturée, proposer de préparer un dossier serait
              envoyer quelqu'un travailler pour rien : on le dit, et on le
              renvoie vers ce qui est réellement ouvert. */}
          {apercu.ouverte ? (
            <section className="fiche-suite">
              <h2>Ce poste vous intéresse ?</h2>
              <p>
                Préparez votre dossier : lettre, CV recentré, analyse de vos
                écarts et préparation à l'entretien, à partir de votre profil.
              </p>

              {erreurDossier && (
                <div className="message message-erreur" role="alert">
                  {erreurDossier}
                </div>
              )}

              <button
                type="button"
                className="btn btn-principal"
                onClick={preparerDossier}
                disabled={creation}
              >
                {creation ? "Préparation…" : "Préparer ma candidature"}
              </button>
            </section>
          ) : (
            <section className="fiche-suite fiche-suite--close">
              <h2>Les candidatures sont closes</h2>
              <p>
                La date limite était le{" "}
                <time dateTime={dateIso(apercu.dateLimite)}>
                  {formaterDate(apercu.dateLimite)}
                </time>
                . Cette fiche reste consultable à titre d'information : elle
                indique ce que l'OPT-NC recherche sur ce métier, et les
                compétences qui y sont attendues.
              </p>
              <Link to="/offres" className="btn btn-principal">
                Voir les postes encore ouverts
              </Link>
            </section>
          )}

          <p className="fiche-source">
            Fiche source au format schema.org :{" "}
            <a
              href={`/api/avps/${slug}/jobposting`}
              target="_blank"
              rel="noreferrer noopener"
            >
              JobPosting (JSON-LD)
            </a>
          </p>
        </>
      ) : (
        /* ── Le mur ───────────────────────────────────────────────────── */
        <section className="mur" aria-labelledby="titre-mur">
          <h2 id="titre-mur">Voir la fiche complète</h2>
          <p>
            Missions détaillées, compétences attendues, conditions d'accès :
            la suite est réservée aux comptes. Créer le vôtre prend quelques
            secondes — et permet surtout de savoir{" "}
            <strong>si ce poste vous correspond</strong> et de préparer votre
            candidature.
          </p>

          <ul className="mur-liste">
            <li>Les missions et les compétences attendues, en entier</li>
            <li>Votre score de correspondance, avec ce qui le justifie</li>
            <li>Une lettre et un CV recentrés sur ce poste</li>
            <li>Vos écarts face aux attendus, et comment les aborder</li>
          </ul>

          <div className="mur-actions">
            {/* On transmet la page courante : après connexion ou inscription,
                la personne revient sur CETTE offre, pas sur un accueil
                générique. C'est la différence entre un mur et une impasse. */}
            <Link
              to="/inscription"
              state={{ from: location }}
              className="btn btn-principal"
            >
              Créer un compte
            </Link>
            <Link
              to="/login"
              state={{ from: location }}
              className="btn btn-secondaire"
            >
              J'ai déjà un compte
            </Link>
          </div>
        </section>
      )}
    </div>
  );
};

export default OffreDetailScreen;
