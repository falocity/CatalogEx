FROM node:24 AS build

WORKDIR /tmp/buildApp

COPY package*.json ./
COPY .husky/install.mjs .husky/install.mjs
RUN npm ci

COPY tsconfig.json tsconfig.build.json ./
COPY src/ ./src/
RUN npm run build


FROM node:24-alpine AS production

ENV NODE_ENV=production

WORKDIR /usr/src/app

COPY --chown=node:node package*.json ./
COPY --chown=node:node .husky/install.mjs .husky/install.mjs
RUN npm ci --omit=dev

COPY --chown=node:node --from=build /tmp/buildApp/dist/db/ ./dist/db/
COPY --chown=node:node --from=build /tmp/buildApp/dist/common/ ./dist/common/
COPY --chown=node:node config/ ./config/
COPY --chown=node:node drizzle/ ./drizzle/

USER node

CMD ["node", "dist/db/migrate.js"]
