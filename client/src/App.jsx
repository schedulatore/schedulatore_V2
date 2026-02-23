import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { apiAuth } from './utilita/api.js';
import PaginaLogin from './pagine/PaginaLogin.jsx';
import PaginaRegistrazione from './pagine/PaginaRegistrazione.jsx';
import PaginaPasswordDimenticata from './pagine/PaginaPasswordDimenticata.jsx';
import PaginaDashboard from './pagine/PaginaDashboard.jsx';
import PaginaObiettivi from './pagine/PaginaObiettivi.jsx';
import PaginaCalendario from './pagine/PaginaCalendario.jsx';
import PaginaTeam from './pagine/PaginaTeam.jsx';
import PaginaDettaglioTeam from './pagine/PaginaDettaglioTeam.jsx';
import Layout from './componenti/Layout.jsx';
import './stili/App.css';

function App() {
  const [utente, impostaUtente] = useState(null);
  const [caricamento, impostaCaricamento] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const utenteSalvato = localStorage.getItem('utente');
    if (token && utenteSalvato) {
      try { impostaUtente(JSON.parse(utenteSalvato)); } catch { localStorage.clear(); }
    }
    impostaCaricamento(false);
  }, []);

  const gestisciLogin = (datiUtente, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('utente', JSON.stringify(datiUtente));
    impostaUtente(datiUtente);
  };

  const gestisciLogout = async () => {
    try { await apiAuth.logout(); } catch (e) { /* ignora */ }
    localStorage.removeItem('utente');
    localStorage.removeItem('token');
    impostaUtente(null);
  };

  if (caricamento) return <div className="loading"><div className="spinner"></div></div>;

  return (
    <Router>
      <Routes>
        <Route path="/login" element={utente ? <Navigate to="/dashboard" /> : <PaginaLogin alLogin={gestisciLogin} />} />
        <Route path="/registrazione" element={utente ? <Navigate to="/dashboard" /> : <PaginaRegistrazione alLogin={gestisciLogin} />} />
        <Route path="/password-dimenticata" element={<PaginaPasswordDimenticata />} />
        <Route path="/dashboard" element={utente ? <Layout utente={utente} alLogout={gestisciLogout}><PaginaDashboard utente={utente} /></Layout> : <Navigate to="/login" />} />
        <Route path="/obiettivi" element={utente ? <Layout utente={utente} alLogout={gestisciLogout}><PaginaObiettivi utente={utente} /></Layout> : <Navigate to="/login" />} />
        <Route path="/calendario" element={utente ? <Layout utente={utente} alLogout={gestisciLogout}><PaginaCalendario utente={utente} /></Layout> : <Navigate to="/login" />} />
        <Route path="/teams" element={utente ? <Layout utente={utente} alLogout={gestisciLogout}><PaginaTeam utente={utente} /></Layout> : <Navigate to="/login" />} />
        <Route path="/teams/:id" element={utente ? <Layout utente={utente} alLogout={gestisciLogout}><PaginaDettaglioTeam utente={utente} /></Layout> : <Navigate to="/login" />} />
        <Route path="*" element={<Navigate to={utente ? "/dashboard" : "/login"} />} />
      </Routes>
    </Router>
  );
}

export default App;
