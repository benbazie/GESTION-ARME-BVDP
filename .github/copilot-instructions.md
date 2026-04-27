**Architecture & Runtime**
- Electron entry `main.js` loads `.env` from multiple fallback paths and auto-starts `server.start()` unless `STARTED_BY_NPM_SERVER=true`.
- `main.js` registers the `app://` protocol and resolves hashed Vite bundles inside `dist/assets`, so packaged assets must retain their hashed filenames to be served correctly.
- `preload.js` exposes `window.electronAPI`, forwards CLI `--api-base-url` args, mirrors every REST helper listed in `TABLES`, and keeps JWT tokens synchronized via IPC plus localStorage.
- React lives under `src/` and is served by Vite; packaged runs load `dist/index.html` while dev mode targets `VITE_DEV_SERVER_URL`/`ELECTRON_START_URL` (defaults to `http://localhost:5173`).

**Backend API & Routing**
- `server.js` hydrates PostgreSQL through `hydrateDbModule`, exports `{ app, start }`, and auto-registers `/api/<table>` CRUD routes (soft-delete aware) for every entry in `TABLES`.
- Drop a router file in `routes/<table>.js` to override generation; the bootstrapper skips matching files and honours `DISABLED_ROUTE_FILES` plus `customTableRouters` for manual wiring.
- `routePermissions` stem from `makePermissionNames` with per-table overrides (`dotations`, `sources_armes`, audit dashboards), and every route chains `authMW` → `permissionGuard`.
- Generic handlers embed table tweaks (`armes` join `config_arme`, `utilisateurs` merge roles, `buildCascadeFilters` handles geo scoping, `FORCE_HARD_DELETE_TABLES` skips soft deletes on geo tables).
- Import/export relies on `EXPORT_TABLES` and `IMPORT_ORDER`; update these lists and their `controllers/*.js` counterparts whenever you add a table that participates in migrations.

**Database & Migrations**
- `database/database.js` selects the PostgreSQL client and enforces a PG-only runtime.
- Use helpers like `ensureColumn`, `ensureGeoColumns`, `ensureCoordinationHierarchyColumns`, `installGeoCascadeTrigger`, and `addTouchTrigger` instead of raw `ALTER TABLE` statements.
- Default permissions live in `DEFAULT_ROLES`; `ensureDefaultRoles()` and `ensureAdminRoleBinding()` seed them at boot, so extend those blocks plus `permsFor()` when introducing new rights.
- Geo/audit cascades (`installGeoCascadeTrigger`, stock touch triggers, `grantAllPermissionsToRole`) reside in the same module—update them when new tables require geo propagation or sync flags.
- Le seeding utilisateur par script dédié a été retiré; utilisez les migrations/seed PostgreSQL.

**Frontend Conventions**
- `src/App.jsx` uses `lazyWithFallback` for every dashboard page and nests them under `/dashboard` guarded by `RequireAuth`; keep new screens lazy to avoid bloating the initial bundle.
- `AuthContext` (`src/contexts/AuthContext.jsx`) prefers `window.electronAPI` implementations of `login/me/logout`, falls back to `api.js`, and always calls `setToken` so axios headers stay current.
- `src/api.js` derives the API base URL from query params, localStorage, trusted tunnels, or `.env`, strips trailing slashes, and auto-builds helpers like `api.getArmesList`/`api.createArme` to match backend table names.
- Renderer components should reuse `api`/`electronAPI` helpers (never call `fetch` directly) so auth headers, Electron bridging, and tunneling logic stay consistent.
- Dashboard/dotation helpers exposed in `preload.js` (`getDotationsWithDetails`, `getDashboardArmesByType`, etc.) should be reused before adding new IPC wiring.

**Auth & Permissions**
- JWT validation lives in `utils/authMiddleware.js` (`JWT_SECRET`, `JWT_EXPIRES_IN`), and every new endpoint must wrap with `authMW` and the appropriate `permissionGuard` requirement.
- Permissions accept strings or arrays; when adding tables or routes, update `routePermissions`, extend `DEFAULT_ROLES`, and pass `req.user`/`currentUser` through controllers for audit logging (`controllers/auditLogController.js`).
- Soft delete is the default (`deleted_at IS NULL`); use `?includeDeleted=true` to opt in, `?hard=true` for permanent removal, and note that `FORCE_HARD_DELETE_TABLES` enforces hard deletes for provinces/communes/localites.
- Audit logging expects a non-null `utilisateur_id`, so propagate the authenticated user in write paths to keep `auditLogController.add` and cascade triggers functioning.

**Dev Workflow & Debug**
- `npm run server` serves the API only, `npm run dev` starts the Vite UI, and `npm run start:electron` runs both via `STARTED_BY_NPM_SERVER`; production builds use `npm run dist` (build → verify-root → copy env/db/utils → electron-builder).
- Run `npm run check-env` (`scripts/check-env.js`) before packaging to ensure required env vars exist.
- Set `DEBUG_AUTH=true` to log auth headers, call `listRoutes()` (bottom of `server.js`) to inspect mounted endpoints.
- Helper scripts under `scripts/` (`build-portable*.js`, `inspect-db.js`, `verifyDotations.js`) are already wired into release flows—extend them instead of introducing ad-hoc tooling.
