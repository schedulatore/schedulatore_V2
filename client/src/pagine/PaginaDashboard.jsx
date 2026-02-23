import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiObiettivi, apiTeam } from '../utilita/api.js';

// Donut SVG component
function GraficoDonut({ dati, dimensione = 140 }) {
  const r = 50, cx = 60, cy = 60, grossezza = 16;
  const totale = dati.reduce((s, d) => s + d.valore, 0);
  if (totale === 0) return (
    <svg width={dimensione} height={dimensione} viewBox="0 0 120 120">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--bg-elevated)" strokeWidth={grossezza} />
      <text x={cx} y={cy - 4} textAnchor="middle" fill="var(--text-muted)" fontSize="14" fontWeight="700" fontFamily="var(--font-display)">0</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill="var(--text-muted)" fontSize="9">obiettivi</text>
    </svg>
  );
  const circ = 2 * Math.PI * r;
  let offset = circ * 0.25; // start from top
  return (
    <svg width={dimensione} height={dimensione} viewBox="0 0 120 120">
      {dati.map((d, i) => {
        const perc = d.valore / totale;
        const lunghezza = circ * perc;
        const el = <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={d.colore} strokeWidth={grossezza}
          strokeDasharray={`${lunghezza} ${circ - lunghezza}`} strokeDashoffset={offset}
          style={{ transition: 'all 0.5s ease' }} />;
        offset -= lunghezza;
        return el;
      })}
      <text x={cx} y={cy - 4} textAnchor="middle" fill="var(--text-primary)" fontSize="20" fontWeight="700" fontFamily="var(--font-display)">{totale}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill="var(--text-muted)" fontSize="9">obiettivi</text>
    </svg>
  );
}

function PaginaDashboard({ utente }) {
  const [obiettivi, impostaObiettivi] = useState([]);
  const [squadre, impostaSquadre] = useState([]);
  const [conflitti, impostaConflitti] = useState({});
  const [caricamento, impostaCaricamento] = useState(true);
  const [msgSuccesso, impostaMsgSuccesso] = useState('');
  const naviga = useNavigate();

  const caricaDati = useCallback(async () => {
    try {
      const [risOb, risTeam, risConf] = await Promise.all([
        apiObiettivi.tutti(), apiTeam.tutti(), apiObiettivi.verificaConflitti()
      ]);
      impostaObiettivi(risOb.data.obiettivi || []);
      impostaSquadre(risTeam.data.team || []);
      impostaConflitti(risConf.data.conflitti || {});
    } catch (err) { console.error(err); }
    impostaCaricamento(false);
  }, []);

  useEffect(() => { caricaDati(); }, [caricaDati]);

  const sistemaConflitti = async () => {
    try {
      const ris = await apiObiettivi.sistemaConflitti();
      impostaMsgSuccesso(ris.data.messaggio);
      await caricaDati();
      setTimeout(() => impostaMsgSuccesso(''), 4000);
    } catch (e) { impostaMsgSuccesso('Errore.'); setTimeout(() => impostaMsgSuccesso(''), 4000); }
  };

  const numConflitti = Object.keys(conflitti).length;
  const oreTotali = obiettivi.reduce((s, o) => s + (o.ore_totali || 0), 0);
  const oggiStr = new Date().toISOString().split('T')[0];

  // Classificazione obiettivi
  const completati = obiettivi.filter(o => (o.percentuale_media || 0) >= 100);
  const inRitardo = obiettivi.filter(o => (o.percentuale_media || 0) < 100 && o.data_fine_stimata && o.data_fine_stimata < oggiStr);
  const inOrario = obiettivi.filter(o => (o.percentuale_media || 0) < 100 && (!o.data_fine_stimata || o.data_fine_stimata >= oggiStr));

  const datiDonut = [
    { valore: completati.length, colore: '#4caf50', etichetta: 'Completati', icona: '✅' },
    { valore: inOrario.length, colore: '#4a90d9', etichetta: 'In orario', icona: '🔵' },
    { valore: inRitardo.length, colore: '#e94560', etichetta: 'In ritardo', icona: '🔴' }
  ];

  if (caricamento) return <div className="loading"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Ciao, {utente?.nome_utente || utente?.username}!</h1>
          <p className="page-subtitle">Ecco la tua situazione attuale</p>
        </div>
      </div>

      {msgSuccesso && <div className="alert alert-success" style={{ marginBottom: 16 }}>✅ {msgSuccesso}</div>}

      {numConflitti > 0 && (
        <div className="alert alert-danger" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <span>⚠️ <strong>{numConflitti} giorni</strong> con conflitti (più di 8h).</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => naviga('/calendario')}>📅 Calendario</button>
              <button className="btn btn-primary btn-sm" onClick={sistemaConflitti}>🔧 Sistema</button>
            </div>
          </div>
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card" onClick={() => naviga('/obiettivi')}><div className="stat-icon">🎯</div><div className="stat-value">{obiettivi.length}</div><div className="stat-label">Obiettivi</div></div>
        <div className="stat-card"><div className="stat-icon">⏱️</div><div className="stat-value">{oreTotali}h</div><div className="stat-label">Ore Pianificate</div></div>
        <div className="stat-card" onClick={() => naviga('/teams')}><div className="stat-icon">👥</div><div className="stat-value">{squadre.length}</div><div className="stat-label">Team</div></div>
        <div className="stat-card" onClick={() => naviga('/calendario')}><div className="stat-icon">{numConflitti > 0 ? '🔴' : '🟢'}</div><div className="stat-value">{numConflitti}</div><div className="stat-label">Conflitti</div></div>
      </div>

      {/* Report manuale */}
      <div className="card" style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>📧 Report Giornaliero</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Automatico alle 17:00 oppure manuale</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={async () => {
            try { const ris = await apiObiettivi.testEmail(); impostaMsgSuccesso(ris.data.messaggio); setTimeout(() => impostaMsgSuccesso(''), 6000); }
            catch (e) { impostaMsgSuccesso('❌ ' + (e.response?.data?.errore || 'Email non funziona. Controlla le variabili SMTP su Render.')); setTimeout(() => impostaMsgSuccesso(''), 8000); }
          }}>🧪 Test Email</button>
          <button className="btn btn-secondary btn-sm" onClick={async () => {
            try { const ris = await apiObiettivi.inviaReport(); impostaMsgSuccesso(ris.data.messaggio); setTimeout(() => impostaMsgSuccesso(''), 5000); }
            catch (e) { impostaMsgSuccesso('Errore invio report.'); setTimeout(() => impostaMsgSuccesso(''), 4000); }
          }}>📤 Invia Report</button>
        </div>
      </div>

      {/* Grafico Donut + Lista */}
      {obiettivi.length > 0 && (
        <div className="card" style={{ marginTop: 24 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Stato Obiettivi</h2>
          <div style={{ display: 'flex', gap: 32, alignItems: 'center', flexWrap: 'wrap' }}>
            <GraficoDonut dati={datiDonut} dimensione={160} />
            <div style={{ flex: 1, minWidth: 200 }}>
              {/* Legenda */}
              <div style={{ display: 'flex', gap: 20, marginBottom: 16 }}>
                {datiDonut.map((d, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 12, height: 12, borderRadius: 3, background: d.colore }}></div>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{d.etichetta} ({d.valore})</span>
                  </div>
                ))}
              </div>

              {/* Lista dettagliata */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
                {[...inRitardo.map(o => ({ ...o, stato: 'ritardo' })),
                  ...inOrario.map(o => ({ ...o, stato: 'orario' })),
                  ...completati.map(o => ({ ...o, stato: 'completato' }))
                ].map(ob => {
                  const col = ob.stato === 'completato' ? '#4caf50' : ob.stato === 'ritardo' ? '#e94560' : '#4a90d9';
                  const etichetta = ob.stato === 'completato' ? '✅ Completato' : ob.stato === 'ritardo' ? '🔴 In ritardo' : '🔵 In orario';
                  return (
                    <div key={ob.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', borderLeft: `3px solid ${col}` }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ob.nome}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ob.ore_totali}h · {ob.percentuale_media || 0}%{ob.data_fine_stimata ? ` · scad. ${new Date(ob.data_fine_stimata + 'T00:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}` : ''}</div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: col, whiteSpace: 'nowrap' }}>{etichetta}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PaginaDashboard;
