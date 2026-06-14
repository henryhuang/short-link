FROM node:24-bookworm-slim AS build

WORKDIR /app/short-link

COPY package.json package-lock.json .npmrc ./
RUN npm ci

COPY index.html vite.config.mjs ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app/short-link

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
