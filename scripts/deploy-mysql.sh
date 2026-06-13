#!/bin/sh
set -eu

if [ ! -f docker-compose.yml ]; then
  echo "Please run this script in the smsbower2api project directory."
  exit 1
fi

random_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 16
  else
    date +%s%N | sha256sum | cut -c 1-32
  fi
}

set_env_value() {
  key="$1"
  value="$2"

  if grep -q "^${key}=" .env; then
    tmp_file="$(mktemp)"
    sed "s|^${key}=.*|${key}=${value}|" .env > "$tmp_file"
    mv "$tmp_file" .env
  else
    printf '%s=%s\n' "$key" "$value" >> .env
  fi
}

if [ ! -f .env ]; then
  cat > .env <<'EOF'
APP_PORT=3000
APP_ALLOWED_HOSTS=true

MYSQL_DATABASE=smsbower2api
MYSQL_USER=smsbower

SMSBOWER_API_KEY=
SMSBOWER_API_BASE_URL=https://smsbower.page/stubs/handler_api.php
ADMIN_USERNAME=admin
ADMIN_PASSWORD=asd123321
ADMIN_TOKEN=
SMSBOWER_WEBHOOK_SECRET=
SMSBOWER_WEBHOOK_ALLOWED_IPS=167.235.198.205
EOF
  echo "Created .env."
fi

mysql_database="$(grep '^MYSQL_DATABASE=' .env | cut -d= -f2- || true)"
mysql_user="$(grep '^MYSQL_USER=' .env | cut -d= -f2- || true)"
mysql_password="$(grep '^MYSQL_PASSWORD=' .env | cut -d= -f2- || true)"
mysql_root_password="$(grep '^MYSQL_ROOT_PASSWORD=' .env | cut -d= -f2- || true)"

mysql_database="${mysql_database:-smsbower2api}"
mysql_user="${mysql_user:-smsbower}"

case "$mysql_password" in
  ""|"change-this-mysql-password"|"smsbower_password")
    mysql_password="$(random_secret)"
    ;;
esac

case "$mysql_root_password" in
  ""|"change-this-mysql-root-password"|"smsbower_root_password")
    mysql_root_password="$(random_secret)"
    ;;
esac

set_env_value MYSQL_DATABASE "$mysql_database"
set_env_value MYSQL_USER "$mysql_user"
set_env_value MYSQL_PASSWORD "$mysql_password"
set_env_value MYSQL_ROOT_PASSWORD "$mysql_root_password"
set_env_value DATABASE_URL "mysql://${mysql_user}:${mysql_password}@mysql:3306/${mysql_database}"

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
