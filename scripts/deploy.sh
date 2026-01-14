#!/bin/bash

# Arrêt propre des conteneurs existants
# On n'utilise PAS -v pour préserver le volume postgres_data
echo "Stopping current containers..."
docker compose down

# Nettoyage des images orphelines pour éviter la saturation disque (Idempotence)
echo "Cleaning up old images..."
docker image prune -f

# Récupération des versions spécifiques via le SHA passé par GitHub Actions
# On utilise des variables pour rendre le script réutilisable
echo "Pulling images for SHA: ${GITHUB_SHA}"
docker pull ghcr.io/augustinseguin/project-backend:${GITHUB_SHA}
docker pull ghcr.io/augustinseguin/project-frontend:${GITHUB_SHA}

# Tagage en 'latest' pour correspondre au fichier docker-compose.yaml
docker tag ghcr.io/augustinseguin/project-backend:${GITHUB_SHA} ghcr.io/augustinseguin/project-backend:latest
docker tag ghcr.io/augustinseguin/project-frontend:${GITHUB_SHA} ghcr.io/augustinseguin/project-frontend:latest

# Relance de la stack en mode détaché
echo "Starting environment..."
docker compose up -d

echo "Deployment successful!"