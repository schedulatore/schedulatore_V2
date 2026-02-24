# Schedulatore - Pianificatore Personale e di Team

Applicazione web completa per la pianificazione di macro-obiettivi con sotto-attività, calcolo automatico date/ore, gestione conflitti, coordinamento team, e sicurezza integrata.

## Deploy su Render.com (Gratuito + HTTPS)

### Passo 1: Crea un account GitHub
Se non ce l'hai, registrati su https://github.com

### Passo 2: Carica il progetto su GitHub
```bash
cd schedulatore-app
git init
git add .
git commit -m "Schedulatore v1.0"
git remote add origin https://github.com/TUO-UTENTE/schedulatore.git
git push -u origin main
```

### Passo 3: Crea account Render
1. Vai su https://render.com e registrati con GitHub
2. Clicca **"New" → "Web Service"**
3. Connetti il tuo repository GitHub `schedulatore`
4. Render rileverà automaticamente il file `render.yaml`

### Passo 4: Configura le variabili d'ambiente
Nella dashboard Render, vai su **Environment** e aggiungi:

| Variabile | Valore |
|-----------|--------|
| `SEGRETO_JWT` | (generato automaticamente) |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_UTENTE` | `tuo.account@gmail.com` |
| `SMTP_PASSWORD` | `la-tua-app-password` |

### Passo 5: Deploy!
Clicca **"Create Web Service"**. In 2-3 minuti l'app sarà online con:
- URL tipo `https://schedulatore.onrender.com`
- HTTPS automatico (SSL gratuito di Let's Encrypt)
- Riavvio automatico se il server va in crash

### Per Gmail: crea una App Password
1. Vai su https://myaccount.google.com/apppasswords
2. Genera una nuova password per "Posta"
3. Usa quella password come `SMTP_PASSWORD`

## Sviluppo Locale

```bash
cd schedulatore-app/server && npm install && npm start
# In un secondo terminale:
cd schedulatore-app/client && npm install && npm run dev
```

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
│       └── email.js                # Nodemailer (Gmail/Ethereal)
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
