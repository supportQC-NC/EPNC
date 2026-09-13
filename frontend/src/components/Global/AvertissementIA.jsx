// src/components/Global/AvertissementIA.jsx
import { useEffect, useRef } from "react";
import "./AvertissementIA.css";

// Avertissement présenté à la première ouverture de l'assistant, et qu'il faut
// valider avant de pouvoir l'utiliser.
//
// Volontairement bloquant. Un bandeau se survole sans se lire ; ici la personne
// doit poser un geste. C'est le seul moment du parcours où l'on peut être
// certain que le message a été mis sous les yeux — après, l'attention va à la
// réponse, pas à la mise en garde.
//
// La validation est enregistrée côté serveur (voir assistantController) : elle
// vaut prise de connaissance, pas préférence d'affichage.
const AvertissementIA = ({ modele, enCours, onAccepter }) => {
  const boutonRef = useRef(null);

  useEffect(() => {
    // Le focus part sur le bouton : au clavier comme au lecteur d'écran, on
    // arrive directement sur l'action, pas au début de la page derrière.
    boutonRef.current?.focus();

    // Échap ne ferme pas : il n'y a pas de « plus tard » pour cet écran.
    const bloquerEchap = (e) => {
      if (e.key === "Escape") e.preventDefault();
    };

    // Le fond ne doit pas défiler pendant que la fenêtre est ouverte.
    const debordementInitial = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", bloquerEchap);

    return () => {
      document.body.style.overflow = debordementInitial;
      document.removeEventListener("keydown", bloquerEchap);
    };
  }, []);

  return (
    <div className="avertissement-fond">
      <div
        className="avertissement"
        role="dialog"
        aria-modal="true"
        aria-labelledby="avertissement-titre"
        aria-describedby="avertissement-texte"
      >
        <span className="avertissement-pastille" aria-hidden="true">
          IA
        </span>

        <h2 id="avertissement-titre">
          L'assistant est un outil, pas une autorité
        </h2>

        <div id="avertissement-texte" className="avertissement-texte">
          <p>
            Les réponses sont produites automatiquement
            {modele ? ` (${modele})` : ""} et <strong>peuvent être fausses</strong>.
            C'est une aide à la réflexion, pas un conseil officiel :{" "}
            <strong>
              vérifiez toute information déterminante auprès de l'employeur ou
              de la DRHFPNC
            </strong>
            .
          </p>
          <p>
            Un outil vous fait gagner du temps et vous aide à y voir clair. Il
            ne décide pas à votre place, il n'engage pas l'OPT-NC, et il ne
            remplace pas votre jugement. Ce que vous enverrez à un employeur
            reste votre candidature, et vous en répondez.
          </p>
        </div>

        <button
          ref={boutonRef}
          type="button"
          className="btn btn-principal btn-bloc"
          onClick={onAccepter}
          disabled={enCours}
        >
          {enCours ? "Enregistrement…" : "J'ai compris"}
        </button>

        <p className="avertissement-pied">
          Cet avertissement ne s'affichera plus. Il reste rappelé sous la zone
          de saisie.
        </p>
      </div>
    </div>
  );
};

export default AvertissementIA;
