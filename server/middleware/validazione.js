const validatore = require('validator');

/** Sanifica una stringa: rimuove tag HTML/script */
function sanifica(str) {
  if (typeof str !== 'string') return str;
  return validatore.escape(validatore.trim(str));
}

/** Sanifica un oggetto ricorsivamente */
function sanificaOggetto(ogg) {
  if (!ogg || typeof ogg !== 'object') return ogg;
  if (Array.isArray(ogg)) return ogg.map(el => typeof el === 'string' ? sanifica(el) : sanificaOggetto(el));
  const pulito = {};
  for (const [chiave, valore] of Object.entries(ogg)) {
    if (typeof valore === 'string') pulito[chiave] = sanifica(valore);
    else if (typeof valore === 'object' && valore !== null) pulito[chiave] = sanificaOggetto(valore);
    else pulito[chiave] = valore;
  }
  return pulito;
}

/** Middleware globale: sanifica il body di ogni richiesta */
function sanificaBody(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    const password = req.body.password;
    const nuovaPassword = req.body.nuovaPassword;
    req.body = sanificaOggetto(req.body);
    if (password !== undefined) req.body.password = password;
    if (nuovaPassword !== undefined) req.body.nuovaPassword = nuovaPassword;
  }
  next();
}

function emailValida(email) {
  return typeof email === 'string' && validatore.isEmail(email);
}

function nomeUtenteValido(nome) {
  if (typeof nome !== 'string') return false;
  const pulito = validatore.trim(nome);
  return pulito.length >= 2 && pulito.length <= 100 && !/<[^>]*>/g.test(nome);
}

module.exports = { sanifica, sanificaOggetto, sanificaBody, emailValida, nomeUtenteValido };
