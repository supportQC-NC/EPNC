// backend/services/cvPdfService.js
//
// Rendu du CV en PDF, mis en page.
//
// ══════════════════════════════════════════════════════════════════════════
//  LE CV EST RENDU DEPUIS LE PROFIL STRUCTURÉ, PAS DEPUIS UN TEXTE
// ══════════════════════════════════════════════════════════════════════════
// Les trois autres pièces sont du texte suivi : la lettre, l'analyse et la
// préparation se lisent comme des documents écrits. Un CV, non — c'est une
// structure. Le rendre comme un bloc de texte produisait une page grise qu'un
// recruteur qui dépouille une pile ne lit pas.
//
// Surtout, le rendre depuis la STRUCTURE règle le problème le plus sérieux de
// la rédaction assistée : un CV ne peut plus contenir un employeur, une date ou
// un diplôme qui ne figure pas au profil, puisque chaque ligne est lue dans le
// profil. La règle « aucune information absente du profil source » cesse d'être
// une consigne qu'on espère voir respectée pour devenir une propriété du code.
//
// Le modèle garde un rôle, mais un rôle borné : il choisit l'ORDRE et
// reformule l'accroche pour le poste visé (voir redactionService). Il ne
// fabrique aucun fait.

import PDFDocument from "pdfkit";

const MARGE = 48;

// Largeur de la colonne de gauche (identité, contact, compétences, langues).
// Deux colonnes plutôt qu'une : un recruteur cherche d'abord le nom, le métier
// et les compétences — les avoir en regard des expériences lui évite de
// remonter dans la page.
const COL_GAUCHE = 168;
const GOUTTIERE = 22;

const ENCRE = "#111111";
const DOUX = "#555555";
const MARQUE = "#14507d";
const FILET = "#d5dbe3";

const propre = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);

// « 2015 → 2024 », « 2015 → aujourd'hui », « 2015 ». Une période illisible vaut
// mieux absente qu'approximative : on n'invente aucune borne.
const periode = (debut, fin, enCours) => {
  const d = propre(debut);
  const f = enCours ? "aujourd'hui" : propre(fin);
  if (d && f) return `${d} → ${f}`;
  return d || f || null;
};

const NIVEAUX_COMPETENCE = {
  notions: "Notions",
  pratique: "Pratique",
  maitrise: "Maîtrise",
  expert: "Expert",
};

const NIVEAUX_LANGUE = {
  notions: "Notions",
  courant: "Courant",
  bilingue: "Bilingue",
  maternelle: "Langue maternelle",
};

// Une image base64 en Buffer, pour PDFKit. Renvoie null si la donnée est
// inexploitable : un CV sans photo se rend très bien, un CV qui plante non.
const photoEnBuffer = (dataUri) => {
  if (typeof dataUri !== "string") return null;
  const trouve = dataUri.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
  // ⚠️ PDFKit ne sait lire que PNG et JPEG. Une photo WebP — acceptée par le
  // formulaire — passerait ici sans être reconnue ; le navigateur la
  // ré-encode en JPEG au redimensionnement, donc le cas ne se présente pas,
  // mais on refuse proprement plutôt que de laisser PDFKit lever.
  if (!trouve) return null;
  try {
    return Buffer.from(trouve[2], "base64");
  } catch {
    return null;
  }
};

// ── Primitives de mise en page ────────────────────────────────────────────

const titreSection = (doc, texte, x, largeur) => {
  doc
    .font("Helvetica-Bold")
    .fontSize(8.5)
    .fillColor(MARQUE)
    .text(texte.toUpperCase(), x, doc.y, {
      width: largeur,
      characterSpacing: 0.6,
    });

  // Filet sous le titre : il structure la page sans ajouter de bruit.
  const y = doc.y + 3;
  doc
    .moveTo(x, y)
    .lineTo(x + largeur, y)
    .lineWidth(0.6)
    .strokeColor(FILET)
    .stroke();

  doc.y = y + 7;
  doc.fillColor(ENCRE);
};

/**
 * Produit le PDF d'un CV à partir du profil structuré.
 *
 * `ordre` (optionnel) permet de faire remonter ce qui compte pour l'offre
 * visée : `{ experiences: [2,0,1], competences: [...] }` donne les index du
 * profil dans l'ordre d'affichage souhaité. Absent, l'ordre du profil est
 * conservé — on ne réordonne jamais au hasard.
 *
 * `accroche` (optionnel) remplace l'accroche du profil par une version
 * recentrée sur le poste. C'est la seule phrase que le modèle réécrit.
 */
/**
 * Réordonne une liste selon des indices, ou la rend INTACTE au moindre doute.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  L'INVARIANT : AUCUNE EXPÉRIENCE NE DISPARAÎT, JAMAIS
 * ══════════════════════════════════════════════════════════════════════════
 * Le CV est recentré sur le poste : les expériences les plus pertinentes
 * remontent. Mais un réordonnancement partiel ou fautif — indices en double,
 * liste tronquée, indice hors bornes — ferait DISPARAÎTRE une expérience du CV
 * d'une personne, sans que rien ne l'en avertisse. Elle enverrait un document
 * amputé de son premier emploi en croyant l'avoir relu.
 *
 * D'où la règle : tout ordre qui n'est pas une PERMUTATION COMPLÈTE et valide
 * est refusé en bloc, et la liste d'origine sort telle quelle. Un CV mal
 * ordonné reste un CV vrai ; un CV amputé est un faux.
 *
 * Sortie de `cvPdf` et exportée pour être éprouvée : c'est le genre de garantie
 * qui ne vaut que si elle est testée.
 */
export const reordonner = (liste, indices) => {
  if (!Array.isArray(indices) || indices.length !== liste.length) return liste;
  if (new Set(indices).size !== liste.length) return liste;
  if (indices.some((i) => !Number.isInteger(i) || i < 0 || i >= liste.length))
    return liste;
  return indices.map((i) => liste[i]);
};

export const cvPdf = ({ profil, user, avp = null, ordre = null, accroche = null, date }) =>
  new Promise((resolve, reject) => {
    const creation = date ? new Date(date) : new Date();
    const nom = `${user.prenom} ${user.nom}`.trim();

    const doc = new PDFDocument({
      size: "A4",
      margins: { top: MARGE, bottom: MARGE, left: MARGE, right: MARGE },
      info: {
        Title: `CV — ${nom}`,
        Author: nom,
        Subject: avp?.intitule || "Curriculum vitae",
        CreationDate: creation,
        ModDate: creation,
      },
    });

    const morceaux = [];
    doc.on("data", (c) => morceaux.push(c));
    doc.on("end", () => resolve(Buffer.concat(morceaux)));
    doc.on("error", reject);

    const xGauche = MARGE;
    const xDroite = MARGE + COL_GAUCHE + GOUTTIERE;
    const largeurDroite = doc.page.width - xDroite - MARGE;

    // Réordonnancement : on n'utilise l'ordre proposé que s'il désigne
    // exactement les mêmes éléments. Un ordre partiel ferait DISPARAÎTRE des
    // expériences du CV sans que personne s'en aperçoive — le pire défaut
    // possible sur ce document.
    const experiences = reordonner(profil.experiences || [], ordre?.experiences);
    const competences = reordonner(profil.competences || [], ordre?.competences);

    // ══ COLONNE DE GAUCHE ═════════════════════════════════════════════
    doc.y = MARGE;

    const photo = photoEnBuffer(profil.basics?.photo);
    if (photo) {
      try {
        doc.image(photo, xGauche, doc.y, { fit: [COL_GAUCHE, 120], align: "left" });
        doc.y += 128;
      } catch {
        // Image refusée par PDFKit : on continue sans elle.
      }
    }

    doc.font("Helvetica-Bold").fontSize(17).fillColor(ENCRE);
    doc.text(nom, xGauche, doc.y, { width: COL_GAUCHE });

    if (propre(profil.basics?.titre)) {
      doc.moveDown(0.2);
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor(MARQUE)
        .text(profil.basics.titre, xGauche, doc.y, { width: COL_GAUCHE });
    }

    doc.moveDown(1);

    // Contact
    const contact = [
      propre(user.email),
      propre(profil.basics?.telephone),
      propre(profil.basics?.adresse),
      [propre(profil.basics?.codePostal), propre(profil.basics?.ville)]
        .filter(Boolean)
        .join(" ") || null,
      propre(profil.basics?.province),
      profil.basics?.permis?.length
        ? `Permis ${profil.basics.permis.join(", ")}`
        : null,
    ].filter(Boolean);

    if (contact.length) {
      titreSection(doc, "Contact", xGauche, COL_GAUCHE);
      doc.font("Helvetica").fontSize(8.5).fillColor(DOUX);
      contact.forEach((l) =>
        doc.text(l, xGauche, doc.y, { width: COL_GAUCHE, lineGap: 1.5 }),
      );
      doc.moveDown(1);
    }

    if (competences.length) {
      titreSection(doc, "Compétences", xGauche, COL_GAUCHE);
      doc.fontSize(8.5);
      competences.forEach((c) => {
        doc
          .font("Helvetica-Bold")
          .fillColor(ENCRE)
          .text(c.nom || "", xGauche, doc.y, { width: COL_GAUCHE, continued: false });
        doc
          .font("Helvetica")
          .fillColor(DOUX)
          .text(NIVEAUX_COMPETENCE[c.niveau] || c.niveau || "", xGauche, doc.y, {
            width: COL_GAUCHE,
            paragraphGap: 4,
          });
      });
      doc.moveDown(0.8);
    }

    if (profil.langues?.length) {
      titreSection(doc, "Langues", xGauche, COL_GAUCHE);
      doc.font("Helvetica").fontSize(8.5).fillColor(DOUX);
      profil.langues.forEach((l) =>
        doc.text(
          `${l.nom} — ${NIVEAUX_LANGUE[l.niveau] || l.niveau}`,
          xGauche,
          doc.y,
          { width: COL_GAUCHE, lineGap: 1.5 },
        ),
      );
      doc.moveDown(0.8);
    }

    if (profil.basics?.liens?.length) {
      titreSection(doc, "Liens", xGauche, COL_GAUCHE);
      doc.font("Helvetica").fontSize(8).fillColor(DOUX);
      profil.basics.liens.forEach((l) => {
        const libelle = propre(l.reseau) || propre(l.url);
        if (!libelle) return;
        doc.text(libelle, xGauche, doc.y, {
          width: COL_GAUCHE,
          link: propre(l.url) || undefined,
          underline: Boolean(propre(l.url)),
          lineGap: 1.5,
        });
      });
      doc.moveDown(0.8);
    }

    if (profil.interets?.length) {
      titreSection(doc, "Centres d'intérêt", xGauche, COL_GAUCHE);
      doc.font("Helvetica").fontSize(8).fillColor(DOUX);
      profil.interets.forEach((i) => {
        const texte = i.motsCles?.length
          ? `${i.nom} — ${i.motsCles.join(", ")}`
          : i.nom;
        if (propre(texte)) {
          doc.text(texte, xGauche, doc.y, { width: COL_GAUCHE, lineGap: 1.5 });
        }
      });
    }

    const basGauche = doc.y;

    // ══ COLONNE DE DROITE ═════════════════════════════════════════════
    doc.y = MARGE;

    const presentation = propre(accroche) || propre(profil.basics?.accroche);
    if (presentation) {
      titreSection(doc, "Présentation", xDroite, largeurDroite);
      doc
        .font("Helvetica")
        .fontSize(9.5)
        .fillColor(ENCRE)
        .text(presentation, xDroite, doc.y, {
          width: largeurDroite,
          align: "justify",
          lineGap: 1.5,
        });
      doc.moveDown(1);
    }

    if (experiences.length) {
      titreSection(doc, "Expérience professionnelle", xDroite, largeurDroite);

      experiences.forEach((e, index) => {
        // Saut de page : on ne coupe pas une expérience entre deux pages si
        // l'on peut l'éviter. 90 points, c'est la place d'un intitulé, d'une
        // ligne d'employeur et de deux lignes de description.
        if (doc.y > doc.page.height - MARGE - 90) {
          doc.addPage();
          doc.y = MARGE;
        }

        doc
          .font("Helvetica-Bold")
          .fontSize(10)
          .fillColor(ENCRE)
          .text(propre(e.poste) || "Poste", xDroite, doc.y, { width: largeurDroite });

        const sousTitre = [
          propre(e.employeur),
          propre(e.lieu),
          periode(e.debut, e.fin, e.enCours),
        ]
          .filter(Boolean)
          .join(" · ");

        if (sousTitre) {
          doc
            .font("Helvetica")
            .fontSize(8.5)
            .fillColor(DOUX)
            .text(sousTitre, xDroite, doc.y, { width: largeurDroite });
        }

        if (propre(e.description)) {
          doc.moveDown(0.25);
          doc
            .font("Helvetica")
            .fontSize(9)
            .fillColor(ENCRE)
            .text(e.description, xDroite, doc.y, {
              width: largeurDroite,
              lineGap: 1.2,
            });
        }

        (e.realisations || []).filter(propre).forEach((r) => {
          doc
            .font("Helvetica")
            .fontSize(9)
            .fillColor(ENCRE)
            .text(`•  ${r}`, xDroite + 6, doc.y, {
              width: largeurDroite - 6,
              lineGap: 1.2,
            });
        });

        if (index < experiences.length - 1) doc.moveDown(0.7);
      });

      doc.moveDown(1);
    }

    if (profil.formations?.length) {
      if (doc.y > doc.page.height - MARGE - 80) {
        doc.addPage();
        doc.y = MARGE;
      }

      titreSection(doc, "Formation", xDroite, largeurDroite);

      profil.formations.forEach((f) => {
        doc
          .font("Helvetica-Bold")
          .fontSize(9.5)
          .fillColor(ENCRE)
          .text(propre(f.intitule) || "Formation", xDroite, doc.y, {
            width: largeurDroite,
          });

        const sousTitre = [
          propre(f.etablissement),
          propre(f.niveau),
          f.enCours ? "en cours" : propre(f.annee),
        ]
          .filter(Boolean)
          .join(" · ");

        if (sousTitre) {
          doc
            .font("Helvetica")
            .fontSize(8.5)
            .fillColor(DOUX)
            .text(sousTitre, xDroite, doc.y, {
              width: largeurDroite,
              paragraphGap: 5,
            });
        }
      });
    }

    // Filet de séparation entre les deux colonnes, sur la première page
    // seulement : il tient la mise en page à l'œil sans alourdir les suivantes.
    const basPage = Math.max(basGauche, doc.y);
    doc
      .moveTo(MARGE + COL_GAUCHE + GOUTTIERE / 2, MARGE)
      .lineTo(MARGE + COL_GAUCHE + GOUTTIERE / 2, Math.min(basPage, doc.page.height - MARGE))
      .lineWidth(0.5)
      .strokeColor(FILET)
      .stroke();

    doc.end();
  });
