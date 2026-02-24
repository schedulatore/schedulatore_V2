import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiTeam, apiObiettivi } from '../utilita/api.js';
import Modale from '../componenti/Modale.jsx';

function TortaCompletamento({ percentuale, dimensione = 52, onClick }) {
  const r = dimensione / 2;
  const spicchi = [{ val: 25, ang: 0 }, { val: 50, ang: 90 }, { val: 75, ang: 180 }, { val: 100, ang: 270 }];
  const colore = (val) => val <= percentuale ? '#4caf50' : '#e0e0e0';
  const percorso = (a1, a2) => {
    const r1 = (a1 - 90) * Math.PI / 180, r2 = (a2 - 90) * Math.PI / 180;
    return `M ${r} ${r} L ${r + r * 0.85 * Math.cos(r1)} ${r + r * 0.85 * Math.sin(r1)} A ${r * 0.85} ${r * 0.85} 0 0 1 ${r + r * 0.85 * Math.cos(r2)} ${r + r * 0.85 * Math.sin(r2)} Z`;
  };
  const gestisciClick = (val) => {
    if (!onClick) return;
    if (val === percentuale) { const idx = spicchi.findIndex(s => s.val === val); onClick(idx > 0 ? spicchi[idx - 1].val : 0); }
    else { onClick(val); }
  };
  return (
    <svg width={dimensione} height={dimensione} style={{ cursor: onClick ? 'pointer' : 'default' }} viewBox={`0 0 ${dimensione} ${dimensione}`}>
      {spicchi.map((s, i) => <path key={i} d={percorso(s.ang, s.ang + 88)} fill={colore(s.val)} stroke="white" strokeWidth="1.5"
        onClick={e => { e.stopPropagation(); gestisciClick(s.val); }} />)}
      <text x={r} y={r + 1} textAnchor="middle" dominantBaseline="middle" fontSize={dimensione * 0.24} fontWeight="700" fill="#333">{percentuale}%</text>
    </svg>
  );
}

function CardMembro({ email, stats, nomeMembro }) {
  const { totali = 0, completate = 0, in_ritardo = 0, in_orario = 0, ore_totali = 0 } = stats;
  const perc = totali > 0 ? Math.round((completate / totali) * 100) : 0;
  const semaforo = in_ritardo > 0 ? 'rosso' : completate === totali && totali > 0 ? 'verde' : 'giallo';
  const colSemaforo = semaforo === 'verde' ? '#4caf50' : semaforo === 'rosso' ? '#e94560' : '#ff9800';
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: 16, borderTop: `3px solid ${colSemaforo}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: colSemaforo, boxShadow: `0 0 8px ${colSemaforo}60` }}></div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{nomeMembro || email}</div>
            {nomeMembro && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{email}</div>}
          </div>
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: colSemaforo }}>{perc}%</div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        {[{ v: completate, l: 'Completate', c: '#4caf50' }, { v: in_orario, l: 'In orario', c: '#4a90d9' }, { v: in_ritardo, l: 'In ritardo', c: '#e94560' }].map(x =>
          <div key={x.l} style={{ flex: 1, textAlign: 'center', padding: '6px 0', background: `${x.c}15`, borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: x.c }}>{x.v}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{x.l}</div>
          </div>
        )}
      </div>
      <div style={{ height: 6, background: 'var(--bg-elevated)', borderRadius: 3 }}>
        <div style={{ width: `${perc}%`, height: '100%', background: colSemaforo, borderRadius: 3, transition: 'width 0.4s' }}></div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{ore_totali}h totali · {totali} attività</div>
    </div>
  );
}

function PaginaDettaglioTeam({ utente }) {
  const { id } = useParams();
  const naviga = useNavigate();
  const [squadra, impostaSquadra] = useState(null);
  const [caricamento, impostaCaricamento] = useState(true);
  const [tabAttiva, impostaTab] = useState('dashboard');
  const [mostrOb, impostaMostrOb] = useState(false);
  const [mostrModOb, impostaMostrModOb] = useState(false);
  const [mostrSa, impostaMostrSa] = useState(false);
  const [mostrModSa, impostaMostrModSa] = useState(false);
  const [mostrMembro, impostaMostrMembro] = useState(false);
  const [idObSel, impostaIdObSel] = useState(null);
  const [obSel, impostaObSel] = useState(null);
  const [saSel, impostaSaSel] = useState(null);
  const [modOb, impostaModOb] = useState({ nome: '', data_inizio: '', ore_totali: '', note: '' });
  const [modSa, impostaModSa] = useState({ nome: '', ore_totali: '', ore_per_giorno: 1, email_responsabile: '', collaboratori: '' });
  const [modMembro, impostaModMembro] = useState({ email_utente: '', ruolo: 'membro' });
  const [errore, impostaErr] = useState('');
  const [espanso, impostaEsp] = useState({});
  const oggiStr = new Date().toISOString().split('T')[0];

  // Calendario
  const [meseCorrente, impostaMese] = useState(new Date());
  const [giornoSel, impostaGiornoSel] = useState(null);
  const [attGiorno, impostaAttGiorno] = useState([]);
  const [totaliCal, impostaTotaliCal] = useState({});
  const [trascinando, impostaTrascinando] = useState(null);

  // Report giornaliero
  const [reportData, impostaReportData] = useState(oggiStr);
  const [report, impostaReport] = useState([]);

  const caricaTeam = useCallback(async () => {
    try { const r = await apiTeam.dettaglio(id); impostaSquadra(r.data.team); } catch (e) { console.error(e); }
    impostaCaricamento(false);
  }, [id]);

  const caricaCal = useCallback(async () => {
    try {
      const r = await apiTeam.calendario(id);
      impostaTotaliCal(r.data.totaliGiornalieri || {});
    } catch (e) {}
  }, [id]);

  const caricaGiorno = async (data) => {
    impostaGiornoSel(data);
    try { const r = await apiTeam.attivitaGiornaliere(id, data); impostaAttGiorno(r.data.attivita || []); } catch (e) { impostaAttGiorno([]); }
  };

  const toggleFlag = async (idMicro, flagAttuale) => {
    try {
      await apiTeam.flagGiornaliero(id, idMicro, flagAttuale === 1 ? 0 : 1);
      caricaGiorno(giornoSel);
    } catch (e) { alert(e.response?.data?.errore || 'Errore'); }
  };

  const gestisciDrop = async (idMicro, nuovaData) => {
    try {
      await apiTeam.spostaMicro(id, idMicro, nuovaData);
      caricaCal();
      if (giornoSel) caricaGiorno(giornoSel);
    } catch (e) { alert(e.response?.data?.errore || 'Non spostabile'); }
    impostaTrascinando(null);
  };

  const caricaReport = async (data) => {
    impostaReportData(data);
    try { const r = await apiTeam.reportGiornaliero(id, data); impostaReport(r.data.report || []); } catch (e) { impostaReport([]); }
  };

  useEffect(() => { caricaTeam(); caricaCal(); }, [caricaTeam, caricaCal]);
  useEffect(() => { if (tabAttiva === 'report') caricaReport(reportData); }, [tabAttiva]);

  const puoMod = squadra?.mio_ruolo === 'leader' || squadra?.mio_ruolo === 'sponsor';
  const emailMembri = squadra?.membri?.map(m => m.email_utente) || [];
  const nomiMembri = {};
  squadra?.membri?.forEach(m => { nomiMembri[m.email_utente] = m.nome_utente || null; });

  // CRUD
  const creaOb = async (e) => { e.preventDefault(); impostaErr('');
    try { await apiObiettivi.crea({ ...modOb, ore_totali: parseFloat(modOb.ore_totali), id_team: parseInt(id) }); impostaMostrOb(false); caricaTeam(); caricaCal(); }
    catch (er) { impostaErr(er.response?.data?.errore || 'Errore.'); }
  };
  const modificaOb = async (e) => { e.preventDefault(); impostaErr('');
    try { await apiObiettivi.aggiorna(obSel.id, { nome: modOb.nome, data_inizio: modOb.data_inizio, ore_totali: parseFloat(modOb.ore_totali), note: modOb.note }); impostaMostrModOb(false); caricaTeam(); caricaCal(); }
    catch (er) { impostaErr(er.response?.data?.errore || 'Errore.'); }
  };
  const eliminaOb = async (idOb) => { if (!window.confirm('Eliminare?')) return; try { await apiObiettivi.elimina(idOb); caricaTeam(); caricaCal(); } catch (e) {} };
  const creaSa = async (e) => { e.preventDefault(); impostaErr('');
    try { const collabs = modSa.collaboratori.split(',').map(c => c.trim()).filter(c => c);
      await apiObiettivi.aggiungiSottoAttivita(idObSel, { nome: modSa.nome, ore_totali: parseFloat(modSa.ore_totali), ore_per_giorno: parseFloat(modSa.ore_per_giorno), email_responsabile: modSa.email_responsabile || utente?.email, collaboratori: collabs });
      impostaMostrSa(false); caricaTeam(); caricaCal(); }
    catch (er) { impostaErr(er.response?.data?.errore || 'Errore.'); }
  };
  const modificaSa = async (e) => { e.preventDefault(); impostaErr('');
    try { await apiObiettivi.aggiornaSottoAttivita(idObSel, saSel.id, { nome: modSa.nome, ore_totali: parseFloat(modSa.ore_totali), ore_per_giorno: parseFloat(modSa.ore_per_giorno), email_responsabile: modSa.email_responsabile });
      impostaMostrModSa(false); caricaTeam(); caricaCal(); }
    catch (er) { impostaErr(er.response?.data?.errore || 'Errore.'); }
  };
  const eliminaSa = async (idOb, idSa) => { if (!window.confirm('Eliminare?')) return; try { await apiObiettivi.eliminaSottoAttivita(idOb, idSa); caricaTeam(); caricaCal(); } catch (e) {} };
  const aggPerc = async (idSa, p) => { try { await apiObiettivi.aggiornaPercentuale(idSa, p); caricaTeam(); } catch (e) {} };
  const aggiungiMembro = async (e) => { e.preventDefault(); impostaErr('');
    try { const r = await apiTeam.aggiungiMembro(id, modMembro); impostaSquadra(s => ({ ...s, membri: r.data.membri })); impostaMostrMembro(false); }
    catch (er) { impostaErr(er.response?.data?.errore || 'Errore.'); }
  };
  const cambiaRuolo = async (idMem, nuovoRuolo) => { try { const r = await apiTeam.modificaMembro(id, idMem, { ruolo: nuovoRuolo }); impostaSquadra(s => ({ ...s, membri: r.data.membri })); } catch (e) {} };
  const rimuoviMembro = async (idMem) => { if (!window.confirm('Rimuovere?')) return;
    try { const r = await apiTeam.rimuoviMembro(id, idMem); impostaSquadra(s => ({ ...s, membri: r.data.membri })); } catch (er) { alert(er.response?.data?.errore || 'Errore.'); }
  };

  // Calendario helpers
  const anno = meseCorrente.getFullYear(), mese = meseCorrente.getMonth();
  const primoGiorno = new Date(anno, mese, 1);
  const inizioGriglia = (primoGiorno.getDay() + 6) % 7;
  const giorniMese = new Date(anno, mese + 1, 0).getDate();
  const nomiMesi = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
  const celle = [];
  for (let i = 0; i < inizioGriglia; i++) celle.push(null);
  for (let g = 1; g <= giorniMese; g++) celle.push(g);

  if (caricamento) return <div className="loading"><div className="spinner"></div></div>;
  if (!squadra) return <div className="card"><div className="empty-state"><div className="empty-state-title">Team non trovato</div><button className="btn btn-secondary" onClick={() => naviga('/teams')}>Torna</button></div></div>;

  // Raggruppa attività giorno per responsabile
  const attPerResp = {};
  const attComplete = [];
  attGiorno.forEach(a => {
    if ((a.percentuale_completamento || 0) >= 100) { attComplete.push(a); return; }
    const key = a.email_responsabile || 'sconosciuto';
    if (!attPerResp[key]) attPerResp[key] = [];
    attPerResp[key].push(a);
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <button className="btn btn-ghost btn-sm" onClick={() => naviga('/teams')} style={{ marginBottom: 4 }}>← Team</button>
          <h1 className="page-title">{squadra.nome}</h1>
          <p className="page-subtitle">Sponsor: {squadra.nome_sponsor || '—'} · Leader: {squadra.nome_leader}</p>
        </div>
        <span className={`badge ${puoMod ? 'badge-leader' : 'badge-member'}`}>{squadra.mio_ruolo}</span>
      </div>

      <div className="tabs">
        <button className={`tab ${tabAttiva === 'dashboard' ? 'active' : ''}`} onClick={() => impostaTab('dashboard')}>📊 Dashboard</button>
        <button className={`tab ${tabAttiva === 'obiettivi' ? 'active' : ''}`} onClick={() => impostaTab('obiettivi')}>🎯 Obiettivi</button>
        <button className={`tab ${tabAttiva === 'membri' ? 'active' : ''}`} onClick={() => impostaTab('membri')}>👥 Membri</button>
        <button className={`tab ${tabAttiva === 'calendario' ? 'active' : ''}`} onClick={() => { impostaTab('calendario'); caricaCal(); }}>📅 Calendario</button>
        <button className={`tab ${tabAttiva === 'report' ? 'active' : ''}`} onClick={() => impostaTab('report')}>📋 Report</button>
      </div>

      {/* ========== DASHBOARD ========== */}
      {tabAttiva === 'dashboard' && (
        <div>
          {!squadra.stats_membri || Object.keys(squadra.stats_membri).length === 0 ? (
            <div className="card"><div className="empty-state"><div className="empty-state-icon">📊</div><div className="empty-state-title">Nessun dato</div><div className="empty-state-text">Crea obiettivi e assegna sotto-attività.</div></div></div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {Object.entries(squadra.stats_membri).map(([email, stats]) => (
                <CardMembro key={email} email={email} stats={stats} nomeMembro={nomiMembri[email]} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========== OBIETTIVI ========== */}
      {tabAttiva === 'obiettivi' && (
        <div>
          {puoMod && <div style={{ marginBottom: 20 }}><button className="btn btn-primary" onClick={() => { impostaModOb({ nome: '', data_inizio: oggiStr, ore_totali: '', note: '' }); impostaErr(''); impostaMostrOb(true); }}>+ Nuovo Obiettivo</button></div>}
          {(!squadra.obiettivi || squadra.obiettivi.length === 0) ? (
            <div className="card"><div className="empty-state"><div className="empty-state-icon">🎯</div><div className="empty-state-title">Nessun obiettivo</div></div></div>
          ) : squadra.obiettivi.map(ob => {
            const oreAss = ob.sotto_attivita?.reduce((s, sa) => s + sa.ore_totali, 0) || 0;
            const perc = ob.ore_totali > 0 ? (oreAss / ob.ore_totali) * 100 : 0;
            return (
              <div key={ob.id} className="objective-card">
                <div className="objective-header">
                  <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => impostaEsp(p => ({ ...p, [ob.id]: !p[ob.id] }))}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div className="objective-name">{espanso[ob.id] ? '▾' : '▸'} {ob.nome}</div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: (ob.percentuale_media || 0) >= 100 ? '#4caf50' : '#2196f3' }}>{ob.percentuale_media || 0}%</span>
                    </div>
                    <div className="objective-meta"><span>📅 {ob.data_inizio}</span><span>⏱️ {ob.ore_totali}h</span></div>
                    <div className="hours-bar"><div className="hours-bar-track"><div className={`hours-bar-fill ${perc > 100 ? 'danger' : ''}`} style={{ width: `${Math.min(100, perc)}%` }}></div></div><span className="hours-label">{oreAss}/{ob.ore_totali}h</span></div>
                  </div>
                  {puoMod && <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => { impostaObSel(ob); impostaModOb({ nome: ob.nome, data_inizio: ob.data_inizio, ore_totali: ob.ore_totali, note: ob.note || '' }); impostaErr(''); impostaMostrModOb(true); }}>✏️</button>
                    <button className="btn btn-danger btn-sm" onClick={() => eliminaOb(ob.id)}>🗑️</button>
                  </div>}
                </div>
                {espanso[ob.id] && (
                  <div className="objective-body">
                    {ob.note && <div style={{ fontSize: 13, color: 'var(--text-secondary)', padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', marginBottom: 16, borderLeft: '3px solid var(--accent-warm)' }}>📝 {ob.note}</div>}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Sotto-Attività ({ob.sotto_attivita?.length || 0})</h3>
                      {puoMod && <button className="btn btn-secondary btn-sm" onClick={() => { impostaIdObSel(ob.id); impostaModSa({ nome: '', ore_totali: '', ore_per_giorno: 1, email_responsabile: '', collaboratori: '' }); impostaErr(''); impostaMostrSa(true); }}>+ Sotto-Attività</button>}
                    </div>
                    {ob.sotto_attivita?.map(sa => (
                      <div key={sa.id} className="sub-activity-item">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                          <TortaCompletamento percentuale={sa.percentuale_completamento || 0} dimensione={52} onClick={puoMod ? (p) => aggPerc(sa.id, p) : null} />
                          <div style={{ flex: 1 }}>
                            <div className="sub-activity-name">{sa.nome}</div>
                            <div className="sub-activity-details"><span>👤 {nomiMembri[sa.email_responsabile] || sa.email_responsabile}</span><span>⏱️ {sa.ore_totali}h ({sa.ore_per_giorno}h/g)</span></div>
                          </div>
                        </div>
                        {puoMod && <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => { impostaIdObSel(ob.id); impostaSaSel(sa); impostaModSa({ nome: sa.nome, ore_totali: sa.ore_totali, ore_per_giorno: sa.ore_per_giorno, email_responsabile: sa.email_responsabile || '', collaboratori: '' }); impostaErr(''); impostaMostrModSa(true); }}>✏️</button>
                          <button className="btn btn-danger btn-sm" onClick={() => eliminaSa(ob.id, sa.id)}>🗑️</button>
                        </div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ========== MEMBRI ========== */}
      {tabAttiva === 'membri' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Membri ({squadra.membri?.length || 0})</h3>
            {puoMod && <button className="btn btn-secondary btn-sm" onClick={() => { impostaModMembro({ email_utente: '', ruolo: 'membro' }); impostaErr(''); impostaMostrMembro(true); }}>+ Aggiungi</button>}
          </div>
          {squadra.membri?.map(m => (
            <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', marginBottom: 6 }}>
              <div><span style={{ fontWeight: 600, fontSize: 14 }}>{m.nome_utente || m.email_utente}</span>
                {m.nome_utente && <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>{m.email_utente}</span>}
                {!m.iscritto && <span style={{ fontSize: 11, color: 'var(--accent-warm)', marginLeft: 8 }}>(invitato)</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {puoMod && m.email_utente !== utente?.email ? (<>
                  <select value={m.ruolo} onChange={e => cambiaRuolo(m.id, e.target.value)} style={{ fontSize: 12, padding: '3px 8px', borderRadius: 4, border: '1px solid var(--border-subtle)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}>
                    <option value="leader">Leader</option><option value="sponsor">Sponsor</option><option value="membro">Membro</option><option value="stakeholder">Stakeholder</option>
                  </select>
                  <button className="btn btn-danger btn-sm" onClick={() => rimuoviMembro(m.id)}>✕</button>
                </>) : <span className={`badge ${m.ruolo === 'leader' || m.ruolo === 'sponsor' ? 'badge-leader' : 'badge-member'}`}>{m.ruolo}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ========== CALENDARIO ========== */}
      {tabAttiva === 'calendario' && (
        <div>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => impostaMese(new Date(anno, mese - 1))}>←</button>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>{nomiMesi[mese]} {anno}</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => impostaMese(new Date(anno, mese + 1))}>→</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
              {['Lun','Mar','Mer','Gio','Ven','Sab','Dom'].map(g => (
                <div key={g} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', padding: 6 }}>{g}</div>
              ))}
              {celle.map((g, i) => {
                if (!g) return <div key={`e${i}`} />;
                const dataStr = `${anno}-${String(mese + 1).padStart(2, '0')}-${String(g).padStart(2, '0')}`;
                const ore = totaliCal[dataStr] || 0;
                const eOggi = dataStr === oggiStr;
                const sel = dataStr === giornoSel;
                return (
                  <div key={dataStr}
                    onClick={() => caricaGiorno(dataStr)}
                    onDragOver={e => { e.preventDefault(); e.currentTarget.style.background = 'rgba(233,69,96,0.15)'; }}
                    onDragLeave={e => { e.currentTarget.style.background = ''; }}
                    onDrop={e => { e.preventDefault(); e.currentTarget.style.background = ''; if (trascinando) gestisciDrop(trascinando, dataStr); }}
                    style={{
                      padding: 8, textAlign: 'center', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                      border: sel ? '2px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                      background: eOggi ? 'rgba(233,69,96,0.1)' : 'transparent', transition: 'var(--transition)', minHeight: 54
                    }}>
                    <div style={{ fontSize: 14, fontWeight: eOggi ? 700 : 500, color: eOggi ? 'var(--accent-primary)' : 'var(--text-primary)' }}>{g}</div>
                    {ore > 0 && <div style={{ fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-display)', color: ore > 16 ? 'var(--accent-primary)' : 'var(--accent-green)', marginTop: 2 }}>{ore}h</div>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Dettaglio giorno */}
          {giornoSel && (
            <div className="card" style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700 }}>
                  📅 {new Date(giornoSel + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
                </h3>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--accent-green)' }}>{totaliCal[giornoSel] || 0}h</span>
              </div>

              {giornoSel <= oggiStr && Object.keys(attPerResp).length > 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>💡 Clicca il cerchio per segnare OK/NOK (solo le tue attività)</div>
              )}

              {Object.entries(attPerResp).map(([email, attivita]) => (
                <div key={email} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-blue)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>👤 {nomiMembri[email] || email}</span>
                    <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }}>{attivita.reduce((s, a) => s + a.ore, 0)}h</span>
                  </div>
                  {attivita.map(a => {
                    const eMio = a.email_responsabile === utente?.email;
                    return (
                      <div key={a.id}
                        draggable={eMio}
                        onDragStart={() => { if (eMio) impostaTrascinando(a.id); }}
                        onDragEnd={() => impostaTrascinando(null)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                          background: a.flag_giornaliero === 1 ? 'rgba(80,200,120,0.08)' : 'var(--bg-elevated)',
                          borderRadius: 'var(--radius-md)', marginBottom: 6,
                          borderLeft: `3px solid ${a.flag_giornaliero === 1 ? '#4caf50' : eMio ? 'var(--accent-primary)' : 'var(--accent-blue)'}`,
                          cursor: eMio ? 'grab' : 'default', opacity: trascinando === a.id ? 0.5 : 1
                        }}>
                        {giornoSel <= oggiStr && eMio && (
                          <button onClick={() => toggleFlag(a.id, a.flag_giornaliero)} style={{
                            width: 30, height: 30, minWidth: 30, borderRadius: '50%',
                            border: `2px solid ${a.flag_giornaliero === 1 ? '#4caf50' : '#555'}`,
                            background: a.flag_giornaliero === 1 ? '#4caf50' : 'transparent',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 13, color: a.flag_giornaliero === 1 ? 'white' : '#555'
                          }}>{a.flag_giornaliero === 1 ? '✓' : ''}</button>
                        )}
                        {giornoSel <= oggiStr && !eMio && (
                          <div style={{
                            width: 30, height: 30, minWidth: 30, borderRadius: '50%',
                            border: `2px solid ${a.flag_giornaliero === 1 ? '#4caf50' : '#555'}`,
                            background: a.flag_giornaliero === 1 ? '#4caf50' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 13, color: a.flag_giornaliero === 1 ? 'white' : '#555'
                          }}>{a.flag_giornaliero === 1 ? '✓' : ''}</div>
                        )}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, textDecoration: a.flag_giornaliero === 1 ? 'line-through' : 'none', opacity: a.flag_giornaliero === 1 ? 0.6 : 1 }}>{a.nome_attivita}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.nome_obiettivo} · {a.ore}h</div>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600, color: a.flag_giornaliero === 1 ? '#4caf50' : giornoSel <= oggiStr ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
                          {a.flag_giornaliero === 1 ? 'OK' : giornoSel <= oggiStr ? 'NOK' : '—'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}

              {attComplete.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', paddingBottom: 4, borderBottom: '1px solid var(--border-subtle)' }}>Completate al 100% (ore non contate)</div>
                  {attComplete.map(a => (
                    <div key={a.id} style={{ padding: '6px 14px', opacity: 0.5, fontSize: 13, marginTop: 4 }}>✅ {a.nome_attivita} ({a.ore}h) — {nomiMembri[a.email_responsabile] || a.email_responsabile}</div>
                  ))}
                </div>
              )}

              {attGiorno.length === 0 && <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>📭 Nessuna attività</div>}
            </div>
          )}
        </div>
      )}

      {/* ========== REPORT GIORNALIERO ========== */}
      {tabAttiva === 'report' && (
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700 }}>📋 Report Giornaliero Team</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="date" className="form-input" value={reportData} onChange={e => caricaReport(e.target.value)} style={{ width: 'auto' }} />
              </div>
            </div>
          </div>

          {report.length === 0 ? (
            <div className="card"><div className="empty-state"><div className="empty-state-icon">📭</div><div className="empty-state-title">Nessuna attività per questa data</div></div></div>
          ) : report.map(m => {
            const colPerc = m.percentuale >= 80 ? '#4caf50' : m.percentuale >= 50 ? '#ff9800' : '#e94560';
            const semaforo = m.percentuale >= 80 ? '🟢' : m.percentuale >= 50 ? '🟡' : '🔴';
            return (
              <div key={m.email} className="card" style={{ marginBottom: 12, borderLeft: `4px solid ${colPerc}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 20 }}>{semaforo}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{m.nome}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.email} · {m.ruolo}</div>
                    </div>
                  </div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: colPerc }}>{m.percentuale}%</div>
                </div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {m.ok.length > 0 && (
                    <div style={{ flex: 1, minWidth: 150 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#4caf50', marginBottom: 4 }}>✅ OK ({m.ok.length})</div>
                      {m.ok.map((a, i) => <div key={i} style={{ fontSize: 13, padding: '3px 0' }}>{a.nome} · {a.ore}h</div>)}
                    </div>
                  )}
                  {m.nok.length > 0 && (
                    <div style={{ flex: 1, minWidth: 150 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#e94560', marginBottom: 4 }}>❌ NOK ({m.nok.length})</div>
                      {m.nok.map((a, i) => <div key={i} style={{ fontSize: 13, padding: '3px 0', color: 'var(--accent-primary)' }}>{a.nome} · {a.ore}h</div>)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========== MODALI ========== */}
      <Modale aperta={mostrOb} alChiudi={() => impostaMostrOb(false)} titolo="Nuovo Obiettivo Team">
        {errore && <div className="alert alert-danger">⚠️ {errore}</div>}
        <form onSubmit={creaOb}>
          <div className="form-group"><label className="form-label">Nome</label><input className="form-input" value={modOb.nome} onChange={e => impostaModOb({ ...modOb, nome: e.target.value })} required /></div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Data Inizio</label><input type="date" className="form-input" value={modOb.data_inizio} onChange={e => impostaModOb({ ...modOb, data_inizio: e.target.value })} required /></div>
            <div className="form-group"><label className="form-label">Ore Totali</label><input type="number" className="form-input" min="1" value={modOb.ore_totali} onChange={e => impostaModOb({ ...modOb, ore_totali: parseFloat(e.target.value) || '' })} required /></div>
          </div>
          <div className="form-group"><label className="form-label">Note</label><textarea className="form-textarea" rows={3} value={modOb.note} onChange={e => impostaModOb({ ...modOb, note: e.target.value })} /></div>
          <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={() => impostaMostrOb(false)}>Annulla</button><button type="submit" className="btn btn-primary">Crea</button></div>
        </form>
      </Modale>

      <Modale aperta={mostrModOb} alChiudi={() => impostaMostrModOb(false)} titolo="Modifica Obiettivo">
        {errore && <div className="alert alert-danger">⚠️ {errore}</div>}
        <form onSubmit={modificaOb}>
          <div className="form-group"><label className="form-label">Nome</label><input className="form-input" value={modOb.nome} onChange={e => impostaModOb({ ...modOb, nome: e.target.value })} required /></div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Data Inizio</label><input type="date" className="form-input" value={modOb.data_inizio} onChange={e => impostaModOb({ ...modOb, data_inizio: e.target.value })} required /></div>
            <div className="form-group"><label className="form-label">Ore Totali</label><input type="number" className="form-input" min="1" value={modOb.ore_totali} onChange={e => impostaModOb({ ...modOb, ore_totali: parseFloat(e.target.value) || '' })} required /></div>
          </div>
          <div className="form-group"><label className="form-label">Note</label><textarea className="form-textarea" rows={3} value={modOb.note} onChange={e => impostaModOb({ ...modOb, note: e.target.value })} /></div>
          <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={() => impostaMostrModOb(false)}>Annulla</button><button type="submit" className="btn btn-primary">Salva</button></div>
        </form>
      </Modale>

      <Modale aperta={mostrSa} alChiudi={() => impostaMostrSa(false)} titolo="Nuova Sotto-Attività">
        {errore && <div className="alert alert-danger">⚠️ {errore}</div>}
        <form onSubmit={creaSa}>
          <div className="form-group"><label className="form-label">Nome</label><input className="form-input" value={modSa.nome} onChange={e => impostaModSa({ ...modSa, nome: e.target.value })} required /></div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Ore Totali</label><input type="number" className="form-input" min="1" step="0.5" value={modSa.ore_totali} onChange={e => impostaModSa({ ...modSa, ore_totali: e.target.value })} required /></div>
            <div className="form-group"><label className="form-label">Ore/Giorno</label><input type="number" className="form-input" min="1" max="8" step="0.5" value={modSa.ore_per_giorno} onChange={e => impostaModSa({ ...modSa, ore_per_giorno: e.target.value })} required /></div>
          </div>
          <div className="form-group"><label className="form-label">Responsabile</label><select className="form-select" value={modSa.email_responsabile} onChange={e => impostaModSa({ ...modSa, email_responsabile: e.target.value })}><option value="">Seleziona...</option>{emailMembri.map(em => <option key={em} value={em}>{nomiMembri[em] || em}</option>)}</select></div>
          <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={() => impostaMostrSa(false)}>Annulla</button><button type="submit" className="btn btn-primary">Aggiungi</button></div>
        </form>
      </Modale>

      <Modale aperta={mostrModSa} alChiudi={() => impostaMostrModSa(false)} titolo="Modifica Sotto-Attività">
        {errore && <div className="alert alert-danger">⚠️ {errore}</div>}
        <form onSubmit={modificaSa}>
          <div className="form-group"><label className="form-label">Nome</label><input className="form-input" value={modSa.nome} onChange={e => impostaModSa({ ...modSa, nome: e.target.value })} required /></div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Ore Totali</label><input type="number" className="form-input" min="1" step="0.5" value={modSa.ore_totali} onChange={e => impostaModSa({ ...modSa, ore_totali: e.target.value })} required /></div>
            <div className="form-group"><label className="form-label">Ore/Giorno</label><input type="number" className="form-input" min="1" max="8" step="0.5" value={modSa.ore_per_giorno} onChange={e => impostaModSa({ ...modSa, ore_per_giorno: e.target.value })} required /></div>
          </div>
          <div className="form-group"><label className="form-label">Responsabile</label><select className="form-select" value={modSa.email_responsabile} onChange={e => impostaModSa({ ...modSa, email_responsabile: e.target.value })}><option value="">Seleziona...</option>{emailMembri.map(em => <option key={em} value={em}>{nomiMembri[em] || em}</option>)}</select></div>
          <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={() => impostaMostrModSa(false)}>Annulla</button><button type="submit" className="btn btn-primary">Salva</button></div>
        </form>
      </Modale>

      <Modale aperta={mostrMembro} alChiudi={() => impostaMostrMembro(false)} titolo="Aggiungi Membro">
        {errore && <div className="alert alert-danger">⚠️ {errore}</div>}
        <form onSubmit={aggiungiMembro}>
          <div className="form-group"><label className="form-label">Email</label><input type="email" className="form-input" placeholder="email@azienda.com" value={modMembro.email_utente} onChange={e => impostaModMembro({ ...modMembro, email_utente: e.target.value })} required /></div>
          <div className="form-group"><label className="form-label">Ruolo</label><select className="form-select" value={modMembro.ruolo} onChange={e => impostaModMembro({ ...modMembro, ruolo: e.target.value })}><option value="membro">Membro</option><option value="leader">Leader</option><option value="sponsor">Sponsor</option><option value="stakeholder">Stakeholder</option></select></div>
          <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={() => impostaMostrMembro(false)}>Annulla</button><button type="submit" className="btn btn-primary">Aggiungi</button></div>
        </form>
      </Modale>
    </div>
  );
}

export default PaginaDettaglioTeam;
