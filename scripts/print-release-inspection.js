const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const inspectionPath = path.join(projectRoot, 'release-inspection.js'); // fallback location
const altPath = path.join(projectRoot, 'release', 'inspection', 'release-inspection.js'); // optional

const filePath = fs.existsSync(inspectionPath) ? inspectionPath : (fs.existsSync(altPath) ? altPath : null);

function exitWith(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

if (!filePath) {
  exitWith('Fichier release-inspection.js introuvable. Exécutez d’abord le script PowerShell inspect-release.ps1 pour générer le rapport.');
}

const content = fs.readFileSync(filePath, 'utf8').trim();
if (!content) {
  exitWith(`Le fichier ${filePath} est vide. Relancez inspect-release.ps1 puis réessayez.`);
}

// extraire le JSON exporté : "export const releaseInspection = <JSON>;"
const m = content.match(/export\s+const\s+releaseInspection\s*=\s*([\s\S]*);\s*$/m);
if (!m) {
  exitWith(`Impossible d'extraire le rapport depuis ${filePath}. Le fichier doit contenir "export const releaseInspection = {...};"`);
}

let jsonText = m[1].trim();
// si le JSON utilise des quotes simples ou des trailing commas, essayer d'être tolérant (mais on suppose JSON valide)
try {
  const data = JSON.parse(jsonText);
  printReport(data, filePath);
} catch (err) {
  // Tentative de nettoyage : remplacer les keys non-quotées ou trailing commas n'est pas fiable; afficher erreur utile
  console.error('Échec du parse JSON du rapport :', err.message);
  console.error('Contenu extrait (tronc):\n', jsonText.slice(0, 1000));
  process.exit(2);
}

function printReport(obj, fp) {
  console.log('=== Rapport d\'inspection du release ===');
  console.log('Fichier :', fp);
  console.log('Généré le :', obj.generatedAt || '(inconnu)');
  console.log('Chemin release détecté :', obj.releasePath || '(non renseigné)');
  console.log('');

  const items = Array.isArray(obj.items) ? obj.items : [];
  if (!items.length) {
    console.log('Aucun emplacement vérifié dans le rapport.');
  } else {
    console.log('Emplacements vérifiés :');
    items.forEach(it => {
      const present = it.present ? 'OK' : 'MISSING';
      const size = it.size != null ? String(it.size) : '-';
      console.log(` - ${it.label}: ${present}  (${size})`);
    });
  }
  console.log('');

  const asarList = Array.isArray(obj.appAsarList) ? obj.appAsarList : [];
  if (asarList.length) {
    console.log(`app.asar contient ${asarList.length} entrées (liste tronquée ci-dessous) :`);
    asarList.slice(0, 30).forEach((line, idx) => {
      console.log(`   ${idx + 1}. ${line}`);
    });
    if (asarList.length > 30) console.log(`   ... (+${asarList.length - 30} autres entrées)`);
  } else {
    console.log('Aucune liste d\'entries app.asar exportée (ou asar non inspecté).');
  }

  console.log('\nConseils :');
  console.log('- Si des éléments critiques sont manquants (resources/dist, resources/app.asar), relancer packaging ou vérifier package.json extraResources/asarUnpack.');
  console.log('- Pour regénérer le rapport : exécutez la commande PowerShell scripts\\inspect-release.ps1 puis relancez npm run inspect:print.');
}
