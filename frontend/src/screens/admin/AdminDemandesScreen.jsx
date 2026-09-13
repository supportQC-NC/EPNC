// src/screens/admin/AdminDemandesScreen.jsx
//
// Instruction des demandes d'accès recruteur.
//
// ══════════════════════════════════════════════════════════════════════════
//  ACCEPTER, C'EST OUVRIR LE VIVIER À QUELQU'UN
// ══════════════════════════════════════════════════════════════════════════
// L'écran ne propose pas deux boutons « oui / non » au bout d'une ligne de
// tableau. Il met sous les yeux ce sur quoi la décision se prend : le nom de
// l'organisation, la fonction déclarée, l'adresse (professionnelle ou non), le
// site, et en toutes lettres ce que la personne dit vouloir faire du vivier.
//
// Le motif est obligatoire — le serveur refuse une décision sans lui — parce
// qu'il part tel quel dans le courriel de réponse. Un refus sans motif ne se
// conteste pas et ne s'améliore pas ; une acceptation sans motif ne dit pas à
// l'administrateur suivant pourquoi ce dossier-là est passé.
import { useState } from "react";
import {
  useGetDemandesRecruteurQuery,
  useDeciderDemandeRecruteurMutation,
} from "../../slices/demandeRecruteurApiSlice";
import { messageErreur } from "../../utils/erreurApi";
import { formaterDate, dateIso } from "../../utils/format";
import { libelleRole } from "../../constants";
import "./admin.css";

const ONGLETS = [
  { valeur: "en_attente", libelle: "À instruire" },
  { valeur: "acceptee", libelle: "Acceptées" },
  { valeur: "refusee", libelle: "Refusées" },
  { valeur: "", libelle: "Toutes" },
];

// Le statut porte la même couleur de bord que les dossiers de modération :
// en attente = à faire, acceptée = clos favorable, refusée = clos, effacé.
const CLASSE_STATUT = {
  en_attente: "nouveau",
  acceptee: "traite",
  refusee: "rejete",
};

const Demande = ({ d, onDecision }) => {
  const [decider, { isLoading }] = useDeciderDemandeRecruteurMutation();
  const [statut, setStatut] = useState("");
  const [motif, setMotif] = useState("");
  const [erreur, setErreur] = useState("");

  const enAttente = d.statut === "en_attente";

  const soumettre = async (e) => {
    e.preventDefault();
    setErreur("");
    try {
      const r = await decider({ id: d._id, statut, motif }).unwrap();
      onDecision(r.message);
      setStatut("");
      setMotif("");
    } catch (err) {
      setErreur(messageErreur(err, "La décision n'a pas pu être enregistrée."));
    }
  };

  return (
    <article className={`dossier dossier--${CLASSE_STATUT[d.statut]}`}>
      <div className="dossier-entete">
        <div>
          <h3 className="dossier-cible">
            {d.prenom} {d.nom}
            <span className="dossier-role">{d.organisation}</span>
            {/* Un compte existe déjà : accepter le PROMEUT au lieu d'en créer
                un second. L'administrateur doit le savoir avant de décider,
                surtout quand ce compte est désactivé.
                Seulement sur un dossier en attente : après une acceptation, un
                compte existe forcément — c'est celui qu'on vient de créer — et
                « compte existant » se lirait alors comme un doublon. */}
            {enAttente && d.compteExistant && (
              <span className="pastille">
                Compte {libelleRole(d.compteExistant.role)} existant
                {d.compteExistant.isActive === false && " · désactivé"}
              </span>
            )}
          </h3>
          <p className="dossier-meta">
            {d.email}
            {d.telephone && ` · ${d.telephone}`}
            {" · déposée le "}
            <time dateTime={dateIso(d.createdAt)}>
              {formaterDate(d.createdAt)}
            </time>
          </p>
        </div>

        <span
          className={`pastille dossier-statut dossier-statut--${CLASSE_STATUT[d.statut]}`}
        >
          {ONGLETS.find((o) => o.valeur === d.statut)?.libelle || d.statut}
        </span>
      </div>

      <dl className="dossier-corps">
        <div>
          <dt>Fonction déclarée</dt>
          <dd>{d.fonction}</dd>
        </div>
        <div>
          <dt>Organisation</dt>
          <dd>
            {d.organisation}
            {d.employeurCode && (
              <>
                {" "}
                <span className="pastille">Employeur répertorié</span>
              </>
            )}
          </dd>
        </div>
        {d.siteOrganisation && (
          <div>
            <dt>Site</dt>
            <dd>
              {/* `rel` complet : un lien fourni par un inconnu ne doit ni
                  transmettre la page d'origine, ni obtenir la main sur l'onglet
                  qui l'a ouvert. */}
              <a
                href={d.siteOrganisation}
                target="_blank"
                rel="noopener noreferrer nofollow"
              >
                {d.siteOrganisation}
              </a>
            </dd>
          </div>
        )}

        <div className="dossier-details">
          <dt>Ce qu'elle compte faire du vivier</dt>
          <dd>{d.motivation}</dd>
        </div>

        {!enAttente && (
          <div className="dossier-details">
            <dt>
              Motif de la décision
              {d.decidePar && ` — ${d.decidePar}`}
              {d.decideLe && (
                <>
                  {", le "}
                  <time dateTime={dateIso(d.decideLe)}>
                    {formaterDate(d.decideLe)}
                  </time>
                </>
              )}
            </dt>
            <dd>{d.motifDecision}</dd>
          </div>
        )}

        {/* Un courriel non remis n'est pas un détail : la personne attend une
            réponse qui n'arrivera jamais, et seul cet écran le sait. */}
        {!enAttente && !d.courrielEnvoye && (
          <div className="dossier-details">
            <dt>Courriel non remis</dt>
            <dd>
              {d.courrielErreur || "Cause inconnue."} — recontactez
              {" "}
              {d.email} par un autre moyen.
            </dd>
          </div>
        )}
      </dl>

      {enAttente && (
        <form className="dossier-formulaire" onSubmit={soumettre}>
          {erreur && (
            <div className="message message-erreur" role="alert">
              {erreur}
            </div>
          )}

          <div className="champ">
            <label htmlFor={`statut-${d._id}`}>Décision</label>
            <select
              id={`statut-${d._id}`}
              value={statut}
              onChange={(e) => setStatut(e.target.value)}
              required
            >
              <option value="">Choisir…</option>
              <option value="acceptee">
                Accepter — ouvrir l'accès recruteur
              </option>
              <option value="refusee">Refuser</option>
            </select>
          </div>

          <div className="champ">
            <label htmlFor={`motif-${d._id}`}>
              Motif, envoyé tel quel au demandeur
            </label>
            <textarea
              id={`motif-${d._id}`}
              rows={3}
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              required
              aria-describedby={`aide-motif-${d._id}`}
              placeholder={
                statut === "refusee"
                  ? "Ce qui manque, et ce qui permettrait de redéposer une demande recevable."
                  : "Ce qui vous a permis de vérifier l'organisation et la fonction."
              }
            />
            <span id={`aide-motif-${d._id}`} className="champ-aide">
              {statut === "acceptee"
                ? "En cas d'acceptation, le compte est créé (ou étendu) et la personne reçoit un lien pour définir son mot de passe. Aucun mot de passe n'est jamais envoyé par courriel."
                : "Le demandeur reçoit ce texte mot pour mot. Écrivez-le comme s'il le lisait — parce que c'est le cas."}
            </span>
          </div>

          <div className="actions">
            <button
              type="submit"
              className={`btn btn-compact ${statut === "refusee" ? "btn-danger" : "btn-principal"}`}
              disabled={isLoading || !statut}
            >
              {/* Tant qu'aucune décision n'est choisie, le bouton reste
                  neutre : afficher « Accepter et notifier » par défaut sur un
                  bouton désactivé laisse croire que c'est ce qui va se
                  produire. */}
              {isLoading
                ? "Envoi…"
                : statut === "acceptee"
                  ? "Accepter et notifier"
                  : statut === "refusee"
                    ? "Refuser et notifier"
                    : "Enregistrer la décision"}
            </button>
          </div>
        </form>
      )}
    </article>
  );
};

const AdminDemandesScreen = () => {
  const [onglet, setOnglet] = useState("en_attente");
  const { data, isLoading, isError, error } =
    useGetDemandesRecruteurQuery(onglet);
  const [retour, setRetour] = useState("");

  if (isLoading) return <p role="status">Chargement des demandes…</p>;

  if (isError) {
    return (
      <div className="message message-erreur" role="alert">
        {messageErreur(error, "Impossible de charger les demandes.")}
      </div>
    );
  }

  return (
    <>
      <h1>Accès recruteurs</h1>
      <p className="admin-intro">
        Un compte candidat s'ouvre librement ; un compte recruteur, non. Il
        donne accès au vivier — les parcours et les coordonnées de personnes
        qui cherchent un emploi, et qui les ont confiés à un service public.
        Chaque demande passe donc ici, et repart avec une réponse motivée,
        acceptée ou non.
      </p>

      <div aria-live="polite">
        {retour && (
          <div className="message message-succes" role="status">
            {retour}
          </div>
        )}
      </div>

      <nav aria-label="Filtrer les demandes">
        <ul className="moderation-onglets">
          {ONGLETS.map((o) => (
            <li key={o.valeur || "toutes"}>
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

      {data.demandes.length === 0 ? (
        <p className="admin-vide">
          {onglet === "en_attente"
            ? "Aucune demande en attente."
            : "Aucune demande dans cette catégorie."}
        </p>
      ) : (
        <div className="moderation-liste">
          {data.demandes.map((d) => (
            <Demande key={d._id} d={d} onDecision={setRetour} />
          ))}
        </div>
      )}
    </>
  );
};

export default AdminDemandesScreen;
