// src/screens/admin/AdminEnvoiScreen.jsx
//
// Mode d'envoi des candidatures : test ou production.
//
// 🔴 En production, les candidatures partent chez de VRAIS recruteurs. Cet
// écran doit donc être sans ambiguïté : l'état courant se lit en une seconde,
// et le basculement demande une confirmation explicite.
import { useState } from "react";
import {
  useGetEnvoiQuery,
  useChangerModeEnvoiMutation,
} from "../../slices/adminApiSlice";
import { messageErreur } from "../../utils/erreurApi";
import "./admin.css";

const AdminEnvoiScreen = () => {
  const { data, isLoading, isError, error } = useGetEnvoiQuery();
  const [changer, { isLoading: bascule }] = useChangerModeEnvoiMutation();
  const [confirmation, setConfirmation] = useState(false);
  const [erreur, setErreur] = useState("");

  const basculer = async (mode) => {
    setErreur("");
    try {
      await changer(mode).unwrap();
      setConfirmation(false);
    } catch (err) {
      setErreur(messageErreur(err, "Le changement de mode a échoué."));
    }
  };

  if (isLoading) return <p role="status">Lecture du mode d'envoi…</p>;

  if (isError) {
    return (
      <div className="message message-erreur" role="alert">
        {messageErreur(error, "Impossible de lire le mode d'envoi.")}
      </div>
    );
  }

  const enProduction = data.mode === "production";

  return (
    <>
      <h1>Envoi des candidatures</h1>

      {erreur && (
        <div className="message message-erreur" role="alert">
          {erreur}
        </div>
      )}

      {/* L'état courant, en premier et en grand. Un administrateur qui arrive
          sur cet écran vient presque toujours vérifier une seule chose : est-ce
          que ça part pour de vrai ? */}
      <section
        className={`carte mode-envoi mode-envoi--${data.mode}`}
        aria-labelledby="titre-mode"
      >
        <h2 id="titre-mode">
          Mode actuel :{" "}
          <span className="mode-valeur">
            {enProduction ? "PRODUCTION" : "TEST"}
          </span>
        </h2>

        {enProduction ? (
          <p className="mode-explication">
            Les candidatures partent <strong>chez le recruteur désigné par
            l'offre</strong>. Chaque envoi atteint une personne réelle.
          </p>
        ) : (
          <p className="mode-explication">
            Les candidatures partent uniquement à{" "}
            <strong>{data.adresseTest || "aucune adresse configurée"}</strong>.
            L'adresse de candidature figurant dans l'offre n'est jamais lue, et
            les domaines {data.domainesInterdits?.join(", ")} sont refusés par le
            serveur.
          </p>
        )}

        <dl className="mode-etat">
          <div>
            <dt>Autorisation du serveur</dt>
            <dd>
              {data.productionAutorisee ? (
                <>
                  Accordée — <code>ENVOI_PRODUCTION_AUTORISE=true</code>
                </>
              ) : (
                <>
                  Refusée — <code>ENVOI_PRODUCTION_AUTORISE</code> n'est pas à{" "}
                  <code>true</code>. Le mode production est impossible tant que
                  ce n'est pas posé dans l'environnement du serveur.
                </>
              )}
            </dd>
          </div>
          <div>
            <dt>Serveur d'envoi</dt>
            <dd>
              {data.simule ? (
                <>
                  Non configuré : les envois sont <strong>simulés</strong> et
                  tracés dans la console. Rien ne part réellement.
                </>
              ) : (
                "Configuré. Les envois partent réellement."
              )}
            </dd>
          </div>
          <div>
            <dt>Envoi possible</dt>
            <dd>{data.possible ? "Oui" : `Non — ${data.motif}`}</dd>
          </div>
        </dl>
      </section>

      <section className="carte" aria-labelledby="titre-bascule">
        <h2 id="titre-bascule">Changer de mode</h2>

        <p className="admin-intro">
          Deux clés indépendantes sont nécessaires pour envoyer chez un vrai
          recruteur : l'autorisation du serveur (variable d'environnement, qui
          demande un accès à la machine) et le basculement ci-dessous. Aucune ne
          suffit seule — c'est ce qui empêche une copie de la base ou un
          déploiement de test d'écrire à une personne réelle.
        </p>

        {enProduction ? (
          <button
            type="button"
            className="btn btn-secondaire"
            onClick={() => basculer("test")}
            disabled={bascule}
          >
            Revenir au mode test
          </button>
        ) : confirmation ? (
          <>
            <div className="message message-avertissement" role="alert">
              <strong>Confirmez-vous le passage en production ?</strong> Les
              candidatures envoyées depuis la plateforme parviendront à de vrais
              services de recrutement. Chaque envoi mobilisera le temps d'un
              agent. Ne basculez que si les candidatures déposées sont réelles.
            </div>
            <div className="actions">
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => basculer("production")}
                disabled={bascule || !data.productionAutorisee}
              >
                {bascule ? "Basculement…" : "Oui, passer en production"}
              </button>
              <button
                type="button"
                className="btn btn-secondaire"
                onClick={() => setConfirmation(false)}
              >
                Annuler
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            className="btn btn-principal"
            onClick={() => setConfirmation(true)}
            disabled={!data.productionAutorisee}
          >
            Passer en production
          </button>
        )}

        {!data.productionAutorisee && (
          <p className="admin-intro">
            Pour autoriser la production : posez{" "}
            <code>ENVOI_PRODUCTION_AUTORISE=true</code> dans le fichier{" "}
            <code>.env</code> du serveur, puis redémarrez-le.
          </p>
        )}
      </section>
    </>
  );
};

export default AdminEnvoiScreen;
