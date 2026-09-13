// src/components/Global/MentionIA.jsx
import "./MentionIA.css";

// Mention obligatoire partout où un texte est produit automatiquement.
//
// Deux raisons de la centraliser plutôt que de la recopier à la main :
// elle doit être présente SANS EXCEPTION — un écran oublié est précisément
// celui où quelqu'un enverra un document sans l'avoir relu — et son libellé
// doit rester identique d'un bout à l'autre du site. Une mise en garde qui
// change de formulation d'un écran à l'autre finit par ne plus être lue.
//
// `variante` :
//   "bandeau"  — bloc en tête de section, pour une page qui produit des documents
//   "ligne"    — rappel discret sous un contenu déjà étiqueté
const MentionIA = ({ variante = "bandeau", modele }) => {
  if (variante === "ligne") {
    return (
      <p className="mention-ia mention-ia--ligne">
        <span className="mention-ia-pastille">IA</span>
        Texte produit automatiquement{modele ? ` par ${modele}` : ""} : il peut
        contenir des erreurs. Relisez-le et corrigez-le avant de l'utiliser.
      </p>
    );
  }

  return (
    <div className="mention-ia mention-ia--bandeau" role="note">
      <span className="mention-ia-pastille">IA</span>
      <p>
        <strong>Ces textes sont rédigés automatiquement</strong>
        {modele ? ` (${modele})` : ""}. L'intelligence artificielle se trompe :
        elle peut mal comprendre une attente du poste, forcer une nuance ou
        oublier un élément de votre parcours. <strong>Rien ne part en votre nom
        sans que vous l'ayez relu et validé</strong> — c'est vous qui signez
        cette candidature.
      </p>
    </div>
  );
};

export default MentionIA;
