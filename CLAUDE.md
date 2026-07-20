# CLAUDE.md — ADESTIO Project Context

Questo file è letto automaticamente da Claude Code e da altri AI assistants.
**Leggi sempre il Progress Tracker prima di qualsiasi intervento.**

---

## Progress Tracker

### ✅ Fase 0 — Foundation & Rebrand (completata 2026-07-17)
- `README.md` riscritto per ADESTIO 4.0 Universal Platform
- `CLAUDE.md`, `.cursorrules`, `.github/copilot-instructions.md` creati
- `.gitignore` aggiornato (aggiunto `active_node.json`, `device.key`, pattern `*(1)*`)
- `package.json` versione bumped: `3.0.107` → `4.0.0`
- Git: storia v1–v3 cancellata, branch orfano, force push su `main` e `master`
- Piano architetturale completo definito (6 fasi, ~22 settimane)

### ✅ Fase 1 — Platform Core Extraction (completata 2026-07-17)
I 5 nuovi moduli sono stati creati in `backend/core/`. **Sono additive: il codice v3 esistente continua a funzionare invariato.** Le app esistenti non hanno ancora `backend.js` — il caricamento è silenzioso.

| File | Ruolo |
|---|---|
| `backend/core/PlatformContext.js` | Contratto iniettato in ogni app backend. Espone `getDB()`, `getCoreDB(domain)`, `isLoggedIn()`, `isSuperadmin()`, `hasPermission(permId)`, `emit(channel, data)`, `handler(fn)` |
| `backend/core/AppIpcBridge.js` | Registrazione/deregistrazione dinamica IPC. `register(appId, namespace, handlers, context)` / `deregister(appId)`. Auth check automatico su ogni canale. |
| `backend/core/AppDbManager.js` | Gestisce i DB per-app (`app_<namespace>.enc`). `getOrCreate(namespace, migrations)` / `get(namespace)` / `save(namespace)` |
| `backend/core/DependencyResolver.js` | `resolve(appId, available, installed)` → ordine di install. `canUninstall(appId, installed, available)` → blocca se altri dipendono. `getMissingDeps()` |
| `backend/core/AppLoader.js` | `loadApp(manifest)` / `unloadApp(appId)` / `loadAllInstalledApps()`. Chiamato da `main.js` dopo DB unlock. |
| `main.js` (modifica) | Aggiunto hook: `await appLoader.loadAllInstalledApps()` dopo `rebuildStateFromLog()` |

**IPC per le nuove app:** `app:<namespace>:<entità>:<azione>` — es. `app:anagrafica:persone:getAll`

**Come scrive un backend.js un'app:**
```js
// src/apps/mia_app/backend.js
module.exports = {
    register(context) {
        return {
            'items:getAll': async (ctx, event, payload) => {
                const db = ctx.getDB();
                return { success: true, data: db.query('SELECT * FROM items') };
            },
            'items:create': context.handler(async (ctx, event, payload) => {
                // ctx.handler() wrappa auth check + error handling automaticamente
                const db = ctx.getDB();
                db.run('INSERT INTO items (name) VALUES (?)', [payload.name]);
                return { success: true };
            }),
        };
    }
};
```

**Formato migrations.js di un'app** (identico al formato usato in `backend/migrations/*.js` — NON `up(db)`, ma SQL raw. `SqlJsAdapter.runMigrations()` esegue `m.sql` direttamente):
```js
// src/apps/mia_app/migrations.js
module.exports = [
    { version: 1, sql: `CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY, name TEXT NOT NULL);` }
];
```

### ✅ Fase 2 — App Store Backend (completata 2026-07-17)
| File | Ruolo |
|---|---|
| `backend/migrations/store.js` | Migration v1: `installed_apps`, `app_dependencies`, `app_install_log` |
| `backend/db/db_manager.js` (modifica) | Aggiunto dominio `store` al costruttore e a `unlock()` |
| `backend/db.js` (modifica) | `initEmptyDB()` e `importClonedDB()` caricano anche `store` |
| `backend/core/ipcRouter.js` (modifica) | `recoverDatabase` carica `store`; `dbGetBackupStatus` include `store.enc`; nuovi canali registrati |
| `backend/handlers/store.js` | `getAvailable()`, `getInstalled()`, `install(event, appId)`, `uninstall(event, appId)`, `checkUpdates()` |
| `preload.js` (modifica) | `window.electronAPI.store.{getAvailable,getInstalled,install,uninstall,checkUpdates}` |

**Canali IPC:** `store:getAvailable`, `store:getInstalled`, `store:install`, `store:uninstall`, `store:checkUpdates`.
**Guard:** `install`/`uninstall` richiedono `accessGuard.isSuperadmin()`.
**Uninstall non cancella i dati** — il file `app_<namespace>.enc` resta su disco per permettere reinstallazioni senza perdita (cancellazione dati = azione distruttiva separata, non ancora implementata).
**`DependencyResolver.canUninstall()` si aspetta un array di ID stringa** (o oggetti con `.id`) — le righe `installed_apps` hanno colonna `app_id`, quindi vanno sempre normalizzate con `.map(r => r.app_id)` prima di passarle.

### ✅ Fase 3 — Store UI (completata 2026-07-17, testata live)
| File | Ruolo |
|---|---|
| `src/js/pages/store.js` | Pagina Store: tab Disponibili/Installate, ricerca, card app, modal conferma install/uninstall |
| `src/js/main.js` (modifica) | Import + registrazione pagina `store` in `Pages`, entry in `pageNames`, listener `menu-btn-store` |
| `src/index.html` (modifica) | Voce "App Store" nel dropdown menu (`#menu-btn-store`) |

**Pattern UI seguito:** stesso stile di `dashboard.js`/`amministratore/subapps/utenti` — card glassmorphism, Material Symbols Rounded, CSS var `--md-*`, nessun framework.
**Guard UI:** bottoni Installa/Disinstalla disabilitati (non nascosti) se l'utente non è superadmin, con tooltip esplicativo. Il controllo reale è comunque lato backend (`accessGuard.isSuperadmin()`), la UI è solo cosmetica.
**Modal di conferma:** generico e riusato per install/uninstall (`showConfirmModal()` dentro store.js), mostra le dipendenze dirette dichiarate nel manifest lato client (non la risoluzione ricorsiva, che resta server-side in `DependencyResolver`).

**Test live eseguito** (avvio reale `npm start`, non solo sintassi):
- Boot completo senza errori: DAG rebuild 57/57 blocchi, `AppLoader` "5/5 app caricate", P2P/diagnostics/UDP avviati
- Store UI: tab, ricerca, card renderizzate correttamente per le 5 app v3 esistenti (manifest v1, senza `version`/`category`/`dependencies` — la UI gestisce i fallback correttamente: `v1.0.0` default lato client, `v0.0.0` default lato server per `installed_apps.version`)
- **Install end-to-end verificato**: click → modal conferma → IPC `store:install` → toast successo → badge "Installata" → bottone diventa "Disinstalla". Log: `[AppLoader] App "impostazioni" già caricata.` (nessun doppio-load, corretto)
- **Uninstall end-to-end verificato**: click → modal conferma → IPC `store:uninstall` → toast successo → tab "Installate" torna vuota. Log: `[AppLoader] App "impostazioni" scaricata.`
- Nessun errore in console/log riconducibile alle modifiche Fase 1-3

### ✅ Fase 4 — Migrazione App Esistenti al Nuovo Standard (completata 2026-07-17, testata live)

**Parte 1 — Distinzione core vs marketplace:**
- Aggiunto campo manifest `"core": true` a tutte le 5 app esistenti (anagrafica, amministratore, gestione_personale, impostazioni, presa_di_servizio) — sono app predefinite/bundle, non del marketplace
- Aggiunti anche `version`, `author`, `category`, `tags` (Manifest v2, additivi, nessun campo rimosso)
- `backend/handlers/store.js`: `getAvailable()` ora esclude le app `core:true` (solo terze parti); nuova funzione `getCoreApps()` per le app predefinite; `install()`/`uninstall()` rifiutano esplicitamente qualsiasi app con `core:true`
- Nuovo canale IPC `store:getCoreApps`, esposto in `preload.js`
- `src/js/pages/store.js`: terza tab "Predefinite" — sola lettura, badge "Predefinita", nessun bottone Installa/Disinstalla, solo "Verifica Aggiornamenti" che invoca l'updater generale della piattaforma
- `src/js/pages/dashboard.js`: aggiunta tile fissa "App Store" in cima alla griglia applicazioni, click naviga direttamente a `Router.navigate('store')`

**Parte 2 — Migrazione dati anagrafica in dominio dedicato (rischio reale, eseguita su richiesta esplicita dell'utente — "app in costruzione, procedi con tutto"):**

Le tabelle del dominio personale (`persone`, `documenti_identita`, `indirizzi`, `rapporti_lavoro`, `contatti`, `familiari`, `titoli_studio`, `dati_bancari`) sono condivise da 3 app (anagrafica, gestione_personale, presa_di_servizio: la stessa persona vista come "i miei dati", "vista admin su tutti", "importazione bulk"). Non ha senso frammentarle in 3 DB separati — sono state spostate in un **unico dominio `app_anagrafica.enc`, di proprietà dell'app `anagrafica`**, con `gestione_personale`/`presa_di_servizio` che vi accedono in quanto ne dichiarano la dipendenza nel manifest.

| File | Ruolo |
|---|---|
| `backend/migrations/anagrafica.js` | **Nuovo.** Schema finale delle 8 tabelle (consolidato dalle vecchie migration auth.js v5,6,11-15) |
| `backend/migrations/auth.js` | Aggiunta migration v16: `DROP TABLE` delle 8 tabelle dal dominio auth (i dati non si perdono: vengono ricostruiti nel nuovo dominio via replay del DAG, che resta la fonte di verità) |
| `backend/dag/schema/schema_registry.js` | Aggiunto `TABLE_DOMAINS` + `getDomainForTable(tableName)` — instradamento tabella→dominio, default `'auth'` |
| `backend/dag/application/block_applier.js` | `applyBlock()`/`reapplyToTables()` instradano al dominio corretto invece di hardcoded `'auth'` |
| `backend/dag/application/state_rebuilder.js` | `rebuildFromLog()` itera sui domini effettivamente toccati dai blocchi in log, mark-deleted e save per dominio corretto |
| `backend/dag/application/projector.js` | `drain()`/`_applyOne()` idem, transazione e save sul dominio corretto |
| `backend/db/db_manager.js`, `backend/db.js`, `backend/core/ipcRouter.js` | Dominio `app_anagrafica` caricato in **tutti** i boot path (`unlock()`, `initEmptyDB()`, `importClonedDB()`, `recoverDatabase`) — sempre PRIMA di qualsiasi DAG rebuild |
| 9 handler `backend/handlers/anagrafica_*.js` | `getDB('auth')` → `getDB('app_anagrafica')`. **Eccezione:** `anagrafica_persone.js` mantiene ANCHE `getDB('auth')` (variabile `coreDb`) per 2 query cross-domain sulla tabella `users` (verifica utente attivo collegato al CF). `anagrafica_audit.js` NON toccato (usa solo `ledger`+`users`, mai spostati). `anagrafica_riferimenti.js`: solo `getSuggestions()` cambiata, `getProvince()`/`getNazioni()` restano su dominio `'app'` (dati di riferimento, non personali) |

**Meccanismo di migrazione:** nessuna copia manuale di righe. Il DAG (`ledger.enc`) è la fonte di verità: al boot, `rebuildStateFromLog()` marca `is_deleted=1` su ogni tabella nel dominio corretto poi rigioca TUTTI i blocchi dall'origine; con il routing corretto, i blocchi delle tabelle personali finiscono in `app_anagrafica.enc` invece che in `auth.enc`. Verificato live: **70/70 blocchi riapplicati correttamente**, nessun dato perso.

**Deliberatamente NON fatto in questa fase (decisione motivata, non omissione):**
- **Rename `auth.enc` → `core.enc`**: puramente cosmetico (stesso dominio, stringa diversa), zero valore architetturale, avrebbe richiesto toccare ~15 file aggiuntivi per un rename puro. Rimandato, nessuna dipendenza con il resto.
- **Estrazione `backend.js` per le 5 app esistenti + migrazione a canali IPC `app:<ns>:*` via AppIpcBridge**: le app `core:true` sono SEMPRE caricate e non passano mai da `install()`/`uninstall()` — la registrazione statica in `ipcRouter.js` è funzionalmente equivalente a quella dinamica per app che non vengono mai (dis)installate. Il valore di `backend.js`/`AppIpcBridge` si realizza con vere app di terze parti (Fase 6), non prima.
- **`amministratore` → `src/apps/_core/admin_console`**: riorganizzazione cartelle puramente cosmetica, il flag `core:true` ottiene già la distinzione funzionale necessaria.

**Test live eseguito** (screenshot reali, non solo log):
- Boot pulito, `[StateRebuilder] Completato: 70/70 blocchi applicati`
- Anagrafica → "I Miei Dati": dato pre-esistente reale (persona con CF) letto correttamente dal nuovo dominio
- Scrittura testata: modifica "Stato Civile" → salva → toast successo → navigazione via e ritorno → valore persistito correttamente → ripristinato al valore originale

**⚠️ Nota per sessioni future — cambiamenti esterni rilevati durante il test, non fatti in questa sessione:**
Durante il test live del 2026-07-17 sono stati osservati cambiamenti a `main.js` (nuovo modulo `backend/core/BootManager.js`), `backend/core/AppLoader.js` (logica "Strict Loading": carica solo app `core:true` o presenti in `installed_apps`, più un meccanismo di "auto-seeding" per app `bundled`), e `src/js/pages/store.js` (vista dettaglio app con `showAppDetails()`), oltre alla **rimozione completa** della cartella `src/apps/presa_di_servizio/`. Questi cambiamenti non sono stati fatti da questa sessione di lavoro — sono comparsi tra un test e l'altro, presumibilmente da un'altra sessione/strumento in parallelo. Non ancora documentati qui in dettaglio: se lavori su Store/AppLoader/boot, **leggi prima lo stato attuale dei file**, questo tracker potrebbe essere indietro rispetto a quel sotto-sistema.
Rilevato anche un errore preesistente non legato alla migrazione anagrafica: `dashboard.js:117` — `TypeError: Cannot read properties of undefined (reading 'map')` in "Impossibile recuperare le app installate", verosimilmente legato al nuovo sistema di cache marketplace. Non ancora investigato/corretto.

### ⬜ Fase 5 — Frontend Restyling Universale (da iniziare)
- [ ] Rimuovere tutti i riferimenti scolastici da UI/copy/assets
- [ ] Nuovo OOBE universale (tipo organizzazione selezionabile)
- [ ] Dashboard con launcher tile per le app installate
- [ ] Componente `<AppTile>` per ogni app nello store
- [ ] Tema organizzazione: nome, logo, colore primario personalizzabili

### ⬜ Fase 6 — Remote Marketplace (futuro, fuori scope v4.0)
- [ ] API cloud per distribuzione app di terzi
- [ ] CLI SDK per scaffolding nuove app
- [ ] Sistema di licenze e pricing

---

## Cosa è ADESTIO

ADESTIO (v4.0+) è una **piattaforma modulare desktop** costruita con Electron + Vanilla JS. Funziona come un "app store self-hosted": il core gestisce utenti, RBAC e sincronizzazione P2P, mentre ogni funzionalità aggiuntiva è un'**app indipendente** installabile dallo store interno.

**Non è un software scolastico.** Prima della v4.0 lo era. Ora è universale.

---

## Invarianti non negoziabili

1. **NO framework UI** — Vanilla JS. Mai React, Vue, Angular, Svelte.
2. **NO native SQLite** — solo `sql.js` (WASM). Mai `better-sqlite3` o equivalenti.
3. **NON toccare `backend/dag/` o `backend/p2p/`** — modificali solo se esplicitamente richiesto con smoke test P2P.
4. **Cifratura sempre** — ogni nuovo `.enc` usa `deriveKeyForPurpose(networkCode, namespace)` da `backend/security/network_key_derivation.js`.
5. **Manifest v2 è il contratto** — modifiche allo schema sono breaking change, richiedono bump `minPlatformVersion`.
6. **Nessun commento ovvio** — commenta solo il perché non ovvio, mai il cosa.

---

## Architettura a 4 livelli

```
LIVELLO 3 · MARKETPLACE APPS     → src/apps/<id>/            installabili/rimuovibili
LIVELLO 2 · CORE APPS            → src/apps/_core/<id>/      bundle fisso, non rimuovibili
LIVELLO 1 · PLATFORM CORE        → backend/core/             motori, nessuna UI
LIVELLO 0 · INFRASTRUTTURA       → backend/dag/, backend/p2p/ NON TOCCARE
```

---

## File chiave e loro ruolo

| File | Ruolo |
|---|---|
| `main.js` | Entry point Electron. Boot: lock → DB unlock → DAG rebuild → AppLoader → P2P → window |
| `preload.js` | Context bridge. Espone `window.electronAPI.*` al renderer. |
| `backend/core/ipcRouter.js` | **V3 legacy** — tutti i canali hardcoded. Resta così per le app `core:true` anche dopo la Fase 4 (scelta deliberata, non temporanea — vedi Fase 4). |
| `backend/core/AppIpcBridge.js` | **V4 nuovo** — registrazione IPC dinamica per-app. |
| `backend/core/AppLoader.js` | **V4 nuovo** — carica/scarica app a runtime. |
| `backend/core/AppDbManager.js` | **V4 nuovo** — DB per-app (`app_<ns>.enc`). |
| `backend/core/DependencyResolver.js` | **V4 nuovo** — risolve l'ordine di install/uninstall. |
| `backend/core/PlatformContext.js` | **V4 nuovo** — contratto iniettato in ogni app backend. |
| `backend/handlers/store.js` | **V4 nuovo** — logica install/uninstall/getAvailable/getInstalled/checkUpdates. |
| `backend/migrations/store.js` | **V4 nuovo** — schema `store.enc` (installed_apps, app_dependencies, app_install_log). |
| `backend/migrations/anagrafica.js` | **V4 nuovo (Fase 4)** — schema `app_anagrafica.enc`, le 8 tabelle del dominio personale. |
| `backend/dag/schema/schema_registry.js` | `getDomainForTable(tableName)` — routing tabella→dominio per il DAG. Unico punto da aggiornare per spostare una tabella in un nuovo dominio. |
| `backend/core/appsRegistry.js` | Legge tutti i `manifest.json` da `src/apps/**/`. |
| `backend/core/session_manager.js` | Sessione in-memory `{userId, loginAt}`. No JWT, no persistenza. |
| `backend/db/db_manager.js` | Singleton DB: 4 domini core + domini dinamici per-app. |
| `backend/dag/index.js` | API pubblica DAG: `createBlock`, `applyBlock`, `rebuildState`. |
| `backend/security/network_key_derivation.js` | `deriveKeyForPurpose(networkCode, purpose)` — usa sempre questa per le chiavi. |
| `src/js/main.js` | Bootstrap renderer: router SPA, auth flow. |
| `src/apps/` | Registry delle app. Ogni cartella con `manifest.json` è un'app. |

---

## Database — Struttura domini

| File `.enc` | Contenuto | Note |
|---|---|---|
| `auth.enc` | users, roles, groups, permissions, access_logs, notifications, 2FA | **Nome dominio ancora `auth`, non rinominato a `core`** — vedi nota sotto. Dalla Fase 4 NON contiene più i dati personali (spostati in `app_anagrafica.enc`) |
| `app_anagrafica.enc` | persone, documenti_identita, indirizzi, rapporti_lavoro, contatti, familiari, titoli_studio, dati_bancari | ✅ Attivo dalla Fase 4. Dominio condiviso da 3 app (anagrafica/gestione_personale/presa_di_servizio), di proprietà di `anagrafica`. Caricato in TUTTI i boot path DB (unlock/initEmptyDB/importClonedDB/recoverDatabase), sempre prima del DAG rebuild |
| `store.enc` | installed_apps, app_dependencies, app_install_log | ✅ Attivo dalla Fase 2 |
| `config.enc` | network_config, known_peers, node_registry | Invariato |
| `ledger.enc` | event_log (DAG), dag_tips, node_keys | Invariato — critico per P2P. **Fonte di verità**: ogni dominio dati si ricostruisce da qui via `rebuildStateFromLog()` |
| `app_{namespace}.enc` | Dati propri di ogni marketplace app | Uno per app, gestito da AppDbManager |

**Routing tabella→dominio**: `backend/dag/schema/schema_registry.js#getDomainForTable(tableName)`. Usato da `block_applier.js`, `state_rebuilder.js`, `projector.js` per instradare ogni blocco DAG al DB corretto invece di un dominio hardcoded. Aggiungere una nuova tabella a un nuovo dominio = aggiungerla a `TABLE_DOMAINS` in quel file, null'altro (il resto del routing è generico).

> **Nota**: Il piano originale prevedeva di rinominare `auth.enc` → `core.enc`. Deliberatamente NON fatto (Fase 4): puro rename cosmetico senza valore architetturale, richiederebbe toccare ~15 file per zero beneficio funzionale. Il dominio si chiama tuttora `auth` in tutto il codice — non è un TODO dimenticato, è una scelta di scope esplicita.

Tutti i file in `%APPDATA%\NunzioTech\Adestio\dbs\<activeNode>\`.

---

## IPC — Naming convention

| Prefisso | Uso |
|---|---|
| `platform:auth:*`, `platform:rbac:*` | Core handlers (v4, futuro) |
| `store:*` | ✅ App store backend — `getAvailable`, `getInstalled`, `install`, `uninstall`, `checkUpdates` |
| `app:<namespace>:<entità>:<azione>` | Marketplace app channels (via AppIpcBridge) |
| Canali senza prefisso (es. `loginUser`, `rbac:*`) | **Legacy v3** in `ipcRouter.js` — resta così anche dopo la Fase 4 per le app `core:true` (scelta deliberata) |

---

## Manifest v2 — Schema completo

```jsonc
{
  "id": "mia_app",           // slug unico, immutabile
  "name": "La Mia App",
  "version": "1.0.0",        // semver indipendente dalla piattaforma
  "author": "NunzioTech",
  "description": "...",
  "icon": "icon.png",
  "category": "hr|erp|school|personal|utility",
  "main": "app.js",          // renderer entry point
  "backend": "backend.js",   // IPC handlers (opzionale)
  "dependencies": ["core:users", "altra_app"],
  "db": {
    "namespace": "mia_app",          // → app_mia_app.enc
    "migrations": "./migrations.js"  // array [{ version, up(db) }]
  },
  "ipc": { "namespace": "mia_app" },
  "permissions": [
    { "id": "view", "label": "Visualizza", "default_groups": ["staff"] },
    { "id": "edit", "label": "Modifica" }
  ],
  "minPlatformVersion": "4.0.0",
  "license": "free|paid|freemium",
  "tags": ["hr", "italy"]
}
```

---

## Comandi utili

```bash
npm start              # Avvio in sviluppo
npm run build:local    # Build Windows senza pubblicare
npm run build:publish  # Build + release GitHub (richiede GH_TOKEN)
```

---

## Cosa NON fare

- Non aggiungere pacchetti npm senza valutare impatto su WASM sqlite e packaging
- Non usare `async/await` in top-level IPC handlers senza `try/catch` — il throw lascia la call in pending forever
- Non modificare schema `ledger.enc` senza aggiornare `block_applier.js` e testare DAG rebuild
- Non rinominare canali IPC legacy senza aggiornare renderer + preload + handler in un solo commit
- Non fare `git push --force` su `main` senza coordinazione

---

## Contesto

- **Autore**: Aprile Nunzio / NunzioTech
- **Repository**: https://github.com/AprileNunzio/Adestio
- **Target**: Qualsiasi organizzazione Windows-based, gestionale self-hosted senza server centrali
- **Stack**: Electron 30, Node.js CommonJS, Vanilla JS, sql.js WASM, AES-256-GCM, DAG P2P
