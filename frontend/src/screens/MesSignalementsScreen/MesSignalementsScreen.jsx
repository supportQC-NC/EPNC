// src/screens/MesSignalementsScreen/MesSignalementsScreen.jsx
//
// Les dossiers de modération qui me concernent.
//
// ══════════════════════════════════════════════════════════════════════════
//  DEUX VUES TRÈS DIFFÉRENTES, ET C'EST VOULU
// ══════════════════════════════════════════════════════════════════════════
//   « Ce que j'ai signalé » — je vois le verdict et son motif, jamais les
//   mesures prises. Assez pour savoir que mon signalement a servi, pas assez
//   pour en faire un moyen de pression.
//
//   « Ce qui a été signalé sur moi » — je vois ce qui m'est reproché et ce qui
//   a été décidé, mais PAS qui a signalé. Cacher à quelqu'un ce qu'on lui
//   reproche rendrait tout recours impossible ; lui dire qui l'a signalé
//   l'exposerait à des représailles.
//
// Dans les deux cas, un recours est possible. Une décision sans recours n'est
// pas une décision, c'est une sanction.
import { useState } from "react";
import {
  useGetMesSignalementsQuery,
  useFaireAppelMutation,
} from "../../slices/moderationApiSlice";
import { messageErreur } from "../../utils/erreurApi";
import { formaterDate, dateIso } from "../../utils/format";
import "./MesSignalementsScreen.css";

const Recours = ({ dossier, onEnvoye }) => {
  const [faireAppel, { isLoading }] = useFaireAppelMutation();
  const [ouvert, setOuvert] = useState(false);
  const [message, setMessage] = useState("");
  const [erreur, setErreur] = useState("");

  if (dossier.reponseRecours) {
    return (
      <div className="dossier-reponse">
        <p>
          <strong>Réponse à votre recours</strong> — {dossier.reponseRecours}
        </p>
      </div>
    );
  }

  if (dossier.recoursDepose) {
    return (
      <p className="dossier-attente">
        Votre recours a été enregistré. Le dossier est rouvert et sera
        réexaminé.
      </p>
    );
  }

  if (!dossier.recoursPossible) return null;

  if (!ouvert) {
    return (
      <button
        type="button"
        className="btn btn-secondaire btn-compact"
        onClick={() => setOuvert(true)}
      >
        Contester cette décision
      </button>
    );
  }

  return (
    <form
      className="dossier-recours"
      onSubmit={async (e) => {
        e.preventDefault();
        setErreur("");
        try {
          await faireAppel({ id: dossier._id, message }).unwrap();
          setOuvert(false);
          onEnvoye?.();
        } catch (err) {
          setErreur(messageErreur(err, "Le recours n'a pas pu être déposé."));
        }
      }}
    >
      <div className="champ">
        <label htmlFor={`recours-${dossier._id}`}>
          Ce qui vous paraît inexact
        </label>
        <textarea
          id={`recours-${dossier._id}`}
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          placeholder="Les faits, tels que vous les connaissez."
        />
      </div>

      {erreur && (
        <div className="message message-erreur" role="alert">
          {erreur}
        </div>
      )}

      <div className="actions">
        <button
          type="submit"
          className="btn btn-principal btn-compact"
          disabled={isLoading || !message.trim()}
        >
          {isLoading ? "Envoi…" : "Déposer le recours"}
        </button>
        <button
          type="button"
          className="btn btn-secondaire btn-compact"
          onClick={() => setOuvert(false)}
        >
          Annuler
        </button>
      </div>
    </form>
  );
};

const MesSignalementsScreen = () => {
  const { data, isLoading, isError, error } = useGetMesSignalementsQuery();

  if (isLoading) {
    return (
      <div className="conteneur mes-signalements">
        <p role="status">Chargement…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="conteneur mes-signalements">
        <div className="message message-erreur" role="alert">
          {messageErreur(error, "Impossible de charger vos dossiers.")}
        </div>
      </div>
    );
  }

  const { monCompte, deposes, recus } = data;
  const sousAvertissement = monCompte.avertissements.length > 0;

  return (
    <div className="conteneur mes-signalements">
      <header className="mes-signalements-entete">
        <h1>Modération</h1>
        <p className="mes-signalements-intro">
          Les dossiers qui vous concernent : ceux que vous avez ouverts, et
          ceux qui portent sur votre compte.
        </p>
      </header>

      {/* ── L'état de mon compte, en premier ────────────────────────── */}
      {sousAvertissement && (
        <section
          className="carte compte-alerte"
          aria-labelledby="titre-mon-compte"
        >
          <h2 id="titre-mon-compte">
            {monCompte.masqueLe
              ? "Votre profil n'est plus visible"
              : `${monCompte.avertissements.length} avertissement${monCompte.avertissements.length > 1 ? "s" : ""} sur votre compte`}
          </h2>

          {monCompte.regulariserAvant && (
            <p className="compte-echeance">
              Vous avez jusqu'au{" "}
              <strong>
                <time dateTime={dateIso(monCompte.regulariserAvant)}>
                  {formaterDate(monCompte.regulariserAvant)}
                </time>
              </strong>{" "}
              pour nous contacter et régulariser votre situation. Passé ce
              délai, votre compte sera supprimé — vous pourrez alors en recréer
              un avec la même adresse email, sur un dossier vierge.
            </p>
          )}

          <ul className="compte-avertissements">
            {monCompte.avertissements.map((a, i) => (
              <li key={i}>
                <time dateTime={dateIso(a.date)}>{formaterDate(a.date)}</time>
                {" — "}
                {a.motif}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Ce qui a été signalé sur moi ────────────────────────────── */}
      {recus.length > 0 && (
        <section aria-labelledby="titre-recus">
          <h2 id="titre-recus">Ce qui a été signalé sur votre compte</h2>
          <p className="mes-signalements-intro">
            Vous ne verrez pas qui a signalé : le dire exposerait cette
            personne. Vous voyez en revanche tout ce qui vous est reproché, et
            vous pouvez contester.
          </p>

          <ul className="dossiers">
            {recus.map((d) => (
              <li key={d._id} className="dossier-perso">
                <p className="dossier-perso-entete">
                  <strong>{d.motif}</strong>
                  <span className={`pastille ${d.fonde ? "pastille--ko" : "pastille--ok"}`}>
                    {d.fonde ? "Retenu" : "Non retenu"}
                  </span>
                </p>
                <p className="dossier-perso-date">
                  <time dateTime={dateIso(d.date)}>{formaterDate(d.date)}</time>
                </p>
                {d.decision && <p className="dossier-perso-decision">{d.decision}</p>}
                <Recours dossier={d} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Ce que j'ai signalé ─────────────────────────────────────── */}
      <section aria-labelledby="titre-deposes">
        <h2 id="titre-deposes">Ce que vous avez signalé</h2>

        {deposes.length === 0 ? (
          <p className="mes-signalements-vide">
            Vous n'avez signalé aucun compte.
          </p>
        ) : (
          <ul className="dossiers">
            {deposes.map((d) => (
              <li key={d._id} className="dossier-perso">
                <p className="dossier-perso-entete">
                  <strong>{d.nom}</strong>
                  <span className="pastille">{d.verdict}</span>
                </p>
                <p className="dossier-perso-date">
                  {d.motif} ·{" "}
                  <time dateTime={dateIso(d.date)}>{formaterDate(d.date)}</time>
                </p>

                {d.clos ? (
                  <>
                    <p className="dossier-perso-decision">{d.decision}</p>
                    {/* On ne dit pas ce qui a été décidé sur la personne : la
                        phrase le dit explicitement plutôt que de laisser
                        imaginer que rien n'a été fait. */}
                    {d.verdict === "retenu" && (
                      <p className="dossier-perso-note">
                        Les mesures prises ne vous sont pas communiquées : elles
                        ne regardent que la personne concernée et
                        l'administration.
                      </p>
                    )}
                    <Recours dossier={d} />
                  </>
                ) : (
                  <p className="dossier-perso-note">
                    Le dossier est en cours d'examen. Vous recevrez un courriel
                    lorsqu'une décision sera prise.
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default MesSignalementsScreen;
