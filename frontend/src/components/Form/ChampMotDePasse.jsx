// src/components/Form/ChampMotDePasse.jsx
import { useState } from "react";
import "./ChampMotDePasse.css";

// Champ de mot de passe avec bouton d'affichage.
//
// Pourquoi ce n'est pas un gadget : sur un formulaire d'inscription, la faute
// de frappe invisible est la première cause d'abandon — et sur téléphone, où
// l'on tape à l'aveugle sur un clavier virtuel, elle est systématique. Pouvoir
// relire ce qu'on a tapé supprime l'aller-retour « mot de passe refusé ».
//
// Le bouton porte `aria-pressed` : son état est annoncé, pas seulement dessiné.
const ChampMotDePasse = ({
  id,
  label,
  valeur,
  onChange,
  autoComplete = "new-password",
  aide,
  requis = true,
  etat,
}) => {
  const [visible, setVisible] = useState(false);
  const idAide = aide || etat ? `${id}-aide` : undefined;

  return (
    <div className="champ">
      <label htmlFor={id}>{label}</label>

      <div className="mdp-zone">
        <input
          id={id}
          name={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={valeur}
          onChange={onChange}
          aria-describedby={idAide}
          required={requis}
        />
        <button
          type="button"
          className="mdp-bouton"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          // Le libellé décrit l'ACTION, pas l'état : « Afficher » quand c'est
          // masqué. Un bouton nommé d'après son état laisse toujours un doute.
          aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        >
          {visible ? "Masquer" : "Afficher"}
        </button>
      </div>

      {(aide || etat) && (
        <span
          id={idAide}
          className={`champ-aide${etat ? ` mdp-etat mdp-etat--${etat.type}` : ""}`}
          // Le retour de concordance change pendant la frappe : il doit être
          // annoncé, sinon il n'existe que pour ceux qui le voient.
          aria-live={etat ? "polite" : undefined}
        >
          {etat ? etat.message : aide}
        </span>
      )}
    </div>
  );
};

export default ChampMotDePasse;
