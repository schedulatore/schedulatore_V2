import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiAuth } from '../utilita/api.js';

function PaginaPasswordDimenticata() {
  const [passo, impostaPasso] = useState(1);
  const [email, impostaEmail] = useState('');
  const [codice, impostaCodice] = useState('');
  const [nuovaPassword, impostaNuovaPassword] = useState('');
  const [messaggio, impostaMessaggio] = useState('');
  const [errore, impostaErrore] = useState('');
  const [caricamento, impostaCaricamento] = useState(false);
  const naviga = useNavigate();

  const inviaRichiesta = async (e) => {
    e.preventDefault();
    impostaErrore('');
    impostaCaricamento(true);
    try {
      const ris = await apiAuth.passwordDimenticata(email);
      impostaMessaggio(ris.data.messaggio);
      impostaPasso(2);
    } catch (err) {
      impostaErrore(err.response?.data?.errore || 'Errore del server.');
    }
    impostaCaricamento(false);
  };

  const reimpostaPassword = async (e) => {
    e.preventDefault();
    impostaErrore('');
    impostaCaricamento(true);
    try {
      await apiAuth.reimpostaPassword({ email, token: codice, nuovaPassword });
      impostaMessaggio('Password reimpostata! Ora puoi accedere.');
      impostaPasso(3);
    } catch (err) {
      impostaErrore(err.response?.data?.errore || 'Errore del server.');
    }
    impostaCaricamento(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Recupera Password</h1>
        {messaggio && <div className="alert alert-success">✅ {messaggio}</div>}
        {errore && <div className="alert alert-danger">⚠️ {errore}</div>}

        {passo === 1 && (
          <form onSubmit={inviaRichiesta}>
            <p className="auth-subtitle">Inserisci la tua email per ricevere il codice di recupero</p>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input type="email" className="form-input" value={email}
                onChange={e => impostaEmail(e.target.value)} required />
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={caricamento}>
              {caricamento ? 'Invio...' : 'Invia Codice'}
            </button>
          </form>
        )}

        {passo === 2 && (
          <form onSubmit={reimpostaPassword}>
            <p className="auth-subtitle">Inserisci il codice ricevuto e la nuova password</p>
            <div className="form-group">
              <label className="form-label">Codice di Recupero</label>
              <input type="text" className="form-input" value={codice} placeholder="XXXXXXXX"
                onChange={e => impostaCodice(e.target.value)} required style={{textTransform:'uppercase', letterSpacing:2, textAlign:'center', fontSize:18}} />
            </div>
            <div className="form-group">
              <label className="form-label">Nuova Password</label>
              <input type="password" className="form-input" value={nuovaPassword}
                onChange={e => impostaNuovaPassword(e.target.value)} required minLength={6} />
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={caricamento}>
              {caricamento ? 'Reimpostazione...' : 'Reimposta Password'}
            </button>
          </form>
        )}

        {passo === 3 && (
          <button className="btn btn-primary btn-block" onClick={() => naviga('/login')}>Vai al Login</button>
        )}

        <p style={{textAlign:'center', marginTop:24, fontSize:14, color:'var(--text-secondary)'}}>
          <Link to="/login" className="text-link">Torna al Login</Link>
        </p>
      </div>
    </div>
  );
}

export default PaginaPasswordDimenticata;
