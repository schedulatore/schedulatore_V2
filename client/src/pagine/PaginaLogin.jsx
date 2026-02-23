import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiAuth } from '../utilita/api.js';

function PaginaLogin({ alLogin }) {
  const [modulo, impostaModulo] = useState({ email: '', password: '' });
  const [errore, impostaErrore] = useState('');
  const [caricamento, impostaCaricamento] = useState(false);

  const gestisciInvio = async (e) => {
    e.preventDefault();
    impostaErrore('');
    impostaCaricamento(true);
    try {
      const ris = await apiAuth.login(modulo);
      alLogin(ris.data.utente, ris.data.token);
    } catch (err) {
      impostaErrore(err.response?.data?.errore || 'Errore di connessione al server.');
    }
    impostaCaricamento(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Schedulatore</h1>
        <p className="auth-subtitle">Accedi al tuo account</p>
        {errore && <div className="alert alert-danger">⚠️ {errore}</div>}
        <form onSubmit={gestisciInvio}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input type="email" className="form-input" placeholder="nome@azienda.com"
              value={modulo.email} onChange={e => impostaModulo({...modulo, email: e.target.value})} required />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input type="password" className="form-input" placeholder="La tua password"
              value={modulo.password} onChange={e => impostaModulo({...modulo, password: e.target.value})} required />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={caricamento}>
            {caricamento ? 'Accesso...' : 'Accedi'}
          </button>
        </form>
        <p style={{textAlign:'center', marginTop:16, fontSize:14, color:'var(--text-secondary)'}}>
          <Link to="/password-dimenticata" className="text-link">Password dimenticata?</Link>
        </p>
        <p style={{textAlign:'center', marginTop:8, fontSize:14, color:'var(--text-secondary)'}}>
          Non hai un account? <Link to="/registrazione" className="text-link">Registrati</Link>
        </p>
      </div>
    </div>
  );
}

export default PaginaLogin;
