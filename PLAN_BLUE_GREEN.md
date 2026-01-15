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
# Définition des groupes de serveurs (Upstreams)
upstream backend-blue   { server backend-blue:3000; }
upstream backend-green  { server backend-green:3000; }
upstream frontend-blue  { server frontend-blue:80; }
upstream frontend-green { server frontend-green:80; }

server {
    listen 80;
    resolver 127.0.0.11 valid=30s;

    # ✅ Inclusion dynamique sécurisée (extension .inc)
    include /etc/nginx/conf.d/active_target.inc;

    location /api/ {
        rewrite ^/api/(.*)$ /$1 break;
        proxy_pass http://$target_backend;
        proxy_set_header Host $host;
    }

    location / {
        proxy_pass http://$target_frontend;
        proxy_set_header Host $host;
    }
}
```

### Le Switch

La bascule s'effectue en réécrivant le fichier `active_target.inc` et en exécutant `nginx -s reload`. Cette méthode permet de changer de version **sans redémarrer le conteneur Nginx**, garantissant l'absence de coupure pour l'utilisateur.

---

## 3. Scénario de Déploiement Automatisé

Le pipeline CI (GitHub Actions) suit la logique suivante :

1. **Détection** : Le script `deploy.sh` lit `active_target.inc` pour identifier la couleur en production (ex: `blue`).

2. **Déploiement Inactif** : Il déploie la nouvelle version sur la couleur opposée (`green`) :
   ```bash
   docker compose -f docker-compose.base.yml -f docker-compose.green.yml up -d
   ```

3. **Validation (Warm-up)** : Une pause de 15s est observée (ou un `curl` sur le healthcheck) pour s'assurer que l'instance `green` est prête.

4. **Bascule** :
   - Réécriture de `active_target.inc` pour pointer vers `green`.
   - Commande : `docker exec reverse-proxy nginx -s reload`.

5. **Rollback** : L'ancienne version (`blue`) reste allumée. En cas d'alerte, le script peut instantanément ré-écraser la conf Nginx pour pointer vers `blue`.

---

## 4. Schéma de flux

```
      [ Trafic Utilisateur : Port 80 ]
                    |
          +---------v---------+
          |   Nginx Proxy     | <--- Rechargement dynamique
          | (active_target.inc)|
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

**Set color**

```sh 
# Set green 
echo 'set $target_backend  backend-green;' > nginx/conf.d/active_target.inc
echo 'set $target_frontend frontend-green;' >> nginx/conf.d/active_target.inc
``` 

**Logs** 

`docker logs -f backend-blue` 

**Reload Proxy** 

`docker exec reverse-proxy nginx -s reload` 

**Smoke tests**

```sh
# identify docker container id
docker ps

curl http://localhost/api/whoami
```

