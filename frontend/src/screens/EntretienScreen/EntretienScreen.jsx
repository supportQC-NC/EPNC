// src/screens/EntretienScreen/EntretienScreen.jsx
//
// L'entretien guidé : construire un parcours avec quelqu'un qui n'a pas de CV.
//
// ══════════════════════════════════════════════════════════════════════════
//  L'ÉCRAN NE DOIT JAMAIS RESSEMBLER À UN FORMULAIRE
// ══════════════════════════════════════════════════════════════════════════
// Le formulaire de profil existe déjà, et c'est précisément lui qui bloque les
// gens sans CV : il demande un « intitulé de poste », des « réalisations », un
// « niveau » de compétence. Ces mots supposent qu'on s'est déjà pensé comme un
// candidat.
//
// Ici : une question à la fois, en français parlé, et un exemple qui dit sans
// le dire que le bénévolat et l'aide familiale comptent. La mise en forme
// arrive APRÈS, sur ce que la personne a raconté — et elle reste modifiable.
//
// ⚠️ Rien n'est enregistré avant le récapitulatif final. On peut donc revenir,
// corriger, abandonner. Un entretien qui écrit au fil de l'eau laisse des
// moitiés de profil derrière lui quand on ferme l'onglet.
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  useGetEntretienQuery,
  useEntretienExperienceMutation,
  useEntretienFormationsMutation,
  useEntretienRechercheMutation,
  useUpdateProfilMutation,
} from "../../slices/profilApiSlice";
import { messageErreur } from "../../utils/erreurApi";
import "./EntretienScreen.css";

// ── Une expérience proposée, et modifiable ────────────────────────────────
//
// Le modèle a mis en forme ; la personne corrige. Les champs qu'il a laissés
// vides (employeur, dates) sont affichés comme les autres, pas signalés comme
// des erreurs : il ne les a pas devinés, c'est exactement ce qu'on lui demande.
const ExperienceProposee = ({ valeur, onChange, competences, onCompetences }) => {
  const champ = (cle) => ({
    value: valeur[cle] || "",
    onChange: (e) => onChange({ ...valeur, [cle]: e.target.value }),
  });

  return (
    <div className="entretien-proposition">
      <h3>Voici ce que j'ai compris</h3>
      <p className="entretien-proposition-aide">
        Corrigez ce qui ne va pas. C'est votre texte : il ira tel quel sur votre
        CV et dans vos lettres.
      </p>

      <div className="champ">
        <label htmlFor="ex-poste">Comment appeler ce que vous faisiez</label>
        <input id="ex-poste" {...champ("poste")} />
      </div>

      <div className="duo">
        <div className="champ">
          <label htmlFor="ex-employeur">Pour qui</label>
          <input
            id="ex-employeur"
            {...champ("employeur")}
            placeholder="Une entreprise, une association, un particulier…"
          />
        </div>
        <div className="champ">
          <label htmlFor="ex-lieu">Où</label>
          <input id="ex-lieu" {...champ("lieu")} />
        </div>
      </div>

      <div className="duo">
        <div className="champ">
          <label htmlFor="ex-debut">Depuis quand</label>
          <input id="ex-debut" {...champ("debut")} placeholder="2019, mars 2021…" />
        </div>
        <div className="champ">
          <label htmlFor="ex-fin">Jusqu'à quand</label>
          <input
            id="ex-fin"
            {...champ("fin")}
            disabled={valeur.enCours}
            placeholder={valeur.enCours ? "en cours" : "2023…"}
          />
        </div>
      </div>

      <label className="entretien-case">
        <input
          type="checkbox"
          checked={Boolean(valeur.enCours)}
          onChange={(e) => onChange({ ...valeur, enCours: e.target.checked, fin: "" })}
        />
        <span>Je le fais encore aujourd'hui</span>
      </label>

      <div className="champ">
        <label htmlFor="ex-description">Ce que vous faisiez</label>
        <textarea id="ex-description" rows={4} {...champ("description")} />
      </div>

      {/* Les compétences : le cœur du dispositif pour quelqu'un sans CV.
          Tout est coché par défaut — elles viennent de son propre récit — mais
          elle peut retirer ce qu'elle ne se reconnaît pas. Le terme du
          référentiel est PROPOSÉ à côté du sien, jamais à la place. */}
      {competences.length > 0 && (
        <fieldset className="entretien-competences">
          <legend>Ce que cela montre que vous savez faire</legend>
          <p className="entretien-proposition-aide">
            Décochez ce qui ne vous correspond pas. Ces mots sont ceux que les
            offres d'emploi emploient : ils servent à vous rapprocher des postes.
          </p>
          {competences.map((c, i) => (
            <label key={i} className="entretien-case">
              <input
                type="checkbox"
                checked={c.retenue}
                onChange={() =>
                  onCompetences(
                    competences.map((x, j) =>
                      j === i ? { ...x, retenue: !x.retenue } : x,
                    ),
                  )
                }
              />
              <span>
                {c.dite}
                {c.referentiel && c.referentiel.toLowerCase() !== c.dite.toLowerCase() && (
                  <em className="entretien-referentiel">
                    aussi appelé « {c.referentiel} » dans les offres
                  </em>
                )}
              </span>
            </label>
          ))}
        </fieldset>
      )}
    </div>
  );
};

const EntretienScreen = () => {
  const navigate = useNavigate();
  const { data: config, isLoading } = useGetEntretienQuery();
  const [mettreEnForme, { isLoading: enForme }] = useEntretienExperienceMutation();
  const [mettreFormations, { isLoading: enFormations }] = useEntretienFormationsMutation();
  const [mettreRecherche, { isLoading: enRecherche }] = useEntretienRechercheMutation();
  const [enregistrer, { isLoading: enSauvegarde }] = useUpdateProfilMutation();

  const [etape, setEtape] = useState(0);
  const [erreur, setErreur] = useState("");

  // Ce qui a été validé, en attente d'enregistrement final.
  const [experiences, setExperiences] = useState([]);
  const [formations, setFormations] = useState([]);
  const [recherche, setRecherche] = useState(null);

  // La proposition en cours d'examen.
  const [recit, setRecit] = useState("");
  const [proposition, setProposition] = useState(null);
  const [competences, setCompetences] = useState([]);
  const [manquant, setManquant] = useState([]);

  if (isLoading) return <p role="status">Préparation de l'entretien…</p>;

  const ETAPES = config?.etapes || [];
  const courante = ETAPES[etape];

  const reinitialiser = () => {
    setRecit("");
    setProposition(null);
    setCompetences([]);
    setManquant([]);
    setErreur("");
  };

  const analyser = async () => {
    setErreur("");
    try {
      if (courante.cle === "experiences") {
        const r = await mettreEnForme(recit).unwrap();
        setProposition(r.proposition);
        setCompetences(r.competences.map((c) => ({ ...c, retenue: true })));
        setManquant(r.manquant || []);
      } else if (courante.cle === "formations") {
        const r = await mettreFormations(recit).unwrap();
        setProposition({ formations: r.formations });
      } else {
        const r = await mettreRecherche(recit).unwrap();
        setProposition(r);
      }
    } catch (err) {
      setErreur(messageErreur(err, "La mise en forme a échoué."));
    }
  };

  const validerEtape = () => {
    if (courante.cle === "experiences") {
      setExperiences((liste) => [
        ...liste,
        {
          ...proposition,
          realisations: proposition.realisations || [],
          // Les compétences retenues voyagent avec l'expérience : c'est ce qui
          // permet, au récapitulatif, de dire d'où vient chacune.
          _competences: competences.filter((c) => c.retenue),
        },
      ]);
    } else if (courante.cle === "formations") {
      setFormations((liste) => [...liste, ...(proposition.formations || [])]);
    } else {
      setRecherche(proposition);
    }
    reinitialiser();
  };

  const suivante = () => {
    reinitialiser();
    setEtape((n) => n + 1);
  };

  // ── Enregistrement final ───────────────────────────────────────────
  const terminer = async () => {
    setErreur("");

    // Les compétences sont dédoublonnées sur le libellé retenu. Deux
    // expériences qui montrent « relation client » ne doivent pas la faire
    // apparaître deux fois sur le CV.
    const toutes = new Map();
    for (const exp of experiences) {
      for (const c of exp._competences || []) {
        const nom = c.referentiel || c.dite;
        if (!toutes.has(nom.toLowerCase())) {
          // « pratique » et non « maîtrise » : le récit montre que la personne
          // l'a fait, pas à quel niveau. Surévaluer par défaut fausserait le
          // rapprochement dans le sens qui la trompe.
          toutes.set(nom.toLowerCase(), { nom, niveau: "pratique" });
        }
      }
    }

    try {
      await enregistrer({
        experiences: experiences.map(({ _competences, ...e }) => e),
        formations,
        competences: [...toutes.values()],
        ...(recherche
          ? {
              aspirations: { projet: recherche.projet || "", famillesVisees: [], typesContrat: [] },
              contraintes: {
                disponibilite: recherche.disponibilite || "",
                mobilite: recherche.mobilite || "",
              },
            }
          : {}),
      }).unwrap();

      navigate("/profil");
    } catch (err) {
      setErreur(messageErreur(err, "L'enregistrement a échoué."));
    }
  };

  const enCours = enForme || enFormations || enRecherche;
  const fini = etape >= ETAPES.length;

  return (
    <div className="conteneur entretien">
      <header className="entretien-entete">
        <h1>Construisons votre parcours ensemble</h1>
        <p className="entretien-intro">
          Pas besoin de CV, ni de savoir comment on écrit ces choses-là.
          Racontez, on met en forme, vous corrigez.
        </p>

        {/* Annoncé AVANT que la personne raconte quoi que ce soit : si la
            reformulation n'est pas disponible, elle doit le savoir pour écrire
            autrement, pas le découvrir en relisant. */}
        {config?.reformulation === false && (
          <p className="message message-avertissement" role="status">
            La mise en forme automatique n'est pas disponible en ce moment : vos
            réponses seront reprises telles quelles, et vous aurez un peu plus
            à corriger.
          </p>
        )}

        <ol className="entretien-fil" aria-label="Étapes">
          {ETAPES.map((e, i) => (
            <li
              key={e.cle}
              className={
                i === etape ? "entretien-fil--actif" : i < etape ? "entretien-fil--fait" : ""
              }
              aria-current={i === etape ? "step" : undefined}
            >
              {e.titre}
            </li>
          ))}
          <li className={fini ? "entretien-fil--actif" : ""}>Récapitulatif</li>
        </ol>
      </header>

      {erreur && (
        <div className="message message-erreur" role="alert">
          {erreur}
        </div>
      )}

      {/* ── Récapitulatif ────────────────────────────────────────────── */}
      {fini ? (
        <section className="carte" aria-labelledby="titre-recap">
          <h2 id="titre-recap">Votre parcours</h2>

          {experiences.length === 0 && formations.length === 0 ? (
            <p className="admin-vide">
              Vous n'avez rien ajouté. Revenez en arrière, ou renseignez votre
              profil directement.
            </p>
          ) : (
            <>
              {experiences.map((e, i) => (
                <article key={i} className="entretien-recap">
                  <h3>{e.poste || "Expérience"}</h3>
                  <p className="entretien-recap-meta">
                    {[e.employeur, e.lieu, e.enCours ? `depuis ${e.debut || "?"}` : [e.debut, e.fin].filter(Boolean).join(" – ")]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <p>{e.description}</p>
                  {e._competences?.length > 0 && (
                    <p className="entretien-recap-comp">
                      {e._competences.map((c) => c.referentiel || c.dite).join(" · ")}
                    </p>
                  )}
                </article>
              ))}

              {formations.length > 0 && (
                <article className="entretien-recap">
                  <h3>Formations</h3>
                  <ul>
                    {formations.map((f, i) => (
                      <li key={i}>
                        {f.intitule}
                        {f.etablissement && ` — ${f.etablissement}`}
                        {f.annee && ` (${f.annee})`}
                      </li>
                    ))}
                  </ul>
                </article>
              )}

              {recherche?.projet && (
                <article className="entretien-recap">
                  <h3>Ce que vous cherchez</h3>
                  <p>{recherche.projet}</p>
                </article>
              )}
            </>
          )}

          <div className="actions">
            <button
              type="button"
              className="btn btn-principal"
              onClick={terminer}
              disabled={enSauvegarde || (experiences.length === 0 && formations.length === 0)}
            >
              {enSauvegarde ? "Enregistrement…" : "Enregistrer mon profil"}
            </button>
            <button
              type="button"
              className="btn btn-secondaire"
              onClick={() => setEtape(ETAPES.length - 1)}
            >
              Revenir en arrière
            </button>
          </div>

          <p className="entretien-suite">
            Vous pourrez tout modifier ensuite depuis votre profil, et compléter
            ce qui manque.
          </p>
        </section>
      ) : (
        /* ── Une étape ────────────────────────────────────────────────── */
        <section className="carte" aria-labelledby="titre-etape">
          <h2 id="titre-etape">{courante.titre}</h2>

          {!proposition ? (
            <>
              <p className="entretien-question">{courante.question}</p>
              <p className="entretien-aide">{courante.aide}</p>

              <div className="champ">
                <label htmlFor="recit">Votre réponse</label>
                <textarea
                  id="recit"
                  rows={6}
                  value={recit}
                  onChange={(e) => setRecit(e.target.value)}
                  placeholder={courante.exemple}
                />
                <span className="champ-aide">
                  Écrivez comme vous parlez. L'orthographe n'a aucune importance
                  ici.
                </span>
              </div>

              <div className="actions">
                <button
                  type="button"
                  className="btn btn-principal"
                  onClick={analyser}
                  disabled={enCours || recit.trim().length < 10}
                >
                  {enCours ? "Un instant…" : "Mettre en forme"}
                </button>

                {/* Sauter est toujours possible, et affiché comme tel. Une
                    étape obligatoire sur un parcours qu'on ne sait pas décrire
                    fait abandonner au lieu de faire répondre. */}
                <button type="button" className="btn btn-secondaire" onClick={suivante}>
                  {experiences.length > 0 || formations.length > 0
                    ? "Passer à la suite"
                    : "Passer cette question"}
                </button>
              </div>
            </>
          ) : (
            <>
              {courante.cle === "experiences" && (
                <ExperienceProposee
                  valeur={proposition}
                  onChange={setProposition}
                  competences={competences}
                  onCompetences={setCompetences}
                />
              )}

              {courante.cle === "formations" && (
                <div className="entretien-proposition">
                  <h3>Voici ce que j'ai compris</h3>
                  {(proposition.formations || []).length === 0 ? (
                    <p>
                      Aucune formation retenue — c'est une réponse valable.
                      Beaucoup de postes sont ouverts sans diplôme exigé.
                    </p>
                  ) : (
                    <ul className="entretien-liste">
                      {proposition.formations.map((f, i) => (
                        <li key={i}>
                          <strong>{f.intitule}</strong>
                          {f.etablissement && ` — ${f.etablissement}`}
                          {f.annee && ` (${f.annee})`}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {courante.cle === "recherche" && (
                <div className="entretien-proposition">
                  <h3>Voici ce que j'ai compris</h3>
                  <div className="champ">
                    <label htmlFor="rech-projet">Ce que vous cherchez</label>
                    <textarea
                      id="rech-projet"
                      rows={3}
                      value={proposition.projet || ""}
                      onChange={(e) =>
                        setProposition({ ...proposition, projet: e.target.value })
                      }
                    />
                  </div>
                  {proposition.disponibilite && (
                    <p className="entretien-recap-meta">
                      Disponibilité : {proposition.disponibilite}
                    </p>
                  )}
                </div>
              )}

              {/* Ce qu'un recruteur cherchera et qui manque encore. Formulé
                  comme des questions, pas comme des erreurs : la personne a
                  bien répondu. */}
              {manquant.length > 0 && (
                <div className="entretien-manquant">
                  <h4>Ce qui aiderait, si vous le savez</h4>
                  <ul>
                    {manquant.map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="actions">
                <button type="button" className="btn btn-principal" onClick={validerEtape}>
                  {courante.repetable ? "C'est bon, ajouter" : "C'est bon"}
                </button>
                <button type="button" className="btn btn-secondaire" onClick={reinitialiser}>
                  Recommencer cette réponse
                </button>
              </div>
            </>
          )}

          {/* Ce qui a déjà été ajouté, visible en permanence : sans cela, on ne
              sait plus ce qu'on a raconté et on se répète. */}
          {courante.repetable && !proposition && (
            <>
              {courante.cle === "experiences" && experiences.length > 0 && (
                <p className="entretien-deja">
                  Déjà ajouté : {experiences.map((e) => e.poste).filter(Boolean).join(" · ")}
                </p>
              )}
              {courante.cle === "formations" && formations.length > 0 && (
                <p className="entretien-deja">
                  Déjà ajouté : {formations.map((f) => f.intitule).join(" · ")}
                </p>
              )}
            </>
          )}
        </section>
      )}

      <p className="entretien-echappatoire">
        Vous préférez remplir un formulaire ?{" "}
        <Link to="/profil">Aller directement à mon profil</Link>.
      </p>
    </div>
  );
};

export default EntretienScreen;
