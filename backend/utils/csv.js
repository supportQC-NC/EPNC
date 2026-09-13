// backend/utils/csv.js
//
// Analyseur CSV minimal, conforme à l'essentiel de la RFC 4180.
//
// Pourquoi ne pas ajouter une dépendance : les fichiers du référentiel métiers
// sont les seuls CSV du projet, et un `split(",")` ne suffit pas — plusieurs
// libellés de compétence contiennent des virgules et sont donc entre
// guillemets (« Hygiène, sécurité et conditions de travail »). Une trentaine
// de lignes couvrent le besoin réel : guillemets, virgules protégées,
// guillemets doublés et retours à la ligne CRLF.

export const parserCsv = (texte) => {
  const lignes = [];
  let champ = "";
  let ligne = [];
  let dansGuillemets = false;

  // Le BOM d'un fichier exporté depuis un tableur se retrouverait collé au
  // premier nom de colonne, rendant `enTetes[0]` introuvable.
  const contenu = texte.replace(/^﻿/, "");

  for (let i = 0; i < contenu.length; i++) {
    const c = contenu[i];

    if (dansGuillemets) {
      if (c === '"') {
        // Guillemet doublé = guillemet littéral.
        if (contenu[i + 1] === '"') {
          champ += '"';
          i++;
        } else {
          dansGuillemets = false;
        }
      } else {
        champ += c;
      }
      continue;
    }

    if (c === '"') {
      dansGuillemets = true;
    } else if (c === ",") {
      ligne.push(champ);
      champ = "";
    } else if (c === "\n") {
      ligne.push(champ);
      lignes.push(ligne);
      ligne = [];
      champ = "";
    } else if (c === "\r") {
      // Ignoré : le \n qui suit termine la ligne.
    } else {
      champ += c;
    }
  }

  // Dernière ligne si le fichier ne se termine pas par un saut de ligne.
  if (champ !== "" || ligne.length > 0) {
    ligne.push(champ);
    lignes.push(ligne);
  }

  if (lignes.length === 0) return [];

  const enTetes = lignes[0].map((e) => e.trim());

  return lignes
    .slice(1)
    // Une ligne vide en fin de fichier produirait un objet à champs vides.
    .filter((l) => l.some((v) => v.trim() !== ""))
    .map((l) =>
      Object.fromEntries(enTetes.map((e, i) => [e, (l[i] ?? "").trim()])),
    );
};

// Conversions tolérantes : le référentiel écrit les booléens en « true »/
// « false » et les nombres avec un point décimal (« 2.0 »).
export const versBooleen = (v) => String(v).toLowerCase() === "true";

export const versNombre = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
