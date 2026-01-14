#!/bin/bash
# scripts/deploy.sh

if grep -q "blue" ./nginx/conf.d/active_target.inc; then
    ACTIVE="blue"
    NEXT="green"
else
    ACTIVE="green"
    NEXT="blue"
fi

echo "🔵 Current Active: $ACTIVE | 🟢 Deploying Next: $NEXT"

export IMAGE_TAG=${GITHUB_SHA:-latest}
docker compose -f docker-compose.base.yml -f docker-compose.${NEXT}.yml up -d --build

echo "Waiting for $NEXT version to warm up..."
sleep 15

echo "set \$target_backend  backend-${NEXT};" > ./nginx/conf.d/active_target.inc
echo "set \$target_frontend frontend-${NEXT};" >> ./nginx/conf.d/active_target.inc

docker exec reverse-proxy nginx -s reload

echo "Switch completed! Traffic is now routed to $NEXT."
