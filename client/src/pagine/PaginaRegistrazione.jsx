import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiAuth } from '../utilita/api.js';

function PaginaRegistrazione({ alLogin }) {
  const [modulo, impostaModulo] = useState({ email: '', nome_utente: '', password: '', confermaPassword: '', e_team_leader: false });
  const [errore, impostaErrore] = useState('');
  const [caricamento, impostaCaricamento] = useState(false);

  const gestisciInvio = async (e) => {
    e.preventDefault();
    impostaErrore('');
    if (modulo.password !== modulo.confermaPassword) { impostaErrore('Le password non corrispondono.'); return; }
    impostaCaricamento(true);
    try {
      const ris = await apiAuth.registrazione({
        email: modulo.email, nome_utente: modulo.nome_utente,
        password: modulo.password, e_team_leader: modulo.e_team_leader
      });
      alLogin(ris.data.utente, ris.data.token);
    } catch (err) {
      impostaErrore(err.response?.data?.errore || 'Errore di connessione al server.');
    }
    impostaCaricamento(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Crea Account</h1>
        <p className="auth-subtitle">Inizia a pianificare i tuoi obiettivi</p>
        {errore && <div className="alert alert-danger">⚠️ {errore}</div>}
        <form onSubmit={gestisciInvio}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input type="email" className="form-input" placeholder="nome@azienda.com"
              value={modulo.email} onChange={e => impostaModulo({...modulo, email: e.target.value})} required />
          </div>
          <div className="form-group">
            <label className="form-label">Nome utente</label>
            <input type="text" className="form-input" placeholder="Il tuo nome completo"
              value={modulo.nome_utente} onChange={e => impostaModulo({...modulo, nome_utente: e.target.value})} required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Password</label>
              <input type="password" className="form-input" placeholder="Min. 6 caratteri"
                value={modulo.password} onChange={e => impostaModulo({...modulo, password: e.target.value})} required minLength={6} />
            </div>
            <div className="form-group">
              <label className="form-label">Conferma Password</label>
              <input type="password" className="form-input" placeholder="Ripeti password"
                value={modulo.confermaPassword} onChange={e => impostaModulo({...modulo, confermaPassword: e.target.value})} required />
            </div>
          </div>
          <div className="form-group">
            <div className="form-checkbox-group" onClick={() => impostaModulo({...modulo, e_team_leader: !modulo.e_team_leader})}>
              <input type="checkbox" checked={modulo.e_team_leader} onChange={() => {}} />
              <label>Sei un Team Leader o Sponsor?</label>
            </div>
            <p style={{fontSize:12, color:'var(--text-muted)', marginTop:6, paddingLeft:4}}>
              Abilita la creazione e gestione di team, obiettivi team, e sotto-attività.
            </p>
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={caricamento}>
            {caricamento ? 'Registrazione...' : 'Registrati'}
          </button>
        </form>
        <p style={{textAlign:'center', marginTop:24, fontSize:14, color:'var(--text-secondary)'}}>
          Hai già un account? <Link to="/login" className="text-link">Accedi</Link>
        </p>
      </div>
    </div>
  );
}

export default PaginaRegistrazione;
