// src/components/Global/BoutonSignaler.jsx
//
// Signaler un compte.
//
// ══════════════════════════════════════════════════════════════════════════
//  DISCRET, MAIS PAS CACHÉ
// ══════════════════════════════════════════════════════════════════════════
// Un bouton de signalement mis en avant invite à l'usage réflexe ; un bouton
// introuvable laisse les vrais problèmes sans recours. Il reste donc là où
// l'on cherche ce genre d'action — en bas de la fiche, en texte discret — et
// demande un MOTIF avant d'envoyer : un signalement sans motif ne s'instruit
// pas, et fait perdre son temps à tout le monde.
//
// On annonce aussi, avant l'envoi, que la personne ne saura pas ce qui a été
// décidé. C'est ce qui distingue un signalement d'une dénonciation dont on
// attend un résultat.
import { useState } from "react";
import { useSignalerMutation } from "../../slices/moderationApiSlice";
import { messageErreur } from "../../utils/erreurApi";
import "./BoutonSignaler.css";

const MOTIFS = [
  { valeur: "informations_fausses", libelle: "Informations manifestement fausses" },
  { valeur: "contenu_inapproprie", libelle: "Contenu inapproprié ou offensant" },
  { valeur: "coordonnees_invalides", libelle: "Coordonnées invalides ou injoignables" },
  { valeur: "doublon", libelle: "Profil en double" },
  { valeur: "usurpation", libelle: "Usurpation d'identité" },
  { valeur: "autre", libelle: "Autre motif" },
];

const BoutonSignaler = ({ cibleId, nom }) => {
  const [signaler, { isLoading }] = useSignalerMutation();

  const [ouvert, setOuvert] = useState(false);
  const [motif, setMotif] = useState("");
  const [details, setDetails] = useState("");
  const [erreur, setErreur] = useState("");
  const [envoye, setEnvoye] = useState("");

  const soumettre = async (e) => {
    e.preventDefault();
    setErreur("");

    try {
      const r = await signaler({ cibleId, motif, details }).unwrap();
      setEnvoye(r.message);
      setOuvert(false);
      setMotif("");
      setDetails("");
    } catch (err) {
      setErreur(messageErreur(err, "Le signalement n'a pas pu être transmis."));
    }
  };

  // Une fois transmis, le bouton ne revient pas : reproposer « Signaler »
  // juste après un envoi invite à recommencer, alors que le dossier est
  // ouvert.
  if (envoye) {
    return (
      <div className="signaler" aria-live="polite">
        <p className="signaler-confirme">{envoye}</p>
      </div>
    );
  }

  return (
    <div className="signaler">
      {ouvert ? (
        <form onSubmit={soumettre} className="signaler-formulaire">
          <h3>Signaler ce compte</h3>
          <p className="signaler-avertissement">
            Un administrateur examinera ce signalement. Il n'entraîne aucune
            suspension automatique, et vous ne serez pas informé de la suite
            donnée — la décision lui appartient.
          </p>

          <div className="champ">
            <label htmlFor="signaler-motif">Motif</label>
            <select
              id="signaler-motif"
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              required
            >
              <option value="">Choisissez un motif</option>
              {MOTIFS.map((m) => (
                <option key={m.valeur} value={m.valeur}>
                  {m.libelle}
                </option>
              ))}
            </select>
          </div>

          <div className="champ">
            <label htmlFor="signaler-details">Ce que vous avez constaté</label>
            <textarea
              id="signaler-details"
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              aria-describedby="aide-signaler"
              placeholder="Les faits précis, tels que vous les avez vus."
            />
            <span id="aide-signaler" className="champ-aide">
              Des faits vérifiables, pas une impression : c'est sur cette base
              que le dossier sera instruit.
            </span>
          </div>

          {erreur && (
            <div className="message message-erreur" role="alert">
              {erreur}
            </div>
          )}

          <div className="actions">
            <button
              type="submit"
              className="btn btn-danger btn-compact"
              disabled={isLoading || !motif}
            >
              {isLoading ? "Envoi…" : "Transmettre le signalement"}
            </button>
            <button
              type="button"
              className="btn btn-secondaire btn-compact"
              onClick={() => setOuvert(false)}
            >
              Annuler
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          className="signaler-declencheur"
          onClick={() => setOuvert(true)}
        >
          Signaler ce compte
          {nom && <span className="sr-only"> — {nom}</span>}
        </button>
      )}
    </div>
  );
};

export default BoutonSignaler;
