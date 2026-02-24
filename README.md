# Schedulatore - Pianificatore Personale e di Team

Applicazione web completa per la pianificazione di macro-obiettivi con sotto-attività, calcolo automatico date/ore, gestione conflitti, coordinamento team, e sicurezza integrata.

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
│   ├── avvio.js                    
│   ├── percorsi/
│   │   ├── autenticazione.js       
│   │   ├── obiettivi.js           
│   │   ├── team.js                 
│   │   └── festivita.js            
│   ├── middleware/
│   │   ├── autenticazione.js       
│   │   └── validazione.js          
│   └── utilita/
│       ├── database.js            
│       ├── schedulatore.js         
│       └── email.js                
│
├── client/
│   ├── src/
│   │   ├── App.jsx                 
│   │   ├── principale.jsx          
│   │   ├── componenti/             
│   │   ├── pagine/                 
│   │   ├── utilita/               
│   │   └── stili/                 
│   └── vite.config.js
│
├── render.yaml                     
├── build.sh                        
└── README.md

