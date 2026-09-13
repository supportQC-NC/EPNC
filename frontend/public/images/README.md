# Images publiques

Les fichiers de ce dossier sont servis tels quels à la racine du site.
`public/images/hero.jpg` est donc accessible à l'adresse `/images/hero.jpg`.

## Photo du hero

**Déposez votre photo ici sous le nom `hero.jpg`.**

Pour un autre nom ou un autre format, une seule ligne à changer —
`HERO_PHOTO` dans `src/constants.js` :

```js
export const HERO_PHOTO = "/images/hero.jpg";
```

Tant qu'aucun fichier n'est présent, le navigateur n'affiche pas d'image et le
hero garde sa couleur de repli : la page reste correcte, simplement moins
habillée.

> **Pourquoi la photo est déclarée en JavaScript et pas en CSS.**
> Webpack résout les `url()` écrites dans une feuille de style **au moment de
> la compilation**. Un `background-image: url("/images/hero.jpg")` pointant
> vers un fichier absent ne produit donc pas un fond vide : il casse le build
> et l'application ne démarre plus du tout (page blanche). Appliquée en style
> en ligne depuis React, l'URL n'est pas résolue à la compilation — un fichier
> manquant redevient un simple fond vide.

## Le logo de la plateforme

**Déposez votre logo ici sous le nom `logo.png`.**

Il apparaît dans l'en-tête, sur toutes les pages. Tant qu'aucun fichier n'est
présent, l'en-tête garde le sigle textuel « EPNC » : le composant bascule tout
seul (`onError` dans `Header.jsx`). Il n'y a donc **aucun code à toucher** —
déposer le fichier suffit, et le retirer suffit à revenir au sigle.

Pour un autre nom ou un autre format, une seule ligne dans `src/constants.js` :

```js
export const LOGO = "/images/logo.png";
```

### Ce qui fonctionne bien à cet endroit

- **PNG détouré sur fond transparent**, ou **SVG** (plus léger et net à toute
  taille). Le logo est posé sur l'en-tête, dont la couleur change avec le
  thème clair/sombre : un logo sur fond blanc opaque fera une vignette blanche
  en thème sombre.
- **Hauteur utile d'au moins 64 px**, idéalement 128 px : il est affiché en
  32 px, et il faut le double pour rester net sur un écran à densité double.
- **Format horizontal ou carré.** L'affichage est en `contain` avec une hauteur
  fixe de 32 px et une largeur plafonnée à 160 px : un logo très allongé sera
  réduit, jamais déformé ni rogné.
- **Poids : quelques dizaines de kilo-octets suffisent.** Il est chargé sur
  chaque page.

### Le texte de remplacement

L'image est déclarée `alt=""` — **volontairement**. Le nom « Emploi Public NC »
est déjà écrit à côté, en texte, dans le même lien : un `alt` qui le répéterait
ferait entendre deux fois la même chose à un lecteur d'écran.

### Droits

Même règle que pour la photo du hero : n'utilisez qu'un logo dont vous détenez
les droits. La vidéo et l'article seront publics.

⚠️ Un logo **généré par une IA** est utilisable, mais vérifiez qu'il ne
reproduit pas une marque existante et qu'il ne reprend aucun emblème officiel
(armoiries, drapeau, logo d'une collectivité). L'application n'a **aucun lien
officiel** avec l'OPT-NC ni avec les collectivités dont elle republie les
offres — c'est écrit dans le pied de page, et le logo ne doit pas laisser
croire le contraire.

## Formats

`.jpg`, `.jpeg`, `.png` et `.webp` fonctionnent — pensez simplement à faire
correspondre l'extension dans `HERO_PHOTO`.

⚠️ **Évitez `.jfif` / `.jfi`.** C'est ce que produit Windows quand on
enregistre une image depuis Chrome. Le contenu est un JPEG tout à fait normal,
mais certains serveurs statiques ne connaissent pas cette extension et
renvoient un type MIME que le navigateur refuse d'afficher. Renommez le
fichier en `.jpg` : rien d'autre n'est à convertir.

## Ce qui fonctionne bien à cet endroit

- **Format paysage**, au moins **1920 × 1080**. L'image est recadrée en `cover`
  et centrée : elle sera rognée sur les côtés en portrait (téléphone) et en
  haut/bas sur un écran large. Évitez donc un sujet collé à un bord.
- **Poids : viser moins de 300 Ko.** C'est la première image de la page et elle
  couvre tout l'écran ; au-delà, l'affichage se fait attendre sur une connexion
  mobile calédonienne. Un JPEG qualité 75–80 en 1920 px de large suffit
  largement.
- **Une image plutôt calme et pas trop contrastée.** Le texte est posé
  par-dessus : une photo chargée de détails en haut à gauche gênera la lecture
  même avec le voile.

## Le voile de contraste

Le texte du hero doit rester lisible **quelle que soit la photo**, y compris
une photo très claire. Un double dégradé sombre est appliqué au-dessus de
l'image (`.hero::before` dans `LandingScreen.css`), calculé pour garantir un
contraste d'au moins 4,5:1 entre le texte blanc et le fond composité dans le
pire des cas.

Si la photo vous paraît trop assombrie, il est tentant de baisser ces
opacités : **c'est ce qui casse l'accessibilité**, qui est un critère noté du
hackathon. Préférez choisir une image plus sombre à la prise de vue, ou au
recadrage.

## Droits

N'utilisez qu'une photo dont vous détenez les droits, ou une image sous licence
libre (Unsplash, Pexels, Wikimedia Commons…). La vidéo de démonstration et
l'article dev.to seront publics : une image reprise au hasard du web est un
problème juridique, pas un détail.
