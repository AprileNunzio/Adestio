# ADESTIO
**Architettura Dinamica per l'Espansione e lo Sviluppo Tecnologico di Imprese e Organizzazioni**

Benvenuto in **ADESTIO v1.0.0**, un potente *Universal Container* (Piattaforma a Micro-Kernel) progettato per ospitare, gestire e isolare applicazioni aziendali, scolastiche o utility in modo scalabile e sicuro.

## 🚀 La Filosofia: Universal Container
Adestio nasce non come un singolo software, ma come un **Sistema Operativo per Applicazioni Web/Desktop**. Il "Core" dell'applicazione è totalmente agnostico: non contiene logiche di business specifiche per un singolo settore. Il suo compito è unicamente quello di:
1. Gestire la Sicurezza e il controllo degli accessi (RBAC Role-Based Access Control).
2. Fornire uno Store (Marketplace) centralizzato per l'installazione di app terze.
3. Caricare le app in **sandbox isolate**, garantendo che un crash in un'applicazione non comprometta l'intero sistema (Zero-DDoS interno).
4. Risolvere le dipendenze in modo intelligente tramite grafi aciclici (DAG) e versioning semantico (stile npm).

Tutta la logica di business è delegata alle **Applicazioni di Terze Parti** installabili dallo Store.

## 📦 Core Apps vs Third-Party Apps
Adestio viene fornito con un bundle predefinito essenziale, le **Core Apps**:
- **Amministratore:** Gestione di ruoli, permessi, profili e utenti.
- **Impostazioni:** Gestione nodi di rete, connettività P2P, credenziali SMTP e notifiche di sistema.
- **Anagrafica & Gestione Personale:** Applicazioni di livello base per fornire l'anagrafica standardizzata su cui tutte le app HR o gestionali esterne possono interfacciarsi.

Tutte le altre applicazioni (es. *Presa di Servizio*, *Preventivi*, ecc.) sono installabili opzionalmente dal Marketplace Cloud (su GitHub).

## 🛠️ Come sviluppare un'App per ADESTIO

Ogni applicazione deve essere pacchettizzata in una cartella indipendente e caricata come zip sul server di release (o testata in locale nella cartella `userData/installed_apps` / `src/apps`).

### 1. Il `manifest.json`
Ogni app richiede un manifest. Esempio per l'app *Fatturazione*:
```json
{
    "id": "fatturazione",
    "name": "Fatturazione Pro",
    "description": "App per emettere fatture.",
    "version": "1.0.0",
    "main": "app.js",
    "backend": "backend.js",
    "ipc": { "namespace": "fatturazioneIpc" },
    "licensing": { "type": "free" },
    "dependencies": {
        "anagrafica": ">=1.0.0"
    }
}
```

### 2. Dependency Resolver & Sandboxing
Quando lo Store installa la tua app, Adestio verifica le `dependencies`. Se l'app richiede `anagrafica >=1.0.0`, l'installazione procederà solo se il requisito è soddisfatto.
Il caricamento del `backend.js` è interamente protetto da **Try-Catch Block Architetturali**. Se il tuo backend lancia un'eccezione non gestita (es. errore di sintassi), il container bloccherà l'inizializzazione dell'app senza crashare, disabilitandola per salvaguardare il Core. 
Sono supportati i lifecycle hooks come l'export di `onLoad(appLoader, manifest)` e `onUninstall()` nel file `backend.js`.

### 3. Pubblicazione sul Marketplace
Per rendere pubblica l'app, dovrai compilare il manifest e aprire una **Pull Request** verso il repository GitHub ufficiale del Marketplace, modificando il file `marketplace.json` per includere il download link alla tua release.

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

---
*Powered by NunzioTech*
