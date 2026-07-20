# GitHub Copilot Instructions — ADESTIO

## Current project state (read this first)

ADESTIO v4.0 is a modular self-hosted desktop platform (Electron + Vanilla JS).
**Always check the Progress Tracker before making changes.**

### ✅ Done
- **Phase 0** (2026-07-17): Full rebrand to ADESTIO 4.0 Universal Platform. README, CLAUDE.md, .cursorrules, .gitignore rewritten. Version 4.0.0. Git history reset.
- **Phase 1** (2026-07-17): Platform Core built — 5 new modules added to `backend/core/`:
  - `PlatformContext.js` — contract injected into every app backend
  - `AppIpcBridge.js` — dynamic IPC channel registration per app
  - `AppDbManager.js` — per-app encrypted database management
  - `DependencyResolver.js` — dependency resolution for install/uninstall
  - `AppLoader.js` — runtime app load/unload, hooked into `main.js` after DB unlock

- **Phase 2** (2026-07-17): App Store Backend done.
  - `backend/migrations/store.js` — `installed_apps`, `app_dependencies`, `app_install_log`
  - `store` domain wired into `db_manager.unlock()`, `initEmptyDB()`, `importClonedDB()`, `recoverDatabase`
  - `backend/handlers/store.js` — `getAvailable()`, `getInstalled()`, `install(event, appId)`, `uninstall(event, appId)`, `checkUpdates()`. install/uninstall require `accessGuard.isSuperadmin()`.
  - IPC channels `store:*` registered in `ipcRouter.js`, exposed as `window.electronAPI.store.*` in `preload.js`
  - Uninstall does NOT delete `app_<namespace>.enc` — data preserved for reinstall

- **Phase 3** (2026-07-17): Store UI done and LIVE-TESTED (real `npm start`, not just syntax check):
  - `src/js/pages/store.js` — Available/Installed tabs, search, cards, confirm modal for install/uninstall
  - Registered in `src/js/main.js` (Pages, pageNames, menu listener) and menu entry in `src/index.html`
  - Live test: clean boot (DAG 57/57 blocks, AppLoader "5/5 app caricate"), install/uninstall verified end-to-end via screenshots, no errors in log

- **Phase 4** (2026-07-17): COMPLETE, LIVE-TESTED including real writes to pre-existing data:
  - Part 1 (core vs marketplace): all 5 apps have `"core": true` in manifest; store.js backend/frontend distinguish core from third-party; pinned "App Store" tile in dashboard
  - Part 2 (anagrafica data moved to dedicated domain, done on explicit user request — "app under construction, proceed with everything"): `persone` + 7 related tables moved from `auth.enc` to **new domain `app_anagrafica.enc`** (shared by anagrafica/gestione_personale/presa_di_servizio, owned by anagrafica — these 3 apps operate on the same person records, splitting into 3 DBs would just mean duplicated data)
    - New `backend/migrations/anagrafica.js`; `auth.js` v16 drops the 8 tables
    - `backend/dag/schema/schema_registry.js#getDomainForTable(tableName)` — table→domain routing, used by `block_applier.js`/`state_rebuilder.js`/`projector.js` instead of hardcoded `'auth'`
    - New domain loaded in ALL DB boot paths (unlock/initEmptyDB/importClonedDB/recoverDatabase), always BEFORE any DAG rebuild
    - 9 `anagrafica_*.js` handlers updated (`anagrafica_persone.js` keeps a SECOND `coreDb = getDB('auth')` handle for 2 cross-domain reads on the `users` table)
    - Migration mechanism: NOT manual row copying — the DAG (`ledger.enc`) is the source of truth; `rebuildStateFromLog()` replays every block through the corrected routing. Verified live: 70/70 blocks re-applied cleanly, no data loss
  - **Deliberately NOT done** (reasoned scope decision, not an oversight): `auth.enc`→`core.enc` rename (purely cosmetic, ~15 files touched for zero architectural benefit), `backend.js`/AppIpcBridge extraction for the 5 core apps (pointless while they're always-loaded and never go through install/uninstall — static `ipcRouter.js` wiring is functionally equivalent until real third-party apps exist), `amministratore` → `src/apps/_core/` (the `core:true` flag already achieves the needed distinction)

### ⚠️ External changes observed during testing (not authored in this session)
During the 2026-07-17 live test, changes appeared in `main.js` (new `backend/core/BootManager.js`), `backend/core/AppLoader.js` ("Strict Loading" — only loads `core:true` or `installed_apps` apps, plus auto-seeding for `bundled` apps), and `src/js/pages/store.js` (new detail view via `showAppDetails()`) — and `src/apps/presa_di_servizio/` was **completely removed**. These were not made by this working session; they appeared between test runs, presumably from a parallel session/tool. Not documented in detail here — read the current file state before assuming this tracker is accurate for that subsystem.
Known pre-existing bug, not investigated: `dashboard.js:117` — `TypeError` on `.map()` of `undefined` in "Impossibile recuperare le app installate", likely tied to the new marketplace cache feature.

### ⬜ Pending
- Phase 5: Universal frontend restyling

---

## Hard rules — never violate

1. **Vanilla JS only.** No React, Vue, Angular, Svelte, or any UI framework.
2. **sql.js (WASM) only.** Never `better-sqlite3`, `node-sqlite3`, or any native SQLite.
3. **Do not touch `backend/dag/` or `backend/p2p/`** without explicit request + P2P regression test.
4. **Every new `.enc` file uses** `deriveKeyForPurpose(networkCode, namespace)` from `backend/security/network_key_derivation.js`.
5. **Manifest v2 schema is the contract.** Changes are breaking — bump `minPlatformVersion`.

---

## Architecture (4 layers)

```
Layer 3 · MARKETPLACE APPS     → src/apps/<id>/              installable/removable
Layer 2 · CORE APPS            → src/apps/_core/<id>/        fixed bundle
Layer 1 · PLATFORM CORE        → backend/core/               no UI, engines only
Layer 0 · INFRASTRUCTURE       → backend/dag/, backend/p2p/  DO NOT TOUCH
```

---

## IPC naming

| Pattern | Use |
|---|---|
| `app:<namespace>:<entity>:<action>` | New v4 marketplace apps |
| `store:*` | ✅ Active: getAvailable, getInstalled, install, uninstall, checkUpdates |
| `platform:*` | Future core platform channels |
| No prefix (`loginUser`, `rbac:*`, etc.) | Legacy v3 in `ipcRouter.js` — stays this way even after Phase 4 for the 5 core apps (deliberate choice) |

## Migration file format (apps AND store)

Migrations always use raw SQL, never `up(db)` functions — `SqlJsAdapter.runMigrations()` executes `m.sql` via `db.exec()`:
```js
module.exports = [
    { version: 1, sql: `CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY, name TEXT);` }
];
```

---

## Writing app backends

```js
// src/apps/<id>/backend.js
module.exports = {
    register(context) {
        return {
            // manual auth + error handling:
            'items:getAll': async (ctx, event, payload) => {
                if (!ctx.isLoggedIn()) return { success: false, error: 'Unauthorized' };
                try {
                    return { success: true, data: ctx.getDB().query('SELECT * FROM items') };
                } catch(e) {
                    return { success: false, error: e.message };
                }
            },
            // or use ctx.handler() which wraps auth + try/catch automatically:
            'items:create': context.handler(async (ctx, event, payload) => {
                ctx.getDB().run('INSERT INTO items (name) VALUES (?)', [payload.name]);
                return { success: true };
            }),
        };
    }
};
```

---

## Database domains

| File | Contents | Status |
|---|---|---|
| `auth.enc` | users, roles, groups, permissions, access_logs, 2FA | Active — domain still named `auth`, rename to `core` deliberately deferred (see Phase 4 notes, not an oversight). No longer holds personal data since Phase 4 |
| `app_anagrafica.enc` | persone, documenti_identita, indirizzi, rapporti_lavoro, contatti, familiari, titoli_studio, dati_bancari | ✅ Active since Phase 4. Shared by anagrafica/gestione_personale/presa_di_servizio, owned by anagrafica. Loaded in ALL DB boot paths before any DAG rebuild |
| `store.enc` | installed_apps, app_dependencies, app_install_log | ✅ Active since Phase 2 |
| `config.enc` | network config, peers | Do not touch |
| `ledger.enc` | DAG blocks — P2P sync | Do not touch. **Source of truth**: every data domain is reconstructed from here via `rebuildStateFromLog()` |
| `app_{namespace}.enc` | Per-app data, one file per installed app | Managed by AppDbManager |

**Table→domain routing**: `backend/dag/schema/schema_registry.js#getDomainForTable(tableName)`. Used by `block_applier.js`, `state_rebuilder.js`, `projector.js` to route each DAG block to the right DB instead of a hardcoded domain. To add a table to a new domain, add it to `TABLE_DOMAINS` in that one file — the rest of the routing is generic.

---

## Key new files (Phase 1)

| File | Export |
|---|---|
| `backend/core/PlatformContext.js` | class PlatformContext — `getDB()`, `getCoreDB(domain)`, `isLoggedIn()`, `isSuperadmin()`, `hasPermission(permId)`, `emit(channel, data)`, `handler(fn)` |
| `backend/core/AppIpcBridge.js` | `register(appId, ns, handlers, ctx)`, `deregister(appId)`, `getRegistered()` |
| `backend/core/AppDbManager.js` | `getOrCreate(ns, migrations)`, `get(ns)`, `save(ns)` |
| `backend/core/AppLoader.js` | `loadApp(manifest)`, `unloadApp(appId)`, `loadAllInstalledApps()` |
| `backend/core/DependencyResolver.js` | `resolve(appId, available, installed)`, `canUninstall(appId, installed, available)`, `getMissingDeps()` |

---

## Comments policy
Do not comment what the code does. Only comment WHY — hidden constraints, workarounds, non-obvious invariants.
