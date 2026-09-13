// backend/services/redactionService.js
//
// Production des quatre pièces d'une candidature.
//
// DEUX MODES, choisis automatiquement :
//
//   OPENAI_API_KEY renseignée → le texte est RÉDIGÉ par le modèle, à partir du
//     profil et de la fiche de poste. `source: "ia"`.
//   Clé absente → un BROUILLON est ASSEMBLÉ à partir des mêmes données, sans
//     appel réseau. `source: "assemble"`.
//
// Le mode dégradé n'est pas un reliquat : il garde l'application démontrable
// sans clé, sans budget, et hors ligne — ce qui compte le jour d'une démo.
//
// En cas d'échec de l'appel au modèle, on NE retombe PAS silencieusement sur le
// brouillon : l'erreur remonte à l'écran. Quelqu'un qui croit lire un texte
// rédigé alors qu'il lit un assemblage l'enverrait tel quel.

import {
  appelerModele,
  iaDisponible,
  modeleUtilise,
} from "./modeleService.js";

const AVERTISSEMENT =
  "[BROUILLON ASSEMBLÉ AUTOMATIQUEMENT — rédaction assistée indisponible. " +
  "Relisez et réécrivez ce texte avant de l'envoyer.]";

const ligne = (etiquette, valeur) =>
  valeur ? `${etiquette} : ${valeur}` : null;

const listeOuRien = (titre, items) =>
  items?.length ? `${titre}\n${items.map((i) => `- ${i}`).join("\n")}` : null;

const bloc = (...morceaux) => morceaux.filter(Boolean).join("\n\n");

// Nom complet de la personne, pris sur le compte (source unique).
const nomComplet = (user) => `${user.prenom} ${user.nom}`.trim();

// Contexte de l'offre, mis en forme pour un humain comme pour un modèle.
export const contexteOffre = (avp) =>
  bloc(
    `POSTE : ${avp.intitule}`,
    bloc(
      ligne("Direction", avp.direction),
      ligne("Service", avp.service),
      ligne("Lieu", avp.lieu),
      ligne("Métier de rattachement", avp.metier?.nom),
    ),
    avp.description && `DESCRIPTION\n${avp.description}`,
    listeOuRien("MISSIONS", avp.missions),
    listeOuRien("COMPÉTENCES ATTENDUES", avp.competencesAttendues),
    listeOuRien("SAVOIR-FAIRE", avp.savoirFaire),
    ligne("Expérience requise", avp.experienceRequise),
    ligne("Habilitations", avp.qualifications),
  );

// Contexte du profil.
export const contexteProfil = (profil, user) =>
  bloc(
    `CANDIDAT : ${nomComplet(user)}`,
    bloc(
      ligne("Intitulé revendiqué", profil.basics?.titre),
      ligne("Email", user.email),
      ligne("Téléphone", profil.basics?.telephone),
      ligne("Commune", profil.basics?.ville),
      ligne("Province", profil.basics?.province),
      ligne("Permis", profil.basics?.permis?.join(", ")),
    ),
    profil.basics?.accroche && `PRÉSENTATION\n${profil.basics.accroche}`,
    profil.experiences?.length &&
      "EXPÉRIENCES\n" +
        profil.experiences
          .map((e) =>
            [
              `- ${e.poste || "Poste non précisé"}${e.employeur ? ` — ${e.employeur}` : ""}`,
              e.debut || e.fin || e.enCours
                ? `  (${e.debut || "?"} → ${e.enCours ? "aujourd'hui" : e.fin || "?"})`
                : null,
              e.description ? `  ${e.description}` : null,
              ...(e.realisations || []).map((r) => `  • ${r}`),
            ]
              .filter(Boolean)
              .join("\n"),
          )
          .join("\n"),
    profil.formations?.length &&
      "FORMATIONS\n" +
        profil.formations
          .map(
            (f) =>
              `- ${f.intitule || "Formation"}${f.etablissement ? ` — ${f.etablissement}` : ""}${f.annee ? ` (${f.annee})` : ""}`,
          )
          .join("\n"),
    profil.competences?.length &&
      "COMPÉTENCES\n" +
        profil.competences.map((c) => `- ${c.nom} (${c.niveau})`).join("\n"),
    profil.langues?.length &&
      "LANGUES\n" + profil.langues.map((l) => `- ${l.nom} (${l.niveau})`).join("\n"),
    // Les centres d'interet sont fournis au modele pour le CV, mais ils ne
    // doivent JAMAIS servir d'argument dans une lettre : un recrutement ne se
    // justifie pas par les loisirs du candidat.
    profil.interets?.length &&
      "CENTRES D'INTÉRÊT\n" +
        profil.interets
          .map(
            (i) =>
              `- ${i.nom}${i.motsCles?.length ? ` (${i.motsCles.join(", ")})` : ""}`,
          )
          .join("\n"),
    profil.aspirations?.projet && `PROJET PROFESSIONNEL\n${profil.aspirations.projet}`,
  );

// Rapprochement grossier entre les attendus du poste et les compétences
// déclarées. C'est une comparaison de mots, PAS le moteur de matching : elle ne
// sert qu'à donner un contenu utile à la restitution et à la préparation
// d'entretien tant que le vrai scoring n'existe pas.
const rapprocher = (avp, profil) => {
  const attendus = [
    ...(avp.competencesAttendues || []),
    ...(avp.savoirFaire || []),
  ];

  // Sources du candidat, en gardant leur LIBELLÉ d'origine : c'est lui qu'on
  // citera dans la lettre. Sans cela, on ne sait dire QUE l'attendu est
  // couvert, pas PAR QUOI — et la lettre finit par recopier les exigences de
  // l'employeur en guise d'arguments.
  const sources = [
    ...(profil.competences || []).map((c) => ({
      libelle: c.nom,
      texte: c.nom.toLowerCase(),
    })),
    ...(profil.experiences || []).map((e) => ({
      libelle: e.poste || "Expérience professionnelle",
      texte: `${e.poste || ""} ${e.description || ""}`.toLowerCase(),
    })),
    // Les formations SONT une source de rapprochement.
    //
    // Sans elles, un attendu comme « Formation juridique de niveau bac+3
    // minimum » tombait dans les écarts alors que la personne a une licence
    // de droit. Autrement dit, la restitution reprochait au candidat de ne pas
    // avoir un diplôme qu'il avait renseigné deux écrans plus tôt.
    ...(profil.formations || []).map((f) => ({
      libelle: f.intitule || "Formation",
      texte: `${f.intitule || ""} ${f.niveau || ""} ${f.etablissement || ""}`.toLowerCase(),
    })),
  ];

  const couverts = [];
  const ecarts = [];

  for (const attendu of attendus) {
    const mots = [
      ...new Set(
        attendu
          .toLowerCase()
          .split(/[^a-zàâäéèêëïîôöùûüç]+/)
          .filter((m) => m.length > 4),
      ),
    ];

    // DEUX mots communs au minimum.
    //
    // Avec un seul, « Notions en matière de sécurité des systèmes
    // d'INFORMATION » se trouvait couvert par « recueil d'INFORMATION » :
    // un faux positif parfaitement visible dans la restitution, et c'est
    // exactement ce qu'un jury RH sanctionne. Le seuil à deux les élimine
    // presque tous sans rien coûter.
    //
    // ⚠️ Cela reste une comparaison de mots, PAS un moteur de rapprochement.
    // Le vrai scoring — compétences du référentiel métiers, embeddings,
    // filtres bloquants — reste à écrire ; c'est lui qui portera la note.
    const source = sources.find(
      (s) => mots.filter((m) => s.texte.includes(m)).length >= 2,
    );

    if (source) couverts.push({ attendu, atout: source.libelle });
    else ecarts.push(attendu);
  }

  // Atouts dédoublonnés : une même compétence couvre souvent trois attendus,
  // et les répéter trois fois dans une lettre d'une page la disqualifie.
  const atouts = [...new Set(couverts.map((c) => c.atout))];

  return { couverts, ecarts, atouts };
};

// Coupe proprement un attendu trop long pour être cité en entier.
const citer = (texte, max = 90) => {
  const propre = texte.replace(/\s+/g, " ").trim();
  if (propre.length <= max) return propre;
  const coupe = propre.slice(0, max);
  return coupe.slice(0, coupe.lastIndexOf(" ")) + "…";
};

const assemblerLettre = (profil, avp, user) => {
  const { couverts } = rapprocher(avp, profil);

  // On cite CE QUE SAIT FAIRE le candidat, en indiquant l'attendu auquel cela
  // répond. La version précédente listait les attendus bruts de l'offre sous
  // « ce que je peux apporter » : la lettre renvoyait à l'employeur ses
  // propres exigences en guise d'arguments, ce qu'un recruteur repère
  // immédiatement.
  const arguments_ = [];
  const dejaCites = new Set();

  for (const { attendu, atout } of couverts) {
    if (dejaCites.has(atout)) continue;
    dejaCites.add(atout);
    arguments_.push(`${atout} — en réponse à « ${citer(attendu)} »`);
    if (arguments_.length === 3) break;
  }

  return {
    source: "assemble",
    contenu: bloc(
      AVERTISSEMENT,
      `Objet : candidature au poste de ${avp.intitule}`,
      "Madame, Monsieur,",
      profil.basics?.accroche ||
        "[Votre accroche n'est pas renseignée — complétez votre profil pour qu'elle apparaisse ici.]",
      profil.experiences?.length
        ? `Mon parcours : ${profil.experiences
            .slice(0, 3)
            .map((e) => `${e.poste}${e.employeur ? ` (${e.employeur})` : ""}`)
            .join(", ")}.`
        : "[Aucune expérience renseignée dans votre profil.]",
      listeOuRien("Ce que je peux apporter sur ce poste :", arguments_) || "",
      "Je reste à votre disposition pour en échanger.",
      nomComplet(user),
    ),
  };
};

const assemblerCv = (profil, avp, user) => ({
  source: "assemble",
  contenu: bloc(
    AVERTISSEMENT,
    `CV recentré sur : ${avp.intitule}`,
    contexteProfil(profil, user),
  ),
});

const assemblerRestitution = (profil, avp, user) => {
  const { couverts, ecarts } = rapprocher(avp, profil);

  // Ici, contrairement à la lettre, on nomme les deux côtés : l'attendu du
  // poste ET ce qui le couvre chez vous. C'est le propre d'une restitution —
  // elle doit être vérifiable, pas flatteuse.
  const lignesFortes = couverts.map(
    ({ attendu, atout }) => `${citer(attendu, 110)}\n  → couvert par : ${atout}`,
  );

  return {
    source: "assemble",
    contenu: bloc(
      AVERTISSEMENT,
      `Analyse de votre candidature — ${avp.intitule}`,
      listeOuRien("VOS POINTS FORTS FACE AUX ATTENDUS", lignesFortes) ||
        "VOS POINTS FORTS\nAucun recoupement trouvé. Étoffez vos compétences dans votre profil.",
      listeOuRien("LES ÉCARTS À TRAVAILLER", ecarts) ||
        "LES ÉCARTS\nAucun écart identifié sur les attendus listés.",
      "QUE FAIRE DE CES ÉCARTS\n" +
        "Un écart n'est pas un refus. Préparez pour chacun une réponse honnête : " +
        "ce que vous avez fait de proche, comment vous comptez monter en compétence, " +
        "en combien de temps.",
    ),
  };
};

const assemblerPreparation = (profil, avp, user) => {
  const { ecarts } = rapprocher(avp, profil);
  return {
    source: "assemble",
    contenu: bloc(
      AVERTISSEMENT,
      `Préparation à l'entretien — ${avp.intitule}`,
      listeOuRien(
        "QUESTIONS PROBABLES SUR VOS ÉCARTS",
        ecarts.slice(0, 5).map((e) => `« Parlez-moi de votre expérience sur : ${e} »`),
      ) || "",
      listeOuRien(
        "À CONNAÎTRE SUR LE POSTE",
        (avp.missions || []).slice(0, 5),
      ) || "",
      "QUESTIONS À POSER\n" +
        "- Comment se répartit concrètement le temps de travail sur ce poste ?\n" +
        "- Quelles sont les priorités des six premiers mois ?\n" +
        "- Avec quelles équipes travaille-t-on au quotidien ?",
    ),
  };
};

// =============================================================================
// RÉDACTION PAR LE MODÈLE
// =============================================================================

// Consignes communes à toutes les pièces.
//
// La règle n°1 est l'interdiction d'inventer. Un modèle à qui l'on demande une
// lettre de candidature comble volontiers les trous : il ajoute un diplôme
// plausible, arrondit une durée, invente un chiffre. Dans une candidature
// réelle, c'est un mensonge signé par le candidat.
const SOCLE = `Tu rédiges pour une personne qui postule réellement à un poste de la fonction publique en Nouvelle-Calédonie.

RÈGLES ABSOLUES
- N'invente RIEN. N'utilise que les informations du profil fourni. Aucun diplôme, employeur, date, chiffre ou compétence qui n'y figure pas.
- Si une information manque, écris la phrase sans elle. Ne mets jamais de crochets, de « XXX » ni de mention à compléter.
- Écris en français, à la deuxième personne du pluriel quand tu t'adresses à l'employeur.
- Pas de formule creuse, pas de flatterie institutionnelle, pas de superlatif.
- Ne réutilise pas les phrases de l'annonce telles quelles : ce sont les attentes de l'employeur, pas les arguments du candidat.
- Rends uniquement le texte demandé, sans commentaire ni balise de code.

RAPPROCHEMENT PAR ÉQUIVALENCE
Un attendu peut être couvert par un élément du profil qui porte un autre nom. Une licence de droit couvre « formation juridique de niveau bac+3 ». Une expérience de gestion de dossiers couvre « capacité à gérer plusieurs dossiers en parallèle ». Raisonne sur le fond, pas sur les mots.
Ne déclare un écart que si RIEN dans le profil ne s'en approche. Un écart annoncé à tort sur une compétence que la personne possède détruit la confiance qu'elle accorde à l'analyse.`;

// Mots et tournures qui condamnent une candidature à la pile du bas. Ils sont
// interdits explicitement : un modèle les produit spontanément, parce que le
// web en est rempli.
const INTERDITS = `Vocabulaire interdit : « dynamique », « motivé », « passionné », « rigoureux », « polyvalent », « force de proposition », « votre prestigieux établissement », « je suis convaincu que mon profil », « n'hésitez pas à me contacter », « dans l'attente de votre retour ».

Ouvertures interdites, quelle que soit la suite : « Je vous adresse ma candidature », « Je souhaite postuler », « Je me permets de », « C'est avec un vif intérêt », « Fort de mon expérience », « Actuellement en poste ». Elles parlent du candidat ; la première phrase doit parler du poste.`;

const CONSIGNES = {
  lettre: `Rédige la LETTRE DE CANDIDATURE.

- 250 à 300 mots maximum. Une page, pas davantage.
- Commence par une ligne « Objet : candidature au poste de … ».
- ⚠️ LA PREMIÈRE PHRASE DU CORPS PARLE DU POSTE, PAS DU CANDIDAT.
  C'est la consigne la plus souvent manquée, alors relis-la avant d'écrire.
  INTERDIT d'ouvrir par « Je », « Ma », « Mon », « C'est avec… », « Fort de… »,
  « Actuellement… », « Titulaire de… », ni par aucune tournure qui commence par
  le candidat.

  ✗ « Je vous adresse ma candidature pour le poste de gestionnaire des
     carrières. »
  ✗ « Fort de douze ans d'expérience, je souhaite postuler… »
  ✓ « Le poste de gestionnaire des carrières demande d'instruire des dossiers
     statutaires et d'expliquer leurs règles à des agents : c'est ce que je
     fais depuis douze ans, sur des dossiers médicaux. »
  ✓ « Gérer les carrières de deux mille agents suppose une rigueur
     documentaire que j'exerce quotidiennement depuis douze ans. »

  La bonne ouverture NOMME une exigence du poste, puis y répond. Elle montre
  que l'annonce a été lue — c'est la première chose qu'un recruteur vérifie.
- Trois preuves concrètes tirées du parcours, chacune reliée à un attendu précis de l'annonce. Des faits, pas des qualités.
- Du texte suivi. Au plus une courte énumération si elle sert vraiment.
- Termine par une phrase de disponibilité sobre, puis le nom du candidat seul sur sa ligne.
${INTERDITS}`,

  cv: `Rédige le CV RECENTRÉ sur ce poste, en texte brut structuré.

- Rubriques dans cet ordre : identité et contact, accroche en deux lignes, expériences, formations, compétences, langues.
- ORDONNE les expériences et les compétences selon leur pertinence pour CE poste, pas seulement par date.
- Reformule chaque expérience en deux ou trois puces qui font écho aux missions de l'annonce, sans jamais ajouter de fait absent du profil.
- Reste factuel et dense. Pas de phrase d'auto-évaluation.`,

  restitution: `Rédige l'ANALYSE DE CANDIDATURE, destinée au CANDIDAT lui-même, pas à l'employeur.

Trois parties :
1. CE QUI VOUS SERT — les attendus du poste que le parcours couvre réellement, en citant à chaque fois l'élément du profil qui le couvre.
2. VOS ÉCARTS — les attendus non couverts, nommés sans détour. N'enjolive pas : une analyse complaisante ne sert à rien.
3. QUE FAIRE DE CES ÉCARTS — pour chacun, une conduite concrète : ce qui s'en approche dans le parcours, comment le formuler en entretien, ou ce qu'il faut aller chercher.

Dis clairement, en une phrase de conclusion, si la candidature est solide, jouable ou éloignée du poste.`,

  preparation: `Rédige la PRÉPARATION À L'ENTRETIEN, destinée au CANDIDAT.

- SIX questions probables, dont au moins trois portant sur les écarts identifiés.
- Sous chaque question, une piste de réponse appuyée UNIQUEMENT sur le parcours réel du candidat.
- Puis une section QUESTIONS À POSER À L'EMPLOYEUR, avec QUATRE questions précises tirées du contenu de l'annonce.
  Fais-la précéder de deux ou trois phrases qui expliquent à quoi elles servent RÉELLEMENT :
  comprendre ce que le poste exige au quotidien, ce que l'employeur attend de la personne qui l'occupera,
  et vérifier que cela correspond à ce que le candidat cherche.
  Dis explicitement que ce n'est PAS une technique pour décrocher le poste, ni un exercice de style :
  un entretien se décide dans les deux sens, et repartir sans avoir compris ce qu'on attendra de soi
  est la meilleure façon d'accepter un poste qui ne convient pas.
- Termine par trois points à réviser avant l'entretien.`,
};

// ══════════════════════════════════════════════════════════════════════════
//  LE RAPPROCHEMENT VÉRIFIÉ, DONNÉ COMME MATIÈRE — PAS COMME VERDICT
// ══════════════════════════════════════════════════════════════════════════
// Historique de ce choix, parce qu'il s'est joué deux fois en sens inverse.
//
// Une PREMIÈRE version joignait le rapprochement par mots de ce fichier (la
// fonction `rapprocher` ci-dessus, une simple comparaison de chaînes) « à titre
// indicatif ». Le modèle l'a suivi CONTRE le profil : il a écrit « vous n'avez
// pas de formation juridique de niveau bac+3 » à une candidate titulaire d'une
// licence de droit, parce que « juridique » et « droit » ne se ressemblent pas.
// On a donc tout retiré, et le modèle a mieux travaillé seul.
//
// Ce qu'on joint MAINTENANT est d'une autre nature : les `evidences[]` du
// moteur de rapprochement (matchingService), qui raisonne sur le référentiel
// métiers, par racine de mot et par cumul de sources. Et surtout, on ne les
// joint pas de la même façon :
//
//   - LES CORRESPONDANCES sont données comme MATIÈRE À CITER. Chacune nomme
//     l'attendu de l'annonce ET l'élément du parcours qui y répond. C'est
//     exactement ce qu'une lettre doit contenir, et cela ne peut pas nuire :
//     au pire le modèle en ignore une.
//
//   - LES ÉCARTS sont donnés comme PISTES À VÉRIFIER, avec l'instruction
//     explicite de les confronter au profil avant d'en conclure quoi que ce
//     soit. C'est le garde-fou tiré de l'incident ci-dessus : une analyse
//     automatique rate les équivalences, et un écart annoncé à tort sur une
//     compétence que la personne possède détruit sa confiance.
//
// Le gain attendu porte sur l'ancrage : sans ces extraits, le modèle recopie
// des généralités ; avec eux, il écrit « ma licence de droit répond à
// l'exigence de formation juridique », ce qu'un recruteur peut vérifier.
const correspondances = (rapprochement) => {
  if (!rapprochement?.composantes?.length) return null;

  const preuves = [];
  const ecarts = [];

  for (const c of rapprochement.composantes) {
    if (!c.applicable) continue;

    for (const e of c.evidences || []) {
      if (!e.attendu || !e.couvertPar) continue;
      preuves.push(
        `- L'annonce demande « ${e.attendu} » → votre parcours y répond par « ${e.couvertPar} »${e.origine ? ` (${e.origine})` : ""}.`,
      );
    }

    for (const m of (c.manques || []).slice(0, 6)) {
      if (m.attendu) ecarts.push(`- ${m.attendu}`);
    }
  }

  if (!preuves.length && !ecarts.length) return null;

  return bloc(
    "=== RAPPROCHEMENT VÉRIFIÉ (analyse structurée du profil face à l'annonce) ===",
    preuves.length
      ? "CORRESPONDANCES ÉTABLIES — c'est la matière de ton texte. Appuie-toi\n" +
          "dessus en priorité : chacune relie un attendu de l'annonce à un élément\n" +
          "réel du parcours, et c'est ce qu'un recruteur peut vérifier.\n" +
          preuves.join("\n")
      : null,
    ecarts.length
      ? "ATTENDUS SANS CORRESPONDANCE AUTOMATIQUE — À VÉRIFIER, PAS À REPRENDRE.\n" +
          "Cette liste vient d'une comparaison automatique qui rate les\n" +
          "équivalences : une licence de droit ne « ressemble » pas à une\n" +
          "« formation juridique », et une expérience de gestion de dossiers ne\n" +
          "« ressemble » pas à « gérer plusieurs dossiers en parallèle ».\n" +
          "AVANT de considérer l'un de ces points comme un écart, relis le profil\n" +
          "et cherche ce qui pourrait y répondre. N'annonce un écart que si RIEN\n" +
          "dans le parcours ne s'en approche.\n" +
          ecarts.join("\n")
      : null,
  );
};

// Construit la demande envoyée au modèle : le rapprochement vérifié, la fiche
// de poste, le profil, la consigne.
//
// L'ordre compte : les correspondances arrivent EN PREMIER. Le modèle lit un
// texte long ; ce qu'on met en tête oriente ce qu'il retient.
const demande = (piece, profil, avp, user, rapprochement = null) =>
  bloc(
    correspondances(rapprochement),
    "=== FICHE DE POSTE ===",
    contexteOffre(avp),
    "=== PROFIL DU CANDIDAT ===",
    contexteProfil(profil, user),
    "=== CE QUE TU DOIS ÉCRIRE ===",
    CONSIGNES[piece],
  );

// =============================================================================
// PASSE DE CRITIQUE
// -----------------------------------------------------------------------------
// Un second appel relit la pièce en se mettant à la place d'un chargé de
// recrutement qui dépouille une pile de candidatures, et la note. Sous le
// seuil, une troisième passe réécrit en tenant compte des reproches.
//
// Pourquoi cela vaut le coût : le premier jet d'un modèle est correct mais
// irrégulier. Sur deux productions successives de la même lettre, l'une
// commençait par le poste — comme demandé — et l'autre par « Je souhaite
// postuler au poste de… », c'est-à-dire par le candidat. Une consigne ne suffit
// pas à rendre la qualité constante ; une relecture, si.
//
// Seules les deux pièces qui PARTENT CHEZ L'EMPLOYEUR sont critiquées. La
// restitution et la préparation sont destinées au candidat : elles doivent être
// justes, pas séduisantes.
// =============================================================================

const PIECES_CRITIQUEES = ["lettre", "cv"];

// En dessous, on réécrit. Calé volontairement haut : à 6/10 une lettre passe
// encore, et c'est exactement ce qui la fait finir en bas de la pile.
//
// Réglable par `CRITIQUE_SEUIL` : monter à 10 force une réécriture à chaque
// production (utile pour éprouver la boucle ou comparer les deux jets),
// descendre à 0 la désactive sans toucher au code.
const SEUIL = Number(process.env.CRITIQUE_SEUIL ?? 7);

const CRITIQUE_SYSTEME = `Tu es chargé de recrutement dans un établissement public calédonien. Tu dépouilles une pile de candidatures et tu consacres moins d'une minute à chacune.

Tu notes la pièce qu'on te soumet, sans complaisance. Une note élevée doit se mériter.

Réponds UNIQUEMENT en JSON, avec cette forme exacte :
{
  "note": <entier de 0 à 10>,
  "inventions": [<extraits du texte affirmant un fait ABSENT du profil fourni>],
  "problemes": [<reproches précis et actionnables, un par entrée>],
  "verdict": "<une phrase : convoqué, hésitation, ou écarté, et pourquoi>"
}

CE QUE TU VÉRIFIES
- Le texte répond-il AU POSTE, ou récite-t-il le parcours sans lien avec l'annonce ?
- Les arguments sont-ils des FAITS vérifiables, ou des qualités auto-proclamées ?
- Reste-t-il des formules creuses, des superlatifs, des phrases interchangeables ?
- La longueur est-elle tenue ?
- Le texte affirme-t-il quoi que ce soit qui ne figure PAS dans le profil ? C'est le point le plus grave.

Un texte poli mais interchangeable ne dépasse pas 5.

RÈGLES DE RÉDACTION EN VIGUEUR — tu ne peux pas demander l'inverse
- ⚠️ La première phrase DOIT porter sur LE POSTE, pas sur le candidat. C'est une EXIGENCE, pas un défaut.
  ✓ « Le poste de gestionnaire des carrières demande d'instruire des dossiers statutaires : c'est ce que je fais depuis douze ans. » → CORRECT, ne le reproche pas.
  ✗ « Je vous adresse ma candidature au poste de… » → DÉFAUT, à signaler.
  Si la lettre s'ouvre sur le poste, c'est qu'elle respecte la consigne. Ne le compte JAMAIS comme une erreur, et ne réclame jamais « une accroche personnelle ».
- Le texte ne doit RIEN contenir qui ne figure pas au profil. Ne réclame donc jamais un exemple, un chiffre, un résultat ou un outil qui n'y est pas : ce serait demander une invention.
- Les mots « dynamique », « motivé », « passionné », « rigoureux », « polyvalent » sont proscrits. N'en suggère aucun.
Un reproche qui violerait l'une de ces règles ne doit pas être formulé.`;

const REECRITURE = `Voici la critique d'un chargé de recrutement sur le texte que tu viens d'écrire.

Corrige PRÉCISÉMENT les points soulevés. Ne réécris pas ce qui fonctionne déjà : on veut une correction, pas un nouveau texte.
Si des inventions sont signalées, supprime-les purement et simplement — n'essaie pas de les reformuler.

Rends uniquement le texte corrigé, sans commentaire.`;

// Reproches que le critique n'a PAS le droit de formuler, parce qu'ils
// contredisent les consignes de rédaction.
//
// ══════════════════════════════════════════════════════════════════════════
//  POURQUOI UN FILTRE, ET PAS SEULEMENT UNE CONSIGNE
// ══════════════════════════════════════════════════════════════════════════
// Le prompt de critique interdit déjà de reprocher l'ouverture sur le poste.
// Le modèle le fait quand même, systématiquement : mesuré sur une lettre
// parfaitement conforme, « Le texte commence par une accroche sur le poste,
// ce qui est une erreur » — suivi d'un 4/10 et d'une réécriture.
//
// C'était la vraie cause des notes basses : la passe de critique sanctionnait
// ce que la passe de rédaction exigeait, et les deux tournaient en rond.
// Une consigne qu'un modèle enfreint une fois sur deux n'est pas une règle ;
// le filtre, lui, ne se trompe pas.
const REPROCHES_ILLEGITIMES = [
  // L'ouverture sur le poste : exigée, jamais un défaut.
  /accroche\s+(sur|portant sur)\s+le poste/i,
  /commence\s+par\s+(une\s+)?(accroche\s+)?(sur|par)\s+le poste/i,
  /accroche\s+personnelle/i,
  /ne\s+commence\s+pas\s+par\s+(le\s+)?candidat/i,
  /manque\s+d[e']\s*accroche\s+personnelle/i,

  // Reprocher à une lettre de ne pas mentionner une expérience que la
  // personne N'A PAS, c'est réclamer une invention — et les inventions sont
  // précisément ce que cette passe est censée traquer.
  //
  // Observé sur une candidature en reconversion : « le texte ne mentionne pas
  // de connaissances réglementaires en fonction publique », adressé à une
  // secrétaire médicale qui n'en a évidemment aucune. Suivre ce reproche
  // reviendrait à lui en faire inventer.
  //
  // Les écarts ne sont pas le sujet de la LETTRE : ils sont celui de
  // l'ANALYSE, une pièce séparée, destinée au candidat, où ils sont nommés
  // sans détour.
  /absence\s+d[e']\s*(exp[ée]rience|connaissance|formation|dipl[oô]me|comp[ée]tence)/i,
  /ne\s+mentionne\s+(pas|aucune?)\s+d?[e']?\s*(exp[ée]rience|connaissance|formation|dipl[oô]me)/i,
  /manque\s+d[e']\s*(exp[ée]rience|connaissance|formation|dipl[oô]me)/i,
  /(n'a|pas)\s+(pas\s+)?d[e']\s*exp[ée]rience\s+(directe\s+)?(en|dans|avec)/i,
];

const reprocheLegitime = (probleme) =>
  !REPROCHES_ILLEGITIMES.some((r) => r.test(probleme));

/**
 * Relit une pièce et renvoie son évaluation.
 * Un échec de la critique n'est pas fatal : on garde le texte d'origine plutôt
 * que de perdre une production qui a déjà coûté un appel.
 */
const critiquer = async (piece, texte, profil, avp, user) => {
  try {
    const brut = await appelerModele(
      CRITIQUE_SYSTEME,
      bloc(
        "=== FICHE DE POSTE ===",
        contexteOffre(avp),
        "=== PROFIL RÉEL DU CANDIDAT (référence pour détecter les inventions) ===",
        contexteProfil(profil, user),
        `=== TEXTE À NOTER (${piece}) ===`,
        texte,
      ),
      { temperature: 0.2, maxTokens: 700, json: true, etiquette: `critique:${piece}` },
    );

    const avis = JSON.parse(brut);

    const bruts = Array.isArray(avis.problemes) ? avis.problemes : [];
    const problemes = bruts.filter(reprocheLegitime);
    const ecartes = bruts.length - problemes.length;

    if (ecartes > 0) {
      console.log(
        `⚖️  ${ecartes} reproche(s) écarté(s) sur « ${piece} » : ils contredisaient les consignes.`,
      );
    }

    return {
      note: Number(avis.note) || 0,
      inventions: Array.isArray(avis.inventions) ? avis.inventions : [],
      problemes,
      // Combien de reproches ont été écartés : la décision de réécrire s'appuie
      // sur ce qui RESTE, pas sur une note calculée à partir de griefs
      // invalides.
      ecartes,
      verdict: typeof avis.verdict === "string" ? avis.verdict : "",
    };
  } catch (erreur) {
    console.warn(`⚠️  Critique de « ${piece} » impossible : ${erreur.message}`);
    return null;
  }
};

const ASSEMBLEURS = {
  lettre: assemblerLettre,
  cv: assemblerCv,
  restitution: assemblerRestitution,
  preparation: assemblerPreparation,
};

// Réglages par pièce. La lettre tolère un peu de liberté de formulation ; le CV
// doit rester collé aux faits, d'où une température plus basse.
const REGLAGES = {
  lettre: { temperature: 0.5, maxTokens: 900 },
  cv: { temperature: 0.25, maxTokens: 1400 },
  restitution: { temperature: 0.35, maxTokens: 1400 },
  preparation: { temperature: 0.45, maxTokens: 1600 },
};

// Table des générateurs : la route les appelle par le nom de la pièce, ce qui
// évite un `switch` à rallonge et rend l'ajout d'une cinquième pièce trivial.
export const GENERATEURS = Object.fromEntries(
  ["lettre", "cv", "restitution", "preparation"].map((piece) => [
    piece,
    async (profil, avp, user, rapprochement = null) => {
      if (!iaDisponible()) return ASSEMBLEURS[piece](profil, avp, user);

      const consigne = demande(piece, profil, avp, user, rapprochement);

      // 1. Premier jet.
      let contenu = await appelerModele(SOCLE, consigne, {
        ...REGLAGES[piece],
        etiquette: piece,
      });

      if (!PIECES_CRITIQUEES.includes(piece)) {
        return { contenu, source: "ia", modele: modeleUtilise() };
      }

      // 2. Relecture par un « recruteur ».
      const avis = await critiquer(piece, contenu, profil, avp, user);
      if (!avis) return { contenu, source: "ia", modele: modeleUtilise() };

      // 3. Réécriture si la note est insuffisante — ou dès qu'une invention est
      // signalée, quelle que soit la note. Un fait inventé dans une
      // candidature n'est pas un défaut de style : c'est le candidat qui le
      // signe.
      //
      // ⚠️ Mais on ne réécrit PAS quand il ne reste aucun reproche valable :
      // la note portait alors sur des griefs écartés, et réécrire pour y
      // répondre ne pourrait que dégrader le texte. C'est exactement ce qui se
      // produisait — une lettre conforme, notée 4/10 parce qu'elle respectait
      // la consigne d'ouverture, puis réécrite pour l'enfreindre.
      const aReecrire =
        avis.inventions.length > 0 ||
        (avis.note < SEUIL && avis.problemes.length > 0);

      if (!aReecrire) {
        return {
          contenu,
          source: "ia",
          modele: modeleUtilise(),
          critique: { ...avis, reecrite: false },
        };
      }

      const corrige = await appelerModele(
        SOCLE,
        bloc(
          consigne,
          "=== TON PREMIER JET ===",
          contenu,
          "=== CRITIQUE DU RECRUTEUR ===",
          `Note : ${avis.note}/10`,
          avis.inventions.length
            ? `INVENTIONS À SUPPRIMER :\n${avis.inventions.map((i) => `- ${i}`).join("\n")}`
            : "",
          avis.problemes.length
            ? `REPROCHES :\n${avis.problemes.map((p) => `- ${p}`).join("\n")}`
            : "",
          REECRITURE,
        ),
        { ...REGLAGES[piece], etiquette: `${piece}:v2` },
      );

      // On renote la version corrigée et on GARDE LA MEILLEURE.
      //
      // Une réécriture n'améliore pas toujours : lors d'un essai, le second
      // jet a perdu son accroche sur le poste pour satisfaire un reproche mal
      // formulé. Sans cette comparaison, on livrerait une version dégradée en
      // croyant l'avoir améliorée — le pire résultat possible pour une passe
      // censée relever la qualité.
      const avisCorrige = await critiquer(piece, corrige, profil, avp, user);

      if (avisCorrige && avisCorrige.note < avis.note) {
        return {
          contenu,
          source: "ia",
          modele: modeleUtilise(),
          critique: {
            ...avis,
            reecrite: false,
            verdict:
              `${avis.verdict} (Réécriture tentée puis écartée : ` +
              `elle notait ${avisCorrige.note}/10 contre ${avis.note}/10.)`,
          },
        };
      }

      return {
        contenu: corrige,
        source: "ia",
        modele: modeleUtilise(),
        critique: { ...(avisCorrige || avis), reecrite: true },
      };
    },
  ]),
);
