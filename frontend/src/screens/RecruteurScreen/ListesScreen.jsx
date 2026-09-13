// src/screens/RecruteurScreen/ListesScreen.jsx
//
// Les listes de candidats mis de côté.
//
// Le geste naturel de quelqu'un qui dépouille : garder maintenant, décider plus
// tard. Les listes sont nommées par le recruteur, parce que « Favoris » ne dit
// rien alors que « À rappeler après le 15 » dit tout.
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  useGetListesQuery,
  useCreerListeMutation,
  useSupprimerListeMutation,
  useRetirerCandidatListeMutation,
} from "../../slices/recruteurEspaceApiSlice";
import { messageErreur } from "../../utils/erreurApi";
import { formaterDate, dateIso } from "../../utils/format";
import "./recruteur.css";

const ListesScreen = () => {
  const { data: listes, isLoading, isError, error } = useGetListesQuery();
  const [creer, { isLoading: creation }] = useCreerListeMutation();
  const [supprimer] = useSupprimerListeMutation();
  const [retirer] = useRetirerCandidatListeMutation();

  const [nom, setNom] = useState("");
  const [description, setDescription] = useState("");
  const [erreur, setErreur] = useState("");
  const [aSupprimer, setASupprimer] = useState(null);

  const soumettre = async (e) => {
    e.preventDefault();
    setErreur("");
    try {
      await creer({ nom, description }).unwrap();
      setNom("");
      setDescription("");
    } catch (err) {
      setErreur(messageErreur(err, "Impossible de créer cette liste."));
    }
  };

  if (isLoading) {
    return (
      <div className="conteneur conteneur--large recruteur">
        <p role="status">Chargement de vos listes…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="conteneur conteneur--large recruteur">
        <div className="message message-erreur" role="alert">
          {messageErreur(error, "Impossible de charger vos listes.")}
        </div>
      </div>
    );
  }

  return (
    <div className="conteneur conteneur--large recruteur">
      <header className="recruteur-entete">
        <h1>Vos listes</h1>
        <p className="recruteur-intro">
          Mettez de côté les profils qui vous intéressent, avec une note pour
          vous rappeler pourquoi. Ce que vous enregistrez sert aussi à affiner
          les profils qui vous sont suggérés.
        </p>
      </header>

      {erreur && (
        <div className="message message-erreur" role="alert">
          {erreur}
        </div>
      )}

      <section className="carte" aria-labelledby="titre-nouvelle">
        <h2 id="titre-nouvelle">Nouvelle liste</h2>
        <form onSubmit={soumettre} className="liste-formulaire">
          <div className="champ">
            <label htmlFor="liste-nom">Nom</label>
            <input
              id="liste-nom"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              required
              placeholder="À rappeler, Profils techniques, Poste de gestionnaire…"
            />
          </div>
          <div className="champ">
            <label htmlFor="liste-description">Description (facultative)</label>
            <input
              id="liste-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="btn btn-principal"
            disabled={creation || !nom.trim()}
          >
            {creation ? "Création…" : "Créer la liste"}
          </button>
        </form>
      </section>

      {listes.length === 0 ? (
        <p className="recruteur-vide">
          Aucune liste pour l'instant. Créez-en une, puis mettez des profils de
          côté depuis <Link to="/vivier">les candidats</Link>.
        </p>
      ) : (
        listes.map((liste) => (
          <section key={liste._id} className="carte liste-bloc">
            <div className="recruteur-section-entete">
              <div>
                <h2>{liste.nom}</h2>
                {liste.description && (
                  <p className="liste-description">{liste.description}</p>
                )}
                {liste.avpIntitule && (
                  <p className="liste-description">
                    Rattachée à : {liste.avpIntitule}
                  </p>
                )}
              </div>
              <span className="liste-compte">
                {liste.nbEntrees} profil{liste.nbEntrees > 1 ? "s" : ""}
              </span>
            </div>

            {liste.entrees.length === 0 ? (
              <p className="recruteur-vide">
                Liste vide. Ajoutez des profils depuis{" "}
                <Link to="/vivier">les candidats</Link>.
              </p>
            ) : (
              <ul className="liste-entrees">
                {liste.entrees.map((e) => (
                  <li key={e.profilId}>
                    <div className="liste-entree-info">
                      {/* Un profil dont la visibilité a été retirée reste
                          nommé — le recruteur l'avait déjà consulté — mais
                          n'est plus ouvrable. Le dire vaut mieux qu'un lien
                          qui mène à une erreur. */}
                      {e.consultable ? (
                        <Link to={`/vivier/${e.profilId}`}>
                          {e.prenom} {e.nom}
                        </Link>
                      ) : (
                        <span className="liste-entree-retire">
                          {e.prenom} {e.nom} — profil retiré par la personne
                        </span>
                      )}
                      {e.titre && <span className="liste-entree-titre">{e.titre}</span>}
                      {e.note && <p className="liste-entree-note">{e.note}</p>}
                      <span className="liste-entree-date">
                        ajouté le{" "}
                        <time dateTime={dateIso(e.ajouteLe)}>
                          {formaterDate(e.ajouteLe)}
                        </time>
                      </span>
                    </div>

                    <button
                      type="button"
                      className="btn btn-secondaire btn-compact"
                      onClick={() =>
                        retirer({ id: liste._id, profilId: e.profilId })
                      }
                    >
                      Retirer
                      <span className="sr-only">
                        {" "}
                        {e.prenom} {e.nom} de « {liste.nom} »
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="actions">
              {aSupprimer === liste._id ? (
                <>
                  <button
                    type="button"
                    className="btn btn-danger btn-compact"
                    onClick={async () => {
                      await supprimer(liste._id);
                      setASupprimer(null);
                    }}
                  >
                    Oui, supprimer « {liste.nom} »
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondaire btn-compact"
                    onClick={() => setASupprimer(null)}
                  >
                    Annuler
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn btn-secondaire btn-compact"
                  onClick={() => setASupprimer(liste._id)}
                >
                  Supprimer cette liste
                </button>
              )}
            </div>
          </section>
        ))
      )}
    </div>
  );
};

export default ListesScreen;
