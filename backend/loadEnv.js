// backend/loadEnv.js
// Charge les variables d'environnement AVANT tout autre import.
// En ESM, tous les `import` d'un module s'exécutent avant son code ; importer
// ce fichier en PREMIÈRE ligne de server.js garantit donc que process.env est
// rempli avant que les autres modules ne soient évalués — y compris ceux qui
// lisent une variable au chargement plutôt qu'à l'appel.
import dotenv from "dotenv";

dotenv.config();

// Vérification au démarrage des variables sans lesquelles l'application ne
// peut pas fonctionner.
//
// POURQUOI : sans ce garde-fou, un JWT_SECRET vide ne se manifeste qu'au
// premier `jwt.sign()` — c'est-à-dire APRÈS la création du compte en base. On
// obtient alors une 500 « secretOrPrivateKey must have a value », illisible
// pour qui ne connaît pas jsonwebtoken, et un utilisateur enregistré sans
// session. Échouer au démarrage coûte une seconde et nomme le vrai problème.
const REQUISES = ["MONGO_URI", "JWT_SECRET"];

const manquantes = REQUISES.filter((cle) => !process.env[cle]?.trim());

if (manquantes.length > 0) {
  console.error(
    `\n❌ Variable(s) d'environnement manquante(s) : ${manquantes.join(", ")}`,
  );
  console.error(
    "   Renseignez-les dans le fichier .env à la racine (voir exemple.env).",
  );
  if (manquantes.includes("JWT_SECRET")) {
    console.error(
      '   Générer un secret : node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"',
    );
  }
  console.error("");
  process.exit(1);
}
