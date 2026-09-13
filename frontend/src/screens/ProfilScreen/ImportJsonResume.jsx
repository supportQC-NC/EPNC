// src/screens/ProfilScreen/ImportJsonResume.jsx
//
// Importer un parcours au format JSON Resume.
//
// ══════════════════════════════════════════════════════════════════════════
//  POURQUOI CETTE PORTE EXISTE
// ══════════════════════════════════════════════════════════════════════════
// Jusqu'ici, la seule façon de renseigner un parcours était de le retaper
// entièrement. C'est précisément ce qui décourage : personne ne ressaisit dix
// ans de carrière dans un formulaire, surtout pour vérifier ensuite qu'aucune
// offre ne correspond.
//
// JSON Resume (jsonresume.org) est le format ouvert du CV. Quelqu'un qui en a
// déjà un — parce qu'il l'a exporté d'ici, d'un générateur de CV ou d'une
// autre plateforme — doit pouvoir le déposer et passer directement à la
// suite.
//
// ══════════════════════════════════════════════════════════════════════════
//  ON MONTRE AVANT D'ÉCRIRE
// ══════════════════════════════════════════════════════════════════════════
// L'import REMPLACE le parcours existant. Deux écrans, donc, jamais un seul :
// on dépose, on regarde ce qui va être remplacé et ce qui a été interprété, et
// on confirme. Un bouton « Importer » qui écrase sans montrer est un piège,
// pas un raccourci.
import { useState } from "react";
import {
  useApercuImportMutation,
  useImporterProfilMutation,
} from "../../slices/profilApiSlice";
import { messageErreur } from "../../utils/erreurApi";
import "./ImportJsonResume.css";

// Au-delà, on refuse avant de lire. Un JSON Resume pèse quelques dizaines de
// kilo-octets ; un fichier de plusieurs mégaoctets est autre chose, et le
// laisser parser bloquerait l'onglet.
const POIDS_MAX = 2 * 1024 * 1024;

const Compteur = ({ n, singulier, pluriel }) => (
  <li>
    <strong>{n}</strong> {n > 1 ? pluriel || `${singulier}s` : singulier}
  </li>
);

const ImportJsonResume = ({ onImporte }) => {
  const [apercu, { isLoading: enLecture }] = useApercuImportMutation();
  const [importer, { isLoading: enImport }] = useImporterProfilMutation();

  const [ouvert, setOuvert] = useState(false);
  const [resume, setResume] = useState(null);
  const [vu, setVu] = useState(null);
  const [erreur, setErreur] = useState("");
  const [fait, setFait] = useState("");

  const reinitialiser = () => {
    setResume(null);
    setVu(null);
    setErreur("");
  };

  const lireFichier = async (e) => {
    const fichier = e.target.files?.[0];
    // Remis à zéro tout de suite : sans cela, redéposer le même fichier après
    // une erreur ne déclenche aucun événement.
    e.target.value = "";
    if (!fichier) return;

    reinitialiser();

    if (fichier.size > POIDS_MAX) {
      setErreur(
        `Ce fichier fait ${Math.round(fichier.size / 1024)} Ko. Un JSON Resume en pèse quelques dizaines : vérifiez que c'est le bon fichier.`,
      );
      return;
    }

    let contenu;
    try {
      contenu = JSON.parse(await fichier.text());
    } catch {
      // Le cas le plus fréquent, et de loin : un PDF ou un .docx renommé, ou
      // un JSON tronqué par un copier-coller. Le dire précisément évite de
      // chercher du côté du profil.
      setErreur(
        "Ce fichier n'est pas du JSON lisible. Un JSON Resume est un fichier `.json` — un CV en PDF ou en Word ne peut pas être importé ici.",
      );
      return;
    }

    try {
      const resultat = await apercu(contenu).unwrap();
      setResume(contenu);
      setVu(resultat);
    } catch (err) {
      setErreur(messageErreur(err, "Ce document n'a pas pu être lu."));
    }
  };

  const confirmer = async () => {
    setErreur("");
    try {
      const r = await importer(resume).unwrap();
      setFait(r.message);
      reinitialiser();
      setOuvert(false);
      onImporte?.();
    } catch (err) {
      setErreur(messageErreur(err, "L'import a échoué."));
    }
  };

  if (!ouvert) {
    return (
      <div className="import-jr-repli">
        <div aria-live="polite">
          {fait && (
            <p className="message message-succes" role="status">
              {fait}
            </p>
          )}
        </div>
        <button
          type="button"
          className="btn btn-secondaire btn-compact"
          onClick={() => {
            setFait("");
            setOuvert(true);
          }}
        >
          Importer un JSON Resume
        </button>
        <p className="import-jr-accroche">
          Vous avez déjà votre CV au format{" "}
          <a href="https://jsonresume.org" target="_blank" rel="noreferrer noopener">
            JSON Resume
          </a>{" "}
          ? Déposez-le plutôt que de tout ressaisir.
        </p>
      </div>
    );
  }

  return (
    <section className="carte import-jr" aria-labelledby="titre-import">
      <h2 id="titre-import">Importer un parcours</h2>
      <p className="import-jr-intro">
        Déposez un fichier <code>.json</code> au format{" "}
        <a href="https://jsonresume.org" target="_blank" rel="noreferrer noopener">
          JSON Resume
        </a>
        . Rien n'est enregistré tant que vous n'avez pas confirmé.
      </p>

      {erreur && (
        <div className="message message-erreur" role="alert">
          {erreur}
        </div>
      )}

      {!vu && (
        <div className="champ">
          <input
            id="import-jr-fichier"
            className="sr-only"
            type="file"
            accept=".json,application/json"
            onChange={lireFichier}
          />
          <label htmlFor="import-jr-fichier" className="btn btn-principal btn-compact">
            {enLecture ? "Lecture…" : "Choisir un fichier"}
          </label>
          <span className="champ-aide">
            Votre fichier est lu par votre navigateur puis envoyé pour analyse.
            Il n'est pas conservé : seul le parcours qu'il contient le sera, si
            vous confirmez.
          </span>
        </div>
      )}

      {vu && (
        <div className="import-jr-apercu">
          <h3>Ce qui va être importé</h3>
          <ul className="import-jr-compteurs">
            <Compteur n={vu.resume.experiences} singulier="expérience" />
            <Compteur n={vu.resume.formations} singulier="formation" />
            <Compteur n={vu.resume.competences} singulier="compétence" />
            {vu.resume.langues > 0 && (
              <Compteur n={vu.resume.langues} singulier="langue" />
            )}
          </ul>

          {vu.resume.titre && (
            <p className="import-jr-titre">
              Intitulé repris : <strong>{vu.resume.titre}</strong>
            </p>
          )}

          {/* Ce qui disparaît, annoncé AVANT. Un message d'écrasement affiché
              après coup ne sert qu'à expliquer un accident. */}
          {!vu.remplace.vide && (
            <p className="import-jr-remplace" role="alert">
              <strong>Attention :</strong> votre parcours actuel sera remplacé —{" "}
              {vu.remplace.experiences} expérience(s), {vu.remplace.formations}{" "}
              formation(s) et {vu.remplace.competences} compétence(s) seront
              effacées. Votre photo et votre choix de visibilité auprès des
              recruteurs ne sont pas touchés.
            </p>
          )}

          {/* Ce qui a été INTERPRÉTÉ. C'est le bloc que la personne doit
              vraiment lire : ce sont des lectures raisonnables, pas des
              certitudes, et elles deviendront son CV. */}
          {vu.avertissements?.length > 0 && (
            <div className="import-jr-avertissements">
              <h4>À relire après l'import</h4>
              <ul>
                {vu.avertissements.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Ce que nous ne savons pas stocker. Le taire donnerait
              l'impression d'un import complet. */}
          {vu.ignores?.length > 0 && (
            <div className="import-jr-ignores">
              <h4>Non repris</h4>
              <ul>
                {vu.ignores.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
              <p>
                Ces sections du standard n'ont pas d'équivalent dans le profil.
                Vous pouvez en reporter l'essentiel à la main, par exemple dans
                une expérience ou dans votre accroche.
              </p>
            </div>
          )}

          <div className="actions">
            <button
              type="button"
              className="btn btn-principal btn-compact"
              onClick={confirmer}
              disabled={enImport}
            >
              {enImport ? "Import…" : "Confirmer l'import"}
            </button>
            <button
              type="button"
              className="btn btn-secondaire btn-compact"
              onClick={reinitialiser}
            >
              Choisir un autre fichier
            </button>
          </div>
        </div>
      )}

      <div className="actions">
        <button
          type="button"
          className="btn-lien-danger"
          onClick={() => {
            reinitialiser();
            setOuvert(false);
          }}
        >
          Annuler l'import
        </button>
      </div>
    </section>
  );
};

export default ImportJsonResume;
