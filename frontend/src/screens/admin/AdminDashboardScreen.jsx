// src/screens/admin/AdminDashboardScreen.jsx
import { Link } from "react-router-dom";
import { useGetDashboardQuery } from "../../slices/adminApiSlice";
import { libelleRole } from "../../constants";
import { formaterDate, formaterDateCourte, dateIso } from "../../utils/format";
import "./admin.css";
import { messageErreur } from "../../utils/erreurApi";

// Tuile de chiffre. `accent` met en avant la valeur qui appelle une action.
const Tuile = ({ valeur, libelle, precision, accent = false }) => (
  <li className={`tuile${accent ? " tuile--accent" : ""}`}>
    <span className="tuile-valeur">{valeur}</span>
    <span className="tuile-libelle">{libelle}</span>
    {precision && <span className="tuile-precision">{precision}</span>}
  </li>
);

const AdminDashboardScreen = () => {
  const { data, isLoading, isError, error } = useGetDashboardQuery();

  if (isLoading) return <p role="status">Chargement du tableau de bord…</p>;

  if (isError) {
    return (
      <div className="message message-erreur" role="alert">
        {messageErreur(error, "Impossible de charger le tableau de bord.")}
      </div>
    );
  }

  const { comptes, offres } = data;

  return (
    <>
      <h1 className="admin-titre">Tableau de bord</h1>

      {/* ── Chiffres ─────────────────────────────────────────────────── */}
      <section aria-labelledby="titre-chiffres">
        <h2 id="titre-chiffres" className="sr-only">
          Chiffres clés
        </h2>
        <ul className="tuiles">
          <Tuile
            valeur={comptes.total}
            libelle={comptes.total > 1 ? "comptes" : "compte"}
            precision={
              comptes.desactives > 0
                ? `dont ${comptes.desactives} désactivé${comptes.desactives > 1 ? "s" : ""}`
                : "tous actifs"
            }
          />
          <Tuile
            valeur={comptes.inscriptionsRecentes}
            libelle="inscriptions"
            precision="ces 7 derniers jours"
          />
          <Tuile
            valeur={offres.ouvertes}
            libelle={offres.ouvertes > 1 ? "offres ouvertes" : "offre ouverte"}
            precision="candidatures possibles"
            accent
          />
          <Tuile
            valeur={offres.total}
            libelle="offres en base"
            precision={`dont ${offres.cloturees} clôturée${offres.cloturees > 1 ? "s" : ""}`}
          />
        </ul>
      </section>

      <div className="admin-colonnes">
        {/* ── Répartition des comptes ────────────────────────────────── */}
        <section className="carte" aria-labelledby="titre-roles">
          <h2 id="titre-roles">Répartition des comptes</h2>

          <ul className="liste-repartition">
            {Object.entries(comptes.parRole).map(([role, total]) => (
              <li key={role}>
                <span>{libelleRole(role)}</span>
                <span className="repartition-valeur">{total}</span>
              </li>
            ))}
          </ul>

          <p className="carte-action">
            <Link to="/admin/utilisateurs">Gérer les comptes</Link>
          </p>
        </section>

        {/* ── Dernières inscriptions ─────────────────────────────────── */}
        <section className="carte" aria-labelledby="titre-inscrits">
          <h2 id="titre-inscrits">Dernières inscriptions</h2>

          {comptes.derniersInscrits.length === 0 ? (
            <p className="carte-vide">Aucun compte pour le moment.</p>
          ) : (
            <ul className="liste-inscrits">
              {comptes.derniersInscrits.map((u) => (
                <li key={u._id}>
                  <Link to={`/admin/utilisateurs/${u._id}`}>
                    {u.prenom} {u.nom}
                  </Link>
                  <span className="inscrit-meta">
                    {libelleRole(u.role)}
                    {!u.isActive && " · désactivé"}
                    {" · "}
                    <time dateTime={dateIso(u.createdAt)}>
                      {formaterDateCourte(u.createdAt)}
                    </time>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── État des données ───────────────────────────────────────── */}
        <section className="carte" aria-labelledby="titre-donnees">
          <h2 id="titre-donnees">État des données</h2>

          <dl className="liste-etat">
            <div>
              <dt>Dernière synchronisation</dt>
              <dd>
                {offres.derniereSynchro
                  ? formaterDate(offres.derniereSynchro)
                  : "jamais"}
              </dd>
            </div>

            <div>
              <dt>Offre la plus récente</dt>
              <dd>
                {offres.laPlusRecente ? (
                  <Link to={`/offres/${offres.laPlusRecente.slug}`}>
                    {offres.laPlusRecente.intitule}
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
            </div>

            <div>
              <dt>Prochaine clôture</dt>
              <dd>
                {offres.prochaineCloture ? (
                  <>
                    <Link to={`/offres/${offres.prochaineCloture.slug}`}>
                      {offres.prochaineCloture.intitule}
                    </Link>
                    <span className="etat-precision">
                      {" "}
                      — {formaterDate(offres.prochaineCloture.dateLimite)}
                    </span>
                  </>
                ) : (
                  "aucune offre ouverte"
                )}
              </dd>
            </div>

            {comptes.derniereConnexion && (
              <div>
                <dt>Dernière connexion</dt>
                <dd>
                  {comptes.derniereConnexion.prenom}{" "}
                  {comptes.derniereConnexion.nom}
                  <span className="etat-precision">
                    {" "}
                    — {formaterDate(comptes.derniereConnexion.lastLogin)}
                  </span>
                </dd>
              </div>
            )}
          </dl>

          {/* Le corpus se renouvelle en quelques semaines : un tableau de bord
              d'administration doit dire comment le rafraîchir, pas laisser
              chercher la commande dans le dépôt. */}
          <p className="carte-note">
            Pour actualiser les offres depuis le dataset public :{" "}
            <code>npm run data:avps</code>
          </p>
        </section>
      </div>
    </>
  );
};

export default AdminDashboardScreen;
