const Festivita = require('date-holidays');

const calendarioIT = new Festivita('IT');

/** Controlla se una data è festiva in Italia */
function eFestivo(dataStr) {
  const d = new Date(dataStr + 'T00:00:00');
  const festivita = calendarioIT.isHoliday(d);
  return festivita && festivita.length > 0;
}

/** Controlla se una data è un giorno lavorativo (lun-ven, no festivi) */
function eGiornoLavorativo(dataStr) {
  const d = new Date(dataStr + 'T00:00:00');
  const giornoSettimana = d.getDay();
  if (giornoSettimana === 0 || giornoSettimana === 6) return false; // dom o sab
  if (eFestivo(dataStr)) return false;
  return true;
}

/** Formatta data come YYYY-MM-DD */
function formattaData(data) {
  const a = data.getFullYear();
  const m = String(data.getMonth() + 1).padStart(2, '0');
  const g = String(data.getDate()).padStart(2, '0');
  return `${a}-${m}-${g}`;
}

/** Trova il prossimo giorno lavorativo dopo una data */
function prossimoGiornoLavorativo(dataStr) {
  let d = new Date(dataStr + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  while (!eGiornoLavorativo(formattaData(d))) {
    d.setDate(d.getDate() + 1);
  }
  return formattaData(d);
}

/** Trova il primo giorno lavorativo a partire da (inclusa) una data */
function primoGiornoLavorativoDa(dataStr) {
  if (eGiornoLavorativo(dataStr)) return dataStr;
  return prossimoGiornoLavorativo(dataStr);
}

/**
 * Genera le micro-attività (slot giornalieri) per una sotto-attività.
 * Ritorna array di { data, ore, etichetta }
 */
function generaMicroAttivita(sottoAttivita, dataInizio, orarioGiornalieroEsistente = {}) {
  const { nome, ore_totali, ore_per_giorno } = sottoAttivita;
  let oreRimanenti = ore_totali;
  let dataCorrente = primoGiornoLavorativoDa(dataInizio);
  const microAttivita = [];
  const MAX_ORE_GIORNO = 8;

  let iterazione = 0;
  const MAX_ITERAZIONI = 1000;

  while (oreRimanenti > 0 && iterazione < MAX_ITERAZIONI) {
    iterazione++;
    const oreEsistenti = orarioGiornalieroEsistente[dataCorrente] || 0;
    const oreDisponibili = Math.max(0, MAX_ORE_GIORNO - oreEsistenti);

    if (oreDisponibili <= 0) {
      dataCorrente = prossimoGiornoLavorativo(dataCorrente);
      continue;
    }

    const oreDaAssegnare = Math.min(ore_per_giorno, oreRimanenti, oreDisponibili);

    if (oreDaAssegnare > 0) {
      microAttivita.push({
        data: dataCorrente,
        ore: oreDaAssegnare,
        etichetta: `${nome} - ${oreDaAssegnare}h`
      });
      orarioGiornalieroEsistente[dataCorrente] = (orarioGiornalieroEsistente[dataCorrente] || 0) + oreDaAssegnare;
      oreRimanenti -= oreDaAssegnare;
    }
    dataCorrente = prossimoGiornoLavorativo(dataCorrente);
  }
  return microAttivita;
}

/** Calcola la data di fine stimata per un macro-obiettivo */
function calcolaDataFine(dataInizio, oreTotali) {
  let oreRimanenti = oreTotali;
  let dataCorrente = primoGiornoLavorativoDa(dataInizio);
  const MAX_ORE_GIORNO = 8;
  let iterazione = 0;

  while (oreRimanenti > 0 && iterazione < 10000) {
    iterazione++;
    const oreOggi = Math.min(MAX_ORE_GIORNO, oreRimanenti);
    oreRimanenti -= oreOggi;
    if (oreRimanenti > 0) dataCorrente = prossimoGiornoLavorativo(dataCorrente);
  }
  return dataCorrente;
}

/** Ottieni le festività italiane per un anno */
function ottieniFestivitaAnno(anno) {
  const festivita = calendarioIT.getHolidays(anno);
  return festivita
    .filter(f => f.type === 'public')
    .map(f => ({ data: formattaData(new Date(f.date)), nome: f.name }));
}

/** Calcola le ore giornaliere totali per un utente (esclude sotto-attività al 100%) */
function ottieniOreGiornaliereUtente(db, idUtente, emailUtente) {
  const righe = db.prepara(`
    SELECT ma.data, SUM(ma.ore) as ore_totali
    FROM micro_attivita ma
    JOIN sotto_attivita sa ON ma.id_sotto_attivita = sa.id
    JOIN obiettivi o ON sa.id_obiettivo = o.id
    WHERE ((o.id_utente = ? AND o.id_team IS NULL)
      OR sa.email_responsabile = ?
      OR sa.id IN (SELECT id_sotto_attivita FROM collaboratori_attivita WHERE email_utente = ?))
    AND COALESCE(sa.percentuale_completamento, 0) < 100
    GROUP BY ma.data
  `).tutti(idUtente, emailUtente, emailUtente);

  const oreGiornaliere = {};
  for (const riga of righe) {
    oreGiornaliere[riga.data] = riga.ore_totali;
  }
  return oreGiornaliere;
}

module.exports = {
  eFestivo, eGiornoLavorativo, formattaData, prossimoGiornoLavorativo,
  primoGiornoLavorativoDa, generaMicroAttivita, calcolaDataFine,
  ottieniFestivitaAnno, ottieniOreGiornaliereUtente, risolviConflitti
};

/**
 * Risolve automaticamente i conflitti (giorni con >8h).
 * Strategia: per ogni giorno in conflitto, sposta le micro-attività in eccesso
 * (partendo da quelle con meno ore) ai prossimi giorni lavorativi disponibili.
 */
function risolviConflitti(db, idUtente, emailUtente) {
  const MAX_ORE = 8;
  let spostamenti = 0;

  // Ottieni tutte le micro-attività dell'utente ordinate per data (escluse al 100%)
  const tutteMicro = db.prepara(`
    SELECT ma.id, ma.data, ma.ore, ma.id_sotto_attivita, sa.email_responsabile
    FROM micro_attivita ma
    JOIN sotto_attivita sa ON ma.id_sotto_attivita = sa.id
    JOIN obiettivi o ON sa.id_obiettivo = o.id
    WHERE ((o.id_utente = ? AND o.id_team IS NULL)
       OR sa.email_responsabile = ?)
    AND COALESCE(sa.percentuale_completamento, 0) < 100
    ORDER BY ma.data, ma.ore DESC
  `).tutti(idUtente, emailUtente);

  // Raggruppa per giorno
  const perGiorno = {};
  for (const m of tutteMicro) {
    if (!perGiorno[m.data]) perGiorno[m.data] = [];
    perGiorno[m.data].push(m);
  }

  // Per ogni giorno in conflitto
  const giorniOrdinati = Object.keys(perGiorno).sort();
  const oreOccupate = {}; // traccia le ore dopo gli spostamenti

  // Prima calcola le ore attuali
  for (const giorno of giorniOrdinati) {
    oreOccupate[giorno] = perGiorno[giorno].reduce((s, m) => s + m.ore, 0);
  }

  for (const giorno of giorniOrdinati) {
    if (oreOccupate[giorno] <= MAX_ORE) continue;

    // Ordina le micro del giorno: sposta quelle con meno ore prima
    const microGiorno = perGiorno[giorno].sort((a, b) => a.ore - b.ore);

    for (const micro of microGiorno) {
      if (oreOccupate[giorno] <= MAX_ORE) break;

      // Trova il prossimo giorno lavorativo con spazio
      let nuovoGiorno = prossimoGiornoLavorativo(giorno);
      let tentativo = 0;
      while (tentativo < 365) {
        const oreNuovoGiorno = oreOccupate[nuovoGiorno] || 0;
        if (oreNuovoGiorno + micro.ore <= MAX_ORE) break;
        nuovoGiorno = prossimoGiornoLavorativo(nuovoGiorno);
        tentativo++;
      }

      if (tentativo < 365) {
        // Sposta la micro-attività
        db.prepara('UPDATE micro_attivita SET data = ? WHERE id = ?').esegui(nuovoGiorno, micro.id);
        oreOccupate[giorno] -= micro.ore;
        oreOccupate[nuovoGiorno] = (oreOccupate[nuovoGiorno] || 0) + micro.ore;
        spostamenti++;
      }
    }
  }

  return spostamenti;
}
