import asyncHandler from "./asyncHandler.js";
import CleApi, { empreinteDe } from "../models/CleApiModel.js";

// Authentification par clé d'API, pour les consommateurs machine.
//
// Le secret est attendu dans l'en-tête `Authorization: Bearer epnc_…`, la
// forme que tout client HTTP sait produire sans configuration particulière.
// `X-API-Key` est accepté en second, parce qu'une partie des ATS ne sait
// écrire que celui-là.
//
// ⚠️ JAMAIS dans l'URL, et le message d'erreur le dit. Une clé en paramètre de
// requête se retrouve dans les journaux du serveur, dans ceux du reverse
// proxy, dans l'historique du navigateur et dans l'en-tête `Referer` envoyé
// aux tiers. C'est la façon la plus courante de fuiter un secret.

const secretPresente = (req) => {
  const entete = req.headers.authorization || "";
  if (entete.startsWith("Bearer ")) return entete.slice(7).trim();
  const alternative = req.headers["x-api-key"];
  return typeof alternative === "string" ? alternative.trim() : "";
};

/**
 * Exige une clé valide, et la portée demandée.
 *
 * @param {string} portee — la portée nécessaire à cette route.
 */
export const cleApi = (portee) =>
  asyncHandler(async (req, res, next) => {
    const secret = secretPresente(req);

    if (!secret) {
      // Le paramètre d'URL est refusé explicitement plutôt qu'ignoré : sans ce
      // message, l'intégrateur qui l'a essayé conclut « l'API ne marche pas »
      // et recommence — en laissant sa clé dans les journaux à chaque essai.
      if (req.query.cle || req.query.api_key || req.query.token) {
        res.status(401);
        throw new Error(
          "La clé ne se transmet pas dans l'URL : elle finirait dans les journaux du serveur et dans l'en-tête Referer. Utilisez l'en-tête « Authorization: Bearer <clé> ».",
        );
      }

      res.status(401);
      throw new Error(
        "Clé d'API absente. Ajoutez l'en-tête « Authorization: Bearer <clé> ». La documentation est sur /api/openapi.json.",
      );
    }

    // Recherche par EMPREINTE, jamais par le secret : il n'existe nulle part en
    // base, donc rien à comparer en clair.
    const cle = await CleApi.findOne({ empreinte: empreinteDe(secret) }).select(
      "+empreinte",
    );

    if (!cle) {
      res.status(401);
      throw new Error("Clé d'API inconnue.");
    }

    if (!cle.active) {
      res.status(403);
      throw new Error(
        `Cette clé a été révoquée${cle.revoqueeLe ? ` le ${cle.revoqueeLe.toLocaleDateString("fr-FR")}` : ""}. Contactez l'administrateur de la plateforme.`,
      );
    }

    if (portee && !cle.portees.includes(portee)) {
      res.status(403);
      throw new Error(
        `Cette clé ne porte pas la permission « ${portee} ». Portées accordées : ${cle.portees.join(", ") || "aucune"}.`,
      );
    }

    req.cleApi = cle;

    // Compteur d'usage, hors du chemin de réponse.
    //
    // `updateOne` plutôt que `cle.save()` : on ne veut ni revalider le document
    // ni écraser une révocation décidée entre-temps. Et la promesse n'est pas
    // attendue — un incident d'écriture sur un compteur ne doit pas faire
    // échouer un appel d'API par ailleurs légitime.
    CleApi.updateOne(
      { _id: cle._id },
      { $set: { dernierAppel: new Date() }, $inc: { nbAppels: 1 } },
    ).catch((e) => console.warn(`⚠️  Compteur de clé non mis à jour : ${e.message}`));

    next();
  });

export default cleApi;
