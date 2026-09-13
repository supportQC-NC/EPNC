// src/screens/ProfilScreen/ProfilScreen.jsx
import { useEffect, useState } from "react";
import { useGetProfilQuery, useUpdateProfilMutation } from "../../slices/profilApiSlice";
import { useGetCompetencesReferentielQuery } from "../../slices/metierApiSlice";
import { messageErreur } from "../../utils/erreurApi";
import ListeRepetable from "../../components/Form/ListeRepetable";
import "./ProfilScreen.css";

const PROVINCES = [
  "Province Sud",
  "Province Nord",
  "Province des îles Loyauté",
  "Hors territoire",
];

const NIVEAUX_COMPETENCE = [
  { v: "notions", l: "Notions" },
  { v: "pratique", l: "Pratique" },
  { v: "maitrise", l: "Maîtrise" },
  { v: "expert", l: "Expert" },
];

const NIVEAUX_LANGUE = [
  { v: "notions", l: "Notions" },
  { v: "courant", l: "Courant" },
  { v: "bilingue", l: "Bilingue" },
  { v: "maternelle", l: "Langue maternelle" },
];

// Une section = une carte + son propre bouton d'enregistrement.
//
// Pourquoi pas un seul bouton en bas : ce formulaire est long. Un seul
// enregistrement global oblige à tout remplir avant de sauver quoi que ce soit,
// et une erreur de validation sur une ligne fait perdre le reste. Là, chaque
// bloc se sauve seul et le serveur ne touche pas aux sections absentes.
const Section = ({ titre, aide, children, onEnregistrer, enCours, enregistre }) => (
  <section className="profil-section">
    <div className="profil-section-entete">
      <div>
        <h2>{titre}</h2>
        {aide && <p className="profil-section-aide">{aide}</p>}
      </div>
    </div>

    {children}

    <div className="profil-section-pied">
      <button
        type="button"
        className="btn btn-principal btn-compact"
        onClick={onEnregistrer}
        disabled={enCours}
      >
        {enCours ? "Enregistrement…" : "Enregistrer"}
      </button>
      {/* aria-live : la confirmation est annoncée, pas seulement affichée. */}
      <span className="profil-enregistre" aria-live="polite">
        {enregistre ? "Enregistré" : ""}
      </span>
    </div>
  </section>
);

const ProfilScreen = () => {
  const { data, isLoading, isError, error } = useGetProfilQuery();
  const [enregistrer, { isLoading: enCours }] = useUpdateProfilMutation();

  // Vocabulaire officiel des compétences, proposé en autocomplétion.
  //
  // C'est le gain de précision le plus simple de tout le rapprochement : une
  // compétence saisie avec les mots du référentiel est reconnue exactement,
  // au lieu d'être devinée par ressemblance de chaînes. « Droit/Réglementation »
  // et « je connais un peu le droit » ne se valent pas pour le moteur.
  const { data: vocabulaire } = useGetCompetencesReferentielQuery();

  const [profil, setProfil] = useState(null);
  const [sectionEnCours, setSectionEnCours] = useState(null);
  const [derniereEnregistree, setDerniereEnregistree] = useState(null);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    if (data) setProfil(data);
  }, [data]);

  if (isLoading || !profil) {
    return (
      <div className="conteneur profil">
        <p role="status">Chargement de votre profil…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="conteneur profil">
        <div className="message message-erreur" role="alert">
          {messageErreur(error, "Impossible de charger votre profil.")}
        </div>
      </div>
    );
  }

  const majSection = (section, valeur) =>
    setProfil((p) => ({ ...p, [section]: valeur }));

  const majChamp = (section, champ) => (e) => {
    const valeur =
      e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setProfil((p) => ({ ...p, [section]: { ...p[section], [champ]: valeur } }));
  };

  const sauver = (section) => async () => {
    setErreur("");
    setSectionEnCours(section);
    try {
      const maj = await enregistrer({ [section]: profil[section] }).unwrap();
      setProfil(maj);
      setDerniereEnregistree(section);
      // La mention « Enregistré » disparaît d'elle-même : laissée en place,
      // elle finirait par décrire un état qui n'est plus vrai.
      setTimeout(() => setDerniereEnregistree(null), 4000);
    } catch (err) {
      setErreur(messageErreur(err, "Enregistrement impossible."));
    } finally {
      setSectionEnCours(null);
    }
  };

  const props = (section) => ({
    onEnregistrer: sauver(section),
    enCours: enCours && sectionEnCours === section,
    enregistre: derniereEnregistree === section,
  });

  const completude = profil.completude ?? 0;

  return (
    <div className="conteneur profil">
      <header className="profil-entete">
        <h1>Mon profil</h1>
        <p className="profil-intro">
          Remplissez-le une fois. Il sert ensuite pour chaque candidature, sans
          rien ressaisir.
        </p>

        {/* Jauge de complétude : rôle progressbar pour que la valeur soit
            annoncée, et le pourcentage écrit en toutes lettres à côté — la
            barre seule n'est pas lisible par tout le monde. */}
        <div className="jauge-ligne">
          <div
            className="jauge"
            role="progressbar"
            aria-valuenow={completude}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Complétude de votre profil"
          >
            <div className="jauge-remplie" style={{ width: `${completude}%` }} />
          </div>
          <span className="jauge-valeur">{completude}% complété</span>
        </div>

        {completude < 30 && (
          <p className="profil-alerte">
            En dessous de 30 %, les documents produits seraient creux. Renseignez
            au moins votre présentation et une expérience.
          </p>
        )}
      </header>

      {erreur && (
        <div className="message message-erreur" role="alert">
          {erreur}
        </div>
      )}

      {/* ── Vous ──────────────────────────────────────────────────────── */}
      <Section
        titre="Vous"
        aide="Vos coordonnées et votre présentation en quelques phrases."
        {...props("basics")}
      >
        <div className="profil-duo">
          <div className="champ">
            <label htmlFor="telephone">Téléphone</label>
            <input
              id="telephone"
              type="tel"
              autoComplete="tel"
              value={profil.basics.telephone}
              onChange={majChamp("basics", "telephone")}
            />
          </div>
          <div className="champ">
            <label htmlFor="ville">Commune</label>
            <input
              id="ville"
              type="text"
              value={profil.basics.ville}
              onChange={majChamp("basics", "ville")}
            />
          </div>
        </div>

        <div className="champ">
          <label htmlFor="province">Province</label>
          <select
            id="province"
            value={profil.basics.province}
            onChange={majChamp("basics", "province")}
          >
            <option value="">Non précisée</option>
            {PROVINCES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div className="champ">
          <label htmlFor="accroche">Votre présentation</label>
          <textarea
            id="accroche"
            rows={5}
            value={profil.basics.accroche}
            onChange={majChamp("basics", "accroche")}
            aria-describedby="aide-accroche"
            placeholder="Qui vous êtes, ce que vous savez faire, ce que vous cherchez."
          />
          <span id="aide-accroche" className="champ-aide">
            C'est la base de vos lettres de candidature. Écrivez-la comme vous
            le diriez à quelqu'un, pas comme une fiche.
          </span>
        </div>

        <div className="champ">
          <label htmlFor="permis">Permis</label>
          <input
            id="permis"
            type="text"
            value={profil.basics.permis.join(", ")}
            onChange={(e) =>
              majSection("basics", {
                ...profil.basics,
                permis: e.target.value
                  .split(",")
                  .map((p) => p.trim())
                  .filter(Boolean),
              })
            }
            aria-describedby="aide-permis"
            placeholder="B, A2"
          />
          <span id="aide-permis" className="champ-aide">
            Séparés par des virgules. Plusieurs postes de l'OPT en exigent.
          </span>
        </div>
      </Section>

      {/* ── Expériences ───────────────────────────────────────────────── */}
      <Section
        titre="Expériences"
        aide="Ce que vous avez fait, même si ce n'était pas un emploi salarié."
        {...props("experiences")}
      >
        <ListeRepetable
          items={profil.experiences}
          onChange={(v) => majSection("experiences", v)}
          gabarit={() => ({
            poste: "",
            employeur: "",
            lieu: "",
            debut: "",
            fin: "",
            enCours: false,
            description: "",
            realisations: [],
          })}
          nomElement="Expérience"
          libelleAjout="Ajouter une expérience"
          libelleVide="Aucune expérience pour l'instant."
        >
          {(item, maj, i) => (
            <>
              <div className="profil-duo">
                <div className="champ">
                  <label htmlFor={`poste-${i}`}>Poste</label>
                  <input id={`poste-${i}`} value={item.poste} onChange={maj("poste")} />
                </div>
                <div className="champ">
                  <label htmlFor={`employeur-${i}`}>Employeur</label>
                  <input
                    id={`employeur-${i}`}
                    value={item.employeur}
                    onChange={maj("employeur")}
                  />
                </div>
              </div>

              <div className="profil-duo">
                <div className="champ">
                  <label htmlFor={`debut-${i}`}>Début</label>
                  <input
                    id={`debut-${i}`}
                    value={item.debut}
                    onChange={maj("debut")}
                    placeholder="mars 2021"
                  />
                </div>
                <div className="champ">
                  <label htmlFor={`fin-${i}`}>Fin</label>
                  <input
                    id={`fin-${i}`}
                    value={item.fin}
                    onChange={maj("fin")}
                    disabled={item.enCours}
                    placeholder="juin 2024"
                  />
                </div>
              </div>

              <div className="champ champ-case">
                <label>
                  <input
                    type="checkbox"
                    checked={item.enCours}
                    onChange={maj("enCours")}
                  />
                  Poste occupé actuellement
                </label>
              </div>

              <div className="champ">
                <label htmlFor={`desc-${i}`}>Ce que vous y faisiez</label>
                <textarea
                  id={`desc-${i}`}
                  rows={3}
                  value={item.description}
                  onChange={maj("description")}
                />
              </div>
            </>
          )}
        </ListeRepetable>
      </Section>

      {/* ── Formations ────────────────────────────────────────────────── */}
      <Section
        titre="Formations"
        aide="Diplômes, certifications, formations courtes."
        {...props("formations")}
      >
        <ListeRepetable
          items={profil.formations}
          onChange={(v) => majSection("formations", v)}
          gabarit={() => ({
            intitule: "",
            etablissement: "",
            niveau: "",
            annee: "",
            enCours: false,
          })}
          nomElement="Formation"
          libelleAjout="Ajouter une formation"
          libelleVide="Aucune formation pour l'instant."
        >
          {(item, maj, i) => (
            <>
              <div className="champ">
                <label htmlFor={`form-int-${i}`}>Intitulé</label>
                <input
                  id={`form-int-${i}`}
                  value={item.intitule}
                  onChange={maj("intitule")}
                />
              </div>
              <div className="profil-duo">
                <div className="champ">
                  <label htmlFor={`form-etab-${i}`}>Établissement</label>
                  <input
                    id={`form-etab-${i}`}
                    value={item.etablissement}
                    onChange={maj("etablissement")}
                  />
                </div>
                <div className="champ">
                  <label htmlFor={`form-annee-${i}`}>Année</label>
                  <input
                    id={`form-annee-${i}`}
                    value={item.annee}
                    onChange={maj("annee")}
                    placeholder="2019"
                  />
                </div>
              </div>
            </>
          )}
        </ListeRepetable>
      </Section>

      {/* ── Compétences ───────────────────────────────────────────────── */}
      <Section
        titre="Compétences"
        aide="Trois au minimum pour que le rapprochement ait du sens. Les suggestions viennent du référentiel officiel de l'OPT-NC : les reprendre rend le rapprochement exact."
        {...props("competences")}
      >
        {/* Un `<datalist>` plutôt qu'un composant de sélection : il suggère
            sans imposer. Une compétence hors référentiel reste saisissable —
            un parcours ne se réduit pas à une nomenclature. */}
        <datalist id="vocabulaire-competences">
          {(vocabulaire || []).map((c) => (
            <option key={c.code} value={c.nom} />
          ))}
        </datalist>

        <ListeRepetable
          items={profil.competences}
          onChange={(v) => majSection("competences", v)}
          gabarit={() => ({ nom: "", niveau: "pratique" })}
          nomElement="Compétence"
          libelleAjout="Ajouter une compétence"
          libelleVide="Aucune compétence pour l'instant."
        >
          {(item, maj, i) => (
            <div className="profil-duo">
              <div className="champ">
                <label htmlFor={`comp-${i}`}>Compétence</label>
                <input
                  id={`comp-${i}`}
                  value={item.nom}
                  onChange={maj("nom")}
                  list="vocabulaire-competences"
                  autoComplete="off"
                  placeholder="Commencez à taper…"
                />
              </div>
              <div className="champ">
                <label htmlFor={`comp-niv-${i}`}>Niveau</label>
                <select
                  id={`comp-niv-${i}`}
                  value={item.niveau}
                  onChange={maj("niveau")}
                >
                  {NIVEAUX_COMPETENCE.map((n) => (
                    <option key={n.v} value={n.v}>
                      {n.l}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </ListeRepetable>
      </Section>

      {/* ── Langues ───────────────────────────────────────────────────── */}
      <Section titre="Langues" {...props("langues")}>
        <ListeRepetable
          items={profil.langues}
          onChange={(v) => majSection("langues", v)}
          gabarit={() => ({ nom: "", niveau: "courant" })}
          nomElement="Langue"
          libelleAjout="Ajouter une langue"
          libelleVide="Aucune langue pour l'instant."
        >
          {(item, maj, i) => (
            <div className="profil-duo">
              <div className="champ">
                <label htmlFor={`lang-${i}`}>Langue</label>
                <input id={`lang-${i}`} value={item.nom} onChange={maj("nom")} />
              </div>
              <div className="champ">
                <label htmlFor={`lang-niv-${i}`}>Niveau</label>
                <select
                  id={`lang-niv-${i}`}
                  value={item.niveau}
                  onChange={maj("niveau")}
                >
                  {NIVEAUX_LANGUE.map((n) => (
                    <option key={n.v} value={n.v}>
                      {n.l}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </ListeRepetable>
      </Section>

      {/* ── Projet ────────────────────────────────────────────────────── */}
      <Section
        titre="Ce que vous cherchez"
        aide="Sans cette section, on ne sait distinguer ce que vous savez faire de ce que vous voulez faire."
        {...props("aspirations")}
      >
        <div className="champ">
          <label htmlFor="projet">Votre projet</label>
          <textarea
            id="projet"
            rows={4}
            value={profil.aspirations.projet}
            onChange={majChamp("aspirations", "projet")}
            placeholder="Le type de poste visé, l'environnement souhaité, ce que vous voulez apprendre."
          />
        </div>
      </Section>
    </div>
  );
};

export default ProfilScreen;
