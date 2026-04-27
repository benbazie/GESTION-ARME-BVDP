'use strict';

process.env.DEBUG_SQL = process.env.DEBUG_SQL || 'false';
process.env.DEBUG_AUTH = process.env.DEBUG_AUTH || 'false';

const { app } = require('../server');

function listRoutes() {
  const routes = [];
  const router = app && (app._router || app.router);
  const stack = router && Array.isArray(router.stack) ? router.stack : [];
  for (const layer of stack) {
    if (layer.route && layer.route.path) {
      const methods = Object.keys(layer.route.methods || {}).filter(Boolean).join(',');
      routes.push({ path: layer.route.path, methods });
    }
  }
  routes.sort((a, b) => a.path.localeCompare(b.path));
  return routes;
}

console.log('app keys:', Object.keys(app || {}).slice(0, 40));
console.log('router keys:', Object.keys((app && (app._router || app.router)) || {}));

const routes = listRoutes();
console.log('Total routes:', routes.length);

const needles = ['/api/regions', '/api/entites', '/api/sous_entites'];
for (const needle of needles) {
  const hits = routes.filter(r => r.path === needle);
  console.log('\n', needle, '->', hits.length ? hits : '(absent)');
}

// dump a small sample around /api/regions for sanity
const idx = routes.findIndex(r => r.path === '/api/regions');
if (idx >= 0) {
  console.log('\nSample around /api/regions:');
  console.log(routes.slice(Math.max(0, idx - 5), idx + 6));
}

// Inspecte la stack d'un handler
try {
  const router = app && (app._router || app.router);
  const stack = router && Array.isArray(router.stack) ? router.stack : [];
  const regionLayer = stack.find(l => l.route && l.route.path === '/api/regions' && l.route.methods && l.route.methods.get);
  if (regionLayer && regionLayer.route && Array.isArray(regionLayer.route.stack)) {
    console.log('\nGET /api/regions middleware stack:');
    console.log(
      regionLayer.route.stack.map((s, i) => ({
        i,
        name: (s && s.handle && s.handle.name) || '<anonymous>',
      }))
    );
  }
} catch (e) {
  console.warn('Unable to inspect route stack:', e && e.message);
}
