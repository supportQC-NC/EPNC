// src/screens/admin/AdminModerationScreen.jsx
//
// Instruction des signalements.
//
// ══════════════════════════════════════════════════════════════════════════
//  UN DOSSIER, PAS UN COMPTEUR
// ══════════════════════════════════════════════════════════════════════════
// L'écran ne montre pas « 3 signalements » à côté d'un nom avec un bouton
// « bannir ». Il montre QUI signale, QUOI, avec quel motif écrit, et le
// DOSSIER de la personne — premier écart ou troisième, ce n'est pas la même
// décision.
//
// La décision rédigée est obligatoire, et ce n'est pas une formalité : ce
// texte est exactement celui que recevront la personne signalée et le
// signalant. Écrire un motif pour le dossier et un autre pour les intéressés
// serait le meilleur moyen de ne plus savoir ce qui leur a été dit.
import { useState } from "react";
import {
  useGetSignalementsQuery,
  useInstruireSignalementMutation,
  useContacterPartieMutation,
  useGetEcheancesQuery,
  useAppliquerEcheancesMutation,
} from "../../slices/moderationApiSlice";
import { messageErreur } from "../../utils/erreurApi";
import { formaterDate, dateIso } from "../../utils/format";
import { libelleRole } from "../../constants";
import "./admin.css";

const ONGLETS = [
  { valeur: "nouveau", libelle: "À examiner" },
  { valeur: "en_cours", libelle: "En cours" },
  { valeur: "traite", libelle: "Traités" },
  { valeur: "rejete", libelle: "Rejetés" },
  { valeur: "", libelle: "Tous" },
];

// Écrire à l'une des parties sans quitter le dossier.
//
// Instruire demande souvent de poser une question avant de décider. Sans ce
// bloc, l'administrateur sort de l'outil pour écrire depuis sa messagerie, et
// l'échange disparaît du dossier — c'est-à-dire au moment où il compte.
const Contact = ({ signalementId, cibleExiste }) => {
  const [contacter, { isLoading }] = useContacterPartieMutation();
  const [ouvert, setOuvert] = useState(false);
  const [vers, setVers] = useState("cible");
  const [objet, setObjet] = useState("");
  const [message, setMessage] = useState("");
  const [retour, setRetour] = useState("");

  const envoyer = async (e) => {
    e.preventDefault();
    try {
      const r = await contacter({ id: signalementId, vers, objet, message }).unwrap();
      setRetour(r.message);
      setObjet("");
      setMessage("");
      setOuvert(false);
    } catch (err) {
      setRetour(messageErreur(err, "Le message n'a pas pu être envoyé."));
    }
  };

  if (!ouvert) {
    return (
      <>
        <button
          type="button"
          className="btn btn-secondaire btn-compact"
          onClick={() => setOuvert(true)}
        >
          Écrire à une des parties
        </button>
        <div aria-live="polite">
          {retour && <p className="dossier-retour">{retour}</p>}
        </div>
      </>
    );
  }

  return (
    <form className="dossier-formulaire" onSubmit={envoyer}>
      <div className="champ">
        <label htmlFor={`vers-${signalementId}`}>Destinataire</label>
        <select
          id={`vers-${signalementId}`}
          value={vers}
          onChange={(e) => setVers(e.target.value)}
        >
          <option value="cible" disabled={!cibleExiste}>
            La personne signalée{!cibleExiste && " (compte supprimé)"}
          </option>
          <option value="signalant">La personne qui a signalé</option>
        </select>
      </div>

      <div className="champ">
        <label htmlFor={`objet-${signalementId}`}>Objet</label>
        <input
          id={`objet-${signalementId}`}
          value={objet}
          onChange={(e) => setObjet(e.target.value)}
          required
          placeholder="Demande de précision sur votre profil"
        />
      </div>

      <div className="champ">
        <label htmlFor={`message-${signalementId}`}>Message</label>
        <textarea
          id={`message-${signalementId}`}
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
        />
      </div>

      <div className="actions">
        <button
          type="submit"
          className="btn btn-principal btn-compact"
          disabled={isLoading || !objet.trim() || !message.trim()}
        >
          {isLoading ? "Envoi…" : "Envoyer"}
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

const Dossier = ({ s, mesures, onInstruire, erreur }) => {
  const [ouvert, setOuvert] = useState(false);
  const [decision, setDecision] = useState(s.decision || "");
  const [choisies, setChoisies] = useState([]);
  const [statut, setStatut] = useState("traite");

  const basculer = (cle) =>
    setChoisies((c) =>
      c.includes(cle) ? c.filter((x) => x !== cle) : [...c, cle],
    );

  const clos = ["traite", "rejete"].includes(s.statut);

  // Les mesures proposées dépendent de l'état réel du compte : proposer
  // « désactiver » un compte déjà désactivé, ou « retirer du vivier » un profil
  // qui n'y est pas, fait douter de ce que l'écran sait vraiment.
  const disponibles = Object.entries(mesures).filter(([cle]) => {
    if (cle === "aucune") return true;
    if (!s.cible.existe) return false;
    if (cle === "masquer_profil") return s.cible.visibleRecruteurs;
    if (cle === "desactiver_compte") return s.cible.isActive;
    if (cle === "reactiver_compte") return s.cible.isActive === false;
    return true;
  });

  return (
    <article className={`dossier dossier--${s.statut}`}>
      <div className="dossier-entete">
        <div>
          <h3 className="dossier-cible">
            {s.cible.nom}
            <span className="dossier-role">{libelleRole(s.cible.role)}</span>
            {!s.cible.existe && (
              <span className="pastille pastille--ko">Compte supprimé</span>
            )}
            {s.cible.isActive === false && (
              <span className="pastille pastille--ko">Désactivé</span>
            )}
          </h3>
          <p className="dossier-meta">{s.cible.email}</p>
        </div>

        <span className={`pastille dossier-statut dossier-statut--${s.statut}`}>
          {ONGLETS.find((o) => o.valeur === s.statut)?.libelle || s.statut}
        </span>
      </div>

      <dl className="dossier-corps">
        <div>
          <dt>Motif</dt>
          <dd>{s.motifLibelle}</dd>
        </div>
        <div>
          <dt>Signalé par</dt>
          <dd>
            {s.signalePar.nom}
            {s.signalePar.role && ` (${libelleRole(s.signalePar.role)})`}
            {" · "}
            <time dateTime={dateIso(s.createdAt)}>{formaterDate(s.createdAt)}</time>
          </dd>
        </div>
        {s.details && (
          <div className="dossier-details">
            <dt>Ce qui est reproché</dt>
            <dd>{s.details}</dd>
          </div>
        )}

        {/* Le dossier disciplinaire de la personne : un administrateur qui
            instruit doit savoir si c'est un premier écart ou le troisième.
            Sans cela, la même décision est prise dans les deux cas. */}
        {s.avertissements && (
          <div>
            <dt>Dossier de la personne</dt>
            <dd>
              {s.avertissements.actifs} avertissement
              {s.avertissements.actifs > 1 ? "s" : ""} en cours
              {s.avertissements.total > s.avertissements.actifs &&
                ` (${s.avertissements.total} au total, dont ${s.avertissements.total - s.avertissements.actifs} levé${s.avertissements.total - s.avertissements.actifs > 1 ? "s" : ""})`}
              {s.avertissements.regulariserAvant && (
                <>
                  {" · à régulariser avant le "}
                  <time dateTime={dateIso(s.avertissements.regulariserAvant)}>
                    {formaterDate(s.avertissements.regulariserAvant)}
                  </time>
                </>
              )}
            </dd>
          </div>
        )}

        {s.informeLe && (
          <div>
            <dt>Signalant informé</dt>
            <dd>
              <time dateTime={dateIso(s.informeLe)}>
                {formaterDate(s.informeLe)}
              </time>
            </dd>
          </div>
        )}

        {s.informeErreur && (
          <div className="dossier-details">
            <dt>Courriel non remis au signalant</dt>
            <dd>{s.informeErreur}</dd>
          </div>
        )}
      </dl>

      {/* Un recours rouvre le dossier : il doit sauter aux yeux, sinon il
          reste au fond d'une liste et personne n'y répond. */}
      {s.appel && (
        <div className="dossier-recours-recu">
          <p className="dossier-recours-titre">
            Recours déposé par{" "}
            {s.appel.parQui === "cible"
              ? "la personne signalée"
              : "la personne qui a signalé"}
            {" · "}
            <time dateTime={dateIso(s.appel.deposeLe)}>
              {formaterDate(s.appel.deposeLe)}
            </time>
          </p>
          <p className="dossier-recours-message">{s.appel.message}</p>
          {s.appel.repondu && (
            <p className="dossier-recours-reponse">
              <strong>Réponse donnée</strong> — {s.appel.reponse}
            </p>
          )}
        </div>
      )}

      {s.echanges?.length > 0 && (
        <details className="dossier-echanges">
          <summary>
            {s.echanges.length} échange{s.echanges.length > 1 ? "s" : ""} avec
            les parties
          </summary>
          <ul>
            {s.echanges.map((e, i) => (
              <li key={i}>
                <time dateTime={dateIso(e.date)}>{formaterDate(e.date)}</time>
                {" → "}
                {e.vers === "cible" ? "la personne signalée" : "le signalant"}
                {" · "}
                {e.objet}
                {e.simule && " (simulé)"}
              </li>
            ))}
          </ul>
        </details>
      )}

      {clos ? (
        <div className="dossier-decision">
          <p>
            <strong>Décision</strong> — {s.decision}
          </p>
          <p className="dossier-meta">
            {s.traitePar || "un administrateur"}
            {s.traiteLe && (
              <>
                {" · "}
                <time dateTime={dateIso(s.traiteLe)}>
                  {formaterDate(s.traiteLe)}
                </time>
              </>
            )}
            {s.mesures.length > 0 && ` · ${s.mesures.join(", ")}`}
          </p>
        </div>
      ) : ouvert ? (
        <form
          className="dossier-formulaire"
          onSubmit={(e) => {
            e.preventDefault();
            onInstruire({ id: s._id, statut, decision, mesures: choisies });
          }}
        >
          <div className="champ">
            <label htmlFor={`statut-${s._id}`}>Suite donnée</label>
            <select
              id={`statut-${s._id}`}
              value={statut}
              onChange={(e) => setStatut(e.target.value)}
            >
              <option value="en_cours">En cours d'examen</option>
              <option value="traite">Fondé — dossier traité</option>
              <option value="rejete">Non fondé — rejeté</option>
            </select>
          </div>

          <fieldset className="champ">
            <legend>Mesures prises</legend>
            {/* Rien n'est coché par défaut, et « aucune » est un choix
                explicite : une case pré-cochée sur une décision qui touche
                une personne se clique sans y penser. */}
            <div className="dossier-mesures">
              {disponibles.map(([cle, libelle]) => (
                <label key={cle} className="recruteur-case">
                  <input
                    type="checkbox"
                    aria-label={libelle}
                    checked={choisies.includes(cle)}
                    onChange={() => basculer(cle)}
                  />
                  {libelle}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="champ">
            <label htmlFor={`decision-${s._id}`}>
              Motif de la décision
              {["traite", "rejete"].includes(statut) && " (obligatoire)"}
            </label>
            <textarea
              id={`decision-${s._id}`}
              rows={3}
              value={decision}
              onChange={(e) => setDecision(e.target.value)}
              aria-describedby={`aide-decision-${s._id}`}
              placeholder="Ce qui a été constaté, et pourquoi cette suite."
            />
            <span id={`aide-decision-${s._id}`} className="champ-aide">
              Écrit pour être relu dans six mois, par quelqu'un d'autre que
              vous — et, le cas échéant, opposé à la personne concernée.
            </span>
          </div>

          {erreur && (
            <div className="message message-erreur" role="alert">
              {erreur}
            </div>
          )}

          <div className="actions">
            <button type="submit" className="btn btn-principal btn-compact">
              Enregistrer la décision
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
      ) : (
        <div className="actions">
          <button
            type="button"
            className="btn btn-principal btn-compact"
            onClick={() => setOuvert(true)}
          >
            Instruire ce dossier
          </button>
          <Contact signalementId={s._id} cibleExiste={s.cible.existe} />
        </div>
      )}
    </article>
  );
};

// Les comptes qui approchent de leur échéance de régularisation.
//
// L'administrateur doit VOIR VENIR : un compte supprimé sans qu'on ait vu
// l'échéance arriver, c'est une occasion manquée de reprendre contact.
const Echeances = () => {
  const { data } = useGetEcheancesQuery();
  const [appliquer, { isLoading }] = useAppliquerEcheancesMutation();
  const [retour, setRetour] = useState("");

  if (!data || data.comptes.length === 0) return null;

  const echus = data.comptes.filter((c) => c.joursRestants <= 0);

  return (
    <section className="carte echeances" aria-labelledby="titre-echeances">
      <h2 id="titre-echeances">Régularisations en cours</h2>
      <p className="admin-intro">
        Au-delà de {data.seuil} avertissements, le profil cesse d'être visible
        et la personne dispose de {data.delaiJours} jours pour prendre contact.
        Passé ce délai, le compte est supprimé — elle pourra en recréer un avec
        la même adresse.
      </p>

      <ul className="echeances-liste">
        {data.comptes.map((c) => (
          <li key={c._id}>
            <span className="echeances-nom">{c.nom}</span>
            <span className="echeances-meta">
              {c.email} · {c.avertissements} avertissement
              {c.avertissements > 1 ? "s" : ""}
            </span>
            <span
              className={`pastille ${c.joursRestants <= 0 ? "pastille--ko" : ""}`}
            >
              {c.joursRestants > 0
                ? `${c.joursRestants} jour${c.joursRestants > 1 ? "s" : ""}`
                : "délai écoulé"}
            </span>
          </li>
        ))}
      </ul>

      {echus.length > 0 && (
        <>
          <p className="message message-avertissement" role="status">
            {echus.length} compte{echus.length > 1 ? "s" : ""} au-delà du délai.
            La suppression est définitive : profil et candidatures partent avec.
          </p>
          <div className="actions">
            <button
              type="button"
              className="btn btn-danger btn-compact"
              disabled={isLoading}
              onClick={async () => {
                const r = await appliquer(false).unwrap();
                setRetour(r.message);
              }}
            >
              Supprimer les {echus.length} compte
              {echus.length > 1 ? "s" : ""} échu{echus.length > 1 ? "s" : ""}
            </button>
          </div>
        </>
      )}

      <div aria-live="polite">
        {retour && <p className="dossier-retour">{retour}</p>}
      </div>
    </section>
  );
};

const AdminModerationScreen = () => {
  const [onglet, setOnglet] = useState("nouveau");
  const { data, isLoading, isError, error } = useGetSignalementsQuery(onglet);
  const [instruire] = useInstruireSignalementMutation();
  const [erreur, setErreur] = useState("");

  const traiter = async (corps) => {
    setErreur("");
    try {
      await instruire(corps).unwrap();
    } catch (err) {
      setErreur(messageErreur(err, "Impossible d'enregistrer cette décision."));
    }
  };

  if (isLoading) return <p role="status">Chargement des signalements…</p>;

  if (isError) {
    return (
      <div className="message message-erreur" role="alert">
        {messageErreur(error, "Impossible de charger les signalements.")}
      </div>
    );
  }

  return (
    <>
      <h1>Modération</h1>
      <p className="admin-intro">
        Un signalement n'entraîne aucune sanction automatique : il ouvre un
        dossier. Toute mesure est prise ici, par vous, avec son motif écrit —
        et reste réversible. Le motif que vous écrivez est celui que recevront
        les personnes concernées : la personne signalée, et le signalant, qui
        apprend si son signalement a été retenu mais jamais les mesures prises.
        Les deux peuvent contester.
      </p>

      <Echeances />

      <nav aria-label="Filtrer les signalements">
        <ul className="moderation-onglets">
          {ONGLETS.map((o) => (
            <li key={o.valeur || "tous"}>
              <button
                type="button"
                className={`moderation-onglet${onglet === o.valeur ? " moderation-onglet--actif" : ""}`}
                aria-current={onglet === o.valeur ? "true" : undefined}
                onClick={() => setOnglet(o.valeur)}
              >
                {o.libelle}
                {o.valeur && data.parStatut[o.valeur] > 0 && (
                  <span className="moderation-compte">
                    {data.parStatut[o.valeur]}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {data.signalements.length === 0 ? (
        <p className="admin-vide">
          {onglet === "nouveau"
            ? "Aucun signalement en attente. C'est la situation normale."
            : "Aucun dossier dans cette catégorie."}
        </p>
      ) : (
        <div className="moderation-liste">
          {data.signalements.map((s) => (
            <Dossier
              key={s._id}
              s={s}
              mesures={data.mesures}
              erreur={erreur}
              onInstruire={traiter}
            />
          ))}
        </div>
      )}
    </>
  );
};

export default AdminModerationScreen;
