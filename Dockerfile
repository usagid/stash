FROM node:22-bookworm-slim AS build

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV NITRO_HOST=0.0.0.0
ENV NITRO_PORT=3000
ENV STASH_DATABASE_PATH=/data/stashes.sqlite

WORKDIR /app

RUN mkdir -p /data && chown -R node:node /data /app

COPY --from=build --chown=node:node /app/.output ./.output

USER node

VOLUME ["/data"]
EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
