// Petit serveur d'aperçu local pour la maquette (aucune dépendance).
// Lancer : node portfolio/serveur.js  puis ouvrir http://localhost:3300
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const racine = __dirname;
const port = Number(process.env.PORT) || 3300;
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };

http.createServer((req, res) => {
  const chemin = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const fichier = path.join(racine, chemin === '/' ? 'index.html' : chemin);
  if (!fichier.startsWith(racine + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(fichier, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Introuvable'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(fichier)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(port, '127.0.0.1', () => console.log(`Portfolio : http://localhost:${port}`));
