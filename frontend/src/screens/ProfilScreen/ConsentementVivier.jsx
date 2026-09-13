// src/screens/ProfilScreen/ConsentementVivier.jsx
//
// Le consentement au partage du profil avec les recruteurs.
//
// ══════════════════════════════════════════════════════════════════════════
//  CE QUI A CHANGÉ, ET POURQUOI
// ══════════════════════════════════════════════════════════════════════════
// Avant : une case à cocher, et une phrase — « les recruteurs voient votre
// parcours, vos compétences et vos coordonnées ». C'était vrai et incomplet.
// La case ouvrait aussi l'accès à la photo, au CV en PDF, à l'export JSON
// Resume et au rapprochement du profil avec les postes du recruteur, écarts
// compris. Personne ne peut consentir à ce qu'on ne lui a pas dit.
//
// Maintenant : la liste exacte, en toutes lettres, AVANT la décision — et
// elle vient du serveur (`profil.vivier`), c'est-à-dire du même endroit que
// le code qui l'applique. Une liste recopiée dans le front aurait divergé au
// premier ajout de route.
//
// ══════════════════════════════════════════════════════════════════════════
//  TROIS RÈGLES DE CET ÉCRAN
// ══════════════════════════════════════════════════════════════════════════
// 1. RIEN N'EST REPLIÉ. Cacher derrière « en savoir plus » ce sur quoi on
//    demande un accord est le contraire d'un consentement éclairé. La liste
//    est longue : c'est l'information qui est longue, pas la mise en page.
// 2. ACCEPTER DEMANDE DEUX GESTES, RETIRER UN SEUL. Exposer ses coordonnées
//    doit être délibéré ; cesser de les exposer ne doit jamais être freiné
//    par une demande de confirmation.
// 3. LA DATE EST AFFICHÉE. « Vous avez accepté » sans date, c'est une case
//    cochée ; avec la date, c'est un accord que la personne peut situer,
//    contester, et retirer en connaissance de cause.
import { useState } from "react";
import { Link } from "react-router-dom";

const LISTES = [
  {
    cle: "liste",
    titre: "Visible dès la liste de recherche, sans ouvrir votre fiche",
    ton: "neutre",
  },
  {
    cle: "fiche",
    titre: "Visible quand un recruteur ouvre votre fiche",
    ton: "attention",
  },
  {
    cle: "usages",
    titre: "Ce qu'un recruteur peut faire de votre profil",
    ton: "neutre",
  },
  {
    cle: "jamais",
    titre: "Ce qui ne sort jamais",
    ton: "rassurant",
  },
];

const enFrancais = (valeur) => {
  if (!valeur) return "";
  const d = new Date(valeur);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const ConsentementVivier = ({ profil, onChanger, enCours }) => {
  const vivier = profil.vivier || {};
  const visible = Boolean(profil.visibleRecruteurs);
  const consentement = profil.consentementVivier || {};

  // Ouvert d'office quand le profil n'est pas encore visible : c'est le moment
  // où la personne a besoin de lire. Une fois visible, la liste reste
  // accessible mais ne réoccupe pas l'écran à chaque venue.
  const [deplie, setDeplie] = useState(!visible);
  const [lu, setLu] = useState(false);

  const accepter = async () => {
    await onChanger(true, vivier.version);
    setLu(false);
  };

  const retirer = () => onChanger(false);

  const detail = (
    <div className="partage-detail">
      {LISTES.map(({ cle, titre, ton }) => {
        const lignes = vivier[cle] || [];
        if (!lignes.length) return null;

        return (
          <div key={cle} className={`partage-groupe partage-groupe--${ton}`}>
            <h3 className="partage-groupe-titre">{titre}</h3>
            <ul className="partage-liste">
              {lignes.map((ligne) => (
                <li key={ligne}>{ligne}</li>
              ))}
            </ul>
          </div>
        );
      })}

      <p className="champ-aide">
        Les comptes recruteurs ne s'ouvrent pas librement : chaque demande est
        instruite par un administrateur. Le détail du traitement de vos données
        est sur la page <Link to="/confidentialite">Vos données</Link>.
      </p>
    </div>
  );

  // ── Profil déjà visible ────────────────────────────────────────────────
  if (visible) {
    return (
      <div className="partage">
        <p className="partage-etat partage-etat--actif">
          <strong>Votre profil est consultable par les recruteurs</strong>
          {consentement.accepteLe && (
            <> depuis le {enFrancais(consentement.accepteLe)}</>
          )}
          .
        </p>

        {vivier.aJour === false && (
          <div className="partage-alerte" role="alert">
            <strong>Ce qui est partagé a changé depuis votre accord.</strong>{" "}
            Votre profil est resté visible — nous ne le retirons pas à votre
            place — mais relisez la liste ci-dessous et confirmez, ou retirez
            votre visibilité.
            <button
              type="button"
              className="btn btn-secondaire btn-compact"
              onClick={() => {
                setDeplie(true);
                accepter();
              }}
              disabled={enCours}
            >
              J'ai relu et je confirme
            </button>
          </div>
        )}

        <button
          type="button"
          className="btn btn-secondaire btn-compact partage-retrait"
          onClick={retirer}
          disabled={enCours}
        >
          {enCours ? "…" : "Retirer ma visibilité"}
        </button>
        <p className="champ-aide">
          Le retrait est immédiat : votre profil disparaît des recherches et
          des fiches. Les recruteurs qui vous avaient mis de côté voient
          « profil retiré », pas vos informations.
        </p>

        <button
          type="button"
          className="partage-bascule"
          onClick={() => setDeplie((d) => !d)}
          aria-expanded={deplie}
        >
          {deplie ? "Masquer" : "Revoir"} ce que les recruteurs voient
        </button>

        {deplie && detail}
      </div>
    );
  }

  // ── Profil non visible : l'état par défaut ─────────────────────────────
  return (
    <div className="partage">
      <p className="partage-etat">
        <strong>Votre profil n'est visible d'aucun recruteur.</strong> C'est
        l'état par défaut, et il le reste tant que vous ne décidez pas le
        contraire : on crée un compte pour chercher un poste, pas pour figurer
        dans un annuaire.
      </p>

      <button
        type="button"
        className="partage-bascule"
        onClick={() => setDeplie((d) => !d)}
        aria-expanded={deplie}
      >
        {deplie ? "Masquer" : "Lire"} ce qui serait partagé
      </button>

      {deplie && detail}

      <label className="profil-bascule partage-case">
        <input
          type="checkbox"
          checked={lu}
          onChange={(e) => {
            setLu(e.target.checked);
            if (e.target.checked) setDeplie(true);
          }}
        />
        <span>
          J'ai lu la liste ci-dessus et j'accepte que ces informations —{" "}
          <strong>mes coordonnées et mon CV compris</strong> — soient partagées
          avec les recruteurs vérifiés de la plateforme.
        </span>
      </label>

      <button
        type="button"
        className="btn btn-principal"
        onClick={accepter}
        disabled={!lu || enCours}
      >
        {enCours ? "…" : "Rendre mon profil consultable"}
      </button>

      <p className="champ-aide">
        Réversible à tout moment, sans justification et sans délai.
      </p>
    </div>
  );
};

export default ConsentementVivier;
