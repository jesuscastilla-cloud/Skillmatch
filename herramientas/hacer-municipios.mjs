// Genera SkillMatch/src/assets/data/municipios-col.json: los limites de los municipios de Colombia que
// dibuja mapa-cerca.js cuando el globo se acerca (y con los que pinta "tu alcance").
//
// Fuente: DANE, Marco Geoestadistico Nacional (2023), publicado por geoBoundaries (gbOpen, COL, ADM2,
// version simplificada), licencia CC BY 4.0: se puede usar dando credito (la pagina lo da).
//   https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/main/releaseData/gbOpen/COL/ADM2/geoBoundaries-COL-ADM2_simplified.geojson
// Ese archivo pesa 10,6 MB (1.122 municipios, 248.000 puntos). Aqui se reduce como el mapa del mundo:
//   1. Fronteras compartidas: un punto donde se cruzan 3 o mas lineas es un cruce; entre dos cruces hay un
//      tramo (arco) que se guarda UNA vez y lo usan los dos municipios vecinos.
//   2. Cada arco se simplifica una sola vez (Douglas-Peucker): la frontera queda identica de los dos lados,
//      sin huecos ni bordes dobles.
//   3. Solo el contorno de afuera de cada municipio (los huecos son municipios que se dibujan encima) y
//      sin islotes diminutos.
//   4. Coordenadas como enteros (grados x ESCALA) y en diferencias, igual que mundo.json.
//
// Uso:  node herramientas/hacer-municipios.mjs ruta/a/geoBoundaries-COL-ADM2_simplified.geojson [tolerancia]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TOLERANCIA = Number(process.argv[3]) || 0.004;   // grados (~440 m): lo que se nota a 1-2 pixeles con el anillo de 25 km
const AREA_MINIMA = 0.0004;                             // grados cuadrados (~5 km2): islotes mas chicos no se guardan
const ESCALA = 2000;                                    // enteros = grados x 2000 (~55 m)

const entrada = process.argv[2];
if (!entrada) { console.error('Falta la ruta al GeoJSON de municipios'); process.exit(1); }
const geo = JSON.parse(readFileSync(entrada, 'utf8'));

// Nombres como se escriben: "Cartagena De Indias" -> "Cartagena de Indias"
const bonito = n => String(n || '').trim().replace(/ (De|Del|La|Las|Los|El|Y|En)(?= )/g, (m, p) => ' ' + p.toLowerCase());
const clave = ([x, y]) => x.toFixed(6) + ',' + y.toFixed(6);

function area(pts) {   // en grados cuadrados, corregida por la latitud
    let s = 0;
    for (let i = 0; i < pts.length; i++) {
        const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
        s += (x1 * y2 - x2 * y1) * Math.cos((y1 + y2) / 2 * Math.PI / 180);
    }
    return Math.abs(s) / 2;
}

// 1. Los contornos de afuera de cada municipio (sin el punto repetido del final)
const municipios = geo.features.map(f => {
    const g = f.geometry;
    const poligonos = g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates];
    let anillos = poligonos.map(p => p[0].slice(0, -1)).filter(a => a.length >= 3).map(pts => ({ pts, area: area(pts) }));
    anillos.sort((a, b) => b.area - a.area);
    anillos = anillos.filter((a, k) => k === 0 || a.area >= AREA_MINIMA);
    return { nombre: bonito(f.properties.shapeName), anillos };
}).filter(m => m.anillos.length);

// 2. Vecinos de cada punto: con mas de 2 vecinos distintos es un cruce
const vecinos = new Map();
for (const m of municipios) for (const { pts } of m.anillos) {
    const n = pts.length;
    for (let i = 0; i < n; i++) {
        const k = clave(pts[i]);
        if (!vecinos.has(k)) vecinos.set(k, new Set());
        const s = vecinos.get(k);
        s.add(clave(pts[(i + n - 1) % n])); s.add(clave(pts[(i + 1) % n]));
    }
}
const esCruce = p => vecinos.get(clave(p)).size > 2;

// 3. Cada anillo se corta en sus cruces; los tramos iguales (en un sentido o en el otro) se guardan una vez
const arcos = [];               // listas de puntos
const indice = new Map();       // "clave del tramo" -> indice del arco
function arcoDe(pts) {
    const ida = pts.map(clave).join(';');
    if (indice.has(ida)) return indice.get(ida);
    const vuelta = pts.slice().reverse().map(clave).join(';');
    if (indice.has(vuelta)) return ~indice.get(vuelta);
    arcos.push(pts);
    indice.set(ida, arcos.length - 1);
    return arcos.length - 1;
}
for (const m of municipios) for (const a of m.anillos) {
    const pts = a.pts, n = pts.length;
    const cruces = [];
    for (let i = 0; i < n; i++) if (esCruce(pts[i])) cruces.push(i);
    if (!cruces.length) {
        // Sin vecinos que lo corten (una isla, un municipio aislado): el anillo entero es un arco
        a.arcos = [arcoDe(pts.concat([pts[0]]))];
        continue;
    }
    a.arcos = cruces.map((desde, j) => {
        const hasta = cruces[(j + 1) % cruces.length];
        const tramo = [];
        for (let i = desde; ; i = (i + 1) % n) { tramo.push(pts[i]); if (i === hasta && tramo.length > 1) break; }
        return arcoDe(tramo);
    });
}

// 4. Douglas-Peucker: conserva los extremos y los puntos que se alejan de la recta mas que la tolerancia
function simplificar(pts, tol) {
    if (pts.length <= 2) return pts;
    const guardar = new Uint8Array(pts.length);
    guardar[0] = guardar[pts.length - 1] = 1;
    const pila = [[0, pts.length - 1]];
    while (pila.length) {
        const [a, b] = pila.pop();
        const [ax, ay] = pts[a], [bx, by] = pts[b];
        const dx = bx - ax, dy = by - ay, largo2 = dx * dx + dy * dy;
        let peor = -1, lejos = tol * tol;
        for (let i = a + 1; i < b; i++) {
            const [px, py] = pts[i];
            let t = largo2 ? ((px - ax) * dx + (py - ay) * dy) / largo2 : 0;
            t = Math.max(0, Math.min(1, t));
            const ex = px - (ax + t * dx), ey = py - (ay + t * dy), d2 = ex * ex + ey * ey;
            if (d2 > lejos) { lejos = d2; peor = i; }
        }
        if (peor > 0) { guardar[peor] = 1; pila.push([a, peor], [peor, b]); }
    }
    // Un arco cerrado (isla) necesita al menos 4 puntos para seguir siendo una forma
    const quedan = pts.filter((_, i) => guardar[i]);
    return quedan.length < 4 && pts.length >= 4 && clave(pts[0]) === clave(pts[pts.length - 1])
        ? [pts[0], pts[Math.floor(pts.length / 3)], pts[Math.floor(2 * pts.length / 3)], pts[0]] : quedan;
}
const simples = arcos.map(a => simplificar(a, TOLERANCIA));

// 5. Centro y tamano de cada municipio (como los paises de mundo.json)
const aVector = ([lon, lat]) => {
    const f = lat * Math.PI / 180, l = lon * Math.PI / 180;
    return [Math.cos(f) * Math.cos(l), Math.cos(f) * Math.sin(l), Math.sin(f)];
};
const salidaMunicipios = municipios.map(m => {
    const suma = [0, 0, 0];
    m.anillos[0].pts.forEach(p => { const v = aVector(p); suma[0] += v[0]; suma[1] += v[1]; suma[2] += v[2]; });
    const nn = Math.hypot(...suma), c = suma.map(x => x / nn);
    let radio = 0;
    m.anillos.forEach(a => a.pts.forEach(p => { const v = aVector(p); radio = Math.max(radio, Math.acos(Math.min(1, c[0] * v[0] + c[1] * v[1] + c[2] * v[2]))); }));
    return {
        a: m.anillos.map(a => a.arcos),
        c: [Math.round(Math.atan2(c[1], c[0]) * 180 / Math.PI * 1000) / 1000, Math.round(Math.asin(c[2]) * 180 / Math.PI * 1000) / 1000],
        r: Math.ceil(radio * 180 / Math.PI * 1000) / 1000,
        s: Math.round(m.anillos[0].area * 10000) / 10000,
        n: m.nombre
    };
});

// 6. Arcos como enteros en diferencias: [x0, y0, dx, dy, ...]
const salidaArcos = simples.map(pts => {
    const plano = [];
    let ax = 0, ay = 0;
    pts.forEach(([lon, lat], k) => {
        const x = Math.round(lon * ESCALA), y = Math.round(lat * ESCALA);
        if (k && x === ax && y === ay) return;
        plano.push(x - ax, y - ay);
        ax = x; ay = y;
    });
    return plano;
});

const destino = resolve(dirname(fileURLToPath(import.meta.url)), '../SkillMatch/src/assets/data/municipios-col.json');
mkdirSync(dirname(destino), { recursive: true });
const json = JSON.stringify({
    fuente: 'DANE, Marco Geoestadistico Nacional 2023, via geoBoundaries (CC BY 4.0), simplificado',
    escala: ESCALA, arcos: salidaArcos, paises: salidaMunicipios
});
writeFileSync(destino, json);
console.log(`${salidaMunicipios.length} municipios, ${salidaArcos.length} arcos, ${salidaArcos.reduce((s, a) => s + a.length / 2, 0)} puntos, ` +
    `${(json.length / 1024).toFixed(0)} KB (tolerancia ${TOLERANCIA}) -> ${destino}`);
