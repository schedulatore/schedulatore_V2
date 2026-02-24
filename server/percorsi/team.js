const express = require('express');
const { ottieniDb } = require('../utilita/database');
const { autenticaToken } = require('../middleware/autenticazione');
const { eGiornoLavorativo, prossimoGiornoLavorativo } = require('../utilita/schedulatore');

const percorso = express.Router();

// GET /api/team
percorso.get('/', autenticaToken, (req, res) => {
  try {
    const db = ottieniDb();
    const teamLeader = db.prepara("SELECT *, 'leader' as mio_ruolo FROM team WHERE id_utente_leader = ?").tutti(req.utente.id);
    const teamMembro = db.prepara(`
      SELECT t.*, mt.ruolo as mio_ruolo FROM team t
      JOIN membri_team mt ON t.id = mt.id_team
      WHERE mt.email_utente = ? AND t.id_utente_leader != ?
    `).tutti(req.utente.email, req.utente.id);

    const tuttiTeam = [...teamLeader, ...teamMembro];
    for (const t of tuttiTeam) {
      t.membri = db.prepara(`
        SELECT mt.*, u.nome_utente FROM membri_team mt
        LEFT JOIN utenti u ON mt.id_utente = u.id WHERE mt.id_team = ?
      `).tutti(t.id);
    }
    res.json({ team: tuttiTeam });
  } catch (err) {
    console.error('Errore caricamento team:', err);
    res.status(500).json({ errore: 'Errore del server.' });
  }
});

// POST /api/team
percorso.post('/', autenticaToken, async (req, res) => {
  try {
    const { nome, nome_sponsor, email_sponsor, nome_leader, email_leader, membri, stakeholder } = req.body;
    if (!nome) return res.status(400).json({ errore: 'Il nome del team è obbligatorio.' });

    const db = ottieniDb();
    db.prepara('INSERT INTO team (nome, nome_sponsor, email_sponsor, nome_leader, email_leader, id_utente_leader, stakeholder) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .esegui(nome, nome_sponsor || req.utente.nome_utente, email_sponsor || req.utente.email,
        nome_leader || req.utente.nome_utente, email_leader || req.utente.email,
        req.utente.id, stakeholder || '');

    const tuttiTeam = db.prepara('SELECT * FROM team WHERE id_utente_leader = ? AND nome = ? ORDER BY id DESC').tutti(req.utente.id, nome);
    const nuovoTeam = tuttiTeam[0];
    if (!nuovoTeam) return res.status(500).json({ errore: 'Errore creazione team.' });
    const idTeam = nuovoTeam.id;

    // Aggiungi il creatore come leader
    db.prepara('INSERT INTO membri_team (id_team, email_utente, id_utente, ruolo, iscritto) VALUES (?, ?, ?, ?, 1)')
      .esegui(idTeam, req.utente.email, req.utente.id, 'leader');

    // Sponsor separato
    if (email_sponsor && email_sponsor.trim() && email_sponsor.trim() !== req.utente.email) {
      const utenteSponsor = db.prepara('SELECT id FROM utenti WHERE email = ?').ottieni(email_sponsor.trim());
      db.prepara('INSERT INTO membri_team (id_team, email_utente, id_utente, ruolo, iscritto) VALUES (?, ?, ?, ?, ?)')
        .esegui(idTeam, email_sponsor.trim(), utenteSponsor ? utenteSponsor.id : null, 'sponsor', utenteSponsor ? 1 : 0);
      
    }

    // Leader separato
    if (email_leader && email_leader.trim() && email_leader.trim() !== req.utente.email) {
      const utenteLeader = db.prepara('SELECT id FROM utenti WHERE email = ?').ottieni(email_leader.trim());
      db.prepara('INSERT INTO membri_team (id_team, email_utente, id_utente, ruolo, iscritto) VALUES (?, ?, ?, ?, ?)')
        .esegui(idTeam, email_leader.trim(), utenteLeader ? utenteLeader.id : null, 'leader', utenteLeader ? 1 : 0);
      
    }

    // Membri
    if (membri && membri.length > 0) {
      for (const email of membri) {
        const pulita = email.trim();
        if (!pulita || pulita === req.utente.email) continue;
        const giaAggiunto = db.prepara('SELECT id FROM membri_team WHERE id_team = ? AND email_utente = ?').ottieni(idTeam, pulita);
        if (giaAggiunto) continue;
        const utenteEsistente = db.prepara('SELECT id FROM utenti WHERE email = ?').ottieni(pulita);
        db.prepara('INSERT INTO membri_team (id_team, email_utente, id_utente, ruolo, iscritto) VALUES (?, ?, ?, ?, ?)')
          .esegui(idTeam, pulita, utenteEsistente ? utenteEsistente.id : null, 'membro', utenteEsistente ? 1 : 0);
        
      }
    }

    // Stakeholder
    if (stakeholder) {
      const emailStake = stakeholder.split(',').map(s => s.trim()).filter(s => s.includes('@'));
      for (const email of emailStake) {
        if (email === req.utente.email) continue;
        const giaAggiunto = db.prepara('SELECT id FROM membri_team WHERE id_team = ? AND email_utente = ?').ottieni(idTeam, email);
        if (giaAggiunto) continue;
        const utenteEsistente = db.prepara('SELECT id FROM utenti WHERE email = ?').ottieni(email);
        db.prepara('INSERT INTO membri_team (id_team, email_utente, id_utente, ruolo, iscritto) VALUES (?, ?, ?, ?, ?)')
          .esegui(idTeam, email, utenteEsistente ? utenteEsistente.id : null, 'stakeholder', utenteEsistente ? 1 : 0);
        
      }
    }

    nuovoTeam.membri = db.prepara('SELECT * FROM membri_team WHERE id_team = ?').tutti(idTeam);
    res.status(201).json({ team: nuovoTeam });
  } catch (err) {
    console.error('Errore creazione team:', err);
    res.status(500).json({ errore: 'Errore del server.' });
  }
});

// GET /api/team/:id
percorso.get('/:id', autenticaToken, (req, res) => {
  try {
    const db = ottieniDb();
    const idTeam = parseInt(req.params.id);
    const teamDati = db.prepara('SELECT * FROM team WHERE id = ?').ottieni(idTeam);
    if (!teamDati) return res.status(404).json({ errore: 'Team non trovato.' });

    teamDati.membri = db.prepara(`
      SELECT mt.*, u.nome_utente FROM membri_team mt
      LEFT JOIN utenti u ON mt.id_utente = u.id WHERE mt.id_team = ?
    `).tutti(idTeam);

    const miaIscrizione = db.prepara('SELECT ruolo FROM membri_team WHERE id_team = ? AND email_utente = ?').ottieni(idTeam, req.utente.email);
    teamDati.mio_ruolo = teamDati.id_utente_leader === req.utente.id ? 'leader' : (miaIscrizione ? miaIscrizione.ruolo : 'membro');

    teamDati.obiettivi = db.prepara('SELECT * FROM obiettivi WHERE id_team = ? ORDER BY creato_il DESC').tutti(idTeam);
    for (const ob of teamDati.obiettivi) {
      ob.sotto_attivita = db.prepara('SELECT * FROM sotto_attivita WHERE id_obiettivo = ? ORDER BY id').tutti(ob.id);
      let sommaPct = 0;
      for (const sa of ob.sotto_attivita) {
        sa.micro_attivita = db.prepara('SELECT * FROM micro_attivita WHERE id_sotto_attivita = ? ORDER BY data').tutti(sa.id);
        sa.collaboratori = db.prepara('SELECT email_utente FROM collaboratori_attivita WHERE id_sotto_attivita = ?')
          .tutti(sa.id).map(c => c.email_utente);
        sommaPct += (sa.percentuale_completamento || 0);
      }
      ob.percentuale_media = ob.sotto_attivita.length > 0 ? Math.round(sommaPct / ob.sotto_attivita.length) : 0;
    }

    // Statistiche per membro (per dashboard team)
    const oggiStr = new Date().toISOString().split('T')[0];
    const statsMembri = {};
    for (const ob of teamDati.obiettivi) {
      for (const sa of ob.sotto_attivita) {
        const email = sa.email_responsabile || 'non-assegnato';
        if (!statsMembri[email]) statsMembri[email] = { totali: 0, completate: 0, in_ritardo: 0, in_orario: 0, ore_totali: 0 };
        statsMembri[email].totali++;
        statsMembri[email].ore_totali += sa.ore_totali;
        if ((sa.percentuale_completamento || 0) >= 100) {
          statsMembri[email].completate++;
        } else if (sa.data_fine_stimata && sa.data_fine_stimata < oggiStr) {
          statsMembri[email].in_ritardo++;
        } else {
          statsMembri[email].in_orario++;
        }
      }
    }
    teamDati.stats_membri = statsMembri;

    res.json({ team: teamDati });
  } catch (err) {
    console.error('Errore caricamento team:', err);
    res.status(500).json({ errore: 'Errore del server.' });
  }
});

// DELETE /api/team/:id
percorso.delete('/:id', autenticaToken, (req, res) => {
  try {
    const db = ottieniDb();
    const idTeam = parseInt(req.params.id);
    const teamDati = db.prepara('SELECT * FROM team WHERE id = ?').ottieni(idTeam);
    if (!teamDati) return res.status(404).json({ errore: 'Team non trovato.' });

    const eEditore = teamDati.id_utente_leader === req.utente.id ||
      db.prepara("SELECT id FROM membri_team WHERE id_team = ? AND email_utente = ? AND ruolo IN ('leader','sponsor')")
        .ottieni(idTeam, req.utente.email);
    if (!eEditore) return res.status(403).json({ errore: 'Solo leader e sponsor possono eliminare il team.' });

    const obiettivi = db.prepara('SELECT id FROM obiettivi WHERE id_team = ?').tutti(idTeam);
    for (const ob of obiettivi) {
      const sottoAtt = db.prepara('SELECT id FROM sotto_attivita WHERE id_obiettivo = ?').tutti(ob.id);
      for (const sa of sottoAtt) {
        db.prepara('DELETE FROM micro_attivita WHERE id_sotto_attivita = ?').esegui(sa.id);
        db.prepara('DELETE FROM collaboratori_attivita WHERE id_sotto_attivita = ?').esegui(sa.id);
      }
      db.prepara('DELETE FROM sotto_attivita WHERE id_obiettivo = ?').esegui(ob.id);
    }
    db.prepara('DELETE FROM obiettivi WHERE id_team = ?').esegui(idTeam);
    db.prepara('DELETE FROM membri_team WHERE id_team = ?').esegui(idTeam);
    db.prepara('DELETE FROM team WHERE id = ?').esegui(idTeam);
    res.json({ messaggio: 'Team eliminato.' });
  } catch (err) {
    console.error('Errore eliminazione team:', err);
    res.status(500).json({ errore: 'Errore del server.' });
  }
});

// GET /api/team/:id/calendario
percorso.get('/:id/calendario', autenticaToken, (req, res) => {
  try {
    const db = ottieniDb();
    const micro = db.prepara(`
      SELECT ma.*, sa.nome as nome_attivita, sa.email_responsabile, o.nome as nome_obiettivo
      FROM micro_attivita ma
      JOIN sotto_attivita sa ON ma.id_sotto_attivita = sa.id
      JOIN obiettivi o ON sa.id_obiettivo = o.id
      WHERE o.id_team = ? ORDER BY ma.data
    `).tutti(parseInt(req.params.id));

    const giornalieroPerPersona = {};
    for (const m of micro) {
      const email = m.email_responsabile || 'non-assegnato';
      if (!giornalieroPerPersona[email]) giornalieroPerPersona[email] = {};
      giornalieroPerPersona[email][m.data] = (giornalieroPerPersona[email][m.data] || 0) + m.ore;
    }
    res.json({ eventi: micro, giornalieroPerPersona });
  } catch (err) {
    console.error('Errore calendario team:', err);
    res.status(500).json({ errore: 'Errore del server.' });
  }
});

module.exports = percorso;

// --- GESTIONE MEMBRI TEAM (solo leader/sponsor) ---

// POST /api/team/:id/membri — Aggiungi membro
percorso.post('/:id/membri', autenticaToken, async (req, res) => {
  try {
    const db = ottieniDb();
    const idTeam = parseInt(req.params.id);
    const teamDati = db.prepara('SELECT * FROM team WHERE id = ?').ottieni(idTeam);
    if (!teamDati) return res.status(404).json({ errore: 'Team non trovato.' });

    const eEditore = teamDati.id_utente_leader === req.utente.id ||
      db.prepara("SELECT id FROM membri_team WHERE id_team = ? AND email_utente = ? AND ruolo IN ('leader','sponsor')").ottieni(idTeam, req.utente.email);
    if (!eEditore) return res.status(403).json({ errore: 'Solo leader e sponsor possono gestire i membri.' });

    const { email_utente, ruolo } = req.body;
    if (!email_utente) return res.status(400).json({ errore: 'Email obbligatoria.' });
    const emailPulita = email_utente.trim();
    const ruoloPulito = ['leader', 'sponsor', 'membro', 'stakeholder'].includes(ruolo) ? ruolo : 'membro';

    const giaPresente = db.prepara('SELECT id FROM membri_team WHERE id_team = ? AND email_utente = ?').ottieni(idTeam, emailPulita);
    if (giaPresente) return res.status(409).json({ errore: 'Membro già presente nel team.' });

    const utenteEsistente = db.prepara('SELECT id FROM utenti WHERE email = ?').ottieni(emailPulita);
    db.prepara('INSERT INTO membri_team (id_team, email_utente, id_utente, ruolo, iscritto) VALUES (?, ?, ?, ?, ?)')
      .esegui(idTeam, emailPulita, utenteEsistente ? utenteEsistente.id : null, ruoloPulito, utenteEsistente ? 1 : 0);

    

    const membri = db.prepara('SELECT mt.*, u.nome_utente FROM membri_team mt LEFT JOIN utenti u ON mt.id_utente = u.id WHERE mt.id_team = ?').tutti(idTeam);
    res.status(201).json({ messaggio: 'Membro aggiunto.', membri });
  } catch (err) { console.error('Errore aggiunta membro:', err); res.status(500).json({ errore: 'Errore del server.' }); }
});

// PUT /api/team/:id/membri/:idMembro — Modifica ruolo membro
percorso.put('/:id/membri/:idMembro', autenticaToken, (req, res) => {
  try {
    const db = ottieniDb();
    const idTeam = parseInt(req.params.id);
    const teamDati = db.prepara('SELECT * FROM team WHERE id = ?').ottieni(idTeam);
    if (!teamDati) return res.status(404).json({ errore: 'Team non trovato.' });

    const eEditore = teamDati.id_utente_leader === req.utente.id ||
      db.prepara("SELECT id FROM membri_team WHERE id_team = ? AND email_utente = ? AND ruolo IN ('leader','sponsor')").ottieni(idTeam, req.utente.email);
    if (!eEditore) return res.status(403).json({ errore: 'Solo leader e sponsor possono modificare i membri.' });

    const { ruolo } = req.body;
    const ruoloPulito = ['leader', 'sponsor', 'membro', 'stakeholder'].includes(ruolo) ? ruolo : 'membro';
    db.prepara('UPDATE membri_team SET ruolo = ? WHERE id = ? AND id_team = ?').esegui(ruoloPulito, parseInt(req.params.idMembro), idTeam);

    const membri = db.prepara('SELECT mt.*, u.nome_utente FROM membri_team mt LEFT JOIN utenti u ON mt.id_utente = u.id WHERE mt.id_team = ?').tutti(idTeam);
    res.json({ messaggio: 'Ruolo aggiornato.', membri });
  } catch (err) { res.status(500).json({ errore: 'Errore del server.' }); }
});

// DELETE /api/team/:id/membri/:idMembro — Rimuovi membro
percorso.delete('/:id/membri/:idMembro', autenticaToken, (req, res) => {
  try {
    const db = ottieniDb();
    const idTeam = parseInt(req.params.id);
    const teamDati = db.prepara('SELECT * FROM team WHERE id = ?').ottieni(idTeam);
    if (!teamDati) return res.status(404).json({ errore: 'Team non trovato.' });

    const eEditore = teamDati.id_utente_leader === req.utente.id ||
      db.prepara("SELECT id FROM membri_team WHERE id_team = ? AND email_utente = ? AND ruolo IN ('leader','sponsor')").ottieni(idTeam, req.utente.email);
    if (!eEditore) return res.status(403).json({ errore: 'Solo leader e sponsor possono rimuovere i membri.' });

    // Non permettere di rimuovere se stessi
    const membro = db.prepara('SELECT * FROM membri_team WHERE id = ? AND id_team = ?').ottieni(parseInt(req.params.idMembro), idTeam);
    if (membro && membro.email_utente === req.utente.email) {
      return res.status(400).json({ errore: 'Non puoi rimuovere te stesso dal team.' });
    }

    db.prepara('DELETE FROM membri_team WHERE id = ? AND id_team = ?').esegui(parseInt(req.params.idMembro), idTeam);
    const membri = db.prepara('SELECT mt.*, u.nome_utente FROM membri_team mt LEFT JOIN utenti u ON mt.id_utente = u.id WHERE mt.id_team = ?').tutti(idTeam);
    res.json({ messaggio: 'Membro rimosso.', membri });
  } catch (err) { res.status(500).json({ errore: 'Errore del server.' }); }
});

// ============ CALENDARIO TEAM ============

// GET /api/team/:id/giornaliere/:data
percorso.get('/:id/giornaliere/:data', autenticaToken, (req, res) => {
  try {
    const db = ottieniDb();
    const micro = db.prepara(`
      SELECT ma.*, sa.nome as nome_attivita, sa.percentuale_completamento,
             sa.email_responsabile, o.nome as nome_obiettivo, u.nome_utente as nome_responsabile
      FROM micro_attivita ma
      JOIN sotto_attivita sa ON ma.id_sotto_attivita = sa.id
      JOIN obiettivi o ON sa.id_obiettivo = o.id
      LEFT JOIN utenti u ON sa.email_responsabile = u.email
      WHERE ma.data = ? AND o.id_team = ?
      ORDER BY sa.email_responsabile, ma.ore DESC
    `).tutti(req.params.data, parseInt(req.params.id));
    res.json({ attivita: micro });
  } catch (err) { res.status(500).json({ errore: 'Errore del server.' }); }
});

// PATCH /api/team/:id/flag-giornaliero/:idMicro
percorso.patch('/:id/flag-giornaliero/:idMicro', autenticaToken, (req, res) => {
  try {
    const db = ottieniDb();
    const { flag } = req.body;
    if (flag !== 0 && flag !== 1) return res.status(400).json({ errore: 'Flag deve essere 0 o 1.' });
    const micro = db.prepara(`
      SELECT ma.*, sa.email_responsabile FROM micro_attivita ma
      JOIN sotto_attivita sa ON ma.id_sotto_attivita = sa.id WHERE ma.id = ?
    `).ottieni(parseInt(req.params.idMicro));
    if (!micro) return res.status(404).json({ errore: 'Non trovata.' });
    if (micro.email_responsabile !== req.utente.email) return res.status(403).json({ errore: 'Solo il responsabile può modificare.' });
    db.prepara('UPDATE micro_attivita SET flag_giornaliero = ? WHERE id = ?').esegui(flag, parseInt(req.params.idMicro));
    res.json({ messaggio: 'Flag aggiornato.', flag });
  } catch (err) { res.status(500).json({ errore: 'Errore del server.' }); }
});

// PUT /api/team/:id/sposta-micro/:idMicro
percorso.put('/:id/sposta-micro/:idMicro', autenticaToken, (req, res) => {
  try {
    const db = ottieniDb();
    const { nuova_data } = req.body;
    if (!nuova_data || !eGiornoLavorativo(nuova_data)) return res.status(400).json({ errore: 'Data non lavorativa.' });
    const micro = db.prepara(`
      SELECT ma.*, sa.email_responsabile FROM micro_attivita ma
      JOIN sotto_attivita sa ON ma.id_sotto_attivita = sa.id WHERE ma.id = ?
    `).ottieni(parseInt(req.params.idMicro));
    if (!micro) return res.status(404).json({ errore: 'Non trovata.' });
    const oreDest = db.prepara(`
      SELECT COALESCE(SUM(ma.ore), 0) as tot FROM micro_attivita ma
      JOIN sotto_attivita sa ON ma.id_sotto_attivita = sa.id
      WHERE ma.data = ? AND ma.id != ? AND sa.email_responsabile = ?
      AND COALESCE(sa.percentuale_completamento, 0) < 100
    `).ottieni(nuova_data, micro.id, micro.email_responsabile);
    if ((oreDest?.tot || 0) + micro.ore > 8) return res.status(400).json({ errore: `Supera 8h nel giorno ${nuova_data}.` });
    db.prepara('UPDATE micro_attivita SET data = ? WHERE id = ?').esegui(nuova_data, micro.id);
    res.json({ messaggio: 'Spostata.' });
  } catch (err) { res.status(500).json({ errore: 'Errore del server.' }); }
});

// GET /api/team/:id/report-giornaliero/:data
percorso.get('/:id/report-giornaliero/:data', autenticaToken, (req, res) => {
  try {
    const db = ottieniDb();
    const idTeam = parseInt(req.params.id);
    const membri = db.prepara('SELECT mt.*, u.nome_utente FROM membri_team mt LEFT JOIN utenti u ON mt.id_utente = u.id WHERE mt.id_team = ?').tutti(idTeam);
    const report = [];
    for (const m of membri) {
      const micro = db.prepara(`
        SELECT ma.*, sa.nome as nome_attivita FROM micro_attivita ma
        JOIN sotto_attivita sa ON ma.id_sotto_attivita = sa.id
        JOIN obiettivi o ON sa.id_obiettivo = o.id
        WHERE ma.data = ? AND o.id_team = ? AND sa.email_responsabile = ?
        AND COALESCE(sa.percentuale_completamento, 0) < 100
      `).tutti(req.params.data, idTeam, m.email_utente);
      if (micro.length === 0) continue;
      const ok = micro.filter(a => a.flag_giornaliero === 1);
      const nok = micro.filter(a => a.flag_giornaliero !== 1);
      report.push({ email: m.email_utente, nome: m.nome_utente || m.email_utente, ruolo: m.ruolo, totali: micro.length, ok: ok.map(a => ({ nome: a.nome_attivita, ore: a.ore })), nok: nok.map(a => ({ nome: a.nome_attivita, ore: a.ore })), percentuale: Math.round((ok.length / micro.length) * 100) });
    }
    res.json({ report, data: req.params.data });
  } catch (err) { res.status(500).json({ errore: 'Errore del server.' }); }
});
