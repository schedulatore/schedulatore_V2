/**
 * Job programmati: scadenze, report giornaliero
 * - Ogni minuto controlla se sono le 17:00 (ora locale) → invia report
 * - Ogni giorno alle 08:00 → controlla scadenze tra 2 giorni
 */
const { ottieniDb } = require('./database');
const { eGiornoLavorativo, formattaData } = require('./schedulatore');
const {
  inviaAvvisoScadenza, inviaReportGiornaliero, inviaReportTeam
} = require('./email');

let ultimoReportInviato = '';
let ultimaScadenzaInviata = '';

function ottieniOggi() {
  return new Date().toISOString().split('T')[0];
}

function ottieniOraMinuto() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

// ============ SCADENZE 2 GIORNI PRIMA ============
async function controllaScadenze() {
  const oggi = ottieniOggi();
  const chiave = `scad-${oggi}`;
  if (ultimaScadenzaInviata === chiave) return; // già inviata oggi

  try {
    const db = ottieniDb();
    // Calcola la data tra 2 giorni
    const tra2gg = new Date();
    tra2gg.setDate(tra2gg.getDate() + 2);
    const dataTra2 = formattaData(tra2gg);

    const scadenze = db.prepara(`
      SELECT sa.*, o.nome as nome_obiettivo, o.id_team, t.nome as nome_team
      FROM sotto_attivita sa
      JOIN obiettivi o ON sa.id_obiettivo = o.id
      LEFT JOIN team t ON o.id_team = t.id
      WHERE sa.data_fine_stimata = ?
      AND COALESCE(sa.percentuale_completamento, 0) < 100
    `).tutti(dataTra2);

    for (const sa of scadenze) {
      if (sa.email_responsabile) {
        await inviaAvvisoScadenza(sa.email_responsabile, sa.nome, sa.nome_obiettivo, sa.data_fine_stimata, sa.nome_team);
      }
    }

    ultimaScadenzaInviata = chiave;
    if (scadenze.length > 0) console.log(`📧 [CRON] Inviate ${scadenze.length} notifiche scadenza`);
  } catch (err) {
    console.error('Errore controllo scadenze:', err);
  }
}

// ============ REPORT GIORNALIERO ============
async function inviaReportGiornalieroTutti() {
  const oggi = ottieniOggi();
  if (!eGiornoLavorativo(oggi)) {
    console.log('📧 [CRON] Oggi non è lavorativo, skip report');
    return { inviati: 0 };
  }

  try {
    const db = ottieniDb();
    let inviatiPersonali = 0;
    let inviatiTeam = 0;

    // 1. Report personali per ogni utente
    const utenti = db.prepara('SELECT * FROM utenti').tutti();
    for (const utente of utenti) {
      const microOggi = db.prepara(`
        SELECT ma.*, sa.nome as nome_attivita, sa.email_responsabile,
               sa.percentuale_completamento, o.nome as nome_obiettivo, o.id_team
        FROM micro_attivita ma
        JOIN sotto_attivita sa ON ma.id_sotto_attivita = sa.id
        JOIN obiettivi o ON sa.id_obiettivo = o.id
        WHERE ma.data = ?
        AND COALESCE(sa.percentuale_completamento, 0) < 100
        AND ((o.id_utente = ? AND o.id_team IS NULL)
          OR sa.email_responsabile = ?)
      `).tutti(oggi, utente.id, utente.email);

      if (microOggi.length === 0) continue;

      const completate = microOggi.filter(m => m.flag_giornaliero === 1).map(m => ({ nome: m.nome_attivita, ore: m.ore }));
      const nonCompletate = microOggi.filter(m => m.flag_giornaliero !== 1).map(m => ({ nome: m.nome_attivita, ore: m.ore }));

      await inviaReportGiornaliero(utente.email, utente.nome_utente, oggi, completate, nonCompletate);
      inviatiPersonali++;
    }

    // 2. Report team per leader/sponsor
    const teams = db.prepara('SELECT * FROM team').tutti();
    for (const team of teams) {
      const membri = db.prepara('SELECT mt.*, u.nome_utente FROM membri_team mt LEFT JOIN utenti u ON mt.id_utente = u.id WHERE mt.id_team = ?').tutti(team.id);

      const reportMembri = [];
      for (const membro of membri) {
        const microMembro = db.prepara(`
          SELECT ma.*, sa.nome as nome_attivita
          FROM micro_attivita ma
          JOIN sotto_attivita sa ON ma.id_sotto_attivita = sa.id
          JOIN obiettivi o ON sa.id_obiettivo = o.id
          WHERE ma.data = ? AND o.id_team = ?
          AND sa.email_responsabile = ?
          AND COALESCE(sa.percentuale_completamento, 0) < 100
        `).tutti(oggi, team.id, membro.email_utente);

        if (microMembro.length === 0) continue;
        reportMembri.push({
          email: membro.email_utente,
          nome: membro.nome_utente || membro.email_utente,
          completate: microMembro.filter(m => m.flag_giornaliero === 1).map(m => ({ nome: m.nome_attivita, ore: m.ore })),
          nonCompletate: microMembro.filter(m => m.flag_giornaliero !== 1).map(m => ({ nome: m.nome_attivita, ore: m.ore }))
        });
      }

      if (reportMembri.length === 0) continue;

      // Invia a leader
      const destinatari = membri.filter(m => m.ruolo === 'leader' || m.ruolo === 'sponsor');
      // Aggiungi anche il creatore del team se non è già nei destinatari
      if (!destinatari.find(d => d.email_utente === team.email_leader)) {
        destinatari.push({ email_utente: team.email_leader, nome_utente: team.nome_leader });
      }

      // Invia anche agli stakeholder
      const stakeholders = membri.filter(m => m.ruolo === 'stakeholder');
      destinatari.push(...stakeholders);

      for (const dest of destinatari) {
        await inviaReportTeam(dest.email_utente, dest.nome_utente || dest.email_utente, team.nome, oggi, reportMembri);
        inviatiTeam++;
      }
    }

    console.log(`📧 [REPORT] Inviati ${inviatiPersonali} report personali + ${inviatiTeam} report team`);
    return { inviati: inviatiPersonali + inviatiTeam, personali: inviatiPersonali, team: inviatiTeam };
  } catch (err) {
    console.error('Errore invio report giornaliero:', err);
    return { inviati: 0, errore: err.message };
  }
}

// ============ CRON: controlla ogni minuto ============
function avviaCron() {
  console.log('⏰ [CRON] Job programmati attivati (report ore 17:00, scadenze ore 08:00)');

  setInterval(() => {
    const oraMinuto = ottieniOraMinuto();
    const oggi = ottieniOggi();

    // Alle 17:00 → report giornaliero
    if (oraMinuto === '17:00' && ultimoReportInviato !== oggi) {
      ultimoReportInviato = oggi;
      inviaReportGiornalieroTutti();
    }

    // Alle 08:00 → scadenze
    if (oraMinuto === '08:00') {
      controllaScadenze();
    }
  }, 60000); // ogni 60 secondi
}

module.exports = { avviaCron, inviaReportGiornalieroTutti, controllaScadenze };
