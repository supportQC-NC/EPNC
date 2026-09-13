// src/screens/admin/AdminDonneesScreen.jsx
//
// Mise à jour des données depuis l'interface.
//
// Les mêmes synchronisations que `npm run data:*`, déclenchées depuis le
// navigateur. La console reste utile — à l'installation, et pour une tâche
// planifiée — mais personne ne devrait avoir besoin d'un terminal pour
// rafraîchir un catalogue d'offres.
import { useState } from "react";
import {
  useGetIngestionQuery,
  useLancerIngestionMutation,
} from "../../slices/adminApiSlice";
import { formaterDate, dateIso } from "../../utils/format";
import { messageErreur } from "../../utils/erreurApi";
import "./admin.css";

const duree = (ms) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`);

const AdminDonneesScreen = () => {
  const { data, isLoading, isError, error } = useGetIngestionQuery();
  const [lancer, { isLoading: enCours }] = useLancerIngestionMutation();

  // La source en cours est suivie séparément de `isLoading` : sans cela, les
  // quatre boutons afficheraient « en cours » alors qu'une seule synchro
  // tourne.
  const [active, setActive] = useState(null);
  const [resultat, setResultat] = useState(null);
  const [erreur, setErreur] = useState("");

  const synchroniser = async (source) => {
    setErreur("");
    setResultat(null);
    setActive(source);

    try {
      setResultat(await lancer(source).unwrap());
    } catch (err) {
      setErreur(messageErreur(err, "La synchronisation a échoué."));
    } finally {
      setActive(null);
    }
  };

  if (isLoading) return <p role="status">Chargement du journal…</p>;

  if (isError) {
    return (
      <div className="message message-erreur" role="alert">
        {messageErreur(error, "Impossible de lire le journal des synchronisations.")}
      </div>
    );
  }

  return (
    <>
      <h1>Données</h1>
      <p className="admin-intro">
        Chaque source est indépendante : une panne sur l'une n'empêche pas de
        synchroniser les autres. Les synchronisations sont idempotentes — les
        relancer ne crée pas de doublon, et les offres disparues de la source
        sont conservées en base comme historique.
      </p>

      {erreur && (
        <div className="message message-erreur" role="alert">
          {erreur}
        </div>
      )}

      {/* Le compte-rendu arrive après un appel réseau qui peut durer une
          minute : sans `aria-live`, rien n'est annoncé et l'on ne sait pas si
          la synchro a abouti. */}
      <div aria-live="polite">
        {resultat && (
          <div className="message message-succes">
            <strong>{resultat.libelle}</strong> — {resultat.crees} créé(s),{" "}
            {resultat.majs} mis à jour
            {resultat.ignores ? `, ${resultat.ignores} ignoré(s)` : ""} en{" "}
            {duree(resultat.dureeMs)}.
            {resultat.message && <> {resultat.message}</>}
          </div>
        )}
      </div>

      <section className="carte" aria-labelledby="titre-sources-maj">
        <h2 id="titre-sources-maj">Sources synchronisables</h2>

        <ul className="ingestion-liste">
          {data.sources.map((s) => {
            const derniere = data.derniereParSource?.[s.id];

            return (
              <li key={s.id} className="ingestion-ligne">
                <div className="ingestion-info">
                  <strong>{s.libelle}</strong>
                  <span className="ingestion-derniere">
                    {derniere ? (
                      <>
                        Dernière synchro réussie :{" "}
                        <time dateTime={dateIso(derniere.createdAt)}>
                          {formaterDate(derniere.createdAt)}
                        </time>{" "}
                        — {derniere.crees} créé(s), {derniere.majs} mis à jour
                      </>
                    ) : (
                      "Jamais synchronisée."
                    )}
                  </span>
                </div>

                <button
                  type="button"
                  className="btn btn-secondaire btn-compact"
                  onClick={() => synchroniser(s.id)}
                  disabled={enCours}
                >
                  {active === s.id ? "Synchronisation…" : "Mettre à jour"}
                  <span className="sr-only"> {s.libelle}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="carte" aria-labelledby="titre-journal">
        <h2 id="titre-journal">Journal des synchronisations</h2>

        {data.recentes.length === 0 ? (
          <p className="admin-vide">Aucune synchronisation enregistrée.</p>
        ) : (
          <div className="tableau-enveloppe">
            <table className="tableau">
              <caption className="sr-only">
                Les {data.recentes.length} dernières synchronisations
              </caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Source</th>
                  <th scope="col">Déclenchée depuis</th>
                  <th scope="col">Résultat</th>
                  <th scope="col">Durée</th>
                </tr>
              </thead>
              <tbody>
                {data.recentes.map((r) => (
                  <tr key={r._id}>
                    <td>
                      <time dateTime={dateIso(r.createdAt)}>
                        {formaterDate(r.createdAt)}
                      </time>
                    </td>
                    <td>{r.libelle || r.source}</td>
                    <td>
                      {r.declencheur === "administration"
                        ? "l'interface"
                        : r.declencheur === "console"
                          ? "la console"
                          : "une tâche planifiée"}
                    </td>
                    <td>
                      {/* Le statut n'est jamais porté par la seule couleur :
                          un mot le dit aussi. */}
                      {r.statut === "succes" ? (
                        <span className="pastille pastille--ok">
                          {r.crees} créé(s), {r.majs} màj
                        </span>
                      ) : r.statut === "echec" ? (
                        <span className="pastille pastille--ko">
                          Échec — {r.message}
                        </span>
                      ) : (
                        <span className="pastille">En cours</span>
                      )}
                    </td>
                    <td>{duree(r.dureeMs || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="carte" aria-labelledby="titre-console">
        <h2 id="titre-console">Depuis la console</h2>
        <p className="admin-intro">
          Les mêmes synchronisations, utiles à l'installation — avant qu'aucun
          compte n'existe — et pour une tâche planifiée.
        </p>
        <pre className="admin-code">
{`npm run data:metiers    # référentiel des métiers
npm run data:avps       # offres ouvertes (Hugging Face)
npm run data:archive    # archive mensuelle (Hugging Face)
npm run data:datagouv   # avis DRHFPNC (data.gouv.nc)
npm run data:tout       # les quatre, dans l'ordre`}
        </pre>
      </section>
    </>
  );
};

export default AdminDonneesScreen;
