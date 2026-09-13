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
