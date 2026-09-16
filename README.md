# Clé d'Ex 225 — Plateforme de Consultation & d'Inspirations

Application web conçue pour la promotion **Clun'ss 225** afin de recueillir les avis, inspirations et idées pour la conception collective de la **Clé d'Ex**.

---

## 📋 Table des matières

1. [Fonctionnement de l'application](#-fonctionnement-de-lapplication)
2. [Architecture technique](#-architecture-technique)
3. [Structure des dossiers](#-structure-des-dossiers)
4. [Prérequis](#-prérequis)
5. [Installation & Démarrage rapide](#-installation--démarrage-rapide)
6. [Déploiement sur serveur personnel (Auto-hébergement)](#-déploiement-sur-serveur-personnel-auto-hébergement)
   - [Option A : Node.js avec PM2 (Recommandé)](#option-a--nodejs-avec-pm2-recommandé)
   - [Option B : Conteneur Docker](#option-b--conteneur-docker)
   - [Accès distant (Cloudflare Tunnel ou Reverse Proxy)](#accès-distant-cloudflare-tunnel-ou-reverse-proxy)
7. [Personnalisation & Administration](#-personnalisation--administration)
8. [Sauvegarde des données](#-sauvegarde-des-données)

---

## 🎯 Fonctionnement de l'application

Le parcours utilisateur est conçu pour être fluide, rapide et optimisé sur smartphone comme sur ordinateur.

### 1. Connexion simplifiée
- Chaque camarade s'identifie avec sa **Buque** et sa **Fam'ss**.
- Aucun mot de passe complexe requis : la session est sauvegardée localement sur le navigateur et synchronisée en direct avec le serveur.

### 2. Le parcours en 4 étapes
* **Étape 1 : Questionnaire préliminaire**
  - Évaluation de la connaissance sur les clés d'Ex, symbolique, échéances souhaitées et éléments identitaires de la promotion.
* **Étape 2 : Galerie d'inspirations (Swipe de cartes)**
  - Découverte visuelle des clés d'Ex historiques des promotions précédentes.
  - Interaction par glissement tactile (swipe) ou boutons :
    - 💚 **J'aime** (swipe droite)
    - 🤍 **Écarter** (swipe gauche)
    - ⭐ **Coup de cœur** (swipe haut avec annotation facultative du détail marquant)
  - Sélection initiale équilibrée de **30 clés**, avec possibilité de continuer pour évaluer l'intégralité des clés restantes.
  - L'ordre de présentation des clés est aléatoire et mémorisé de manière déterministe pour chaque utilisateur.
* **Étape 3 : Questions secondaires**
  - Questions posées après la découverte visuelle : styles préférés, dimensions et symbolique, matériaux (bois, métal, bimatériau), mécanismes ou innovations souhaitées, et boîte à idées libre.
* **Étape 4 : Bilan & Tendances collectives**
  - Suivi en temps réel du taux de participation de la promotion (sur l'objectif de 163 camarades).
  - Podiums des inspirations les plus plébiscitées et répartition des votes.
  - Synthèse statistique des réponses aux questions.
  - Possibilité de modifier ses votes et réponses à tout moment.
  - Export brut de toutes les réponses au format JSON pour l'équipe de conception.

---

## 🛠 Architecture technique

- **Frontend** :
  - [React 19](https://react.dev/) avec [TypeScript](https://www.typescriptlang.org/)
  - [Vite](https://vitejs.dev/) (bundler ultra-rapide)
  - [Tailwind CSS v4](https://tailwindcss.com/) pour les styles
  - [Motion](https://motion.dev/) pour les animations de swipe et transitions fluides
  - [Lucide React](https://lucide.dev/) pour les icônes
- **Backend** :
  - [Node.js](https://nodejs.org/) & [Express](https://expressjs.com/)
  - Compilé en bundle autonome CommonJS (`dist/server.cjs`) via `esbuild`
- **Stockage des données** :
  - **100 % autonome et sans base de données externe** : chaque réponse individuelle est enregistrée sous forme de fichier JSON dans le répertoire `data/responses/`.
  - La configuration des questions et la liste des photos sont définies dans `config/survey-config.json`.

---

## 📁 Structure des dossiers

```text
cle-dex-225/
├── config/
│   └── survey-config.json     # Configuration des questions, photos et paramètres
├── data/
│   └── responses/             # Fichiers JSON individuels des votes et réponses
├── public/
│   ├── photos/                # Photos des clés d'Ex historiques
│   └── icon.svg
├── src/
│   ├── components/            # Composants React (Header, Swipe, Survey, Stats...)
│   ├── types.ts               # Définitions TypeScript
│   ├── App.tsx                # Composant racine et gestion de l'état
│   └── main.tsx               # Point d'entrée React
├── server.ts                  # Serveur backend Express et API REST
├── package.json               # Dépendances et scripts npm
└── README.md
```

---

## 💻 Prérequis

- **Node.js** : version 20.x ou 22.x LTS recommandée ([télécharger Node.js](https://nodejs.org/)).
- **npm** (installé d'office avec Node.js).
- Un terminal (Linux, macOS, ou PowerShell sous Windows).

---

## 🚀 Installation & Démarrage rapide

### 1. Cloner ou décompresser le projet
```bash
cd cle-dex-225
```

### 2. Installer les dépendances
```bash
npm install
```

### 3. Lancer en mode développement
```bash
npm run dev
```
L'application démarre et est accessible sur [http://localhost:3000](http://localhost:3000).

---

## 🌐 Déploiement sur serveur personnel (Auto-hébergement)

Pour déployer l'application sur un serveur domestique (Raspberry Pi, mini-PC, serveur Ubuntu/Debian, NAS) :

### Option A : Node.js avec PM2 (Recommandé)

#### 1. Compiler l'application pour la production
```bash
npm run build
```
Cette commande génère :
- Le frontend optimisé dans le dossier `dist/`.
- Le backend compilé et minifié dans `dist/server.cjs`.

#### 2. Installer le gestionnaire de processus PM2
PM2 permet de faire tourner l'application en arrière-plan et de la relancer automatiquement en cas de redémarrage du serveur :
```bash
sudo npm install -g pm2
```

#### 3. Démarrer le service
```bash
# Lancement en production sur le port 3000 (ou PORT=8080)
NODE_ENV=production pm2 start "node dist/server.cjs" --name "cle-dex-225"

# Enregistrer pour un redémarrage automatique au boot
pm2 startup
pm2 save
```

Pour consulter l'état ou les logs du serveur :
```bash
pm2 status
pm2 logs cle-dex-225
```

---

### Option B : Conteneur Docker

Si tu préfères utiliser Docker (idéal pour un NAS Synology, Unraid ou serveur conteneurisé) :

#### 1. Créer le `Dockerfile`
Crée un fichier nommé `Dockerfile` à la racine :
```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/config ./config
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "dist/server.cjs"]
```

#### 2. Construire et lancer le conteneur
Pense à monter le dossier `data/` en volume externe pour conserver les réponses des utilisateurs :
```bash
docker build -t cle-dex-225 .

docker run -d \
  --name cle-dex-225 \
  --restart unless-stopped \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  cle-dex-225
```

---

### 🌍 Accès distant (Rendre le site accessible à la promotion)

Pour que tes camarades puissent voter depuis leur téléphone en 4G ou depuis l'extérieur :

#### Solution recommandée : Cloudflare Tunnel (Gratuit & Sécurisé)
- **Aucune ouverture de port** nécessaire sur ta box Internet.
- Masque ton adresse IP publique personnelle.
- Fournit un certificat **HTTPS valide** immédiatement.
1. Crée un compte sur [Cloudflare](https://dash.cloudflare.com/) avec un nom de domaine.
2. Rends-toi dans **Zero Trust > Networks > Tunnels**.
3. Crée un tunnel et installe l'agent `cloudflared` sur ton serveur en suivant les instructions affichées.
4. Route le trafic vers `http://localhost:3000`.

#### Solution classique : Nginx / Caddy + Redirection de box
1. Installe un reverse proxy comme Nginx ou Caddy pour rediriger le trafic entrant vers le port `3000`.
2. Configure ta box Internet (Livebox, Freebox, etc.) pour rediriger les ports **80** et **443** vers l'IP locale de ton serveur.
3. Configure un nom de domaine ou un DNS dynamique (DuckDNS, No-IP) et génère un certificat SSL via Let's Encrypt :
   ```bash
   sudo certbot --nginx -d ton-domaine.fr
   ```

---

## ⚙️ Personnalisation & Administration

### Modifier les questions et photos
Toute la structure du sondage est centralisée dans `config/survey-config.json` :
- **Questions** : modification des intitulés, options, choix uniques ou multiples, limites de sélections.
- **Photos** : ajout d'identifiants, titres, catégories de promotion et chemins vers les images dans `public/photos/`.
- **Taille du lot de swipe** : `swipeBatchSize` (par défaut 30 clés avant de proposer les questions finales ou la suite).

### Exportation des résultats
Depuis l'onglet **Bilan & Tendances** (Étape 4) ou directement via l'API :
```
GET /api/export-responses
```
Cet endpoint télécharge un fichier `reponses_cle_dex_225.json` réunissant l'ensemble des réponses individuelles, notes de coups de cœur et statistiques d'approbation.

---

## 💾 Sauvegarde des données

Les réponses des votants sont écrites dans :
```text
data/responses/<buque>_<famss>.json
```
Il est fortement recommandé de planifier une sauvegarde régulière de ce dossier `data/` (par exemple avec `rsync`, une tâche `cron` ou un outil de backup) pour sécuriser les contributions de la promotion.
