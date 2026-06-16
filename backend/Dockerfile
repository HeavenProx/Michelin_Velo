# ── Étape 1 : build ───────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

# Outils natifs requis par better-sqlite3
RUN apk add --no-cache python3 make g++
RUN npm install -g pnpm@9

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# Supprime les devDependencies pour alléger la couche copiée en prod
RUN pnpm prune --prod

# ── Étape 2 : image de production ─────────────────────────────────────────────
FROM node:22-alpine AS production
WORKDIR /app

# Copie uniquement ce qui est nécessaire au runtime
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

# Répertoire pour la base SQLite
RUN mkdir -p data

EXPOSE 3001
CMD ["node", "dist/main.js"]
