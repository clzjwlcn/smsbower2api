ARG NODE_IMAGE=node:22-bookworm-slim
FROM ${NODE_IMAGE}

WORKDIR /app

ENV NODE_ENV=development \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000

ARG NPM_REGISTRY=https://registry.npmmirror.com

COPY package.json package-lock.json ./
RUN npm ci --registry=${NPM_REGISTRY}

COPY . .

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["sh", "-c", "node scripts/write-dev-vars.mjs && node scripts/init-db.mjs && npm run dev -- --hostname 0.0.0.0 --port ${PORT:-3000}"]
