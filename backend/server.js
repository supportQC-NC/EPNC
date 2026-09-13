// backend/server.js
import "./loadEnv.js"; // ⬅️ DOIT rester la toute première ligne (dotenv avant tout)
import path from "path";
import fs from "fs";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";

import connectDB from "./config/db.js";
import { notFound, errorHandler } from "./middleware/errorMiddleware.js";

// ── Routes ──────────────────────────────────────────────────────────────
import userRoutes from "./routes/userRoutes.js";
import avpRoutes from "./routes/avpRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import profilRoutes from "./routes/profilRoutes.js";
import candidatureRoutes from "./routes/candidatureRoutes.js";
import assistantRoutes from "./routes/assistantRoutes.js";
import matchRoutes from "./routes/matchRoutes.js";
import metierRoutes from "./routes/metierRoutes.js";

const PORT = process.env.PORT || 5000;

connectDB();

const app = express();

// CORS : `credentials: true` est indispensable — sans lui le navigateur
// n'envoie pas le cookie JWT et toutes les routes privées répondent 401.
// L'origine doit être explicite (pas `*`) dès qu'on autorise les credentials.
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  }),
);

app.use(cookieParser());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

// Route de vie (hors production : en prod, c'est le front React qui est servi)
app.get("/", (req, res, next) => {
  if (process.env.NODE_ENV === "production") return next();
  res.send("API Emploi Public NC en ligne.");
});

// ── API ─────────────────────────────────────────────────────────────────
app.use("/api/users", userRoutes);
app.use("/api/avps", avpRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/profil", profilRoutes);
app.use("/api/candidatures", candidatureRoutes);
app.use("/api/assistant", assistantRoutes);
app.use("/api/matchs", matchRoutes);
app.use("/api/metiers", metierRoutes);

// ── Front en production ─────────────────────────────────────────────────
// Express sert le build pour n'avoir qu'UNE SEULE origine : le cookie JWT
// sameSite=strict passe sans réglage, il n'y a plus de CORS, et BASE_URL=""
// côté front fonctionne tel quel.
// Définir FRONTEND_BUILD_PATH = chemin absolu du build CRA.
if (process.env.NODE_ENV === "production") {
  const buildPath =
    process.env.FRONTEND_BUILD_PATH ||
    path.join(path.resolve(), "frontend", "build");

  if (fs.existsSync(buildPath)) {
    app.use(express.static(buildPath));
    // Toute route hors /api → index.html (le routage est côté client)
    app.get(/^(?!\/api).*/, (req, res) => {
      res.sendFile(path.join(buildPath, "index.html"));
    });
    console.log(`🖥️  Frontend servi depuis : ${buildPath}`);
  } else {
    console.warn(
      `⚠️  FRONTEND_BUILD_PATH introuvable (${buildPath}) — le front ne sera pas servi par Express.`,
    );
  }
}

// ── Erreurs (toujours en dernier) ───────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
});
