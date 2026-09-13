#!/usr/bin/env node
// backend/mcp.js
//
// Serveur MCP — Emploi Public NC.
//
// ══════════════════════════════════════════════════════════════════════════
//  POURQUOI UN SERVEUR MCP, ET POURQUOI IL NE CONTIENT AUCUNE LOGIQUE
// ══════════════════════════════════════════════════════════════════════════
// Le Model Context Protocol est la façon dont un assistant conversationnel
// branche des outils. Un demandeur d'emploi qui décrit son parcours à un
// assistant doit pouvoir, dans la même conversation, voir les postes ouverts
// qui lui correspondent et repartir avec une lettre — sans changer d'outil,
// sans copier-coller, sans connaître notre existence.
//
// 🔴 CE FICHIER EST UN ADAPTATEUR, PAS UNE SECONDE IMPLÉMENTATION.
// Il appelle `rapprocher()` et `GENERATEURS[…]`, exactement comme le fait
// l'API HTTP. Réécrire ici une variante du rapprochement « adaptée au chat »
// produirait deux moteurs, donc deux verdicts différents sur le même couple
// profil/offre — et le jour où l'un des deux est corrigé, l'autre ment.
//
// C'est la même règle que pour l'ingestion, appelable en CLI et depuis
// l'administration : le même code, jamais deux.
//
// ══════════════════════════════════════════════════════════════════════════
//  CE QU'IL NE FAIT PAS
// ══════════════════════════════════════════════════════════════════════════
// Ni compte, ni écriture, ni envoi à un employeur. Un assistant qui
// candidaterait au nom de quelqu'un sur la foi d'une conversation serait une
// très mauvaise idée : la transmission reste un geste délibéré du candidat,
// dans l'application, devant le texte qu'il signe.
//
// Lancement : `npm run mcp` (transport stdio).

import dotenv from "dotenv";
import mongoose from "mongoose";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import Avp from "./models/AvpModel.js";
import { Metier } from "./models/MetierModel.js";
import { rapprocher } from "./services/matchingService.js";
import { GENERATEURS } from "./services/redactionService.js";
import { depuisJsonResume } from "./services/jsonResumeService.js";

dotenv.config();

// ⚠️ Le transport stdio utilise la sortie standard pour le protocole lui-même.
// Un `console.log` égaré au milieu d'une réponse JSON-RPC casse la session, et
// le message d'erreur côté client ne dit pas d'où ça vient. Tout ce qui doit
// être dit à l'humain passe donc par stderr.
const trace = (...args) => console.error(...args);

await mongoose.connect(process.env.MONGO_URI);
trace("🔌 MCP Emploi Public NC — connecté à la base");

const serveur = new McpServer({
  name: "emploi-public-nc",
  version: process.env.npm_package_version || "0.1.0",
});

const ouvertes = () => ({
  $or: [{ dateLimite: null }, { dateLimite: { $gte: new Date() } }],
});

// Le texte rendu à l'assistant. On lui parle en PHRASES, pas en JSON brut :
// c'est un lecteur de langue, pas un parseur, et un mur d'accolades le pousse
// à inventer des résumés. Les données structurées restent disponibles à côté.
const texte = (contenu) => ({ content: [{ type: "text", text: contenu }] });

// ── 1. Chercher des offres ────────────────────────────────────────────────

serveur.registerTool(
  "chercher_offres",
  {
    title: "Chercher des offres",
    description:
      "Cherche dans les avis de vacance de poste de la fonction publique calédonienne (plusieurs employeurs : OPT-NC, Nouvelle-Calédonie/DRHFPNC, provinces, hôpitaux, communes). Renvoie les offres correspondant à des mots-clés, avec leur employeur et leur date limite.",
    inputSchema: {
      motsCles: z
        .string()
        .optional()
        .describe("Mots-clés cherchés dans l'intitulé, les missions et les compétences attendues."),
      employeur: z
        .string()
        .optional()
        .describe("Code d'employeur : opt-nc, nouvelle-caledonie, province-sud, province-nord…"),
      limite: z.number().int().min(1).max(50).default(10),
    },
  },
  async ({ motsCles, employeur, limite = 10 }) => {
    const filtre = ouvertes();
    if (employeur) filtre["employeur.code"] = employeur;

    if (motsCles?.trim()) {
      // Recherche par expression régulière plutôt qu'index texte : sur 230
      // documents, un index plein texte serait la « bazooka pour une mouche »
      // que le corpus ne justifie pas, et il faudrait le maintenir.
      const motif = new RegExp(
        motsCles.trim().split(/\s+/).map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"),
        "i",
      );
      filtre.$and = [
        {
          $or: [
            { intitule: motif },
            { missions: motif },
            { competencesAttendues: motif },
            { corpsDomaine: motif },
            { "metier.nom": motif },
          ],
        },
      ];
    }

    const offres = await Avp.find(filtre)
      .sort({ datePubliee: -1 })
      .limit(limite);

    if (offres.length === 0) {
      return texte(
        `Aucune offre ouverte ne correspond${motsCles ? ` à « ${motsCles} »` : ""}. Le corpus se renouvelle vite : une recherche infructueuse aujourd'hui peut aboutir la semaine prochaine.`,
      );
    }

    const lignes = offres.map((a) => {
      const limite = a.dateLimite
        ? `jusqu'au ${a.dateLimite.toLocaleDateString("fr-FR")}`
        : "sans date limite";
      return `• ${a.intitule} — ${a.employeur?.nom || "employeur non précisé"}${a.lieu ? `, ${a.lieu}` : ""} (${limite})\n  référence : ${a.slug}`;
    });

    return texte(
      `${offres.length} offre(s) ouverte(s) :\n\n${lignes.join("\n")}\n\n` +
        `Utilisez « référence » avec l'outil detail_offre ou rapprocher_profil.`,
    );
  },
);

// ── 2. Le détail d'une offre ──────────────────────────────────────────────

serveur.registerTool(
  "detail_offre",
  {
    title: "Détail d'une offre",
    description:
      "Le contenu complet d'un avis de vacance : missions, compétences attendues, qualifications, conditions.",
    inputSchema: {
      reference: z.string().describe("La référence renvoyée par chercher_offres."),
    },
  },
  async ({ reference }) => {
    const a = await Avp.findOne({ slug: reference });
    if (!a) return texte(`Aucune offre ne porte la référence « ${reference} ».`);

    const bloc = (titre, valeur) => {
      if (!valeur || (Array.isArray(valeur) && valeur.length === 0)) return "";
      const corps = Array.isArray(valeur)
        ? valeur.map((v) => `  - ${v}`).join("\n")
        : `  ${valeur}`;
      return `\n${titre} :\n${corps}`;
    };

    const vide =
      !a.missions?.length &&
      !a.competencesAttendues?.length &&
      !a.description;

    return texte(
      `${a.intitule}\n` +
        `Employeur : ${a.employeur?.nom || "non précisé"}${a.direction ? ` — ${a.direction}` : ""}\n` +
        `Lieu : ${a.lieu || "non précisé"}\n` +
        `Date limite : ${a.dateLimite ? a.dateLimite.toLocaleDateString("fr-FR") : "non précisée"}` +
        bloc("Missions", a.missions) +
        bloc("Compétences attendues", a.competencesAttendues) +
        bloc("Savoir-faire", a.savoirFaire) +
        bloc("Qualifications", a.qualifications) +
        bloc("Expérience requise", a.experienceRequise) +
        (vide
          ? `\n\n⚠️ Cet employeur ne publie aucun détail pour ce poste : ni missions, ni compétences attendues. Ce n'est pas une lacune de cette plateforme, c'est la donnée source. Un rapprochement chiffré n'aurait donc aucun fondement ici — le dire vaut mieux que produire un score.`
          : ""),
    );
  },
);

// ── 3. Rapprocher un profil ───────────────────────────────────────────────

serveur.registerTool(
  "rapprocher_profil",
  {
    title: "Rapprocher un profil des offres",
    description:
      "Confronte un parcours (au format JSON Resume) aux offres ouvertes et renvoie les postes classés AVEC LEURS PREUVES : chaque point renvoie à un attendu de l'annonce et à l'élément du parcours qui le couvre. Renvoie aussi les offres dont la personne est exclue, avec le motif.",
    inputSchema: {
      resume: z
        .record(z.any())
        .describe(
          "Le parcours au format JSON Resume (jsonresume.org) : basics, work, education, skills, languages.",
        ),
      reference: z
        .string()
        .optional()
        .describe("Pour ne rapprocher que d'une offre précise."),
      limite: z.number().int().min(1).max(20).default(5),
    },
  },
  async ({ resume, reference, limite = 5 }) => {
    let profil;
    try {
      ({ profil } = depuisJsonResume(resume));
    } catch (e) {
      return texte(`Ce parcours n'a pas pu être lu : ${e.message}`);
    }

    const filtre = reference ? { slug: reference } : ouvertes();
    const offres = await Avp.find(filtre);
    if (offres.length === 0) return texte("Aucune offre à examiner.");

    const metiers = new Map(
      (await Metier.find({}).lean()).map((m) => [m.code, m]),
    );

    const retenus = [];
    const ecartes = [];
    let nonEvaluables = 0;

    for (const a of offres) {
      const r = await rapprocher(profil, a, metiers);
      if (r.motifsExclusion?.length) {
        ecartes.push(`• ${a.intitule} — ${r.motifsExclusion.join(" ")}`);
      } else if (!r.fiable) {
        nonEvaluables++;
      } else {
        retenus.push({ a, r });
      }
    }

    retenus.sort((x, y) => y.r.score - x.r.score);

    if (retenus.length === 0) {
      return texte(
        `Aucune offre évaluable ne ressort.\n` +
          `${nonEvaluables} offre(s) ne publient pas assez d'attendus pour être notées, ${ecartes.length} écartée(s).\n` +
          (ecartes.length ? `\nÉcartées :\n${ecartes.join("\n")}` : ""),
      );
    }

    const blocs = retenus.slice(0, limite).map(({ a, r }) => {
      const preuves = (r.composantes || [])
        .flatMap((c) => c.evidences || [])
        .slice(0, 4)
        .map((e) => `    ✓ ${e.attendu} → ${e.couvertPar}`);

      const manques = (r.composantes || [])
        .flatMap((c) => c.manques || [])
        .slice(0, 3)
        .map((m) => `    ✗ ${m.attendu || m}`);

      return (
        `${r.score}/100 — ${a.intitule} (${a.employeur?.nom || "?"})\n` +
        `  référence : ${a.slug}\n` +
        `  ${r.verdict?.texte || ""}\n` +
        // La fiabilité accompagne TOUJOURS le score : un 70 calculé sur 40
        // points de barème n'est pas un 70 sur 100, et un assistant qui
        // l'ignore le présentera comme tel.
        `  fiabilité : score calculé sur ${r.fiabilite} points de barème applicables sur 100\n` +
        (preuves.length ? `  ce qui correspond :\n${preuves.join("\n")}\n` : "") +
        (manques.length ? `  ce qui manque :\n${manques.join("\n")}\n` : "")
      );
    });

    return texte(
      `${retenus.length} offre(s) évaluable(s) sur ${offres.length} examinée(s).\n\n` +
        blocs.join("\n") +
        (nonEvaluables
          ? `\n⚠️ ${nonEvaluables} offre(s) non évaluables : l'employeur ne publie ni attendus ni missions. Elles ne sont ni retenues ni rejetées.\n`
          : "") +
        (ecartes.length
          ? `\nÉcartée(s) pour une raison bloquante :\n${ecartes.slice(0, 5).join("\n")}\n`
          : ""),
    );
  },
);

// ── 4. Produire une lettre ────────────────────────────────────────────────

serveur.registerTool(
  "produire_lettre",
  {
    title: "Produire une lettre de candidature",
    description:
      "Rédige une lettre de candidature pour une offre précise, à partir du parcours fourni. La lettre ne s'appuie que sur ce qui est dans le parcours — elle n'invente aucune expérience. Elle est RENDUE, jamais envoyée à l'employeur.",
    inputSchema: {
      resume: z.record(z.any()).describe("Le parcours au format JSON Resume."),
      reference: z.string().describe("La référence de l'offre visée."),
      piece: z
        .enum(["lettre", "cv", "restitution", "preparation"])
        .default("lettre")
        .describe(
          "lettre et cv s'adressent à l'employeur ; restitution (forces et écarts) et preparation (entretien) s'adressent au candidat.",
        ),
    },
  },
  async ({ resume, reference, piece = "lettre" }) => {
    let profil;
    let identite;
    try {
      ({ profil, identite } = depuisJsonResume(resume));
    } catch (e) {
      return texte(`Ce parcours n'a pas pu être lu : ${e.message}`);
    }

    const avp = await Avp.findOne({ slug: reference });
    if (!avp) return texte(`Aucune offre ne porte la référence « ${reference} ».`);

    const morceaux = (identite.nom || "").trim().split(/\s+/);
    const user = {
      prenom: morceaux[0] || "",
      nom: morceaux.slice(1).join(" ") || "",
      email: identite.email || "",
    };

    const r = await rapprocher(profil, avp);

    if (r.motifsExclusion?.length) {
      // On refuse de produire la pièce plutôt que de laisser quelqu'un
      // candidater à un poste dont il est exclu par une contrainte dure. Lui
      // donner une belle lettre serait lui faire perdre son temps.
      return texte(
        `Ce poste est hors de portée pour ce profil : ${r.motifsExclusion.join(" ")}\n` +
          `Aucune pièce n'a été produite — une candidature écartée d'avance ne rend service à personne.`,
      );
    }

    const { contenu, source, critique } = await GENERATEURS[piece](
      profil,
      avp,
      user,
      r,
    );

    const entete =
      source === "assemble"
        ? "⚠️ Brouillon ASSEMBLÉ hors ligne (aucun modèle de langue configuré) : à retravailler avant tout usage.\n\n"
        : "";

    return texte(
      entete +
        contenu +
        `\n\n---\n` +
        `Pièce « ${piece} » pour : ${avp.intitule} (${avp.employeur?.nom || "?"}).\n` +
        (critique?.note ? `Relue par une passe de critique : ${critique.note}/10${critique.reecrite ? ", réécrite" : ""}.\n` : "") +
        `Cette pièce est rendue, pas envoyée : la transmission reste un geste du candidat, depuis la plateforme.`,
    );
  },
);

const transport = new StdioServerTransport();
await serveur.connect(transport);
trace("✅ MCP prêt — outils : chercher_offres, detail_offre, rapprocher_profil, produire_lettre");
