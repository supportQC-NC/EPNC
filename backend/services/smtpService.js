// backend/services/smtpService.js
//
// Configuration SMTP, diagnostic et test.
//
// Le transport est construit ICI et nulle part ailleurs : le bouton de test de
// l'écran d'administration doit éprouver EXACTEMENT la configuration qui sert
// aux envois réels. Tester autre chose que ce qui tourne ne prouve rien.

import nodemailer from "nodemailer";

export const smtpConfigure = () => Boolean(process.env.SMTP_HOST?.trim());

// Le port 465 impose le TLS implicite : la connexion est chiffrée dès
// l'ouverture, il n'y a pas de STARTTLS. Un `SMTP_SECURE=false` sur ce port
// fait attendre une poignée de main en clair qui n'arrive jamais, et l'envoi
// part en délai d'attente sans message utile.
export const reglages = () => {
  const port = Number(process.env.SMTP_PORT) || 587;

  return {
    host: process.env.SMTP_HOST || null,
    port,
    secure:
      port === 465 || String(process.env.SMTP_SECURE).toLowerCase() === "true",
    user: process.env.SMTP_USER || null,
    motDePasseDefini: Boolean(process.env.SMTP_PASSWORD),
    nomExpediteur: process.env.SMTP_FROM_NAME || "Emploi Public NC",
  };
};

export const creerTransport = () => {
  const r = reglages();

  return nodemailer.createTransport({
    host: r.host,
    port: r.port,
    secure: r.secure,
    auth: { user: r.user, pass: process.env.SMTP_PASSWORD },
    // Sans ces délais, une mauvaise adresse d'hôte fait attendre deux minutes
    // devant un bouton qui tourne.
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });
};

export const expediteur = () => {
  const r = reglages();
  return `"${r.nomExpediteur}" <${r.user}>`;
};

// Contrôles de cohérence, sans rien envoyer.
//
// Ils attrapent les erreurs qu'un message d'échec SMTP n'explique jamais :
// « 535 authentication failed » ne dit pas que l'identifiant saisi est un nom
// de personne au lieu d'une adresse.
export const diagnostic = () => {
  const r = reglages();
  const anomalies = [];

  if (!r.host) {
    anomalies.push({
      gravite: "bloquant",
      champ: "SMTP_HOST",
      message:
        "Aucun serveur SMTP renseigné : les emails ne sont pas envoyés, leur contenu est écrit dans la console du serveur.",
    });
  }

  if (r.user && !r.user.includes("@")) {
    anomalies.push({
      gravite: "bloquant",
      champ: "SMTP_USER",
      message: `« ${r.user} » n'est pas une adresse email. La plupart des hébergeurs attendent l'adresse complète de la boîte comme identifiant, pas un nom d'affichage. Le nom affiché se règle avec SMTP_FROM_NAME.`,
    });
  }

  if (!r.user) {
    anomalies.push({
      gravite: "bloquant",
      champ: "SMTP_USER",
      message: "Identifiant SMTP absent.",
    });
  }

  if (!r.motDePasseDefini) {
    anomalies.push({
      gravite: "bloquant",
      champ: "SMTP_PASSWORD",
      message: "Mot de passe SMTP absent.",
    });
  }

  if (r.nomExpediteur.includes("@")) {
    anomalies.push({
      gravite: "avertissement",
      champ: "SMTP_FROM_NAME",
      message:
        "Le nom d'expéditeur contient une adresse email : il est probablement inversé avec SMTP_USER.",
    });
  }

  if (
    r.port === 465 &&
    String(process.env.SMTP_SECURE).toLowerCase() === "false"
  ) {
    anomalies.push({
      gravite: "avertissement",
      champ: "SMTP_SECURE",
      message:
        "Le port 465 impose le TLS implicite. L'application force donc secure=true malgré la valeur indiquée ; alignez SMTP_SECURE sur true pour éviter la confusion.",
    });
  }

  if (
    r.port === 587 &&
    String(process.env.SMTP_SECURE).toLowerCase() === "true"
  ) {
    anomalies.push({
      gravite: "avertissement",
      champ: "SMTP_SECURE",
      message:
        "Le port 587 utilise STARTTLS : secure doit valoir false, sinon la connexion échoue.",
    });
  }

  return anomalies;
};

// Traduit une erreur SMTP en explication actionnable. Les codes du protocole
// sont normalisés mais illisibles pour qui ne les pratique pas.
const expliquer = (erreur) => {
  const brut = (erreur.response || erreur.message || "").toString();

  if (/535|authentication failed|Invalid login/i.test(brut)) {
    return "Identifiant ou mot de passe refusé par le serveur. Vérifiez que SMTP_USER est bien l'adresse complète de la boîte, et que le mot de passe est celui de cette boîte (pas celui du compte d'hébergement).";
  }
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(brut)) {
    return "Serveur introuvable : le nom d'hôte SMTP est erroné, ou la machine n'a pas accès à Internet.";
  }
  if (/ECONNREFUSED/i.test(brut)) {
    return "Connexion refusée : le port est probablement incorrect, ou bloqué par un pare-feu.";
  }
  if (/ETIMEDOUT|timeout|Greeting never received/i.test(brut)) {
    return "Aucune réponse du serveur. Sur le port 465, cela signifie presque toujours que le TLS implicite n'est pas activé ; sur le port 587, qu'il l'est à tort.";
  }
  if (/self.signed|certificate/i.test(brut)) {
    return "Certificat TLS refusé par le serveur ou par la machine.";
  }

  return brut || "Échec sans message du serveur.";
};

// Ouvre une connexion et s'authentifie, sans envoyer de message.
export const testerConnexion = async () => {
  if (!smtpConfigure()) {
    return {
      ok: false,
      etape: "configuration",
      message: "Aucun serveur SMTP renseigné.",
    };
  }

  const depart = Date.now();

  try {
    await creerTransport().verify();
    return { ok: true, etape: "authentification", ms: Date.now() - depart };
  } catch (erreur) {
    return {
      ok: false,
      etape: "authentification",
      ms: Date.now() - depart,
      message: expliquer(erreur),
      brut: (erreur.response || erreur.message || "").toString().slice(0, 300),
    };
  }
};

// Envoie réellement un message de test.
//
// La connexion peut réussir et l'envoi échouer malgré tout : certains
// hébergeurs authentifient une boîte mais refusent qu'elle expédie au nom
// d'une autre adresse. Les deux tests sont donc distincts.
export const envoyerTest = async (destinataire) => {
  if (!smtpConfigure()) {
    return { ok: false, message: "Aucun serveur SMTP renseigné." };
  }

  const depart = Date.now();

  try {
    const info = await creerTransport().sendMail({
      from: expediteur(),
      to: destinataire,
      subject: "Emploi Public NC — test d'envoi",
      text:
        "Ce message confirme que la configuration SMTP d'Emploi Public NC fonctionne.\n\n" +
        "Si vous le recevez, les emails de réinitialisation de mot de passe partiront correctement.",
      html:
        "<p>Ce message confirme que la configuration SMTP d'<strong>Emploi Public NC</strong> fonctionne.</p>" +
        "<p>Si vous le recevez, les emails de réinitialisation de mot de passe partiront correctement.</p>",
    });

    return {
      ok: true,
      ms: Date.now() - depart,
      accepte: info.accepted || [],
      refuse: info.rejected || [],
      reponse: info.response || null,
    };
  } catch (erreur) {
    return {
      ok: false,
      ms: Date.now() - depart,
      message: expliquer(erreur),
      brut: (erreur.response || erreur.message || "").toString().slice(0, 300),
    };
  }
};
