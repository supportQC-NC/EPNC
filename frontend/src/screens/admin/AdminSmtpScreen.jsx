// src/screens/admin/AdminSmtpScreen.jsx
import { useState } from "react";
import { useSelector } from "react-redux";
import {
  useGetSmtpQuery,
  useTesterSmtpMutation,
  useEnvoyerSmtpTestMutation,
} from "../../slices/adminApiSlice";
import { messageErreur } from "../../utils/erreurApi";
import "./admin.css";

// Bloc de résultat commun aux deux tests.
const Resultat = ({ titre, resultat }) => {
  if (!resultat) return null;

  return (
    <div
      className={`smtp-resultat smtp-resultat--${resultat.ok ? "ok" : "erreur"}`}
      role="status"
    >
      <p className="smtp-resultat-titre">
        {resultat.ok ? `${titre} : réussi` : `${titre} : échec`}
        {resultat.ms != null && (
          <span className="smtp-resultat-duree"> · {resultat.ms} ms</span>
        )}
      </p>

      {resultat.message && <p>{resultat.message}</p>}

      {resultat.accepte?.length > 0 && (
        <p>Accepté par le serveur pour : {resultat.accepte.join(", ")}</p>
      )}

      {resultat.refuse?.length > 0 && (
        <p>Refusé pour : {resultat.refuse.join(", ")}</p>
      )}

      {/* Message brut du serveur : illisible pour beaucoup, mais c'est lui
          qu'on colle dans une recherche ou qu'on transmet à l'hébergeur. */}
      {resultat.brut && (
        <details className="smtp-brut">
          <summary>Réponse brute du serveur</summary>
          <pre>{resultat.brut}</pre>
        </details>
      )}
    </div>
  );
};

const AdminSmtpScreen = () => {
  const { userInfo } = useSelector((state) => state.auth);
  const { data, isLoading, isError, error, refetch } = useGetSmtpQuery();

  const [tester, { isLoading: testEnCours }] = useTesterSmtpMutation();
  const [envoyer, { isLoading: envoiEnCours }] = useEnvoyerSmtpTestMutation();

  const [destinataire, setDestinataire] = useState(userInfo?.email || "");
  const [resultatTest, setResultatTest] = useState(null);
  const [resultatEnvoi, setResultatEnvoi] = useState(null);
  const [erreur, setErreur] = useState("");

  if (isLoading) return <p role="status">Lecture de la configuration…</p>;

  if (isError) {
    return (
      <div className="message message-erreur" role="alert">
        {messageErreur(error, "Configuration SMTP illisible.")}
      </div>
    );
  }

  const { configure, reglages, anomalies } = data;
  const bloquants = anomalies.filter((a) => a.gravite === "bloquant");

  const lancerTest = async () => {
    setErreur("");
    setResultatEnvoi(null);
    try {
      setResultatTest(await tester().unwrap());
    } catch (err) {
      setErreur(messageErreur(err, "Le test n'a pas pu être lancé."));
    }
  };

  const lancerEnvoi = async (e) => {
    e.preventDefault();
    setErreur("");
    setResultatTest(null);
    try {
      setResultatEnvoi(await envoyer(destinataire).unwrap());
    } catch (err) {
      setErreur(messageErreur(err, "L'envoi n'a pas pu être lancé."));
    }
  };

  return (
    <>
      <div className="admin-titre-ligne">
        <h1 className="admin-titre">Envoi d'emails</h1>
        <button
          type="button"
          className="btn btn-secondaire btn-compact"
          onClick={refetch}
        >
          Relire la configuration
        </button>
      </div>

      {!configure && (
        <div className="message message-erreur" role="alert">
          Aucun serveur SMTP n'est configuré. Les emails ne partent pas : leur
          contenu est écrit dans la console du serveur. Le parcours « mot de
          passe oublié » reste donc démontrable, mais personne ne reçoit rien.
        </div>
      )}

      {/* ── Configuration lue ────────────────────────────────────────── */}
      <section className="carte">
        <h2>Configuration en vigueur</h2>

        <dl className="smtp-config">
          <div>
            <dt>Serveur</dt>
            <dd>{reglages.host || "—"}</dd>
          </div>
          <div>
            <dt>Port</dt>
            <dd>{reglages.port}</dd>
          </div>
          <div>
            <dt>Chiffrement</dt>
            <dd>
              {reglages.secure ? "TLS implicite" : "STARTTLS"}
              <span className="smtp-precision">
                {" "}
                — {reglages.secure ? "secure = true" : "secure = false"}
              </span>
            </dd>
          </div>
          <div>
            <dt>Identifiant</dt>
            <dd className={reglages.user?.includes("@") ? "" : "smtp-faux"}>
              {reglages.user || "—"}
            </dd>
          </div>
          <div>
            <dt>Mot de passe</dt>
            <dd>
              {reglages.motDePasseDefini ? (
                "défini"
              ) : (
                <span className="smtp-faux">absent</span>
              )}
            </dd>
          </div>
          <div>
            <dt>Nom d'expéditeur</dt>
            <dd>{reglages.nomExpediteur}</dd>
          </div>
        </dl>

        <p className="carte-note">
          Ces valeurs viennent du fichier <code>.env</code>. Après
          modification, redémarrez le serveur : elles sont lues au démarrage.
        </p>
      </section>

      {/* ── Anomalies ────────────────────────────────────────────────── */}
      {anomalies.length > 0 && (
        <section className="carte">
          <h2>
            {bloquants.length > 0
              ? `${bloquants.length} problème${bloquants.length > 1 ? "s" : ""} à corriger`
              : "Points d'attention"}
          </h2>

          <ul className="smtp-anomalies">
            {anomalies.map((a, i) => (
              <li key={i} className={`smtp-anomalie smtp-anomalie--${a.gravite}`}>
                <span className="smtp-anomalie-champ">{a.champ}</span>
                <p>{a.message}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {erreur && (
        <div className="message message-erreur" role="alert">
          {erreur}
        </div>
      )}

      {/* ── Test de connexion ────────────────────────────────────────── */}
      <section className="carte">
        <h2>Tester la connexion</h2>
        <p className="smtp-explication">
          Ouvre une connexion au serveur et s'authentifie, <strong>sans
          envoyer de message</strong>. C'est le test à lancer en premier : il
          isole les problèmes d'identifiants de ceux d'expédition.
        </p>

        <button
          type="button"
          className="btn btn-principal"
          onClick={lancerTest}
          disabled={testEnCours || !configure}
        >
          {testEnCours ? "Connexion en cours…" : "Tester la connexion"}
        </button>

        <Resultat titre="Connexion et authentification" resultat={resultatTest} />
      </section>

      {/* ── Envoi réel ───────────────────────────────────────────────── */}
      <section className="carte">
        <h2>Envoyer un email de test</h2>
        <p className="smtp-explication">
          Une connexion réussie ne garantit pas l'envoi : certains hébergeurs
          authentifient une boîte mais refusent qu'elle expédie au nom d'une
          autre adresse. Ce second test le vérifie réellement.
        </p>

        <form onSubmit={lancerEnvoi}>
          <div className="champ smtp-champ">
            <label htmlFor="destinataire">Adresse de destination</label>
            <input
              id="destinataire"
              type="email"
              value={destinataire}
              onChange={(e) => setDestinataire(e.target.value)}
              placeholder="vous@exemple.nc"
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-principal"
            disabled={envoiEnCours || !configure || !destinataire.trim()}
          >
            {envoiEnCours ? "Envoi en cours…" : "Envoyer le test"}
          </button>
        </form>

        <Resultat titre="Envoi" resultat={resultatEnvoi} />
      </section>
    </>
  );
};

export default AdminSmtpScreen;
