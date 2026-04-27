'use strict'
const { exec } = require('child_process')

function run(cmd, opts = {}) {
  return new Promise(resolve => {
    exec(cmd, { windowsHide: true, ...opts }, (err, stdout, stderr) => {
      resolve({ cmd, err, code: err && err.code ? err.code : 0, stdout: String(stdout || '').trim(), stderr: String(stderr || '').trim() })
    })
  })
}

/* ajout : helper pour exécuter une commande PowerShell */
function runPowershell(psCmd) {
  // utilise powershell.exe (Win PowerShell) pour interroger Get-Command etc.
  const cmd = `powershell -NoProfile -Command "${psCmd.replace(/"/g, '\\"')}"`;
  return run(cmd);
}

async function main() {
  console.log('Vérification de l\'environnement (Windows) — commandes testées : where.exe cl, Get-Command cl, cl.exe /?, python --version, node -v, npm -v\n')
  const results = {}

  // 1) où est cl (MSVC) — essayer plusieurs méthodes (cmd.where, powershell Get-Command)
  results.whereCl = await run('where.exe cl') // marche dans cmd et souvent en PowerShell
  let clPath = results.whereCl.stdout || ''

  if (!clPath) {
    // tente PowerShell Get-Command (retourne le chemin via la propriété Source)
    const ps = await runPowershell('Get-Command cl -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source')
    if (ps.stdout) clPath = ps.stdout.trim()
  }

  if (!clPath) {
    console.log('cl.exe non trouvé (where/Get-Command -> aucun résultat).')
    console.log('- Si vous avez tapé une commande comme "where cl et cl.exe /?" : c\'est incorrect en PowerShell (le mot "et" n\'est pas un séparateur de commande).')
    console.log('  Exécutez les commandes séparément, par ex :')
    console.log('    where.exe cl')
    console.log('    cl.exe /?')
    console.log('- Ou lancez "Developer Command Prompt for VS" ou ouvrez PowerShell en admin après avoir exécuté le script vcvars64.bat.\n')
  } else {
    console.log('cl détecté ->', clPath.split(/\r?\n/).join(' | '))
    // si on a un chemin, essayer cl.exe /?
    results.clHelp = await run('cl.exe /?')
    if (results.clHelp.err && !results.clHelp.stdout) {
      console.log('cl.exe présent mais "cl.exe /?" a retourné une erreur ou ne s\'est pas exécuté correctement (environnement dev non chargé).')
      console.log('- Essayez d\'exécuter "Developer Command Prompt for VS" ou sourcez les variables d\'environnement :')
      console.log('  "C:\\Program Files (x86)\\Microsoft Visual Studio\\2022\\BuildTools\\VC\\Auxiliary\\Build\\vcvars64.bat"')
    } else {
      console.log('cl.exe OK (compilateur MSVC détecté).')
    }
  }

  // 2) Python (node-gyp)
  results.python = await run('python --version')
  if (!results.python.stdout && results.python.err) {
    // fallback to py -3
    results.python = await run('py -3 --version')
  }
  if (results.python.stdout) {
    console.log('Python:', results.python.stdout)
  } else {
    console.log('Python 3 non trouvé. Node-gyp requiert Python 3.')
    console.log('- Installez Python 3 et ajoutez-le au PATH. Vous pouvez aussi configurer npm config set python "C:\\Path\\to\\python.exe".\n')
  }

  // 3) node / npm
  results.node = await run('node -v')
  results.npm = await run('npm -v')
  console.log('Node:', results.node.stdout || `erreur code=${results.node.code}`)
  console.log('npm:', results.npm.stdout || `erreur code=${results.npm.code}`)

  console.log('\nRésumé rapide et actions recommandées :')
  if (!clPath) {
    console.log('- Installez Visual Studio Build Tools (Workload "Desktop development with C++").')
    console.log('- Ensuite : redémarrez la machine, ouvrez PowerShell en administrateur ou le "Developer Command Prompt for VS" et exécutez séparément :')
    console.log('    where.exe cl')
    console.log('    cl.exe /?')
    console.log('    npm ci')
    console.log('    npx electron-rebuild --force --parallel')
  } else if (!results.python.stdout) {
    console.log('- Installez Python 3 (ajoutez au PATH).')
  } else if (!results.node.stdout || !results.npm.stdout) {
    console.log('- Installez Node.js / npm (version compatible avec electron-builder).')
  } else {
    console.log('- Environnement de build principal présent. Si vous avez encore des erreurs, exécutez PowerShell en administrateur et relancez :')
    console.log('  npm ci')
    console.log('  npx electron-rebuild --force --parallel')
    console.log('  npm run build-electron')
  }

  process.exit(0)
}

main().catch(e => {
  console.error('Erreur check-env:', e && e.stack ? e.stack : e)
  process.exit(1)
})
