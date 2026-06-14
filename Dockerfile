ARG NODE_IMAGE=node:22-alpine

FROM ${NODE_IMAGE} AS build

WORKDIR /app/short-link

RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json .npmrc ./
RUN npm ci

COPY index.html vite.config.mjs ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM ${NODE_IMAGE} AS runtime

ENV NODE_ENV=production
WORKDIR /app/short-link

RUN apk add --no-cache libstdc++

COPY --from=build /app/short-link/package.json ./
COPY --from=build /app/short-link/package-lock.json ./
COPY --from=build /app/short-link/node_modules ./node_modules
COPY --from=build /app/short-link/dist ./dist
COPY server ./server

RUN mkdir -p /app/short-link/data \
  && chown -R node:node /app/short-link

USER node

EXPOSE 9000

CMD ["node", "server/index.js"]
