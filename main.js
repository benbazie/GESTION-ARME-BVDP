'use strict'

const fs = require('fs')
const path = require('path')
const { app, BrowserWindow, ipcMain, Menu, dialog, protocol } = require('electron')
const fetch = require('node-fetch')



let mainWindow = null

// Empêche plusieurs instances (et donc plusieurs serveurs API locaux concurrents)
// Garde-fou: certains scripts/outils peuvent charger main.js hors Electron.
if (app && typeof app.requestSingleInstanceLock === 'function') {
  const gotSingleInstanceLock = app.requestSingleInstanceLock();
  if (!gotSingleInstanceLock) {
    app.quit();
  } else {
    app.on('second-instance', () => {
      try {
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.focus();
        }
      } catch (_) {}
    });
  }
}

// Charger automatiquement .env depuis plusieurs emplacements possibles
const dotenv = require('dotenv');

function loadDotEnvIfPresent() {
  const envCandidates = [
    path.join(__dirname, '.env'),
    path.join(__dirname, '..', '.env'),
    path.resolve(process.cwd(), '.env'),
    path.join(path.dirname(process.execPath || ''), '.env'),
    path.join(process.resourcesPath || '', '.env'),
    path.join(process.resourcesPath || '', 'dist', '.env'),
    path.join(process.resourcesPath || '', 'app.asar.unpacked', '.env'),
  ].filter(Boolean);

  const envLocalCandidates = [
    path.join(__dirname, '.env.local'),
    path.join(__dirname, '..', '.env.local'),
    path.resolve(process.cwd(), '.env.local'),
    path.join(path.dirname(process.execPath || ''), '.env.local'),
    path.join(process.resourcesPath || '', '.env.local'),
    path.join(process.resourcesPath || '', 'dist', '.env.local'),
    path.join(process.resourcesPath || '', 'app.asar.unpacked', '.env.local'),
  ].filter(Boolean);

  let loaded = false;

  // 1) Charge .env (sans override)
  for (const candidate of envCandidates) {
    try {
      if (fs.existsSync(candidate)) {
        dotenv.config({ path: candidate });
        console.log('[main] .env chargé depuis :', candidate);
        loaded = true;
        break;
      }
    } catch (_) {}
  }

  // 2) Charge .env.local (avec override) pour écraser .env
  for (const candidate of envLocalCandidates) {
    try {
      if (fs.existsSync(candidate)) {
        dotenv.config({ path: candidate, override: true });
        console.log('[main] .env.local chargé depuis :', candidate);
        loaded = true;
        break;
      }
    } catch (_) {}
  }

  if (!loaded) {
    console.warn('[main] Aucun fichier .env/.env.local trouvé dans les emplacements attendus.');
  }

  return loaded;
}

// Charger .env avant toute configuration dépendante des vars d'environnement
loadDotEnvIfPresent();


const STARTED_BY_EXTERNAL = process.env.STARTED_BY_NPM_SERVER === 'true';

// Déclare serverStarted AVANT tout usage (évite TDZ)
let server = null;
let serverStarted = false;
let localServerHandle = null;
let isQuitting = false;
try {
  const mod = require(path.join(__dirname, 'server.js'));
  server = mod && mod.default ? mod.default : mod;
  if (!server || typeof server.start !== 'function') {
    console.warn('[main] server.js chargé mais sans export start : démarrage automatique indisponible.');
  }
} catch (err) {
  console.warn('[main] server.js non trouvé ou erreur au require (mode sans serveur local).', err && err.message);
  server = null;
}

console.log('📂 main __dirname =', __dirname)
try { console.log('📂 Contenu du dossier main (__dirname) :', fs.readdirSync(__dirname)) } catch (e) { /* ignore */ }

let API_BASE_URL = ''
let AUTH_TOKEN = null // runtime token côté main

async function callBackend(method, route, body = null, token = null) {
  if (!route.startsWith('/')) route = '/' + route
  if (!API_BASE_URL) {
    throw Object.assign(new Error('API_BASE_URL non configurée'), { status: 500 })
  }
  const urlBase = API_BASE_URL.replace(/\/$/, '')
  let url = urlBase + route

  const headers = { 'Content-Type': 'application/json' }
  const effectiveToken = token || AUTH_TOKEN
  if (effectiveToken) {
    headers.Authorization = effectiveToken.startsWith('Bearer ') ? effectiveToken : `Bearer ${effectiveToken}`
  }

  const opts = { method: method.toUpperCase(), headers }
  if (opts.method === 'GET' && body && typeof body === 'object') {
    const qs = new URLSearchParams(Object.entries(body).filter(([, v]) => v != null && v !== '')).toString()
    if (qs) url += '?' + qs
  } else if (body != null && opts.method !== 'GET') {
    opts.body = JSON.stringify(body)
  }

  console.log(`[callBackend] ${opts.method} ${url}`, body || '')
  const res = await fetch(url, opts)
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`)
    err.status = res.status
    try { err.payload = await res.json() } catch (e) {}
    if (err.status === 401) {
      console.warn('[callBackend] 401 — token invalide')
    }
    throw err
  }
  return res.json()
}

async function canReachApi(port, timeoutMs = 1500) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api`, { method: 'GET', signal: controller.signal });
    return [200, 301, 302, 401, 403, 404].includes(res.status);
  } catch (err) {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function ensureApiReady(port) {
  if (await canReachApi(port)) return;
  console.warn(`[main] API locale injoignable sur 127.0.0.1:${port}, tentative de démarrage intégré.`);
  await startLocalServerIfNeeded(port, { force: true });
  if (!(await canReachApi(port))) {
    throw new Error(`API toujours indisponible sur 127.0.0.1:${port}`);
  }
}

async function startLocalServerIfNeeded(port, options = {}) {
  const { force = false } = options;
  if (serverStarted) return;
  if (!force && STARTED_BY_EXTERNAL) return;
  if (!server || typeof server.start !== 'function') {
    console.log('[main] Aucun server.js chargé — pas de démarrage local automatique.');
    return;
  }
  try {
    console.log(`[main] Tentative de démarrage du serveur local sur le port ${port} ...`);
    // On passe un objet pour éviter toute ambiguïté de signature.
    localServerHandle = await server.start({ port: Number(port) });
    serverStarted = true;
    console.log('[main] Serveur local démarré.');
  } catch (err) {
    // Si le port est déjà utilisé, on ne force pas un quit immédiat:
    // l'API peut déjà tourner (ex: instance précédente) et ensureApiReady validera.
    if (err && (err.code === 'EADDRINUSE' || /EADDRINUSE/i.test(String(err.message || '')))) {
      console.warn(`[main] Port ${port} déjà utilisé (EADDRINUSE). Tentative d'utiliser l'API existante.`);
      serverStarted = false;
      localServerHandle = null;
      return;
    }
    serverStarted = false;
    localServerHandle = null;
    console.error('[main] Échec du démarrage du serveur local :', err && err.stack || err);
    throw err;
  }
}

if (app && typeof app.on === 'function') {
  // Arrêt propre du serveur API embarqué pour éviter les process fantômes.
  app.on('before-quit', (event) => {
    if (isQuitting) return;
    if (STARTED_BY_EXTERNAL) return;
    if (!localServerHandle || typeof localServerHandle.close !== 'function') return;

    event.preventDefault();
    isQuitting = true;
    try {
      localServerHandle.close(() => {
        localServerHandle = null;
        serverStarted = false;
        app.quit();
      });
    } catch (err) {
      localServerHandle = null;
      serverStarted = false;
      app.quit();
    }
  });

  app.on('window-all-closed', () => {
    // Sur Windows/Linux, on quitte complètement.
    if (process.platform !== 'darwin') app.quit();
  });
}

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { secure: true, standard: true } }
]);

const resolveDistRoots = () => {
  const roots = new Set();
  const tryAdd = (candidate) => {
    if (!candidate) return;
    try {
      if (fs.existsSync(candidate)) roots.add(candidate);
    } catch (_) {}
  };
  tryAdd(path.join(__dirname, 'dist'));
  tryAdd(path.join(process.resourcesPath || '', 'dist'));
  tryAdd(path.join(process.resourcesPath || '', 'app.asar.unpacked', 'dist'));
  tryAdd(path.join(process.resourcesPath || '', 'app.asar', 'dist'));
  return Array.from(roots);
};

const findHashedVariant = (roots, relativePath) => {
  const match = relativePath.match(/^assets\/([^/]+?)-[A-Za-z0-9_]+\.(css|js|mjs|map)$/i);
  if (!match) return null;
  const [, baseName, ext] = match;
  for (const root of roots) {
    const assetsDir = path.join(root, 'assets');
    try {
      const files = fs.readdirSync(assetsDir);
      const candidate = files.find((file) => file.startsWith(`${baseName}-`) && file.endsWith(`.${ext}`));
      if (candidate) return path.join('assets', candidate);
    } catch (_) {
      continue;
    }
  }
  return null;
};

const registerAppProtocol = () => {
  const distRoots = resolveDistRoots();

  const tryResolve = (root, relPath) => {
    if (!root || !relPath) return null;
    const candidate = path.normalize(path.join(root, relPath));
    if (!candidate.startsWith(root)) return null;
    if (fs.existsSync(candidate)) return candidate;
    const jsVariant = `${candidate}.js`;
    if (fs.existsSync(jsVariant)) return jsVariant;
    return null;
  };

  const findLooseMatch = (roots, relativePath) => {
    const fileName = path.basename(relativePath);
    const ext = path.extname(fileName);
    const stem = fileName.slice(0, -ext.length).toLowerCase();
    const target = fileName.toLowerCase();
    for (const root of roots) {
      const assetsDir = path.join(root, 'assets');
      let files;
      try { files = fs.readdirSync(assetsDir); } catch (_) { continue; }
      const exact = files.find((f) => f.toLowerCase() === target);
      if (exact) return path.join('assets', exact);
      const loose = files.find((f) => f.toLowerCase().startsWith(stem) && f.toLowerCase().endsWith(ext.toLowerCase()));
      if (loose) return path.join('assets', loose);
    }
    return null;
  };

  const resolveAsset = (relativePath) => {
    if (!relativePath) return null;
    for (const root of distRoots) {
      const direct = tryResolve(root, relativePath);
      if (direct) return direct;
      if (!relativePath.startsWith('assets/')) {
        const assetVariant = tryResolve(root, path.join('assets', relativePath));
        if (assetVariant) return assetVariant;
      }
    }
    const hashed = findHashedVariant(distRoots, relativePath);
    if (hashed) {
      for (const root of distRoots) {
        const hashedPath = tryResolve(root, hashed);
        if (hashedPath) return hashedPath;
      }
    }
    const loose = findLooseMatch(distRoots, relativePath);
    if (loose) {
      for (const root of distRoots) {
        const loosePath = tryResolve(root, loose);
        if (loosePath) return loosePath;
      }
    }
    return null;
  };

  protocol.registerFileProtocol('app', (request, callback) => {
    let rawPath = request.url.replace(/^app:\/\//, '');
    rawPath = decodeURIComponent(rawPath);
    if (!rawPath || rawPath === '' || rawPath === '/' || rawPath === 'index.html/') {
      rawPath = 'index.html';
    } else if (rawPath.startsWith('index.html/')) {
      rawPath = rawPath.slice('index.html/'.length);
    }

    let resolvedPath = null;
    if (rawPath === 'index.html') {
      for (const root of distRoots) {
        const candidate = tryResolve(root, 'index.html');
        if (candidate) {
          resolvedPath = candidate;
          break;
        }
      }
    } else {
      resolvedPath = resolveAsset(rawPath);
    }

    if (!resolvedPath && rawPath.endsWith('.css')) {
      for (const root of distRoots) {
        const cssFallback =
          tryResolve(root, 'assets/index.css') ||
          tryResolve(root, 'index.css');
        if (cssFallback) {
          console.warn(`[app-protocol] CSS fallback pour ${rawPath} → ${cssFallback}`);
          resolvedPath = cssFallback;
          break;
        }
      }
    }

    if (!resolvedPath) {
      console.warn('[app-protocol] Fichier introuvable pour', request.url, '(resolved:', rawPath, ')');
      return callback({ error: -6 });
    }

    callback({ path: resolvedPath });
  });
};

async function createWindow() {
  try {
    const port = process.env.API_PORT || 3001

    if (!STARTED_BY_EXTERNAL) {
      try {
        await startLocalServerIfNeeded(port);
        API_BASE_URL = `http://127.0.0.1:${port}/api`;
        await ensureApiReady(port);
      } catch (e) {
        console.error('[main] Impossible de démarrer le serveur:', e.message)
        app.quit()
        return
      }
    } else {
      API_BASE_URL = `http://127.0.0.1:${port}/api`;
      serverStarted = true;
      try {
        await ensureApiReady(port);
      } catch (e) {
        console.warn('[main] API externe indisponible, démarrage intégré de secours.');
        try {
          await startLocalServerIfNeeded(port, { force: true });
          await ensureApiReady(port);
        } catch (err) {
          console.error('[main] Échec du secours API :', err.message);
          app.quit();
          return;
        }
      }
    }

    const indexCandidates = [];
    const pushCandidate = (candidate) => {
      if (candidate && !indexCandidates.includes(candidate)) indexCandidates.push(candidate);
    };
    pushCandidate(path.join(__dirname, 'dist', 'index.html'));
    resolveDistRoots().forEach((root) => pushCandidate(path.join(root, 'index.html')));
    const distIndexPath = indexCandidates.find((candidate) => {
      try { return fs.existsSync(candidate); } catch (_) { return false; }
    });
    const devServerURLRaw =
      process.env.ELECTRON_START_URL ||
      process.env.VITE_DEV_SERVER_URL ||
      process.env.VITE_DEV_SERVER ||
      (process.env.NODE_ENV !== 'production' ? 'http://localhost:5173' : null);
    const devServerURL = devServerURLRaw ? `${devServerURLRaw.replace(/\/+$/, '')}/` : null;

    mainWindow = new BrowserWindow({
      width: 1280,
      height: 800,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        additionalArguments: [`--api-base-url=${API_BASE_URL}`],
        devTools: process.env.NODE_ENV !== "production",
      },
      autoHideMenuBar: process.env.NODE_ENV === "production",
    })

    try {
      mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
        callback({
          responseHeaders: {
            ...details.responseHeaders,
            'Content-Security-Policy': [
              "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://*.tile.openstreetmap.org https://*.openstreetmap.org; connect-src 'self' http://localhost:3001 http://localhost:3001/api http://127.0.0.1:3001 http://127.0.0.1:3001/api;"
            ]
          }
        })
      })
    } catch (e) { /* ignore */ }

    if (distIndexPath) {
      if (app.isPackaged) {
        await mainWindow.loadURL('app://index.html');
      } else {
        await mainWindow.loadFile(distIndexPath);
      }
    } else if (devServerURL) {
      console.warn('[main] dist/index.html introuvable, ouverture du serveur Vite:', devServerURL);
      await mainWindow.loadURL(devServerURL);
    } else {
      const url = `http://localhost:${port}/`
      console.warn('[main] dist/index.html introuvable, fallback vers', url)
      try {
        await mainWindow.loadURL(url)
      } catch (e) {
        console.error('[main.createWindow] échec chargement URL fallback :', e && e.message)
        app.quit()
        return
      }
    }

  } catch (err) {
    console.error('[main.createWindow] erreur :', err && err.stack || err)
    app.quit()
  }
}

// window controls
ipcMain.handle('app-quit',     () => app.quit())
ipcMain.handle('app-minimize', () => mainWindow && mainWindow.minimize())
ipcMain.handle('app-maximize', () => mainWindow && (mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize()))

// auth wrappers
ipcMain.handle('login', async (_e, arg1, arg2) => {
  let username, password
  if (typeof arg1 === 'object' && arg2 == null) {
    username = arg1.username; password = arg1.password
  } else {
    username = arg1; password = arg2
  }
  if (!username || !password) throw Object.assign(new Error('Identifiant et mot de passe requis'), { status: 400 })
  return callBackend('post', '/auth/login', { username, password })
})

ipcMain.handle('me', async (_e, _p, token = null) => {
  try { return await callBackend('get', '/auth/me', null, token) }
  catch (err) { if (err.status === 401) return null; throw err }
})

ipcMain.handle('logout', async (_e, _p, token = null) => {
  try { await callBackend('post', '/auth/logout', null, token) } catch (e) {}
  return { ok: true }
})

ipcMain.handle('set-token', async (_e, token) => {
  AUTH_TOKEN = token && token.startsWith('Bearer ') ? token : (token ? `Bearer ${token}` : null)
  console.log('[main] AUTH_TOKEN mis à jour:', AUTH_TOKEN ? '***' : 'null')
  return { ok: true }
})

ipcMain.handle('getAuthById', async (_event, id = 'me', token = null) => {
  const route = id && id !== 'me' ? `/auth/${id}` : '/auth/me';
  try { return await callBackend('get', route, null, token); }
  catch (err) {
    if (err?.status === 401) return null;
    if (err?.status === 404 && route !== '/auth/me') return null;
    throw err;
  }
});

ipcMain.handle('createAuth', async (_event, credentials = {}, token = null) => {
  return callBackend('post', '/auth/login', credentials, token);
});

ipcMain.handle('changePassword', async (_event, data = {}, token = null) =>
  callBackend('post', '/auth/change-password', data, token)
);

// ---------------------------
// TABLES canonical list (keep names matching your server routes)
// ---------------------------
const TABLES = [
  'regions','provinces','communes','localites',
  'entites','sous_entites','coordinations',
  'coordination_regionale','coordination_provinciale','coordination_communale','localite_coordination',
  'types_arme','categories_arme','modeles_arme',
  'conditions_techniques','provenance_tactique',
  'config_armes','config_optiques','config_materiels','config_munitions',
  'config_arme','config_optique','config_materiel','config_munition',
  'armes','optiques','materiels_specifiques','munitions',
  'lots','sources_dotation','transactions_munitions','mouvements_munitions','alertes_munitions',
  'dotations','dotation_history','chain_of_custody','consommation_munitions',
  'utilisateurs','user_roles','roles','notifications','app_config','sessions',
  'audit_logs','sync_logs','vdp'
];

// helpers for name conversion
function toPascal(s) {
  return s.split(/[-_]/g).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')
}
function toSingularPascal(s) {
  const p = toPascal(s)
  return p.endsWith('s') ? p.slice(0, -1) : p
}
function normalizeSeparators(s) {
  return s.replace(/[-_]/g, '_')
}

// create canonical handlers for each TABLE
const registeredHandlers = new Set();

const registerHandler = (channel, handler) => {
  if (registeredHandlers.has(channel)) {
    ipcMain.removeHandler?.(channel);
  }
  ipcMain.handle(channel, handler);
  registeredHandlers.add(channel);
};

const registerMany = (names, handler) => {
  Array.from(new Set(names)).forEach((name) => registerHandler(name, handler));
};

TABLES.forEach((table) => {
  const Pas = toPascal(table);
  const S = toSingularPascal(table);
  const baseRoute = `/${table}`;

  const listHandler = async (_event, params = {}, token = null) => {
    try { return await callBackend('get', baseRoute, params, token); }
    catch (err) { console.error(`[ipc:${baseRoute}:list]`, err && err.stack || err); throw err; }
  };
  registerMany([`get${Pas}List`, `get${S}List`, `get${Pas}`, `get${S}`], listHandler);

  const byIdHandler = async (_event, id, token = null) => {
    try {
      if (id == null) throw Object.assign(new Error('ID requis'), { status: 400 });
      return await callBackend('get', `${baseRoute}/${id}`, null, token);
    } catch (err) {
      console.error(`[ipc:${baseRoute}:byId]`, err && err.stack || err);
      throw err;
    }
  };
  registerMany([`get${Pas}ById`, `get${S}ById`], byIdHandler);

  const createHandler = async (_event, data = {}, token = null) => {
    try { return await callBackend('post', baseRoute, data, token); }
    catch (err) { console.error(`[ipc:${baseRoute}:create]`, err && err.stack || err); throw err; }
  };
  registerMany([`create${Pas}`, `create${S}`, `add${Pas}`, `add${S}`], createHandler);

  const updateHandler = async (_event, data = {}, token = null) => {
    try {
      const id = data && (data.id || data._id);
      if (!id) throw Object.assign(new Error('ID requis pour update'), { status: 400 });
      return await callBackend('put', `${baseRoute}/${id}`, data, token);
    } catch (err) {
      console.error(`[ipc:${baseRoute}:update]`, err && err.stack || err);
      throw err;
    }
  };
  registerMany([`update${Pas}`, `update${S}`], updateHandler);

  const deleteHandler = async (_event, id, token = null) => {
    try {
      if (id == null) throw Object.assign(new Error('ID requis pour delete'), { status: 400 });
      return await callBackend('delete', `${baseRoute}/${id}`, null, token);
    } catch (err) {
      console.error(`[ipc:${baseRoute}:delete]`, err && err.stack || err);
      throw err;
    }
  };
  registerMany([`delete${Pas}`, `delete${S}`], deleteHandler);
});

console.log(
  "[main.js] Handlers IPC enregistrés :",
  Array.from(registeredHandlers).filter((k) => k.toLowerCase().includes("coordination"))
);

// ---- DASHBOARD handlers (map unchanged) ----
const DASHBOARD_MAP = {
  'dashboard:vdp':                 '/dashboard/vdp',
  'dashboard:armes':               '/dashboard/armes',
  'dashboard:munitionsSummary':    '/dashboard/munitions/summary',
  'dashboard:materielSummary':     '/dashboard/materiel/summary',
  'dashboard:dotations':           '/dashboard/dotations',
  'dashboard:armesByType':         '/dashboard/armes/by-type',
  'dashboard:armesByCategory':     '/dashboard/armes/by-category',
  'dashboard:armesByStatus':       '/dashboard/armes/by-status',
  'dashboard:armesTimeseries':     '/dashboard/armes/timeseries',
  'dashboard:munitionsByType':     '/dashboard/munitions/by-type',
  'dashboard:munitionsTimeseries': '/dashboard/munitions/timeseries',
  'dashboard:materielByType':      '/dashboard/materiel/by-type',
  'dashboard:materielTimeseries':  '/dashboard/materiel/timeseries',
  'dashboard:dotationsByResource': '/dashboard/dotations/by-resource',
  'dashboard:dotationsTimeseries': '/dashboard/dotations/timeseries',
  'dashboard:vdpByGender':         '/dashboard/vdp/by-gender',
  'dashboard:vdpByAgeGroup':       '/dashboard/vdp/by-age-group',
  'dashboard:vdpByEntity':         '/dashboard/vdp/by-entity'
}

Object.entries(DASHBOARD_MAP).forEach(([channel, route]) => {
  if (!ipcMain.listeners(channel).length) {
    ipcMain.handle(channel, async (_event, params = null, token = null) => {
      try { return await callBackend('get', route, params, token) }
      catch (err) { console.error(`[ipc:${channel}]`, err && err.stack || err); throw err }
    })
  }
})

const buildAppMenu = () => {
  const template = [
    {
      label: 'Application',
      submenu: [
        { role: 'about', label: 'À propos' },
        { type: 'separator' },
        { role: 'quit', label: 'Quitter' },
      ],
    },
    {
      label: 'Navigation',
      submenu: [
        {
          label: 'Tableau de bord',
          click: () => mainWindow?.webContents?.send('app:navigate', '/dashboard'),
        },
        { type: 'separator' },
        { role: 'reload', label: 'Recharger' },
        { role: 'toggleDevTools', label: 'Outils de développement' },
      ],
    },
    {
      label: 'Aide',
      submenu: [
        {
          label: 'Contacter le concepteur',
          click: () => {
            const parent = BrowserWindow.getFocusedWindow() || mainWindow;
            dialog.showMessageBox(parent, {
              type: 'info',
              title: 'Assistance',
              message:
                'Pour recevoir de l’aide, contactez BAZIE BENOIT au 66033228 ou par e-mail à benbazi@live.fr.',
            });
          },
        },
        { type: 'separator' },
        { label: 'Téléphone aide : 66033228', enabled: false },
        { label: 'E-mail : benbazi@live.fr', enabled: false },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
};

app.whenReady().then(async () => {
  try {
    // configureDataPaths(); (supprimé, fonction absente)
    registerAppProtocol();
    buildAppMenu();
    await createWindow()
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
  } catch (err) {
    console.error('[main] Erreur lors de l\'initialisation de l\'application:', err);
    app.quit();
  }
});

