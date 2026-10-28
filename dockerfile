FROM node:24 AS build

WORKDIR /tmp/buildApp

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build


FROM node:24-alpine AS production

RUN apk add --no-cache dumb-init

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

WORKDIR /usr/src/app

COPY --chown=node:node package*.json ./
RUN npm ci --omit=dev

COPY --chown=node:node --from=build /tmp/buildApp/dist ./dist
COPY --chown=node:node --from=build /tmp/buildApp/config ./config

USER node

EXPOSE 3000

CMD ["dumb-init", "node", "dist/server.js"]