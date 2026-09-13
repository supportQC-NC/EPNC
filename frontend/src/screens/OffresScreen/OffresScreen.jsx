// src/screens/OffresScreen/OffresScreen.jsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { useGetAvpsQuery } from "../../slices/avpApiSlice";
import {
  formaterDate,
  dateIso,
  libelleContrat,
  echeance,
  joursAvant,
  URGENCE_JOURS,
} from "../../utils/format";
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

// Normalisation pour la recherche : sans accents et sans casse. « Noumea »
// doit trouver « Nouméa », et « CHARGE » doit trouver « Chargé ».
const normaliser = (t) =>
  (t || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

// Combien d'offres on déroule d'un coup.
//
// Les 230 étaient rendues ensemble : 25 383 px de page, 28 écrans, 3 767
// nœuds. Une grille de trois colonnes n'est pas un catalogue qu'on parcourt
// jusqu'au bout — on filtre, on regarde le haut, on s'en va. Trente remplit
// dix rangées : assez pour se faire une idée avant de filtrer, assez court
// pour atteindre le rythme de publication qui vit sous la liste.
const PAR_PAQUET = 30;

const OffresScreen = () => {
  const [ouvertesSeules, setOuvertesSeules] = useState(false);
  const [employeur, setEmployeur] = useState("");
  const [recherche, setRecherche] = useState("");
  const [combien, setCombien] = useState(PAR_PAQUET);
  const { data, isLoading, isError, error } = useGetAvpsQuery({
    ouvertesSeules,
    employeur,
  });

  // ══════════════════════════════════════════════════════════════════
  //  LA RECHERCHE SE FAIT CÔTÉ NAVIGATEUR, ET C'EST DÉLIBÉRÉ
  // ══════════════════════════════════════════════════════════════════
  // Le serveur renvoie déjà TOUTES les offres en une réponse — 230 documents,
  // quelques centaines de kilo-octets. Ajouter un paramètre de recherche à
  // l'API imposerait un aller-retour à chaque frappe, sur une liaison
  // calédonienne, pour filtrer un tableau qu'on a déjà en mémoire. C'est
  // exactement la sur-ingénierie que le barème sanctionne.
  //
  // Si le corpus atteignait des milliers d'offres, la réponse serait paginée
  // et la recherche remonterait au serveur. À cette volumétrie, non.
  const filtrees = (() => {
    if (!data) return [];
    const q = normaliser(recherche).trim();
    if (!q) return data.offres;

    // Tous les mots doivent être trouvés, dans n'importe quel ordre :
    // « garde champetre » trouve « Garde champêtre », et « champetre garde »
    // aussi. Un `includes` sur la chaîne entière échouerait sur le second.
    const mots = q.split(/\s+/);

    return data.offres.filter((o) => {
      const foin = normaliser(
        [o.intitule, o.employeur?.nom, o.direction, o.service, o.lieu, o.metier?.nom, o.extrait]
          .filter(Boolean)
          .join(" "),
      );
      return mots.every((m) => foin.includes(m));
    });
  })();

  const visibles = filtrees.slice(0, combien);
  const reste = filtrees.length - visibles.length;

  // Tout changement de filtre ramène au premier paquet.
  //
  // Sans cela, quelqu'un qui a déplié 120 offres puis tape une recherche
  // reçoit 120 résultats d'un coup : le filtre paraît n'avoir rien allégé, et
  // le bouton « voir de plus » disparaît sans qu'on comprenne pourquoi.
  const filtrer = (poser) => (valeur) => {
    poser(valeur);
    setCombien(PAR_PAQUET);
  };

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

      {/* Un SQUELETTE, pas une phrase.
          « Chargement des offres… » laissait la page vide avec le pied
          remonté sous le titre, puis 230 cartes tombaient d'un coup : la page
          passait de 900 px à 25 000 px sous les yeux de la personne. Six
          blocs à la taille réelle d'une carte tiennent la place, annoncent la
          forme de ce qui arrive, et suppriment le saut. */}
      {isLoading && (
        <>
          <p className="sr-only" role="status">
            Chargement des offres…
          </p>
          <ul className="offres-liste offres-liste--squelette" aria-hidden="true">
            {Array.from({ length: 6 }, (_, i) => (
              <li key={i}>
                <div className="offre-squelette">
                  <span className="sq sq--eyebrow" />
                  <span className="sq sq--titre" />
                  <span className="sq sq--titre sq--court" />
                  <span className="sq sq--ligne" />
                  <span className="sq sq--pied" />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {isError && (
        <div className="message message-erreur" role="alert">
          {messageErreur(error, "Impossible de charger les offres pour le moment.")}
        </div>
      )}

      {data && (
        <>
          <div className="offres-barre">
            {/* Le compte est annoncé par aria-live : il change quand on coche
                le filtre, et ce changement doit être perceptible autrement que
                visuellement. */}
            <p className="offres-compte" aria-live="polite">
              {filtrees.length} offre{filtrees.length > 1 ? "s" : ""}{" "}
              affichée{filtrees.length > 1 ? "s" : ""}
              {/* Quand une recherche est active, on rappelle le total : sans
                  lui, « 3 offres affichées » laisse croire que le catalogue en
                  compte trois. */}
              {recherche.trim() && <> sur {data.offres.length}</>}
              {!ouvertesSeules && !recherche.trim() && data.cloturees > 0 && (
                <> · {data.cloturees} clôturée{data.cloturees > 1 ? "s" : ""}</>
              )}
            </p>

            <div className="offres-filtres">
              {/* La recherche AVANT les filtres : c'est le geste le plus
                  fréquent, et sur 230 offres c'est souvent le seul dont on a
                  besoin. Un écran qui n'offre que des listes déroulantes
                  oblige à deviner dans quelle catégorie ranger ce qu'on
                  cherche. */}
              <label className="offres-filtre offres-filtre--recherche">
                <span className="offres-filtre-libelle">Rechercher</span>
                <input
                  type="search"
                  value={recherche}
                  onChange={(e) => filtrer(setRecherche)(e.target.value)}
                  placeholder="Un métier, un lieu, un service…"
                />
              </label>

              {/* Filtre par employeur. Ce n'est pas un confort : sans lui,
                  quelqu'un qui vise l'OPT-NC devrait trier à la main parmi
                  230 avis venus de dix-huit organisations. */}
              <label className="offres-filtre offres-filtre--employeur">
                <span className="offres-filtre-libelle">Employeur</span>
                <select
                  value={employeur}
                  onChange={(e) => filtrer(setEmployeur)(e.target.value)}
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
                  onChange={(e) => filtrer(setOuvertesSeules)(e.target.checked)}
                />
                Offres ouvertes seulement
              </label>
            </div>
          </div>

          {filtrees.length === 0 ? (
            <p className="offres-vide">
              {recherche.trim()
                ? `Aucune offre ne contient « ${recherche.trim()} ». Essayez un mot plus court, ou le nom d'un lieu.`
                : "Aucune offre ne correspond. Décochez le filtre pour voir aussi les offres clôturées."}
            </p>
          ) : (
            <ul className="offres-liste">
              {visibles.map((offre) => (
                <li key={offre.slug}>
                  <article
                    className={[
                      "offre-carte",
                      offre.ouverte ? "" : "offre-carte--close",
                      // L'URGENCE EST PORTÉE PAR LA CARTE, pas seulement par
                      // une ligne de texte au fond. Elle donne une colonne de
                      // repères ambre que l'œil descend sans lire : c'est la
                      // seule information de cette liste qui rende un poste
                      // définitivement inatteignable si on la manque.
                      offre.ouverte &&
                      joursAvant(offre.dateLimite) !== null &&
                      joursAvant(offre.dateLimite) <= URGENCE_JOURS
                        ? "offre-carte--urgente"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
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
                        <Link
                          to={`/offres/${offre.slug}`}
                          className="offre-lien"
                        >
                          {offre.intitule}
                        </Link>
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

                    {/* Le pied de carte : l'échéance d'abord, la date de
                        publication ensuite et en retrait.
                        Auparavant les deux étaient au même corps, dans la même
                        couleur, séparées par un espace — « Publiée le 11
                        septembre 2026   Plus que 19 jours pour candidater ».
                        La seule des deux sur laquelle on peut encore agir
                        était indiscernable de l'autre. */}
                    <footer className="offre-pied">
                      {offre.dateLimite && (
                        <span
                          className={`offre-jours${
                            joursAvant(offre.dateLimite) !== null &&
                            joursAvant(offre.dateLimite) <= URGENCE_JOURS
                              ? " offre-jours--urgent"
                              : ""
                          }`}
                        >
                          <time dateTime={dateIso(offre.dateLimite)}>
                            {echeance(offre.dateLimite)}
                          </time>
                        </span>
                      )}
                      {offre.datePubliee && (
                        <span className="offre-publiee">
                          publiée le{" "}
                          <time dateTime={dateIso(offre.datePubliee)}>
                            {formaterDate(offre.datePubliee)}
                          </time>
                        </span>
                      )}
                    </footer>

                    {/* Plus de bouton « En savoir plus ».
                        Trente rectangles gris identiques pesaient autant que
                        les titres qu'ils accompagnaient, pour une action que
                        le titre portait déjà. Le lien du titre est ÉTIRÉ sur
                        toute la carte (`.offre-lien::after`) : la souris
                        clique n'importe où, et le lecteur d'écran n'entend
                        qu'un seul lien, nommé par l'intitulé du poste — au
                        lieu de trente « En savoir plus » indiscernables. */}
                  </article>
                </li>
              ))}
            </ul>
          )}

          {/* Un bouton, pas un défilement infini : le rythme de publication
              vit sous la liste, et une page qui se rallonge toute seule le
              rend inatteignable. */}
          {reste > 0 && (
            <div className="offres-suite">
              <button
                type="button"
                className="btn btn-secondaire"
                onClick={() => setCombien((n) => n + PAR_PAQUET)}
              >
                Voir {Math.min(reste, PAR_PAQUET)} offre
                {Math.min(reste, PAR_PAQUET) > 1 ? "s" : ""} de plus
              </button>
              <span className="offres-suite-reste">
                {visibles.length} sur {filtrees.length} affichées
              </span>
            </div>
          )}

          {/* Le rythme de publication APRÈS la liste, et pas avant.
              Il occupait la place d'honneur, au-dessus de la première offre :
              c'est une fierté d'analyse, pas un besoin d'utilisateur.
              Quelqu'un qui cherche un poste veut voir des postes ; savoir que
              91 avis sont parus en août l'intéresse une fois qu'il a regardé,
              pour décider s'il vaut la peine de revenir. */}
          <Rythme mois={data.rythme} />
        </>
      )}
    </div>
  );
};

export default OffresScreen;
