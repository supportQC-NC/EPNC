// src/screens/VivierScreen/VivierScreen.jsx
//
// Le vivier : les candidats qui ont rendu leur profil consultable.
//
// Pendant que le candidat regarde des offres, le recruteur regarde des
// profils. C'est la seconde direction du rapprochement, que le règlement
// demande explicitement — et elle n'a de sens que si le recruteur peut
// chercher, pas seulement faire défiler.
import { useState } from "react";
import { Link } from "react-router-dom";
import { useGetCandidatsQuery } from "../../slices/recruteurApiSlice";
import { messageErreur } from "../../utils/erreurApi";
import { formaterDate, dateIso } from "../../utils/format";
import "./VivierScreen.css";

const NIVEAUX = {
  notions: "Notions",
  pratique: "Pratique",
  maitrise: "Maîtrise",
  expert: "Expert",
};

const initiales = (prenom, nom) =>
  [prenom, nom]
    .filter(Boolean)
    .map((m) => m[0]?.toUpperCase())
    .join("");

const Carte = ({ c }) => (
  <article className="candidat-carte">
    <div className="candidat-haut">
      {c.photo ? (
        <img className="candidat-photo" src={c.photo} alt="" />
      ) : (
        <div className="candidat-photo candidat-photo--vide" aria-hidden="true">
          {initiales(c.prenom, c.nom)}
        </div>
      )}

      <div className="candidat-identite">
        <h2 className="candidat-nom">
          {/* Le lien porte le nom : c'est lui qu'annonce un lecteur d'écran
              qui parcourt les liens de la page. */}
          <Link to={`/vivier/${c.id}`}>
            {c.prenom} {c.nom}
          </Link>
        </h2>
        {c.titre && <p className="candidat-titre">{c.titre}</p>}
        <p className="candidat-lieu">
          {[c.ville, c.province].filter(Boolean).join(" · ") ||
            "Localisation non précisée"}
        </p>
      </div>
    </div>

    {c.accroche && <p className="candidat-accroche">{c.accroche}</p>}

    <dl className="candidat-chiffres">
      <div>
        <dt>Expériences</dt>
        <dd>{c.nbExperiences}</dd>
      </div>
      <div>
        <dt>Compétences</dt>
        <dd>{c.nbCompetences}</dd>
      </div>
      {c.disponibilite && (
        <div>
          <dt>Disponible</dt>
          <dd>{c.disponibilite}</dd>
        </div>
      )}
    </dl>

    {c.competences.length > 0 && (
      <ul className="candidat-competences">
        {c.competences.map((comp, i) => (
          <li key={i}>
            {comp.nom}
            <span className="candidat-niveau">
              {NIVEAUX[comp.niveau] || comp.niveau}
            </span>
          </li>
        ))}
        {c.nbCompetences > c.competences.length && (
          <li className="candidat-competences-reste">
            + {c.nbCompetences - c.competences.length}
          </li>
        )}
      </ul>
    )}

    <p className="candidat-pied">
      Profil mis à jour le{" "}
      <time dateTime={dateIso(c.majLe)}>{formaterDate(c.majLe)}</time>
      {" · "}
      <Link to={`/vivier/${c.id}`}>Voir le parcours complet</Link>
    </p>
  </article>
);

const VivierScreen = () => {
  const [filtres, setFiltres] = useState({
    q: "",
    competence: "",
    province: "",
    ville: "",
    permis: "",
  });

  const { data, isLoading, isError, error, isFetching } =
    useGetCandidatsQuery(filtres);

  const maj = (champ) => (e) =>
    setFiltres((f) => ({ ...f, [champ]: e.target.value }));

  const reinitialiser = () =>
    setFiltres({ q: "", competence: "", province: "", ville: "", permis: "" });

  const filtreActif = Object.values(filtres).some(Boolean);

  return (
    <div className="conteneur conteneur--large vivier">
      <header className="vivier-entete">
        <h1>Les candidats</h1>
        <p className="vivier-intro">
          Les personnes qui ont choisi de rendre leur profil consultable par les
          recruteurs. Chacune l'a décidé explicitement : ce n'est pas un annuaire
          de tous les comptes, et un profil disparaît d'ici dès que son
          propriétaire le décoche.
        </p>
      </header>

      {isError && (
        <div className="message message-erreur" role="alert">
          {messageErreur(error, "Impossible de charger les profils.")}
        </div>
      )}

      <form
        className="vivier-filtres"
        role="search"
        aria-label="Rechercher un candidat"
        onSubmit={(e) => e.preventDefault()}
      >
        <div className="champ vivier-champ-large">
          <label htmlFor="f-q">Recherche</label>
          <input
            id="f-q"
            type="search"
            value={filtres.q}
            onChange={maj("q")}
            aria-describedby="aide-q"
            placeholder="juridique, fibre optique, budget…"
          />
          <span id="aide-q" className="champ-aide">
            Cherche dans l'intitulé, la présentation, les postes occupés, les
            formations et les compétences. Tous les mots saisis doivent être
            présents.
          </span>
        </div>

        <div className="champ">
          <label htmlFor="f-competence">Compétence</label>
          {/* `datalist` plutôt qu'une liste fermée : le vocabulaire proposé
              vient des profils réellement présents, mais une recherche libre
              reste possible. */}
          <input
            id="f-competence"
            type="text"
            list="vivier-competences"
            value={filtres.competence}
            onChange={maj("competence")}
            autoComplete="off"
            placeholder="Commencez à taper…"
          />
          <datalist id="vivier-competences">
            {(data?.filtres?.competences || []).map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>

        <div className="champ">
          <label htmlFor="f-province">Province</label>
          <select id="f-province" value={filtres.province} onChange={maj("province")}>
            <option value="">Toutes</option>
            {(data?.filtres?.provinces || []).map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div className="champ">
          <label htmlFor="f-ville">Commune</label>
          <input
            id="f-ville"
            type="text"
            value={filtres.ville}
            onChange={maj("ville")}
          />
        </div>

        <div className="champ">
          <label htmlFor="f-permis">Permis</label>
          <select id="f-permis" value={filtres.permis} onChange={maj("permis")}>
            <option value="">Indifférent</option>
            {["A", "A2", "B", "C", "D", "E"].map((p) => (
              <option key={p} value={p}>
                Permis {p}
              </option>
            ))}
          </select>
        </div>

        {filtreActif && (
          <button
            type="button"
            className="btn btn-secondaire btn-compact vivier-reset"
            onClick={reinitialiser}
          >
            Effacer les filtres
          </button>
        )}
      </form>

      {/* Le nombre de résultats change à chaque frappe : il doit être annoncé
          autrement que visuellement. */}
      <p className="vivier-compte" aria-live="polite">
        {isLoading
          ? "Chargement des profils…"
          : data
            ? // L'accord suit le nombre : « 1 profil correspond », pas
              // « 1 profil correspondent ». Un texte produit par
              // concaténation se trahit toujours au singulier.
              `${data.total} profil${data.total > 1 ? "s" : ""} ${
                filtreActif
                  ? data.total > 1
                    ? "correspondent"
                    : "correspond"
                  : data.total > 1
                    ? "consultables"
                    : "consultable"
              }${
                filtreActif && data.totalVisibles > data.total
                  ? ` sur ${data.totalVisibles}`
                  : ""
              }`
            : ""}
        {isFetching && !isLoading && " · mise à jour…"}
      </p>

      {data && data.total === 0 && (
        <p className="vivier-vide">
          {filtreActif
            ? "Aucun profil ne correspond à ces critères. Élargissez la recherche."
            : "Aucun profil n'est consultable pour l'instant. Les candidats doivent activer la visibilité depuis leur profil."}
        </p>
      )}

      {data && data.total > 0 && (
        <ul className="vivier-liste">
          {data.candidats.map((c) => (
            <li key={c.id}>
              <Carte c={c} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default VivierScreen;
