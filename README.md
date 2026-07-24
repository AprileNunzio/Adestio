# ADESTIO
**Architettura Dinamica per l'Espansione e lo Sviluppo Tecnologico di Imprese e Organizzazioni**

Benvenuto in **ADESTIO**, un *Universal Container* (piattaforma a micro-kernel, Electron) progettato per ospitare, gestire e aggiornare applicazioni aziendali in modo scalabile e sicuro — con lo stesso ragionamento di un vero app store (Microsoft Store / Play Store): controllo accessi, aggiornamenti in background senza bloccare l'interfaccia, coda di installazione con lock per-app.

## 🚀 La Filosofia: Universal Container
Adestio nasce non come un singolo software, ma come un **sistema operativo per applicazioni desktop**. Il "Core" è agnostico rispetto al business: si occupa solo di
1. Sicurezza e controllo degli accessi (RBAC).
2. Store (Marketplace) centralizzato per installare/aggiornare app di terze parti, con coda di aggiornamento in background e lock per evitare di aprire un'app a metà aggiornamento (vedi `backend/core/AppUpdateManager.js`).
3. Sincronizzazione P2P/blockchain tra i nodi di una stessa rete.
4. Un'unica fonte di stile per le card delle applicazioni (`src/css/utilities.css`: `.app-card`/`.apps-grid`), così ogni schermata (Dashboard, Store, i launcher dei moduli) è visivamente coerente.

Tutta la logica di business specifica di settore è delegata alle **applicazioni di terze parti** installabili dallo Store.

## 📦 Core Apps vs Third-Party Apps
Adestio viene fornito con un bundle predefinito essenziale, le **Core Apps** (vivono in `src/apps/`, caricate sempre, IPC cablata staticamente in `backend/core/ipcRouter.js`):
- **Amministratore:** ruoli, permessi, profili, utenti, dati azienda.
- **Impostazioni:** nodi di rete, connettività P2P, credenziali SMTP, notifiche di sistema.
- **Anagrafica & Gestione Personale:** anagrafica standardizzata su cui le app HR/gestionali esterne si appoggiano.

**Tutte le altre applicazioni sono di terze parti** e vivono in un repository separato, [`Adestio-Marketplace`](https://github.com/AprileNunzio/Adestio-Marketplace) — **mai** dentro `src/apps/` di questo repository. Vengono installate dallo Store, caricate a runtime dalla cartella `userData/installed_apps/<id>`, ed eseguono il proprio `backend.js` nel processo main tramite un ponte dedicato (`capabilityBroker`) che non richiede alcuna modifica al codice core di Adestio.

**Prima di scrivere una nuova app**, leggi la guida completa: [`Adestio-Marketplace/COME_CREARE_UNA_APP_PERFETTA.md`](../Adestio-Marketplace/COME_CREARE_UNA_APP_PERFETTA.md) — copre manifest, database isolato, il ponte IPC verso il frontend, generazione documenti, packaging e pubblicazione.

## ⚙️ Installazione e Sviluppo (Adestio Core)

Per clonare e lavorare al contenitore core:
```bash
git clone https://github.com/AprileNunzio/Adestio.git
cd Adestio
npm install
npm start
```

Per compilare una release distribuibile e pubblicarla:
```bash
# Richiede GH_TOKEN impostato nelle variabili d'ambiente
npm run build:publish
```

## 🔒 Sicurezza e file da non committare mai
`.gitignore` esclude già `.env`, chiavi (`*.key`), database locali cifrati (`*.enc`), log e cartelle di build/scratch — non aggirarlo mai per "comodità": qualsiasi credenziale (SMTP, FTP, token GitHub) va sempre e solo in `.env` locale, mai in codice o commit.

---
*Powered by NunzioTech*
