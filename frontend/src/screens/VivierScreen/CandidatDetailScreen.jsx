// src/screens/VivierScreen/CandidatDetailScreen.jsx
//
// Le parcours complet d'un candidat, côté recruteur.
//
// C'est ICI que sortent les coordonnées, et nulle part ailleurs : la liste n'en
// porte aucune. Une liste qui les afficherait se moissonnerait en une requête ;
// consulter un profil doit rester un geste délibéré.
import { Link, useParams } from "react-router-dom";
import {
  useGetCandidatQuery,
  urlCvCandidat,
  urlResumeCandidat,
} from "../../slices/recruteurApiSlice";
import { messageErreur } from "../../utils/erreurApi";
import BoutonSignaler from "../../components/Global/BoutonSignaler";
import "./VivierScreen.css";

const NIVEAUX = {
  notions: "Notions",
  pratique: "Pratique",
  maitrise: "Maîtrise",
  expert: "Expert",
  courant: "Courant",
  bilingue: "Bilingue",
  maternelle: "Langue maternelle",
};

const periode = (debut, fin, enCours) => {
  const f = enCours ? "aujourd'hui" : fin;
  if (debut && f) return `${debut} → ${f}`;
  return debut || f || "";
};

const CandidatDetailScreen = () => {
  const { id } = useParams();
  const { data: c, isLoading, isError, error } = useGetCandidatQuery(id);

  if (isLoading) {
    return (
      <div className="conteneur vivier">
        <p role="status">Chargement du profil…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="conteneur vivier">
        <div className="message message-erreur" role="alert">
          {messageErreur(error, "Ce profil n'est pas consultable.")}
        </div>
        <Link to="/vivier" className="btn btn-secondaire">
          Retour aux candidats
        </Link>
      </div>
    );
  }

  return (
    <div className="conteneur vivier candidat-detail">
      <p className="detail-fil">
        <Link to="/vivier">← Les candidats</Link>
      </p>

      <header className="candidat-detail-entete">
        {c.photo ? (
          <img className="candidat-detail-photo" src={c.photo} alt="" />
        ) : null}

        <div>
          <h1>
            {c.prenom} {c.nom}
          </h1>
          {c.titre && <p className="candidat-titre">{c.titre}</p>}
          <p className="candidat-lieu">
            {[c.ville, c.province].filter(Boolean).join(" · ")}
          </p>

          {/* Des liens, pas des boutons : ce sont des navigations vers des
              fichiers. Le clic milieu et « ouvrir dans un nouvel onglet »
              fonctionnent, et un lecteur d'écran annonce la bonne nature. */}
          <div className="actions candidat-detail-actions">
            <a className="btn btn-principal btn-compact" href={urlCvCandidat(c.id)} download>
              Télécharger le CV (PDF)
            </a>
            <a
              className="btn btn-secondaire btn-compact"
              href={urlResumeCandidat(c.id)}
              download
            >
              JSON Resume
            </a>
            <a className="btn btn-secondaire btn-compact" href={`mailto:${c.email}`}>
              Écrire à {c.prenom}
            </a>
          </div>
        </div>
      </header>

      {/* Coordonnées. Elles n'apparaissent qu'ici — et le rappel est écrit à
          l'écran, pour que le recruteur sache qu'il consulte une donnée
          personnelle confiée par quelqu'un. */}
      <section className="carte" aria-labelledby="titre-contact">
        <h2 id="titre-contact">Contact</h2>
        <dl className="candidat-contact">
          <div>
            <dt>Email</dt>
            <dd>
              <a href={`mailto:${c.email}`}>{c.email}</a>
            </dd>
          </div>
          {c.telephone && (
            <div>
              <dt>Téléphone</dt>
              <dd>{c.telephone}</dd>
            </div>
          )}
          {(c.adresse || c.codePostal) && (
            <div>
              <dt>Adresse</dt>
              <dd>{[c.adresse, c.codePostal, c.ville].filter(Boolean).join(", ")}</dd>
            </div>
          )}
          {c.permis?.length > 0 && (
            <div>
              <dt>Permis</dt>
              <dd>{c.permis.join(", ")}</dd>
            </div>
          )}
          {c.disponibilite && (
            <div>
              <dt>Disponibilité</dt>
              <dd>{c.disponibilite}</dd>
            </div>
          )}
          {c.mobilite && (
            <div>
              <dt>Mobilité</dt>
              <dd>{c.mobilite}</dd>
            </div>
          )}
        </dl>

        {c.liens?.length > 0 && (
          <ul className="candidat-liens">
            {c.liens.map((l, i) => (
              <li key={i}>
                <a href={l.url} target="_blank" rel="noreferrer noopener">
                  {l.reseau || l.url}
                </a>
              </li>
            ))}
          </ul>
        )}

        <p className="candidat-avertissement">
          Ces coordonnées ont été confiées par la personne pour être contactée à
          propos d'un poste. Elles ne doivent servir à rien d'autre.
        </p>
      </section>

      {c.accroche && (
        <section className="carte" aria-labelledby="titre-presentation">
          <h2 id="titre-presentation">Présentation</h2>
          <p>{c.accroche}</p>
        </section>
      )}

      {c.experiences?.length > 0 && (
        <section className="carte" aria-labelledby="titre-experiences">
          <h2 id="titre-experiences">Expérience professionnelle</h2>
          <ol className="candidat-parcours">
            {c.experiences.map((e, i) => (
              <li key={i}>
                <h3>{e.poste || "Poste"}</h3>
                <p className="candidat-parcours-meta">
                  {[e.employeur, e.lieu, periode(e.debut, e.fin, e.enCours)]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {e.description && <p>{e.description}</p>}
                {e.realisations?.length > 0 && (
                  <ul>
                    {e.realisations.map((r, n) => (
                      <li key={n}>{r}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      {c.formations?.length > 0 && (
        <section className="carte" aria-labelledby="titre-formations">
          <h2 id="titre-formations">Formation</h2>
          <ol className="candidat-parcours">
            {c.formations.map((f, i) => (
              <li key={i}>
                <h3>{f.intitule || "Formation"}</h3>
                <p className="candidat-parcours-meta">
                  {[f.etablissement, f.niveau, f.enCours ? "en cours" : f.annee]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {c.competencesCompletes?.length > 0 && (
        <section className="carte" aria-labelledby="titre-competences">
          <h2 id="titre-competences">Compétences</h2>
          <ul className="candidat-competences">
            {c.competencesCompletes.map((comp, i) => (
              <li key={i}>
                {comp.nom}
                <span className="candidat-niveau">
                  {NIVEAUX[comp.niveau] || comp.niveau}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(c.languesCompletes?.length > 0 || c.interets?.length > 0) && (
        <section className="carte" aria-labelledby="titre-divers">
          <h2 id="titre-divers">Langues et centres d'intérêt</h2>

          {c.languesCompletes?.length > 0 && (
            <ul className="candidat-competences">
              {c.languesCompletes.map((l, i) => (
                <li key={i}>
                  {l.nom}
                  <span className="candidat-niveau">
                    {NIVEAUX[l.niveau] || l.niveau}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {c.interets?.length > 0 && (
            <ul className="candidat-interets">
              {c.interets.map((i, n) => (
                <li key={n}>
                  {i.nom}
                  {i.motsCles?.length > 0 && ` — ${i.motsCles.join(", ")}`}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {c.aspirations?.projet && (
        <section className="carte" aria-labelledby="titre-projet">
          <h2 id="titre-projet">Ce que cette personne cherche</h2>
          <p>{c.aspirations.projet}</p>
        </section>
      )}

      {/* En bas de fiche, discret : on ne signale pas quelqu'un avant de
          l'avoir lu. `userId` et non l'identifiant du profil — les mesures de
          modération portent sur le compte, et un profil peut être recréé. */}
      {c.userId && (
        <BoutonSignaler cibleId={c.userId} nom={`${c.prenom} ${c.nom}`} />
      )}
    </div>
  );
};

export default CandidatDetailScreen;
