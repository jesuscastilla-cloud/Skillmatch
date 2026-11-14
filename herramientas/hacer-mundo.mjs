// Genera SkillMatch/src/assets/data/mundo.json, el mapa del mundo que dibuja mapa-cerca.js.
//
// Fuente: Natural Earth (dominio publico), en el formato del paquete world-atlas:
//   https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json   (756 KB)
// Ese archivo trae mas detalle del que cabe en la tarjeta del mapa. Aqui se reduce:
//   1. Cada frontera (arco) se simplifica con Douglas-Peucker: se quitan los puntos que no
//      cambian la forma en mas de TOLERANCIA grados. Como los paises vecinos comparten el
//      mismo arco, la frontera queda identica de los dos lados (no se abren huecos).
//   2. Se descartan las islas diminutas y los agujeros (enclaves: se dibujan encima igual).
//   3. Las coordenadas se guardan como enteros (centesimas de grado) y en diferencias.
//   4. Cada pais lleva su nombre en espanol (los mas conocidos), su centro y su tamano.
//
// Uso:  node herramientas/hacer-mundo.mjs ruta/a/countries-50m.json
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TOLERANCIA = 0.012;     // grados (~1,3 km): lo que se ve a 1 pixel con el mapa acercado
const AREA_MINIMA = 0.02;     // grados cuadrados: islas mas chicas no se guardan
const ESCALA = 100;           // enteros = grados x 100

const NOMBRES = {
    'Colombia': 'Colombia', 'Venezuela': 'Venezuela', 'Brazil': 'Brasil', 'Peru': 'Perú', 'Ecuador': 'Ecuador', 'Panama': 'Panamá',
    'Costa Rica': 'Costa Rica', 'Nicaragua': 'Nicaragua', 'Honduras': 'Honduras', 'El Salvador': 'El Salvador', 'Guatemala': 'Guatemala',
    'Belize': 'Belice', 'Mexico': 'México', 'United States of America': 'Estados Unidos', 'Canada': 'Canadá', 'Cuba': 'Cuba',
    'Jamaica': 'Jamaica', 'Haiti': 'Haití', 'Dominican Rep.': 'Rep. Dominicana', 'Puerto Rico': 'Puerto Rico', 'Bahamas': 'Bahamas',
    'Trinidad and Tobago': 'Trinidad y Tobago', 'Guyana': 'Guyana', 'Suriname': 'Surinam', 'Bolivia': 'Bolivia', 'Chile': 'Chile',
    'Argentina': 'Argentina', 'Uruguay': 'Uruguay', 'Paraguay': 'Paraguay', 'Greenland': 'Groenlandia', 'Iceland': 'Islandia',
    'Spain': 'España', 'Portugal': 'Portugal', 'France': 'Francia', 'Italy': 'Italia', 'Germany': 'Alemania', 'United Kingdom': 'Reino Unido',
    'Ireland': 'Irlanda', 'Netherlands': 'Países Bajos', 'Belgium': 'Bélgica', 'Switzerland': 'Suiza', 'Austria': 'Austria',
    'Poland': 'Polonia', 'Czechia': 'Chequia', 'Hungary': 'Hungría', 'Romania': 'Rumania', 'Bulgaria': 'Bulgaria', 'Greece': 'Grecia',
    'Turkey': 'Turquía', 'Ukraine': 'Ucrania', 'Belarus': 'Bielorrusia', 'Russia': 'Rusia', 'Norway': 'Noruega', 'Sweden': 'Suecia',
    'Finland': 'Finlandia', 'Denmark': 'Dinamarca', 'Serbia': 'Serbia', 'Croatia': 'Croacia',
    'Morocco': 'Marruecos', 'Algeria': 'Argelia', 'Tunisia': 'Túnez', 'Libya': 'Libia', 'Egypt': 'Egipto', 'Mauritania': 'Mauritania',
    'Mali': 'Malí', 'Niger': 'Níger', 'Chad': 'Chad', 'Sudan': 'Sudán', 'Ethiopia': 'Etiopía', 'Somalia': 'Somalia', 'Kenya': 'Kenia',
    'Tanzania': 'Tanzania', 'Nigeria': 'Nigeria', 'Ghana': 'Ghana', 'Senegal': 'Senegal', 'Cameroon': 'Camerún', 'Angola': 'Angola',
    'Dem. Rep. Congo': 'R. D. del Congo', 'Zambia': 'Zambia', 'Mozambique': 'Mozambique', 'Madagascar': 'Madagascar', 'Namibia': 'Namibia',
    'Botswana': 'Botsuana', 'South Africa': 'Sudáfrica', 'Zimbabwe': 'Zimbabue',
    'Saudi Arabia': 'Arabia Saudita', 'Iran': 'Irán', 'Iraq': 'Irak', 'Syria': 'Siria', 'Israel': 'Israel', 'Yemen': 'Yemen', 'Oman': 'Omán',
    'Afghanistan': 'Afganistán', 'Pakistan': 'Pakistán', 'India': 'India', 'Nepal': 'Nepal', 'Bangladesh': 'Bangladés', 'Sri Lanka': 'Sri Lanka',
    'China': 'China', 'Mongolia': 'Mongolia', 'Kazakhstan': 'Kazajistán', 'Uzbekistan': 'Uzbekistán', 'Japan': 'Japón',
    'South Korea': 'Corea del Sur', 'North Korea': 'Corea del Norte', 'Myanmar': 'Birmania', 'Thailand': 'Tailandia', 'Vietnam': 'Vietnam',
    'Malaysia': 'Malasia', 'Indonesia': 'Indonesia', 'Philippines': 'Filipinas', 'Papua New Guinea': 'Papúa Nueva Guinea',
    'Australia': 'Australia', 'New Zealand': 'Nueva Zelanda', 'Antarctica': 'Antártida'
};

const entrada = process.argv[2];
if (!entrada) { console.error('Falta la ruta a countries-50m.json'); process.exit(1); }
const topo = JSON.parse(readFileSync(entrada, 'utf8'));
const { scale, translate } = topo.transform;

// 1. Arcos a grados
const arcos = topo.arcs.map(arco => {
    let x = 0, y = 0;
    return arco.map(([dx, dy]) => { x += dx; y += dy; return [x * scale[0] + translate[0], y * scale[1] + translate[1]]; });
});

// 2. Douglas-Peucker: conserva los extremos y los puntos que se alejan de la recta mas que la tolerancia
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
    return pts.filter((_, i) => guardar[i]);
}
const simples = arcos.map(a => simplificar(a, TOLERANCIA));

// 3. Paises: solo el contorno de afuera de cada poligono; fuera las islas diminutas
const deArco = i => (i >= 0 ? simples[i] : simples[~i].slice().reverse());
const anillo = indices => indices.flatMap((i, k) => (k ? deArco(i).slice(1) : deArco(i)));
function area(pts) {   // en grados cuadrados, corregida por la latitud
    let s = 0;
    for (let i = 0; i < pts.length; i++) {
        const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
        s += (x1 * y2 - x2 * y1) * Math.cos((y1 + y2) / 2 * Math.PI / 180);
    }
    return Math.abs(s) / 2;
}
const aVector = ([lon, lat]) => {
    const f = lat * Math.PI / 180, l = lon * Math.PI / 180;
    return [Math.cos(f) * Math.cos(l), Math.cos(f) * Math.sin(l), Math.sin(f)];
};

const usados = new Map();   // arco viejo -> arco nuevo
const paises = [];
for (const g of topo.objects.countries.geometries) {
    const poligonos = g.type === 'Polygon' ? [g.arcs] : g.arcs;
    let anillos = poligonos.map(p => ({ indices: p[0], pts: anillo(p[0]) })).map(a => ({ ...a, area: area(a.pts) }));
    anillos.sort((a, b) => b.area - a.area);
    anillos = anillos.filter((a, k) => (k === 0 || a.area >= AREA_MINIMA) && a.pts.length >= 4);
    if (!anillos.length) continue;
    // Centro: el del poligono mas grande (promedio de sus puntos, en la esfera) y radio que abarca todo el pais
    const suma = [0, 0, 0];
    anillos[0].pts.forEach(p => { const v = aVector(p); suma[0] += v[0]; suma[1] += v[1]; suma[2] += v[2]; });
    const n = Math.hypot(...suma), c = suma.map(x => x / n);
    let radio = 0;
    anillos.forEach(a => a.pts.forEach(p => { const v = aVector(p); radio = Math.max(radio, Math.acos(Math.min(1, c[0] * v[0] + c[1] * v[1] + c[2] * v[2]))); }));
    const pais = {
        a: anillos.map(a => a.indices.map(i => {
            const viejo = i >= 0 ? i : ~i;
            if (!usados.has(viejo)) usados.set(viejo, usados.size);
            const nuevo = usados.get(viejo);
            return i >= 0 ? nuevo : ~nuevo;
        })),
        c: [Math.round(Math.atan2(c[1], c[0]) * 180 / Math.PI * 10) / 10, Math.round(Math.asin(c[2]) * 180 / Math.PI * 10) / 10],
        r: Math.ceil(radio * 180 / Math.PI * 10) / 10,
        s: Math.round(anillos[0].area * 10) / 10      // tamano del poligono principal: decide si cabe el nombre
    };
    const nombre = NOMBRES[g.properties.name];
    if (nombre) pais.n = nombre;
    paises.push(pais);
}

// 4. Arcos usados, como enteros en diferencias: [x0, y0, dx, dy, dx, dy, ...]
const salida = new Array(usados.size);
for (const [viejo, nuevo] of usados) {
    const plano = [];
    let ax = 0, ay = 0;
    simples[viejo].forEach(([lon, lat], k) => {
        const x = Math.round(lon * ESCALA), y = Math.round(lat * ESCALA);
        if (k && x === ax && y === ay) return;
        plano.push(x - ax, y - ay);
        ax = x; ay = y;
    });
    salida[nuevo] = plano;
}

const destino = resolve(dirname(fileURLToPath(import.meta.url)), '../SkillMatch/src/assets/data/mundo.json');
mkdirSync(dirname(destino), { recursive: true });
const json = JSON.stringify({ fuente: 'Natural Earth 1:50m (dominio publico), simplificado', escala: ESCALA, arcos: salida, paises });
writeFileSync(destino, json);
console.log(`${paises.length} paises, ${salida.length} arcos, ${salida.reduce((s, a) => s + a.length / 2, 0)} puntos, ${(json.length / 1024).toFixed(0)} KB -> ${destino}`);
