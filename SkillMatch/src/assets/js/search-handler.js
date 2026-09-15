// search-handler.js
// Carga datos mock, filtra oportunidades y renderiza resultados

let allOportunidades = [];
const API_URL = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.JOBS}`;
let savedOpportunityIds = new Set();

async function loadSavedOpportunities() {
    if (!localStorage.getItem('userData')) return;

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/saved-jobs/job-ids`);
        if (response.ok) {
            const ids = await response.json();
            savedOpportunityIds = new Set(ids);
        }
    } catch (e) {
    }
}

// Cargar datos mock
async function loadOportunidades() {
    await loadSavedOpportunities();

    try {
        const response = await fetch(API_URL, { headers: { 'Accept': 'application/json' } });
        if (!response.ok) throw new Error(`API respondió ${response.status}`);
        const apiData = await response.json();
        const normalized = apiData
            .map(normalizeOportunidadFromApi)
            .filter(Boolean);
        allOportunidades = normalized;
    } catch (apiError) {
        try {
            const fallback = await fetch('../assets/data/oportunidades-mock.json');
            allOportunidades = await fallback.json();
        } catch (fileError) {
            allOportunidades = [];
        }
    }
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
        salarioTexto: salaryText,
        duracion: durationText,
        descripcion: descriptionText,
        habilidades: skills,
        logo: '<i data-ico="building"></i>',
        match: matchScore
    };
}

function resolveLocation(location) {
    if (!location) {
        return { key: '', label: 'Ubicación no especificada' };
    }

    const normalizedLocation = normalizeText(location);

    for (const [key, label] of Object.entries(locationMap)) {
        if (!key) continue;
        const normalizedKey = normalizeText(key);
        const normalizedLabel = normalizeText(label);
        if (normalizedLocation === normalizedKey || normalizedLocation === normalizedLabel) {
            return { key, label };
        }
    }

    return { key: '', label: location };
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
    if (normalized.includes('senior')) return 'senior';
    if (normalized.includes('mid') || normalized.includes('semi') || normalized.includes('intermedio')) return 'mid';
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

function resolveMatchScore(apiOpp) {
    if (typeof apiOpp.matchScore === 'number') return Math.round(apiOpp.matchScore);
    if (typeof apiOpp.match === 'number') return Math.round(apiOpp.match);
    if (apiOpp.id) { const h = String(apiOpp.id).split('').reduce((a,c) => a + c.charCodeAt(0), 0); return 70 + (h % 21); }
    return 75;
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

// Mapeo de valores de ubicación a nombres legibles
const locationMap = {
    '': 'Todas las ciudades',
    'cartagena': 'Cartagena de Indias',
    'barranquilla': 'Barranquilla',
    'bolivar_turbaco': 'Turbaco (Bolívar)',
    'bolivar_turbana': 'Turbana (Bolívar)',
    'bolivar_arjona': 'Arjona (Bolívar)',
    'bolivar_clemp': 'Clemencia (Bolívar)',
    'bolivar_magangue': 'Magangué (Bolívar)',
    'cartagena_bocagrande': 'Cartagena - Bocagrande',
    'bogota': 'Bogotá D.C.',
    'medellin': 'Medellín',
    'cali': 'Cali',
    'santa_marta': 'Santa Marta',
    'monteria': 'Montería',
    'sincelejo': 'Sincelejo',
    'barichara': 'Barichara',
    'otras': 'Otras ciudades'
};

// Mapeo de modalidades
const modalityMap = {
    'presencial': 'Presencial',
    'virtual': 'Virtual',
    'hibrida': 'Híbrida'
};

// Mapeo de experiencia
const experienceMap = {
    'junior': 'Junior (0-1 año)',
    'mid': 'Mid (1-3 años)',
    'senior': 'Senior (3+ años)'
};

// Parsear rango de salario
function parseSalaryRange(range) {
    if (!range) return { min: 0, max: Infinity };
    const [min, max] = range.split('-').map(v => parseInt(v) * 1000000 || 0);
    if (max === 0) return { min, max: Infinity }; // para "5000+"
    return { min: min || 0, max: max || Infinity };
}

// Filtrar oportunidades según criterios
function filterOportunidades(criteria) {
    let filtered = allOportunidades;

    // Filtro por búsqueda de texto (título, empresa, descripción)
    if (criteria.q) {
        const query = criteria.q.toLowerCase();
        filtered = filtered.filter(opp =>
            opp.titulo.toLowerCase().includes(query) ||
            opp.empresa.toLowerCase().includes(query) ||
            opp.descripcion.toLowerCase().includes(query) ||
            opp.habilidades.some(h => h.toLowerCase().includes(query))
        );
    }

    // Filtro por ubicación
    if (criteria.location) {
        filtered = filtered.filter(opp => opp.ubicacion === criteria.location);
    }

    // Filtro por modalidad (presencial, virtual, híbrida)
    if (criteria.modality) {
        filtered = filtered.filter(opp => opp.modalidad === criteria.modality);
    }

    // Filtro por experiencia (junior, mid, senior)
    if (criteria.experience) {
        filtered = filtered.filter(opp => opp.experiencia === criteria.experience);
    }

    // Filtro por rango de salario
    if (criteria.salary) {
        const salaryRange = parseSalaryRange(criteria.salary);
        filtered = filtered.filter(opp => {
            const oppSalary = opp.salario || 0;
            return oppSalary >= salaryRange.min && oppSalary <= salaryRange.max;
        });
    }

    // Ordenar por match score (descendente)
    filtered.sort((a, b) => b.match - a.match);

    return filtered;
}

// Normalizar tipo de oportunidad para mostrar textos homogéneos
function formatTipo(tipo) {
    if (!tipo) return 'Empleo';
    const normalized = normalizeText(tipo);
    if (normalized === 'practicante' || normalized === 'practica' || normalized === 'internship') {
        return 'Práctica profesional';
    }
    if (normalized === 'freelance' || normalized === 'independiente') {
        return 'Freelance';
    }
    // corregir posibles valores como "empleotime" a un texto limpio
    return 'Empleo tiempo completo';
}

// Renderizar tarjeta de oportunidad
function renderOportunidadCard(opp) {
    const isSaved = savedOpportunityIds.has(opp.id);
    const saveLabel = isSaved ? '<i data-ico="heart"></i> Guardado' : 'Guardar';
    const saveClass = isSaved ? 'btn-save saved' : 'btn-save';
    
    const modalityLabel = modalityMap[opp.modalidad] || capitalize(opp.modalidad) || 'Modalidad no especificada';
    const experienceLabel = experienceMap[opp.experiencia] || capitalize(opp.experiencia) || 'Experiencia no especificada';
    const skills = Array.isArray(opp.habilidades) ? opp.habilidades : [];

    return `
        <div class="result-card">
            <div class="result-header">
                <div class="result-company-info">
                    <span class="result-logo">${opp.logo}</span>
                    <div>
                        <h3 class="result-title">${opp.titulo}</h3>
                        <p class="result-company">${opp.empresa}</p>
                    </div>
                </div>
                <div class="result-match">
                    <div class="match-ring" data-pct="${opp.match}" role="img"
                         aria-label="${opp.match} por ciento de coincidencia con tu perfil"></div>
                </div>
            </div>

            <p class="result-description">${opp.descripcion}</p>

            <div class="result-meta">
                <span class="meta-item"><i data-ico="pin"></i> ${opp.locationLabel || locationMap[opp.ubicacion] || 'Ubicación no especificada'}</span>
                <span class="meta-item"><i data-ico="briefcase"></i> ${formatTipo(opp.tipo)}</span>
                <span class="meta-item"><i data-ico="desktop"></i> ${modalityLabel}</span>
                <span class="meta-item"><i data-ico="trending"></i> ${experienceLabel}</span>
                <span class="meta-item"><i data-ico="clock"></i> ${opp.duracion}</span>
            </div>

            <div class="result-salary">
                <strong><i data-ico="money"></i> ${opp.salarioTexto}</strong>
            </div>

            <div class="result-skills">
                ${skills.length > 0 ? skills.map(skill => `<span class="skill-tag">${skill}</span>`).join('') : '<span class="skill-tag empty">Habilidades no especificadas</span>'}
            </div>

            <div class="result-actions">
                <button class="btn-apply">Aplicar</button>
                <button class="${saveClass}" data-id="${opp.id}">${saveLabel}</button>
            </div>
        </div>
    `;
}

// Renderizar resultados en el contenedor
function renderResults(oportunidades, criteria) {
    const container = document.getElementById('results-container');
    if (!container) return;

    if (oportunidades.length === 0) {
        container.innerHTML = `
            <div class="no-results">
                <h3>No se encontraron oportunidades</h3>
                <p>Intenta con otros criterios de búsqueda o explora todas las oportunidades disponibles.</p>
            </div>
        `;
        container.style.display = 'block';
        container.classList.remove('hidden');
        return;
    }

    const locationName = locationMap[criteria.location] || 'Todas las ciudades';
    const resultsHTML = `
        <div class="results-header">
            <h2>Oportunidades para ti</h2>
            <p class="results-summary">
                Se encontraron <strong>${oportunidades.length}</strong> oportunidad${oportunidades.length !== 1 ? 'es' : ''}
                ${criteria.q ? ` con "${criteria.q}"` : ''}
                en ${locationName}
            </p>
        </div>
        <div class="results-grid">
            ${oportunidades.map(opp => renderOportunidadCard(opp)).join('')}
        </div>
    `;

    container.innerHTML = resultsHTML;
    container.style.display = 'block';
    container.classList.remove('hidden');

    // Agregar listeners a botones
    document.querySelectorAll('.btn-apply').forEach(btn => {
        btn.addEventListener('click', function() {
            // Redirigir al flujo de login de usuario para completar aplicación
            window.location.href = 'login-usuario.html';
        });
    });

    document.querySelectorAll('.btn-save').forEach(btn => {
        btn.addEventListener('click', async function() {
            const id = this.getAttribute('data-id');

            if (!localStorage.getItem('userData')) {
                if (confirm('Debes iniciar sesión para guardar oportunidades.\n¿Deseas ir a la página de inicio de sesión?')) {
                    window.location.href = 'login-usuario.html';
                }
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
                        this.textContent = '<i data-ico="heart"></i> Guardado';
                    }
                }
            } catch (e) {
            }
        });
    });
}

// Función pública para realizar búsqueda
function performSearch(criteria) {
    const noCriteria = !criteria.q && !criteria.location && !criteria.modality && !criteria.experience && !criteria.salary;

    if (noCriteria) {
        const container = document.getElementById('results-container');
        if (container) {
            container.innerHTML = '';
            container.style.display = 'none';
            container.classList.add('hidden');
        }
        return; // no mostrar nada si no hay criterios
    }

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
    loadOportunidades();
    loadStats();
});
