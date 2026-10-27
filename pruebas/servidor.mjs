// Sirve SkillMatch/src para las pruebas (como Live Server), en http://localhost:5510/pages/...
// Playwright lo enciende solo (playwright.config.js, webServer).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(fileURLToPath(new URL('.', import.meta.url)), '../SkillMatch/src');
const PUERTO = Number(process.env.PUERTO || 5510);
const TIPOS = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2'
};

createServer(async (pedido, respuesta) => {
    const ruta = join(RAIZ, decodeURIComponent(pedido.url.split('?')[0]));
    if (!ruta.startsWith(RAIZ)) { respuesta.writeHead(403); return respuesta.end(); }
    try {
        const datos = await readFile(ruta);
        respuesta.writeHead(200, { 'Content-Type': TIPOS[extname(ruta).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        respuesta.end(datos);
    } catch (e) {
        respuesta.writeHead(404);
        respuesta.end('No encontrado');
    }
}).listen(PUERTO, 'localhost', () => console.log(`Paginas de SkillMatch en http://localhost:${PUERTO}/pages/`));
