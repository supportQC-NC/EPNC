// src/screens/admin/AdminSourcesScreen.jsx
import { useGetSourcesQuery } from "../../slices/adminApiSlice";
import { formaterDate } from "../../utils/format";
import { messageErreur } from "../../utils/erreurApi";
import "./admin.css";

const LIBELLES_TYPE = {
  donnees: "Données",
  flux: "Flux",
  site: "Site",
  documentation: "Documentation",
};

const AdminSourcesScreen = () => {
  const { data, isLoading, isFetching, isError, error, refetch } =
    useGetSourcesQuery();

  if (isLoading) {
    return (
      <p role="status">
        Interrogation des sources en cours… chaque serveur est contacté
        réellement, comptez quelques secondes.
      </p>
    );
  }

  if (isError) {
    return (
      <div className="message message-erreur" role="alert">
        {messageErreur(error, "Impossible de contrôler les sources.")}
      </div>
    );
  }

  const { resume, sources } = data;

  // Regroupement par catégorie : douze lignes à plat ne se lisent pas, et les
  // sources vont par famille (offres, référentiel, open data).
  const categories = [...new Set(sources.map((s) => s.categorie))];

  return (
    <>
      <div className="admin-titre-ligne">
        <h1 className="admin-titre">Sources de données</h1>
        <button
          type="button"
          className="btn btn-secondaire btn-compact"
          onClick={refetch}
          disabled={isFetching}
        >
          {isFetching ? "Contrôle en cours…" : "Recontrôler"}
        </button>
      </div>

      <ul className="tuiles">
        <li className="tuile">
          <span className="tuile-valeur">
            {resume.joignables}/{resume.total}
          </span>
          <span className="tuile-libelle">sources joignables</span>
          <span className="tuile-precision">
            {resume.injoignables === 0
              ? "toutes répondent"
              : `${resume.injoignables} ne répond${resume.injoignables > 1 ? "ent" : ""} pas`}
          </span>
        </li>

        <li className={`tuile${resume.ingereesVides > 0 ? " tuile--alerte" : ""}`}>
          <span className="tuile-valeur">{resume.ingerees}</span>
          <span className="tuile-libelle">sources ingérées</span>
          <span className="tuile-precision">
            {resume.ingereesVides === 0
              ? "toutes ont fourni des données"
              : `${resume.ingereesVides} sans aucune donnée reçue`}
          </span>
        </li>

        <li className="tuile tuile--accent">
          <span className="tuile-valeur">{resume.documentsEnBase}</span>
          <span className="tuile-libelle">documents en base</span>
          <span className="tuile-precision">offres, métiers, compétences</span>
        </li>

        <li className="tuile">
          <span className="tuile-valeur">{resume.total - resume.ingerees}</span>
          <span className="tuile-libelle">sources suivies</span>
          <span className="tuile-precision">disponibles, pas encore exploitées</span>
        </li>
      </ul>

      {resume.ingereesVides > 0 && (
        <div className="message message-erreur" role="alert">
          Une source ingérable n'a fourni aucune donnée : le script
          d'ingestion n'a jamais tourné, ou il a échoué. Lancez la commande
          indiquée sur la ligne concernée.
        </div>
      )}

      {categories.map((categorie) => (
        <section key={categorie} className="sources-groupe">
          <h2>{categorie}</h2>

          <ul className="sources-liste">
            {sources
              .filter((s) => s.categorie === categorie)
              .map((s) => (
                <li key={s.id} className="source">
                  <div className="source-haut">
                    <h3>{s.nom}</h3>
                    {/* L'état est porté par un mot, pas seulement par une
                        couleur : « OK » ou « Injoignable » se lit en noir et
                        blanc comme à l'écran d'un daltonien. */}
                    <span
                      className={`source-etat source-etat--${s.sonde.statut}`}
                    >
                      {s.sonde.statut === "ok" ? "Répond" : "Injoignable"}
                      {s.sonde.code ? ` · ${s.sonde.code}` : ""}
                      {s.sonde.statut === "ok" ? ` · ${s.sonde.ms} ms` : ""}
                    </span>
                  </div>

                  <p className="source-role">{s.role}</p>

                  {s.sonde.message && (
                    <p className="source-erreur">{s.sonde.message}</p>
                  )}

                  <dl className="source-details">
                    <div>
                      <dt>Type</dt>
                      <dd>{LIBELLES_TYPE[s.type] || s.type}</dd>
                    </div>

                    <div>
                      <dt>Reçu en base</dt>
                      <dd>
                        {s.ingeree ? (
                          s.recu?.total > 0 ? (
                            <>
                              <strong>{s.recu.total}</strong> document
                              {s.recu.total > 1 ? "s" : ""}
                              {s.recu.majLe && (
                                <span className="source-maj">
                                  {" "}
                                  — {formaterDate(s.recu.majLe)}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="source-vide">aucune donnée</span>
                          )
                        ) : (
                          <span className="source-maj">non ingérée</span>
                        )}
                      </dd>
                    </div>

                    {s.commande && (
                      <div>
                        <dt>Mise à jour</dt>
                        <dd>
                          <code>{s.commande}</code>
                        </dd>
                      </div>
                    )}
                  </dl>

                  <p className="source-url">
                    <a href={s.url} target="_blank" rel="noreferrer noopener">
                      {s.url}
                    </a>
                  </p>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </>
  );
};

export default AdminSourcesScreen;
