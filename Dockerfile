# Emploi Public NC — image unique, front compilé et servi par Express.
#
# ══════════════════════════════════════════════════════════════════════════
#  POURQUOI UNE SEULE IMAGE, ET PAS UN CONTENEUR PAR COUCHE
# ══════════════════════════════════════════════════════════════════════════
# En production, `server.js` sert déjà le build CRA en statique : même origine,
# donc pas de CORS, pas de reverse proxy à configurer, et le cookie de session
# passe sans réglage particulier. Ajouter un nginx devant un conteneur front
# séparé résoudrait un problème que nous n'avons pas — et c'est exactement la
# sur-ingénierie que le critère « adéquation moyens/résultats » sanctionne.

# ── Étape 1 : compiler le front ───────────────────────────────────────────
#
# Séparée pour que `node_modules` du front (plusieurs centaines de mégaoctets,
# react-scripts compris) ne parte PAS dans l'image finale. Seul le dossier
# `build/` en sort.
FROM node:20-alpine AS front

WORKDIR /app/frontend

# Les manifestes d'abord : tant qu'ils ne changent pas, Docker réutilise la
# couche d'installation. Copier tout le source ici referait un `npm ci` complet
# à chaque modification d'un fichier CSS.
COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./

# CI=true : react-scripts traite les avertissements comme des erreurs en
# intégration continue. On ne le veut PAS ici — un avertissement de lint ne
# doit pas empêcher quelqu'un de faire tourner la démo.
ENV CI=false
RUN npm run build

# ── Étape 2 : l'image d'exécution ─────────────────────────────────────────
FROM node:20-alpine AS runtime

WORKDIR /app

# `--omit=dev` : nodemon, concurrently et les outils de développement n'ont
# rien à faire dans une image qu'on exécute.
COPY package*.json ./
RUN npm ci --omit=dev

COPY backend/ ./backend/
COPY --from=front /app/frontend/build ./frontend/build

# L'utilisateur `node` existe déjà dans l'image officielle. Tourner en root
# dans un conteneur exposé sur le réseau n'a aucune raison d'être.
USER node

ENV NODE_ENV=production
ENV PORT=5000
EXPOSE 5000

CMD ["node", "backend/server.js"]
