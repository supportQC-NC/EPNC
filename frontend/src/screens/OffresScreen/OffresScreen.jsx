// src/screens/OffresScreen/OffresScreen.jsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { useGetAvpsQuery } from "../../slices/avpApiSlice";
import { formaterDate, dateIso, libelleContrat, echeance } from "../../utils/format";
import "./OffresScreen.css";
import { messageErreur } from "../../utils/erreurApi";

const NOMS_MOIS = [
  "janv.", "févr.", "mars", "avril", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc.",
];

// Rythme des publications sur douze mois.
//
// C'est la raison d'être de l'affichage des offres clôturées : une annonce
// passée ne se candidate plus, mais elle dit que l'employeur recrute — et à
// quelle cadence. Quelqu'un qui ne trouve rien aujourd'hui a besoin de savoir
// s'il doit revenir dans deux semaines ou dans six mois.
const Rythme = ({ mois }) => {
  if (!mois?.length) return null;

  const total = mois.reduce((t, m) => t + m.total, 0);
  if (total === 0) return null;

  const maxi = Math.max(...mois.map((m) => m.total));
  const moisActifs = mois.filter((m) => m.total > 0).length;

  return (
    <section className="rythme" aria-labelledby="titre-rythme">
      <h2 id="titre-rythme">Rythme des publications</h2>
      <p className="rythme-resume">
        {total} offre{total > 1 ? "s" : ""} publiée{total > 1 ? "s" : ""} sur
        les 12 derniers mois, réparties sur {moisActifs} mois. Les postes
        clôturés restent affichés : ils indiquent ce que ces employeurs
        recrutent, et à quelle fréquence.
      </p>

      {/* Chaque barre porte son chiffre en texte : la hauteur seule ne serait
          lisible ni au lecteur d'écran, ni sur un petit écran. */}
      <ul className="rythme-barres">
        {mois.map((m) => {
          const [annee, numero] = m.mois.split("-");
          const libelle = `${NOMS_MOIS[Number(numero) - 1]} ${annee}`;
          return (
            <li key={m.mois} className="rythme-mois">
              <span className="rythme-valeur">{m.total}</span>
              <span
                className="rythme-barre"
                style={{ height: `${m.total === 0 ? 2 : (m.total / maxi) * 100}%` }}
              />
              <span className="rythme-libelle">
                <span aria-hidden="true">{NOMS_MOIS[Number(numero) - 1]}</span>
                <span className="sr-only">
                  {libelle} : {m.total} offre{m.total > 1 ? "s" : ""}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

const OffresScreen = () => {
  const [ouvertesSeules, setOuvertesSeules] = useState(false);
  const [employeur, setEmployeur] = useState("");
  const { data, isLoading, isError, error } = useGetAvpsQuery({
    ouvertesSeules,
    employeur,
  });

  return (
    <div className="conteneur conteneur--large offres">
      <header className="offres-entete">
        <h1>Les postes ouverts dans la fonction publique calédonienne</h1>
        <p className="offres-intro">
          Les avis de vacance de poste de plusieurs employeurs publics du
          territoire, rassemblés au même endroit : l'OPT-NC, la
          Nouvelle-Calédonie, les provinces, les hôpitaux, les communes.
          Données publiques, reprises telles quelles — l'employeur est indiqué
          sur chaque offre.
        </p>
      </header>

      {isLoading && <p role="status">Chargement des offres…</p>}

      {isError && (
        <div className="message message-erreur" role="alert">
          {messageErreur(error, "Impossible de charger les offres pour le moment.")}
        </div>
      )}

      {data && (
        <>
          <Rythme mois={data.rythme} />

          <div className="offres-barre">
            {/* Le compte est annoncé par aria-live : il change quand on coche
                le filtre, et ce changement doit être perceptible autrement que
                visuellement. */}
            <p className="offres-compte" aria-live="polite">
              {data.offres.length} offre{data.offres.length > 1 ? "s" : ""}{" "}
              affichée{data.offres.length > 1 ? "s" : ""}
              {!ouvertesSeules && data.cloturees > 0 && (
                <> · {data.cloturees} clôturée{data.cloturees > 1 ? "s" : ""}</>
              )}
            </p>

            <div className="offres-filtres">
              {/* Filtre par employeur. Ce n'est pas un confort : sans lui,
                  quelqu'un qui vise l'OPT-NC devrait trier à la main parmi
                  230 avis venus de dix-huit organisations. */}
              <label className="offres-filtre">
                <span className="offres-filtre-libelle">Employeur</span>
                <select
                  value={employeur}
                  onChange={(e) => setEmployeur(e.target.value)}
                >
                  <option value="">
                    Tous ({data.employeurs?.length || 0} employeurs)
                  </option>
                  {data.employeurs?.map((e) => (
                    <option key={e.code} value={e.code}>
                      {e.nom} — {e.ouvertes} ouverte{e.ouvertes > 1 ? "s" : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label className="offres-filtre offres-filtre--case">
                <input
                  type="checkbox"
                  checked={ouvertesSeules}
                  onChange={(e) => setOuvertesSeules(e.target.checked)}
                />
                Offres ouvertes seulement
              </label>
            </div>
          </div>

          {data.offres.length === 0 ? (
            <p className="offres-vide">
              Aucune offre ne correspond. Décochez le filtre pour voir aussi les
              offres clôturées.
            </p>
          ) : (
            <ul className="offres-liste">
              {data.offres.map((offre) => (
                <li key={offre.slug}>
                  <article
                    className={`offre-carte${offre.ouverte ? "" : " offre-carte--close"}`}
                  >
                    {/* Voile de clôture : il recouvre l'annonce pour qu'on ne
                        puisse pas la confondre avec un poste à pourvoir, tout
                        en laissant deviner le contenu — la fiche reste utile
                        à lire.
                        `aria-hidden` + `tabIndex={-1}` : c'est une commodité
                        pour la souris, qui mène au même endroit que le titre.
                        Sans cela, chaque carte exposerait deux liens
                        identiques à un lecteur d'écran. */}
                    {!offre.ouverte && (
                      <Link
                        to={`/offres/${offre.slug}`}
                        className="offre-voile"
                        aria-hidden="true"
                        tabIndex={-1}
                      >
                        <span className="offre-voile-titre">Clôturée</span>
                        <span className="offre-voile-note">
                          Candidatures closes — voir la fiche
                        </span>
                      </Link>
                    )}

                    <div className="offre-haut">
                      <h2 className="offre-titre">
                        {/* Le lien porte le titre : c'est lui qu'annonce un
                            lecteur d'écran qui parcourt les liens de la page.
                            Une carte entière cliquable ne dirait rien. */}
                        <Link to={`/offres/${offre.slug}`}>{offre.intitule}</Link>
                      </h2>
                      {!offre.ouverte && (
                        <span className="offre-badge">Clôturée</span>
                      )}
                    </div>

                    {/* QUI RECRUTE, avant tout le reste. La ligne suivante ne
                        porte que la direction, c'est-à-dire le service INTERNE
                        à cet employeur — les confondre laisserait croire que
                        toutes ces offres viennent du même endroit. */}
                    <p className="offre-employeur">
                      <span className="offre-employeur-nom">
                        {offre.employeur?.nom || "Employeur non précisé"}
                      </span>
                      {offre.employeur?.type && (
                        <span className="offre-employeur-type">
                          {offre.employeur.type}
                        </span>
                      )}
                    </p>

                    <p className="offre-meta">
                      {[offre.direction, offre.lieu, libelleContrat(offre.typeContrat)]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>

                    {offre.extrait && (
                      <p className="offre-extrait">{offre.extrait}</p>
                    )}

                    {offre.familles?.length > 0 && (
                      <ul className="offre-familles">
                        {offre.familles.map((famille) => (
                          <li key={famille}>{famille}</li>
                        ))}
                      </ul>
                    )}

                    <p className="offre-dates">
                      {offre.datePubliee && (
                        <>
                          Publiée le{" "}
                          <time dateTime={dateIso(offre.datePubliee)}>
                            {formaterDate(offre.datePubliee)}
                          </time>
                        </>
                      )}
                      {offre.dateLimite && (
                        <span className="offre-echeance">
                          {echeance(offre.dateLimite)}
                        </span>
                      )}
                    </p>

                    <Link
                      to={`/offres/${offre.slug}`}
                      className="btn btn-secondaire btn-compact"
                    >
                      {offre.ouverte ? "En savoir plus" : "Consulter la fiche"}
                      {/* Précision réservée aux lecteurs d'écran : hors
                          contexte, dix liens « En savoir plus » identiques sont
                          inutilisables. */}
                      <span className="sr-only"> sur {offre.intitule}</span>
                    </Link>
                  </article>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
};

export default OffresScreen;
