// backend/services/pdfService.js
//
// Rendu PDF des pièces de candidature, CÔTÉ SERVEUR.
//
// Pourquoi pas depuis le navigateur : le rendu dépendrait des polices
// installées sur la machine du candidat, de son zoom et de son navigateur. Deux
// personnes n'obtiendraient pas le même document, et nous ne pourrions pas
// joindre le PDF à un email — il n'existerait que dans l'onglet. Ici, le même
// texte produit toujours le même fichier.
//
// PDFKit plutôt qu'un navigateur sans interface (Puppeteer) : 300 Ko de
// dépendance contre 300 Mo de Chromium, pour quatre documents en texte suivi
// sans mise en page complexe. Le critère « adéquation moyens/résultats »
// sanctionne l'inverse.

import PDFDocument from "pdfkit";

// 2 cm de marge : la norme d'une lettre administrative française.
const MARGE = 57;

// ⚠️ L'employeur ne doit RIEN savoir du processus de génération — c'est écrit
// dans le règlement. La lettre et le CV ne portent donc aucune mention d'outil,
// aucun pied de page, aucun filigrane. Seules les pièces destinées au candidat
// en portent une.
const POUR_EMPLOYEUR = new Set(["lettre", "cv"]);

const MARQUE = "#14507d";
const DOUX = "#555555";

const TITRES = {
  lettre: "Lettre de candidature",
  cv: "Curriculum vitae",
  restitution: "Analyse de votre candidature",
  preparation: "Préparation à l'entretien",
};

// Une ligne est un titre de section si elle est courte et entièrement en
// capitales — c'est la forme que produisent les consignes de rédaction
// (« VOS POINTS FORTS », « QUESTIONS À POSER »). On la détecte plutôt que de
// demander du Markdown au modèle : moins de contraintes sur la génération,
// et un texte qui reste lisible tel quel si le rendu change.
const estTitre = (ligne) => {
  const l = ligne.trim();
  if (l.length < 3 || l.length > 70) return false;
  if (!/[A-ZÀ-Þ]/.test(l)) return false;
  return l === l.toUpperCase() && !l.endsWith(".");
};

const estPuce = (ligne) => /^\s*[-•*—]\s+/.test(ligne);

// Le bloc d'identité d'une lettre ou d'un CV : qui écrit, comment le joindre.
// Il ne vient PAS du texte produit — le modèle n'a pas à réécrire un numéro de
// téléphone, c'est la meilleure façon d'en inventer un.
const enTeteCandidat = (doc, user, profil) => {
  const lignes = [
    `${user.prenom} ${user.nom}`.trim(),
    profil?.basics?.ville || null,
    profil?.basics?.telephone || null,
    user.email,
  ].filter(Boolean);

  doc.font("Helvetica-Bold").fontSize(12).fillColor("#111111");
  doc.text(lignes[0]);

  doc.font("Helvetica").fontSize(9.5).fillColor("#555555");
  lignes.slice(1).forEach((l) => doc.text(l));

  doc.moveDown(1.5).fillColor("#111111");
};

const corps = (doc, texte) => {
  const lignes = String(texte || "").split("\n");

  for (const ligne of lignes) {
    const nue = ligne.trim();

    if (!nue) {
      doc.moveDown(0.5);
      continue;
    }

    if (estTitre(nue)) {
      doc.moveDown(0.6);
      doc
        .font("Helvetica-Bold")
        .fontSize(10.5)
        .fillColor("#14507d")
        .text(nue, { paragraphGap: 3 });
      doc.fillColor("#111111");
      continue;
    }

    if (estPuce(nue)) {
      doc
        .font("Helvetica")
        .fontSize(10.5)
        .text("•  " + nue.replace(/^\s*[-•*—]\s+/, ""), {
          indent: 10,
          lineGap: 1.5,
          paragraphGap: 2,
        });
      continue;
    }

    doc
      .font("Helvetica")
      .fontSize(10.5)
      .text(nue, { align: "left", lineGap: 2, paragraphGap: 4 });
  }
};

// Extrait la ligne « Objet : … » du texte produit, et renvoie le corps sans
// elle.
//
// Le modèle la place en tête comme le demandent les consignes. En mise en page,
// l'objet n'est pas une phrase du corps : il se compose à part, en gras, après
// les blocs d'adresse. Le laisser dans le flux donnait une lettre qui commence
// par une ligne administrative perdue au milieu du texte.
const extraireObjet = (texte) => {
  const lignes = String(texte || "").split(/\r?\n/);
  const index = lignes.findIndex((l) => /^\s*objet\s*:/i.test(l));

  if (index === -1) return { objet: null, corps: texte };

  const objet = lignes[index].replace(/^\s*objet\s*:\s*/i, "").trim();
  const reste = [...lignes.slice(0, index), ...lignes.slice(index + 1)]
    .join("\n")
    .replace(/^\n+/, "");

  return { objet, corps: reste };
};

const MOIS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

const dateLettre = (d) => `${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`;

/**
 * Produit le PDF d'une LETTRE DE CANDIDATURE, mise en page.
 *
 * Une lettre administrative française a une forme attendue : expéditeur en haut
 * à gauche, destinataire en face, lieu et date, objet, puis le corps. Un
 * recruteur qui dépouille une pile la reconnaît avant de l'avoir lue — et une
 * lettre qui n'a pas cette forme se remarque, dans le mauvais sens.
 *
 * Le corps vient du texte produit ; tout le reste est lu dans le profil et dans
 * l'offre. Aucune coordonnée n'est donc réécrite par le modèle, qui est la
 * façon la plus sûre d'inventer un numéro de téléphone.
 */
export const lettrePdf = ({ texte, avp, user, profil, date }) =>
  new Promise((resolve, reject) => {
    const creation = date ? new Date(date) : new Date();
    const nom = `${user.prenom} ${user.nom}`.trim();
    const { objet, corps: corpsTexte } = extraireObjet(texte);

    const doc = new PDFDocument({
      size: "A4",
      margins: { top: MARGE, bottom: MARGE, left: MARGE, right: MARGE },
      info: {
        Title: `Lettre de candidature — ${avp.intitule}`,
        Author: nom,
        Subject: avp.intitule,
        CreationDate: creation,
        ModDate: creation,
      },
    });

    const morceaux = [];
    doc.on("data", (c) => morceaux.push(c));
    doc.on("end", () => resolve(Buffer.concat(morceaux)));
    doc.on("error", reject);

    const largeur = doc.page.width - MARGE * 2;
    const colonne = largeur * 0.45;
    const xDroite = MARGE + largeur - colonne;

    // ── Expéditeur, à gauche ──────────────────────────────────────────
    const expediteur = [
      profil?.basics?.titre || null,
      profil?.basics?.adresse || null,
      [profil?.basics?.codePostal, profil?.basics?.ville].filter(Boolean).join(" ") ||
        null,
      profil?.basics?.telephone || null,
      user.email,
    ].filter(Boolean);

    doc.font("Helvetica-Bold").fontSize(11).fillColor("#111111");
    doc.text(nom, MARGE, MARGE, { width: colonne });

    doc.font("Helvetica").fontSize(9).fillColor(DOUX);
    expediteur.forEach((l) => doc.text(l, MARGE, doc.y, { width: colonne, lineGap: 1 }));

    const basExpediteur = doc.y;

    // ── Destinataire, en face ─────────────────────────────────────────
    const destinataire = [
      avp.employeur?.nomComplet || avp.employeur?.nom || null,
      avp.direction || null,
      avp.service && avp.service !== avp.direction ? avp.service : null,
      avp.idAvp ? `Référence : ${avp.idAvp}` : null,
    ].filter(Boolean);

    doc.font("Helvetica").fontSize(9.5).fillColor("#111111");
    doc.text(destinataire[0] || "", xDroite, MARGE, { width: colonne });
    doc.font("Helvetica").fontSize(9).fillColor(DOUX);
    destinataire.slice(1).forEach((l) =>
      doc.text(l, xDroite, doc.y, { width: colonne, lineGap: 1 }),
    );

    // ── Lieu et date, alignés à droite ────────────────────────────────
    doc.y = Math.max(basExpediteur, doc.y) + 22;
    doc
      .font("Helvetica")
      .fontSize(9.5)
      .fillColor("#111111")
      .text(
        `${profil?.basics?.ville ? `${profil.basics.ville}, le` : "Le"} ${dateLettre(creation)}`,
        xDroite,
        doc.y,
        { width: colonne, align: "right" },
      );

    // ── Objet ─────────────────────────────────────────────────────────
    doc.y += 26;

    if (objet) {
      doc.font("Helvetica-Bold").fontSize(10).fillColor(MARQUE);
      // `continued` : « Objet : » reste l'étiquette, l'intitulé la valeur —
      // les composer sur une seule ligne évite un retour à la ligne disgracieux
      // quand l'intitulé est long.
      doc.text("Objet : ", MARGE, doc.y, { width: largeur, continued: true });
      doc.font("Helvetica-Bold").fillColor("#111111").text(objet);
      doc.y += 14;
    }

    // ── Corps ─────────────────────────────────────────────────────────
    doc.fillColor("#111111");

    String(corpsTexte || "")
      .split(/\r?\n/)
      .forEach((ligne) => {
        const nue = ligne.trim();

        if (!nue) {
          doc.moveDown(0.55);
          return;
        }

        if (estPuce(nue)) {
          doc
            .font("Helvetica")
            .fontSize(10.5)
            .text("•  " + nue.replace(/^\s*[-•*—]\s+/, ""), MARGE + 10, doc.y, {
              width: largeur - 10,
              lineGap: 2,
              paragraphGap: 3,
            });
          return;
        }

        doc
          .font("Helvetica")
          .fontSize(10.5)
          // Justifié : c'est la composition attendue d'une lettre, et elle
          // rend le bloc de texte nettement plus propre à l'œil.
          .text(nue, MARGE, doc.y, {
            width: largeur,
            align: "justify",
            lineGap: 2.5,
            paragraphGap: 4,
          });
      });

    doc.end();
  });

/**
 * Produit le PDF d'une pièce et renvoie son contenu en mémoire.
 *
 * `date` fixe la date de création inscrite dans le document. La passer plutôt
 * que d'utiliser l'heure courante rend le fichier REPRODUCTIBLE : régénérer le
 * PDF d'une pièce inchangée redonne octet pour octet le même fichier, ce qui
 * permet de le comparer, de le mettre en cache et de le vérifier.
 */
export const piecePdf = ({ piece, texte, avp, user, profil, date }) =>
  new Promise((resolve, reject) => {
    const pourEmployeur = POUR_EMPLOYEUR.has(piece);
    const titre = TITRES[piece] || piece;
    const creation = date ? new Date(date) : new Date();

    const doc = new PDFDocument({
      size: "A4",
      margins: { top: MARGE, bottom: MARGE, left: MARGE, right: MARGE },
      info: {
        Title: `${titre} — ${avp.intitule}`,
        Author: `${user.prenom} ${user.nom}`.trim(),
        Subject: avp.intitule,
        CreationDate: creation,
        ModDate: creation,
      },
    });

    const morceaux = [];
    doc.on("data", (c) => morceaux.push(c));
    doc.on("end", () => resolve(Buffer.concat(morceaux)));
    doc.on("error", reject);

    if (pourEmployeur) {
      enTeteCandidat(doc, user, profil);
    } else {
      // Pièce destinée au candidat : elle s'annonce pour ce qu'elle est, et
      // dit d'où elle vient. C'est un document de travail, pas une pièce de
      // dossier.
      doc
        .font("Helvetica-Bold")
        .fontSize(15)
        .fillColor("#14507d")
        .text(titre);
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("#555555")
        .text(avp.intitule + (avp.direction ? ` — ${avp.direction}` : ""));
      doc
        .moveDown(0.2)
        .fontSize(8.5)
        .text(
          "Document de préparation, à votre usage. Il n'est pas transmis à l'employeur.",
        );
      doc.moveDown(1.2).fillColor("#111111");
    }

    corps(doc, texte);

    doc.end();
  });

// Nom de fichier lisible et sans surprise : un employeur qui reçoit
// « piece_2.pdf » ne sait pas ce qu'il ouvre, et un fichier accentué ou espacé
// se transforme en suite de caractères illisibles selon la messagerie.
export const nomFichier = (piece, user, slug) => {
  const propre = (s) =>
    String(s || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const etiquettes = {
    lettre: "Lettre",
    cv: "CV",
    restitution: "Analyse",
    preparation: "Preparation-entretien",
  };

  return `${etiquettes[piece] || piece}_${propre(user.nom)}-${propre(user.prenom)}_${propre(slug)}.pdf`;
};
