import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

function Layout({ children, utente, alLogout }) {
  const naviga = useNavigate();
  const iniziale = (utente?.nome_utente || utente?.email || 'U').charAt(0).toUpperCase();

  const gestisciLogout = () => {
    alLogout();
    naviga('/login');
  };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        {/* Logo — nascosto su mobile */}
        <div className="sidebar-brand sidebar-hide-mobile">
          <div className="sidebar-brand-icon">S</div>
          <div>
            <div className="sidebar-brand-name">Schedulatore</div>
            <div className="sidebar-brand-sub">Pianificatore Team</div>
          </div>
        </div>

        {/* Navigazione */}
        <nav className="sidebar-nav">
          <div className="sidebar-section sidebar-hide-mobile">Menu</div>
          <NavLink to="/dashboard" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
            <span>📊</span> <span className="nav-label">Dashboard</span>
          </NavLink>
          <NavLink to="/obiettivi" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
            <span>🎯</span> <span className="nav-label">Obiettivi</span>
          </NavLink>
          <NavLink to="/calendario" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
            <span>📅</span> <span className="nav-label">Calendario</span>
          </NavLink>
          <div className="sidebar-section sidebar-hide-mobile">Collaborazione</div>
          <NavLink to="/teams" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
            <span>👥</span> <span className="nav-label">Team</span>
          </NavLink>
        </nav>

        {/* Utente — nascosto su mobile */}
        <div className="sidebar-user sidebar-hide-mobile">
          <div className="sidebar-avatar">{iniziale}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sidebar-uname">{utente?.nome_utente || utente?.username}</div>
            <div className="sidebar-uemail">{utente?.email}</div>
          </div>
        </div>
        <div className="sidebar-hide-mobile" style={{padding:'0 16px 20px'}}>
          <button className="btn btn-ghost btn-sm btn-block" onClick={gestisciLogout}>
            🚪 Esci
          </button>
        </div>
      </aside>
      <main className="main-content">{children}</main>
    </div>
  );
}

export default Layout;
