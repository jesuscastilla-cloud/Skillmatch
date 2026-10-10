// search-handler.js
// Busqueda de la portada: carga las vacantes reales, filtra y pinta resultados

let allOportunidades = [];
const API_URL = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.JOBS}`;
let savedOpportunityIds = new Set();
// Los conteos de las listas solo se muestran con vacantes reales de la API
let datosReales = false;
let totalVacantes = 0;      // las que hay publicadas (totalElements)
let errorDeCarga = false;
let cargaVacantes = null;   // la promesa de la carga, para pedirla una sola vez

async function loadSavedOpportunities() {
    if (!localStorage.getItem('userData')) return;
    // Las empresas no guardan vacantes (el backend responde 403)
    try { if (JSON.parse(localStorage.getItem('userData')).userType === 'empresa') return; } catch (e) { return; }

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/saved-jobs/job-ids`);
        if (response.ok) {
            const ids = await response.json();
            savedOpportunityIds = new Set(ids);
        }
    } catch (e) {
    }
}

// La API entrega paginas de maximo 50 vacantes ({ content: [...] }). Antes se
// trataba la respuesta como una lista, fallaba sin avisar y la portada
// mostraba 10 vacantes inventadas (oportunidades-mock.json, ya borrado).
// Se traen las 200 mas recientes y solo cuando el visitante va a buscar
// (al tocar el buscador o una lista), no en cada visita a la portada.
const PAGINAS_PORTADA = 4;

function loadOportunidades() {
    if (!cargaVacantes) cargaVacantes = cargarVacantes();
    return cargaVacantes;
}

async function cargarVacantes() {
    await loadSavedOpportunities();
    const pagina = n => fetch(`${API_URL}?size=50&page=${n}`, { headers: { 'Accept': 'application/json' } })
        .then(r => { if (!r.ok) throw new Error(`API respondió ${r.status}`); return r.json(); });
    try {
        const primera = await pagina(0);
        const lista = Array.isArray(primera) ? primera : (primera.content || []);
        totalVacantes = typeof primera.totalElements === 'number' ? primera.totalElements : lista.length;
        const paginas = Math.min(primera.totalPages || 1, PAGINAS_PORTADA);
        const resto = await Promise.all(Array.from({ length: paginas - 1 }, (_, i) => pagina(i + 1)));
        resto.forEach(p => lista.push(...(p.content || [])));
        allOportunidades = lista.map(normalizeOportunidadFromApi).filter(Boolean);
        datosReales = true;
        errorDeCarga = false;
        const lugar = document.getElementById('location-select');
        if (lugar) lugar.setAttribute('data-destacar', hayMasVacantes() ? 'Con vacantes recientes' : 'Con vacantes ahora');
        agregarCiudadesReales();
        contarEnListas();
    } catch (apiError) {
        // Sin datos de ejemplo: la busqueda avisa que no pudo cargar
        allOportunidades = [];
        errorDeCarga = true;
        cargaVacantes = null; // el siguiente intento vuelve a pedirlas
    }
}

// Hay mas publicadas de las que se trajeron (mas de 200)
function hayMasVacantes() {
    return totalVacantes > allOportunidades.length;
}

function normalizeOportunidadFromApi(apiOpp) {
    if (!apiOpp) {
        return null;
    }

    const { key: locationKey, label: locationLabel } = resolveLocation(apiOpp.location);
    const modality = resolveModality(apiOpp.modality);
    const experience = resolveExperience(apiOpp.experienceLevel);
    const salaryValue = resolveSalaryValue(apiOpp.salaryMax, apiOpp.salaryMin);
    const salaryText = formatSalaryRange(apiOpp.salaryMin, apiOpp.salaryMax);
    const durationText = apiOpp.duration || 'Duración no especificada';
    const descriptionText = apiOpp.description || 'Esta oferta aún no tiene descripción detallada.';
    const skills = Array.isArray(apiOpp.skills) ? apiOpp.skills : [];
    const matchScore = resolveMatchScore(apiOpp);

    return {
        id: apiOpp.id,
        titulo: apiOpp.title || 'Oferta sin título',
        empresa: apiOpp.companyName || 'Empresa confidencial',
        ubicacion: locationKey,
        locationLabel,
        tipo: (apiOpp.type || 'empleo').toLowerCase(),
        modalidad: modality,
        experiencia: experience,
        salario: salaryValue,
        salarioMin: typeof apiOpp.salaryMin === 'number' ? apiOpp.salaryMin : null,
        salarioMax: typeof apiOpp.salaryMax === 'number' ? apiOpp.salaryMax : null,
        salarioTexto: salaryText,
        duracion: durationText,
        descripcion: descriptionText,
        habilidades: skills,
        logo: '<i data-ico="building"></i>',
        match: matchScore
    };
}

// Clave de una ciudad para comparar sin importar como se escriba:
// "Cartagena de Indias", "Cartagena, Bolívar" y "cartagena" dan "cartagena";
// "Bogotá D.C." da "bogota". Es el value de la lista de la portada.
const ALIAS_CIUDAD = { mompos: 'mompox', santa_cruz_de_mompox: 'mompox' };
function claveCiudad(texto) {
    if (!texto) return '';
    const clave = normalizeText(texto.toString().split(/[,(]| - /)[0])
        .replace(/_de_indias$/, '')
        .replace(/_d_?c$/, '');
    return ALIAS_CIUDAD[clave] || clave;
}
// Lo que una empresa puede escribir en "ubicacion" y no es una ciudad
const NO_ES_CIUDAD = /^(no_especificad|sin_|remot|virtual|teletrabajo|n_a$)/;

function resolveLocation(location) {
    if (!location) {
        return { key: '', label: 'Ubicación no especificada' };
    }
    return { key: claveCiudad(location), label: location };
}

function resolveModality(modality) {
    if (!modality) return '';

    const normalized = normalizeText(modality);
    if (normalized.includes('presencial') || normalized.includes('oficina')) return 'presencial';
    if (normalized.includes('remot')) return 'virtual';
    if (normalized.includes('virtual')) return 'virtual';
    if (normalized.includes('hibrid')) return 'hibrida';
    return '';
}

function resolveExperience(experienceLevel) {
    if (!experienceLevel) return '';

    const normalized = normalizeText(experienceLevel);
    if (normalized.includes('semi') || normalized.includes('mid') || normalized.includes('intermedio')) return 'mid';
    if (normalized.includes('senior')) return 'senior';
    return 'junior';
}

function resolveSalaryValue(maxValue, minValue) {
    const max = typeof maxValue === 'number' ? maxValue : null;
    const min = typeof minValue === 'number' ? minValue : null;

    if (max !== null) return max;
    if (min !== null) return min;
    return 0;
}

function formatSalaryRange(minValue, maxValue) {
    const min = typeof minValue === 'number' ? minValue : null;
    const max = typeof maxValue === 'number' ? maxValue : null;

    if (min === null && max === null) {
        return 'Salario sin especificar';
    }

    if (min !== null && max !== null) {
        return `${formatCurrency(min)} - ${formatCurrency(max)}`;
    }

    const value = min !== null ? min : max;
    return `Desde ${formatCurrency(value)}`;
}

// Solo un % que calcule el backend; antes se inventaba uno entre 70 y 90
// a partir del id de la vacante
function resolveMatchScore(apiOpp) {
    if (typeof apiOpp.matchScore === 'number') return Math.round(apiOpp.matchScore);
    if (typeof apiOpp.match === 'number') return Math.round(apiOpp.match);
    return null;
}

function normalizeText(value) {
    return value
        .toString()
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');
}

function capitalize(value) {
    if (!value) return '';
    const text = value.toString();
    return text.charAt(0).toUpperCase() + text.slice(1);
}

// Mapeo de modalidades
const modalityMap = {
    'presencial': 'Presencial',
    'virtual': 'Remoto',
    'hibrida': 'Híbrido'
};

// Mapeo de experiencia
const experienceMap = {
    'junior': 'Hasta 1 año de experiencia',
    'mid': '1 a 3 años de experiencia',
    'senior': 'Más de 3 años de experiencia'
};

// Los valores de la lista vienen en miles de pesos: "1000-2000" es de
// $1.000.000 a $2.000.000 y "5000+" es mas de $5.000.000. (Antes se
// multiplicaba por un millon y el filtro de salario no encontraba nada.)
function parseSalaryRange(range) {
    if (!range) return { min: 0, max: Infinity };
    const [min, max] = range.replace('+', '').split('-').map(v => (parseInt(v, 10) || 0) * 1000);
    return { min: min || 0, max: max || Infinity };
}

// ¿La oportunidad cumple un filtro? Lo usan la busqueda y los conteos
function cumpleFiltro(opp, campo, valor) {
    if (!valor) return true;
    if (campo === 'q') {
        const query = valor.toLowerCase();
        return opp.titulo.toLowerCase().includes(query) ||
            opp.empresa.toLowerCase().includes(query) ||
            opp.descripcion.toLowerCase().includes(query) ||
            opp.habilidades.some(h => h.toLowerCase().includes(query));
    }
    if (campo === 'location') return opp.ubicacion === valor;
    if (campo === 'modality') return opp.modalidad === valor;
    if (campo === 'experience') return opp.experiencia === valor;
    if (campo === 'salary') {
        // Se cruza el rango de la vacante con el elegido: una de 1,5 a 2,5
        // millones sale en "De $1 a $2" y en "De $2 a $3"
        const rango = parseSalaryRange(valor);
        const min = opp.salarioMin ?? opp.salarioMax ?? opp.salario;
        const max = opp.salarioMax ?? opp.salarioMin ?? opp.salario;
        if (!min && !max) return false; // sin salario publicado no se puede afirmar
        return max >= rango.min && min <= rango.max;
    }
    return true;
}

const CAMPOS_FILTRO = ['q', 'location', 'modality', 'experience', 'salary'];

// Filtrar oportunidades según criterios (sinCampo: ignora uno, para los conteos)
function filterOportunidades(criteria, sinCampo) {
    const filtered = allOportunidades.filter(opp =>
        CAMPOS_FILTRO.every(campo => campo === sinCampo || cumpleFiltro(opp, campo, criteria[campo])));

    // Ordenar por match score (descendente)
    // (sin % real todas valen igual y se quedan de la mas reciente a la mas antigua)
    filtered.sort((a, b) => (b.match ?? -1) - (a.match ?? -1));

    return filtered;
}

// ---- Conteos en las listas de la portada ----
// Cada opcion dice cuantas vacantes encontraria con lo demas que ya se eligio,
// asi nadie escoge un filtro que deja la busqueda vacia.
const LISTAS_FILTRO = { location: 'location-select', modality: 'modality-select', experience: 'experience-select', salary: 'salary-select' };

function criteriosEnPantalla() {
    const campo = document.querySelector('.search-input');
    const criterios = { q: campo ? campo.value.trim() : '' };
    Object.entries(LISTAS_FILTRO).forEach(([nombre, id]) => {
        const select = document.getElementById(id);
        criterios[nombre] = select ? select.value : '';
    });
    return criterios;
}

// Ciudades con vacantes que no estaban en la lista (una empresa de Sincelejo
// o de un municipio pequeno): se agregan en orden alfabetico
function agregarCiudadesReales() {
    const select = document.getElementById('location-select');
    if (!select) return;
    const existentes = new Set(Array.from(select.options).map(op => op.value));
    let grupo = select.querySelector('optgroup[label="Otras ciudades"]');
    allOportunidades.forEach(opp => {
        const clave = opp.ubicacion;
        if (!clave || existentes.has(clave) || NO_ES_CIUDAD.test(clave)) return;
        existentes.add(clave);
        if (!grupo) {
            grupo = document.createElement('optgroup');
            grupo.label = 'Otras ciudades';
            select.appendChild(grupo);
        }
        const opcion = new Option(capitalize(opp.locationLabel.split(/[,(]| - /)[0].trim()), clave);
        const despues = Array.from(grupo.children).find(op => op.textContent.localeCompare(opcion.textContent, 'es') > 0);
        grupo.insertBefore(opcion, despues || null);
    });
}

function contarEnListas() {
    if (!datosReales || !document.getElementById('location-select')) return;
    const criterios = criteriosEnPantalla();
    Object.entries(LISTAS_FILTRO).forEach(([campo, id]) => {
        const select = document.getElementById(id);
        if (!select) return;
        const base = filterOportunidades(criterios, campo);
        Array.from(select.options).forEach(op => {
            if (!op.value) return;
            const n = String(base.filter(opp => cumpleFiltro(opp, campo, op.value)).length);
            if (op.dataset.cuenta !== n) op.dataset.cuenta = n;
        });
    });
}

// Normalizar tipo de oportunidad para mostrar textos homogéneos
function formatTipo(tipo) {
    if (!tipo) return 'Empleo';
    const normalized = normalizeText(tipo);
    if (normalized === 'practicante' || normalized === 'practica' || normalized === 'internship') {
        return 'Práctica profesional';
    }
    if (normalized === 'freelance' || normalized === 'independiente') {
        return 'Independiente';
    }
    // corregir posibles valores como "empleotime" a un texto limpio
    return 'Empleo tiempo completo';
}

// Texto de la API dentro del HTML: una empresa no debe poder meter codigo
// en la portada con el titulo o la descripcion de su vacante
function escapar(texto) {
    return String(texto ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function sesionActual() {
    try { return JSON.parse(localStorage.getItem('userData') || 'null'); } catch (e) { return null; }
}

// Renderizar tarjeta de oportunidad
function renderOportunidadCard(opp) {
    const isSaved = savedOpportunityIds.has(opp.id);
    const saveLabel = isSaved ? '<i data-ico="heart"></i> Guardado' : 'Guardar';
    const saveClass = isSaved ? 'btn-save saved' : 'btn-save';
    const esEmpresa = (sesionActual() || {}).userType === 'empresa';

    const modalityLabel = modalityMap[opp.modalidad] || capitalize(opp.modalidad) || 'Modalidad no especificada';
    const experienceLabel = experienceMap[opp.experiencia] || capitalize(opp.experiencia) || 'Experiencia no especificada';
    const skills = Array.isArray(opp.habilidades) ? opp.habilidades : [];
    const anillo = typeof opp.match === 'number'
        ? `<div class="result-match">
                    <div class="match-ring" data-pct="${opp.match}" role="img"
                         aria-label="${opp.match} por ciento de coincidencia con tu perfil"></div>
                </div>`
        : '';

    return `
        <div class="result-card">
            <div class="result-header">
                <div class="result-company-info">
                    <span class="result-logo"><i data-ico="building"></i></span>
                    <div>
                        <h3 class="result-title">${escapar(opp.titulo)}</h3>
                        <p class="result-company">${escapar(opp.empresa)}</p>
                    </div>
                </div>
                ${anillo}
            </div>

            <p class="result-description">${escapar(opp.descripcion)}</p>

            <div class="result-meta">
                <span class="meta-item"><i data-ico="pin"></i> ${escapar(opp.locationLabel || 'Ubicación no especificada')}</span>
                <span class="meta-item"><i data-ico="briefcase"></i> ${formatTipo(opp.tipo)}</span>
                <span class="meta-item"><i data-ico="desktop"></i> ${escapar(modalityLabel)}</span>
                <span class="meta-item"><i data-ico="trending"></i> ${escapar(experienceLabel)}</span>
                <span class="meta-item"><i data-ico="clock"></i> ${escapar(opp.duracion)}</span>
            </div>

            <div class="result-salary">
                <strong><i data-ico="money"></i> ${escapar(opp.salarioTexto)}</strong>
            </div>

            <div class="result-skills">
                ${skills.length > 0 ? skills.map(skill => `<span class="skill-tag">${escapar(skill)}</span>`).join('') : '<span class="skill-tag empty">Habilidades no especificadas</span>'}
            </div>

            <div class="result-actions">
                <button class="btn-apply" data-titulo="${escapar(opp.titulo)}">Postularme</button>
                ${esEmpresa ? '' : `<button class="${saveClass}" data-id="${escapar(opp.id)}">${saveLabel}</button>`}
            </div>
        </div>
    `;
}

function mostrarResultados(container, html) {
    container.innerHTML = '<div class="container">' + html + '</div>';
    container.style.display = 'block';
    container.classList.remove('hidden');
}

// Renderizar resultados en el contenedor
function renderResults(oportunidades, criteria) {
    const container = document.getElementById('results-container');
    if (!container) return;

    if (errorDeCarga) {
        mostrarResultados(container, `
            <div class="no-results">
                <h3>No pudimos cargar las vacantes</h3>
                <p>Revisa tu conexión e intenta de nuevo en un momento.</p>
            </div>`);
        return;
    }

    if (oportunidades.length === 0) {
        mostrarResultados(container, `
            <div class="no-results">
                <h3>No se encontraron oportunidades</h3>
                <p>Prueba con menos filtros o con otra palabra. Los números de cada lista te dicen cuántas vacantes hay con cada opción.</p>
            </div>`);
        return;
    }

    const opcionLugar = criteria.location && document.querySelector('#location-select option[value="' + CSS.escape(criteria.location) + '"]');
    const locationName = opcionLugar ? opcionLugar.textContent.replace(/\s*\(.*\)$/, '') : 'todas las ciudades';
    mostrarResultados(container, `
        <div class="results-header">
            <h2>Oportunidades para ti</h2>
            <p class="results-summary">
                Se encontraron <strong>${oportunidades.length}</strong> oportunidad${oportunidades.length !== 1 ? 'es' : ''}
                ${criteria.q ? ` con "${escapar(criteria.q)}"` : ''}
                en ${escapar(locationName)}${hayMasVacantes() ? `, entre las ${allOportunidades.length} más recientes` : ''}
            </p>
        </div>
        <div class="results-grid">
            ${oportunidades.map(opp => renderOportunidadCard(opp)).join('')}
        </div>`);

    // Postularme: con sesion, la vacante en la pagina de Vacantes (busca por
    // su titulo en el servidor); sin sesion, primero iniciar sesion
    container.querySelectorAll('.btn-apply').forEach(btn => {
        btn.addEventListener('click', function() {
            window.location.href = localStorage.getItem('token')
                ? 'oportunidades.html?q=' + encodeURIComponent(this.dataset.titulo)
                : 'login-usuario.html';
        });
    });

    container.querySelectorAll('.btn-save').forEach(btn => {
        btn.addEventListener('click', async function() {
            const id = this.getAttribute('data-id');

            if (!localStorage.getItem('userData')) {
                if (window.SkillMatchUI) SkillMatchUI.aviso('Inicia sesión para guardar vacantes.', 'info');
                setTimeout(() => { window.location.href = 'login-usuario.html'; }, 1200);
                return;
            }

            const isSaved = savedOpportunityIds.has(id);

            try {
                if (isSaved) {
                    const response = await fetchWithAuth(`${API_BASE_URL}/saved-jobs/job/${id}`, { method: 'DELETE' });
                    if (response.ok) {
                        savedOpportunityIds.delete(id);
                        this.classList.remove('saved');
                        this.textContent = 'Guardar';
                    }
                } else {
                    const response = await fetchWithAuth(`${API_BASE_URL}/saved-jobs`, {
                        method: 'POST',
                        body: JSON.stringify({ jobId: id })
                    });
                    if (response.ok) {
                        savedOpportunityIds.add(id);
                        this.classList.add('saved');
                        // innerHTML: con textContent se veia la etiqueta <i> escrita
                        this.innerHTML = '<i data-ico="heart"></i> Guardado';
                    }
                }
            } catch (e) {
            }
        });
    });
}

// Función pública para realizar búsqueda
async function performSearch(criteria) {
    const noCriteria = !criteria.q && !criteria.location && !criteria.modality && !criteria.experience && !criteria.salary;
    const container = document.getElementById('results-container');

    if (noCriteria) {
        if (container) {
            container.innerHTML = '';
            container.style.display = 'none';
            container.classList.add('hidden');
        }
        return; // no mostrar nada si no hay criterios
    }

    // Si las vacantes aun no llegan (servidor despertando), se avisa mientras tanto
    if (!datosReales && container) {
        mostrarResultados(container, '<p class="results-summary">Buscando vacantes…</p>');
    }
    await loadOportunidades();
    const results = filterOportunidades(criteria);
    renderResults(results, criteria);
}

async function loadStats() {
    try {
        const response = await fetch(`${API_BASE_URL}/public/stats`);
        if (!response.ok) return;
        const stats = await response.json();

        const fmt = (n) => n >= 1000 ? (n / 1000).toFixed(1).replace('.', ',') + 'K+' : n + '+';

        const el = (id) => document.getElementById(id);
        if (el('stat-users'))        el('stat-users').textContent        = fmt(stats.users        ?? 0);
        if (el('stat-companies'))    el('stat-companies').textContent    = fmt(stats.companies    ?? 0);
        if (el('stat-jobs'))         el('stat-jobs').textContent         = fmt(stats.jobs         ?? 0);
        if (el('stat-applications')) el('stat-applications').textContent = fmt(stats.applications ?? 0);
    } catch (_) {}
}

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
    loadStats();

    // Las vacantes se piden la primera vez que el visitante toca el buscador
    // o una lista; asi quien solo mira la portada no las descarga
    const zona = document.querySelector('.search-section');
    if (zona) {
        const precargar = () => loadOportunidades();
        zona.addEventListener('focusin', precargar, { once: true });
        zona.addEventListener('pointerdown', precargar, { once: true });
    }

    // Los conteos se recalculan al cambiar un filtro o lo escrito en el buscador
    Object.values(LISTAS_FILTRO).forEach(id => {
        const select = document.getElementById(id);
        if (select) select.addEventListener('change', contarEnListas);
    });
    const buscador = document.querySelector('.search-input');
    let espera = 0;
    if (buscador) buscador.addEventListener('input', () => {
        clearTimeout(espera);
        espera = setTimeout(contarEnListas, 250);
    });
});
