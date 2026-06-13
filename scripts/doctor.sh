#!/bin/sh
set -eu

echo "== SMSBower2API deploy doctor =="
echo

echo "== Git =="
git rev-parse --short HEAD || true
git status --short || true
echo

echo "== Docker =="
docker --version || true
docker compose version || true
echo

echo "== Compose config =="
docker compose config | sed -n '1,120p'
echo

echo "== Registry connectivity =="
for url in \
  "https://registry-1.docker.io/v2/" \
  "https://docker.1ms.run/v2/" \
  "https://registry.npmmirror.com/"
do
  printf "%s -> " "$url"
  if command -v curl >/dev/null 2>&1; then
    curl -I -m 8 -sS "$url" >/dev/null && echo "ok" || echo "failed"
  else
    wget --spider -T 8 -q "$url" && echo "ok" || echo "failed"
  fi
done
echo

echo "== Container =="
docker compose ps || true
docker compose logs --tail=80 smsbower2api || true
