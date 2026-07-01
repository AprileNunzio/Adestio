# Adestio
<div align="center">
  <img src="loading.webp" alt="Adestio Logo" width="200" />
</div>

**Adestio** è una piattaforma decentralizzata (P2P), strutturata con un'architettura enterprise a **Micro-Servizi**. Sviluppato da **NunzioTech**, Adestio combina la potenza di Electron, Node.js e un network P2P per offrire una sincronizzazione DLT (Distributed Ledger Technology) senza l'ausilio di server centrali.

## ✨ Caratteristiche Architetturali
- **Micro-Servizi Indipendenti**: Il backend è completamente disaccoppiato. Ogni componente (Gestore Finestra, Router IPC, Auto-Updater, Gestore File) opera in modo autonomo e sicuro.
- **Fault Isolation (Isolamento Guasti)**: Tutti i micro-servizi sono incapsulati in blocchi `try-catch`. Il blocco di una funzione non causerà mai il crash dell'intero nodo.
- **Sincronizzazione P2P e Ledger DLT**: I dati sono sincronizzati tra i nodi LAN in modo automatico.
- **Auto-Aggiornamento Ibrido e Invisibile**: Adestio si aggiorna autonomamente prelevando le release tramite **GitHub** o direttamente dai **Nodi P2P in LAN**, in modalità completamente "Silent" (`/S`), proteggendo i tuoi dati senza interruzioni.
- **Controllo Accessi (RBAC)**: Supporto completo per Ruoli e Permessi granulari.
- **Branding Aziendale**: Tutti i file di installazione, i database locali e le cache applicative sono rigorosamente archiviati e strutturati sotto il percorso certificato aziendale `NunzioTech`.

## 🚀 Requisiti e Installazione
Il software è progettato esclusivamente per sistemi **Windows (x64)**. 

### Sviluppo Locale
1. Clona la repository.
2. Esegui `npm install`.
3. Avvia in modalità sviluppatore con `npm start`.

### Compilazione e Pubblicazione Automatica
Per creare una build pronta per la produzione e pubblicarla automaticamente come Release su GitHub:
```bash
npm run build:publish
```
*Richiede l'impostazione della variabile di ambiente `GH_TOKEN` con i permessi di scrittura sul repository.*

---
<div align="center">
  <sub>Copyright © 2026 NunzioTech. Tutti i diritti riservati. Pensato in modo diverso.</sub>
</div>
