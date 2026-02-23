import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiTeam } from '../utilita/api.js';
import Modale from '../componenti/Modale.jsx';

function PaginaTeam({ utente }) {
  const [squadre, impostaSquadre] = useState([]);
  const [caricamento, impostaCaricamento] = useState(true);
  const [mostraModale, impostaMostraModale] = useState(false);
  const [modulo, impostaModulo] = useState({ nome:'', nome_sponsor:'', email_sponsor:'', nome_leader:'', email_leader:'', membri:'', stakeholder:'' });
  const [errore, impostaErrore] = useState('');
  const naviga = useNavigate();

  const carica = useCallback(async () => {
    try { const ris = await apiTeam.tutti(); impostaSquadre(ris.data.team || []); } catch (err) { console.error(err); }
    impostaCaricamento(false);
  }, []);

  useEffect(() => { carica(); }, [carica]);

  const apriModale = () => {
    impostaModulo({ nome:'', nome_sponsor: utente?.nome_utente || '', email_sponsor: utente?.email || '',
      nome_leader: utente?.nome_utente || '', email_leader: utente?.email || '', membri:'', stakeholder:'' });
    impostaErrore(''); impostaMostraModale(true);
  };

  const creaTeam = async (e) => {
    e.preventDefault(); impostaErrore('');
    try {
      const arrayMembri = modulo.membri.split(',').map(m => m.trim()).filter(m => m.length > 0);
      await apiTeam.crea({ nome: modulo.nome, nome_sponsor: modulo.nome_sponsor, email_sponsor: modulo.email_sponsor,
        nome_leader: modulo.nome_leader, email_leader: modulo.email_leader, membri: arrayMembri, stakeholder: modulo.stakeholder });
      impostaMostraModale(false); carica();
    } catch (err) { impostaErrore(err.response?.data?.errore || 'Errore.'); }
  };

  const eliminaTeam = async (id) => {
    if (!window.confirm('Eliminare questo team e tutti i suoi dati?')) return;
    try { await apiTeam.elimina(id); carica(); } catch (err) { console.error(err); }
  };

  const badgeRuolo = (ruolo) => {
    const mappa = { leader:'Leader', sponsor:'Sponsor', membro:'Membro', stakeholder:'Stakeholder' };
    return <span className={`badge ${ruolo === 'leader' || ruolo === 'sponsor' ? 'badge-leader' : 'badge-member'}`}>{mappa[ruolo] || ruolo}</span>;
  };

  if (caricamento) return <div className="loading"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Team</h1>
          <p className="page-subtitle">{utente?.e_team_leader ? 'Gestisci i tuoi team' : 'Team a cui partecipi'}</p>
        </div>
        {utente?.e_team_leader && <button className="btn btn-primary" onClick={apriModale}>+ Nuovo Team</button>}
      </div>

      {squadre.length === 0 ? (
        <div className="card"><div className="empty-state">
          <div className="empty-state-icon">👥</div>
          <div className="empty-state-title">Nessun team</div>
          <div className="empty-state-text">{utente?.e_team_leader ? 'Crea il tuo primo team.' : 'Non sei membro di nessun team.'}</div>
          {utente?.e_team_leader && <button className="btn btn-primary" onClick={apriModale}>Crea Team</button>}
        </div></div>
      ) : (
        <div style={{display:'grid', gap:16, gridTemplateColumns:'repeat(auto-fill, minmax(360px, 1fr))'}}>
          {squadre.map(t => (
            <div key={t.id} className="team-card" onClick={() => naviga(`/teams/${t.id}`)}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                <div>
                  <h3 style={{fontFamily:'var(--font-display)', fontSize:18, fontWeight:700, marginBottom:4}}>{t.nome}</h3>
                  <p style={{fontSize:13, color:'var(--text-secondary)'}}>Sponsor: {t.nome_sponsor || '—'} &bull; Leader: {t.nome_leader}</p>
                </div>
                {badgeRuolo(t.mio_ruolo)}
              </div>
              <div className="team-members-list">
                {t.membri?.slice(0, 6).map(m => (
                  <span key={m.id} className="team-member-chip">
                    {m.nome_utente || m.email_utente}
                    <span style={{fontSize:10, opacity:0.7, marginLeft:4}}>({m.ruolo}{m.iscritto ? '' : ' · invitato'})</span>
                  </span>
                ))}
                {t.membri?.length > 6 && <span className="team-member-chip">+{t.membri.length - 6} altri</span>}
              </div>
              {(t.mio_ruolo === 'leader' || t.mio_ruolo === 'sponsor') && (
                <div style={{marginTop:12}}>
                  <button className="btn btn-danger btn-sm" onClick={(e) => { e.stopPropagation(); eliminaTeam(t.id); }}>🗑️ Elimina</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modale aperta={mostraModale} alChiudi={() => impostaMostraModale(false)} titolo="Nuovo Team">
        {errore && <div className="alert alert-danger">⚠️ {errore}</div>}
        <form onSubmit={creaTeam}>
          <div className="form-group"><label className="form-label">Nome Team</label>
            <input type="text" className="form-input" value={modulo.nome} onChange={e => impostaModulo({...modulo, nome: e.target.value})} required /></div>
          <div style={{background:'var(--bg-elevated)', borderRadius:'var(--radius-md)', padding:16, marginBottom:16}}>
            <p style={{fontSize:12, fontWeight:600, color:'var(--text-muted)', marginBottom:12, textTransform:'uppercase', letterSpacing:1}}>Sponsor del Progetto</p>
            <div className="form-row">
              <div className="form-group" style={{marginBottom:0}}><label className="form-label">Nome</label>
                <input type="text" className="form-input" value={modulo.nome_sponsor} onChange={e => impostaModulo({...modulo, nome_sponsor: e.target.value})} /></div>
              <div className="form-group" style={{marginBottom:0}}><label className="form-label">Email</label>
                <input type="email" className="form-input" value={modulo.email_sponsor} onChange={e => impostaModulo({...modulo, email_sponsor: e.target.value})} /></div>
            </div>
          </div>
          <div style={{background:'var(--bg-elevated)', borderRadius:'var(--radius-md)', padding:16, marginBottom:16}}>
            <p style={{fontSize:12, fontWeight:600, color:'var(--text-muted)', marginBottom:12, textTransform:'uppercase', letterSpacing:1}}>Team Leader</p>
            <div className="form-row">
              <div className="form-group" style={{marginBottom:0}}><label className="form-label">Nome</label>
                <input type="text" className="form-input" value={modulo.nome_leader} onChange={e => impostaModulo({...modulo, nome_leader: e.target.value})} /></div>
              <div className="form-group" style={{marginBottom:0}}><label className="form-label">Email</label>
                <input type="email" className="form-input" value={modulo.email_leader} onChange={e => impostaModulo({...modulo, email_leader: e.target.value})} /></div>
            </div>
          </div>
          <div className="form-group"><label className="form-label">Membri (email separate da virgola)</label>
            <textarea className="form-textarea" placeholder="mario@azienda.com, luigi@azienda.com"
              value={modulo.membri} onChange={e => impostaModulo({...modulo, membri: e.target.value})} rows={3} /></div>
          <div className="form-group"><label className="form-label">Stakeholder (email separate da virgola)</label>
            <input type="text" className="form-input" value={modulo.stakeholder} onChange={e => impostaModulo({...modulo, stakeholder: e.target.value})} /></div>
          <div className="alert alert-info">ℹ️ Solo <strong>Leader</strong> e <strong>Sponsor</strong> possono creare obiettivi e sotto-attività.</div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => impostaMostraModale(false)}>Annulla</button>
            <button type="submit" className="btn btn-primary">Crea Team</button>
          </div>
        </form>
      </Modale>
    </div>
  );
}

export default PaginaTeam;
