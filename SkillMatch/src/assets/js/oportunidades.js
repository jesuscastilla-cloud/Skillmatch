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

// Cargar oportunidades al iniciar
document.addEventListener('DOMContentLoaded', function() {
    // Las habilidades y las postulaciones se piden a la vez que las vacantes;
    // la lista se pinta una sola vez, ya con el % y "Ya te postulaste"
    userSkillsReady = Promise.all([loadUserSkills(), loadAppliedJobs(), loadSavedJobs()]);
    const parametros = new URLSearchParams(window.location.search);
    // Desde "Vacantes guardadas" del perfil se llega con ?guardadas=1
    if (parametros.get('guardadas') === '1' && sesion() && !esEmpresa()) {
        paginacion.modo = 'guardadas';
        marcarVista('guardadas');
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
    updateFilterBadges();

    // Una notificación de vacante nueva trae ?jobId=: se abre su detalle
    const pedida = new URLSearchParams(window.location.search).get('jobId');
    if (pedida) abrirDetallePorId(pedida);
});

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
        ? `${API_BASE_URL}/jobs/search?keyword=${encodeURIComponent(paginacion.query)}&page=${numero}&size=${TAM_PAGINA}`
        : `${API_BASE_URL}/jobs?page=${numero}&size=${TAM_PAGINA}`;

    try {
        let data;
        if (paginacion.modo === 'guardadas') {
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
            userSkills = new Set((await response.json()).map(s => normalizeStr(s.name).trim()));
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
function getSkillMatch(job) {
    const pedidas = uniqueJobSkills(job);
    // Sin habilidades tuyas todo daria 0 %: no se muestra (sale el aviso)
    if (!userSkills || userSkills.size === 0 || pedidas.size === 0) return null;
    const tiene = [...pedidas.keys()].filter(s => userSkills.has(s)).length;
    return { pct: Math.round(tiene / pedidas.size * 100), tiene, pedidas: pedidas.size };
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
        return '<p class="recommend-hint"><i data-ico="bulb"></i> <span><a href="login-usuario.html">Inicia sesión</a> para ver qué tanto encajas con cada vacante.</span></p>';
    }
    if (datos.userType !== 'empresa' && userSkills && userSkills.size === 0) {
        return '<p class="recommend-hint"><i data-ico="bulb"></i> <span><a href="perfil-usuario.html">Agrega tus habilidades</a> y te mostramos qué tanto encajas con cada vacante.</span></p>';
    }
    return '';
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
        container.innerHTML = `
            <div class="no-results-message">
                <h3>${porFiltros ? 'Ninguna vacante cumple los filtros' : (paginacion.modo === 'busqueda' ? 'No encontramos vacantes con esa búsqueda' : 'Aún no hay vacantes publicadas')}</h3>
                <p>${porFiltros ? (paginacion.ultima ? 'Prueba quitando algún filtro.' : 'Prueba quitando algún filtro o carga más vacantes.') : 'Prueba con otra palabra, por ejemplo el nombre del cargo o de la empresa.'}</p>
            </div>` + bloqueCargarMas();
        updateResultsCount(0);
        return;
    }

    // Siempre en el orden elegido (antes los filtros y la busqueda lo ignoraban)
    shownJobs = sortList(jobs);
    container.innerHTML = matchHint() + shownJobs.map(job => createJobCard(job)).join('') + bloqueCargarMas();
    updateResultsCount(jobs.length);
}

function textoSalario(job) {
    return job.salaryMin && job.salaryMax
        ? `${formatCurrency(job.salaryMin)} - ${formatCurrency(job.salaryMax)}`
        : job.salaryMin ? `Desde ${formatCurrency(job.salaryMin)}`
        : job.salaryMax ? `Hasta ${formatCurrency(job.salaryMax)}`
        : 'Salario a convenir';
}

// Habilidades como etiquetas: las que ya tienes primero, en turquesa y con
// palomita (asi se ve de donde sale el %)
function etiquetasHabilidades(job, maximo) {
    const pedidas = uniqueJobSkills(job);
    const tuyas = [...pedidas.keys()].filter(k => userSkills && userSkills.has(k));
    const orden = [...tuyas, ...[...pedidas.keys()].filter(k => !tuyas.includes(k))];
    if (!orden.length) return '<span class="skill">Sin especificar</span>';
    const visibles = maximo ? orden.slice(0, maximo) : orden;
    return visibles.map(k => tuyas.includes(k)
        ? `<span class="skill is-common"><i data-ico="check"></i>${escaparHtml(pedidas.get(k))}</span>`
        : `<span class="skill">${escaparHtml(pedidas.get(k))}</span>`).join('') +
        (maximo && orden.length > maximo ? `<span class="skill skill-mas">+${orden.length - maximo}</span>` : '');
}

function anilloCompatibilidad(job) {
    // Sin habilidades tuyas o de la vacante no hay con que comparar: sin anillo
    const match = getSkillMatch(job);
    return match
        ? `<div class="match-ring" data-pct="${match.pct}" role="img"
                title="Tienes ${match.tiene} de ${match.pedidas} habilidades que pide"
                aria-label="${match.pct} por ciento: tienes ${match.tiene} de ${match.pedidas} habilidades que pide"></div>`
        : '';
}

// Botones de guardar y postularse (las empresas no se postulan ni guardan)
function botonesVacante(job) {
    if (esEmpresa()) return '';
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

// Crear tarjeta de trabajo
function createJobCard(job) {
    const id = escaparHtml(job.id);
    return `
        <div class="opportunity-card" data-job-id="${id}">
            <div class="card-header-opp">
                <div class="company-logo-opp">${job.companyName ? escaparHtml(job.companyName.charAt(0)) : '<i data-ico="building"></i>'}</div>
                <div class="card-info">
                    <h3 class="job-title"><button type="button" class="job-title-link" data-job-id="${id}" onclick="abrirDetallePorId(this.dataset.jobId)">${escaparHtml(job.title)}</button></h3>
                    <p class="company-name">${escaparHtml(job.companyName || 'Empresa confidencial')}</p>
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

            <p class="card-description">${escaparHtml(truncateText(job.description, 150))}</p>

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

async function abrirDetallePorId(jobId) {
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
    abrirDetalle(job);
}

function listaDetalle(titulo, items) {
    const limpios = (items || []).map(i => String(i).trim()).filter(Boolean);
    if (!limpios.length) return '';
    return `<h3>${titulo}</h3><ul class="detalle-lista">${limpios.map(i => `<li>${escaparHtml(i)}</li>`).join('')}</ul>`;
}

function abrirDetalle(job) {
    vacanteAbierta = job;
    const modal = document.getElementById('jobDetailModal');
    const match = getSkillMatch(job);
    const publicada = formatDate(job.postedDate);
    const fechaLimite = job.expirationDate
        ? new Date(job.expirationDate).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
        : '';

    document.getElementById('jobDetailTitle').textContent = job.title || 'Vacante';
    document.getElementById('jobDetailCompany').textContent = job.companyName || 'Empresa confidencial';
    document.getElementById('jobDetailBody').innerHTML = `
        ${match ? `<div class="detalle-match">${anilloCompatibilidad(job)}<p>Tienes <strong>${match.tiene} de ${match.pedidas}</strong> habilidades que pide esta vacante.</p></div>` : ''}
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
        <h3>Habilidades que pide</h3>
        <div class="card-skills">${etiquetasHabilidades(job)}</div>
        ${listaDetalle('Requisitos', job.requirements)}
        ${listaDetalle('Responsabilidades', job.responsibilities)}
        ${listaDetalle('Beneficios', job.benefits)}
    `;
    document.getElementById('jobDetailActions').innerHTML =
        `<button type="button" class="btn-secondary-modal" onclick="cerrarVentana('jobDetailModal')">Cerrar</button>` + botonesVacante(job);
    modal.classList.add('active');
    modal.querySelector('.modal-body').scrollTop = 0;
}

function cerrarVentana(id) {
    document.getElementById(id).classList.remove('active');
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
        avisar('Inicia sesión para postularte a esta vacante.', 'info');
        setTimeout(() => { window.location.href = 'login-usuario.html'; }, 1200);
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
    document.getElementById('applyModal').classList.add('active');
    setTimeout(() => carta.focus(), 60);
}

async function enviarPostulacion() {
    const job = vacanteAbierta;
    if (!job) return;
    const carta = document.getElementById('coverLetter').value.trim();
    const boton = document.getElementById('sendApplicationBtn');
    const error = document.getElementById('applyError');
    boton.disabled = true;
    boton.textContent = 'Enviando…';
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
        cerrarVentana('applyModal');
        repintar();
        avisar(`Postulación enviada a <strong>${escaparHtml(job.companyName || 'la empresa')}</strong>. Puedes seguirla en tu perfil.`, 'ok');
    } catch (e) {
        error.textContent = 'No se pudo enviar la postulación: ' + e.message;
        error.hidden = false;
        boton.disabled = false;
        boton.textContent = 'Enviar postulación';
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
    document.querySelectorAll('[data-cerrar-ventana]').forEach(b =>
        b.addEventListener('click', () => cerrarVentana(b.dataset.cerrarVentana)));
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
    if (paginacion.modo === 'guardadas') marcarVista('todas');
    paginacion = { modo, query, pagina: 0, ultima: true, total: 0, cargando: false };
    loadJobs();
}

// "Todas las vacantes" o "Guardadas"
function cambiarVista(vista) {
    const query = document.getElementById('searchInput')?.value.trim() || '';
    const modo = vista === 'guardadas' ? 'guardadas' : (query ? 'busqueda' : 'todas');
    marcarVista(vista);
    if (modo === paginacion.modo) return;
    paginacion = { modo, query: modo === 'busqueda' ? query : '', pagina: 0, ultima: true, total: 0, cargando: false };
    // La dirección recuerda la vista: al recargar o volver se queda en Guardadas
    const direccion = new URL(window.location.href);
    if (vista === 'guardadas') direccion.searchParams.set('guardadas', '1'); else direccion.searchParams.delete('guardadas');
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

function actualizarContadorGuardadas() {
    const cuenta = document.getElementById('savedCount');
    if (cuenta) cuenta.textContent = savedJobIds.size ? `(${savedJobIds.size.toLocaleString('es-CO')})` : '';
}

function normalizeStr(str) {
    return str ? String(str).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase() : '';
}

// Aplicar filtros (sobre lo cargado: la lista general o la búsqueda)
function applyFilters() {
    const types = getCheckedValues('input[name="type"]:checked');
    const modalities = getCheckedValues('input[name="modality"]:checked');
    const experienceLevels = getCheckedValues('input[name="experience"]:checked');
    const maxSalary = parseInt(document.getElementById('salaryRange')?.value || '10000000');

    let filtered = allJobs;

    if (types.length > 0) {
        filtered = filtered.filter(job => types.some(t => normalizeStr(t) === normalizeStr(job.type)));
    }
    if (modalities.length > 0) {
        filtered = filtered.filter(job => modalities.some(m => normalizeStr(m) === normalizeStr(job.modality)));
    }
    if (experienceLevels.length > 0) {
        filtered = filtered.filter(job => experienceLevels.includes(job.experienceLevel));
    }
    filtered = filtered.filter(job => !job.salaryMin || job.salaryMin <= maxSalary);

    currentFilters = { types, modalities, experienceLevels, maxSalary };
    displayJobs(filtered);
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
    displayJobs(shownJobs);
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
        avisar('Inicia sesión para guardar vacantes.', 'info');
        setTimeout(() => { window.location.href = 'login-usuario.html'; }, 1200);
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
    } catch (error) {
        avisar('No se pudo actualizar la vacante guardada. Intenta de nuevo.', 'error');
        buttonElement.disabled = false;
    }
}
