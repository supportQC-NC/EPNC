// src/screens/admin/AdminIntegrationScreen.jsx
//
// La surface machine : clés d'API et abonnements aux webhooks.
//
// ══════════════════════════════════════════════════════════════════════════
//  L'ÉCRAN DOIT MONTRER LA SANTÉ, PAS SEULEMENT LA LISTE
// ══════════════════════════════════════════════════════════════════════════
// Une clé et un webhook ont ceci de commun qu'ils fonctionnent ailleurs, chez
// quelqu'un d'autre, sans que personne ici ne s'en aperçoive. Un abonnement
// cassé depuis trois semaines ressemble exactement à un abonnement qui marche,
// si l'on n'affiche que son nom et son URL.
//
// D'où ce qui est mis en avant : la date du dernier appel, les échecs
// consécutifs, la dernière erreur en toutes lettres.
import { useState } from "react";
import {
  useGetClesQuery,
  useCreerCleMutation,
  useRevoquerCleMutation,
  useGetWebhooksQuery,
  useCreerWebhookMutation,
  useBasculerWebhookMutation,
  useSupprimerWebhookMutation,
  useTesterWebhookMutation,
} from "../../slices/integrationApiSlice";
import { messageErreur } from "../../utils/erreurApi";
import { formaterDate, dateIso } from "../../utils/format";
import "./admin.css";

// Un secret qui ne sera plus jamais affiché.
//
// Il ne suffit pas de l'écrire : il faut que ce soit ÉVIDENT, sinon quelqu'un
// ferme l'écran et découvre le problème une semaine plus tard, du côté de
// l'intégrateur. D'où le bandeau, le bouton de copie, et l'absence de bouton
// « fermer » discret.
const SecretUnique = ({ secret, titre, explication, onFerme }) => {
  const [copie, setCopie] = useState(false);

  return (
    <div className="secret-unique" role="alert">
      <h3>{titre}</h3>
      <p>{explication}</p>
      <code className="secret-valeur">{secret}</code>
      <div className="actions">
        <button
          type="button"
          className="btn btn-principal btn-compact"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(secret);
              setCopie(true);
            } catch {
              // Le presse-papiers peut être refusé (contexte non sécurisé,
              // permission). On ne prétend pas avoir copié : le secret reste
              // sélectionnable à la main juste au-dessus.
              setCopie(false);
            }
          }}
        >
          {copie ? "Copié" : "Copier"}
        </button>
        <button type="button" className="btn btn-secondaire btn-compact" onClick={onFerme}>
          J'ai noté ce secret
        </button>
      </div>
    </div>
  );
};

// ── Clés d'API ────────────────────────────────────────────────────────────

const Cles = () => {
  const { data, isLoading, isError, error } = useGetClesQuery();
  const [creer, { isLoading: enCreation }] = useCreerCleMutation();
  const [revoquer] = useRevoquerCleMutation();

  const [ouvert, setOuvert] = useState(false);
  const [form, setForm] = useState({ nom: "", organisation: "", contact: "", portees: [] });
  const [secret, setSecret] = useState("");
  const [erreur, setErreur] = useState("");

  if (isLoading) return <p role="status">Chargement des clés…</p>;
  if (isError)
    return (
      <div className="message message-erreur" role="alert">
        {messageErreur(error, "Impossible de charger les clés.")}
      </div>
    );

  const soumettre = async (e) => {
    e.preventDefault();
    setErreur("");
    try {
      const r = await creer(form).unwrap();
      setSecret(r.secret);
      setForm({ nom: "", organisation: "", contact: "", portees: [] });
      setOuvert(false);
    } catch (err) {
      setErreur(messageErreur(err, "La clé n'a pas pu être créée."));
    }
  };

  const basculerPortee = (cle) =>
    setForm((f) => ({
      ...f,
      portees: f.portees.includes(cle)
        ? f.portees.filter((p) => p !== cle)
        : [...f.portees, cle],
    }));

  return (
    <section className="carte" aria-labelledby="titre-cles">
      <h2 id="titre-cles">Clés d'API</h2>
      <p className="admin-intro">
        Elles ouvrent la surface machine : confronter un candidat aux offres, et
        produire les pièces d'une candidature. La <strong>lecture du catalogue
        et du référentiel n'en demande aucune</strong> — ce sont des données
        publiques.
      </p>

      {secret && (
        <SecretUnique
          secret={secret}
          titre="Voici la clé. Elle ne sera plus jamais affichée."
          explication="Seule son empreinte est conservée. Si vous la perdez, il faudra en créer une autre et mettre à jour l'intégration."
          onFerme={() => setSecret("")}
        />
      )}

      {erreur && (
        <div className="message message-erreur" role="alert">
          {erreur}
        </div>
      )}

      {data.cles.length === 0 ? (
        <p className="admin-vide">Aucune clé. L'API machine n'est donc utilisable par personne.</p>
      ) : (
        <ul className="integration-liste">
          {data.cles.map((c) => (
            <li key={c._id} className={`integration-item${c.active ? "" : " integration-item--inactif"}`}>
              <div className="integration-entete">
                <strong>{c.nom}</strong>
                {c.organisation && <span className="dossier-role">{c.organisation}</span>}
                <span className={`pastille ${c.active ? "" : "pastille--ko"}`}>
                  {c.active ? "active" : "révoquée"}
                </span>
              </div>

              <code className="integration-prefixe">{c.prefixe}…</code>

              <ul className="integration-portees">
                {c.portees.map((p) => (
                  <li key={p} title={data.portees[p]}>
                    {p}
                  </li>
                ))}
              </ul>

              <p className="dossier-meta">
                {c.nbAppels} appel{c.nbAppels > 1 ? "s" : ""}
                {c.dernierAppel ? (
                  <>
                    {" · dernier le "}
                    <time dateTime={dateIso(c.dernierAppel)}>{formaterDate(c.dernierAppel)}</time>
                  </>
                ) : (
                  " · jamais utilisée"
                )}
                {c.revoqueeLe && (
                  <>
                    {" · révoquée le "}
                    <time dateTime={dateIso(c.revoqueeLe)}>{formaterDate(c.revoqueeLe)}</time>
                    {c.motifRevocation && ` — ${c.motifRevocation}`}
                  </>
                )}
              </p>

              {c.active && (
                <button
                  type="button"
                  className="btn-lien-danger"
                  onClick={async () => {
                    const motif = window.prompt(
                      `Révoquer « ${c.nom} » ? L'intégration cessera immédiatement de fonctionner.\n\nMotif (conservé au journal) :`,
                    );
                    // `null` = annulation ; une chaîne vide reste un motif
                    // accepté, on ne bloque pas sur une formalité.
                    if (motif === null) return;
                    await revoquer({ id: c._id, motif });
                  }}
                >
                  Révoquer
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {ouvert ? (
        <form className="dossier-formulaire" onSubmit={soumettre}>
          <div className="champ">
            <label htmlFor="cle-nom">Nom de la clé</label>
            <input
              id="cle-nom"
              value={form.nom}
              onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
              required
              placeholder="ATS de la province Sud"
              aria-describedby="aide-cle-nom"
            />
            <span id="aide-cle-nom" className="champ-aide">
              C'est ce nom que vous chercherez le jour où il faudra révoquer.
            </span>
          </div>

          <div className="duo">
            <div className="champ">
              <label htmlFor="cle-organisation">Organisation</label>
              <input
                id="cle-organisation"
                value={form.organisation}
                onChange={(e) => setForm((f) => ({ ...f, organisation: e.target.value }))}
              />
            </div>
            <div className="champ">
              <label htmlFor="cle-contact">Contact technique</label>
              <input
                id="cle-contact"
                type="email"
                value={form.contact}
                onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
              />
            </div>
          </div>

          <fieldset className="champ">
            <legend>Portées</legend>
            {Object.entries(data.portees).map(([cle, libelle]) => (
              <label key={cle} className="integration-case">
                <input
                  type="checkbox"
                  checked={form.portees.includes(cle)}
                  onChange={() => basculerPortee(cle)}
                />
                <span>
                  <code>{cle}</code> — {libelle}
                </span>
              </label>
            ))}
          </fieldset>

          <div className="actions">
            <button type="submit" className="btn btn-principal btn-compact" disabled={enCreation}>
              {enCreation ? "Création…" : "Créer la clé"}
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
          <button type="button" className="btn btn-principal btn-compact" onClick={() => setOuvert(true)}>
            Créer une clé
          </button>
        </div>
      )}
    </section>
  );
};

// ── Webhooks ──────────────────────────────────────────────────────────────

const Webhooks = () => {
  const { data, isLoading, isError, error } = useGetWebhooksQuery();
  const [creer, { isLoading: enCreation }] = useCreerWebhookMutation();
  const [basculer] = useBasculerWebhookMutation();
  const [supprimer] = useSupprimerWebhookMutation();
  const [tester, { isLoading: enTest }] = useTesterWebhookMutation();

  const [ouvert, setOuvert] = useState(false);
  const [form, setForm] = useState({ nom: "", url: "" });
  const [secret, setSecret] = useState("");
  const [erreur, setErreur] = useState("");
  const [retour, setRetour] = useState("");

  if (isLoading) return <p role="status">Chargement des abonnements…</p>;
  if (isError)
    return (
      <div className="message message-erreur" role="alert">
        {messageErreur(error, "Impossible de charger les abonnements.")}
      </div>
    );

  const soumettre = async (e) => {
    e.preventDefault();
    setErreur("");
    try {
      const r = await creer({ ...form, evenements: ["avp.publie"] }).unwrap();
      setSecret(r.secret);
      setForm({ nom: "", url: "" });
      setOuvert(false);
    } catch (err) {
      setErreur(messageErreur(err, "L'abonnement n'a pas pu être créé."));
    }
  };

  return (
    <section className="carte" aria-labelledby="titre-webhooks">
      <h2 id="titre-webhooks">Webhooks</h2>
      <p className="admin-intro">
        Prévenir un partenaire dès qu'un lot de nouvelles offres est ingéré,
        plutôt que de le laisser nous interroger en boucle. Un envoi par lot,
        jamais un par offre. Chaque message est signé —{" "}
        <code>X-EPNC-Signature</code> — et le destinataire doit vérifier cette
        signature avant de traiter quoi que ce soit.
      </p>

      {secret && (
        <SecretUnique
          secret={secret}
          titre="Le secret de signature"
          explication="Transmettez-le au destinataire par un canal sûr : c'est avec lui qu'il vérifiera que les envois viennent bien de nous."
          onFerme={() => setSecret("")}
        />
      )}

      {erreur && (
        <div className="message message-erreur" role="alert">
          {erreur}
        </div>
      )}

      <div aria-live="polite">
        {retour && <p className="dossier-retour">{retour}</p>}
      </div>

      {data.webhooks.length === 0 ? (
        <p className="admin-vide">Aucun abonnement.</p>
      ) : (
        <ul className="integration-liste">
          {data.webhooks.map((w) => (
            <li
              key={w._id}
              className={`integration-item${w.actif ? "" : " integration-item--inactif"}`}
            >
              <div className="integration-entete">
                <strong>{w.nom}</strong>
                <span className={`pastille ${w.actif ? "" : "pastille--ko"}`}>
                  {w.actif ? "actif" : "suspendu"}
                </span>
                {w.echecsConsecutifs > 0 && (
                  <span className="pastille pastille--ko">
                    {w.echecsConsecutifs} échec{w.echecsConsecutifs > 1 ? "s" : ""} d'affilée
                  </span>
                )}
              </div>

              <code className="integration-prefixe">{w.url}</code>

              <p className="dossier-meta">
                {w.nbEmissions} émission{w.nbEmissions > 1 ? "s" : ""}
                {w.dernierSucces && (
                  <>
                    {" · dernier succès le "}
                    <time dateTime={dateIso(w.dernierSucces)}>{formaterDate(w.dernierSucces)}</time>
                  </>
                )}
                {!w.dernierSucces && " · jamais reçu"}
              </p>

              {/* La dernière erreur en clair, pas un code. C'est ce qui permet
                  de dire au partenaire quoi réparer. */}
              {w.derniereErreur && (
                <p className="integration-erreur">
                  Dernière erreur
                  {w.dernierEchec && (
                    <>
                      {" ("}
                      <time dateTime={dateIso(w.dernierEchec)}>{formaterDate(w.dernierEchec)}</time>
                      {")"}
                    </>
                  )}
                  {" : "}
                  {w.derniereErreur}
                </p>
              )}

              <div className="actions">
                {w.actif && (
                  <button
                    type="button"
                    className="btn btn-secondaire btn-compact"
                    disabled={enTest}
                    onClick={async () => {
                      setRetour("");
                      try {
                        const r = await tester(w._id).unwrap();
                        setRetour(r.message);
                      } catch (err) {
                        setRetour(messageErreur(err, "Le test a échoué."));
                      }
                    }}
                  >
                    {enTest ? "Envoi…" : "Envoyer un test"}
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-secondaire btn-compact"
                  onClick={() => basculer({ id: w._id, actif: !w.actif })}
                >
                  {w.actif ? "Suspendre" : "Réactiver"}
                </button>
                <button
                  type="button"
                  className="btn-lien-danger"
                  onClick={() => {
                    if (window.confirm(`Supprimer l'abonnement « ${w.nom} » ?`)) {
                      supprimer(w._id);
                    }
                  }}
                >
                  Supprimer
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {ouvert ? (
        <form className="dossier-formulaire" onSubmit={soumettre}>
          <div className="champ">
            <label htmlFor="wh-nom">Nom</label>
            <input
              id="wh-nom"
              value={form.nom}
              onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
              required
              placeholder="ATS de la province Sud"
            />
          </div>

          <div className="champ">
            <label htmlFor="wh-url">URL appelée</label>
            <input
              id="wh-url"
              type="url"
              value={form.url}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              required
              placeholder="https://…"
              aria-describedby="aide-wh-url"
            />
            <span id="aide-wh-url" className="champ-aide">
              HTTPS obligatoire hors localhost : la signature prouve l'origine
              du message, elle n'en cache pas le contenu.
            </span>
          </div>

          <div className="actions">
            <button type="submit" className="btn btn-principal btn-compact" disabled={enCreation}>
              {enCreation ? "Création…" : "Créer l'abonnement"}
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
          <button type="button" className="btn btn-principal btn-compact" onClick={() => setOuvert(true)}>
            Ajouter un abonnement
          </button>
        </div>
      )}
    </section>
  );
};

const AdminIntegrationScreen = () => (
  <>
    <h1>Intégration</h1>
    <p className="admin-intro">
      Ce que la plateforme expose aux machines. Un intégrateur n'apprend aucun
      champ inventé ici : il envoie un <strong>JSON Resume</strong>, il reçoit du{" "}
      <strong>schema.org/JobPosting</strong>. Le contrat complet est décrit à{" "}
      <a href="/api/openapi.json" target="_blank" rel="noopener noreferrer">
        /api/openapi.json
      </a>{" "}
      (OpenAPI 3.1). Un assistant conversationnel passe, lui, par le serveur MCP
      (<code>npm run mcp</code>).
    </p>

    <Cles />
    <Webhooks />
  </>
);

export default AdminIntegrationScreen;
