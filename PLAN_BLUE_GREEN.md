# 📘 Plan Stratégique : Déploiement Blue/Green (Reverse Proxy Nginx)

Ce document détaille la stratégie de déploiement Blue/Green visant à garantir une **disponibilité continue (Zero Downtime)** et un **Rollback instantané**.

---

## 1. Architecture des fichiers Docker Compose

Pour séparer l'infrastructure stable des versions applicatives éphémères, nous utilisons trois fichiers distincts :

- **`docker-compose.base.yml`** : Contient le socle immuable.
  - **PostgreSQL** : Base de données partagée.
  - **Reverse-Proxy (Nginx)** : Point d'entrée unique (Port 80).

- **`docker-compose.blue.yml`** : Instance applicative "Bleue" (Backend + Frontend).

- **`docker-compose.green.yml`** : Instance applicative "Verte" (Backend + Frontend).

### Communication réseau

Tous les services sont rattachés à un réseau Docker unique nommé `app_net`. Nginx utilise des alias DNS (`backend-blue`, `backend-green`, etc.) pour router le trafic vers les conteneurs correspondants sans conflit de port.

---

## 2. Mécanisme de Bascule (Reverse Proxy)

Nous avons choisi l'**Option 1** : utilisation d'upstreams et d'un include dynamique dans Nginx.

### Configuration Nginx (`nginx/conf.d/default.conf`)

Le proxy définit des groupes de serveurs pour chaque couleur. La sélection de la couleur active se fait via un fichier tiers :

```nginx
upstream backend_blue  { server backend-blue:3000; }
upstream backend_green { server backend-green:3000; }

server {
    listen 80;
    # Ce fichier contient la définition des variables $active_backend et $active_frontend
    include /etc/nginx/conf.d/active_target.conf;

    location /api {
        proxy_pass http://$active_backend;
    }
    location / {
        proxy_pass http://$active_frontend;
    }
}
```

### Le Switch

La bascule s'effectue en réécrivant le fichier `active_target.conf` et en exécutant `nginx -s reload`. Cette méthode permet de changer de version **sans redémarrer le conteneur Nginx**, garantissant l'absence de coupure pour l'utilisateur.

---

## 3. Scénario de Déploiement Automatisé

Le pipeline CI (GitHub Actions) suit la logique suivante :

1. **Détection** : Le script `deploy.sh` lit `active_target.conf` pour identifier la couleur en production (ex: `blue`).

2. **Déploiement Inactif** : Il déploie la nouvelle version sur la couleur opposée (`green`) :
   ```bash
   docker compose -f docker-compose.base.yml -f docker-compose.green.yml up -d
   ```

3. **Validation (Warm-up)** : Une pause de 15s est observée (ou un `curl` sur le healthcheck) pour s'assurer que l'instance `green` est prête.

4. **Bascule** :
   - Réécriture de `active_target.conf` pour pointer vers `green`.
   - Commande : `docker exec reverse-proxy nginx -s reload`.

5. **Rollback** : L'ancienne version (`blue`) reste allumée. En cas d'alerte, le script peut instantanément ré-écraser la conf Nginx pour pointer vers `blue`.

---

## 4. Schéma de flux

```
      [ Trafic Utilisateur : Port 80 ]
                    |
          +---------v---------+
          |   Nginx Proxy     | <--- Rechargement dynamique
          | (active_target.conf)|
          +---------+---------+
                    |
          +---------+---------+
          |                   |
    [ Stack BLUE ]      [ Stack GREEN ]
    (Backend V1)        (Backend V2)
          |                   |
          +---------+---------+
                    |
          [ Base de données Unique ]
```

---

## 5. Commandes clés pour la CI

| Action | Commande |
|--------|----------|
| Initialisation | `docker compose -f docker-compose.base.yml up -d` |
| Déploiement spécifique | `IMAGE_TAG=xxx docker compose -f docker-compose.base.yml -f docker-compose.blue.yml up -d` |
| Rechargement Proxy | `docker exec reverse-proxy nginx -s reload` |
