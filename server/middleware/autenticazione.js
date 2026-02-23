const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Segreto JWT: da variabile d'ambiente (Render) o generato casualmente
const SEGRETO_JWT = process.env.SEGRETO_JWT || crypto.randomBytes(64).toString('hex');

// Lista nera token per logout lato server
const listaNeraToken = new Set();

// Pulizia periodica lista nera (ogni ora)
setInterval(() => {
  const adesso = Math.floor(Date.now() / 1000);
  for (const token of listaNeraToken) {
    try {
      const decodificato = jwt.decode(token);
      if (decodificato && decodificato.exp && decodificato.exp < adesso) {
        listaNeraToken.delete(token);
      }
    } catch { listaNeraToken.delete(token); }
  }
}, 3600000);

function autenticaToken(req, res, next) {
  const intestazioneAuth = req.headers['authorization'];
  const token = intestazioneAuth && intestazioneAuth.split(' ')[1];
  if (!token) return res.status(401).json({ errore: 'Accesso non autorizzato.' });

  if (listaNeraToken.has(token)) {
    return res.status(401).json({ errore: 'Sessione terminata. Effettua nuovamente il login.' });
  }

  jwt.verify(token, SEGRETO_JWT, (err, utente) => {
    if (err) return res.status(403).json({ errore: 'Token non valido o scaduto.' });
    req.utente = utente;
    req.token = token;
    next();
  });
}

function generaToken(datiUtente) {
  return jwt.sign(
    { id: datiUtente.id, email: datiUtente.email, nome_utente: datiUtente.nome_utente, e_team_leader: datiUtente.e_team_leader },
    SEGRETO_JWT,
    { expiresIn: '1d' }
  );
}

function invalidaToken(token) {
  if (token) listaNeraToken.add(token);
}

if (process.env.SEGRETO_JWT) {
  console.log('🔐 JWT: segreto caricato da variabile d\'ambiente');
} else {
  console.log('🔐 JWT: segreto casuale generato (cambierà ad ogni riavvio)');
}

module.exports = { autenticaToken, generaToken, invalidaToken, SEGRETO_JWT };
