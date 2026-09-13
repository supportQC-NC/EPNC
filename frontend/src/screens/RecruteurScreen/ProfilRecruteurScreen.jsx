// src/screens/RecruteurScreen/ProfilRecruteurScreen.jsx
//
// Configurer son profil recruteur.
//
// Un recruteur ne décrit pas un parcours, il décrit un BESOIN. Ce formulaire
// ne demande donc ni expérience ni diplôme : il demande qui vous êtes, pour qui
// vous recrutez, et ce que vous cherchez — les seules informations qui servent
// à classer un vivier.
import { useEffect, useState } from "react";
import PhotoProfil from "../../components/Form/PhotoProfil";
import { Link } from "react-router-dom";
import {
  useGetProfilRecruteurQuery,
  useMajProfilRecruteurMutation,
} from "../../slices/recruteurEspaceApiSlice";
import { messageErreur } from "../../utils/erreurApi";
import "./recruteur.css";

const PROVINCES = [
  "Province Sud",
  "Province Nord",
  "Province des îles Loyauté",
  "Hors territoire",
];

// Les listes de mots-clés sont saisies en texte, séparées par des virgules.
// Un composant répétable par mot serait plus « propre » et beaucoup plus
// pénible : on tape « gestion, budget, comptabilité » d'un trait.
const enListe = (texte) =>
  texte
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);

const ProfilRecruteurScreen = () => {
  const { data, isLoading, isError, error } = useGetProfilRecruteurQuery();
  const [enregistrer, { isLoading: enCours }] = useMajProfilRecruteurMutation();

  const [form, setForm] = useState(null);
  const [erreur, setErreur] = useState("");
  const [enregistre, setEnregistre] = useState(false);

  useEffect(() => {
    if (data && !form) {
      setForm({
        organisation: data.organisation || "",
        employeurCode: data.employeurCode || "",
        logo: data.logo || "",
        fonction: data.fonction || "",
        telephone: data.telephone || "",
        competences: (data.recherche?.competences || []).join(", "),
        metiers: (data.recherche?.metiers || []).join(", "),
        motsCles: (data.recherche?.motsCles || []).join(", "),
        provinces: data.recherche?.provinces || [],
        note: data.recherche?.note || "",
        poidsHistorique: data.poidsHistorique ?? 50,
      });
    }
  }, [data, form]);

  if (isLoading || !form) {
    return (
      <div className="conteneur recruteur">
        <p role="status">Chargement de votre profil…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="conteneur recruteur">
        <div className="message message-erreur" role="alert">
          {messageErreur(error, "Impossible de charger votre profil.")}
        </div>
      </div>
    );
  }

  const maj = (champ) => (e) =>
    setForm((f) => ({ ...f, [champ]: e.target.value }));

  const basculerProvince = (p) =>
    setForm((f) => ({
      ...f,
      provinces: f.provinces.includes(p)
        ? f.provinces.filter((x) => x !== p)
        : [...f.provinces, p],
    }));

  const soumettre = async (e) => {
    e.preventDefault();
    setErreur("");
    setEnregistre(false);

    try {
      await enregistrer({
        organisation: form.organisation,
        employeurCode: form.employeurCode || null,
        logo: form.logo,
        fonction: form.fonction,
        telephone: form.telephone,
        poidsHistorique: Number(form.poidsHistorique),
        recherche: {
          competences: enListe(form.competences),
          metiers: enListe(form.metiers),
          motsCles: enListe(form.motsCles),
          provinces: form.provinces,
          note: form.note,
        },
      }).unwrap();

      setEnregistre(true);
      setTimeout(() => setEnregistre(false), 4000);
    } catch (err) {
      setErreur(messageErreur(err, "Enregistrement impossible."));
    }
  };

  return (
    <div className="conteneur recruteur">
      <header className="recruteur-entete">
        <h1>Configurer votre profil</h1>
        <p className="recruteur-intro">
          Ce que vous indiquez ici ne filtre rien : cela <strong>classe</strong>{" "}
          les profils du vivier. Un filtre ferait disparaître des candidats que
          vous n'avez pas pensé à décrire — c'est précisément ce qu'un vivier
          doit éviter.
        </p>
      </header>

      {erreur && (
        <div className="message message-erreur" role="alert">
          {erreur}
        </div>
      )}

      <div aria-live="polite">
        {enregistre && (
          <div className="message message-succes">
            Profil enregistré. Vos{" "}
            <Link to="/recruteur/suggestions">suggestions</Link> sont mises à
            jour.
          </div>
        )}
      </div>

      <form onSubmit={soumettre}>
        <section className="carte" aria-labelledby="titre-qui">
          <h2 id="titre-qui">Qui vous êtes</h2>

          {/* Le logo avant le reste : c'est lui qui fait qu'un candidat
              reconnaît l'organisation qui le contacte. Facultatif, comme la
              photo d'un candidat — et pour la même raison, aucun accès n'est
              conditionné à sa présence. */}
          <PhotoProfil
            valeur={form.logo}
            onChange={(logo) => setForm((f) => ({ ...f, logo }))}
            nom={form.organisation}
            id="logo-organisation"
            variante="logo"
            libelle="logo"
            aide="Facultatif. Il apparaît sur votre espace et à côté de votre nom quand vous contactez un candidat. Réduit à 320 px dans votre navigateur avant l'envoi."
          />

          <div className="champ">
            <label htmlFor="employeurCode">Organisation</label>
            <select
              id="employeurCode"
              value={form.employeurCode}
              onChange={(e) => {
                const code = e.target.value;
                const trouve = data.employeurs.find((x) => x.code === code);
                setForm((f) => ({
                  ...f,
                  employeurCode: code,
                  // Le nom suit la sélection : sans cela, changer
                  // d'organisation laisse l'ancien nom affiché partout.
                  organisation: trouve ? trouve.nom : f.organisation,
                }));
              }}
              aria-describedby="aide-employeur"
            >
              <option value="">Autre organisation</option>
              {data.employeurs.map((e) => (
                <option key={e.code} value={e.code}>
                  {e.nom}
                </option>
              ))}
            </select>
            <span id="aide-employeur" className="champ-aide">
              En choisissant une organisation répertoriée, ses offres ouvertes
              remontent sur votre tableau de bord.
            </span>
          </div>

          <div className="champ">
            <label htmlFor="organisation">Nom de l'organisation</label>
            <input
              id="organisation"
              value={form.organisation}
              onChange={maj("organisation")}
            />
          </div>

          <div className="profil-duo">
            <div className="champ">
              <label htmlFor="fonction">Votre fonction</label>
              <input
                id="fonction"
                value={form.fonction}
                onChange={maj("fonction")}
                placeholder="Chargée de recrutement, DRH…"
              />
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

        <section className="carte" aria-labelledby="titre-cherche">
          <h2 id="titre-cherche">Ce que vous cherchez</h2>

          <div className="champ">
            <label htmlFor="competences">Compétences recherchées</label>
            <input
              id="competences"
              value={form.competences}
              onChange={maj("competences")}
              list="vivier-competences-reco"
              autoComplete="off"
              aria-describedby="aide-competences"
              placeholder="gestion budgétaire, accueil du public, fibre optique"
            />
            {/* Le vocabulaire proposé vient des profils réellement présents :
                suggérer des compétences que personne ne déclare ferait croire
                à un vivier vide. */}
            <datalist id="vivier-competences-reco">
              {(data.competencesDuVivier || []).map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <span id="aide-competences" className="champ-aide">
              Séparez par des virgules. C'est le critère qui pèse le plus dans
              le classement.
            </span>
          </div>

          <div className="champ">
            <label htmlFor="metiers">Métiers visés</label>
            <input
              id="metiers"
              value={form.metiers}
              onChange={maj("metiers")}
              placeholder="gestionnaire, technicien réseau, juriste"
            />
          </div>

          <div className="champ">
            <label htmlFor="motsCles">Autres mots-clés</label>
            <input
              id="motsCles"
              value={form.motsCles}
              onChange={maj("motsCles")}
            />
          </div>

          <fieldset className="champ">
            <legend>Territoires</legend>
            <div className="recruteur-cases">
              {PROVINCES.map((p) => (
                <label key={p} className="recruteur-case">
                  <input
                    type="checkbox"
                    aria-label={p}
                    checked={form.provinces.includes(p)}
                    onChange={() => basculerProvince(p)}
                  />
                  {p}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="champ">
            <label htmlFor="note">Contexte (facultatif)</label>
            <textarea
              id="note"
              rows={3}
              value={form.note}
              onChange={maj("note")}
              placeholder="Ce que les mots-clés ne disent pas : contraintes de poste, profil d'équipe, échéances."
            />
          </div>
        </section>

        <section className="carte" aria-labelledby="titre-reglage">
          <h2 id="titre-reglage">Comment les suggestions sont calculées</h2>

          <p className="recruteur-intro">
            Deux signaux nourrissent le classement : ce que vous déclarez
            ci-dessus, et les profils que vous mettez de côté. Le curseur règle
            le dosage entre les deux.
          </p>

          <div className="champ">
            <label htmlFor="poids">
              Poids des profils que vous avez enregistrés :{" "}
              <strong>{form.poidsHistorique} %</strong>
            </label>
            <input
              id="poids"
              type="range"
              min="0"
              max="100"
              step="10"
              value={form.poidsHistorique}
              onChange={maj("poidsHistorique")}
              aria-describedby="aide-poids"
            />
            {/* La valeur est écrite en toutes lettres au-dessus : un curseur
                seul n'est pas lisible par tout le monde, et `aria-valuetext`
                sur un input range n'est pas fiable d'un lecteur à l'autre. */}
            <span id="aide-poids" className="champ-aide">
              À 0 %, seuls vos critères déclarés comptent — utile quand vous
              savez exactement ce que vous cherchez. À 100 %, l'outil ne
              s'appuie que sur les profils que vous avez retenus. À 50 %, les
              deux pèsent autant.
            </span>
          </div>
        </section>

        <div className="actions">
          <button type="submit" className="btn btn-principal" disabled={enCours}>
            {enCours ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProfilRecruteurScreen;
