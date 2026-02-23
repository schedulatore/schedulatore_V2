const inizializzaSqlJs = require('sql.js');
const fs = require('fs');
const percorso = require('path');

const PERCORSO_DB = percorso.join(__dirname, '..', 'schedulatore.db');
let database = null;

/**
 * Wrapper robusto per sql.js con API compatibile better-sqlite3.
 * sql.js = SQLite compilato in WebAssembly → nessuna compilazione C++ necessaria.
 */
class WrapperDatabase {
  constructor(dbSql) {
    this._db = dbSql;
  }

  esegui(sql) {
    this._db.run(sql);
    this._salva();
  }

  pragma(strPragma) {
    try { this._db.run(`PRAGMA ${strPragma}`); } catch (e) { /* ignora pragma non supportati */ }
  }

  prepara(sql) {
    const self = this;
    return {
      // Ottieni una singola riga
      ottieni(...parametri) {
        try {
          const risultati = self._db.exec(sql, self._sanificaParametri(parametri));
          if (!risultati || risultati.length === 0 || risultati[0].values.length === 0) return undefined;
          const colonne = risultati[0].columns;
          const valori = risultati[0].values[0];
          const riga = {};
          colonne.forEach((col, i) => { riga[col] = valori[i]; });
          return riga;
        } catch (e) {
          console.error('Errore DB ottieni:', e.message, '\nSQL:', sql.trim(), '\nParametri:', parametri);
          throw e;
        }
      },

      // Ottieni tutte le righe
      tutti(...parametri) {
        try {
          const risultati = self._db.exec(sql, self._sanificaParametri(parametri));
          if (!risultati || risultati.length === 0) return [];
          const colonne = risultati[0].columns;
          return risultati[0].values.map(valori => {
            const riga = {};
            colonne.forEach((col, i) => { riga[col] = valori[i]; });
            return riga;
          });
        } catch (e) {
          console.error('Errore DB tutti:', e.message, '\nSQL:', sql.trim(), '\nParametri:', parametri);
          throw e;
        }
      },

      // Esegui statement (INSERT/UPDATE/DELETE)
      esegui(...parametri) {
        try {
          self._db.run(sql, self._sanificaParametri(parametri));
          const ultimoId = self._ottieniUltimoId();
          const righeModificate = self._db.getRowsModified();
          self._salva();
          return { righeModificate, ultimoIdInserito: ultimoId };
        } catch (e) {
          console.error('Errore DB esegui:', e.message, '\nSQL:', sql.trim(), '\nParametri:', parametri);
          throw e;
        }
      }
    };
  }

  /** Converte undefined in null per sql.js */
  _sanificaParametri(parametri) {
    if (!parametri || parametri.length === 0) return [];
    return parametri.map(p => (p === undefined ? null : p));
  }

  _ottieniUltimoId() {
    try {
      const r = this._db.exec('SELECT last_insert_rowid() as id');
      return r[0]?.values[0]?.[0] || 0;
    } catch { return 0; }
  }

  _salva() {
    try {
      const dati = this._db.export();
      fs.writeFileSync(PERCORSO_DB, Buffer.from(dati));
    } catch (e) {
      console.error('Errore salvataggio database:', e.message);
    }
  }
}

async function inizializzaDb() {
  if (database) return database;
  const SQL = await inizializzaSqlJs();
  if (fs.existsSync(PERCORSO_DB)) {
    database = new WrapperDatabase(new SQL.Database(fs.readFileSync(PERCORSO_DB)));
  } else {
    database = new WrapperDatabase(new SQL.Database());
  }
  return database;
}

function ottieniDb() {
  if (!database) throw new Error('Database non inizializzato. Chiama prima inizializzaDb().');
  return database;
}

async function inizializzaDatabase() {
  await inizializzaDb();
  database.pragma('foreign_keys = ON');

  const tabelle = [
    `CREATE TABLE IF NOT EXISTS utenti (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      nome_utente TEXT NOT NULL,
      hash_password TEXT NOT NULL,
      e_team_leader INTEGER DEFAULT 0,
      token_reset TEXT,
      scadenza_token_reset TEXT,
      creato_il TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS team (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      nome_sponsor TEXT,
      email_sponsor TEXT,
      nome_leader TEXT,
      email_leader TEXT,
      id_utente_leader INTEGER NOT NULL,
      stakeholder TEXT,
      creato_il TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (id_utente_leader) REFERENCES utenti(id)
    )`,
    `CREATE TABLE IF NOT EXISTS obiettivi (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_utente INTEGER NOT NULL,
      id_team INTEGER,
      nome TEXT NOT NULL,
      note TEXT DEFAULT '',
      data_inizio TEXT NOT NULL,
      ore_totali REAL NOT NULL,
      data_fine_stimata TEXT,
      creato_il TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (id_utente) REFERENCES utenti(id)
    )`,
    `CREATE TABLE IF NOT EXISTS sotto_attivita (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_obiettivo INTEGER NOT NULL,
      nome TEXT NOT NULL,
      ore_totali REAL NOT NULL,
      ore_per_giorno REAL NOT NULL DEFAULT 1,
      giorni_stimati INTEGER,
      data_fine_stimata TEXT,
      email_responsabile TEXT,
      percentuale_completamento INTEGER DEFAULT 0,
      creato_il TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (id_obiettivo) REFERENCES obiettivi(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS collaboratori_attivita (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_sotto_attivita INTEGER NOT NULL,
      email_utente TEXT NOT NULL,
      FOREIGN KEY (id_sotto_attivita) REFERENCES sotto_attivita(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS micro_attivita (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_sotto_attivita INTEGER NOT NULL,
      data TEXT NOT NULL,
      ore REAL NOT NULL,
      etichetta TEXT,
      completata INTEGER DEFAULT 0,
      flag_giornaliero INTEGER DEFAULT 0,
      FOREIGN KEY (id_sotto_attivita) REFERENCES sotto_attivita(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS membri_team (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_team INTEGER NOT NULL,
      email_utente TEXT NOT NULL,
      id_utente INTEGER,
      ruolo TEXT DEFAULT 'membro',
      iscritto INTEGER DEFAULT 0,
      FOREIGN KEY (id_team) REFERENCES team(id) ON DELETE CASCADE
    )`
  ];

  for (const sql of tabelle) {
    database.esegui(sql);
  }

  // Migrazione sicura per DB esistenti
  try { database.esegui('ALTER TABLE team ADD COLUMN email_sponsor TEXT'); } catch(e) {}
  try { database.esegui('ALTER TABLE team ADD COLUMN email_leader TEXT'); } catch(e) {}
  try { database.esegui('ALTER TABLE membri_team ADD COLUMN ruolo TEXT DEFAULT "membro"'); } catch(e) {}
  try { database.esegui('ALTER TABLE sotto_attivita ADD COLUMN percentuale_completamento INTEGER DEFAULT 0'); } catch(e) {}
  try { database.esegui("ALTER TABLE obiettivi ADD COLUMN note TEXT DEFAULT ''"); } catch(e) {}
  try { database.esegui('ALTER TABLE micro_attivita ADD COLUMN flag_giornaliero INTEGER DEFAULT 0'); } catch(e) {}
  try { database.esegui('ALTER TABLE micro_attivita ADD COLUMN completamento_giornaliero INTEGER DEFAULT 0'); } catch(e) {}

  console.log('✅ Database inizializzato con successo.');
}

module.exports = { ottieniDb, inizializzaDb, inizializzaDatabase };
