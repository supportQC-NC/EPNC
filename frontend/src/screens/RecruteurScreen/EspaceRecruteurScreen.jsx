// src/screens/RecruteurScreen/EspaceRecruteurScreen.jsx
//
// Le tableau de bord du recruteur.
//
// Il ne cherche pas un poste : il cherche des gens, et il suit ceux qu'il a
// repérés. L'écran répond donc à trois questions, dans cet ordre : qu'est-ce
// que j'ai mis de côté, qui devrais-je regarder, et où en sont mes offres.
import { Link } from "react-router-dom";
import {
  useGetTableauDeBordRecruteurQuery,
  useGetSuggestionsQuery,
} from "../../slices/recruteurEspaceApiSlice";
import { messageErreur } from "../../utils/erreurApi";
import { formaterDate, dateIso } from "../../utils/format";
import SuggestionCarte from "./SuggestionCarte";
import "./recruteur.css";

const EspaceRecruteurScreen = () => {
  const { data, isLoading, isError, error } = useGetTableauDeBordRecruteurQuery();
  const { data: suggestions } = useGetSuggestionsQuery();

  if (isLoading) {
    return (
      <div className="conteneur conteneur--large recruteur">
        <p role="status">Chargement de votre espace…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="conteneur conteneur--large recruteur">
        <div className="message message-erreur" role="alert">
          {messageErreur(error, "Impossible de charger votre espace.")}
        </div>
      </div>
    );
  }

  const { chiffres, profil } = data;

  return (
    <div className="conteneur conteneur--large recruteur">
      <header className="recruteur-entete">
        {/* Le logo, quand il existe, plutôt qu'un bandeau générique : sur un
            outil où plusieurs organisations se connectent au même endroit, il
            dit en un coup d'œil « vous êtes bien chez vous ». Purement
            décoratif ici — l'organisation est écrite juste à côté. */}
        {profil.logo && (
          <img className="recruteur-logo" src={profil.logo} alt="" />
        )}
        <div>
          <h1>Votre espace</h1>
          <p className="recruteur-intro">
            {profil.organisation
              ? `${profil.fonction ? `${profil.fonction} · ` : ""}${profil.organisation}`
              : "Renseignez votre organisation pour que vos offres remontent ici."}
          </p>
        </div>
      </header>

      {/* Le profil pilote les suggestions : tant qu'il est vide, l'outil ne
          peut rien proposer d'utile. On le dit ici plutôt que de laisser
          découvrir une page de suggestions vide. */}
      {profil.completude < 50 && (
        <div className="message message-info" role="status">
          Votre profil est complété à {profil.completude} %. Renseignez ce que
          vous recherchez pour que les suggestions aient du sens —{" "}
          <Link to="/recruteur/profil">configurer mon profil</Link>.
        </div>
      )}

      <section aria-labelledby="titre-chiffres">
        <h2 id="titre-chiffres" className="sr-only">
          Vos chiffres
        </h2>
        <ul className="recruteur-chiffres">
          <li>
            <span className="chiffre-valeur">{chiffres.candidatsEnregistres}</span>
            <span className="chiffre-libelle">
              candidat{chiffres.candidatsEnregistres > 1 ? "s" : ""} mis de côté
            </span>
          </li>
          <li>
            <span className="chiffre-valeur">{chiffres.listes}</span>
            <span className="chiffre-libelle">
              liste{chiffres.listes > 1 ? "s" : ""}
            </span>
          </li>
          <li>
            <span className="chiffre-valeur">{chiffres.profilsVisibles}</span>
            <span className="chiffre-libelle">profils consultables</span>
          </li>
          <li>
            <span className="chiffre-valeur">{chiffres.offresOuvertes}</span>
            <span className="chiffre-libelle">offres ouvertes</span>
          </li>
        </ul>
      </section>

      <div className="recruteur-colonnes">
        {/* ── Suggestions ────────────────────────────────────────────── */}
        <section aria-labelledby="titre-suggestions">
          <div className="recruteur-section-entete">
            <h2 id="titre-suggestions">Profils à regarder</h2>
            {suggestions?.total > 3 && (
              <Link to="/recruteur/suggestions" className="lien-discret">
                Voir les {suggestions.total}
              </Link>
            )}
          </div>

          {!suggestions ? (
            <p role="status">Calcul des suggestions…</p>
          ) : !suggestions.exploitable ? (
            <p className="recruteur-vide">
              Rien à suggérer pour l'instant. Indiquez les compétences que vous
              recherchez, ou mettez quelques profils de côté : c'est à partir de
              là que l'outil comprend ce que vous cherchez.{" "}
              <Link to="/recruteur/profil">Configurer mon profil</Link>.
            </p>
          ) : suggestions.total === 0 ? (
            <p className="recruteur-vide">
              Aucun profil du vivier ne correspond à vos critères actuels.
            </p>
          ) : (
            <ul className="suggestions-liste">
              {suggestions.suggestions.slice(0, 3).map((s) => (
                <li key={s.candidat.id}>
                  <SuggestionCarte suggestion={s} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Listes ─────────────────────────────────────────────────── */}
        <section aria-labelledby="titre-listes">
          <div className="recruteur-section-entete">
            <h2 id="titre-listes">Vos listes</h2>
            <Link to="/recruteur/listes" className="lien-discret">
              Toutes les listes
            </Link>
          </div>

          {data.listesRecentes.length === 0 ? (
            <p className="recruteur-vide">
              Aucune liste. Créez-en une pour mettre de côté les profils qui vous
              intéressent — « À rappeler », « Pour le poste de gestionnaire »…{" "}
              <Link to="/recruteur/listes">Créer une liste</Link>.
            </p>
          ) : (
            <ul className="listes-apercu">
              {data.listesRecentes.map((l) => (
                <li key={l._id}>
                  <Link to="/recruteur/listes" className="liste-apercu">
                    <span className="liste-apercu-nom">{l.nom}</span>
                    <span className="liste-apercu-meta">
                      {l.nbEntrees} profil{l.nbEntrees > 1 ? "s" : ""}
                      {l.avpIntitule ? ` · ${l.avpIntitule}` : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ── Offres de l'organisation ─────────────────────────────────── */}
      {data.mesOffres.length > 0 && (
        <section aria-labelledby="titre-mes-offres">
          <div className="recruteur-section-entete">
            <h2 id="titre-mes-offres">Les offres de votre organisation</h2>
          </div>
          <ul className="mes-offres">
            {data.mesOffres.map((o) => (
              <li key={o.slug}>
                <Link to={`/offres/${o.slug}`} className="mes-offres-titre">
                  {o.intitule}
                </Link>
                <span className="mes-offres-meta">
                  {[o.direction, o.lieu].filter(Boolean).join(" · ")}
                  {o.dateLimite && (
                    <>
                      {" · jusqu'au "}
                      <time dateTime={dateIso(o.dateLimite)}>
                        {formaterDate(o.dateLimite)}
                      </time>
                    </>
                  )}
                </span>
                <Link
                  to={`/vivier/offres/${o.slug}`}
                  className="btn btn-secondaire btn-compact"
                >
                  Candidats pour ce poste
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

export default EspaceRecruteurScreen;
