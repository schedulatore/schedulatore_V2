const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const limitaRichieste = require('express-rate-limit');
const { ottieniDb } = require('../utilita/database');
const { generaToken, autenticaToken, invalidaToken } = require('../middleware/autenticazione');
const { emailValida, nomeUtenteValido } = require('../middleware/validazione');

const percorso = express.Router();

// Limitatore login: max 5 tentativi ogni 15 minuti
const limitatoreLogin = limitaRichieste({
  windowMs: 15 * 60 * 1000, max: 5,
  message: { errore: 'Troppi tentativi di accesso. Riprova tra 15 minuti.' },
  standardHeaders: true, legacyHeaders: false
});

// Limitatore registrazione: max 3 ogni 30 minuti
const limitatoreRegistrazione = limitaRichieste({
  windowMs: 30 * 60 * 1000, max: 3,
  message: { errore: 'Troppe registrazioni. Riprova più tardi.' },
  standardHeaders: true, legacyHeaders: false
});

// Limitatore reset password: max 3 ogni 30 minuti
const limitatoreReset = limitaRichieste({
  windowMs: 30 * 60 * 1000, max: 3,
  message: { errore: 'Troppe richieste di reset. Riprova più tardi.' },
  standardHeaders: true, legacyHeaders: false
});

// POST /api/auth/registrazione
percorso.post('/registrazione', limitatoreRegistrazione, async (req, res) => {
  try {
    const { email, nome_utente, password, e_team_leader } = req.body;

    if (!email || !nome_utente || !password) {
      return res.status(400).json({ errore: 'Email, nome utente e password sono obbligatori.' });
    }
    if (!emailValida(email)) return res.status(400).json({ errore: 'Formato email non valido.' });
    if (!nomeUtenteValido(nome_utente)) return res.status(400).json({ errore: 'Nome utente non valido (2-100 caratteri).' });
    if (password.length < 6 || password.length > 128) return res.status(400).json({ errore: 'La password deve avere tra 6 e 128 caratteri.' });

    const db = ottieniDb();
    const esistente = await db.prepara('SELECT id FROM utenti WHERE email = ?').ottieni(email);
    if (esistente) return res.status(409).json({ errore: 'Email già registrata.' });

    const hashPassword = await bcrypt.hash(password, 12);
    await db.prepara('INSERT INTO utenti (email, nome_utente, hash_password, e_team_leader) VALUES (?, ?, ?, ?)')
      .esegui(email, nome_utente, hashPassword, e_team_leader ? 1 : 0);

    const utente = await db.prepara('SELECT * FROM utenti WHERE email = ?').ottieni(email);
    if (!utente) return res.status(500).json({ errore: 'Errore nella creazione utente.' });

    await db.prepara('UPDATE membri_team SET id_utente = ?, iscritto = 1 WHERE email_utente = ? AND id_utente IS NULL')
      .esegui(utente.id, email);

    const token = generaToken(utente);
    console.log(`🔒 [AUTH] Registrazione: ${email} da IP ${req.ip}`);

    res.status(201).json({
      messaggio: 'Registrazione completata.',
      token,
      utente: { id: utente.id, email: utente.email, nome_utente: utente.nome_utente, e_team_leader: utente.e_team_leader }
    });
  } catch (err) {
    console.error('Errore registrazione:', err);
    res.status(500).json({ errore: 'Errore del server.' });
  }
});

// POST /api/auth/login
percorso.post('/login', limitatoreLogin, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ errore: 'Email e password sono obbligatori.' });

    const db = ottieniDb();
    const utente = await db.prepara('SELECT * FROM utenti WHERE email = ?').ottieni(email);

    if (!utente) {
      console.log(`⚠️  [AUTH] Login fallito (email inesistente): ${email} da IP ${req.ip}`);
      return res.status(401).json({ errore: 'Credenziali non valide.' });
    }

    const passwordValida = await bcrypt.compare(password, utente.hash_password);
    if (!passwordValida) {
      console.log(`⚠️  [AUTH] Login fallito (password errata): ${email} da IP ${req.ip}`);
      return res.status(401).json({ errore: 'Credenziali non valide.' });
    }

    const token = generaToken(utente);
    console.log(`✅ [AUTH] Login: ${email} da IP ${req.ip}`);

    res.json({
      messaggio: 'Login effettuato.',
      token,
      utente: { id: utente.id, email: utente.email, nome_utente: utente.nome_utente, e_team_leader: utente.e_team_leader }
    });
  } catch (err) {
    console.error('Errore login:', err);
    res.status(500).json({ errore: 'Errore del server.' });
  }
});

// POST /api/auth/logout
percorso.post('/logout', autenticaToken, async (req, res) => {
  invalidaToken(req.token);
  console.log(`🚪 [AUTH] Logout: ${req.utente.email} da IP ${req.ip}`);
  res.json({ messaggio: 'Logout effettuato.' });
});

// POST /api/auth/password-dimenticata
percorso.post('/password-dimenticata', limitatoreReset, async (req, res) => {
  try {
    const { email } = req.body;
    const db = ottieniDb();
    const utente = await db.prepara('SELECT * FROM utenti WHERE email = ?').ottieni(email);

    if (!utente) {
      console.log(`⚠️  [AUTH] Reset per email inesistente: ${email} da IP ${req.ip}`);
      return res.json({ messaggio: 'Se l\'email esiste, riceverai un codice di recupero.' });
    }

    const tokenReset = crypto.randomBytes(32).toString('hex').substring(0, 8).toUpperCase();
    const scadenza = new Date(Date.now() + 3600000).toISOString();
    await db.prepara('UPDATE utenti SET token_reset = ?, scadenza_token_reset = ? WHERE id = ?')
      .esegui(tokenReset, scadenza, utente.id);

    console.log(`🔒 [AUTH] Reset password richiesto: ${email} — Codice: ${tokenReset} (scade tra 1h)`);
    res.json({ messaggio: 'Richiesta inviata. Contatta l\'amministratore per ricevere il codice di reset.' });
  } catch (err) {
    console.error('Errore recupero password:', err);
    res.status(500).json({ errore: 'Errore del server.' });
  }
});

// POST /api/auth/reimposta-password
percorso.post('/reimposta-password', limitatoreReset, async (req, res) => {
  try {
    const { email, token, nuovaPassword } = req.body;
    if (!email || !token || !nuovaPassword) return res.status(400).json({ errore: 'Tutti i campi sono obbligatori.' });
    if (nuovaPassword.length < 6) return res.status(400).json({ errore: 'La password deve avere almeno 6 caratteri.' });

    const db = ottieniDb();
    const utente = await db.prepara('SELECT * FROM utenti WHERE email = ? AND token_reset = ?').ottieni(email, token.toUpperCase());

    if (!utente || !utente.scadenza_token_reset || new Date(utente.scadenza_token_reset) < new Date()) {
      console.log(`⚠️  [AUTH] Reset fallito (token non valido): ${email} da IP ${req.ip}`);
      return res.status(400).json({ errore: 'Codice non valido o scaduto.' });
    }

    const hashPassword = await bcrypt.hash(nuovaPassword, 12);
    await db.prepara('UPDATE utenti SET hash_password = ?, token_reset = NULL, scadenza_token_reset = NULL WHERE id = ?')
      .esegui(hashPassword, utente.id);

    console.log(`✅ [AUTH] Password reimpostata: ${email} da IP ${req.ip}`);
    res.json({ messaggio: 'Password reimpostata con successo.' });
  } catch (err) {
    console.error('Errore reset password:', err);
    res.status(500).json({ errore: 'Errore del server.' });
  }
});

// GET /api/auth/profilo
percorso.get('/profilo', autenticaToken, async (req, res) => {
  const db = ottieniDb();
  const utente = await db.prepara('SELECT id, email, nome_utente, e_team_leader FROM utenti WHERE id = ?').ottieni(req.utente.id);
  if (!utente) return res.status(404).json({ errore: 'Utente non trovato.' });
  res.json({ utente });
});

// GET /api/auth/admin/reset-pendenti — codici reset attivi (solo admin/primo utente)
percorso.get('/admin/reset-pendenti', autenticaToken, async (req, res) => {
  try {
    const db = ottieniDb();
    // Solo il primo utente registrato (id=1) può vedere i codici
    if (req.utente.id !== 1) return res.status(403).json({ errore: 'Solo l\'amministratore può accedere.' });
    const pendenti = await db.prepara(`
      SELECT email, nome_utente, token_reset, scadenza_token_reset 
      FROM utenti WHERE token_reset IS NOT NULL AND scadenza_token_reset > ?
    `).tutti(new Date().toISOString());
    res.json({ pendenti });
  } catch (err) { res.status(500).json({ errore: 'Errore del server.' }); }
});

// POST /api/auth/admin/reset-forzato — admin resetta la password direttamente
percorso.post('/admin/reset-forzato', autenticaToken, async (req, res) => {
  try {
    const db = ottieniDb();
    if (req.utente.id !== 1) return res.status(403).json({ errore: 'Solo l\'amministratore può accedere.' });
    const { email, nuovaPassword } = req.body;
    if (!email || !nuovaPassword) return res.status(400).json({ errore: 'Email e nuova password obbligatori.' });
    const utente = await db.prepara('SELECT id FROM utenti WHERE email = ?').ottieni(email);
    if (!utente) return res.status(404).json({ errore: 'Utente non trovato.' });
    const hash = await bcrypt.hash(nuovaPassword, 12);
    await db.prepara('UPDATE utenti SET hash_password = ?, token_reset = NULL, scadenza_token_reset = NULL WHERE id = ?').esegui(hash, utente.id);
    console.log(`✅ [ADMIN] Reset forzato password per ${email}`);
    res.json({ messaggio: `Password reimpostata per ${email}.` });
  } catch (err) { res.status(500).json({ errore: 'Errore del server.' }); }
});

module.exports = percorso;
