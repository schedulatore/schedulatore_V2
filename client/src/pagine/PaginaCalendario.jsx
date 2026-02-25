import React, { useState, useEffect, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { apiObiettivi } from '../utilita/api.js';

function PaginaCalendario({ utente }) {
  const [eventi, impostaEventi] = useState([]);
  const [conflitti, impostaConflitti] = useState({});
  const [totaliGiornalieri, impostaTotali] = useState({});
  const [giornoSelez, impostaGiornoSelez] = useState(null);
  const [caricamento, impostaCaricamento] = useState(true);
  const [messaggio, impostaMessaggio] = useState('');

  const carica = useCallback(async () => {
    try {
      const ris = await apiObiettivi.calendario();
      impostaConflitti(ris.data.conflitti || {});
      impostaTotali(ris.data.totaliGiornalieri || {});
      impostaEventi((ris.data.eventi || []).map(ev => {
        const completata = (ev.percentuale_completamento || 0) >= 100;
        return {
          id: String(ev.id),
          title: `${completata ? '✅ ' : ''}${ev.nome_attivita || ev.activity_name} (${ev.ore}h)`,
          date: ev.data,
          extendedProps: {
            ore: ev.ore, idMicro: ev.id, nomeObiettivo: ev.nome_obiettivo,
            idTeam: ev.id_team, nomeTeam: ev.nome_team, completata,
            flagGiornaliero: ev.flag_giornaliero || 0
          },
          className: completata ? 'fc-event-completed' : (ev.id_team ? 'fc-event-team' : 'fc-event-personal'),
          allDay: true, editable: !completata
        };
      }));
    } catch (err) { console.error(err); }
    impostaCaricamento(false);
  }, []);

  useEffect(() => { carica(); }, [carica]);

  // Drag & drop
  const gestisciTrascinamento = async (info) => {
    const idMicro = parseInt(info.event.extendedProps.idMicro);
    try { await apiObiettivi.spostaMicro(idMicro, info.event.startStr); carica(); }
    catch (err) { info.revert(); alert(err.response?.data?.errore || 'Errore.'); }
  };

  // Toggle flag giornaliero OK/NOK
  const toggleFlag = async (idMicro, valoreAttuale) => {
    try { await apiObiettivi.flagGiornaliero(idMicro, valoreAttuale === 1 ? 0 : 1); carica(); }
    catch (err) { console.error(err); }
  };

  // Sistema conflitti
  const sistemaConflitti = async () => {
    try { const ris = await apiObiettivi.sistemaConflitti(); impostaMessaggio(ris.data.messaggio); carica(); setTimeout(() => impostaMessaggio(''), 4000); }
    catch (err) { impostaMessaggio('Errore.'); setTimeout(() => impostaMessaggio(''), 4000); }
  };

  const numConflitti = Object.keys(conflitti).length;
  const oggiStr = new Date().toISOString().split('T')[0];

  if (caricamento) return <div className="loading"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Calendario</h1>
          <p className="page-subtitle">Trascina le attività · Segna OK/NOK giornaliero</p>
        </div>
        <button className="btn btn-secondary" onClick={sistemaConflitti} style={{ display: numConflitti > 0 ? 'inline-flex' : 'none' }}>🔧 Sistema Conflitti</button>
      </div>

      {messaggio && <div className="alert alert-success" style={{ marginBottom: 16 }}>✅ {messaggio}</div>}

      {numConflitti > 0 && (
        <div className="alert alert-danger" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <span>⚠️ <strong>{numConflitti} giorni</strong> con conflitti (più di 8h).</span>
            <button className="btn btn-primary btn-sm" onClick={sistemaConflitti}>🔧 Sistema</button>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 20 }}>
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth" locale="it" firstDay={1}
          headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,dayGridWeek' }}
          buttonText={{ today: 'Oggi', month: 'Mese', week: 'Settimana' }}
          events={eventi} height="auto" dayMaxEvents={3}
          moreLinkText={n => `+${n} altre`}
          editable={true} eventDrop={gestisciTrascinamento}
          dateClick={info => impostaGiornoSelez(info.dateStr)}
          dayCellDidMount={info => {
            const dataStr = info.date.toISOString().split('T')[0];
            const oreTot = totaliGiornalieri[dataStr];
            if (oreTot) {
              const ind = document.createElement('div');
              ind.style.cssText = `position:absolute;top:4px;right:4px;font-size:10px;font-weight:700;padding:1px 5px;border-radius:4px;font-family:var(--font-display);
                background:${oreTot > 8 ? 'rgba(233,69,96,0.2)' : oreTot > 6 ? 'rgba(255,167,38,0.2)' : 'rgba(102,187,106,0.2)'};
                color:${oreTot > 8 ? 'var(--accent-primary)' : oreTot > 6 ? 'var(--accent-warm)' : 'var(--accent-green)'}`;
              ind.textContent = `${oreTot}h`;
              info.el.style.position = 'relative';
              info.el.appendChild(ind);
            }
          }}
        />
      </div>

      {/* Dettaglio giorno con flag OK/NOK */}
      {giornoSelez && (() => {
        const eventiGiorno = eventi.filter(e => e.date === giornoSelez);
        const oreTot = totaliGiornalieri[giornoSelez] || 0;
        const percGiorno = Math.min(100, (oreTot / 8) * 100);
        const colBarra = oreTot > 8 ? 'var(--accent-primary)' : oreTot > 6 ? 'var(--accent-warm)' : 'var(--accent-green)';
        const eOggi = giornoSelez === oggiStr;
        const ePassato = giornoSelez <= oggiStr;

        return (
          <div style={{ marginTop: 20, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-md)' }}>
            {/* Header */}
            <div style={{ padding: '20px 24px', background: oreTot > 8 ? 'rgba(233,69,96,0.08)' : 'rgba(80,200,120,0.06)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, color: 'var(--text-muted)', marginBottom: 4 }}>
                  {new Date(giornoSelez + 'T00:00:00').toLocaleDateString('it-IT', { weekday: 'long' })}
                  {eOggi && <span style={{ marginLeft: 8, color: 'var(--accent-green)', fontWeight: 700 }}>· OGGI</span>}
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {new Date(giornoSelez + 'T00:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: colBarra, lineHeight: 1 }}>{oreTot}h</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>di 8h disponibili</div>
              </div>
            </div>

            {/* Barra carico */}
            <div style={{ padding: '0 24px', marginTop: 16 }}>
              <div style={{ height: 8, background: 'var(--bg-elevated)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, percGiorno)}%`, height: '100%', background: colBarra, borderRadius: 4, transition: 'width 0.4s ease' }}></div>
              </div>
              {oreTot > 8 && <div style={{ fontSize: 11, color: 'var(--accent-primary)', marginTop: 4, fontWeight: 600 }}>⚠️ Superamento di {oreTot - 8}h</div>}
            </div>

            {/* Lista attività con flag */}
            <div style={{ padding: '16px 24px 20px' }}>
              {ePassato && eventiGiorno.length > 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)' }}>
                  💡 Clicca il cerchio per segnare OK (completata) o NOK (non fatta).
                </div>
              )}
              {eventiGiorno.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                  <div style={{ fontSize: 14 }}>Nessuna attività pianificata</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {eventiGiorno.map(e => {
                    const flag = e.extendedProps.flagGiornaliero;
                    const completata = e.extendedProps.completata;
                    const bordoCol = completata ? 'var(--accent-green)' : e.extendedProps.idTeam ? 'var(--accent-blue)' : 'var(--accent-primary)';
                    return (
                      <div key={e.id} style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                        background: completata ? 'rgba(80,200,120,0.06)' : 'var(--bg-elevated)',
                        borderRadius: 'var(--radius-md)', borderLeft: `3px solid ${bordoCol}`,
                        opacity: completata ? 0.6 : 1
                      }}>
                        {/* Flag OK/NOK toggle */}
                        {ePassato && !completata && (
                          <button onClick={() => toggleFlag(e.extendedProps.idMicro, flag)}
                            style={{
                              width: 36, height: 36, minWidth: 36, borderRadius: '50%',
                              border: `2px solid ${flag === 1 ? '#4caf50' : '#ccc'}`,
                              background: flag === 1 ? '#4caf50' : 'transparent',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 15, cursor: 'pointer', transition: 'all 0.3s ease',
                              color: flag === 1 ? 'white' : '#999'
                            }}>
                            {flag === 1 ? '✓' : ''}
                          </button>
                        )}
                        {/* Ore badge */}
                        <div style={{
                          width: 36, height: 36, minWidth: 36, borderRadius: 'var(--radius-sm)',
                          background: completata ? 'rgba(80,200,120,0.15)' : e.extendedProps.idTeam ? 'rgba(74,144,217,0.15)' : 'rgba(233,69,96,0.15)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700,
                          color: completata ? 'var(--accent-green)' : e.extendedProps.idTeam ? 'var(--accent-blue)' : 'var(--accent-primary)'
                        }}>{e.extendedProps.ore}h</div>
                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: completata ? 'line-through' : 'none' }}>
                            {e.title.replace(/ \(\d+(\.\d+)?h\)/, '').replace('✅ ', '')}
                          </div>
                          {e.extendedProps.nomeObiettivo && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{e.extendedProps.nomeObiettivo}</div>}
                        </div>
                        <span className={`badge ${completata ? 'badge-completed' : e.extendedProps.idTeam ? 'badge-team' : 'badge-member'}`} style={{ fontSize: 10 }}>
                          {completata ? 'Completato' : e.extendedProps.idTeam ? e.extendedProps.nomeTeam || 'Team' : 'Personale'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default PaginaCalendario;
