// Testovací servery: „špatný“ web z fixtures (bez sitemapy, soft 404, bez bezpečnostních hlaviček)
import http from 'http';
import fs from 'fs';
import path from 'path';

export function badSite(port) {
  const dir = new URL('./fixtures/bad/', import.meta.url).pathname;
  return http.createServer((req, res) => {
    const p = req.url.split('?')[0];
    if (p === '/robots.txt') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end(fs.readFileSync(path.join(dir, 'robots.txt'))); }
    if (p === '/sluzby' ) { res.writeHead(302, { location: '/sluzby/' }); return res.end(); }
    // soft 404: všechno ostatní vrací úvodní stránku se stavem 200
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'x-powered-by': 'PHP/7.4.33', server: 'Apache/2.4.41 (Ubuntu)' });
    res.end(fs.readFileSync(path.join(dir, 'index.html')));
  }).listen(port);
}
