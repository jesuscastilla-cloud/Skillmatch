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
// Los filtros de Vacantes que entiende la direccion (oportunidades.js)
const FILTRO_EN_VACANTES = { type: 'tipo', modality: 'modalidad', experienceLevel: 'experiencia' };
const DIA = 864e5;

// Lo que muestra cada grafica, para su detalle: { titulo, columna, etiquetaValor,
// total, filas: [{ nombre, valor, destacada, enlace, coincide(vacante) }] }
const detalles = {};
let muestraLista = Promise.resolve(null);

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
    quitarDetalle(lista.id);
}

// ---- Cada indicador ----

async function porCategoria(id, campo, opciones, total, columna) {
    const valores = await Promise.all(opciones.map(([valor]) => contar({ [campo]: valor })));
    const filas = opciones.map(([valor, nombre], i) => ({
        nombre, valor: valores[i],
        coincide: v => clave(v[campo]) === clave(valor),
        enlace: `oportunidades.html?${FILTRO_EN_VACANTES[campo]}=${encodeURIComponent(clave(valor))}`
    }));
    barras(document.getElementById(id), filas, total);
    ofrecerDetalle(id, { columna, total, filas });
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
        // Igual que el servidor: maxSalary=X cuenta las de salario mas bajo <= X
        const tope = i < TOPES_SALARIO.length ? TOPES_SALARIO[i] : SIN_TOPE;
        const piso = i ? TOPES_SALARIO[i - 1] : -1;
        const coincide = v => typeof v.salaryMin === 'number' && v.salaryMin > piso && v.salaryMin <= tope;
        return { nombre, valor: hasta - desde, coincide };
    });
    const sinSalario = total - acumulados[acumulados.length - 1];
    filas.push({ nombre: 'Sin salario publicado', valor: sinSalario, coincide: v => typeof v.salaryMin !== 'number' });
    // Los rangos sin ninguna vacante no se dibujan (se veian como barras rotas)
    const conValor = filas.filter(f => f.valor > 0);
    if (!conValor.length) return sinDatos(document.getElementById('indSalario'), 'Todavía no hay salarios publicados.');
    barras(document.getElementById('indSalario'), conValor, total);
    ofrecerDetalle('indSalario', { columna: 'Salario', total, filas: conValor });
}

// Ciudades: la lista sale de la muestra y cada total se cuenta exacto en el
// servidor. Cartagena siempre aparece (en naranja), aunque no este entre las 8.
async function ciudades(muestra, total) {
    const nombres = new Map();
    const kDestacada = clave(CIUDAD_DESTACADA);
    muestra.forEach(v => {
        const ciudad = String(v.location || '').split(',')[0].trim();
        if (!ciudad) return;
        // "Cartagena" y "Cartagena de Indias" son una sola fila: el servidor busca la
        // ciudad como "contiene", asi que "Cartagena" las cuenta todas (antes salian
        // dos filas con el mismo numero)
        const k = clave(ciudad).startsWith(kDestacada) ? kDestacada : clave(ciudad);
        const actual = nombres.get(k) || { nombre: k === kDestacada ? CIUDAD_DESTACADA : ciudad, veces: 0 };
        actual.veces++;
        nombres.set(k, actual);
    });
    if (!nombres.has(clave(CIUDAD_DESTACADA))) nombres.set(clave(CIUDAD_DESTACADA), { nombre: CIUDAD_DESTACADA, veces: 0 });
    // Las 12 mas vistas en la muestra son las candidatas a estar entre las 8
    const candidatas = [...nombres.entries()].sort((a, b) => b[1].veces - a[1].veces).slice(0, 12);
    if (!candidatas.some(([k]) => k === clave(CIUDAD_DESTACADA))) candidatas.push([clave(CIUDAD_DESTACADA), nombres.get(clave(CIUDAD_DESTACADA))]);
    const totales = await Promise.all(candidatas.map(([, c]) => contar({ location: c.nombre })));
    // El servidor busca la ciudad como "contiene": aqui igual
    const filas = candidatas.map(([k, c], i) => ({ nombre: c.nombre, valor: totales[i], destacada: k === clave(CIUDAD_DESTACADA),
        coincide: v => clave(String(v.location || '').split(',')[0]).includes(clave(c.nombre)) }))
        .filter(f => f.valor > 0)
        .sort((a, b) => b.valor - a.valor);
    const primeras = filas.slice(0, MAXIMO_CIUDADES);
    const destacada = filas.find(f => f.destacada);
    if (destacada && !primeras.includes(destacada)) primeras.push(destacada);

    const lista = document.getElementById('indCiudades');
    if (!primeras.length) return sinDatos(lista, 'Todavía no hay vacantes con ciudad.');
    barras(lista, primeras, total);
    ofrecerDetalle('indCiudades', { columna: 'Ciudad', total, filas: primeras });
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
        .map(f => {
            const k = clave(f.nombre);
            return { ...f, enlace: 'oportunidades.html?q=' + encodeURIComponent(f.nombre),
                coincide: v => (v.skills || []).some(s => clave((s && s.name) || s) === k) };
        });
    const lista = document.getElementById('indHabilidades');
    if (!filas.length) return sinDatos(lista, 'Las vacantes recientes no piden habilidades todavía.');
    barras(lista, filas, muestra.length);
    ofrecerDetalle('indHabilidades', { columna: 'Habilidad', etiquetaValor: `En las ${MUESTRA} recientes`, total: muestra.length, filas });
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

// ---- Detalle de cada grafica ----
// "Ver detalle" abre una ventana que crece desde la tarjeta (FLIP: solo
// transform y opacity) con las cifras en una tabla y, si los datos alcanzan,
// cuantas son nuevas esta semana frente a la anterior.

function quitarDetalle(id) {
    delete detalles[id];
    const lista = document.getElementById(id);
    const boton = lista && lista.closest('.indicador') && lista.closest('.indicador').querySelector('.indicador-abrir');
    if (boton) boton.remove();
}

function ofrecerDetalle(id, detalle) {
    const tarjeta = document.getElementById(id).closest('.indicador');
    if (!tarjeta) return;
    const titulo = tarjeta.querySelector('h2').textContent.trim();
    detalles[id] = { titulo, etiquetaValor: 'Abiertas hoy', ...detalle };
    if (tarjeta.querySelector('.indicador-abrir')) return;
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'link-view-all indicador-abrir';
    boton.innerHTML = 'Ver detalle <i data-ico="arrow"></i>';
    // El nombre visible va primero: quien usa la voz dice "Ver detalle"
    boton.setAttribute('aria-label', 'Ver detalle: ' + titulo);
    boton.setAttribute('aria-haspopup', 'dialog');
    boton.addEventListener('click', () => abrirDetalle(id, boton));
    tarjeta.appendChild(boton);
}

// Las nuevas de cada semana salen de la muestra (las publicadas esos dias que
// siguen abiertas). Solo se habla de una semana si la muestra la cubre entera.
// Sin tope arriba: en Render las horas llegan corridas y lo de hoy parece futuro.
function semanasDe(muestra) {
    const ahora = Date.now();
    const fecha = v => new Date(v.postedDate || v.createdAt).getTime();
    const fechas = muestra.map(fecha).filter(Number.isFinite);
    const todas = muestra.length < MUESTRA;
    const masVieja = fechas.length ? Math.min(...fechas) : ahora;
    return {
        cubre7: todas || masVieja <= ahora - 7 * DIA,
        cubre14: todas || masVieja <= ahora - 14 * DIA,
        esta: v => fecha(v) >= ahora - 7 * DIA,
        anterior: v => fecha(v) >= ahora - 14 * DIA && fecha(v) < ahora - 7 * DIA
    };
}

function cambioSemanal(n) {
    if (n > 0) return `<span class="cambio sube" aria-hidden="true">+${numero(n)}</span><span class="sr-only">, ${numero(n)} más que la semana anterior</span>`;
    if (n < 0) return `<span class="cambio baja" aria-hidden="true">−${numero(-n)}</span><span class="sr-only">, ${numero(-n)} menos que la semana anterior</span>`;
    return '<span class="cambio igual" aria-hidden="true">=</span><span class="sr-only">, igual que la semana anterior</span>';
}

function cuerpoDetalle(d, muestra) {
    const s = muestra && muestra.length ? semanasDe(muestra) : null;
    const semana = !!(s && s.cubre7);
    const comparar = !!(s && s.cubre14);
    const filas = d.filas.map(f => {
        const nuevas = semana ? muestra.filter(v => s.esta(v) && f.coincide(v)).length : 0;
        const antes = comparar ? muestra.filter(v => s.anterior(v) && f.coincide(v)).length : 0;
        return { ...f, nuevas, cambio: nuevas - antes };
    });

    let resumen;
    if (!s) resumen = 'No se pudo calcular cuántas vacantes son nuevas esta semana.';
    else if (!semana) resumen = `Se publican tantas vacantes que las ${MUESTRA} más recientes no alcanzan a cubrir una semana: por eso aquí no se comparan semanas.`;
    else {
        const nuevas = muestra.filter(s.esta).length;
        resumen = `En los últimos 7 días se publicaron <strong>${numero(nuevas)}</strong> ${nuevas === 1 ? 'vacante que sigue abierta' : 'vacantes que siguen abiertas'}`;
        if (comparar) {
            const antes = muestra.filter(s.anterior).length;
            const diferencia = nuevas - antes;
            resumen += diferencia === 0 ? ', igual que en los 7 días anteriores.'
                : `: <strong>${numero(Math.abs(diferencia))} ${diferencia > 0 ? 'más' : 'menos'}</strong> que en los 7 días anteriores (${numero(antes)}).`;
            const crecio = [...filas].sort((a, b) => b.cambio - a.cambio)[0];
            if (crecio && crecio.cambio > 0) resumen += ` Lo que más creció: ${escaparHtml(crecio.nombre)} (+${numero(crecio.cambio)}).`;
        } else {
            resumen += '. Todavía no hay datos de la semana anterior para comparar.';
        }
    }

    const filasHtml = filas.map(f => {
        const nombre = f.enlace ? `<a href="${f.enlace}">${escaparHtml(f.nombre)}</a>` : escaparHtml(f.nombre);
        return `<tr${f.destacada ? ' class="destacada"' : ''}>
            <th scope="row">${nombre}</th>
            <td class="num">${numero(f.valor)}<small>${porcentaje(f.valor, d.total)}</small></td>
            ${semana ? `<td class="num">${numero(f.nuevas)}${comparar ? cambioSemanal(f.cambio) : ''}</td>` : ''}
        </tr>`;
    }).join('');
    const enlaces = filas.some(f => f.enlace) ? ' Toca un nombre para ver esas vacantes.' : '';
    return `
        <p class="detalle-resumen">${resumen}</p>
        <div class="detalle-tabla-marco">
            <table class="detalle-tabla">
                <caption class="sr-only">${escaparHtml(d.titulo)}</caption>
                <thead><tr>
                    <th scope="col">${escaparHtml(d.columna)}</th>
                    <th scope="col" class="num">${escaparHtml(d.etiquetaValor)}</th>
                    ${semana ? '<th scope="col" class="num">Nuevas en 7 días</th>' : ''}
                </tr></thead>
                <tbody>${filasHtml}</tbody>
            </table>
        </div>
        ${comparar ? '<p class="detalle-leyenda"><span class="cambio sube" aria-hidden="true">+2</span> compara con los 7 días anteriores.</p>' : ''}
        <p class="detalle-fuente">${d.etiquetaValor === 'Abiertas hoy' ? 'Abiertas hoy es el total exacto. ' : ''}Las nuevas salen de las ${MUESTRA} vacantes abiertas más recientes: cuentan las publicadas esos días que siguen abiertas.${enlaces}</p>`;
}

// FLIP: la ventana se dibuja en su sitio final y arranca con la forma de la
// tarjeta (translate + scale); despues vuelve a su forma. El contenido aparece
// casi al final para que no se vea estirado. Con movimiento reducido no se anima.
function crecerDesde(desde, ventana) {
    ventana.style.animation = 'none'; // sin la entrada de siempre (modal-rise o sheet-up)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !ventana.animate) return;
    const hasta = ventana.getBoundingClientRect();
    if (!desde.width || !hasta.width) return;
    const x = desde.left - hasta.left;
    const y = desde.top - hasta.top;
    const ancho = desde.width / hasta.width;
    const alto = desde.height / hasta.height;
    ventana.style.transformOrigin = 'top left';
    ventana.animate([
        { transform: `translate(${x}px, ${y}px) scale(${ancho}, ${alto})`, opacity: .7 },
        { transform: 'none', opacity: 1 }
    ], { duration: 420, easing: 'cubic-bezier(.2, .8, .2, 1)' });
    ventana.querySelectorAll('.modal-header, .modal-body').forEach(parte => parte.animate(
        [{ opacity: 0 }, { opacity: 0, offset: .5 }, { opacity: 1 }], { duration: 420 }));
}

async function abrirDetalle(id, boton) {
    const d = detalles[id];
    if (!d || !window.SkillMatchUI) return;
    const muestra = await muestraLista;
    // La tarjeta se mide antes de abrir: la ventana bloquea el scroll de la pagina
    const desde = boton.closest('.indicador').getBoundingClientRect();
    const v = SkillMatchUI.ventana({ id: 'ventanaIndicador', titulo: d.titulo, icono: 'chart', ancha: true, cuerpo: cuerpoDetalle(d, muestra) });
    const caja = v.raiz.querySelector('.modal-content');
    crecerDesde(desde, caja);
    // El foco entra a la ventana (el lector la anuncia); el siguiente Tab llega a cerrar
    caja.tabIndex = -1;
    caja.focus({ preventScroll: true });
}

// ---- Arranque ----

async function cargarIndicadores() {
    const seccion = document.getElementById('indicadores');
    const error = document.getElementById('indicadoresError');
    error.hidden = true;
    seccion.setAttribute('aria-busy', 'true');
    ['indTipo', 'indModalidad', 'indExperiencia', 'indSalario', 'indCiudades', 'indHabilidades']
        .forEach(id => { cargando(document.getElementById(id), id === 'indHabilidades' ? 6 : 4); quitarDetalle(id); });

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
    muestraLista = muestra.catch(() => null);
    await Promise.allSettled([
        pedir('/public/stats').then(stats => cifras(stats, abiertas)).catch(() => cifras({}, abiertas)),
        porCategoria('indTipo', 'type', TIPOS, abiertas, 'Tipo').catch(fallo('indTipo')),
        porCategoria('indModalidad', 'modality', MODALIDADES, abiertas, 'Modalidad').catch(fallo('indModalidad')),
        porCategoria('indExperiencia', 'experienceLevel', EXPERIENCIAS, abiertas, 'Experiencia').catch(fallo('indExperiencia')),
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
