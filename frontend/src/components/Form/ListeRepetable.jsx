// src/components/Form/ListeRepetable.jsx
import { useRef, useEffect } from "react";

// Liste d'éléments qu'on ajoute et retire : expériences, formations,
// compétences, langues. Écrit une fois plutôt que quatre — la logique d'ajout,
// de suppression et de mise à jour par index est identique partout, et c'est
// exactement le genre de code qu'on finit par corriger dans trois fichiers sur
// quatre.
//
//   items    : le tableau courant
//   onChange : reçoit le nouveau tableau
//   gabarit  : () => nouvel élément vide
//   children : (item, maj, index) => les champs de l'élément
//              `maj` est un helper : maj("poste")(event)
const ListeRepetable = ({
  items = [],
  onChange,
  gabarit,
  children,
  libelleAjout = "Ajouter",
  libelleVide = "Rien pour l'instant.",
  nomElement = "élément",
}) => {
  // Sert à donner le focus au premier champ de l'élément qu'on vient
  // d'ajouter : sans cela, sur mobile, on ajoute une ligne qui apparaît sous
  // le pli et rien ne se passe visiblement.
  const conteneur = useRef(null);
  const nbPrecedent = useRef(items.length);

  useEffect(() => {
    if (items.length > nbPrecedent.current && conteneur.current) {
      const blocs = conteneur.current.querySelectorAll("[data-bloc]");
      const dernier = blocs[blocs.length - 1];
      dernier?.querySelector("input, select, textarea")?.focus();
    }
    nbPrecedent.current = items.length;
  }, [items.length]);

  const majElement = (index) => (champ) => (e) => {
    const valeur =
      e?.target?.type === "checkbox" ? e.target.checked : e?.target?.value;
    const copie = items.map((item, i) =>
      i === index ? { ...item, [champ]: valeur } : item,
    );
    onChange(copie);
  };

  const retirer = (index) => onChange(items.filter((_, i) => i !== index));

  const ajouter = () => onChange([...items, gabarit()]);

  return (
    <div ref={conteneur}>
      {items.length === 0 && <p className="liste-vide">{libelleVide}</p>}

      {items.map((item, index) => (
        <div className="bloc-repetable" data-bloc key={item._id || index}>
          <div className="bloc-repetable-entete">
            {/* Numéroter les blocs donne un repère quand il y en a cinq :
                « supprimer » seul ne dit pas ce qu'on supprime. */}
            <span className="bloc-repetable-numero">
              {nomElement} {index + 1}
            </span>
            <button
              type="button"
              className="btn-lien-danger"
              onClick={() => retirer(index)}
            >
              Retirer
              <span className="sr-only">
                {" "}
                {nomElement} {index + 1}
              </span>
            </button>
          </div>

          {children(item, majElement(index), index)}
        </div>
      ))}

      <button type="button" className="btn btn-secondaire" onClick={ajouter}>
        {libelleAjout}
      </button>
    </div>
  );
};

export default ListeRepetable;
