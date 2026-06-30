<div align="center">

  # Adestio
  **Controllo distribuito. Zero configurazione.**

  ![Version](https://img.shields.io/badge/versione-2.2.0-blue)
  ![Platform](https://img.shields.io/badge/piattaforma-Windows-0078D4?logo=windows)
  ![License](https://img.shields.io/badge/licenza-Proprietaria-red)

</div>

---

Adestio è un sistema di gestione nodi P2P con blockchain DAG integrata, progettato per reti locali aziendali. Si installa, si avvia e si sincronizza automaticamente con tutti gli altri nodi nella rete — senza server centrali, senza configurazioni manuali.

## Caratteristiche

- **Blockchain DAG locale** — ogni modifica ai dati genera un blocco firmato crittograficamente e propagato a tutti i nodi in tempo reale
- **Discovery automatica multi-layer** — UDP broadcast, mDNS/Bonjour e HTTP sweep paralleli per trovare nodi in qualsiasi ambiente di rete
- **Cache peer intelligente** — i nodi vengono ricordati tra i riavvii; al prossimo avvio la connessione è immediata
- **Backoff esponenziale per peer** — i nodi irraggiungibili vengono ritentati con attesa crescente (15s → 5min), senza sprecare risorse
- **Database crittografato AES-256-GCM** — 4 file isolati (`auth.enc`, `config.enc`, `ledger.enc`, `app_data.enc`), nessun dato in chiaro su disco
- **RBAC enterprise** — Super Admin, ruoli personalizzati, revoca accessi istantanea propagata in rete
- **Zero-Config** — nessun server esterno, nessuna dipendenza di rete esterna, funziona offline in LAN

## Requisiti

- Windows 10 / 11 (64-bit)
- Node.js 18+ (solo per sviluppo)

## Avvio Rapido

```bash
git clone https://github.com/AprileNunzio/Adestio.git
cd Adestio
npm install
npm start
```

## Build

```bash
npm run build
```

Genera il pacchetto `.exe` in `dist/`, pronto per la distribuzione.

## Architettura P2P

```
Nodo A                    Nodo B                    Nodo C
  │                          │                          │
  ├─ UDP Broadcast ─────────►│                          │
  │◄─ I_AM_ADESTIO ──────────┤                          │
  │                          │                          │
  ├─ WebSocket /p2p ─────────►                          │
  │   handshake              │                          │
  │   blocks_pull/push       │                          │
  │   pex_exchange ──────────┼─────────────────────────►│
  │                          │                          │
```

La sincronizzazione avviene tramite WebSocket persistenti con protocollo RPC custom. Il PEX (Peer Exchange) permette ai nodi di condividere la lista dei peer noti, garantendo la connettività anche in reti con firewall parziali.

## Struttura del Progetto

```
backend/
├── blockchain.js       # DAG: creazione, validazione, applicazione blocchi
├── sync.js             # Server P2P, discovery UDP/mDNS/HTTP, cache peer
├── sync_engine.js      # Anti-entropy, watchdog, backoff intelligente
├── ws_rpc.js           # Protocollo WebSocket RPC
├── ws_handlers.js      # Handler messaggi P2P in ingresso
├── db.js               # Facade database
└── migrations/         # Schema SQL versioned

src/
├── js/pages/           # UI frontend (Electron renderer)
├── apps/               # Moduli applicativi (RBAC, Impostazioni, ...)
└── ai/                 # AI manager
```

---

<div align="center">
  <sub>NunzioTech — Pensato in modo diverso.</sub>
</div>
