// src/screens/MetiersScreen/MetiersScreen.jsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { useGetReferentielQuery } from "../../slices/metierApiSlice";
import { messageErreur } from "../../utils/erreurApi";
import "./MetiersScreen.css";

const MetiersScreen = () => {
  const [recherche, setRecherche] = useState("");
  const [famille, setFamille] = useState("");
  const [avecOffre, setAvecOffre] = useState(false);

  const { data, isLoading, isError, error } = useGetReferentielQuery();

  if (isLoading) {
    return (
      <div className="conteneur metiers">
        <p role="status">Chargement du référentiel…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="conteneur metiers">
        <div className="message message-erreur" role="alert">
          {messageErreur(error, "Référentiel indisponible.")}
        </div>
      </div>
    );
  }

  const normaliser = (t) =>
    (t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  const terme = normaliser(recherche);

  const visibles = data.metiers.filter((m) => {
    if (famille && m.familleCode !== famille) return false;
    if (avecOffre && m.offresOuvertes === 0) return false;
    if (terme && !normaliser(m.nom).includes(terme)) return false;
    return true;
  });

  return (
    <div className="conteneur metiers">
      <header className="metiers-entete">
        <h1>Les métiers de l'OPT-NC</h1>
        <p className="metiers-intro">
          Le référentiel complet de l'employeur : ce que chaque métier exige,
          avec le poids et le niveau attendu pour chaque compétence. Vous
          pouvez viser un métier bien avant qu'un poste s'ouvre.
        </p>

        <ul className="metiers-totaux">
          <li>
            <strong>{data.totaux.familles}</strong> familles
          </li>
          <li>
            <strong>{data.totaux.metiers}</strong> métiers
          </li>
          <li>
            <strong>{data.totaux.competences}</strong> compétences
          </li>
          <li>
            <strong>{data.totaux.liaisons}</strong> exigences décrites
          </li>
        </ul>
      </header>

      <form className="metiers-filtres" role="search" onSubmit={(e) => e.preventDefault()}>
        <div className="champ metiers-recherche">
          <label htmlFor="recherche">Rechercher un métier</label>
          <input
            id="recherche"
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="juriste, technicien, conseiller…"
          />
        </div>

        <div className="champ">
          <label htmlFor="famille">Famille</label>
          <select
            id="famille"
            value={famille}
            onChange={(e) => setFamille(e.target.value)}
          >
            <option value="">Toutes</option>
            {data.familles.map((f) => (
              <option key={f.code} value={f.code}>
                {f.libelle} ({f.nbMetiers})
              </option>
            ))}
          </select>
        </div>

        <label className="metiers-case">
          <input
            type="checkbox"
            checked={avecOffre}
            onChange={(e) => setAvecOffre(e.target.checked)}
          />
          Seulement ceux qui recrutent
        </label>
      </form>

      <p className="metiers-compte" aria-live="polite">
        {visibles.length} métier{visibles.length > 1 ? "s" : ""}
      </p>

      {visibles.length === 0 ? (
        <p className="metiers-vide">Aucun métier ne correspond à ces critères.</p>
      ) : (
        <ul className="metiers-liste">
          {visibles.map((m) => (
            <li key={m.code}>
              <Link to={`/metiers/${m.code}`} className="metier-carte">
                <span className="metier-nom">{m.nom}</span>
                <span className="metier-meta">
                  {m.code} · {m.nbCompetences} compétence
                  {m.nbCompetences > 1 ? "s" : ""} attendue
                  {m.nbCompetences > 1 ? "s" : ""}
                </span>
                {m.offresOuvertes > 0 && (
                  <span className="metier-offre">
                    {m.offresOuvertes} poste{m.offresOuvertes > 1 ? "s" : ""} ouvert
                    {m.offresOuvertes > 1 ? "s" : ""}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default MetiersScreen;
