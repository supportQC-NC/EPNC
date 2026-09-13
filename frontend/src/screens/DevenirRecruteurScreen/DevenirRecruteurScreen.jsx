// src/screens/DevenirRecruteurScreen/DevenirRecruteurScreen.jsx
//
// Demander un accès recruteur.
//
// ══════════════════════════════════════════════════════════════════════════
//  LE FORMULAIRE DIT POURQUOI IL DEMANDE CE QU'IL DEMANDE
// ══════════════════════════════════════════════════════════════════════════
// Un formulaire qui réclame six champs sans expliquer pourquoi passe pour une
// formalité administrative, et se remplit n'importe comment. Celui-ci dit dès
// la première ligne ce qui est en jeu : l'accès au vivier, c'est-à-dire aux
// parcours et aux coordonnées de personnes réelles.
//
// Dire la raison change ce qu'on reçoit. « Motivation » sans contexte produit
// « je souhaite recruter » ; la même question posée après avoir expliqué ce
// qu'on protège produit une réponse qu'un administrateur peut instruire.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DEMANDES_RECRUTEUR_URL } from "../../constants";
import "./DevenirRecruteurScreen.css";

const VIDE = {
  prenom: "",
  nom: "",
  email: "",
  telephone: "",
  organisation: "",
  employeurCode: "",
  fonction: "",
  siteOrganisation: "",
  motivation: "",
};

const DevenirRecruteurScreen = () => {
  const [form, setForm] = useState(VIDE);
  const [employeurs, setEmployeurs] = useState([]);
  const [erreur, setErreur] = useState("");
  const [envoye, setEnvoye] = useState("");
  const [enCours, setEnCours] = useState(false);

  // Le formulaire est PUBLIC : il ne peut pas passer par RTK Query, qui porte
  // le cookie de session et la purge d'état sur 401. Un simple `fetch` suffit.
  useEffect(() => {
    fetch(`${DEMANDES_RECRUTEUR_URL}/employeurs`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setEmployeurs)
      .catch(() => setEmployeurs([]));
  }, []);

  const maj = (champ) => (e) =>
    setForm((f) => ({ ...f, [champ]: e.target.value }));

  const soumettre = async (e) => {
    e.preventDefault();
    setErreur("");
    setEnCours(true);

    try {
      const r = await fetch(DEMANDES_RECRUTEUR_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const corps = await r.json();

      if (!r.ok) throw new Error(corps.message || "La demande n'a pas pu être transmise.");

      setEnvoye(corps.message);
      setForm(VIDE);
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnCours(false);
    }
  };

  if (envoye) {
    return (
      <div className="conteneur devenir">
        <div className="devenir-confirme" role="status">
          <h1>Demande transmise</h1>
          <p>{envoye}</p>
          <p className="devenir-aide">
            Vérifiez vos indésirables si vous ne recevez rien : notre message de
            confirmation part immédiatement.
          </p>
          <Link to="/" className="btn btn-secondaire">
            Retour à l'accueil
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="conteneur devenir">
      <header className="devenir-entete">
        <h1>Devenir recruteur</h1>
        <p className="devenir-intro">
          L'accès recruteur ouvre le vivier : les parcours, les compétences et
          les coordonnées de personnes qui cherchent un emploi et qui ont choisi
          d'être visibles. Elles confient ces informations à un service public,
          pas à qui remplit un formulaire — <strong>chaque demande est donc
          vérifiée par un administrateur</strong>, et vous recevez sa réponse
          par courriel, acceptée ou non, avec son motif.
        </p>
      </header>

      {erreur && (
        <div className="message message-erreur" role="alert">
          {erreur}
        </div>
      )}

      <form onSubmit={soumettre}>
        <section className="carte" aria-labelledby="titre-vous">
          <h2 id="titre-vous">Vous</h2>

          <div className="profil-duo">
            <div className="champ">
              <label htmlFor="prenom">Prénom</label>
              <input id="prenom" value={form.prenom} onChange={maj("prenom")} required />
            </div>
            <div className="champ">
              <label htmlFor="nom">Nom</label>
              <input id="nom" value={form.nom} onChange={maj("nom")} required />
            </div>
          </div>

          <div className="profil-duo">
            <div className="champ">
              <label htmlFor="email">Adresse email professionnelle</label>
              <input
                id="email"
                type="email"
                value={form.email}
                onChange={maj("email")}
                required
                aria-describedby="aide-email"
              />
              <span id="aide-email" className="champ-aide">
                Une adresse au nom de l'organisation est vérifiable en un coup
                d'œil, et votre demande sera traitée plus vite.
              </span>
            </div>
            <div className="champ">
              <label htmlFor="telephone">Téléphone</label>
              <input
                id="telephone"
                type="tel"
                value={form.telephone}
                onChange={maj("telephone")}
              />
            </div>
          </div>
        </section>

        <section className="carte" aria-labelledby="titre-organisation">
          <h2 id="titre-organisation">Votre organisation</h2>

          <div className="champ">
            <label htmlFor="employeurCode">Employeur répertorié</label>
            <select
              id="employeurCode"
              value={form.employeurCode}
              onChange={(e) => {
                const code = e.target.value;
                const trouve = employeurs.find((x) => x.code === code);
                setForm((f) => ({
                  ...f,
                  employeurCode: code,
                  organisation: trouve ? trouve.nom : f.organisation,
                }));
              }}
              aria-describedby="aide-employeur"
            >
              <option value="">Autre organisation</option>
              {employeurs.map((e) => (
                <option key={e.code} value={e.code}>
                  {e.nom}
                </option>
              ))}
            </select>
            <span id="aide-employeur" className="champ-aide">
              Les employeurs dont nous publions déjà les offres. Choisissez
              « Autre » si le vôtre n'y figure pas — cela ne change rien à vos
              chances.
            </span>
          </div>

          <div className="champ">
            <label htmlFor="organisation">Nom de l'organisation</label>
            <input
              id="organisation"
              value={form.organisation}
              onChange={maj("organisation")}
              required
            />
          </div>

          <div className="profil-duo">
            <div className="champ">
              <label htmlFor="fonction">Votre fonction</label>
              <input
                id="fonction"
                value={form.fonction}
                onChange={maj("fonction")}
                required
                placeholder="Chargée de recrutement, DRH, responsable de service…"
              />
            </div>
            <div className="champ">
              <label htmlFor="site">Site de l'organisation</label>
              <input
                id="site"
                type="url"
                value={form.siteOrganisation}
                onChange={maj("siteOrganisation")}
                placeholder="https://…"
                aria-describedby="aide-site"
              />
              <span id="aide-site" className="champ-aide">
                Facultatif, mais c'est souvent lui qui permet de trancher en
                trente secondes.
              </span>
            </div>
          </div>
        </section>

        <section className="carte" aria-labelledby="titre-usage">
          <h2 id="titre-usage">Ce que vous comptez en faire</h2>

          <div className="champ">
            <label htmlFor="motivation">
              Quels postes recrutez-vous, et comment comptez-vous utiliser le
              vivier ?
            </label>
            <textarea
              id="motivation"
              rows={5}
              value={form.motivation}
              onChange={maj("motivation")}
              required
              aria-describedby="aide-motivation"
              placeholder="Les postes que vous ouvrez, les profils que vous cherchez, le contexte de vos recrutements."
            />
            <span id="aide-motivation" className="champ-aide">
              C'est sur cette réponse que la décision se prend. Quelques phrases
              concrètes valent mieux qu'une formule.
            </span>
          </div>
        </section>

        <div className="actions">
          <button type="submit" className="btn btn-principal" disabled={enCours}>
            {enCours ? "Envoi…" : "Transmettre ma demande"}
          </button>
          <Link to="/" className="btn btn-secondaire">
            Annuler
          </Link>
        </div>
      </form>
    </div>
  );
};

export default DevenirRecruteurScreen;
