#!/bin/sh
set -eu

if [ ! -f docker-compose.yml ]; then
  echo "Please run this script in the smsbower2api project directory."
  exit 1
fi

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example. Please edit passwords and SMSBOWER_API_KEY after this run."
fi

git pull --ff-only || true
docker compose up -d --build

echo "Waiting for MySQL and app containers..."
docker compose ps

echo "Creating MySQL tables..."
docker compose exec -T smsbower2api node scripts/init-db.mjs

echo "Importing old D1 data into MySQL if a .wrangler D1 database exists..."
docker compose exec -T smsbower2api node scripts/migrate-d1-to-mysql.mjs || true

docker compose restart smsbower2api
docker compose ps

echo "Done. Open http://SERVER_IP:${APP_PORT:-3000}/ and /admin"
