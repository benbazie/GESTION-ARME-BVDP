const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Construction du package portable...');

// 1. Build React
console.log('📦 Build de l\'interface React...');
try {
  execSync('npm run build', { stdio: 'inherit' });
} catch (error) {
  console.error('❌ Erreur lors du build React');
  process.exit(1);
}

// 2. Créer le dossier portable
const portableDir = path.join(__dirname, '..', 'vdp-manager-portable');
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
  'package.json',
  '.env.example'
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
  } else {
    console.warn(`⚠️ Fichier non trouvé: ${file}`);
  }
});

// 4. Créer package.json minimal pour production
const prodPackageJson = {
  "name": "vdp-manager-portable",
  "version": "1.0.0",
  "description": "Système de gestion VDP - Version portable",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
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

// 5. Créer le fichier .env de production
const prodEnv = `NODE_ENV=production
API_PORT=3001
JWT_SECRET=votre-cle-secrete-changez-moi-en-production
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

console.log('✅ Package portable créé dans:', portableDir);
console.log('📋 Prochaines étapes:');
console.log('   1. Testez avec: cd vdp-manager-portable && npm install');
console.log('   2. Démarrez avec: npm start');
console.log('   3. Compressez le dossier pour l\'envoi');
