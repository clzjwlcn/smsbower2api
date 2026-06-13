FROM node:22-bookworm-slim

WORKDIR /app

ENV NODE_ENV=development \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["sh", "-c", "node scripts/write-dev-vars.mjs && npm run dev -- --hostname 0.0.0.0 --port ${PORT:-3000}"]
