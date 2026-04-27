const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Construction du package portable autonome...');

// 1. Build React
console.log('📦 Build de l\'interface React...');
try {
  execSync('npm run build', { stdio: 'inherit' });
} catch (error) {
  console.error('❌ Erreur lors du build React');
  process.exit(1);
}

// 2. Créer le dossier portable
const portableDir = path.join(__dirname, '..', 'VDP-Manager-Portable');
if (fs.existsSync(portableDir)) {
  fs.rmSync(portableDir, { recursive: true });
}
fs.mkdirSync(portableDir);

// 3. Copier les fichiers essentiels
console.log('📁 Copie des fichiers...');
const filesToCopy = [
  'build',
  'database',
  'utils', 
  'routes',
  'server.js',
  'main.js',
  'preload.js',
  'package.json'
];

filesToCopy.forEach(file => {
  const src = path.join(__dirname, '..', file);
  const dest = path.join(portableDir, file);
  if (fs.existsSync(src)) {
    if (fs.statSync(src).isDirectory()) {
      fs.cpSync(src, dest, { recursive: true });
    } else {
      fs.copyFileSync(src, dest);
    }
    console.log(`✓ Copié: ${file}`);
  }
});

// 4. Créer package.json minimal
const prodPackageJson = {
  "name": "vdp-manager-portable",
  "version": "1.0.0",
  "description": "Système de gestion VDP - Version portable autonome",
  "main": "main.js",
  "scripts": {
    "start": "node_modules/.bin/electron .",
    "start-server": "node server.js"
  },
  "dependencies": {
    "electron": "^28.0.0",
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "pg": "^8.16.3",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "moment": "^2.29.4",
    "dotenv": "^16.3.1",
    "node-fetch": "^2.7.0"
  }
};

fs.writeFileSync(
  path.join(portableDir, 'package.json'), 
  JSON.stringify(prodPackageJson, null, 2)
);

// 5. Créer le fichier .env
const prodEnv = `NODE_ENV=production
API_PORT=3001
JWT_SECRET=changez-cette-cle-secrete-en-production
JWT_EXPIRES_IN=8h
DEBUG_AUTH=false
DB_CLIENT=pg
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=gestion_armes_vdp
PG_USER=postgres
PG_PASSWORD=postgres
PG_SSL=false
`;

fs.writeFileSync(path.join(portableDir, '.env'), prodEnv);

// 6. Créer DEMARRER.bat
const demarrerBat = `@echo off
title VDP Manager - Demarrage Automatique
color 0A
cls

echo.
echo  =========================================
echo     VDP MANAGER - VERSION PORTABLE
echo  =========================================
echo.
echo  [INFO] Demarrage automatique en cours...
echo.

REM Aller dans le bon répertoire
cd /d "%~dp0"

REM Vérifier que les fichiers sont présents
if not exist "main.js" (
    echo  [ERREUR] Fichiers manquants dans le dossier.
    echo  Verifiez que vous avez bien decompresse l'archive complete.
    echo.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo  [INFO] Installation des dependances...
    echo  Cela peut prendre quelques minutes...
    echo.
    npm install --production --silent
    if errorlevel 1 (
        echo [ERREUR] Echec de l'installation des dependances
        pause
        exit /b 1
    )
    echo [OK] Dependances installees
    echo.
)

REM Lancer l'application
echo  [INFO] Lancement de l'application...
echo  [INFO] Une fenetre va s'ouvrir automatiquement.
echo  [INFO] Si rien ne se passe, ouvrez votre navigateur sur :
echo         http://localhost:3001
echo.
echo  [IMPORTANT] NE FERMEZ PAS cette fenetre pendant l'utilisation !
echo.

REM Démarrer l'application
start /B node_modules\\.bin\\electron . >nul 2>&1

REM Attendre un peu puis ouvrir le navigateur
timeout /t 3 /nobreak >nul
start http://localhost:3001

echo  [OK] Application demarree !
echo.
echo  Pour arreter l'application :
echo  - Fermez la fenetre de l'application
echo  - OU fermez cette fenetre de commande
echo.
echo  Appuyez sur une touche pour ouvrir l'interface...
pause >nul

REM Ouvrir l'interface si pas déjà fait
start http://localhost:3001

REM Attendre que l'utilisateur ferme
echo.
echo  L'application fonctionne en arriere-plan.
echo  Fermez cette fenetre pour arreter l'application.
echo.
pause
`;

fs.writeFileSync(path.join(portableDir, 'DEMARRER.bat'), demarrerBat);

// 7. Créer README simple
const readmeSimple = `# VDP Manager - Mode d'emploi

## 🚀 Comment utiliser l'application

### Étape 1 : Démarrage
1. **Double-cliquez** sur le fichier \`DEMARRER.bat\`
2. **Attendez** quelques secondes
3. **L'application s'ouvre automatiquement** dans votre navigateur

### Étape 2 : Connexion
- **Utilisateur** : \`admin\`
- **Mot de passe** : \`admin123\`

### Étape 3 : Navigation
- Utilisez le menu à gauche pour naviguer
- Toutes les fonctions sont accessibles via les boutons

## ❓ Questions fréquentes

### L'application ne démarre pas ?
- Vérifiez que vous avez bien **double-cliqué** sur \`DEMARRER.bat\`
- Attendez 10-15 secondes avant de cliquer ailleurs
- Si ça ne marche pas, redémarrez votre ordinateur et réessayez

### Comment arrêter l'application ?
- Fermez la fenêtre noire qui s'est ouverte
- OU fermez votre navigateur et redémarrez votre ordinateur

### L'interface ne s'affiche pas ?
- Ouvrez votre navigateur (Chrome, Firefox, Edge)
- Tapez dans la barre d'adresse : \`localhost:3001\`
- Appuyez sur Entrée

### Où sont stockées mes données ?
- Toutes vos données sont dans le dossier \`database\`
- **Sauvegardez ce dossier régulièrement** !

## 🔒 Sécurité

### Changement du mot de passe
1. Connectez-vous avec \`admin\` / \`admin123\`
2. Allez dans le menu "Système" > "Utilisateurs"
3. Modifiez le mot de passe administrateur

### Sauvegarde importante
- **Copiez le dossier \`database\`** sur une clé USB régulièrement
- En cas de problème, remplacez le dossier \`database\` par votre sauvegarde

## 📞 Support
Pour toute question, contactez l'équipe de développement.

---
**Version portable autonome - Aucune installation requise**
`;

fs.writeFileSync(path.join(portableDir, 'README-SIMPLE.md'), readmeSimple);

// 8. Installer les dépendances
console.log('📦 Installation des dépendances...');
try {
  execSync('npm install --production', { 
    cwd: portableDir, 
    stdio: 'inherit' 
  });
} catch (error) {
  console.error('❌ Erreur lors de l\'installation des dépendances');
  process.exit(1);
}

console.log('✅ Package portable autonome créé dans:', portableDir);
console.log('📋 Votre employeur peut maintenant :');
console.log('   1. Double-cliquer sur DEMARRER.bat');
console.log('   2. Attendre que l\'application se lance');
console.log('   3. Utiliser l\'interface dans son navigateur');
