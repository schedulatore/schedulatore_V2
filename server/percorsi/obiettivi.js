const express = require('express');
const { ottieniDb } = require('../utilita/database');
const { autenticaToken } = require('../middleware/autenticazione');
const {
  generaMicroAttivita, calcolaDataFine, ottieniOreGiornaliereUtente,
  primoGiornoLavorativoDa, risolviConflitti, eGiornoLavorativo, prossimoGiornoLavorativo
} = require('../utilita/schedulatore');

const percorso = express.Router();

// --- ROUTE STATICHE (prima di /:id) ---

// GET /api/obiettivi/calendario
percorso.get('/calendario', autenticaToken, (req, res) => {
  try {
    const db = ottieniDb();
    const micro = db.prepara(`
      SELECT ma.*, sa.nome as nome_attivita, sa.email_responsabile,
             sa.percentuale_completamento,
             o.nome as nome_obiettivo, o.id_team, o.id_utente,
             t.nome as nome_team
      FROM micro_attivita ma
      JOIN sotto_attivita sa ON ma.id_sotto_attivita = sa.id
      JOIN obiettivi o ON sa.id_obiettivo = o.id
      LEFT JOIN team t ON o.id_team = t.id
      WHERE (o.id_utente = ? AND o.id_team IS NULL)
         OR sa.email_responsabile = ?
         OR sa.id IN (SELECT id_sotto_attivita FROM collaboratori_attivita WHERE email_utente = ?)
      ORDER BY ma.data
    `).tutti(req.utente.id, req.utente.email, req.utente.email);

    const totaliGiornalieri = {};
    for (const m of micro) {
      // Se la sotto-attività è al 100%, non contare le ore
      if (m.percentuale_completamento >= 100) continue;
      totaliGiornalieri[m.data] = (totaliGiornalieri[m.data] || 0) + m.ore;
    }
    const conflitti = {};
    for (const [data, totale] of Object.entries(totaliGiornalieri)) {
      if (totale > 8) conflitti[data] = totale;
    }
    res.json({ eventi: micro, conflitti, totaliGiornalieri });
  } catch (err) {
    console.error('Errore calendario:', err);
    res.status(500).json({ errore: 'Errore del server.' });
  }
});

// POST /api/obiettivi/verifica-conflitti
percorso.post('/verifica-conflitti', autenticaToken, (req, res) => {
  try {
    const db = ottieniDb();
    const oreGiornaliere = ottieniOreGiornaliereUtente(db, req.utente.id, req.utente.email);
    const conflitti = {};
    for (const [data, ore] of Object.entries(oreGiornaliere)) {
      if (ore > 8) conflitti[data] = ore;
    }
    res.json({ conflitti, oreGiornaliere });
  } catch (err) { res.status(500).json({ errore: 'Errore del server.' }); }
});

// POST /api/obiettivi/sistema-conflitti — Risolvi automaticamente
percorso.post('/sistema-conflitti', autenticaToken, (req, res) => {
  try {
    const db = ottieniDb();
    const spostamenti = risolviConflitti(db, req.utente.id, req.utente.email);
    console.log(`🔧 [CONFLITTI] ${spostamenti} micro-attività spostate per ${req.utente.email}`);
    res.json({ messaggio: `${spostamenti} attività spostate automaticamente.`, spostamenti });
  } catch (err) {
    console.error('Errore sistema conflitti:', err);
    res.status(500).json({ errore: 'Errore del server.' });
  }
});

// PUT /api/obiettivi/sposta-micro/:idMicro — Drag & drop singolo slot
percorso.put('/sposta-micro/:idMicro', autenticaToken, (req, res) => {
  try {
    const db = ottieniDb();
    const { nuova_data } = req.body;
    if (!nuova_data) return res.status(400).json({ errore: 'Nuova data obbligatoria.' });

    // Verifica che sia un giorno lavorativo
    if (!eGiornoLavorativo(nuova_data)) {
      // Trova il prossimo giorno lavorativo
      const giornoLav = prossimoGiornoLavorativo(nuova_data);
      return res.status(400).json({ errore: `${nuova_data} non è lavorativo. Prossimo disponibile: ${giornoLav}` });
    }

    const micro = db.prepara('SELECT * FROM micro_attivita WHERE id = ?').ottieni(parseInt(req.params.idMicro));
    if (!micro) return res.status(404).json({ errore: 'Micro-attività non trovata.' });

    // Verifica che nel giorno di destinazione ci sia spazio (escluse attività al 100% e la micro stessa)
    const oreDest = db.prepara(`
      SELECT COALESCE(SUM(ma.ore), 0) as tot FROM micro_attivita ma
      JOIN sotto_attivita sa ON ma.id_sotto_attivita = sa.id
      JOIN obiettivi o ON sa.id_obiettivo = o.id
      WHERE ma.data = ? AND ma.id != ?
      AND ((o.id_utente = ? AND o.id_team IS NULL) OR sa.email_responsabile = ?)
      AND COALESCE(sa.percentuale_completamento, 0) < 100
    `).ottieni(nuova_data, micro.id, req.utente.id, req.utente.email);

    const totDest = (oreDest ? oreDest.tot : 0);
    if (totDest + micro.ore > 8) {
      return res.status(400).json({ errore: `Il giorno ${nuova_data} avrebbe ${totDest + micro.ore}h (max 8h).` });
    }

    db.prepara('UPDATE micro_attivita SET data = ? WHERE id = ?').esegui(nuova_data, micro.id);
    res.json({ messaggio: 'Micro-attività spostata.', micro: { ...micro, data: nuova_data } });
  } catch (err) {
    console.error('Errore spostamento micro:', err);
    res.status(500).json({ errore: 'Errore del server.' });
  }
});

// GET /api/obiettivi/giornaliere/:data — attività del giorno con flag
percorso.get('/giornaliere/:data', autenticaToken, (req, res) => {
  try {
    const db = ottieniDb();
    const data = req.params.data;
    const micro = db.prepara(`
      SELECT ma.*, sa.nome as nome_attivita, sa.percentuale_completamento,
             o.nome as nome_obiettivo, o.id_team
      FROM micro_attivita ma
      JOIN sotto_attivita sa ON ma.id_sotto_attivita = sa.id
      JOIN obiettivi o ON sa.id_obiettivo = o.id
      WHERE ma.data = ?
      AND ((o.id_utente = ? AND o.id_team IS NULL)
        OR sa.email_responsabile = ?
        OR sa.id IN (SELECT id_sotto_attivita FROM collaboratori_attivita WHERE email_utente = ?))
      ORDER BY ma.ore DESC
    `).tutti(data, req.utente.id, req.utente.email, req.utente.email);
    res.json({ attivita: micro });
  } catch (err) { res.status(500).json({ errore: 'Errore del server.' }); }
});

// PATCH /api/obiettivi/flag-giornaliero/:idMicro — imposta flag OK/NOK
percorso.patch('/flag-giornaliero/:idMicro', autenticaToken, (req, res) => {
  try {
    const db = ottieniDb();
    const { flag } = req.body; // 1 = OK, 0 = NOK
    if (flag !== 0 && flag !== 1) return res.status(400).json({ errore: 'Flag deve essere 0 o 1.' });
    db.prepara('UPDATE micro_attivita SET flag_giornaliero = ? WHERE id = ?').esegui(flag, parseInt(req.params.idMicro));
    res.json({ messaggio: 'Flag aggiornato.', flag });
  } catch (err) { res.status(500).json({ errore: 'Errore del server.' }); }
});

// --- ROUTE DINAMICHE ---

// GET /api/obiettivi
percorso.get('/', autenticaToken, (req, res) => {
  try {
    const db = ottieniDb();
    const obiettivi = db.prepara('SELECT * FROM obiettivi WHERE id_utente = ? AND id_team IS NULL ORDER BY creato_il DESC').tutti(req.utente.id);
    for (const ob of obiettivi) {
      ob.sotto_attivita = db.prepara('SELECT * FROM sotto_attivita WHERE id_obiettivo = ? ORDER BY id').tutti(ob.id);
      let sommaPct = 0;
      for (const sa of ob.sotto_attivita) {
        sa.micro_attivita = db.prepara('SELECT * FROM micro_attivita WHERE id_sotto_attivita = ? ORDER BY data').tutti(sa.id);
        sa.collaboratori = db.prepara('SELECT email_utente FROM collaboratori_attivita WHERE id_sotto_attivita = ?').tutti(sa.id).map(c => c.email_utente);
        sommaPct += (sa.percentuale_completamento || 0);
      }
      ob.percentuale_media = ob.sotto_attivita.length > 0 ? Math.round(sommaPct / ob.sotto_attivita.length) : 0;
    }
    res.json({ obiettivi });
  } catch (err) { res.status(500).json({ errore: 'Errore del server.' }); }
});

// POST /api/obiettivi
percorso.post('/', autenticaToken, (req, res) => {
  try {
    const { nome, data_inizio, ore_totali, id_team, note } = req.body;
    if (!nome || !data_inizio || !ore_totali) return res.status(400).json({ errore: 'Nome, data inizio e ore totali obbligatori.' });
    const db = ottieniDb();
    const inizio = primoGiornoLavorativoDa(data_inizio);
    const fine = calcolaDataFine(inizio, ore_totali);
    db.prepara('INSERT INTO obiettivi (id_utente, id_team, nome, note, data_inizio, ore_totali, data_fine_stimata) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .esegui(req.utente.id, id_team || null, nome, note || '', inizio, ore_totali, fine);
    const ob = db.prepara('SELECT * FROM obiettivi WHERE id_utente = ? AND nome = ? ORDER BY id DESC').tutti(req.utente.id, nome);
    res.status(201).json({ obiettivo: ob[0] });
  } catch (err) { res.status(500).json({ errore: 'Errore del server.' }); }
});

// PUT /api/obiettivi/:id
percorso.put('/:id', autenticaToken, (req, res) => {
  try {
    const db = ottieniDb();
    const { nome, data_inizio, ore_totali, note } = req.body;
    const ob = db.prepara('SELECT * FROM obiettivi WHERE id = ?').ottieni(parseInt(req.params.id));
    if (!ob) return res.status(404).json({ errore: 'Obiettivo non trovato.' });
    const nuovoInizio = data_inizio ? primoGiornoLavorativoDa(data_inizio) : ob.data_inizio;
    const nuoveOre = ore_totali || ob.ore_totali;
    db.prepara('UPDATE obiettivi SET nome = ?, note = ?, data_inizio = ?, ore_totali = ?, data_fine_stimata = ? WHERE id = ?')
      .esegui(nome || ob.nome, note !== undefined ? note : (ob.note || ''), nuovoInizio, nuoveOre, calcolaDataFine(nuovoInizio, nuoveOre), ob.id);
    rigeneraTutte(db, ob.id, nuovoInizio);
    res.json({ obiettivo: db.prepara('SELECT * FROM obiettivi WHERE id = ?').ottieni(ob.id) });
  } catch (err) { res.status(500).json({ errore: 'Errore del server.' }); }
});

// DELETE /api/obiettivi/:id
percorso.delete('/:id', autenticaToken, (req, res) => {
  try {
    const db = ottieniDb();
    const idOb = parseInt(req.params.id);
    const subs = db.prepara('SELECT id FROM sotto_attivita WHERE id_obiettivo = ?').tutti(idOb);
    for (const sa of subs) {
      db.prepara('DELETE FROM micro_attivita WHERE id_sotto_attivita = ?').esegui(sa.id);
      db.prepara('DELETE FROM collaboratori_attivita WHERE id_sotto_attivita = ?').esegui(sa.id);
    }
    db.prepara('DELETE FROM sotto_attivita WHERE id_obiettivo = ?').esegui(idOb);
    db.prepara('DELETE FROM obiettivi WHERE id = ? AND id_utente = ?').esegui(idOb, req.utente.id);
    res.json({ messaggio: 'Obiettivo eliminato.' });
  } catch (err) { res.status(500).json({ errore: 'Errore del server.' }); }
});

// POST /api/obiettivi/:id/sotto-attivita
percorso.post('/:id/sotto-attivita', autenticaToken, (req, res) => {
  try {
    const db = ottieniDb();
    const idOb = parseInt(req.params.id);
    const obiettivo = db.prepara('SELECT * FROM obiettivi WHERE id = ?').ottieni(idOb);
    if (!obiettivo) return res.status(404).json({ errore: 'Obiettivo non trovato.' });
    const { nome, ore_totali, ore_per_giorno, email_responsabile, collaboratori } = req.body;
    if (!nome || !ore_totali || !ore_per_giorno) return res.status(400).json({ errore: 'Nome, ore totali e ore/giorno obbligatori.' });

    const rigaSomma = db.prepara('SELECT COALESCE(SUM(ore_totali), 0) as somma FROM sotto_attivita WHERE id_obiettivo = ?').ottieni(idOb);
    if ((rigaSomma?.somma || 0) + ore_totali > obiettivo.ore_totali)
      return res.status(400).json({ errore: `Ore sotto-attività superano il macro-obiettivo (${obiettivo.ore_totali}h).` });

    db.prepara('INSERT INTO sotto_attivita (id_obiettivo, nome, ore_totali, ore_per_giorno, giorni_stimati, email_responsabile) VALUES (?, ?, ?, ?, ?, ?)')
      .esegui(idOb, nome, ore_totali, ore_per_giorno, Math.ceil(ore_totali / ore_per_giorno), email_responsabile || req.utente.email);

    const sa = db.prepara('SELECT * FROM sotto_attivita WHERE id_obiettivo = ? AND nome = ? ORDER BY id DESC').tutti(idOb, nome)[0];
    if (collaboratori?.length > 0) {
      for (const em of collaboratori) { const p = em.trim(); if (p) db.prepara('INSERT INTO collaboratori_attivita (id_sotto_attivita, email_utente) VALUES (?, ?)').esegui(sa.id, p); }
    }
    rigeneraTutte(db, idOb, obiettivo.data_inizio);
    const saAgg = db.prepara('SELECT * FROM sotto_attivita WHERE id = ?').ottieni(sa.id);
    if (saAgg) saAgg.micro_attivita = db.prepara('SELECT * FROM micro_attivita WHERE id_sotto_attivita = ? ORDER BY data').tutti(sa.id);

    res.status(201).json({ sotto_attivita: saAgg });
  } catch (err) { console.error('Errore creazione sotto-attività:', err); res.status(500).json({ errore: 'Errore del server.' }); }
});

// PUT /api/obiettivi/:idOb/sotto-attivita/:idSa — Modifica sotto-attività
percorso.put('/:idOb/sotto-attivita/:idSa', autenticaToken, (req, res) => {
  try {
    const db = ottieniDb();
    const sa = db.prepara('SELECT * FROM sotto_attivita WHERE id = ? AND id_obiettivo = ?').ottieni(parseInt(req.params.idSa), parseInt(req.params.idOb));
    if (!sa) return res.status(404).json({ errore: 'Sotto-attività non trovata.' });
    const { nome, ore_totali, ore_per_giorno, email_responsabile, percentuale_completamento } = req.body;

    db.prepara('UPDATE sotto_attivita SET nome = ?, ore_totali = ?, ore_per_giorno = ?, giorni_stimati = ?, email_responsabile = ?, percentuale_completamento = ? WHERE id = ?')
      .esegui(nome || sa.nome, ore_totali || sa.ore_totali, ore_per_giorno || sa.ore_per_giorno,
        Math.ceil((ore_totali || sa.ore_totali) / (ore_per_giorno || sa.ore_per_giorno)),
        email_responsabile || sa.email_responsabile,
        percentuale_completamento !== undefined ? percentuale_completamento : (sa.percentuale_completamento || 0),
        sa.id);

    const obiettivo = db.prepara('SELECT * FROM obiettivi WHERE id = ?').ottieni(parseInt(req.params.idOb));
    // Rigenera solo se ore/giorno o ore totali cambiate
    if ((ore_totali && ore_totali !== sa.ore_totali) || (ore_per_giorno && ore_per_giorno !== sa.ore_per_giorno)) {
      rigeneraTutte(db, obiettivo.id, obiettivo.data_inizio);
    }

    const agg = db.prepara('SELECT * FROM sotto_attivita WHERE id = ?').ottieni(sa.id);
    if (agg) agg.micro_attivita = db.prepara('SELECT * FROM micro_attivita WHERE id_sotto_attivita = ? ORDER BY data').tutti(sa.id);
    res.json({ sotto_attivita: agg });
  } catch (err) { console.error('Errore aggiornamento sotto-attività:', err); res.status(500).json({ errore: 'Errore del server.' }); }
});

// PATCH /api/obiettivi/sotto-attivita/:idSa/percentuale — Aggiorna solo la percentuale
percorso.patch('/sotto-attivita/:idSa/percentuale', autenticaToken, (req, res) => {
  try {
    const db = ottieniDb();
    const { percentuale } = req.body;
    if (![0, 25, 50, 75, 100].includes(percentuale)) return res.status(400).json({ errore: 'Percentuale deve essere 0, 25, 50, 75 o 100.' });
    db.prepara('UPDATE sotto_attivita SET percentuale_completamento = ? WHERE id = ?').esegui(percentuale, parseInt(req.params.idSa));
    res.json({ messaggio: 'Percentuale aggiornata.', percentuale });
  } catch (err) { res.status(500).json({ errore: 'Errore del server.' }); }
});

// DELETE /api/obiettivi/:idOb/sotto-attivita/:idSa
percorso.delete('/:idOb/sotto-attivita/:idSa', autenticaToken, (req, res) => {
  try {
    const db = ottieniDb();
    const idSa = parseInt(req.params.idSa); const idOb = parseInt(req.params.idOb);
    db.prepara('DELETE FROM micro_attivita WHERE id_sotto_attivita = ?').esegui(idSa);
    db.prepara('DELETE FROM collaboratori_attivita WHERE id_sotto_attivita = ?').esegui(idSa);
    db.prepara('DELETE FROM sotto_attivita WHERE id = ? AND id_obiettivo = ?').esegui(idSa, idOb);
    const ob = db.prepara('SELECT * FROM obiettivi WHERE id = ?').ottieni(idOb);
    if (ob) rigeneraTutte(db, ob.id, ob.data_inizio);
    res.json({ messaggio: 'Sotto-attività eliminata.' });
  } catch (err) { res.status(500).json({ errore: 'Errore del server.' }); }
});

function rigeneraTutte(db, idObiettivo, dataInizio) {
  const sottoAtt = db.prepara('SELECT * FROM sotto_attivita WHERE id_obiettivo = ? ORDER BY id').tutti(idObiettivo);
  for (const sa of sottoAtt) db.prepara('DELETE FROM micro_attivita WHERE id_sotto_attivita = ?').esegui(sa.id);
  const oreGiorn = {};
  for (const sa of sottoAtt) {
    const micro = generaMicroAttivita(sa, dataInizio, oreGiorn);
    for (const m of micro) db.prepara('INSERT INTO micro_attivita (id_sotto_attivita, data, ore, etichetta) VALUES (?, ?, ?, ?)').esegui(sa.id, m.data, m.ore, m.etichetta);
    if (micro.length > 0) db.prepara('UPDATE sotto_attivita SET data_fine_stimata = ? WHERE id = ?').esegui(micro[micro.length - 1].data, sa.id);
  }
}

module.exports = percorso;

// --- ENDPOINT COMPLETAMENTO GIORNALIERO ---

// PATCH /api/obiettivi/micro/:idMicro/flag-giornaliero
percorso.patch('/micro/:idMicro/flag-giornaliero', autenticaToken, (req, res) => {
  try {
    const db = ottieniDb();
    const { completato } = req.body; // 1 = OK, 0 = NOK
    if (completato !== 0 && completato !== 1) return res.status(400).json({ errore: 'Valore deve essere 0 o 1.' });
    db.prepara('UPDATE micro_attivita SET completamento_giornaliero = ? WHERE id = ?').esegui(completato, parseInt(req.params.idMicro));
    res.json({ messaggio: 'Flag aggiornato.', completato });
  } catch (err) { res.status(500).json({ errore: 'Errore del server.' }); }
});

module.exports = percorso;
