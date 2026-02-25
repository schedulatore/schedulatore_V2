/**
 * Database — Turso (cloud permanente) + fallback sql.js (locale)
 * 
 * Turso: dati nel cloud, mai persi anche se Render si riavvia
 * Tutte le operazioni sono ASYNC (await db.prepara().ottieni())
 */

const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

let database = null;

// ============ WRAPPER TURSO ============
class WrapperTurso {
  constructor(client) {
    this._client = client;
  }

  async esegui(sql) {
    await this._client.execute(sql);
  }

  async pragma(strPragma) {
    try { await this._client.execute(`PRAGMA ${strPragma}`); } catch (e) {}
  }

  prepara(sql) {
    const client = this._client;
    return {
      async ottieni(...parametri) {
        try {
          const args = parametri.map(p => p === undefined ? null : p);
          const ris = await client.execute({ sql, args });
          if (!ris.rows || ris.rows.length === 0) return undefined;
          const obj = {};
          for (const col of ris.columns) { obj[col] = ris.rows[0][col]; }
          return obj;
        } catch (e) { console.error('Errore DB ottieni:', e.message, '\nSQL:', sql.trim()); throw e; }
      },

      async tutti(...parametri) {
        try {
          const args = parametri.map(p => p === undefined ? null : p);
          const ris = await client.execute({ sql, args });
          if (!ris.rows || ris.rows.length === 0) return [];
          return ris.rows.map(riga => {
            const obj = {};
            for (const col of ris.columns) { obj[col] = riga[col]; }
            return obj;
          });
        } catch (e) { console.error('Errore DB tutti:', e.message, '\nSQL:', sql.trim()); throw e; }
      },

      async esegui(...parametri) {
        try {
          const args = parametri.map(p => p === undefined ? null : p);
          const ris = await client.execute({ sql, args });
          return {
            righeModificate: ris.rowsAffected || 0,
            ultimoIdInserito: Number(ris.lastInsertRowid) || 0
          };
        } catch (e) { console.error('Errore DB esegui:', e.message, '\nSQL:', sql.trim()); throw e; }
      }
    };
  }
}

// ============ WRAPPER SQL.JS (locale) ============
class WrapperSqlJs {
  constructor(dbSql) {
    this._db = dbSql;
    this._percorso = require('path').join(__dirname, '..', 'schedulatore.db');
  }

  esegui(sql) {
    this._db.run(sql);
    this._salva();
  }

  pragma(strPragma) {
    try { this._db.run(`PRAGMA ${strPragma}`); } catch (e) {}
  }

  prepara(sql) {
    const self = this;
    return {
      ottieni(...parametri) {
        try {
          const risultati = self._db.exec(sql, self._san(parametri));
          if (!risultati || risultati.length === 0 || risultati[0].values.length === 0) return undefined;
          const col = risultati[0].columns, val = risultati[0].values[0], riga = {};
          col.forEach((c, i) => { riga[c] = val[i]; });
          return riga;
        } catch (e) { console.error('Errore DB ottieni:', e.message); throw e; }
      },
      tutti(...parametri) {
        try {
          const risultati = self._db.exec(sql, self._san(parametri));
          if (!risultati || risultati.length === 0) return [];
          const col = risultati[0].columns;
          return risultati[0].values.map(val => {
            const riga = {};
            col.forEach((c, i) => { riga[c] = val[i]; });
            return riga;
          });
        } catch (e) { console.error('Errore DB tutti:', e.message); throw e; }
      },
      esegui(...parametri) {
        try {
          self._db.run(sql, self._san(parametri));
          const ultimoId = self._ultimoId();
          const righeModificate = self._db.getRowsModified();
          self._salva();
          return { righeModificate, ultimoIdInserito: ultimoId };
        } catch (e) { console.error('Errore DB esegui:', e.message); throw e; }
      }
    };
  }

  _san(p) { return (p || []).map(v => v === undefined ? null : v); }
  _ultimoId() { try { const r = this._db.exec('SELECT last_insert_rowid() as id'); return r[0]?.values[0]?.[0] || 0; } catch { return 0; } }
  _salva() {
    try {
      const fs = require('fs');
      fs.writeFileSync(this._percorso, Buffer.from(this._db.export()));
    } catch (e) { console.error('Errore salvataggio DB:', e.message); }
  }
}

// ============ INIT ============
async function inizializzaDb() {
  if (database) return database;

  if (TURSO_URL && TURSO_TOKEN) {
    console.log('☁️  Connessione a Turso...');
    console.log(`   URL: ${TURSO_URL}`);
    const { createClient } = require('@libsql/client');
    const client = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });
    // Test connessione
    await client.execute('SELECT 1');
    database = new WrapperTurso(client);
    console.log('✅ Connesso a Turso (database cloud — dati PERMANENTI!)');
  } else {
    console.log('💾 Uso database locale (sql.js) — ATTENZIONE: dati persi al riavvio Render!');
    const inizializzaSqlJs = require('sql.js');
    const fs = require('fs');
    const percorso = require('path').join(__dirname, '..', 'schedulatore.db');
    const SQL = await inizializzaSqlJs();
    database = fs.existsSync(percorso)
      ? new WrapperSqlJs(new SQL.Database(fs.readFileSync(percorso)))
      : new WrapperSqlJs(new SQL.Database());
    console.log('✅ Database locale inizializzato');
  }
  return database;
}

function ottieniDb() {
  if (!database) throw new Error('Database non inizializzato.');
  return database;
}

async function inizializzaDatabase() {
  await inizializzaDb();

  const tabelle = [
    `CREATE TABLE IF NOT EXISTS utenti (
      id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, nome_utente TEXT NOT NULL,
      hash_password TEXT NOT NULL, e_team_leader INTEGER DEFAULT 0, token_reset TEXT,
      scadenza_token_reset TEXT, creato_il TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS team (
      id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, nome_sponsor TEXT, email_sponsor TEXT,
      nome_leader TEXT, email_leader TEXT, id_utente_leader INTEGER NOT NULL, stakeholder TEXT,
      creato_il TEXT DEFAULT (datetime('now')), FOREIGN KEY (id_utente_leader) REFERENCES utenti(id)
    )`,
    `CREATE TABLE IF NOT EXISTS obiettivi (
      id INTEGER PRIMARY KEY AUTOINCREMENT, id_utente INTEGER NOT NULL, id_team INTEGER, nome TEXT NOT NULL,
      note TEXT DEFAULT '', data_inizio TEXT NOT NULL, ore_totali REAL NOT NULL, data_fine_stimata TEXT,
      creato_il TEXT DEFAULT (datetime('now')), FOREIGN KEY (id_utente) REFERENCES utenti(id)
    )`,
    `CREATE TABLE IF NOT EXISTS sotto_attivita (
      id INTEGER PRIMARY KEY AUTOINCREMENT, id_obiettivo INTEGER NOT NULL, nome TEXT NOT NULL,
      ore_totali REAL NOT NULL, ore_per_giorno REAL NOT NULL DEFAULT 1, giorni_stimati INTEGER,
      data_fine_stimata TEXT, email_responsabile TEXT, percentuale_completamento INTEGER DEFAULT 0,
      creato_il TEXT DEFAULT (datetime('now')), FOREIGN KEY (id_obiettivo) REFERENCES obiettivi(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS collaboratori_attivita (
      id INTEGER PRIMARY KEY AUTOINCREMENT, id_sotto_attivita INTEGER NOT NULL, email_utente TEXT NOT NULL,
      FOREIGN KEY (id_sotto_attivita) REFERENCES sotto_attivita(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS micro_attivita (
      id INTEGER PRIMARY KEY AUTOINCREMENT, id_sotto_attivita INTEGER NOT NULL, data TEXT NOT NULL,
      ore REAL NOT NULL, etichetta TEXT, completata INTEGER DEFAULT 0, flag_giornaliero INTEGER DEFAULT 0,
      FOREIGN KEY (id_sotto_attivita) REFERENCES sotto_attivita(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS membri_team (
      id INTEGER PRIMARY KEY AUTOINCREMENT, id_team INTEGER NOT NULL, email_utente TEXT NOT NULL,
      id_utente INTEGER, ruolo TEXT DEFAULT 'membro', iscritto INTEGER DEFAULT 0,
      FOREIGN KEY (id_team) REFERENCES team(id) ON DELETE CASCADE
    )`
  ];

  for (const sql of tabelle) { await database.esegui(sql); }

  const migrazioni = [
    'ALTER TABLE team ADD COLUMN email_sponsor TEXT',
    'ALTER TABLE team ADD COLUMN email_leader TEXT',
    'ALTER TABLE membri_team ADD COLUMN ruolo TEXT DEFAULT "membro"',
    'ALTER TABLE sotto_attivita ADD COLUMN percentuale_completamento INTEGER DEFAULT 0',
    "ALTER TABLE obiettivi ADD COLUMN note TEXT DEFAULT ''",
    'ALTER TABLE micro_attivita ADD COLUMN flag_giornaliero INTEGER DEFAULT 0',
    'ALTER TABLE micro_attivita ADD COLUMN completamento_giornaliero INTEGER DEFAULT 0'
  ];
  for (const sql of migrazioni) { try { await database.esegui(sql); } catch(e) {} }

  console.log('✅ Database inizializzato con successo.');
}

module.exports = { ottieniDb, inizializzaDb, inizializzaDatabase };
