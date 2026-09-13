// src/screens/MetiersScreen/MetierDetailScreen.jsx
import { Link, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { useGetMetierQuery } from "../../slices/metierApiSlice";
import { formaterDateCourte, dateIso } from "../../utils/format";
import { messageErreur } from "../../utils/erreurApi";
import "./MetiersScreen.css";

// Niveau exprimé en mots. « Niveau 4 » ne dit rien à qui n'a pas le barème
// sous les yeux.
const NIVEAUX = {
  1: "notions",
  2: "pratique courante",
  3: "maîtrise",
  4: "expertise",
  5: "référence",
};

const MetierDetailScreen = () => {
  const { code } = useParams();
  const { userInfo } = useSelector((state) => state.auth);
  const { data, isLoading, isError, error } = useGetMetierQuery(code);

  if (isLoading) {
    return (
      <div className="conteneur metier-detail">
        <p role="status">Chargement de la fiche métier…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="conteneur metier-detail">
        <div className="message message-erreur" role="alert">
          {messageErreur(error, "Ce métier est introuvable.")}
        </div>
        <Link to="/metiers" className="btn btn-secondaire">
          Retour au référentiel
        </Link>
      </div>
    );
  }

  const { ecart } = data;
  const ouvertes = data.offres.filter((o) => o.ouverte);

  return (
    <div className="conteneur metier-detail">
      <p className="detail-fil">
        <Link to="/metiers">← Tous les métiers</Link>
      </p>

      <header className="metier-entete">
        <p className="metier-famille">{data.famille?.libelle || "Sans famille"}</p>
        <h1>{data.nom}</h1>
        <p className="metier-code">
          Code référentiel {data.code} · {data.competences.length} compétences
          attendues
        </p>
      </header>

      {/* ── Où vous en êtes ──────────────────────────────────────────── */}
      {ecart ? (
        <section className="ecart" aria-labelledby="titre-ecart">
          <h2 id="titre-ecart">Où vous en êtes</h2>

          <div className="ecart-jauge-ligne">
            <div
              className="jauge"
              role="progressbar"
              aria-valuenow={ecart.couverture}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Couverture des compétences de ce métier"
            >
              <div
                className="jauge-remplie"
                style={{ width: `${ecart.couverture}%` }}
              />
            </div>
            <span className="jauge-valeur">{ecart.couverture}%</span>
          </div>

          <p className="ecart-resume">
            {ecart.acquises.length} compétence
            {ecart.acquises.length > 1 ? "s" : ""} sur {ecart.nbAttendues} —{" "}
            {ecart.aAcquerir.length} à acquérir
            {ecart.aRenforcer.length > 0 &&
              `, ${ecart.aRenforcer.length} à renforcer`}
            .
          </p>

          {ecart.aAcquerir.length > 0 && (
            <>
              <h3>Par quoi commencer</h3>
              <p className="ecart-aide">
                Classé par le poids que l'employeur donne à chaque compétence
                dans ce métier — ce n'est pas un ordre arbitraire.
              </p>
              <ul className="ecart-liste">
                {ecart.aAcquerir.slice(0, 10).map((c, i) => (
                  <li key={i} className={`ecart-item ecart-item--${c.priorite}`}>
                    <span className="ecart-nom">{c.nom}</span>
                    <span className="ecart-detail">
                      priorité {c.priorite} · niveau attendu :{" "}
                      {NIVEAUX[c.niveauRequis] || c.niveauRequis}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {ecart.aRenforcer.length > 0 && (
            <>
              <h3>À renforcer</h3>
              <p className="ecart-aide">
                Vous les avez, mais en dessous du niveau attendu pour ce métier.
              </p>
              <ul className="ecart-liste">
                {ecart.aRenforcer.map((c, i) => (
                  <li key={i} className="ecart-item ecart-item--renforcer">
                    <span className="ecart-nom">{c.nom}</span>
                    <span className="ecart-detail">
                      vous : {NIVEAUX[c.niveauDeclare]} · attendu :{" "}
                      {NIVEAUX[c.niveauRequis]}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {ecart.acquises.length > 0 && (
            <details className="ecart-acquises">
              <summary>Ce que vous avez déjà ({ecart.acquises.length})</summary>
              <ul className="ecart-liste">
                {ecart.acquises.map((c, i) => (
                  <li key={i} className="ecart-item ecart-item--acquis">
                    <span className="ecart-nom">{c.nom}</span>
                    <span className="ecart-detail">
                      couvert par <strong>{c.couvertPar}</strong> — {c.origine}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      ) : (
        <section className="ecart ecart--invite">
          <h2>Où en êtes-vous sur ce métier ?</h2>
          <p>
            {userInfo
              ? "Complétez votre profil — au minimum votre présentation, une expérience et trois compétences — pour voir ce qui vous sépare de ce métier."
              : "Créez un compte et décrivez votre parcours : vous verrez exactement quelles compétences vous avez déjà, et lesquelles il vous reste à acquérir."}
          </p>
          <Link
            to={userInfo ? "/profil" : "/inscription"}
            className="btn btn-principal"
          >
            {userInfo ? "Compléter mon profil" : "Créer un compte"}
          </Link>
        </section>
      )}

      {/* ── Les compétences attendues ────────────────────────────────── */}
      <section aria-labelledby="titre-competences">
        <h2 id="titre-competences" className="metier-section-titre">
          Ce que le métier exige
        </h2>
        <p className="metier-section-aide">
          Données publiées par l'OPT-NC. Le poids indique l'importance de la
          compétence dans ce métier.
        </p>

        <ul className="competences-liste">
          {data.competences.map((c, i) => (
            <li key={i} className="competence">
              <span className="competence-nom">{c.nom}</span>
              <span className="competence-meta">
                poids {c.poids ?? "—"} · niveau attendu :{" "}
                {NIVEAUX[c.niveauRequis] || c.niveauRequis || "non précisé"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Offres rattachées ────────────────────────────────────────── */}
      <section aria-labelledby="titre-offres">
        <h2 id="titre-offres" className="metier-section-titre">
          Postes rattachés à ce métier
        </h2>

        {data.offres.length === 0 ? (
          <p className="metier-vide">
            Aucun avis de vacance n'a été publié sur ce métier dans les données
            dont nous disposons. Cela ne veut pas dire qu'il n'y en aura pas :
            le corpus se renouvelle en permanence.
          </p>
        ) : (
          <>
            {ouvertes.length === 0 && (
              <p className="metier-vide">
                Aucun poste ouvert actuellement. Les fiches ci-dessous restent
                consultables : elles montrent ce que l'Office recherche sur ce
                métier.
              </p>
            )}
            <ul className="metier-offres">
              {data.offres.map((o) => (
                <li key={o.slug}>
                  <Link to={`/offres/${o.slug}`}>{o.intitule}</Link>
                  <span className="metier-offre-meta">
                    {[o.direction, o.lieu].filter(Boolean).join(" · ")}
                    {o.datePubliee && (
                      <>
                        {" · "}
                        <time dateTime={dateIso(o.datePubliee)}>
                          {formaterDateCourte(o.datePubliee)}
                        </time>
                      </>
                    )}
                    {!o.ouverte && " · clôturée"}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
};

export default MetierDetailScreen;
