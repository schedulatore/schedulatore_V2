import axios from 'axios';

// URL base API - in sviluppo il proxy Vite gestisce /api, in produzione viene dal build
const BASE_API = import.meta.env.VITE_URL_API || '/api';

const api = axios.create({
  baseURL: BASE_API,
  headers: { 'Content-Type': 'application/json' }
});

// Interceptor: aggiungi token JWT a ogni richiesta
api.interceptors.request.use(configurazione => {
  const token = localStorage.getItem('token');
  if (token) configurazione.headers.Authorization = `Bearer ${token}`;
  return configurazione;
});

// Interceptor: gestisci errori di autenticazione
api.interceptors.response.use(
  risposta => risposta,
  errore => {
    if (errore.response?.status === 401 || errore.response?.status === 403) {
      localStorage.removeItem('token');
      localStorage.removeItem('utente');
      window.location.href = '/login';
    }
    return Promise.reject(errore);
  }
);

// Autenticazione
export const apiAuth = {
  registrazione: (dati) => api.post('/auth/registrazione', dati),
  login: (dati) => api.post('/auth/login', dati),
  logout: () => api.post('/auth/logout'),
  passwordDimenticata: (email) => api.post('/auth/password-dimenticata', { email }),
  reimpostaPassword: (dati) => api.post('/auth/reimposta-password', dati),
  profilo: () => api.get('/auth/profilo')
};

// Obiettivi
export const apiObiettivi = {
  tutti: () => api.get('/obiettivi'),
  crea: (dati) => api.post('/obiettivi', dati),
  aggiorna: (id, dati) => api.put(`/obiettivi/${id}`, dati),
  elimina: (id) => api.delete(`/obiettivi/${id}`),
  aggiungiSottoAttivita: (idOb, dati) => api.post(`/obiettivi/${idOb}/sotto-attivita`, dati),
  aggiornaSottoAttivita: (idOb, idSa, dati) => api.put(`/obiettivi/${idOb}/sotto-attivita/${idSa}`, dati),
  eliminaSottoAttivita: (idOb, idSa) => api.delete(`/obiettivi/${idOb}/sotto-attivita/${idSa}`),
  aggiornaPercentuale: (idSa, percentuale) => api.patch(`/obiettivi/sotto-attivita/${idSa}/percentuale`, { percentuale }),
  attivitaGiornaliere: (data) => api.get(`/obiettivi/giornaliere/${data}`),
  flagGiornaliero: (idMicro, flag) => api.patch(`/obiettivi/flag-giornaliero/${idMicro}`, { flag }),
  inviaReport: () => api.post('/obiettivi/invia-report'),
  testEmail: () => api.post('/obiettivi/test-email'),
  calendario: () => api.get('/obiettivi/calendario'),
  verificaConflitti: () => api.post('/obiettivi/verifica-conflitti'),
  sistemaConflitti: () => api.post('/obiettivi/sistema-conflitti'),
  spostaMicro: (idMicro, nuova_data) => api.put(`/obiettivi/sposta-micro/${idMicro}`, { nuova_data })
};

// Team
export const apiTeam = {
  tutti: () => api.get('/team'),
  crea: (dati) => api.post('/team', dati),
  dettaglio: (id) => api.get(`/team/${id}`),
  elimina: (id) => api.delete(`/team/${id}`),
  calendario: (id) => api.get(`/team/${id}/calendario`),
  aggiungiMembro: (idTeam, dati) => api.post(`/team/${idTeam}/membri`, dati),
  modificaMembro: (idTeam, idMembro, dati) => api.put(`/team/${idTeam}/membri/${idMembro}`, dati),
  rimuoviMembro: (idTeam, idMembro) => api.delete(`/team/${idTeam}/membri/${idMembro}`)
};

// Festività
export const apiFestivita = {
  perAnno: (anno) => api.get(`/festivita/${anno}`)
};

export default api;
