// src/components/Form/PhotoProfil.jsx
//
// Photo de profil : choix du fichier, redimensionnement, aperçu, retrait.
//
// ══════════════════════════════════════════════════════════════════════════
//  LE REDIMENSIONNEMENT SE FAIT DANS LE NAVIGATEUR, AVANT L'ENVOI
// ══════════════════════════════════════════════════════════════════════════
// Une photo prise au téléphone pèse 3 à 8 Mo. L'envoyer telle quelle voudrait
// dire : une requête lourde sur une liaison calédonienne souvent lente, un
// document Mongo de plusieurs mégaoctets, et cette masse rechargée à chaque
// lecture du profil — y compris dans la liste des candidats côté recruteur, où
// vingt photos pleine résolution rendraient la page inutilisable.
//
// Un `<canvas>` ramène l'image à 320 px de côté et la ré-encode en JPEG. Le
// résultat pèse une trentaine de kilo-octets, suffit largement pour une
// vignette et pour un CV imprimé, et ne demande aucune dépendance ni aucun
// service de traitement d'image.
//
// ⚠️ La photo n'est jamais obligatoire. Un CV sans photo est parfaitement
// recevable, et l'exiger ouvrirait la porte à une discrimination à l'embauche.
import { useRef, useState } from "react";
import "./PhotoProfil.css";

// Côté maximal de la vignette. 320 px couvre l'affichage écran (160 px en
// densité double) et l'impression d'un CV (environ 2,7 cm à 300 ppp).
const COTE_MAX = 320;

// Au-delà, on refuse avant même de lire le fichier : inutile de charger
// 40 Mo en mémoire pour découvrir que c'est une vidéo renommée.
const POIDS_MAX_OCTETS = 12 * 1024 * 1024;

const TYPES_ACCEPTES = ["image/png", "image/jpeg", "image/webp"];

const redimensionner = (fichier) =>
  new Promise((resolve, reject) => {
    const lecteur = new FileReader();

    lecteur.onerror = () => reject(new Error("Lecture du fichier impossible."));

    lecteur.onload = () => {
      const image = new Image();

      image.onerror = () =>
        reject(new Error("Ce fichier n'est pas une image exploitable."));

      image.onload = () => {
        const facteur = Math.min(
          1,
          COTE_MAX / Math.max(image.width, image.height),
        );

        // Une image déjà petite n'est pas agrandie : on ne fabrique pas des
        // pixels qui n'existent pas.
        const largeur = Math.round(image.width * facteur);
        const hauteur = Math.round(image.height * facteur);

        const toile = document.createElement("canvas");
        toile.width = largeur;
        toile.height = hauteur;

        const ctx = toile.getContext("2d");

        // Fond blanc AVANT de dessiner.
        //
        // Un `<canvas>` neuf est transparent, et le JPEG ne connaît pas la
        // transparence : sans ce fond, tout pixel transparent est aplati en
        // NOIR. Sur un portrait, cela ne se voit jamais — une photo est
        // opaque. Sur un logo, c'est systématique : ils sont presque tous
        // livrés en PNG détouré, et ressortaient dans un rectangle noir.
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, largeur, hauteur);

        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(image, 0, 0, largeur, hauteur);

        // JPEG à 0,82 : le seuil au-delà duquel l'œil ne gagne plus rien sur
        // un portrait, et en deçà duquel les aplats de peau se dégradent.
        resolve(toile.toDataURL("image/jpeg", 0.82));
      };

      image.src = lecteur.result;
    };

    lecteur.readAsDataURL(fichier);
  });

// ── Deux usages, une seule mécanique ──────────────────────────────────────
//
// Le composant sert d'abord au portrait d'un candidat, et maintenant au logo
// d'une organisation. Le traitement est le même — lire, réduire, encoder — mais
// l'affichage ne peut pas l'être : un logo recadré en rond perd la moitié de
// son texte, et se détoure sur un fond blanc plutôt que de remplir le cadre.
// D'où `variante`, qui ne change que la présentation.
//
// `id` est un paramètre parce que deux champs de fichier sur une même page ne
// peuvent pas partager un identifiant : le second `<label>` pointerait sur le
// premier champ, et cliquer « Ajouter un logo » ouvrirait le sélecteur de la
// photo.
const PhotoProfil = ({
  valeur,
  onChange,
  nom = "",
  id = "photo-profil-fichier",
  variante = "portrait",
  libelle = "photo",
  aide,
}) => {
  const champ = useRef(null);
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  const choisir = async (e) => {
    const fichier = e.target.files?.[0];
    // Le champ est remis à zéro tout de suite : sans cela, rechoisir le même
    // fichier après un retrait ne déclenche aucun événement.
    e.target.value = "";

    if (!fichier) return;

    setErreur("");

    if (!TYPES_ACCEPTES.includes(fichier.type)) {
      setErreur("Formats acceptés : JPEG, PNG ou WebP.");
      return;
    }

    if (fichier.size > POIDS_MAX_OCTETS) {
      setErreur(
        `Ce fichier fait ${Math.round(fichier.size / 1024 / 1024)} Mo. Choisissez une image de moins de 12 Mo.`,
      );
      return;
    }

    setEnCours(true);
    try {
      onChange(await redimensionner(fichier));
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnCours(false);
    }
  };

  // Initiales de repli : un rond vide ne dit pas de qui il s'agit dans une
  // liste de candidats.
  const initiales = nom
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m[0]?.toUpperCase())
    .join("");

  return (
    <div className={`photo-profil photo-profil--${variante}`}>
      {valeur ? (
        <img
          className="photo-profil-image"
          src={valeur}
          // L'image est décorative ici : l'identité est déjà écrite à côté, en
          // texte. Un alt qui répéterait le nom ferait doublon au lecteur
          // d'écran.
          alt=""
        />
      ) : (
        <div className="photo-profil-vide" aria-hidden="true">
          {/* Les initiales servent à distinguer des PERSONNES dans une liste.
              Pour une organisation, « OD » pour « Office des postes… » ne dit
              rien à personne : mieux vaut nommer la case vide. */}
          {variante === "logo" ? "Logo" : initiales || "?"}
        </div>
      )}

      <div className="photo-profil-actions">
        <input
          ref={champ}
          id={id}
          className="sr-only"
          type="file"
          accept={TYPES_ACCEPTES.join(",")}
          onChange={choisir}
        />
        {/* Le `<label>` fait office de bouton : le champ de fichier natif
            n'est pas stylable, et un bouton qui déclencherait le champ en
            JavaScript perdrait le lien accessible entre les deux. */}
        <label htmlFor={id} className="btn btn-secondaire btn-compact">
          {enCours
            ? "Traitement…"
            : valeur
              ? `Changer ${libelle === "photo" ? "la" : "le"} ${libelle}`
              : `Ajouter ${libelle === "photo" ? "une" : "un"} ${libelle}`}
        </label>

        {valeur && (
          <button
            type="button"
            className="btn btn-secondaire btn-compact"
            onClick={() => {
              setErreur("");
              onChange("");
            }}
          >
            Retirer
          </button>
        )}

        <p className="photo-profil-aide">
          {aide ||
            `Facultative. Elle est réduite à ${COTE_MAX} px dans votre navigateur avant l'envoi — aucune image lourde ne quitte votre appareil.`}
        </p>

        <div aria-live="polite">
          {erreur && (
            <p className="photo-profil-erreur" role="alert">
              {erreur}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default PhotoProfil;
