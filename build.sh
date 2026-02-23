#!/bin/bash
# Script di build per Render.com
# Installa dipendenze client, fa il build, poi installa dipendenze server
echo "📦 Installazione dipendenze frontend..."
cd client && npm install && npm run build
echo "📦 Installazione dipendenze backend..."
cd ../server && npm install
echo "✅ Build completato!"
