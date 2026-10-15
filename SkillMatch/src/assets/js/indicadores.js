// Indicadores del mercado laboral (dashboard.html)
//
// Antes la pagina mostraba un informe de Power BI que pedia iniciar sesion con
// una cuenta de la organizacion: un visitante no veia nada. Ahora todo sale de
// los datos publicos del sitio y se calcula al abrir la pagina.
//
// Las cifras son exactas sobre todas las vacantes abiertas: /jobs/filter
// devuelve el total de cada consulta (totalElements), asi que se pide una sola
// vacante por consulta y se usa ese numero (bajar las 1.608 serian 33 consultas
// y unos 2 MB). Las habilidades y la lista de ciudades salen de las 200
// vacantes mas recientes, porque no hay filtro por habilidad.

const TIPOS = [
    ['empleo', 'Empleo'],
    ['práctica', 'Práctica'],
    ['freelance', 'Independiente o por proyecto']
];
const MODALIDADES = [
    ['presencial', 'Presencial'],
    ['remoto', 'Remoto (desde casa)'],
    ['híbrido', 'Híbrido (casa y sitio de trabajo)']
];
const EXPERIENCIAS = [
    ['sin-experiencia', 'Sin experiencia'],
    ['junior', 'Hasta 1 año'],
    ['semi-senior', 'De 1 a 3 años'],
    ['senior', 'Más de 3 años']
];
// Topes en pesos para los rangos de salario (valor mas bajo del rango publicado).
// Cortes cerca del salario minimo, donde se juntan la mayoria de las vacantes
const TOPES_SALARIO = [1500000, 2000000, 3000000, 5000000];
const SIN_TOPE = 1e12;
const MUESTRA = 200;
const MAXIMO_CIUDADES = 8;
const MAXIMO_HABILIDADES = 10;
const CIUDAD_DESTACADA = 'Cartagena';

// ---- Consultas al servidor ----

// No mas de 6 consultas a la vez: son unas 30 y el servidor es gratuito
function enFila(maximo) {
    let activas = 0;
    const cola = [];
    const siguiente = () => {
        if (activas >= maximo || !cola.length) return;
        activas++;
        const { tarea, ok, falla } = cola.shift();
        tarea().then(ok, falla).finally(() => { activas--; siguiente(); });
    };
    return tarea => new Promise((ok, falla) => { cola.push({ tarea, ok, falla }); siguiente(); });
}
const enTurno = enFila(6);

function pedir(ruta) {
    return enTurno(async () => {
        const r = await fetch(API_BASE_URL + ruta);
        if (!r.ok) throw new Error(`El servidor respondió ${r.status}`);
        return r.json();
    });
}

// Cuantas vacantes abiertas cumplen el filtro, sin descargarlas
function contar(filtros = {}) {
    const p = new URLSearchParams({ ...filtros, size: 1 });
    return pedir('/jobs/filter?' + p).then(d => Number(d.totalElements) || 0);
}

// Las 200 vacantes mas recientes (4 paginas de 50, el maximo del servidor)
function muestraReciente() {
    const paginas = Array.from({ length: MUESTRA / 50 }, (_, i) => pedir(`/jobs?page=${i}&size=50`));
    return Promise.all(paginas).then(ps => ps.flatMap(p => p.content || []));
}

// ---- Formato ----

const numero = n => Number(n).toLocaleString('es-CO');
const porcentaje = (parte, total) => {
    if (!total) return '0 %';
    const p = parte / total * 100;
    return p.toLocaleString('es-CO', { maximumFractionDigits: p < 10 ? 1 : 0 }) + ' %';
};
const millones = pesos => '$' + (pesos / 1e6).toLocaleString('es-CO', { maximumFractionDigits: 1 });
// Minusculas y sin tildes, para agrupar "Bogotá" con "bogota"
const clave = texto => String(texto || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// ---- Dibujo ----

const observador = 'IntersectionObserver' in window
    ? new IntersectionObserver(entradas => entradas.forEach(e => {
        if (!e.isIntersecting) return;
        e.target.classList.add('visible');
        observador.unobserve(e.target);
    }), { threshold: 0.2 })
    : null;

function cargando(lista, filas = 4) {
    lista.innerHTML = Array.from({ length: filas }, (_, i) =>
        `<li class="ib-cargando" aria-hidden="true"><span class="skeleton skeleton-line ${['w-60', 'w-40', 'w-80', 'w-40'][i % 4]}"></span><span class="skeleton skeleton-line"></span></li>`
    ).join('');
    lista.setAttribute('aria-busy', 'true');
}

/** Barras horizontales. filas: [{ nombre, valor, destacada, enlace }].
 *  La barra mas larga es la del valor mas alto; el porcentaje es sobre el total.
 *  La barra solo anima transform (scaleX), como pide el sistema de diseno. */
function barras(lista, filas, total) {
    const maximo = Math.max(1, ...filas.map(f => f.valor));
    lista.innerHTML = filas.map(f => {
        const nombre = f.enlace ? `<a href="${f.enlace}">${escaparHtml(f.nombre)}</a>` : escaparHtml(f.nombre);
        return `
            <li class="ib-fila${f.destacada ? ' destacada' : ''}">
                <span class="ib-nombre">${nombre}</span>
                <span class="ib-valor">${numero(f.valor)}<small>${porcentaje(f.valor, total)}</small></span>
                <span class="ib-barra" aria-hidden="true"><span></span></span>
            </li>`;
    }).join('');
    lista.querySelectorAll('.ib-barra > span').forEach((barra, i) => {
        barra.style.setProperty('--p', filas[i].valor / maximo);
        barra.style.setProperty('--i', i);
    });
    lista.removeAttribute('aria-busy');
    if (observador) observador.observe(lista); else lista.classList.add('visible');
}

function sinDatos(lista, texto) {
    lista.innerHTML = `<li class="ib-vacio">${texto}</li>`;
    lista.removeAttribute('aria-busy');
}

// ---- Cada indicador ----

async function porCategoria(id, campo, opciones, total) {
    const valores = await Promise.all(opciones.map(([valor]) => contar({ [campo]: valor })));
    barras(document.getElementById(id), opciones.map(([, nombre], i) => ({ nombre, valor: valores[i] })), total);
}

// Rangos exactos con conteos acumulados: "cuantas piden como minimo hasta X"
// (maxSalary=X cuenta las de salario mas bajo <= X). Cada rango es la resta de
// dos acumulados y lo que falta para el total son las que no publican salario.
async function salario(total) {
    const acumulados = await Promise.all([...TOPES_SALARIO, SIN_TOPE].map(tope => contar({ maxSalary: tope })));
    const filas = acumulados.map((hasta, i) => {
        const desde = i ? acumulados[i - 1] : 0;
        const nombre = i === 0 ? `Hasta ${millones(TOPES_SALARIO[0])} millones`
            : i < TOPES_SALARIO.length ? `De ${millones(TOPES_SALARIO[i - 1])} a ${millones(TOPES_SALARIO[i])} millones`
            : `Más de ${millones(TOPES_SALARIO[TOPES_SALARIO.length - 1])} millones`;
        return { nombre, valor: hasta - desde };
    });
    const sinSalario = total - acumulados[acumulados.length - 1];
    filas.push({ nombre: 'Sin salario publicado', valor: sinSalario });
    // Los rangos sin ninguna vacante no se dibujan (se veian como barras rotas)
    const conValor = filas.filter(f => f.valor > 0);
    if (!conValor.length) return sinDatos(document.getElementById('indSalario'), 'Todavía no hay salarios publicados.');
    barras(document.getElementById('indSalario'), conValor, total);
}

// Ciudades: la lista sale de la muestra y cada total se cuenta exacto en el
// servidor. Cartagena siempre aparece (en naranja), aunque no este entre las 8.
async function ciudades(muestra, total) {
    const nombres = new Map();
    muestra.forEach(v => {
        const ciudad = String(v.location || '').split(',')[0].trim();
        if (!ciudad) return;
        const k = clave(ciudad);
        const actual = nombres.get(k) || { nombre: ciudad, veces: 0 };
        actual.veces++;
        nombres.set(k, actual);
    });
    if (!nombres.has(clave(CIUDAD_DESTACADA))) nombres.set(clave(CIUDAD_DESTACADA), { nombre: CIUDAD_DESTACADA, veces: 0 });
    // Las 12 mas vistas en la muestra son las candidatas a estar entre las 8
    const candidatas = [...nombres.entries()].sort((a, b) => b[1].veces - a[1].veces).slice(0, 12);
    if (!candidatas.some(([k]) => k === clave(CIUDAD_DESTACADA))) candidatas.push([clave(CIUDAD_DESTACADA), nombres.get(clave(CIUDAD_DESTACADA))]);
    const totales = await Promise.all(candidatas.map(([, c]) => contar({ location: c.nombre })));
    const filas = candidatas.map(([k, c], i) => ({ nombre: c.nombre, valor: totales[i], destacada: k === clave(CIUDAD_DESTACADA) }))
        .filter(f => f.valor > 0)
        .sort((a, b) => b.valor - a.valor);
    const primeras = filas.slice(0, MAXIMO_CIUDADES);
    const destacada = filas.find(f => f.destacada);
    if (destacada && !primeras.includes(destacada)) primeras.push(destacada);

    const lista = document.getElementById('indCiudades');
    if (!primeras.length) return sinDatos(lista, 'Todavía no hay vacantes con ciudad.');
    barras(lista, primeras, total);
    const nota = document.getElementById('indCiudadesNota');
    if (nota) {
        nota.textContent = destacada
            ? `Cartagena va en naranja: ${numero(destacada.valor)} vacantes, el ${porcentaje(destacada.valor, total)} del total.`
            : 'Todavía no hay vacantes en Cartagena.';
    }
}

// Habilidades: en cuantas de las 200 vacantes recientes aparece cada una.
// Cada una lleva a Vacantes buscando esa habilidad.
function habilidades(muestra) {
    const cuenta = new Map();
    muestra.forEach(v => {
        // Una vez por vacante aunque la empresa la escriba dos veces
        new Set((v.skills || []).map(s => String((s && s.name) || s || '').trim()).filter(Boolean)).forEach(nombre => {
            const k = clave(nombre);
            const actual = cuenta.get(k) || { nombre, valor: 0 };
            actual.valor++;
            cuenta.set(k, actual);
        });
    });
    const filas = [...cuenta.values()].sort((a, b) => b.valor - a.valor || a.nombre.localeCompare(b.nombre, 'es'))
        .slice(0, MAXIMO_HABILIDADES)
        .map(f => ({ ...f, enlace: 'oportunidades.html?q=' + encodeURIComponent(f.nombre) }));
    const lista = document.getElementById('indHabilidades');
    if (!filas.length) return sinDatos(lista, 'Las vacantes recientes no piden habilidades todavía.');
    barras(lista, filas, muestra.length);
}

function cifras(stats, abiertas) {
    const valores = { ...stats, vacantes: abiertas };
    document.querySelectorAll('[data-cifra]').forEach(el => {
        const v = valores[el.dataset.cifra];
        if (typeof v === 'number') el.textContent = numero(v);
    });
    const promedio = document.getElementById('indicadoresPromedio');
    if (promedio && abiertas && stats.applications) {
        const unas = (stats.applications / abiertas).toLocaleString('es-CO', { maximumFractionDigits: 1 });
        promedio.textContent = `Unas ${unas} postulaciones por cada vacante abierta.`;
    }
}

// ---- Arranque ----

async function cargarIndicadores() {
    const seccion = document.getElementById('indicadores');
    const error = document.getElementById('indicadoresError');
    error.hidden = true;
    seccion.setAttribute('aria-busy', 'true');
    ['indTipo', 'indModalidad', 'indExperiencia', 'indSalario', 'indCiudades', 'indHabilidades']
        .forEach(id => cargando(document.getElementById(id), id === 'indHabilidades' ? 6 : 4));

    // Si falla una grafica, las demas siguen; si falla todo, se ofrece reintentar
    const fallo = id => () => sinDatos(document.getElementById(id), 'No se pudo calcular. Intenta de nuevo en un momento.');
    let abiertas;
    try {
        abiertas = await contar();
    } catch (e) {
        error.hidden = false;
        seccion.removeAttribute('aria-busy');
        return;
    }
    // Sin vacantes abiertas no hay nada que graficar: un solo aviso, y las cifras
    // generales (personas, empresas) igual se muestran
    const vacio = abiertas === 0;
    document.getElementById('indicadoresVacio').hidden = !vacio;
    document.querySelector('.indicadores-grid').hidden = vacio;
    if (vacio) {
        // El boton depende de quien mira: una empresa publica la suya, una persona
        // con sesion no tiene nada que publicar, un visitante puede registrar su empresa
        let datos = null;
        try { datos = localStorage.getItem('token') ? JSON.parse(localStorage.getItem('userData') || 'null') : null; } catch (e) { /* sin almacenamiento */ }
        const accion = document.getElementById('indicadoresVacioAccion');
        if (datos && datos.userType === 'empresa') {
            accion.href = 'perfil-empresa.html?nueva=1';
            accion.className = 'btn btn-primary';
            accion.textContent = 'Publicar una vacante';
        } else if (datos) {
            accion.hidden = true;
        }
        await pedir('/public/stats').then(stats => cifras(stats, 0)).catch(() => cifras({}, 0));
        seccion.removeAttribute('aria-busy');
        return;
    }
    const muestra = muestraReciente();
    await Promise.allSettled([
        pedir('/public/stats').then(stats => cifras(stats, abiertas)).catch(() => cifras({}, abiertas)),
        porCategoria('indTipo', 'type', TIPOS, abiertas).catch(fallo('indTipo')),
        porCategoria('indModalidad', 'modality', MODALIDADES, abiertas).catch(fallo('indModalidad')),
        porCategoria('indExperiencia', 'experienceLevel', EXPERIENCIAS, abiertas).catch(fallo('indExperiencia')),
        salario(abiertas).catch(fallo('indSalario')),
        muestra.then(m => ciudades(m, abiertas)).catch(fallo('indCiudades')),
        muestra.then(habilidades).catch(fallo('indHabilidades'))
    ]);
    seccion.removeAttribute('aria-busy');
    const hora = document.getElementById('indicadoresHora');
    // "5:52 p. m." ya termina en punto
    if (hora) hora.textContent = 'Datos de hoy a las ' + new Date().toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }).replace(/\.?$/, '.');
}

document.addEventListener('DOMContentLoaded', () => {
    const reintentar = document.getElementById('indicadoresReintentar');
    if (reintentar) reintentar.addEventListener('click', cargarIndicadores);
    cargarIndicadores();
});
