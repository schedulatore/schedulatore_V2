const express = require('express');
const { ottieniFestivitaAnno } = require('../utilita/schedulatore');

const percorso = express.Router();

// GET /api/festivita/:anno
percorso.get('/:anno', (req, res) => {
  try {
    const anno = parseInt(req.params.anno);
    if (isNaN(anno) || anno < 2000 || anno > 2100) {
      return res.status(400).json({ errore: 'Anno non valido.' });
    }
    const festivita = ottieniFestivitaAnno(anno);
    res.json({ festivita });
  } catch (err) {
    console.error('Errore caricamento festività:', err);
    res.status(500).json({ errore: 'Errore del server.' });
  }
});

module.exports = percorso;
