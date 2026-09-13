// src/screens/CandidatureDetailScreen/CandidatureDetailScreen.jsx
import { useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  useGetCandidatureQuery,
  useGenererPieceMutation,
  useModifierPieceMutation,
  useChangerStatutMutation,
  useEnvoyerCandidatureMutation,
  useSupprimerCandidatureMutation,
  urlPiecePdf,
  urlDossierZip,
  urlJsonResume,
} from "../../slices/candidatureApiSlice";
import { PIECES, STATUTS, statut as libelleStatut } from "../../constants";
import { formaterDate, dateIso } from "../../utils/format";
import { messageErreur } from "../../utils/erreurApi";
import MentionIA from "../../components/Global/MentionIA";
import "./CandidatureDetailScreen.css";

// Statuts à partir desquels le dossier est effectivement parti chez
// l'employeur. En deçà, afficher une date d'envoi n'aurait pas de sens.
const TRANSMISE = ["envoyee", "entretien", "acceptee", "refusee", "sans_reponse"];

// Une pièce du dossier : on la produit, on la relit, on la réécrit.
const Piece = ({ definition, piece, urlPdf, onGenerer, onEnregistrer, occupe }) => {
  const [edition, setEdition] = useState(false);
  const [texte, setTexte] = useState(piece?.contenu || "");

  const existe = Boolean(piece?.contenu);

  const commencerEdition = () => {
    setTexte(piece?.contenu || "");
    setEdition(true);
  };

  const valider = async () => {
    await onEnregistrer(texte);
    setEdition(false);
  };

  return (
    <section className="piece" aria-labelledby={`piece-${definition.cle}`}>
      <div className="piece-entete">
        <div>
          <h3 id={`piece-${definition.cle}`}>{definition.libelle}</h3>
          <p className="piece-aide">{definition.aide}</p>
        </div>
        <span
          className={`pastille pastille--${definition.pour === "employeur" ? "envoyee" : ""}`}
        >
          {definition.pour === "employeur" ? "Part chez l'employeur" : "Reste chez vous"}
        </span>
      </div>

      {!existe && !edition && (
        <p className="piece-vide">Pas encore produite.</p>
      )}

      {existe && !edition && (
        <>
          {/* Rappel au plus près du texte : quelqu'un qui copie le contenu
              depuis cet encadré n'a pas forcément lu le bandeau du haut. */}
          {piece.source === "ia" && (
            <MentionIA variante="ligne" modele={piece.modele} />
          )}
          <pre className="piece-contenu">{piece.contenu}</pre>
          <p className="piece-origine">
            {piece.source === "manuel"
              ? "Réécrite par vous"
              : piece.source === "ia"
                ? `Rédigée automatiquement${piece.modele ? ` (${piece.modele})` : ""}`
                : "Brouillon assemblé depuis votre profil"}
            {piece.modifieLe
              ? ` · modifiée le ${formaterDate(piece.modifieLe)}`
              : piece.genereLe
                ? ` · produite le ${formaterDate(piece.genereLe)}`
                : ""}
          </p>

          {/* Relecture par un « recruteur ». Montrée au candidat : une note et
              des reproches explicites valent mieux qu'un texte sorti d'une
              boîte noire — il sait sur quoi porter son attention. */}
          {piece.critique?.note != null && (
            <details className="piece-critique">
              <summary>
                Relu comme un recruteur :{" "}
                <strong>{piece.critique.note}/10</strong>
                {piece.critique.reecrite && " · réécrit pour en tenir compte"}
              </summary>

              {piece.critique.verdict && (
                <p className="critique-verdict">{piece.critique.verdict}</p>
              )}

              {piece.critique.inventions?.length > 0 && (
                <>
                  <p className="critique-titre critique-titre--alerte">
                    Affirmations absentes de votre profil, supprimées :
                  </p>
                  <ul>
                    {piece.critique.inventions.map((i, n) => (
                      <li key={n}>{i}</li>
                    ))}
                  </ul>
                </>
              )}

              {piece.critique.problemes?.length > 0 && (
                <>
                  <p className="critique-titre">Ce qui a été reproché :</p>
                  <ul>
                    {piece.critique.problemes.map((p, n) => (
                      <li key={n}>{p}</li>
                    ))}
                  </ul>
                </>
              )}
            </details>
          )}
        </>
      )}

      {edition && (
        <div className="champ">
          <label htmlFor={`edit-${definition.cle}`} className="sr-only">
            Contenu de « {definition.libelle} »
          </label>
          <textarea
            id={`edit-${definition.cle}`}
            rows={16}
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
          />
        </div>
      )}

      <div className="actions piece-actions">
        {edition ? (
          <>
            <button
              type="button"
              className="btn btn-principal btn-compact"
              onClick={valider}
              disabled={occupe}
            >
              Enregistrer
            </button>
            <button
              type="button"
              className="btn btn-secondaire btn-compact"
              onClick={() => setEdition(false)}
            >
              Annuler
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="btn btn-principal btn-compact"
              onClick={onGenerer}
              disabled={occupe}
            >
              {existe ? "Reproduire" : "Produire"}
              <span className="sr-only"> {definition.libelle}</span>
            </button>
            {existe && (
              <button
                type="button"
                className="btn btn-secondaire btn-compact"
                onClick={commencerEdition}
              >
                Réécrire
                <span className="sr-only"> {definition.libelle}</span>
              </button>
            )}
            {/* Un lien, pas un bouton : c'est une navigation vers un fichier.
                Le navigateur sait télécharger, le clic milieu et « ouvrir dans
                un nouvel onglet » fonctionnent, et le lecteur d'écran annonce
                correctement la nature de l'action. */}
            {existe && (
              <a
                className="btn btn-secondaire btn-compact"
                href={urlPdf}
                download
              >
                PDF
                <span className="sr-only"> de {definition.libelle}</span>
              </a>
            )}
          </>
        )}
      </div>
    </section>
  );
};

const CandidatureDetailScreen = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [erreur, setErreur] = useState("");
  const [confirmation, setConfirmation] = useState(false);

  const { data: candidature, isLoading, isError, error } = useGetCandidatureQuery(id);
  const [generer, { isLoading: production }] = useGenererPieceMutation();
  const [modifier, { isLoading: enregistrement }] = useModifierPieceMutation();
  const [changerStatut] = useChangerStatutMutation();
  const [envoyer, { isLoading: envoiEnCours }] = useEnvoyerCandidatureMutation();
  const [supprimer] = useSupprimerCandidatureMutation();
  const [confirmationEnvoi, setConfirmationEnvoi] = useState(false);
  const [resultatEnvoi, setResultatEnvoi] = useState(null);

  const executer = async (action) => {
    setErreur("");
    try {
      return await action().unwrap();
    } catch (err) {
      setErreur(messageErreur(err, "L'opération a échoué."));
    }
  };

  if (isLoading) {
    return (
      <div className="conteneur dossier-detail">
        <p role="status">Chargement du dossier…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="conteneur dossier-detail">
        <div className="message message-erreur" role="alert">
          {messageErreur(error, "Ce dossier est introuvable.")}
        </div>
        <Link to="/candidatures" className="btn btn-secondaire">
          Retour à mes candidatures
        </Link>
      </div>
    );
  }

  const st = libelleStatut(candidature.statut);
  const occupe = production || enregistrement;

  return (
    <div className="conteneur dossier-detail">
      <p className="detail-fil">
        <Link to="/candidatures">← Mes candidatures</Link>
      </p>

      <header className="detail-entete">
        <h1>{candidature.avpIntitule}</h1>
        {candidature.avpDirection && (
          <p className="detail-meta">{candidature.avpDirection}</p>
        )}
        <p className="detail-liens">
          <Link to={`/offres/${candidature.avpSlug}`}>Revoir la fiche de poste</Link>
        </p>
      </header>

      {erreur && (
        <div className="message message-erreur" role="alert">
          {erreur}
        </div>
      )}

      {/* ── Statut ───────────────────────────────────────────────────── */}
      <section className="carte detail-statut" aria-labelledby="titre-statut">
        <h2 id="titre-statut">Où en est ce dossier</h2>

        <div className="champ">
          <label htmlFor="statut">Statut</label>
          <select
            id="statut"
            value={candidature.statut}
            onChange={(e) =>
              executer(() => changerStatut({ id, statut: e.target.value }))
            }
          >
            {STATUTS.map((s) => (
              <option key={s.valeur} value={s.valeur}>
                {s.libelle}
              </option>
            ))}
          </select>
          <span className="champ-aide">{st.aide}</span>
        </div>

        {/* La date d'envoi n'est affichée que si le statut courant est
            cohérent avec elle. Elle est conservée en base une fois posée —
            mais quelqu'un qui repasse son dossier en « brouillon » pour le
            retravailler lisait « Brouillon » et « Envoyée le 12 septembre »
            sur le même écran. L'historique, lui, garde la trace complète. */}
        {candidature.envoyeeLe && TRANSMISE.includes(candidature.statut) && (
          <p className="detail-envoi">
            Envoyée le{" "}
            <time dateTime={dateIso(candidature.envoyeeLe)}>
              {formaterDate(candidature.envoyeeLe)}
            </time>
          </p>
        )}

        {candidature.historique?.length > 1 && (
          <details className="detail-historique">
            <summary>Historique ({candidature.historique.length} étapes)</summary>
            <ol>
              {candidature.historique.map((h, i) => (
                <li key={i}>
                  <strong>{libelleStatut(h.statut).libelle}</strong>
                  {" — "}
                  <time dateTime={dateIso(h.date)}>{formaterDate(h.date)}</time>
                  {h.note && <span className="historique-note"> · {h.note}</span>}
                </li>
              ))}
            </ol>
          </details>
        )}
      </section>

      {/* ── Les pièces ───────────────────────────────────────────────── */}
      <h2 className="detail-titre-section">Les pièces du dossier</h2>

      {candidature.redaction?.assistee ? (
        <MentionIA modele={candidature.redaction.modele} />
      ) : (
        <p className="detail-avertissement">
          La rédaction assistée est indisponible. Chaque pièce est un brouillon
          assemblé à partir de votre profil et de la fiche de poste — à relire
          et à réécrire entièrement avant tout envoi.
        </p>
      )}

      {PIECES.map((definition) => (
        <Piece
          key={definition.cle}
          definition={definition}
          piece={candidature.pieces?.[definition.cle]}
          urlPdf={urlPiecePdf(id, definition.cle)}
          occupe={occupe}
          onGenerer={() => executer(() => generer({ id, piece: definition.cle }))}
          onEnregistrer={(contenu) =>
            executer(() => modifier({ id, piece: definition.cle, contenu }))
          }
        />
      ))}

      {/* ── Transmettre ──────────────────────────────────────────────── */}
      <section className="carte detail-transmission" aria-labelledby="titre-transmission">
        <h2 id="titre-transmission">Transmettre votre candidature</h2>

        <p className="transmission-intro">
          Seules la <strong>lettre</strong> et le <strong>CV</strong> partent chez
          l'employeur. L'analyse de votre candidature et la préparation à
          l'entretien restent chez vous : elles sont faites pour vous préparer,
          pas pour être lues par un recruteur.
        </p>

        <div className="actions transmission-actions">
          <a className="btn btn-secondaire" href={urlDossierZip(id)} download>
            Télécharger le dossier complet (ZIP)
          </a>
          <a className="btn btn-secondaire" href={urlJsonResume(id)} download>
            Exporter mon profil (JSON Resume)
          </a>
        </div>

        <p className="transmission-aide">
          L'archive contient les quatre pièces en PDF, rangées en deux dossiers,
          et votre profil au format ouvert{" "}
          <a
            href="https://jsonresume.org/"
            target="_blank"
            rel="noopener noreferrer"
          >
            JSON&nbsp;Resume
          </a>{" "}
          — réutilisable ailleurs, il vous appartient.
        </p>

        <hr className="transmission-separateur" />

        {/* L'état de l'envoi est annoncé AVANT le clic : destination, mode
            simulé, pièces manquantes. Un bouton qui échoue après coup laisse
            croire à une panne, alors qu'il manque simplement une lettre. */}
        {candidature.envoi?.manquantes?.length > 0 && (
          <p className="message message-info" role="status">
            Produisez d'abord{" "}
            {candidature.envoi.manquantes
              .map((c) => PIECES.find((p) => p.cle === c)?.libelle || c)
              .join(" et ")}{" "}
            : ce sont les pièces que l'employeur reçoit.
          </p>
        )}

        {!candidature.envoi?.possible && (
          <p className="message message-info" role="status">
            {candidature.envoi?.motif}
          </p>
        )}

        {candidature.envoi?.possible && (
          <>
            {candidature.envoi.simule && (
              <p className="message message-avertissement" role="status">
                <strong>Envoi simulé.</strong> Aucun serveur d'envoi n'est
                configuré : le message et ses pièces jointes seront écrits dans
                la console du serveur, pas expédiés. La chaîne complète est
                néanmoins exécutée — les PDF sont bien produits.
              </p>
            )}

            <p className="transmission-destination">
              Destination :{" "}
              <strong>{candidature.envoi.destinataire}</strong>
              <span className="transmission-garde">
                Adresse de test imposée par la configuration. L'adresse de
                recrutement figurant dans l'offre n'est jamais utilisée — les
                domaines {candidature.envoi.domainesInterdits?.join(", ")} sont
                refusés par le serveur.
              </span>
            </p>

            {confirmationEnvoi ? (
              <div className="actions">
                <button
                  type="button"
                  className="btn btn-principal"
                  disabled={
                    envoiEnCours || candidature.envoi.manquantes?.length > 0
                  }
                  onClick={async () => {
                    const reponse = await executer(() => envoyer(id));
                    setConfirmationEnvoi(false);
                    if (reponse) setResultatEnvoi(reponse.envoi);
                  }}
                >
                  {envoiEnCours ? "Envoi en cours…" : "Confirmer l'envoi"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondaire"
                  onClick={() => setConfirmationEnvoi(false)}
                >
                  Annuler
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn-principal"
                disabled={candidature.envoi.manquantes?.length > 0}
                onClick={() => setConfirmationEnvoi(true)}
              >
                Envoyer ma candidature
              </button>
            )}
          </>
        )}

        {/* `aria-live` : le résultat arrive après un appel réseau. Sans lui, un
            lecteur d'écran ne signale rien et la personne ne sait pas si son
            dossier est parti. */}
        <div aria-live="polite">
          {resultatEnvoi && (
            <p className="message message-succes">
              {resultatEnvoi.simule
                ? `Chaîne d'envoi exécutée (mode simulé) vers ${resultatEnvoi.destinataire} : ${resultatEnvoi.pieces.join(" et ")}. Rien n'a réellement été expédié.`
                : `Candidature transmise à ${resultatEnvoi.destinataire} : ${resultatEnvoi.pieces.join(" et ")}.`}
            </p>
          )}
        </div>

        {candidature.envois?.length > 0 && (
          <details className="transmission-journal">
            <summary>
              Transmissions ({candidature.envois.length})
            </summary>
            <ol>
              {candidature.envois.map((e, i) => (
                <li key={i}>
                  <time dateTime={dateIso(e.date)}>{formaterDate(e.date)}</time>
                  {" — "}
                  {e.destinataire}
                  {e.simule && " (simulé)"}
                  {e.pieces?.length > 0 && ` · ${e.pieces.join(", ")}`}
                </li>
              ))}
            </ol>
          </details>
        )}
      </section>

      {/* ── Suppression ──────────────────────────────────────────────── */}
      <section className="carte detail-danger">
        <h2>Supprimer ce dossier</h2>
        {confirmation ? (
          <>
            <p>
              Les quatre pièces seront perdues. L'offre, elle, reste consultable.
            </p>
            <div className="actions">
              <button
                type="button"
                className="btn btn-danger btn-compact"
                onClick={async () => {
                  const ok = await executer(() => supprimer(id));
                  if (ok) navigate("/candidatures");
                }}
              >
                Oui, supprimer
              </button>
              <button
                type="button"
                className="btn btn-secondaire btn-compact"
                onClick={() => setConfirmation(false)}
              >
                Annuler
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            className="btn btn-secondaire btn-compact"
            onClick={() => setConfirmation(true)}
          >
            Supprimer ce dossier
          </button>
        )}
      </section>
    </div>
  );
};

export default CandidatureDetailScreen;
