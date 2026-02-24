
## Sicurezza

L'applicazione include 8 livelli di sicurezza:
1. JWT con segreto crittografico forte
2. Rate limiting su login, registrazione e reset password
3. Token di reset password crittografico
4. Header HTTP sicuri (Helmet)
5. CORS ristretto
6. Sanificazione input anti-XSS
7. Logging di sicurezza su file
8. Logout lato server con lista nera token

## Struttura Progetto

```
schedulatore-app/
├── server/
│   ├── avvio.js                    # Entry point server
│   ├── percorsi/
│   │   ├── autenticazione.js       # Login, registrazione, recupero
│   │   ├── obiettivi.js            # CRUD obiettivi e sotto-attività
│   │   ├── team.js                 # CRUD team
│   │   └── festivita.js            # Festività italiane
│   ├── middleware/
│   │   ├── autenticazione.js       # JWT + lista nera token
│   │   └── validazione.js          # Sanificazione input
│   └── utilita/
│       ├── database.js             # SQLite via sql.js
│       ├── schedulatore.js         # Calcoli date e micro-attività
│       └── email.js                
│
├── client/
│   ├── src/
│   │   ├── App.jsx                 # Router principale
│   │   ├── principale.jsx          # Entry point React
│   │   ├── componenti/             # Layout, Modale
│   │   ├── pagine/                 # Tutte le pagine
│   │   ├── utilita/                # API client
│   │   └── stili/                  # CSS design system
│   └── vite.config.js
│
├── render.yaml                     # Configurazione Render.com
├── build.sh                        # Script di build
└── README.md
```
