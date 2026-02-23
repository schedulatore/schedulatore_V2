const nodemailer = require('nodemailer');

const HOST_APP = process.env.URL_APP || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000';
let trasportatore;

async function ottieniTrasportatore() {
  if (trasportatore) return trasportatore;
  if (process.env.SMTP_HOST) {
    console.log(`📧 Tentativo connessione SMTP...`);
    console.log(`   Host: ${process.env.SMTP_HOST}`);
    console.log(`   Port: ${process.env.SMTP_PORT || '587'}`);
    console.log(`   Utente: ${process.env.SMTP_UTENTE}`);
    console.log(`   Password: ${process.env.SMTP_PASSWORD ? '***impostata***' : '⚠️ MANCANTE!'}`);
    console.log(`   Sicuro: ${process.env.SMTP_SICURO}`);
    
    // Configurazione specifica per Gmail
    const isGmail = process.env.SMTP_HOST.includes('gmail');
    trasportatore = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_UTENTE,
        pass: process.env.SMTP_PASSWORD
      },
      tls: {
        rejectUnauthorized: false
      }
    });
    
    // Verifica connessione
    try {
      await trasportatore.verify();
      console.log(`✅ Connessione SMTP verificata con successo!`);
    } catch (errVerifica) {
      console.error(`❌ Errore verifica SMTP: ${errVerifica.message}`);
      console.error(`   Dettagli: ${JSON.stringify(errVerifica)}`);
      // Non blocco — potrebbe funzionare lo stesso per l'invio
    }
  } else {
    console.log('📧 Nessuna configurazione SMTP — uso Ethereal (test)');
    const accountTest = await nodemailer.createTestAccount();
    trasportatore = nodemailer.createTransport({
      host: 'smtp.ethereal.email', port: 587, secure: false,
      auth: { user: accountTest.user, pass: accountTest.pass }
    });
    console.log(`   Utente test: ${accountTest.user}`);
    console.log('   Visualizza: https://ethereal.email/messages');
  }
  return trasportatore;
}

async function inviaEmail({ destinatario, oggetto, html }) {
  try {
    const t = await ottieniTrasportatore();
    const mittente = process.env.SMTP_UTENTE 
      ? `"Schedulatore" <${process.env.SMTP_UTENTE}>`
      : '"Schedulatore" <noreply@schedulatore.app>';
    console.log(`📧 Invio email a ${destinatario} — oggetto: ${oggetto}`);
    const info = await t.sendMail({ from: mittente, to: destinatario, subject: oggetto, html });
    console.log(`✅ Email inviata! MessageId: ${info.messageId}`);
    if (!process.env.SMTP_HOST) console.log(`   Anteprima: ${nodemailer.getTestMessageUrl(info)}`);
    return { successo: true, messageId: info.messageId };
  } catch (err) {
    console.error(`❌ ERRORE invio email a ${destinatario}:`, err.message);
    console.error(`   Codice: ${err.code}`);
    console.error(`   Comando: ${err.command}`);
    return { successo: false, errore: err.message, codice: err.code };
  }
}

// Funzione di test — invia email di prova
async function inviaEmailTest(destinatario) {
  return inviaEmail({
    destinatario,
    oggetto: '✅ Test Schedulatore — Email funzionante!',
    html: `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:24px;background:#fafafa;border-radius:12px;">
      <h2 style="color:#1a1a2e;">🎉 Funziona!</h2>
      <p>Se stai leggendo questa email, la configurazione SMTP dello Schedulatore è corretta.</p>
      <p style="color:#999;font-size:12px;margin-top:24px;">Schedulatore · Email di test</p>
    </div>`
  });
}

// --- TEMPLATE HTML ---
const stileBase = `font-family:'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#fafafa;border-radius:12px;`;
const stileHeader = `background:linear-gradient(135deg,#1a1a2e,#16213e);color:white;padding:20px 24px;border-radius:12px 12px 0 0;margin:-24px -24px 24px;`;
const stilePulsante = `display:inline-block;background:#e94560;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0;`;
const stileFooter = `margin-top:24px;padding-top:16px;border-top:1px solid #eee;color:#999;font-size:12px;`;

// --- MAIL INVITO TEAM ---
async function inviaInvitoTeam(emailMembro, nomeTeam, idTeam, ruolo) {
  const etichettaRuolo = { leader: 'Team Leader', sponsor: 'Sponsor', stakeholder: 'Stakeholder', membro: 'Membro' }[ruolo] || 'Membro';
  return inviaEmail({
    destinatario: emailMembro,
    oggetto: `📋 Sei stato aggiunto al Progetto "${nomeTeam}" come ${etichettaRuolo}`,
    html: `<div style="${stileBase}"><div style="${stileHeader}"><h2 style="margin:0;">Schedulatore Team</h2></div>
      <p>Ciao,</p><p>Sei stato aggiunto al Progetto <strong>${nomeTeam}</strong> con il ruolo di <strong>${etichettaRuolo}</strong>.</p>
      <a href="${HOST_APP}/teams/${idTeam}" style="${stilePulsante}">Apri Schedulatore</a>
      <p style="color:#666;font-size:14px;">Se non hai un account, registrati con questa email per accedere.</p>
      <div style="${stileFooter}">Schedulatore · Notifica automatica</div></div>`
  });
}

// --- MAIL RESET PASSWORD ---
async function inviaResetPassword(email, tokenReset) {
  return inviaEmail({
    destinatario: email, oggetto: '🔐 Recupero Password - Schedulatore',
    html: `<div style="${stileBase}"><div style="${stileHeader}"><h2 style="margin:0;">Recupero Password</h2></div>
      <p>Usa questo codice per reimpostare la password:</p>
      <div style="background:#f0f0f0;padding:16px;border-radius:8px;text-align:center;font-size:28px;font-weight:bold;letter-spacing:4px;margin:16px 0;">${tokenReset}</div>
      <p style="color:#666;font-size:14px;">Scade tra 1 ora.</p><div style="${stileFooter}">Schedulatore · Notifica automatica</div></div>`
  });
}

// --- MAIL ASSEGNAZIONE SOTTO-ATTIVITÀ ---
async function inviaAssegnazioneSottoAttivita(emailResp, nomeSa, nomeObiettivo, oreTotali, orePerGiorno, dataFineStimata, nomeTeam) {
  const scadenza = dataFineStimata ? new Date(dataFineStimata + 'T00:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }) : 'da calcolare';
  return inviaEmail({
    destinatario: emailResp,
    oggetto: `📌 Nuova attività assegnata: "${nomeSa}"`,
    html: `<div style="${stileBase}"><div style="${stileHeader}"><h2 style="margin:0;">Nuova Attività Assegnata</h2></div>
      <p>Ciao,</p><p>Ti è stata assegnata una nuova sotto-attività:</p>
      <div style="background:white;border:1px solid #e0e0e0;border-radius:8px;padding:16px;margin:16px 0;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:6px 0;color:#666;">Attività:</td><td style="padding:6px 0;font-weight:600;">${nomeSa}</td></tr>
          <tr><td style="padding:6px 0;color:#666;">Obiettivo:</td><td style="padding:6px 0;">${nomeObiettivo}</td></tr>
          ${nomeTeam ? `<tr><td style="padding:6px 0;color:#666;">Team:</td><td style="padding:6px 0;">${nomeTeam}</td></tr>` : ''}
          <tr><td style="padding:6px 0;color:#666;">Ore totali:</td><td style="padding:6px 0;">${oreTotali}h (${orePerGiorno}h/giorno)</td></tr>
          <tr><td style="padding:6px 0;color:#666;">Scadenza stimata:</td><td style="padding:6px 0;font-weight:600;color:#e94560;">${scadenza}</td></tr>
        </table>
      </div>
      <a href="${HOST_APP}/obiettivi" style="${stilePulsante}">Vedi nel Calendario</a>
      <div style="${stileFooter}">Schedulatore · Notifica automatica</div></div>`
  });
}

// --- MAIL SCADENZA 2 GIORNI ---
async function inviaAvvisoScadenza(emailResp, nomeSa, nomeObiettivo, dataFine, nomeTeam) {
  const scadenza = new Date(dataFine + 'T00:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
  return inviaEmail({
    destinatario: emailResp,
    oggetto: `⏰ Scadenza tra 2 giorni: "${nomeSa}"`,
    html: `<div style="${stileBase}"><div style="${stileHeader.replace('1a1a2e','8B4513').replace('16213e','A0522D')}"><h2 style="margin:0;">⏰ Promemoria Scadenza</h2></div>
      <p>Ciao,</p><p>La sotto-attività <strong>"${nomeSa}"</strong> scade tra <strong>2 giorni</strong> (${scadenza}).</p>
      <div style="background:white;border:1px solid #e0e0e0;border-radius:8px;padding:16px;margin:16px 0;">
        <p style="margin:4px 0;"><strong>Obiettivo:</strong> ${nomeObiettivo}</p>
        ${nomeTeam ? `<p style="margin:4px 0;"><strong>Team:</strong> ${nomeTeam}</p>` : ''}
      </div>
      <a href="${HOST_APP}/calendario" style="${stilePulsante}">Apri Calendario</a>
      <div style="${stileFooter}">Schedulatore · Notifica automatica</div></div>`
  });
}

// --- MAIL REPORT GIORNALIERO PERSONALE ---
async function inviaReportGiornaliero(emailUtente, nomeUtente, data, attivitaCompletate, attivitaNonCompletate) {
  const dataStr = new Date(data + 'T00:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const totali = attivitaCompletate.length + attivitaNonCompletate.length;
  const perc = totali > 0 ? Math.round((attivitaCompletate.length / totali) * 100) : 0;
  const colPerc = perc >= 80 ? '#4caf50' : perc >= 50 ? '#ff9800' : '#e94560';

  let righeOk = attivitaCompletate.map(a => `<tr><td style="padding:6px 12px;">✅ ${a.nome}</td><td style="padding:6px 12px;text-align:right;">${a.ore}h</td></tr>`).join('');
  let righeNo = attivitaNonCompletate.map(a => `<tr><td style="padding:6px 12px;color:#e94560;">❌ ${a.nome}</td><td style="padding:6px 12px;text-align:right;color:#e94560;">${a.ore}h</td></tr>`).join('');

  return inviaEmail({
    destinatario: emailUtente,
    oggetto: `📊 Report giornaliero ${dataStr} — ${perc}% completato`,
    html: `<div style="${stileBase}"><div style="${stileHeader}"><h2 style="margin:0;">📊 Report Giornaliero</h2><p style="margin:4px 0 0;opacity:0.8;font-size:14px;">${dataStr}</p></div>
      <p>Ciao <strong>${nomeUtente}</strong>,</p>
      <div style="text-align:center;margin:20px 0;">
        <div style="display:inline-block;width:80px;height:80px;border-radius:50%;border:4px solid ${colPerc};line-height:80px;font-size:24px;font-weight:700;color:${colPerc};">${perc}%</div>
        <p style="color:#666;font-size:14px;margin-top:8px;">${attivitaCompletate.length} di ${totali} attività completate</p>
      </div>
      ${attivitaCompletate.length > 0 ? `<h3 style="color:#4caf50;font-size:14px;">✅ Completate</h3><table style="width:100%;background:white;border-radius:8px;border:1px solid #e0e0e0;border-collapse:collapse;">${righeOk}</table>` : ''}
      ${attivitaNonCompletate.length > 0 ? `<h3 style="color:#e94560;font-size:14px;margin-top:16px;">❌ Non completate</h3><table style="width:100%;background:white;border-radius:8px;border:1px solid #e0e0e0;border-collapse:collapse;">${righeNo}</table>` : ''}
      ${attivitaNonCompletate.length > 0 ? `<p style="color:#666;margin-top:12px;">Le attività non completate restano pianificate nel calendario.</p>` : `<p style="color:#4caf50;font-weight:600;margin-top:12px;">Ottimo lavoro, tutto completato! 🎉</p>`}
      <div style="${stileFooter}">Schedulatore · Report automatico delle 17:00</div></div>`
  });
}

// --- MAIL REPORT TEAM PER LEADER/SPONSOR ---
async function inviaReportTeam(emailLeader, nomeLeader, nomeTeam, data, reportMembri) {
  const dataStr = new Date(data + 'T00:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  let righeMembri = '';
  for (const m of reportMembri) {
    const tot = m.completate.length + m.nonCompletate.length;
    if (tot === 0) continue;
    const perc = Math.round((m.completate.length / tot) * 100);
    const col = perc >= 80 ? '#4caf50' : perc >= 50 ? '#ff9800' : '#e94560';
    const semaforo = perc >= 80 ? '🟢' : perc >= 50 ? '🟡' : '🔴';
    const dettagliOk = m.completate.map(a => `✅ ${a.nome} (${a.ore}h)`).join(', ');
    const dettagliNo = m.nonCompletate.map(a => `❌ ${a.nome} (${a.ore}h)`).join(', ');
    righeMembri += `<tr style="border-bottom:1px solid #eee;">
      <td style="padding:10px 12px;"><strong>${m.nome || m.email}</strong><br><span style="font-size:11px;color:#999;">${m.email}</span></td>
      <td style="padding:10px 12px;text-align:center;font-size:18px;">${semaforo}</td>
      <td style="padding:10px 12px;text-align:center;font-weight:700;color:${col};">${perc}%</td>
      <td style="padding:10px 12px;font-size:12px;">${dettagliOk}${dettagliOk && dettagliNo ? '<br>' : ''}${dettagliNo}</td>
    </tr>`;
  }

  return inviaEmail({
    destinatario: emailLeader,
    oggetto: `📋 Report Team "${nomeTeam}" — ${dataStr}`,
    html: `<div style="${stileBase}"><div style="${stileHeader.replace('1a1a2e','0d3b66').replace('16213e','1a5276')}"><h2 style="margin:0;">📋 Report Team</h2><p style="margin:4px 0 0;opacity:0.8;font-size:14px;">${nomeTeam} — ${dataStr}</p></div>
      <p>Ciao <strong>${nomeLeader}</strong>,</p><p>Ecco il report giornaliero del tuo team:</p>
      ${righeMembri ? `<table style="width:100%;background:white;border-radius:8px;border:1px solid #e0e0e0;border-collapse:collapse;">
        <tr style="background:#f5f5f5;"><th style="padding:8px 12px;text-align:left;">Membro</th><th style="padding:8px 12px;">Stato</th><th style="padding:8px 12px;">%</th><th style="padding:8px 12px;text-align:left;">Dettagli</th></tr>
        ${righeMembri}</table>` : '<p style="color:#999;">Nessuna attività pianificata per oggi.</p>'}
      <a href="${HOST_APP}/teams" style="${stilePulsante}">Apri Dashboard Team</a>
      <div style="${stileFooter}">Schedulatore · Report automatico delle 17:00</div></div>`
  });
}

module.exports = {
  inviaEmail, inviaInvitoTeam, inviaResetPassword,
  inviaAssegnazioneSottoAttivita, inviaAvvisoScadenza,
  inviaReportGiornaliero, inviaReportTeam,
  inviaEmailTest, ottieniTrasportatore, HOST_APP
};
