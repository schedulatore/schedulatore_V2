import React, { useState, useEffect, useCallback } from 'react';
import { apiObiettivi } from '../utilita/api.js';
import Modale from '../componenti/Modale.jsx';

// Componente torta a 4 spicchi
function TortaCompletamento({ percentuale, dimensione = 52, onClick }) {
  const r = dimensione / 2;
  const spicchi = [
    { val: 25, angolo: 0 },
    { val: 50, angolo: 90 },
    { val: 75, angolo: 180 },
    { val: 100, angolo: 270 }
  ];
  const colore = (val) => val <= percentuale ? '#4caf50' : '#e0e0e0';

  const percorsoSpicchio = (angInizio, angFine) => {
    const rad1 = (angInizio - 90) * Math.PI / 180;
    const rad2 = (angFine - 90) * Math.PI / 180;
    const x1 = r + r * 0.85 * Math.cos(rad1);
    const y1 = r + r * 0.85 * Math.sin(rad1);
    const x2 = r + r * 0.85 * Math.cos(rad2);
    const y2 = r + r * 0.85 * Math.sin(rad2);
    return `M ${r} ${r} L ${x1} ${y1} A ${r * 0.85} ${r * 0.85} 0 0 1 ${x2} ${y2} Z`;
  };

  // Logica click: se clicchi lo spicchio che corrisponde alla percentuale attuale, scende allo spicchio prima.
  // Se clicchi uno spicchio diverso, imposta quella percentuale.
  const gestisciClick = (val) => {
    if (!onClick) return;
    if (val === percentuale) {
      // Toggle: scendi al livello precedente (o 0 se sei a 25)
      const idx = spicchi.findIndex(s => s.val === val);
      onClick(idx > 0 ? spicchi[idx - 1].val : 0);
    } else {
      onClick(val);
    }
  };

  return (
    <svg width={dimensione} height={dimensione} style={{ cursor: onClick ? 'pointer' : 'default' }}
      viewBox={`0 0 ${dimensione} ${dimensione}`}>
      {spicchi.map((s, i) => (
        <path key={i} d={percorsoSpicchio(s.angolo, s.angolo + 88)}
          fill={colore(s.val)} stroke="white" strokeWidth="1.5"
          onClick={(e) => { e.stopPropagation(); gestisciClick(s.val); }}
          style={{ transition: 'fill 0.2s' }}>
          <title>{s.val}%</title>
        </path>
      ))}
      <text x={r} y={r + 1} textAnchor="middle" dominantBaseline="middle"
        fontSize={dimensione * 0.28} fontWeight="700" fill="#333" fontFamily="var(--font-display)">
        {percentuale}%
      </text>
    </svg>
  );
}

// Componente barra percentuale per obiettivo (media)
function BarraPercentualeMedia({ percentuale }) {
  const col = percentuale >= 100 ? '#4caf50' : percentuale >= 50 ? '#ff9800' : percentuale > 0 ? '#2196f3' : '#e0e0e0';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
      <div style={{ flex: 1, height: 6, background: '#e0e0e0', borderRadius: 3 }}>
        <div style={{ width: `${Math.min(100, percentuale)}%`, height: '100%', background: col, borderRadius: 3, transition: 'width 0.3s' }}></div>
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: col, fontFamily: 'var(--font-display)', minWidth: 32 }}>{percentuale}%</span>
    </div>
  );
}

function PaginaObiettivi({ utente }) {
  const [obiettivi, impostaObiettivi] = useState([]);
  const [caricamento, impostaCaricamento] = useState(true);
  const [mostraCreaOb, impostaMostraCreaOb] = useState(false);
  const [mostraModificaOb, impostaMostraModificaOb] = useState(false);
  const [mostraCreaSa, impostaMostraCreaSa] = useState(false);
  const [mostraModificaSa, impostaMostraModificaSa] = useState(false);
  const [idObSelezionato, impostaIdObSelezionato] = useState(null);
  const [obSelezionato, impostaObSelezionato] = useState(null);
  const [saSelezionata, impostaSaSelezionata] = useState(null);
  const [espanso, impostaEspanso] = useState({});
  const [moduloOb, impostaModuloOb] = useState({ nome: '', data_inizio: '', ore_totali: '', note: '' });
  const [moduloSa, impostaModuloSa] = useState({ nome: '', ore_totali: '', ore_per_giorno: 1, email_responsabile: '', collaboratori: '' });
  const [errore, impostaErrore] = useState('');
  const oggiStr = new Date().toISOString().split('T')[0];

  const carica = useCallback(async () => {
    try { const ris = await apiObiettivi.tutti(); impostaObiettivi(ris.data.obiettivi || []); } catch (err) { console.error(err); }
    impostaCaricamento(false);
  }, []);

  useEffect(() => { carica(); }, [carica]);

  const creaObiettivo = async (e) => {
    e.preventDefault(); impostaErrore('');
    try { await apiObiettivi.crea({ ...moduloOb, ore_totali: parseFloat(moduloOb.ore_totali) }); impostaMostraCreaOb(false); carica(); }
    catch (err) { impostaErrore(err.response?.data?.errore || 'Errore.'); }
  };

  const eliminaObiettivo = async (id) => {
    if (!window.confirm('Eliminare questo obiettivo?')) return;
    try { await apiObiettivi.elimina(id); carica(); } catch (err) { console.error(err); }
  };

  const modificaObiettivo = async (e) => {
    e.preventDefault(); impostaErrore('');
    try {
      await apiObiettivi.aggiorna(obSelezionato.id, {
        nome: moduloOb.nome,
        data_inizio: moduloOb.data_inizio,
        ore_totali: parseFloat(moduloOb.ore_totali),
        note: moduloOb.note
      });
      impostaMostraModificaOb(false); carica();
    } catch (err) { impostaErrore(err.response?.data?.errore || 'Errore.'); }
  };

  const apriModificaOb = (ob) => {
    impostaObSelezionato(ob);
    impostaModuloOb({ nome: ob.nome, data_inizio: ob.data_inizio, ore_totali: ob.ore_totali, note: ob.note || '' });
    impostaErrore('');
    impostaMostraModificaOb(true);
  };

  const creaSottoAttivita = async (e) => {
    e.preventDefault(); impostaErrore('');
    try {
      const collabs = moduloSa.collaboratori.split(',').map(c => c.trim()).filter(c => c);
      await apiObiettivi.aggiungiSottoAttivita(idObSelezionato, {
        nome: moduloSa.nome, ore_totali: parseFloat(moduloSa.ore_totali),
        ore_per_giorno: parseFloat(moduloSa.ore_per_giorno),
        email_responsabile: moduloSa.email_responsabile || utente?.email, collaboratori: collabs
      });
      impostaMostraCreaSa(false); carica();
    } catch (err) { impostaErrore(err.response?.data?.errore || 'Errore.'); }
  };

  const modificaSottoAttivita = async (e) => {
    e.preventDefault(); impostaErrore('');
    try {
      await apiObiettivi.aggiornaSottoAttivita(idObSelezionato, saSelezionata.id, {
        nome: moduloSa.nome, ore_totali: parseFloat(moduloSa.ore_totali),
        ore_per_giorno: parseFloat(moduloSa.ore_per_giorno),
        email_responsabile: moduloSa.email_responsabile
      });
      impostaMostraModificaSa(false); carica();
    } catch (err) { impostaErrore(err.response?.data?.errore || 'Errore.'); }
  };

  const eliminaSottoAttivita = async (idOb, idSa) => {
    if (!window.confirm('Eliminare questa sotto-attività?')) return;
    try { await apiObiettivi.eliminaSottoAttivita(idOb, idSa); carica(); } catch (err) { console.error(err); }
  };

  const aggiornaPercentuale = async (idSa, perc) => {
    try { await apiObiettivi.aggiornaPercentuale(idSa, perc); carica(); } catch (err) { console.error(err); }
  };

  const apriModificaSa = (ob, sa) => {
    impostaIdObSelezionato(ob.id);
    impostaSaSelezionata(sa);
    impostaModuloSa({ nome: sa.nome, ore_totali: sa.ore_totali, ore_per_giorno: sa.ore_per_giorno, email_responsabile: sa.email_responsabile || '', collaboratori: '' });
    impostaErrore('');
    impostaMostraModificaSa(true);
  };

  if (caricamento) return <div className="loading"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Obiettivi Personali</h1>
          <p className="page-subtitle">Gestisci i tuoi macro-obiettivi e sotto-attività</p>
        </div>
        <button className="btn btn-primary" onClick={() => {
          impostaModuloOb({ nome: '', data_inizio: oggiStr, ore_totali: '', note: '' }); impostaErrore(''); impostaMostraCreaOb(true);
        }}>+ Nuovo Obiettivo</button>
      </div>

      {obiettivi.length === 0 ? (
        <div className="card"><div className="empty-state">
          <div className="empty-state-icon">🎯</div>
          <div className="empty-state-title">Nessun obiettivo</div>
          <div className="empty-state-text">Crea il tuo primo macro-obiettivo.</div>
          <button className="btn btn-primary" onClick={() => { impostaModuloOb({ nome: '', data_inizio: oggiStr, ore_totali: '', note: '' }); impostaMostraCreaOb(true); }}>Crea Obiettivo</button>
        </div></div>
      ) : (
        <div className="objectives-grid">
          {obiettivi.map(ob => {
            const oreAss = ob.sotto_attivita?.reduce((s, sa) => s + sa.ore_totali, 0) || 0;
            const percOre = ob.ore_totali > 0 ? (oreAss / ob.ore_totali) * 100 : 0;
            return (
              <div key={ob.id} className="objective-card">
                <div className="objective-header">
                  <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => impostaEspanso(p => ({ ...p, [ob.id]: !p[ob.id] }))}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div className="objective-name">{espanso[ob.id] ? '▾' : '▸'} {ob.nome}</div>
                      <BarraPercentualeMedia percentuale={ob.percentuale_media || 0} />
                    </div>
                    <div className="objective-meta">
                      <span className="objective-meta-item">📅 {new Date(ob.data_inizio + 'T00:00:00').toLocaleDateString('it-IT')}</span>
                      <span className="objective-meta-item">⏱️ {ob.ore_totali}h</span>
                      {ob.data_fine_stimata && <span className="objective-meta-item">🏁 {new Date(ob.data_fine_stimata + 'T00:00:00').toLocaleDateString('it-IT')}</span>}
                    </div>
                    <div className="hours-bar"><div className="hours-bar-track">
                      <div className={`hours-bar-fill ${percOre > 100 ? 'danger' : percOre > 80 ? 'warning' : ''}`} style={{ width: `${Math.min(100, percOre)}%` }}></div>
                    </div><span className="hours-label">{oreAss}/{ob.ore_totali}h</span></div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => apriModificaOb(ob)} title="Modifica">✏️</button>
                    <button className="btn btn-danger btn-sm" onClick={() => eliminaObiettivo(ob.id)} title="Elimina">🗑️</button>
                  </div>
                </div>

                {espanso[ob.id] && (
                  <div className="objective-body">
                    {ob.note && <div style={{ fontSize: 13, color: 'var(--text-secondary)', padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', marginBottom: 16, borderLeft: '3px solid var(--accent-warm)' }}>📝 {ob.note}</div>}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Sotto-Attività ({ob.sotto_attivita?.length || 0})</h3>
                      <button className="btn btn-secondary btn-sm" onClick={() => {
                        impostaIdObSelezionato(ob.id);
                        impostaModuloSa({ nome: '', ore_totali: '', ore_per_giorno: 1, email_responsabile: '', collaboratori: '' });
                        impostaErrore(''); impostaMostraCreaSa(true);
                      }}>+ Sotto-Attività</button>
                    </div>
                    {(!ob.sotto_attivita || ob.sotto_attivita.length === 0) ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 20 }}>Nessuna sotto-attività.</p>
                    ) : (
                      <div className="sub-activities-list">
                        {ob.sotto_attivita.map(sa => (
                          <div key={sa.id} className="sub-activity-item">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                              <TortaCompletamento percentuale={sa.percentuale_completamento || 0} dimensione={52}
                                onClick={(perc) => aggiornaPercentuale(sa.id, perc)} />
                              <div className="sub-activity-info" style={{ flex: 1 }}>
                                <div className="sub-activity-name">{sa.nome}</div>
                                <div className="sub-activity-details">
                                  <span>⏱️ {sa.ore_totali}h ({sa.ore_per_giorno}h/g)</span>
                                  <span>📆 ~{sa.giorni_stimati}gg</span>
                                  {sa.data_fine_stimata && <span>🏁 {new Date(sa.data_fine_stimata + 'T00:00:00').toLocaleDateString('it-IT')}</span>}
                                </div>
                                {sa.micro_attivita?.length > 0 && (
                                  <details style={{ marginTop: 8 }}>
                                    <summary style={{ fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer' }}>📋 {sa.micro_attivita.length} micro-attività</summary>
                                    <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                      {sa.micro_attivita.slice(0, 15).map((ma, i) => (
                                        <span key={i} style={{ fontSize: 11, padding: '3px 8px', background: 'var(--bg-input)', borderRadius: 4, color: 'var(--text-secondary)', fontFamily: 'var(--font-display)' }}>
                                          {new Date(ma.data + 'T00:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })} · {ma.ore}h
                                        </span>
                                      ))}
                                    </div>
                                  </details>
                                )}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button className="btn btn-secondary btn-sm" onClick={() => apriModificaSa(ob, sa)} title="Modifica">✏️</button>
                              <button className="btn btn-danger btn-sm" onClick={() => eliminaSottoAttivita(ob.id, sa.id)} title="Elimina">🗑️</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modale Nuovo Obiettivo */}
      <Modale aperta={mostraCreaOb} alChiudi={() => impostaMostraCreaOb(false)} titolo="Nuovo Obiettivo">
        {errore && <div className="alert alert-danger">⚠️ {errore}</div>}
        <form onSubmit={creaObiettivo}>
          <div className="form-group"><label className="form-label">Nome</label>
            <input type="text" className="form-input" value={moduloOb.nome} onChange={e => impostaModuloOb({ ...moduloOb, nome: e.target.value })} required /></div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Data Inizio</label>
              <input type="date" className="form-input" value={moduloOb.data_inizio} onChange={e => impostaModuloOb({ ...moduloOb, data_inizio: e.target.value })} required /></div>
            <div className="form-group"><label className="form-label">Ore Totali</label>
              <input type="number" className="form-input" min="1" value={moduloOb.ore_totali} onChange={e => impostaModuloOb({ ...moduloOb, ore_totali: parseFloat(e.target.value) || '' })} required /></div>
          </div>
          <div className="form-group"><label className="form-label">Note (opzionale)</label>
            <textarea className="form-textarea" rows={3} placeholder="Descrizione, contesto, riferimenti..." value={moduloOb.note} onChange={e => impostaModuloOb({ ...moduloOb, note: e.target.value })} /></div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => impostaMostraCreaOb(false)}>Annulla</button>
            <button type="submit" className="btn btn-primary">Crea</button>
          </div>
        </form>
      </Modale>

      {/* Modale Crea Sotto-Attività */}
      <Modale aperta={mostraCreaSa} alChiudi={() => impostaMostraCreaSa(false)} titolo="Nuova Sotto-Attività">
        {errore && <div className="alert alert-danger">⚠️ {errore}</div>}
        <form onSubmit={creaSottoAttivita}>
          <div className="form-group"><label className="form-label">Nome</label>
            <input type="text" className="form-input" value={moduloSa.nome} onChange={e => impostaModuloSa({ ...moduloSa, nome: e.target.value })} required /></div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Ore Totali</label>
              <input type="number" className="form-input" min="1" step="0.5" value={moduloSa.ore_totali} onChange={e => impostaModuloSa({ ...moduloSa, ore_totali: e.target.value })} required /></div>
            <div className="form-group"><label className="form-label">Ore/Giorno</label>
              <input type="number" className="form-input" min="1" max="8" step="0.5" value={moduloSa.ore_per_giorno} onChange={e => impostaModuloSa({ ...moduloSa, ore_per_giorno: e.target.value })} required /></div>
          </div>
          {moduloSa.ore_totali && moduloSa.ore_per_giorno > 0 && (
            <div className="alert alert-info">📊 Giorni stimati: <strong>{Math.ceil(moduloSa.ore_totali / moduloSa.ore_per_giorno)}</strong> gg lavorativi</div>
          )}
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => impostaMostraCreaSa(false)}>Annulla</button>
            <button type="submit" className="btn btn-primary">Aggiungi</button>
          </div>
        </form>
      </Modale>

      {/* Modale Modifica Sotto-Attività */}
      <Modale aperta={mostraModificaSa} alChiudi={() => impostaMostraModificaSa(false)} titolo="Modifica Sotto-Attività">
        {errore && <div className="alert alert-danger">⚠️ {errore}</div>}
        <form onSubmit={modificaSottoAttivita}>
          <div className="form-group"><label className="form-label">Nome</label>
            <input type="text" className="form-input" value={moduloSa.nome} onChange={e => impostaModuloSa({ ...moduloSa, nome: e.target.value })} required /></div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Ore Totali</label>
              <input type="number" className="form-input" min="1" step="0.5" value={moduloSa.ore_totali} onChange={e => impostaModuloSa({ ...moduloSa, ore_totali: e.target.value })} required /></div>
            <div className="form-group"><label className="form-label">Ore/Giorno</label>
              <input type="number" className="form-input" min="1" max="8" step="0.5" value={moduloSa.ore_per_giorno} onChange={e => impostaModuloSa({ ...moduloSa, ore_per_giorno: e.target.value })} required /></div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => impostaMostraModificaSa(false)}>Annulla</button>
            <button type="submit" className="btn btn-primary">Salva Modifiche</button>
          </div>
        </form>
      </Modale>

      {/* Modale Modifica Obiettivo */}
      <Modale aperta={mostraModificaOb} alChiudi={() => impostaMostraModificaOb(false)} titolo="Modifica Obiettivo">
        {errore && <div className="alert alert-danger">⚠️ {errore}</div>}
        <form onSubmit={modificaObiettivo}>
          <div className="form-group"><label className="form-label">Nome</label>
            <input type="text" className="form-input" value={moduloOb.nome} onChange={e => impostaModuloOb({ ...moduloOb, nome: e.target.value })} required /></div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Data Inizio</label>
              <input type="date" className="form-input" value={moduloOb.data_inizio} onChange={e => impostaModuloOb({ ...moduloOb, data_inizio: e.target.value })} required /></div>
            <div className="form-group"><label className="form-label">Ore Totali</label>
              <input type="number" className="form-input" min="1" value={moduloOb.ore_totali} onChange={e => impostaModuloOb({ ...moduloOb, ore_totali: parseFloat(e.target.value) || '' })} required /></div>
          </div>
          <div className="form-group"><label className="form-label">Note</label>
            <textarea className="form-textarea" rows={3} placeholder="Descrizione, contesto, riferimenti..." value={moduloOb.note} onChange={e => impostaModuloOb({ ...moduloOb, note: e.target.value })} /></div>
          <div className="alert alert-info" style={{ fontSize: 13 }}>ℹ️ Modificando le ore o la data, le micro-attività verranno ricalcolate.</div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => impostaMostraModificaOb(false)}>Annulla</button>
            <button type="submit" className="btn btn-primary">Salva Modifiche</button>
          </div>
        </form>
      </Modale>
    </div>
  );
}

export default PaginaObiettivi;
