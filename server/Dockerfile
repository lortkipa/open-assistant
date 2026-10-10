# Build from the repo root: docker build -f server/Dockerfile .
FROM node:26-alpine
WORKDIR /app
RUN npm install -g pnpm@11.24.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json server/
COPY desktop/package.json desktop/
RUN pnpm install --prod --frozen-lockfile --filter server --ignore-scripts
COPY server/migrations server/migrations
COPY server/src server/src
WORKDIR /app/server
ENV NODE_ENV=production
EXPOSE 8787
CMD ["node", "src/index.ts"]
