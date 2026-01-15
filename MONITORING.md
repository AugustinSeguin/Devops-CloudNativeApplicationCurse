# 📊 Observabilité & Monitoring - Projet NestJS/Vue

Ce document décrit la stack de monitoring mise en place pour surveiller l'infrastructure Blue/Green.

## 🏗 Architecture Globale

La stack repose sur quatre piliers interconnectés :

1. **Collecte des Métriques (Pull)** : Prometheus interroge l'application toutes les 15s sur l'endpoint `/metrics`.
2. **Collecte des Logs (Push)** : Promtail lit les logs Docker via le socket UNIX et les expédie à Loki.
3. **Stockage** : Prometheus (séries temporelles) et Loki (logs indexés par labels).
4. **Visualisation** : Grafana centralise les données pour créer des dashboards.

### Schéma de flux
[Application (NestJS)] --(/metrics)--> [Prometheus] <--- [Grafana]
[Docker Logs] -------->(Promtail)------> [Loki] <------- [Grafana]

## 🚦 Ports & Accès

| Service      | Port Interne | Port Externe (Host) | Rôle                           |
| :----------- | :----------- | :------------------ | :----------------------------- |
| **Prometheus** | 9090         | 9090                | Serveur de métriques           |
| **Grafana** | 3000         | 3001* | Visualisation (Dashboard)      |
| **Loki** | 3100         | 3100 (interne)      | Moteur d'agrégation de logs    |
| **Promtail** | 9080         | -                   | Agent de collecte de logs      |

> *Note : Comme notre Frontend Blue/Green utilise déjà le port 80 (via Nginx), nous utilisons le port 3001 ou 3000 pour Grafana selon les disponibilités.*

## 💉 Intégration Applicative
- **NestJS** : Utilisation du module `@willsoto/nestjs-prometheus` pour exposer les métriques au format OpenMetrics.
- **Docker** : Utilisation du driver `json-file` (par défaut) pour permettre à Promtail de lire les flux `stdout`.