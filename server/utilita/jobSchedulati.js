const { ottieniDb } = require('./database');
const {
  inviaAvvisoScadenza, inviaReportGiornaliero, inviaReportTeam
} = require('./email');
const { eGiornoLavorativo, formattaData } = require('./schedulatore');

/**
 * Job scadenza: controlla sotto-attività con data_fine_stimata = dopodomani
 * Invia mail al responsabile
 */
async function jobAvvisoScadenza() {
  try {
    const db = ottieniDb();
    const oggi = new Date();
    const dopodomani = new Date(oggi);
    dopodomani.setDate(dopodomani.getDate() + 2);
    const dataTarget = formattaData(dopodomani);

    const sottoAtt = db.prepara(`
      SELECT sa.*, o.nome as nome_obiettivo, o.id_team, t.nome as nome_team
      FROM sotto_attivita sa
      JOIN obiettivi o ON sa.id_obiettivo = o.id
      LEFT JOIN team t ON o.id_team = t.id
      WHERE sa.data_fine_stimata = ?
      AND COALESCE(sa.percentuale_completamento, 0) < 100
      AND sa.email_responsabile IS NOT NULL
    `).tutti(dataTarget);

    let inviate = 0;
    for (const sa of sottoAtt) {
      await inviaAvvisoScadenza(
        sa.email_responsabile, sa.nome, sa.nome_obiettivo,
        sa.data_fine_stimata, sa.nome_team
      );
      inviate++;
    }
    if (inviate > 0) console.log(`⏰ [SCADENZE] ${inviate} avvisi scadenza inviati per ${dataTarget}`);
    return inviate;
  } catch (err) {
    console.error('Errore job avviso scadenza:', err);
    return 0;
  }
}

/**
 * Job report giornaliero: invia report a ogni utente con attività oggi
 * + report team a leader/sponsor
 */
async function jobReportGiornaliero(dataOverride) {
  try {
    const db = ottieniDb();
    const oggi = dataOverride || formattaData(new Date());

    if (!eGiornoLavorativo(oggi)) {
      console.log(`📊 [REPORT] ${oggi} non è lavorativo, skip.`);
      return { personali: 0, team: 0 };
    }

    // --- REPORT PERSONALI ---
    // Trova tutte le micro-attività di oggi con il flag completamento_giornaliero
    const microOggi = db.prepara(`
      SELECT ma.*, sa.nome as nome_attivita, sa.email_responsabile,
             o.nome as nome_obiettivo, o.id_utente, o.id_team,
             u.email as email_proprietario, u.nome_utente
      FROM micro_attivita ma
      JOIN sotto_attivita sa ON ma.id_sotto_attivita = sa.id
      JOIN obiettivi o ON sa.id_obiettivo = o.id
      JOIN utenti u ON o.id_utente = u.id
      WHERE ma.data = ?
    `).tutti(oggi);

    // Raggruppa per responsabile (email)
    const perPersona = {};
    for (const m of microOggi) {
      const email = m.email_responsabile || m.email_proprietario;
      const nome = m.nome_utente || email;
      if (!perPersona[email]) perPersona[email] = { nome, completate: [], nonCompletate: [] };
      const att = { nome: m.nome_attivita, ore: m.ore, nomeOb: m.nome_obiettivo };
      if (m.completamento_giornaliero === 1) {
        perPersona[email].completate.push(att);
      } else {
        perPersona[email].nonCompletate.push(att);
      }
    }

    let reportPersonali = 0;
    for (const [email, dati] of Object.entries(perPersona)) {
      if (dati.completate.length + dati.nonCompletate.length === 0) continue;
      await inviaReportGiornaliero(email, dati.nome, oggi, dati.completate, dati.nonCompletate);
      reportPersonali++;
    }

    // --- REPORT TEAM ---
    // Trova tutti i team con attività oggi
    const teamConAttivita = db.prepara(`
      SELECT DISTINCT o.id_team, t.nome as nome_team, t.id_utente_leader,
             t.email_leader, t.nome_leader, t.email_sponsor, t.nome_sponsor, t.stakeholder
      FROM micro_attivita ma
      JOIN sotto_attivita sa ON ma.id_sotto_attivita = sa.id
      JOIN obiettivi o ON sa.id_obiettivo = o.id
      JOIN team t ON o.id_team = t.id
      WHERE ma.data = ? AND o.id_team IS NOT NULL
    `).tutti(oggi);

    let reportTeam = 0;
    for (const team of teamConAttivita) {
      // Raccogli dati per membro
      const microTeam = db.prepara(`
        SELECT ma.*, sa.nome as nome_attivita, sa.email_responsabile
        FROM micro_attivita ma
        JOIN sotto_attivita sa ON ma.id_sotto_attivita = sa.id
        JOIN obiettivi o ON sa.id_obiettivo = o.id
        WHERE ma.data = ? AND o.id_team = ?
      `).tutti(oggi, team.id_team);

      const reportMembri = {};
      for (const m of microTeam) {
        const email = m.email_responsabile || 'non-assegnato';
        if (!reportMembri[email]) {
          const membro = db.prepara('SELECT nome_utente FROM utenti WHERE email = ?').ottieni(email);
          reportMembri[email] = { email, nome: membro?.nome_utente || null, completate: [], nonCompletate: [] };
        }
        const att = { nome: m.nome_attivita, ore: m.ore };
        if (m.completamento_giornaliero === 1) {
          reportMembri[email].completate.push(att);
        } else {
          reportMembri[email].nonCompletate.push(att);
        }
      }

      const listaReport = Object.values(reportMembri);

      // Invia a leader
      if (team.email_leader) {
        await inviaReportTeam(team.email_leader, team.nome_leader || 'Leader', team.nome_team, oggi, listaReport);
        reportTeam++;
      }
      // Invia a sponsor
      if (team.email_sponsor && team.email_sponsor !== team.email_leader) {
        await inviaReportTeam(team.email_sponsor, team.nome_sponsor || 'Sponsor', team.nome_team, oggi, listaReport);
        reportTeam++;
      }
      // Invia a stakeholder
      if (team.stakeholder) {
        const emails = team.stakeholder.split(',').map(e => e.trim()).filter(e => e && e !== team.email_leader && e !== team.email_sponsor);
        for (const emailSh of emails) {
          await inviaReportTeam(emailSh, 'Stakeholder', team.nome_team, oggi, listaReport);
          reportTeam++;
        }
      }
    }

    console.log(`📊 [REPORT] ${reportPersonali} report personali, ${reportTeam} report team inviati per ${oggi}`);
    return { personali: reportPersonali, team: reportTeam };
  } catch (err) {
    console.error('Errore job report giornaliero:', err);
    return { personali: 0, team: 0 };
  }
}

/**
 * Avvia i job schedulati
 */
function avviaJobSchedulati() {
  console.log('⏰ Job schedulati attivati');

  // Controlla ogni minuto
  setInterval(async () => {
    const adesso = new Date();
    const ore = adesso.getHours();
    const minuti = adesso.getMinutes();

    // Alle 17:00 — report giornaliero
    if (ore === 17 && minuti === 0) {
      console.log('📊 [CRON] Avvio report giornaliero delle 17:00...');
      await jobReportGiornaliero();
    }

    // Alle 09:00 — avviso scadenze (2gg prima)
    if (ore === 9 && minuti === 0) {
      console.log('⏰ [CRON] Controllo scadenze...');
      await jobAvvisoScadenza();
    }
  }, 60000); // ogni 60 secondi
}

module.exports = { jobAvvisoScadenza, jobReportGiornaliero, avviaJobSchedulati };
