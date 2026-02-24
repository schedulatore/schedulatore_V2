const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const percorso = require('path');
const fs = require('fs');
const { inizializzaDatabase } = require('./utilita/database');
const { sanificaBody } = require('./middleware/validazione');

const percorsiAuth = require('./percorsi/autenticazione');
const percorsiObiettivi = require('./percorsi/obiettivi');
const percorsiTeam = require('./percorsi/team');
const percorsiFestivita = require('./percorsi/festivita');

const app = express();
const PORTA = process.env.PORT || 5000;
const HOST_APP = process.env.URL_APP || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000';

// Sicurezza: Header HTTP
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

// Sicurezza: CORS ristretto
const originiPermesse = [HOST_APP, 'http://localhost:3000', 'http://127.0.0.1:3000', 'http://172.16.0.5:3000'];
// Su Render, aggiungi l'URL di produzione
if (process.env.RENDER_EXTERNAL_URL) originiPermesse.push(process.env.RENDER_EXTERNAL_URL);

app.use(cors({
  origin: function (origine, callback) {
    if (!origine) return callback(null, true);
    if (originiPermesse.some(o => origine.startsWith(o))) return callback(null, true);
    console.log(`🚫 [CORS] Origine bloccata: ${origine}`);
    return callback(new Error('Non autorizzato da CORS'), false);
  },
  credentials: true
}));

// Logging
app.use(morgan(':date[iso] :method :url :status :res[content-length] - :response-time ms - :remote-addr'));
const cartellaLog = percorso.join(__dirname, 'logs');
if (!fs.existsSync(cartellaLog)) fs.mkdirSync(cartellaLog, { recursive: true });
const flussoLog = fs.createWriteStream(percorso.join(cartellaLog, 'accesso.log'), { flags: 'a' });
app.use(morgan('combined', { stream: flussoLog }));

// Body parser + Sanificazione
app.use(express.json({ limit: '1mb' }));
app.use(sanificaBody);

// Trust proxy (necessario per Render e rate limiting)
app.set('trust proxy', 1);

// Percorsi API
app.use('/api/auth', percorsiAuth);
app.use('/api/obiettivi', percorsiObiettivi);
app.use('/api/team', percorsiTeam);
app.use('/api/festivita', percorsiFestivita);

// Frontend statico in produzione (Render serve tutto dallo stesso server)
const cartellaClient = percorso.join(__dirname, '..', 'client', 'build');
if (fs.existsSync(cartellaClient)) {
  app.use(express.static(cartellaClient));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(percorso.join(cartellaClient, 'index.html'));
    }
  });
}

// Gestione errori globale
app.use((err, req, res, next) => {
  console.error(`❌ [ERRORE] ${err.message}`);
  if (err.message === 'Non autorizzato da CORS') return res.status(403).json({ errore: 'Accesso non autorizzato.' });
  res.status(500).json({ errore: 'Errore interno del server.' });
});

// Avvio
async function avvia() {
  try {
    await inizializzaDatabase();

    app.listen(PORTA, '0.0.0.0', () => {
      console.log(`\n🚀 Server Schedulatore avviato sulla porta ${PORTA}`);
      console.log(`   URL App: ${HOST_APP}`);
      console.log(`\n🛡️  Sicurezza attiva:`);
      console.log(`   ✓ Helmet (header HTTP sicuri)`);
      console.log(`   ✓ CORS ristretto`);
      console.log(`   ✓ Rate limiting (login: 5/15min, registrazione: 3/30min)`);
      console.log(`   ✓ Input sanificato (anti-XSS)`);
      console.log(`   ✓ Token reset crittografico`);
      console.log(`   ✓ Logging su console + file`);
      console.log(`   ✓ Logout lato server (lista nera token)`);
      console.log(`   ✓ JWT durata 1 giorno\n`);
    });
  } catch (err) {
    console.error('Errore avvio server:', err);
    process.exit(1);
  }
}

avvia();
module.exports = app;
