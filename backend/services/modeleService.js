// backend/services/modeleService.js
//
// Appel au modèle de langage. Isolé dans un fichier dédié pour que changer de
// fournisseur ne touche qu'ici : redactionService ne connaît que
// `appelerModele(systeme, utilisateur, options)`.

const URL_API = "https://api.openai.com/v1/chat/completions";

// Au-delà, on rend la main plutôt que de laisser l'interface tourner dans le
// vide. La production d'une lettre prend une dizaine de secondes ; 60 s laisse
// une marge confortable sans bloquer quelqu'un derrière une panne.
const DELAI_MAX_MS = 60000;

export const iaDisponible = () => Boolean(process.env.OPENAI_API_KEY?.trim());

export const modeleUtilise = () => process.env.OPENAI_MODEL || "gpt-4o-mini";

/**
 * Envoie une consigne au modèle et renvoie le texte produit.
 * Lève une erreur explicite en cas d'échec — surtout pas un repli silencieux :
 * l'utilisateur croirait avoir un texte rédigé alors qu'il aurait un brouillon.
 */
export const appelerModele = async (systeme, utilisateur, options = {}) => {
  if (!iaDisponible()) {
    throw new Error("OPENAI_API_KEY absente : la rédaction assistée est désactivée.");
  }

  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), DELAI_MAX_MS);

  let reponse;
  try {
    reponse = await fetch(URL_API, {
      method: "POST",
      signal: controleur.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: modeleUtilise(),
        messages: [
          { role: "system", content: systeme },
          { role: "user", content: utilisateur },
        ],
        // Assez bas pour que le modèle reste collé aux faits fournis : on veut
        // une reformulation fidèle, pas de l'invention.
        temperature: options.temperature ?? 0.4,
        max_tokens: options.maxTokens ?? 1600,
        // Mode JSON strict pour la passe de critique : sans lui, le modèle
        // encadre parfois sa réponse de ```json, et l'analyse échoue une fois
        // sur dix — précisément le genre de panne intermittente qui se
        // manifeste en démonstration.
        ...(options.json ? { response_format: { type: "json_object" } } : {}),
      }),
    });
  } catch (erreur) {
    clearTimeout(minuteur);
    if (erreur.name === "AbortError") {
      throw new Error(
        "Le service de rédaction n'a pas répondu à temps. Réessayez dans un instant.",
      );
    }
    throw new Error(`Service de rédaction injoignable : ${erreur.message}`);
  }
  clearTimeout(minuteur);

  if (!reponse.ok) {
    // Les messages d'erreur du fournisseur sont exploitables : crédit épuisé,
    // clé révoquée, modèle inconnu. Les masquer ferait perdre une heure.
    let detail = `${reponse.status} ${reponse.statusText}`;
    try {
      const corps = await reponse.json();
      if (corps?.error?.message) detail = corps.error.message;
    } catch {
      /* corps illisible : on garde le code HTTP */
    }

    if (reponse.status === 401) {
      throw new Error(`Clé d'API refusée. ${detail}`);
    }
    if (reponse.status === 429) {
      throw new Error(
        `Quota ou cadence dépassés côté fournisseur. ${detail}`,
      );
    }
    throw new Error(`Le service de rédaction a refusé la demande : ${detail}`);
  }

  const donnees = await reponse.json();
  const texte = donnees?.choices?.[0]?.message?.content?.trim();

  if (!texte) {
    throw new Error("Le service de rédaction a renvoyé une réponse vide.");
  }

  // Trace de consommation dans la console du serveur.
  //
  // Sur un budget de hackathon, on veut savoir ce que coûte réellement une
  // pièce AVANT de découvrir le crédit épuisé la veille du rendu. Le nombre de
  // jetons d'entrée grimpe vite : une fiche de poste de l'OPT fait déjà
  // plusieurs milliers de caractères, et on la renvoie à chaque production.
  const u = donnees?.usage;
  if (u) {
    console.log(
      `🧠 ${modeleUtilise()} · ${options.etiquette || "rédaction"} · ` +
        `entrée ${u.prompt_tokens} jetons, sortie ${u.completion_tokens}, total ${u.total_tokens}`,
    );
  }

  return texte;
};
