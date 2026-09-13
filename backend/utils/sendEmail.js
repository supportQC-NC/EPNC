import {
  smtpConfigure,
  creerTransport,
  expediteur,
} from "../services/smtpService.js";

/**
 * Envoi d'email via SMTP.
 *
 * Le transport et l'expéditeur viennent de smtpService : le bouton de test de
 * l'écran d'administration éprouve ainsi exactement la configuration utilisée
 * ici. Deux constructions séparées finiraient par diverger, et le test
 * cesserait de prouver quoi que ce soit.
 *
 * Mode dégradé volontaire : tant que `SMTP_HOST` est vide, rien n'est envoyé et
 * le contenu est écrit dans la console du serveur. On peut donc démontrer tout
 * le parcours « mot de passe oublié » sans configurer de SMTP.
 *
 * options :
 *   - email       : destinataire(s) — chaîne ou tableau
 *   - subject     : sujet
 *   - html        : corps HTML
 *   - text        : (optionnel) corps texte
 *   - replyTo     : (optionnel) adresse de réponse. Indispensable pour une
 *                   candidature : le message part de la boîte technique de la
 *                   plateforme, mais l'employeur doit répondre AU CANDIDAT.
 *   - attachments : (optionnel) pièces jointes nodemailer
 *                   ({ filename, content, contentType }).
 */
const sendEmail = async ({
  email,
  subject,
  html,
  text,
  replyTo,
  attachments,
}) => {
  const to = Array.isArray(email) ? email.filter(Boolean).join(", ") : email;

  if (!smtpConfigure()) {
    console.log("\n─────────── EMAIL NON ENVOYÉ (SMTP non configuré) ───────────");
    console.log(`À      : ${to}`);
    if (replyTo) console.log(`Réponse: ${replyTo}`);
    console.log(`Sujet  : ${subject}`);
    // Les pièces jointes sont listées avec leur taille : en mode simulé, c'est
    // la seule preuve que les PDF ont bien été produits et joints.
    if (attachments?.length) {
      console.log(
        `Joint  : ${attachments
          .map((p) => `${p.filename} (${Math.round((p.content?.length || 0) / 1024)} Ko)`)
          .join(", ")}`,
      );
    }
    console.log(text || html);
    console.log("─────────────────────────────────────────────────────────────\n");
    return { simule: true };
  }

  const mailOptions = { from: expediteur(), to, subject, html };
  if (text) mailOptions.text = text;
  if (replyTo) mailOptions.replyTo = replyTo;
  if (attachments?.length) mailOptions.attachments = attachments;

  return creerTransport().sendMail(mailOptions);
};

export default sendEmail;
