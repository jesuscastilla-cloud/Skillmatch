// Script para la página de Vacantes (oportunidades.html)
//
// - Las vacantes llegan por páginas de 20 ("Cargar más"); antes solo se veían
//   las 20 primeras de todas las publicadas.
// - Los filtros trabajan sobre lo cargado, sea la lista general o el
//   resultado de una búsqueda (antes la búsqueda y los filtros no se juntaban).
// - Cada vacante tiene su detalle completo y la postulación lleva la carta
//   que escribe la persona (antes se mandaba una carta inventada).
// - "Guardadas" muestra las vacantes que la persona guardó (antes se
//   guardaban pero no había dónde verlas). También con ?guardadas=1.

const TAM_PAGINA = 20;

let allJobs = [];            // lo cargado (lista general o resultados de búsqueda)
let shownJobs = [];          // lo que se ve ahora (con filtros), para ordenar sin perderlo
let currentFilters = {};
let savedJobIds = new Set();
let appliedJobIds = new Set(); // vacantes a las que ya te postulaste
let searchAbortController = null;
let paginacion = { modo: 'todas', query: '', pagina: 0, ultima: true, total: 0, cargando: false };
let vacanteAbierta = null;   // la del detalle o la de la postulación
// Habilidades de quien inicio sesion (nombres normalizados). null = no se
// sabe (sin sesion, empresa o fallo la carga): entonces no se muestra %.
let userSkills = null;
let nombresHabilidades = []; // como las escribio la persona (para mostrarlas)
// «Vacante»: habilidades sumadas de prueba (clave normalizada -> nombre; no se guardan) y la que se dejo
// resaltada en las ofertas (clave normalizada o null)
let habilidadesDePrueba = new Map();
let resaltada = null;
let userSkillsReady = Promise.resolve();

function debounce(fn, delay) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

function sesion() {
    try { return JSON.parse(localStorage.getItem('userData') || 'null'); } catch (e) { return null; }
}

function esEmpresa() {
    const datos = sesion();
    return !!datos && datos.userType === 'empresa';
}

function avisar(texto, tipo) {
    if (window.SkillMatchUI) SkillMatchUI.aviso(texto, tipo);
    else alert(texto.replace(/<[^>]+>/g, ''));
}

// Sin sesion: ventana con "Entrar" y "Crear mi perfil" que recuerdan a donde volver (ui.js)
function pedirCuenta(titulo, texto, volver) {
    if (window.SkillMatchUI && SkillMatchUI.pedirCuenta) SkillMatchUI.pedirCuenta({ titulo, texto, volver });
    else irAlLogin(volver);
}

// Cargar oportunidades al iniciar
document.addEventListener('DOMContentLoaded', function() {
    // Filtros y orden que traiga la direccion (antes de elegir el orden inicial)
    leerFiltrosDeDireccion();
    // Las habilidades y las postulaciones se piden a la vez que las vacantes;
    // la lista se pinta una sola vez, ya con el % y "Ya te postulaste"
    // Sin habilidades con que comparar (visitante, o persona que aun no agrega
    // ninguna) se ordena por "Más reciente" antes de pintar la lista
    userSkillsReady = Promise.all([loadUserSkills(), loadAppliedJobs(), loadSavedJobs()]).then(() => {
        if (!esEmpresa() && !(userSkills && userSkills.size)) sinCompatibilidad();
    });
    const parametros = new URLSearchParams(window.location.search);
    if (esEmpresa()) prepararVistaEmpresa();
    // Desde "Vacantes guardadas" del perfil se llega con ?guardadas=1
    if (parametros.get('guardadas') === '1' && sesion() && !esEmpresa()) {
        paginacion.modo = 'guardadas';
        marcarVista('guardadas');
    } else if (parametros.get('mias') === '1' && esEmpresa()) {
        paginacion.modo = 'mias';
        marcarVista('mias');
    } else if ((parametros.get('q') || '').trim()) {
        // Desde la portada ("Ver todas en Vacantes") y la paleta de comandos
        // llega la búsqueda con ?q=. Se busca desde la primera carga (antes
        // ui.js esperaba a que cargara la lista completa y luego buscaba: dos
        // consultas y la lista parpadeaba)
        const buscada = parametros.get('q').trim();
        const campo = document.getElementById('searchInput');
        if (campo) campo.value = buscada;
        paginacion.modo = 'busqueda';
        paginacion.query = buscada;
    }
    loadJobs();
    setupEventListeners();
    prepararHojaDeFiltros();
    updateFilterBadges();

    // Un aviso, la portada, la paleta o un enlace compartido traen ?jobId=: se
    // abre su detalle. En una llegada nueva la lista queda detras en el
    // historial, para que "atras" vuelva a Vacantes y no saque del sitio. Al
    // recargar un detalle (ya tiene su paso en el historial) solo se abre.
    vigilarVentanasEnHistorial();
    const pedida = new URLSearchParams(window.location.search).get('jobId');
    // Al volver del login con ?accion=postular (ver postularme), se abre la postulacion sola
    const accion = new URLSearchParams(window.location.search).get('accion');
    if (accion) {
        const sinAccion = new URL(window.location.href);
        sinAccion.searchParams.delete('accion');
        history.replaceState(history.state, '', sinAccion);
    }
    if (pedida) {
        const recarga = history.state && history.state.vacante === String(pedida);
        if (!recarga) history.replaceState(null, '', direccionConVacante(null));
        abrirDetallePorId(pedida, { sinHistorial: recarga }).then(async () => {
            if (accion !== 'postular' || !sesion() || esEmpresa()) return;
            await userSkillsReady; // asi ya se sabe si se habia postulado
            if (appliedJobIds.has(String(pedida))) avisar('Ya te habías postulado a esta vacante.', 'info');
            else postularme(pedida);
        });
    }
});

// ---- El detalle y la postulacion en el historial ----
// Abrir una vacante agrega un paso al historial con ?jobId= en la direccion:
// "atras" (boton del navegador o gesto del celular) cierra la ventana y deja la
// lista como estaba, con su busqueda, sus filtros y su posicion. Antes "atras"
// sacaba de Vacantes.
const VENTANAS_EN_HISTORIAL = ['jobDetailModal', 'applyModal'];

function direccionConVacante(jobId) {
    const url = new URL(window.location.href);
    if (jobId) url.searchParams.set('jobId', jobId); else url.searchParams.delete('jobId');
    return url;
}

function ventanaAbierta() {
    return VENTANAS_EN_HISTORIAL.map(id => document.getElementById(id)).find(v => v && v.classList.contains('active')) || null;
}

// Un paso nuevo al abrir; si ya habia una ventana de vacante (del detalle a
// "Postularme"), se reemplaza ese paso: "atras" vuelve a la lista
function marcarVentanaEnHistorial(jobId) {
    const estado = { vacante: String(jobId) };
    if (history.state && history.state.vacante) history.replaceState(estado, '', direccionConVacante(jobId));
    else history.pushState(estado, '', direccionConVacante(jobId));
}

function vigilarVentanasEnHistorial() {
    // Se cierra de cuatro formas (X, "Cerrar", Escape o tocando afuera, estas dos
    // en ui.js): se vigila la clase en lugar de cada boton. Solo cuenta el paso
    // de abierta a cerrada, y mientras se vuelve no se vuelve otra vez (otro
    // cambio de clase antes de que llegue el "atras" lo repetia y sacaba de Vacantes)
    let habiaVentana = false;
    let volviendo = false;
    const alCerrar = new MutationObserver(() => {
        const hayVentana = !!ventanaAbierta();
        const seCerro = habiaVentana && !hayVentana;
        habiaVentana = hayVentana;
        if (!seCerro || volviendo || !new URLSearchParams(window.location.search).get('jobId')) return;
        if (history.state && history.state.vacante) {
            volviendo = true;
            history.back();
            setTimeout(() => { volviendo = false; }, 1500); // por si "atras" no llega
        } else {
            history.replaceState(null, '', direccionConVacante(null));
        }
    });
    VENTANAS_EN_HISTORIAL.forEach(id => {
        const ventana = document.getElementById(id);
        if (ventana) alCerrar.observe(ventana, { attributes: true, attributeFilter: ['class'] });
    });
    // "Atras" cierra la ventana; "adelante" la vuelve a abrir
    window.addEventListener('popstate', () => {
        volviendo = false;
        const jobId = new URLSearchParams(window.location.search).get('jobId');
        const abierta = ventanaAbierta();
        if (!jobId && abierta) {
            if (abierta.dataset.cambios === '1' && vacanteAbierta) {
                // Carta escrita sin enviar: la ventana se queda (se repone su paso
                // en el historial) mientras la persona decide si la cierra
                history.pushState({ vacante: String(vacanteAbierta.id) }, '', direccionConVacante(vacanteAbierta.id));
                puedeCerrarVentana(abierta).then(si => { if (si) abierta.classList.remove('active'); });
                return;
            }
            abierta.classList.remove('active');
        } else if (jobId && !abierta) {
            abrirDetallePorId(jobId, { sinHistorial: true });
        }
    });
}

// Cargar la primera página (de la lista general o de la búsqueda)
async function loadJobs() {
    const container = document.querySelector('.opportunities-list');
    if (!container) return;
    container.innerHTML = '<div class="loading-message">Cargando vacantes...</div>';
    allJobs = [];
    await cargarPagina(0);
}

async function cargarPagina(numero) {
    const container = document.querySelector('.opportunities-list');
    if (paginacion.cargando) return;
    paginacion.cargando = true;
    const boton = document.getElementById('loadMoreBtn');
    if (boton) { boton.disabled = true; boton.textContent = 'Cargando…'; }

    if (searchAbortController) searchAbortController.abort();
    searchAbortController = new AbortController();
    const senal = searchAbortController.signal;
    const url = paginacion.modo === 'busqueda'
        ? `${API_BASE_URL}/jobs/search?keyword=${encodeURIComponent(textoParaBuscar(paginacion.query))}&page=${numero}&size=${TAM_PAGINA}`
        : `${API_BASE_URL}/jobs?page=${numero}&size=${TAM_PAGINA}`;

    try {
        let data;
        if (paginacion.modo === 'mias') {
            // Todas las de la empresa, tambien las cerradas (salen marcadas)
            const response = await fetchWithAuth(`${API_BASE_URL}/jobs/company/${encodeURIComponent(sesion().companyId)}`, { signal: senal });
            if (!response.ok) throw new Error(`El servidor respondió ${response.status}`);
            data = (await response.json()).sort((a, b) => new Date(b.postedDate || 0) - new Date(a.postedDate || 0));
        } else if (paginacion.modo === 'guardadas') {
            // Las guardadas no vienen por páginas: se trae cada vacante por su id
            // (/saved-jobs/my-saved-jobs no trae habilidades ni descripción, y
            // sin ellas la tarjeta no podría mostrar el % ni el detalle)
            await userSkillsReady;
            const vacantes = await Promise.all([...savedJobIds].map(id =>
                fetchWithAuth(`${API_BASE_URL}/jobs/${encodeURIComponent(id)}`, { signal: senal })
                    .then(r => r.ok ? r.json() : null)
                    .catch(() => null)));
            if (senal.aborted) { paginacion.cargando = false; return; }
            data = vacantes.filter(Boolean);
        } else {
            const response = await fetchWithAuth(url, { signal: senal });
            if (!response.ok) throw new Error(`El servidor respondió ${response.status}`);
            data = await response.json();
        }
        const lista = Array.isArray(data) ? data : (data.content || []);
        paginacion.pagina = numero;
        paginacion.ultima = Array.isArray(data) ? true : data.last !== false;
        paginacion.total = Array.isArray(data) ? lista.length : (data.totalElements ?? lista.length);
        allJobs = numero === 0 ? lista : allJobs.concat(lista);
        await userSkillsReady;
        paginacion.cargando = false;
        applyFilters();
    } catch (error) {
        paginacion.cargando = false;
        if (error.name === 'AbortError') return;
        if (numero === 0) {
            container.innerHTML = `
                <div class="error-message">
                    <h3>No pudimos cargar las vacantes</h3>
                    <p>Revisa tu conexión e intenta de nuevo.</p>
                    <button onclick="loadJobs()" class="btn btn-primary">Reintentar</button>
                </div>`;
        } else {
            avisar('No se pudieron cargar más vacantes. Intenta de nuevo.', 'error');
            if (boton) { boton.disabled = false; boton.textContent = 'Cargar más vacantes'; }
        }
    }
}

// Habilidades de quien inicio sesion (solo personas: las empresas no tienen)
async function loadUserSkills() {
    const datos = sesion();
    if (!datos || !datos.id || datos.userType === 'empresa') return;
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/users/${datos.id}/skills`);
        if (response.ok) {
            const lista = await response.json();
            userSkills = new Set(lista.map(s => normalizeStr(s.name).trim()));
            nombresHabilidades = lista.map(s => String(s.name || '').trim()).filter(Boolean);
        }
    } catch (error) {
        // Sin habilidades no hay %: las tarjetas salen sin anillo
    }
}

// Vacantes a las que ya te postulaste (antes seguían diciendo "Aplicar")
async function loadAppliedJobs() {
    const datos = sesion();
    if (!datos || datos.userType === 'empresa') return;
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/applications/my-applications`);
        if (response.ok) {
            appliedJobIds = new Set((await response.json()).map(a => String(a.jobId)));
        }
    } catch (error) { /* sin la lista, el servidor igual rechaza una postulación repetida */ }
}

// Habilidades que pide la vacante, sin repetir (los datos de prueba repiten:
// "Angular, Git, Angular"). Conserva como esta escrita la primera aparicion.
function uniqueJobSkills(job) {
    const vistas = new Map();
    (job.skills || []).forEach(s => {
        const clave = normalizeStr(String(s)).trim();
        if (clave && !vistas.has(clave)) vistas.set(clave, String(s).trim());
    });
    return vistas;
}

// Compatibilidad real: que parte de las habilidades que pide la vacante tienes.
// soloTuyas: sin las sumadas de prueba (el detalle habla solo de tu perfil de verdad)
function getSkillMatch(job, soloTuyas) {
    const pedidas = uniqueJobSkills(job);
    // Sin habilidades tuyas todo daria 0 %: no se muestra (sale el aviso)
    if (!userSkills || userSkills.size === 0 || pedidas.size === 0) return null;
    const tiene = [...pedidas.keys()].filter(s => soloTuyas ? userSkills.has(s) : tieneHabilidad(s)).length;
    return { pct: Math.round(tiene / pedidas.size * 100), tiene, pedidas: pedidas.size };
}

// "Mayor compatibilidad" solo ordena si hay habilidades con que comparar. A un
// visitante, a una empresa o a una persona sin habilidades se le ordena por
// "Más reciente" y se le quita esa opcion (antes no ordenaba nada).
function sinCompatibilidad() {
    const orden = document.getElementById('sortSelect');
    if (!orden) return;
    // Si la direccion ya pedia otro orden (por ejemplo "Mejor salario"), se respeta
    if (orden.value === 'match') orden.value = 'recent';
    const opcion = orden.querySelector('option[value="match"]');
    if (opcion) opcion.remove();
}

// Ordena segun el selector, sobre la lista que se este viendo
function sortList(jobs) {
    const criterio = document.getElementById('sortSelect')?.value || 'match';
    const lista = [...jobs];
    if (criterio === 'recent') {
        lista.sort((a, b) => new Date(b.postedDate) - new Date(a.postedDate));
    } else if (criterio === 'salary') {
        lista.sort((a, b) => (b.salaryMax || b.salaryMin || 0) - (a.salaryMax || a.salaryMin || 0));
    } else if (userSkills) {
        // Mayor % primero; a igual %, la que tiene mas habilidades tuyas
        const puntaje = job => { const m = getSkillMatch(job); return m ? m.pct * 100 + m.tiene : -1; };
        lista.sort((a, b) => puntaje(b) - puntaje(a));
    }
    return lista;
}

// Aviso arriba de la lista cuando no se puede calcular el %
function matchHint() {
    const datos = sesion();
    if (!datos) {
        return '<p class="recommend-hint"><i data-ico="bulb"></i> <span><a href="login.html">Inicia sesión</a> para ver qué tanto encajas con cada vacante.</span></p>';
    }
    if (datos.userType !== 'empresa' && userSkills && userSkills.size === 0) {
        return '<p class="recommend-hint"><i data-ico="bulb"></i> <span><a href="perfil-usuario.html">Agrega tus habilidades</a> y te mostramos qué tanto encajas con cada vacante.</span></p>';
    }
    if (datos.userType !== 'empresa' && userSkills && userSkills.size) return panelPerfil();
    return '';
}

// "Mostrar el trabajo" (que se comparo y que salio, con cifras reales) ahora vive en el panel «Vacante»
// ---- «Vacante» (idea del video de moxen.studio, 2026-11-13): tu perfil frente a las vacantes ----
// 1. Un panel arriba de la lista con tus habilidades: cada una dice en cuantas de las vacantes que ves
//    aparece. Al pasar el mouse (o tocarla) se resalta en todas las ofertas que la piden: en su etiqueta
//    y en las palabras del titulo y la descripcion. Y al pasar por una oferta se encienden en el panel las
//    habilidades tuyas que pide: "subraya en ambos lados las palabras que comparten".
// 2. "¿Y si aprendes...?": las habilidades mas pedidas que te faltan. Al tocar una se suma DE PRUEBA (no se
//    guarda en tu perfil): los porcentajes se recalculan y la lista se reordena en vivo.
// 3. La lista se reordena con animacion (FLIP: cada tarjeta se desliza desde donde estaba; solo transform).

/** Si tienes esa habilidad (clave normalizada): en tu perfil o sumada de prueba */
function tieneHabilidad(clave) {
    return !!((userSkills && userSkills.has(clave)) || habilidadesDePrueba.has(clave));
}

/** Texto escapado con las habilidades que tienes marcadas (<mark>), sin importar mayusculas ni tildes.
 *  Solo palabras completas: "Java" no se marca dentro de "JavaScript" */
function marcarCoincidencias(texto) {
    const crudo = String(texto || '');
    const claves = [...(userSkills || []), ...habilidadesDePrueba.keys()].filter(k => k && k.length >= 3);
    if (!claves.length) return escaparHtml(crudo);
    // Una version normalizada letra por letra, para saber donde cae cada hallazgo en el texto original
    const normal = [...crudo].map(c => normalizeStr(c) || ' ').map(c => c.charAt(0)).join('');
    const esLetra = c => /[\p{L}\p{N}]/u.test(c || '');
    const tramos = [];
    claves.forEach(clave => {
        let desde = 0, i;
        while ((i = normal.indexOf(clave, desde)) !== -1) {
            const fin = i + clave.length;
            if (!esLetra(normal[i - 1]) && !esLetra(normal[fin]) && !tramos.some(t => i < t.fin && fin > t.ini)) {
                tramos.push({ ini: i, fin, clave });
            }
            desde = fin;
        }
    });
    if (!tramos.length) return escaparHtml(crudo);
    tramos.sort((a, b) => a.ini - b.ini);
    const letras = [...crudo];
    let html = '', pos = 0;
    tramos.forEach(t => {
        html += escaparHtml(letras.slice(pos, t.ini).join(''));
        html += `<mark class="coincide" data-habilidad="${escaparHtml(t.clave)}">${escaparHtml(letras.slice(t.ini, t.fin).join(''))}</mark>`;
        pos = t.fin;
    });
    return html + escaparHtml(letras.slice(pos).join(''));
}

/** El panel: tus habilidades (con en cuantas vacantes aparecen) y las mas pedidas que te faltan */
function panelPerfil() {
    const cuenta = new Map();     // clave -> en cuantas de las que ves aparece
    const nombres = new Map();    // clave -> como se escribe
    shownJobs.forEach(job => uniqueJobSkills(job).forEach((nombre, clave) => {
        cuenta.set(clave, (cuenta.get(clave) || 0) + 1);
        if (!nombres.has(clave)) nombres.set(clave, nombre);
    }));
    const tuyas = nombresHabilidades.map(n => ({ nombre: n, clave: normalizeStr(n).trim() }))
        .filter((h, i, todas) => h.clave && todas.findIndex(x => x.clave === h.clave) === i)
        .sort((a, b) => (cuenta.get(b.clave) || 0) - (cuenta.get(a.clave) || 0));
    // Las que te faltan, de la mas pedida a la menos (y las que estas probando, siempre)
    const faltan = [...cuenta.keys()]
        .filter(k => !(userSkills && userSkills.has(k)))
        .sort((a, b) => (habilidadesDePrueba.has(b) - habilidadesDePrueba.has(a)) || (cuenta.get(b) - cuenta.get(a)))
        .slice(0, Math.max(4, habilidadesDePrueba.size));
    const vistas = shownJobs.length;
    const conAlguna = shownJobs.filter(j => { const m = getSkillMatch(j); return m && m.tiene > 0; }).length;
    const orden = document.getElementById('sortSelect')?.value === 'match' ? ' Las que más encajan van primero.' : '';
    const veces = n => `${n} ${n === 1 ? 'vacante' : 'vacantes'}`;
    const chipTuya = h => {
        const n = cuenta.get(h.clave) || 0;
        return `<button type="button" class="chip-habilidad es-tuya${n ? '' : ' sin-vacantes'}" data-habilidad="${escaparHtml(h.clave)}" aria-pressed="${resaltada === h.clave}"
            aria-label="${escaparHtml(h.nombre)}: la piden ${veces(n)} de las que ves. Resaltarla en las ofertas">${escaparHtml(h.nombre)}<span class="chip-cuenta" aria-hidden="true">${n}</span></button>`;
    };
    const chipPrueba = k => {
        const activa = habilidadesDePrueba.has(k);
        const nombre = nombres.get(k) || habilidadesDePrueba.get(k) || k;
        return `<button type="button" class="chip-habilidad es-prueba${activa ? ' activa' : ''}" data-probar="${escaparHtml(k)}" aria-pressed="${activa}"
            aria-label="${activa ? 'Quitar' : 'Probar con'} ${escaparHtml(nombre)} (la piden ${veces(cuenta.get(k) || 0)})"><i data-ico="${activa ? 'check' : 'plus'}"></i>${escaparHtml(nombre)}<span class="chip-cuenta" aria-hidden="true">${cuenta.get(k) || 0}</span></button>`;
    };
    return `<section class="perfil-frente" aria-label="Tu perfil frente a estas vacantes">
        <p class="perfil-frente-resumen"><i data-ico="target"></i> <span><strong>Tu perfil frente a estas vacantes.</strong>
            De ${vistas === 1 ? 'la que ves' : `las ${vistas.toLocaleString('es-CO')} que ves`}, <strong>${conAlguna.toLocaleString('es-CO')}</strong> ${conAlguna === 1 ? 'pide' : 'piden'} alguna de tus habilidades.${orden}</span></p>
        <div class="perfil-frente-fila">
            <p class="perfil-frente-titulo" id="tusHabilidadesTitulo">Tus habilidades</p>
            <div class="perfil-frente-chips" role="group" aria-labelledby="tusHabilidadesTitulo">${tuyas.map(chipTuya).join('')}</div>
        </div>
        ${faltan.length ? `<div class="perfil-frente-fila">
            <p class="perfil-frente-titulo" id="probarTitulo">¿Y si aprendes…? <span>Las más pedidas que te faltan</span></p>
            <div class="perfil-frente-chips" role="group" aria-labelledby="probarTitulo">${faltan.map(chipPrueba).join('')}</div>
        </div>` : ''}
        ${habilidadesDePrueba.size ? `<p class="perfil-frente-nota" role="status">Las habilidades de prueba no se guardan. ¿Ya sabes alguna? <a href="perfil-usuario.html">Agrégala a tu perfil</a>.</p>` : ''}
    </section>`;
}

/** Resalta una habilidad en las ofertas (null = ninguna). Las tarjetas que no la piden se apagan un poco */
function aplicarResalte(clave) {
    const lista = document.querySelector('.opportunities-list');
    if (!lista) return;
    lista.querySelectorAll('.resaltada').forEach(el => el.classList.remove('resaltada'));
    lista.classList.toggle('con-resalte', !!clave);
    lista.querySelectorAll('.opportunity-card').forEach(c => c.classList.remove('la-pide'));
    if (!clave) return;
    const sel = `[data-habilidad="${CSS.escape(clave)}"]`;
    lista.querySelectorAll(`.opportunity-card ${sel}`).forEach(el => {
        el.classList.add('resaltada');
        el.closest('.opportunity-card')?.classList.add('la-pide');
    });
    // Tambien las que la piden pero no la muestran (solo caben 4 etiquetas)
    lista.querySelectorAll('.opportunity-card[data-job-id]').forEach(c => {
        const job = shownJobs.find(j => String(j.id) === c.dataset.jobId);
        if (job && uniqueJobSkills(job).has(clave)) c.classList.add('la-pide');
    });
    lista.querySelectorAll(`.chip-habilidad${sel}`).forEach(el => el.classList.add('resaltada'));
}

/** Los oyentes del panel y de las tarjetas (una sola vez: la lista se vuelve a pintar, ellos quedan) */
function prepararPanelPerfil() {
    const lista = document.querySelector('.opportunities-list');
    if (!lista || lista.dataset.panelListo) return;
    lista.dataset.panelListo = '1';
    const conMouse = window.matchMedia('(hover: hover) and (pointer: fine)');
    lista.addEventListener('click', e => {
        const tuya = e.target.closest('.chip-habilidad.es-tuya');
        if (tuya) {
            // Tocarla la deja resaltada (en el celular no hay mouse que pase por encima); otra vez, la suelta
            resaltada = resaltada === tuya.dataset.habilidad ? null : tuya.dataset.habilidad;
            lista.querySelectorAll('.chip-habilidad.es-tuya').forEach(c => c.setAttribute('aria-pressed', String(c.dataset.habilidad === resaltada)));
            aplicarResalte(resaltada);
            return;
        }
        const probar = e.target.closest('.chip-habilidad.es-prueba');
        if (probar) {
            const k = probar.dataset.probar;
            if (habilidadesDePrueba.has(k)) habilidadesDePrueba.delete(k);
            else {
                const job = shownJobs.find(j => uniqueJobSkills(j).has(k));
                habilidadesDePrueba.set(k, job ? uniqueJobSkills(job).get(k) : k);
            }
            actualizarEnSitio();
            // El foco vuelve al mismo boton (el panel se pinto de nuevo)
            lista.querySelector(`.chip-habilidad.es-prueba[data-probar="${CSS.escape(k)}"]`)?.focus({ preventScroll: true });
        }
    });
    // Pasar el mouse o llegar con el teclado a una habilidad: vista previa del resalte
    const previa = e => {
        const tuya = e.target.closest?.('.chip-habilidad.es-tuya');
        if (tuya) aplicarResalte(tuya.dataset.habilidad);
    };
    const soltarPrevia = e => {
        if (e.target.closest?.('.chip-habilidad.es-tuya')) aplicarResalte(resaltada);
    };
    lista.addEventListener('focusin', previa);
    lista.addEventListener('focusout', soltarPrevia);
    lista.addEventListener('mouseover', e => { if (conMouse.matches) previa(e); });
    lista.addEventListener('mouseout', e => { if (conMouse.matches) soltarPrevia(e); });
    // Pasar por una oferta: en el panel se encienden tus habilidades que pide
    let tarjeta = null;
    lista.addEventListener('mouseover', e => {
        if (!conMouse.matches) return;
        const c = e.target.closest('.opportunity-card[data-job-id]');
        if (c === tarjeta) return;
        tarjeta = c;
        lista.querySelectorAll('.chip-habilidad.en-oferta').forEach(x => x.classList.remove('en-oferta'));
        if (!c) return;
        const job = shownJobs.find(j => String(j.id) === c.dataset.jobId);
        if (!job) return;
        uniqueJobSkills(job).forEach((_, k) => {
            lista.querySelectorAll(`.chip-habilidad[data-habilidad="${CSS.escape(k)}"], .chip-habilidad[data-probar="${CSS.escape(k)}"]`)
                .forEach(x => x.classList.add('en-oferta'));
        });
    });
    lista.addEventListener('mouseleave', () => {
        tarjeta = null;
        lista.querySelectorAll('.chip-habilidad.en-oferta').forEach(x => x.classList.remove('en-oferta'));
    });
}

/** Cambio el orden o una habilidad de prueba: las mismas vacantes. En vez de construir la lista de nuevo
 *  (medido: cada vez dejaba un cuadro de 70 a 125 ms, porque volvian a nacer las tarjetas con sus iconos,
 *  anillos, logos y su entrada), se actualizan las tarjetas que ya estan y se mueven a su nuevo lugar */
function actualizarEnSitio() {
    const container = document.querySelector('.opportunities-list');
    if (!container) return;
    const tarjetas = new Map([...container.querySelectorAll('.opportunity-card[data-job-id]')].map(c => [c.dataset.jobId, c]));
    const nueva = sortList(shownJobs);
    if (tarjetas.size !== nueva.length || nueva.some(j => !tarjetas.has(String(j.id)))) { displayJobs(shownJobs); return; }
    shownJobs = nueva;
    pintarConAnimacion(container, () => {
        const molde = document.createElement('div');
        molde.innerHTML = matchHint();
        const panel = container.querySelector('.perfil-frente, .match-resumen, .recommend-hint');
        if (panel && molde.firstElementChild) panel.replaceWith(molde.firstElementChild);
        // Solo se mueven las que cambian de lugar (medido: mover las 9 recalculaba los estilos de todas)
        let actual = container.querySelector('.opportunity-card[data-job-id]');
        nueva.forEach(job => {
            const c = tarjetas.get(String(job.id));
            actualizarTarjeta(c, job);
            if (c === actual) actual = siguienteTarjeta(c);
            else container.insertBefore(c, actual || container.querySelector('.cargar-mas'));
        });
    });
    aplicarResalte(resaltada);
}

function siguienteTarjeta(c) {
    let n = c.nextElementSibling;
    while (n && !n.matches('.opportunity-card[data-job-id]')) n = n.nextElementSibling;
    return n;
}

/** Lo que cambia en una tarjeta con tus habilidades: subrayados, etiquetas y el anillo. Solo se reescribe
 *  lo que de verdad cambio (cada cambio en la pagina cuesta recalcular estilos) */
function actualizarTarjeta(c, job) {
    const poner = (el, html) => {
        if (!el) return;
        if (el.dataset.html === html) return;
        el.innerHTML = html;
        el.dataset.html = html;
    };
    poner(c.querySelector('.job-title-link'), marcarCoincidencias(job.title));
    poner(c.querySelector('.card-description'), marcarCoincidencias(truncateText(job.description, 150)));
    poner(c.querySelector('.card-skills'), etiquetasHabilidades(job, 4));
    const viejo = c.querySelector('.match-ring');
    const m = getSkillMatch(job);
    if (!m) { if (viejo) viejo.remove(); return; }
    if (!viejo) { c.querySelector('.card-header-opp')?.insertAdjacentHTML('beforeend', anilloCompatibilidad(job)); return; }
    const antes = parseInt(viejo.dataset.pct, 10) || 0;
    if (antes === m.pct) return;
    const texto = `Tienes ${m.tiene} de ${m.pedidas} habilidades que pide`;
    viejo.dataset.pct = m.pct;
    viejo.title = texto;
    viejo.setAttribute('aria-label', `${m.pct} por ciento: ${texto.charAt(0).toLowerCase() + texto.slice(1)}`);
    viejo.setAttribute('data-level', m.pct >= 80 ? 'alto' : (m.pct >= 55 ? 'medio' : 'bajo'));
    // El anillo cambia de una vez y da un pulso corto (solo transform). Antes contaba de un % al otro
    // reescribiendo --pct en cada cuadro: eso recalculaba estilos todo el tiempo mientras la lista se movia
    viejo.style.setProperty('--pct', m.pct);
    const cifra = viejo.querySelector('span');
    if (cifra) cifra.textContent = m.pct + '%';
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && viejo.animate) {
        viejo.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.14)', offset: .4 }, { transform: 'scale(1)' }],
            { duration: 280, easing: 'cubic-bezier(.23, 1, .32, 1)' });
    }
}

/** Pinta la lista de nuevo y, si ya habia tarjetas, cada una se desliza desde donde estaba (FLIP:
 *  se mide antes, se pinta, se mide despues y se anima la diferencia con transform). Las que llegan
 *  nuevas aparecen suaves, en fila corta. Solo las que se ven: las de mas abajo cambian sin animar. */
function pintarConAnimacion(container, pintar) {
    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const antes = new Map();
    if (!quieto) container.querySelectorAll('.opportunity-card[data-job-id]').forEach(c => antes.set(c.dataset.jobId, c.getBoundingClientRect()));
    pintar();
    if (quieto || !antes.size || !Element.prototype.animate) return;
    const alto = window.innerHeight;
    const seVe = r => r.bottom > -100 && r.top < alto + 100;
    let nuevas = 0;
    container.querySelectorAll('.opportunity-card[data-job-id]').forEach(c => {
        const r1 = c.getBoundingClientRect();
        const r0 = antes.get(c.dataset.jobId);
        if (r0) {
            const dy = r0.top - r1.top;
            if (Math.abs(dy) < 1 || (!seVe(r0) && !seVe(r1))) return;
            // Desde lejos (fuera de la pantalla) no cruza todo: entra desde un poco mas alla del borde
            const limite = alto * 0.6;
            const desde = Math.max(-limite, Math.min(limite, dy));
            c.animate([{ transform: `translateY(${desde}px)` }, { transform: 'none' }],
                { duration: 380, easing: 'cubic-bezier(.32, .72, 0, 1)' });
        } else if (seVe(r1)) {
            c.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }],
                { duration: 240, delay: Math.min(nuevas++, 4) * 40, easing: 'cubic-bezier(.23, 1, .32, 1)', fill: 'backwards' });
        }
    });
}

function hayFiltros() {
    const f = currentFilters;
    return !!(f.types?.length || f.modalities?.length || f.experienceLevels?.length || (f.maxSalary && f.maxSalary < 10000000));
}

// "Cargar más" debajo de la lista mientras queden vacantes por traer
function bloqueCargarMas() {
    if (paginacion.ultima) return '';
    return `<div class="cargar-mas">
        <button type="button" class="btn btn-secondary" id="loadMoreBtn" onclick="cargarPagina(paginacion.pagina + 1)">Cargar más vacantes</button>
        <p>Llevas ${allJobs.length.toLocaleString('es-CO')} de ${paginacion.total.toLocaleString('es-CO')}${paginacion.modo === 'busqueda' ? ' resultados' : ' vacantes publicadas'}.</p>
    </div>`;
}

// Mostrar trabajos en el DOM
function displayJobs(jobs) {
    const container = document.querySelector('.opportunities-list');

    if (!jobs || jobs.length === 0) {
        shownJobs = [];
        const porFiltros = allJobs.length > 0;
        if (paginacion.modo === 'mias' && !porFiltros) {
            container.innerHTML = `
                <div class="no-results-message">
                    <h3>Aún no has publicado vacantes</h3>
                    <p>Cuando publiques una, aquí la verás tal como la ven las personas.</p>
                    <a class="btn btn-primary" href="perfil-empresa.html?nueva=1"><i data-ico="plus"></i> Publicar una vacante</a>
                </div>`;
            updateResultsCount(0);
            return;
        }
        if (paginacion.modo === 'guardadas' && !porFiltros) {
            container.innerHTML = `
                <div class="no-results-message">
                    <h3>Aún no has guardado vacantes</h3>
                    <p>Pulsa "Guardar" en las vacantes que te interesen y aquí las tienes a mano para postularte cuando quieras.</p>
                    <button type="button" class="btn btn-primary" onclick="cambiarVista('todas')">Ver todas las vacantes</button>
                </div>`;
            updateResultsCount(0);
            return;
        }
        // Sin ninguna vacante en el sitio (no es una busqueda): decirlo tal cual y,
        // a una empresa o a un visitante, ofrecer publicar la primera
        const sitioVacio = !porFiltros && paginacion.modo !== 'busqueda';
        const publicar = !sitioVacio ? ''
            : esEmpresa() ? '<a class="btn btn-primary" href="perfil-empresa.html?nueva=1"><i data-ico="plus"></i> Publicar una vacante</a>'
            : !sesion() ? '<a class="btn btn-secondary" href="registro-empresa.html">¿Tienes una empresa? Publica la primera</a>' : '';
        container.innerHTML = `
            <div class="no-results-message">
                <h3>${porFiltros ? 'Ninguna vacante cumple los filtros' : (paginacion.modo === 'busqueda' ? 'No encontramos vacantes con esa búsqueda' : 'Aún no hay vacantes publicadas')}</h3>
                <p>${porFiltros ? (paginacion.ultima ? 'Prueba quitando algún filtro.' : 'Prueba quitando algún filtro o carga más vacantes.')
                    : sitioVacio ? 'Cuando las empresas publiquen vacantes, aparecerán aquí.'
                    : 'Prueba con otra palabra, por ejemplo el nombre del cargo o de la empresa.'}</p>
                ${publicar}
            </div>` + bloqueCargarMas();
        updateResultsCount(0);
        return;
    }

    // Siempre en el orden elegido (antes los filtros y la busqueda lo ignoraban)
    shownJobs = sortList(jobs);
    // Si ya habia tarjetas, cada una se desliza a su nuevo lugar («Vacante»)
    pintarConAnimacion(container, () => {
        container.innerHTML = matchHint() + shownJobs.map(job => createJobCard(job)).join('') + bloqueCargarMas();
    });
    prepararPanelPerfil();
    aplicarResalte(resaltada);
    updateResultsCount(jobs.length);
}

function textoSalario(job) {
    // Si el minimo y el maximo son iguales, un solo valor (antes "$1.423.500 - $1.423.500")
    return job.salaryMin && job.salaryMax && Number(job.salaryMin) === Number(job.salaryMax) ? formatCurrency(job.salaryMin)
        : job.salaryMin && job.salaryMax
        ? `${formatCurrency(job.salaryMin)} - ${formatCurrency(job.salaryMax)}`
        : job.salaryMin ? `Desde ${formatCurrency(job.salaryMin)}`
        : job.salaryMax ? `Hasta ${formatCurrency(job.salaryMax)}`
        : 'Salario a convenir';
}

// Habilidades como etiquetas: las que ya tienes primero, en turquesa y con
// palomita (asi se ve de donde sale el %)
function etiquetasHabilidades(job, maximo) {
    const pedidas = uniqueJobSkills(job);
    const tuyas = [...pedidas.keys()].filter(k => tieneHabilidad(k));
    const orden = [...tuyas, ...[...pedidas.keys()].filter(k => !tuyas.includes(k))];
    if (!orden.length) return '<span class="skill">Sin especificar</span>';
    const visibles = maximo ? orden.slice(0, maximo) : orden;
    // data-habilidad: el panel «Vacante» la resalta desde aqui. Las sumadas de prueba van punteadas
    return visibles.map(k => tuyas.includes(k)
        ? `<span class="skill is-common${habilidadesDePrueba.has(k) && !(userSkills && userSkills.has(k)) ? ' is-prueba' : ''}" data-habilidad="${escaparHtml(k)}"><i data-ico="check"></i>${escaparHtml(pedidas.get(k))}</span>`
        : `<span class="skill" data-habilidad="${escaparHtml(k)}">${escaparHtml(pedidas.get(k))}</span>`).join('') +
        (maximo && orden.length > maximo ? `<span class="skill skill-mas">+${orden.length - maximo}</span>` : '');
}

function anilloCompatibilidad(job, soloTuyas) {
    // Sin habilidades tuyas o de la vacante no hay con que comparar: sin anillo
    const match = getSkillMatch(job, soloTuyas);
    return match
        ? `<div class="match-ring" data-pct="${match.pct}" role="img"
                title="Tienes ${match.tiene} de ${match.pedidas} habilidades que pide"
                aria-label="${match.pct} por ciento: tienes ${match.tiene} de ${match.pedidas} habilidades que pide"></div>`
        : '';
}

// Botones de guardar y postularse (las empresas no se postulan ni guardan)
function botonesVacante(job) {
    if (esEmpresa()) return esMiVacante(job)
        ? `<span class="tu-vacante"><i data-ico="building"></i> Tu vacante</span>` +
          (vacanteCerrada(job) ? '<span class="vacante-cerrada"><i data-ico="clock"></i> Ya no recibe postulaciones</span>' : '') +
          `<a class="btn-apply" href="perfil-empresa.html?candidatos=${encodeURIComponent(job.id)}">Ver candidatos</a>`
        : '';
    const id = escaparHtml(job.id);
    const guardada = savedJobIds.has(job.id);
    const guardar = `<button type="button" class="btn-save${guardada ? ' saved' : ''}" data-job-id="${id}" onclick="toggleSaveJob(this.dataset.jobId, this)">${guardada ? '<i data-ico="heart"></i> Guardada' : '<i data-ico="save"></i> Guardar'}</button>`;
    // Una guardada puede haber cerrado después (en la lista general no salen)
    if (vacanteCerrada(job)) return guardar + '<span class="vacante-cerrada"><i data-ico="clock"></i> Ya no recibe postulaciones</span>';
    const postular = appliedJobIds.has(String(job.id))
        ? '<button type="button" class="btn-apply applied" disabled><i data-ico="check"></i> Ya te postulaste</button>'
        : `<button type="button" class="btn-apply" data-job-id="${id}" onclick="postularme(this.dataset.jobId)">Postularme</button>`;
    return guardar + postular;
}

function vacanteCerrada(job) {
    return job.active === false || normalizeStr(job.status) === 'cerrada';
}

// Nombre de la empresa como enlace a su perfil publico (empresa.html). Antes
// era solo texto y no habia donde conocer a la empresa antes de postularse
function enlaceEmpresa(job) {
    const nombre = escaparHtml(job.companyName || 'Empresa confidencial');
    return job.companyId && job.companyName
        ? `<a class="enlace-empresa" href="empresa.html?id=${encodeURIComponent(job.companyId)}">${nombre}</a>`
        : nombre;
}

// "Nueva" (publicada en los ultimos 3 dias) y "Cierra en N dias" (cierra en una
// semana o menos): datos que la tarjeta no mostraba; antes la fecha limite solo
// salia en el detalle. Dias de calendario, como formatDate.
function etiquetasVacante(job) {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const diasHasta = fecha => {
        const d = new Date(fecha);
        if (!fecha || Number.isNaN(d.getTime())) return null;
        d.setHours(0, 0, 0, 0);
        return Math.round((d - hoy) / 86400000);
    };
    const etiquetas = [];
    const publicada = diasHasta(job.postedDate);
    if (publicada !== null && publicada >= -2 && publicada <= 0) etiquetas.push('<span class="etiqueta-vacante es-nueva">Nueva</span>');
    const abierta = !job.status || String(job.status).toLowerCase() === 'abierta';
    const cierra = abierta ? diasHasta(job.expirationDate) : null;
    if (cierra !== null && cierra >= 0 && cierra <= 7) {
        const texto = cierra === 0 ? 'Cierra hoy' : cierra === 1 ? 'Cierra mañana' : `Cierra en ${cierra} días`;
        etiquetas.push(`<span class="etiqueta-vacante es-cierra"><i data-ico="clock"></i> ${texto}</span>`);
    }
    return etiquetas.length ? `<div class="etiquetas-vacante">${etiquetas.join('')}</div>` : '';
}

// Crear tarjeta de trabajo
function createJobCard(job) {
    const id = escaparHtml(job.id);
    return `
        <div class="opportunity-card" data-job-id="${id}">
            <div class="card-header-opp">
                <div class="company-logo-opp" data-monograma="${escaparHtml(job.companyName || '')}"${job.companyId ? ` data-logo-empresa="${escaparHtml(String(job.companyId))}"` : ''}>${job.companyName ? escaparHtml(job.companyName.charAt(0)) : '<i data-ico="building"></i>'}</div>
                <div class="card-info">
                    <h3 class="job-title"><button type="button" class="job-title-link" data-job-id="${id}" onclick="abrirDetallePorId(this.dataset.jobId)">${marcarCoincidencias(job.title)}</button></h3>
                    <p class="company-name">${enlaceEmpresa(job)}</p>
                    ${etiquetasVacante(job)}
                </div>
                ${anilloCompatibilidad(job)}
            </div>

            <div class="card-meta">
                <span class="meta-item"><i data-ico="pin"></i> ${escaparHtml(job.location || 'Sin ciudad')}</span>
                <span class="meta-item"><i data-ico="briefcase"></i> ${translateJobType(job.type)}</span>
                <span class="meta-item"><i data-ico="desktop"></i> ${translateModality(job.modality)}</span>
                <span class="meta-item"><i data-ico="cap"></i> ${translateExperienceLevel(job.experienceLevel)}</span>
                <span class="meta-item"><i data-ico="money"></i> ${textoSalario(job)}</span>
            </div>

            <p class="card-description">${marcarCoincidencias(truncateText(job.description, 150))}</p>

            <div class="card-skills">
                ${etiquetasHabilidades(job, 4)}
            </div>

            <div class="card-footer">
                <span class="post-date"><i data-ico="calendar"></i> ${formatDate(job.postedDate)}</span>
                <div class="card-actions">
                    <button type="button" class="btn-ver-detalle" data-job-id="${id}" onclick="abrirDetallePorId(this.dataset.jobId)">Ver detalle</button>
                    ${botonesVacante(job)}
                </div>
            </div>
        </div>
    `;
}

// ---- Detalle de la vacante ----

async function abrirDetallePorId(jobId, opciones = {}) {
    let job = allJobs.find(j => String(j.id) === String(jobId));
    if (!job) {
        // Desde una notificación la vacante puede no estar entre las cargadas
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/jobs/${encodeURIComponent(jobId)}`);
            if (!response.ok) throw new Error();
            job = await response.json();
        } catch (error) {
            avisar('No pudimos abrir esa vacante. Puede que ya no esté publicada.', 'error');
            return;
        }
    }
    abrirDetalle(job, opciones);
}

function listaDetalle(titulo, items) {
    const limpios = (items || []).map(i => String(i).trim()).filter(Boolean);
    if (!limpios.length) return '';
    return `<h3>${titulo}</h3><ul class="detalle-lista">${limpios.map(i => `<li>${escaparHtml(i)}</li>`).join('')}</ul>`;
}

// "¿Por qué este match?" (plan, fase 3): de las habilidades que pide la vacante,
// cuales ya tienes (turquesa, como en las tarjetas) y cuales te faltan (naranja).
// Asi se sabe que aprender, o que agregar al perfil si ya se sabe.
function porQueEsteMatch(job) {
    const pedidas = [...uniqueJobSkills(job)];
    const tiene = pedidas.filter(([clave]) => userSkills.has(clave)).map(([, nombre]) => nombre);
    const faltan = pedidas.filter(([clave]) => !userSkills.has(clave)).map(([, nombre]) => nombre);
    const etiquetas = (lista, clase, icono) =>
        lista.map(nombre => `<span class="skill ${clase}"><i data-ico="${icono}"></i>${escaparHtml(nombre)}</span>`).join('');
    return `
        <h3>¿Por qué este match?</h3>
        ${tiene.length ? `<p class="match-grupo">Ya tienes</p><div class="card-skills">${etiquetas(tiene, 'is-common', 'check')}</div>` : ''}
        ${faltan.length
            ? `<p class="match-grupo">Te faltan</p><div class="card-skills">${etiquetas(faltan, 'skill-falta', 'plus')}</div>
               <p class="match-consejo">¿Ya sabes alguna? <a href="perfil-usuario.html">Agrégala a tu perfil</a> y tu compatibilidad se actualiza.</p>`
            : '<p class="match-consejo">Tienes todas las habilidades que pide esta vacante.</p>'}`;
}

function abrirDetalle(job, { sinHistorial = false } = {}) {
    vacanteAbierta = job;
    const modal = document.getElementById('jobDetailModal');
    const match = getSkillMatch(job, true);
    const publicada = formatDate(job.postedDate);
    const fechaLimite = job.expirationDate
        ? new Date(job.expirationDate).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
        : '';

    document.getElementById('jobDetailTitle').textContent = job.title || 'Vacante';
    document.getElementById('jobDetailCompany').innerHTML = enlaceEmpresa(job);
    document.getElementById('jobDetailBody').innerHTML = `
        ${match ? `<div class="detalle-match">${anilloCompatibilidad(job, true)}<p>Tienes <strong>${match.tiene} de ${match.pedidas}</strong> habilidades que pide esta vacante.</p></div>` : ''}
        <ul class="detalle-datos">
            <li><i data-ico="pin"></i> ${escaparHtml(job.location || 'Sin ciudad')}</li>
            <li><i data-ico="briefcase"></i> ${translateJobType(job.type)}</li>
            <li><i data-ico="desktop"></i> ${translateModality(job.modality)}</li>
            <li><i data-ico="cap"></i> ${translateExperienceLevel(job.experienceLevel)}</li>
            <li><i data-ico="money"></i> ${textoSalario(job)}</li>
            ${job.duration ? `<li><i data-ico="clock"></i> Duración: ${escaparHtml(job.duration)}</li>` : ''}
            ${publicada ? `<li><i data-ico="calendar"></i> Publicada ${/^\d/.test(publicada) ? 'el ' + publicada : publicada.toLowerCase()}</li>` : ''}
            ${fechaLimite ? `<li><i data-ico="alert"></i> Postúlate hasta el ${fechaLimite}</li>` : ''}
        </ul>
        <h3>Descripción</h3>
        <p class="detalle-texto">${escaparHtml(job.description || 'La empresa no agregó una descripción.')}</p>
        ${match ? porQueEsteMatch(job) : `<h3>Habilidades que pide</h3><div class="card-skills">${etiquetasHabilidades(job)}</div>`}
        ${listaDetalle('Requisitos', job.requirements)}
        ${listaDetalle('Responsabilidades', job.responsibilities)}
        ${listaDetalle('Beneficios', job.benefits)}
    `;
    document.getElementById('jobDetailActions').innerHTML =
        `<button type="button" class="btn-secondary-modal" onclick="cerrarVentana('jobDetailModal')">Cerrar</button>` + botonesVacante(job);
    modal.classList.add('active');
    modal.querySelector('.modal-body').scrollTop = 0;
    if (!sinHistorial) marcarVentanaEnHistorial(job.id);
}

function cerrarVentana(id) {
    document.getElementById(id).classList.remove('active');
}

// Cierre pedido por la persona: si hay algo escrito sin enviar, primero pregunta
function puedeCerrarVentana(ventana) {
    return window.SkillMatchUI && SkillMatchUI.puedeCerrar ? SkillMatchUI.puedeCerrar(ventana) : Promise.resolve(true);
}

function pedirCerrarVentana(id) {
    puedeCerrarVentana(document.getElementById(id)).then(si => { if (si) cerrarVentana(id); });
}

// Repinta tarjetas y detalle después de postularse o guardar
function repintar() {
    // Con los filtros puestos (antes, si no quedaba ninguna visible, volvía a
    // mostrar todas las cargadas aunque no cumplieran los filtros)
    applyFilters();
    const detalle = document.getElementById('jobDetailModal');
    if (vacanteAbierta && detalle.classList.contains('active')) {
        document.getElementById('jobDetailActions').innerHTML =
            `<button type="button" class="btn-secondary-modal" onclick="cerrarVentana('jobDetailModal')">Cerrar</button>` + botonesVacante(vacanteAbierta);
    }
}

// ---- Postularse ----

function postularme(jobId) {
    const datos = sesion();
    if (!datos) {
        // Se pregunta (entrar o crear perfil) y, al entrar, vuelve aqui con la postulacion abierta
        const vacante = allJobs.find(j => String(j.id) === String(jobId)) || vacanteAbierta;
        pedirCuenta('Inicia sesión para postularte',
            `Para postularte${vacante && vacante.title ? ' a ' + vacante.title : ''}, entra con tu cuenta o crea tu perfil: es gratis y al terminar vuelves a esta vacante.`,
            `oportunidades.html?jobId=${encodeURIComponent(jobId)}&accion=postular`);
        return;
    }
    if (datos.userType === 'empresa') {
        avisar('Las empresas publican vacantes; para postularse se necesita una cuenta de persona.', 'info');
        return;
    }
    if (appliedJobIds.has(String(jobId))) return;

    const job = allJobs.find(j => String(j.id) === String(jobId)) || vacanteAbierta;
    if (!job) return;
    vacanteAbierta = job;

    document.getElementById('applyJobName').textContent = job.title || 'esta vacante';
    document.getElementById('applyCompanyName').textContent = job.companyName || 'la empresa';
    const carta = document.getElementById('coverLetter');
    carta.value = '';
    document.getElementById('coverLetterCount').textContent = '0';
    document.getElementById('applyError').hidden = true;
    const boton = document.getElementById('sendApplicationBtn');
    boton.disabled = false;
    boton.textContent = 'Enviar postulación';
    cerrarVentana('jobDetailModal');
    const ventana = document.getElementById('applyModal');
    ventana.dataset.cambios = ''; // carta nueva: todavia no hay nada escrito
    ventana.classList.add('active');
    marcarVentanaEnHistorial(job.id);
    setTimeout(() => carta.focus(), 60);
}

async function enviarPostulacion() {
    const job = vacanteAbierta;
    if (!job) return;
    const carta = document.getElementById('coverLetter').value.trim();
    const boton = document.getElementById('sendApplicationBtn');
    const error = document.getElementById('applyError');
    // «Pastilla»: el boton dice que esta pasando (un circulo que gira mientras se envia y "✓ Enviada" al
    // llegar) sin cambiar de tamano: se fija el ancho que tenia
    boton.style.width = boton.offsetWidth + 'px';
    boton.disabled = true;
    boton.classList.add('enviando');
    boton.innerHTML = '<span class="boton-giro" aria-hidden="true"></span>Enviando…';
    error.hidden = true;

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/applications`, {
            method: 'POST',
            body: JSON.stringify({ jobId: job.id, coverLetter: carta || null })
        });
        if (!response.ok) {
            const cuerpo = await response.json().catch(() => ({}));
            const mensaje = cuerpo.message || '';
            // Si ya se había postulado, el servidor lo rechaza: se marca y listo
            if (/ya (te )?(has )?(postul|aplic)|already/i.test(mensaje)) {
                appliedJobIds.add(String(job.id));
                cerrarVentana('applyModal');
                repintar();
                avisar('Ya te habías postulado a esta vacante.', 'info');
                return;
            }
            throw new Error(mensaje || 'El servidor no aceptó la postulación.');
        }
        appliedJobIds.add(String(job.id));
        // Medio segundo con "✓ Enviada" en el mismo boton, y despues se cierra la ventana
        boton.classList.remove('enviando');
        boton.classList.add('listo');
        boton.innerHTML = '<i data-ico="check"></i> Enviada';
        await new Promise(r => setTimeout(r, 550));
        cerrarVentana('applyModal');
        boton.classList.remove('listo');
        boton.disabled = false;
        boton.style.width = '';
        boton.textContent = 'Enviar postulación';
        repintar();
        // El momento del match: la chispa sale del "Ya te postulaste" de su tarjeta (ui.js)
        const sello = document.querySelector(`.opportunity-card[data-job-id="${CSS.escape(String(job.id))}"] .btn-apply.applied`);
        if (sello && window.SkillMatchUI && SkillMatchUI.chispa) {
            sello.classList.add('recien-postulado');
            setTimeout(() => SkillMatchUI.chispa(sello), 120);
        }
        avisar(`Postulación enviada a <strong>${escaparHtml(job.companyName || 'la empresa')}</strong>. Puedes seguirla en tu perfil.`, 'ok');
    } catch (e) {
        error.textContent = 'No se pudo enviar la postulación: ' + e.message;
        error.hidden = false;
        boton.disabled = false;
        boton.classList.remove('enviando', 'listo');
        boton.style.width = '';
        boton.textContent = 'Enviar postulación';
    }
}

// ---- Filtros en una hoja que sube desde abajo (celular y tableta) ----
// Antes, en el celular la columna de filtros iba antes que la lista: habia que bajar
// ~700 px para ver la primera vacante. Ahora un boton "Filtros (2)" la abre como hoja;
// cada cambio filtra al instante, como siempre, y "Ver N vacantes" la cierra.
// En escritorio no cambia nada: la columna sigue al lado y sigue al bajar (sticky).
function prepararHojaDeFiltros() {
    const hoja = document.getElementById('panelFiltros');
    const abrir = document.getElementById('filtrosAbrir');
    if (!hoja || !abrir) return;
    const angosta = window.matchMedia('(max-width: 1080px)');
    const fondo = document.createElement('div');
    fondo.className = 'filtros-fondo';
    document.body.appendChild(fondo); // fuera de la cuadricula de la lista
    let volverA = null;

    const abierta = () => hoja.classList.contains('abierta');
    function abrirHoja() {
        volverA = document.activeElement;
        hoja.classList.add('abierta');
        fondo.classList.add('abierta');
        document.documentElement.classList.add('hoja-filtros-abierta');
        abrir.setAttribute('aria-expanded', 'true');
        const primero = hoja.querySelector('.filtros-cerrar');
        if (primero) primero.focus({ preventScroll: true });
    }
    function cerrarHoja() {
        if (!abierta()) return;
        hoja.classList.remove('abierta');
        fondo.classList.remove('abierta');
        document.documentElement.classList.remove('hoja-filtros-abierta');
        abrir.setAttribute('aria-expanded', 'false');
        if (volverA && volverA.focus) volverA.focus({ preventScroll: true });
    }
    // En la hoja es una ventana (role="dialog"); en la columna de escritorio, un "aside" normal
    function segunAncho() {
        if (angosta.matches) {
            hoja.setAttribute('role', 'dialog');
            hoja.setAttribute('aria-modal', 'true');
        } else {
            hoja.removeAttribute('role');
            hoja.removeAttribute('aria-modal');
            cerrarHoja();
        }
    }
    segunAncho();
    if (angosta.addEventListener) angosta.addEventListener('change', segunAncho);

    abrir.addEventListener('click', abrirHoja);
    fondo.addEventListener('click', cerrarHoja);
    hoja.querySelector('.filtros-cerrar').addEventListener('click', cerrarHoja);
    hoja.querySelector('.filtros-ver').addEventListener('click', cerrarHoja);
    document.addEventListener('keydown', e => {
        if (!abierta()) return;
        if (e.key === 'Escape') { e.preventDefault(); cerrarHoja(); return; }
        // El foco no sale de la hoja mientras esta abierta
        if (e.key === 'Tab') {
            const enfocables = [...hoja.querySelectorAll('button, input, select, summary, a[href]')]
                .filter(el => el.offsetParent !== null && !el.disabled);
            if (!enfocables.length) return;
            const [primero, ultimo] = [enfocables[0], enfocables[enfocables.length - 1]];
            if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
            else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
        }
    });

    // El boton dice cuantos filtros hay puestos, y el de la hoja cuantas vacantes quedan
    const texto = abrir.querySelector('span');
    function contarFiltros() {
        const n = hoja.querySelectorAll('input[type="checkbox"]:checked, input[type="radio"]:checked:not([value=""])').length;
        texto.textContent = n ? `Filtros (${n})` : 'Filtros';
        abrir.classList.toggle('con-filtros', n > 0);
    }
    hoja.addEventListener('change', contarFiltros);
    hoja.querySelector('.btn-clear-filters').addEventListener('click', () => setTimeout(contarFiltros, 0));
    contarFiltros();
    const cuenta = document.getElementById('resultsCount');
    const ver = hoja.querySelector('.filtros-ver');
    if (cuenta && ver) {
        const ponerTexto = () => {
            const m = cuenta.textContent.match(/^\s*([\d.]+)/);
            ver.textContent = m ? `Ver ${m[1]} ${m[1] === '1' ? 'vacante' : 'vacantes'}` : 'Ver vacantes';
        };
        new MutationObserver(ponerTexto).observe(cuenta, { childList: true, characterData: true, subtree: true });
        ponerTexto();
    }
}

// Configurar event listeners
function setupEventListeners() {

    // Búsqueda (en el servidor; los filtros se aplican sobre sus resultados)
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.querySelector('.btn-search-main');

    if (searchInput && searchBtn) {
        const debouncedSearch = debounce(performSearch, 350);
        searchBtn.addEventListener('click', performSearch);
        searchInput.addEventListener('input', debouncedSearch);
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                performSearch();
            }
        });
    }

    document.querySelectorAll('#vistaVacantes [data-vista]').forEach(b =>
        b.addEventListener('click', () => cambiarVista(b.dataset.vista)));

    const clearFilterBtn = document.querySelector('.btn-clear-filters');
    if (clearFilterBtn) {
        clearFilterBtn.addEventListener('click', clearFilters);
    }

    // Filtros: se aplican al instante
    document.querySelectorAll('.filter-card input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', () => {
            updateFilterBadges();
            applyFilters();
        });
    });

    // Rango de salario: la cifra cambia mientras se arrastra y la lista se
    // filtra cuando se deja quieto un momento
    const salaryRange = document.getElementById('salaryRange');
    if (salaryRange) {
        const filtrarSalario = debounce(applyFilters, 200);
        salaryRange.addEventListener('input', function() {
            const value = parseInt(this.value);
            document.getElementById('maxSalary').textContent = formatCurrency(value);
            filtrarSalario();
        });
    }

    // Ordenar
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
        sortSelect.addEventListener('change', sortJobs);
    }

    // Ventanas: la × y el contador de la carta
    // La X y "Cancelar" preguntan si la carta tiene algo escrito (ui.js)
    document.querySelectorAll('[data-cerrar-ventana]').forEach(b =>
        b.addEventListener('click', () => pedirCerrarVentana(b.dataset.cerrarVentana)));
    const carta = document.getElementById('coverLetter');
    if (carta) {
        carta.addEventListener('input', () => {
            document.getElementById('coverLetterCount').textContent = carta.value.length.toLocaleString('es-CO');
        });
    }
    const enviar = document.getElementById('sendApplicationBtn');
    if (enviar) enviar.addEventListener('click', enviarPostulacion);
}

// Realizar búsqueda
function performSearch() {
    const query = document.getElementById('searchInput').value.trim();
    const modo = query ? 'busqueda' : 'todas';
    if (modo === paginacion.modo && query === paginacion.query) return;
    // Buscar es sobre todas las vacantes: se sale de "Guardadas"
    if (paginacion.modo === 'guardadas' || paginacion.modo === 'mias') marcarVista('todas');
    paginacion = { modo, query, pagina: 0, ultima: true, total: 0, cargando: false };
    loadJobs();
}

// "Todas las vacantes", "Guardadas" (persona) o "Mis vacantes" (empresa)
function cambiarVista(vista) {
    const query = document.getElementById('searchInput')?.value.trim() || '';
    const modo = vista === 'guardadas' || vista === 'mias' ? vista : (query ? 'busqueda' : 'todas');
    marcarVista(vista);
    if (modo === paginacion.modo) return;
    paginacion = { modo, query: modo === 'busqueda' ? query : '', pagina: 0, ultima: true, total: 0, cargando: false };
    // La dirección recuerda la vista: al recargar o volver se queda en Guardadas
    const direccion = new URL(window.location.href);
    if (vista === 'guardadas') direccion.searchParams.set('guardadas', '1'); else direccion.searchParams.delete('guardadas');
    if (vista === 'mias') direccion.searchParams.set('mias', '1'); else direccion.searchParams.delete('mias');
    history.replaceState(null, '', direccion);
    loadJobs();
}

function marcarVista(vista) {
    document.querySelectorAll('#vistaVacantes [data-vista]').forEach(b => {
        const activa = b.dataset.vista === vista;
        b.classList.toggle('active', activa);
        b.setAttribute('aria-pressed', String(activa));
    });
}

// ---- Vacantes vistas por una empresa ----
// Le sirve para ver como quedan sus ofertas frente a las demas. Arriba, un
// aviso de que asi las ven las personas; la pestana "Mis vacantes" muestra solo
// las suyas, y en las suyas sale "Tu vacante" con "Ver candidatos". Se ordena
// por "Más reciente": la compatibilidad no aplica a una empresa.
function esMiVacante(job) {
    const datos = sesion();
    return !!datos && !!datos.companyId && String(job.companyId) === String(datos.companyId);
}

async function prepararVistaEmpresa() {
    const aviso = document.getElementById('avisoEmpresa');
    if (aviso) aviso.hidden = false;
    const vista = document.getElementById('vistaVacantes');
    const guardadas = vista && vista.querySelector('[data-vista="guardadas"]');
    const mias = vista && vista.querySelector('[data-vista="mias"]');
    if (guardadas) guardadas.remove();
    if (mias) mias.hidden = false;
    if (vista) vista.hidden = false;
    sinCompatibilidad();
    const datos = sesion();
    if (!datos.companyId) return;
    try {
        const r = await fetchWithAuth(`${API_BASE_URL}/jobs/company/${encodeURIComponent(datos.companyId)}`);
        if (!r.ok) return;
        const propias = await r.json();
        const cuenta = document.getElementById('misVacantesCount');
        if (cuenta && propias.length) cuenta.textContent = `(${propias.length.toLocaleString('es-CO')})`;
    } catch (e) { /* sin el numero, la pestana igual funciona */ }
}

function actualizarContadorGuardadas() {
    const cuenta = document.getElementById('savedCount');
    if (cuenta) cuenta.textContent = savedJobIds.size ? `(${savedJobIds.size.toLocaleString('es-CO')})` : '';
}

function normalizeStr(str) {
    return str ? String(str).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase() : '';
}

// Aplicar filtros (sobre lo cargado: la lista general o la búsqueda)
function applyFilters() {
    const f = filtrosElegidos();
    const filtered = allJobs.filter(job => cumpleFiltros(job, f));
    currentFilters = { types: f.type, modalities: f.modality, experienceLevels: f.experience, maxSalary: f.maxSalary };
    displayJobs(filtered);
    contarOpciones(f);
    guardarFiltrosEnDireccion();
}

// ---- La regla de los filtros (la usan el filtro y los conteos de cada opcion) ----
const GRUPOS_FILTRO = ['type', 'modality', 'experience'];

function filtrosElegidos() {
    const f = { maxSalary: parseInt(document.getElementById('salaryRange')?.value || '10000000') };
    GRUPOS_FILTRO.forEach(g => { f[g] = getCheckedValues(`input[name="${g}"]:checked`); });
    return f;
}

function cumpleGrupo(job, grupo, valores) {
    if (!valores.length) return true;
    if (grupo === 'experience') return valores.includes(job.experienceLevel);
    const campo = grupo === 'type' ? job.type : job.modality;
    return valores.some(v => normalizeStr(v) === normalizeStr(campo));
}

// "excepto": un grupo que no se tiene en cuenta (para contar sus opciones)
function cumpleFiltros(job, f, excepto) {
    return GRUPOS_FILTRO.every(g => g === excepto || cumpleGrupo(job, g, f[g]))
        && (!job.salaryMin || job.salaryMin <= f.maxSalary);
}

// Junto a cada opcion: cuantas de las vacantes cargadas quedarian al marcarla,
// con los otros filtros que ya estan puestos. Las que darian 0 se ven atenuadas.
function contarOpciones(f) {
    document.querySelectorAll('.filter-card input[type="checkbox"][name]').forEach(casilla => {
        const grupo = casilla.name;
        if (!GRUPOS_FILTRO.includes(grupo)) return;
        const n = allJobs.filter(job => cumpleFiltros(job, f, grupo) && cumpleGrupo(job, grupo, [casilla.value])).length;
        const etiqueta = casilla.closest('label');
        let cuenta = etiqueta.querySelector('.opcion-cuenta');
        if (!cuenta) {
            cuenta = document.createElement('span');
            cuenta.className = 'opcion-cuenta';
            etiqueta.appendChild(cuenta);
        }
        cuenta.textContent = n.toLocaleString('es-CO');
        etiqueta.classList.toggle('sin-resultados', n === 0 && !casilla.checked);
    });
}

// ---- La busqueda y los filtros en la direccion ----
// La vista, la busqueda, los filtros y el orden quedan en la direccion, sin
// sumar pasos al historial: al recargar, al volver desde una empresa o al
// compartir el enlace, la lista sale igual (antes se perdian).
const FILTROS_EN_DIRECCION = [['type', 'tipo'], ['modality', 'modalidad'], ['experience', 'experiencia']];

function guardarFiltrosEnDireccion() {
    const url = new URL(window.location.href);
    const poner = (clave, valor) => { if (valor) url.searchParams.set(clave, valor); else url.searchParams.delete(clave); };
    poner('q', paginacion.modo === 'busqueda' ? paginacion.query : '');
    poner('guardadas', paginacion.modo === 'guardadas' ? '1' : '');
    poner('mias', paginacion.modo === 'mias' ? '1' : '');
    FILTROS_EN_DIRECCION.forEach(([nombre, clave]) => poner(clave, getCheckedValues(`input[name="${nombre}"]:checked`).join(',')));
    const salario = document.getElementById('salaryRange');
    poner('salario', salario && Number(salario.value) < Number(salario.max) ? salario.value : '');
    const orden = document.getElementById('sortSelect');
    poner('orden', orden && orden.options.length && orden.value !== orden.options[0].value ? orden.value : '');
    if (url.href !== window.location.href) history.replaceState(history.state, '', url);
}

// Al cargar, antes de pedir las vacantes: la primera lista ya sale filtrada
function leerFiltrosDeDireccion() {
    const p = new URLSearchParams(window.location.search);
    FILTROS_EN_DIRECCION.forEach(([nombre, clave]) => {
        const valores = (p.get(clave) || '').split(',').filter(Boolean);
        document.querySelectorAll(`input[name="${nombre}"]`).forEach(c => { c.checked = valores.includes(c.value); });
    });
    const salario = document.getElementById('salaryRange');
    const tope = Number(p.get('salario'));
    if (salario && tope > 0) {
        salario.value = String(tope);
        document.getElementById('maxSalary').textContent = formatCurrency(Number(salario.value));
    }
    const orden = document.getElementById('sortSelect');
    const pedido = p.get('orden');
    if (orden && pedido && [...orden.options].some(o => o.value === pedido)) orden.value = pedido;
    updateFilterBadges();
}

// Limpiar filtros
function clearFilters() {
    document.querySelectorAll('.filter-card input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
    });

    const salaryRange = document.getElementById('salaryRange');
    if (salaryRange) {
        salaryRange.value = salaryRange.max;
        document.getElementById('maxSalary').textContent = formatCurrency(salaryRange.max);
    }

    currentFilters = {};
    updateFilterBadges();
    if (allJobs.length) applyFilters(); else loadJobs();
}

// Ordenar trabajos: reordena lo que se esta viendo
function sortJobs() {
    // Las mismas vacantes en otro orden: se deslizan a su lugar («Vacante»)
    actualizarEnSitio();
    guardarFiltrosEnDireccion();
}

function updateFilterBadges() {
    const groups = ['type', 'experience', 'modality'];
    groups.forEach(group => {
        const count = document.querySelectorAll(`input[name="${group}"]:checked`).length;
        const badge = document.querySelector(`.filter-count[data-group="${group}"]`);
        if (!badge) return;
        if (count > 0) {
            badge.textContent = count;
            badge.classList.add('active');
        } else {
            badge.textContent = '';
            badge.classList.remove('active');
        }
    });
}

// Utilidades
function getCheckedValues(selector) {
    return Array.from(document.querySelectorAll(selector)).map(cb => cb.value);
}

function updateResultsCount(count) {
    const resultsCount = document.getElementById('resultsCount');
    if (!resultsCount) return;
    const n = v => v.toLocaleString('es-CO');
    const plural = (v, una, varias) => n(v) + ' ' + (v === 1 ? una : varias);
    const guardadas = paginacion.modo === 'guardadas';
    if (hayFiltros()) {
        resultsCount.textContent = `${plural(count, 'vacante cumple', 'vacantes cumplen')} los filtros (de ${n(allJobs.length)} ${guardadas ? 'guardadas' : 'cargadas'})`;
    } else if (paginacion.modo === 'mias') {
        resultsCount.textContent = plural(allJobs.length, 'vacante publicada por tu empresa', 'vacantes publicadas por tu empresa');
    } else if (guardadas) {
        resultsCount.textContent = plural(allJobs.length, 'vacante guardada', 'vacantes guardadas');
    } else if (paginacion.modo === 'busqueda') {
        resultsCount.textContent = `${plural(paginacion.total, 'resultado', 'resultados')} para «${paginacion.query}»`;
    } else {
        resultsCount.textContent = `${plural(paginacion.total, 'vacante publicada', 'vacantes publicadas')}`;
    }
}

function translateJobType(type) {
    const types = {
        'empleo': 'Empleo',
        'practica': 'Práctica',
        'freelance': 'Independiente'
    };
    // Algunas vacantes llegan como "práctica" (con tilde) y salian en minuscula
    return types[normalizeStr(type).trim()] || escaparHtml(type || 'Empleo');
}

function translateModality(modality) {
    const modalidades = { 'presencial': 'Presencial', 'remoto': 'Remoto', 'hibrido': 'Híbrido' };
    return modalidades[normalizeStr(modality).trim()] || 'Modalidad a convenir';
}

function translateExperienceLevel(level) {
    const levels = {
        'sin-experiencia': 'Sin experiencia',
        'junior': 'Hasta 1 año de experiencia',
        'semi-senior': '1 a 3 años de experiencia',
        'senior': 'Más de 3 años de experiencia'
    };
    return levels[level] || 'Experiencia a convenir';
}

// Cargar trabajos guardados del usuario
async function loadSavedJobs() {
    const datos = sesion();
    // Las empresas no guardan vacantes (el backend responde 403)
    if (!datos || datos.userType === 'empresa') return;

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/saved-jobs/job-ids`);
        if (response.ok) {
            savedJobIds = new Set(await response.json());
            const vista = document.getElementById('vistaVacantes');
            if (vista) vista.hidden = false;
            actualizarContadorGuardadas();
        }
    } catch (error) {
    }
}

// Guardar o quitar trabajo de guardados
async function toggleSaveJob(jobId, buttonElement) {
    if (!sesion()) {
        pedirCuenta('Inicia sesión para guardar vacantes',
            'Guarda las vacantes que te interesan para postularte después. Entra o crea tu perfil y vuelves a esta vacante.',
            `oportunidades.html?jobId=${encodeURIComponent(jobId)}`);
        return;
    }

    const isSaved = savedJobIds.has(jobId);
    buttonElement.disabled = true;

    try {
        const response = isSaved
            ? await fetchWithAuth(`${API_BASE_URL}/saved-jobs/job/${encodeURIComponent(jobId)}`, { method: 'DELETE' })
            : await fetchWithAuth(`${API_BASE_URL}/saved-jobs`, { method: 'POST', body: JSON.stringify({ jobId: jobId }) });
        if (!response.ok) throw new Error();
        if (isSaved) savedJobIds.delete(jobId); else savedJobIds.add(jobId);
        actualizarContadorGuardadas();
        // En "Guardadas" la que se quita sale de la lista
        if (isSaved && paginacion.modo === 'guardadas') allJobs = allJobs.filter(j => j.id !== jobId);
        if (!isSaved && document.getElementById('vistaVacantes')) {
            avisar('Vacante guardada. La encuentras en "Guardadas", arriba de la lista.', 'ok');
        }
        repintar();
        // «Pastilla»: el "Guardada" recien puesto da un salto corto y suelta chispitas (solo al guardar)
        if (!isSaved) {
            document.querySelectorAll(`.btn-save[data-job-id="${CSS.escape(String(jobId))}"]`).forEach(b => {
                b.classList.add('recien-guardada');
                b.addEventListener('animationend', () => b.classList.remove('recien-guardada'), { once: true });
                if (window.SkillMatchUI && SkillMatchUI.chispitas && b.getBoundingClientRect().width) SkillMatchUI.chispitas(b);
            });
        }
    } catch (error) {
        avisar('No se pudo actualizar la vacante guardada. Intenta de nuevo.', 'error');
        buttonElement.disabled = false;
    }
}
