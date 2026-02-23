import React from 'react';

function Modale({ aperta, alChiudi, titolo, children }) {
  if (!aperta) return null;
  return (
    <div className="modal-overlay" onClick={alChiudi}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{titolo}</h2>
          <button className="modal-close" onClick={alChiudi}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export default Modale;
