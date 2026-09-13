// src/screens/admin/AdminUtilisateursScreen.jsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  useGetUsersQuery,
  useToggleUserActiveMutation,
  useDeleteUserMutation,
} from "../../slices/adminApiSlice";
import { ROLES, libelleRole } from "../../constants";
import { formaterDateCourte, dateIso } from "../../utils/format";
import "./admin.css";
import { messageErreur } from "../../utils/erreurApi";

const AdminUtilisateursScreen = () => {
  const { userInfo } = useSelector((state) => state.auth);

  const [recherche, setRecherche] = useState("");
  const [role, setRole] = useState("");
  const [actif, setActif] = useState("");
  // Identifiant du compte dont la suppression attend confirmation.
  const [aConfirmer, setAConfirmer] = useState(null);
  const [erreur, setErreur] = useState("");

  const { data, isLoading, isError, error } = useGetUsersQuery({
    ...(recherche ? { recherche } : {}),
    ...(role ? { role } : {}),
    ...(actif ? { actif } : {}),
  });

  const [toggleActive, { isLoading: bascule }] = useToggleUserActiveMutation();
  const [supprimer, { isLoading: suppression }] = useDeleteUserMutation();

  // Les refus viennent du serveur (dernier administrateur, action sur son
  // propre compte…) : on affiche son message plutôt que d'en réinventer un,
  // sinon les deux finissent par diverger.
  const executer = async (action) => {
    setErreur("");
    try {
      await action().unwrap();
      setAConfirmer(null);
    } catch (err) {
      setErreur(messageErreur(err, "L'opération a échoué."));
    }
  };

  return (
    <>
      <div className="admin-titre-ligne">
        <h1 className="admin-titre">Comptes</h1>
        <Link to="/admin/utilisateurs/nouveau" className="btn btn-principal btn-compact">
          Créer un compte
        </Link>
      </div>

      {erreur && (
        <div className="message message-erreur" role="alert">
          {erreur}
        </div>
      )}

      {/* ── Filtres ──────────────────────────────────────────────────── */}
      {/* `role="search"` et un titre caché : la zone est atteignable
          directement par les technologies d'assistance. */}
      <form
        className="filtres"
        role="search"
        onSubmit={(e) => e.preventDefault()}
      >
        <div className="champ filtre-recherche">
          <label htmlFor="recherche">Rechercher</label>
          <input
            id="recherche"
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Nom, prénom ou email"
          />
        </div>

        <div className="champ">
          <label htmlFor="filtre-role">Rôle</label>
          <select
            id="filtre-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="">Tous</option>
            {ROLES.map((r) => (
              <option key={r.valeur} value={r.valeur}>
                {r.libelle}
              </option>
            ))}
          </select>
        </div>

        <div className="champ">
          <label htmlFor="filtre-actif">État</label>
          <select
            id="filtre-actif"
            value={actif}
            onChange={(e) => setActif(e.target.value)}
          >
            <option value="">Tous</option>
            <option value="1">Actifs</option>
            <option value="0">Désactivés</option>
          </select>
        </div>
      </form>

      {isLoading && <p role="status">Chargement des comptes…</p>}

      {isError && (
        <div className="message message-erreur" role="alert">
          {messageErreur(error, "Impossible de charger les comptes.")}
        </div>
      )}

      {data && (
        <>
          <p className="admin-compte-resultats" aria-live="polite">
            {data.total} compte{data.total > 1 ? "s" : ""}
          </p>

          {data.comptes.length === 0 ? (
            <p className="carte-vide">Aucun compte ne correspond à ces critères.</p>
          ) : (
            <div className="tableau-enveloppe">
              <table className="tableau">
                <caption className="sr-only">
                  Liste des comptes, du plus récent au plus ancien
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Personne</th>
                    <th scope="col">Rôle</th>
                    <th scope="col" className="col-secondaire">
                      Créé le
                    </th>
                    <th scope="col" className="col-secondaire">
                      Dernière connexion
                    </th>
                    <th scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.comptes.map((u) => {
                    const soiMeme = u._id === userInfo?._id;
                    const enConfirmation = aConfirmer === u._id;

                    return (
                      <tr key={u._id} className={u.isActive ? "" : "ligne-inactive"}>
                        <td>
                          <Link
                            to={`/admin/utilisateurs/${u._id}`}
                            className="cellule-nom"
                          >
                            {u.prenom} {u.nom}
                          </Link>
                          <span className="cellule-email">{u.email}</span>
                          {!u.isActive && (
                            <span className="etiquette">Désactivé</span>
                          )}
                          {soiMeme && <span className="etiquette">Vous</span>}
                        </td>

                        <td>{libelleRole(u.role)}</td>

                        <td className="col-secondaire">
                          <time dateTime={dateIso(u.createdAt)}>
                            {formaterDateCourte(u.createdAt)}
                          </time>
                        </td>

                        <td className="col-secondaire">
                          {u.lastLogin ? (
                            <time dateTime={dateIso(u.lastLogin)}>
                              {formaterDateCourte(u.lastLogin)}
                            </time>
                          ) : (
                            <span className="jamais">jamais</span>
                          )}
                        </td>

                        <td>
                          {/* Confirmation en ligne plutôt qu'une boîte de
                              dialogue native : elle reste dans le flux, se
                              navigue au clavier et ne bloque pas la page. */}
                          {enConfirmation ? (
                            <div className="actions-ligne">
                              <span className="confirmation-texte">
                                Supprimer définitivement ?
                              </span>
                              <button
                                type="button"
                                className="btn btn-danger btn-compact"
                                disabled={suppression}
                                onClick={() => executer(() => supprimer(u._id))}
                              >
                                Oui, supprimer
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondaire btn-compact"
                                onClick={() => setAConfirmer(null)}
                              >
                                Annuler
                              </button>
                            </div>
                          ) : (
                            <div className="actions-ligne">
                              <Link
                                to={`/admin/utilisateurs/${u._id}`}
                                className="btn btn-secondaire btn-compact"
                              >
                                Modifier
                                <span className="sr-only">
                                  {" "}
                                  le compte de {u.prenom} {u.nom}
                                </span>
                              </Link>

                              <button
                                type="button"
                                className="btn btn-secondaire btn-compact"
                                disabled={bascule || soiMeme}
                                onClick={() =>
                                  executer(() => toggleActive(u._id))
                                }
                              >
                                {u.isActive ? "Désactiver" : "Réactiver"}
                                <span className="sr-only">
                                  {" "}
                                  le compte de {u.prenom} {u.nom}
                                </span>
                              </button>

                              <button
                                type="button"
                                className="btn btn-secondaire btn-compact"
                                disabled={soiMeme}
                                onClick={() => setAConfirmer(u._id)}
                              >
                                Supprimer
                                <span className="sr-only">
                                  {" "}
                                  le compte de {u.prenom} {u.nom}
                                </span>
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
};

export default AdminUtilisateursScreen;
