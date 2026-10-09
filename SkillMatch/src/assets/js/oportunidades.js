// Script para la página de oportunidades con backend integration

let allJobs = [];
let shownJobs = [];          // lo que se ve ahora (con filtros o busqueda), para ordenar sin perderlo
let currentFilters = {};
let savedJobIds = new Set();
let searchAbortController = null;
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

// Cargar oportunidades al iniciar
document.addEventListener('DOMContentLoaded', function() {
    // Las habilidades se piden a la vez que las vacantes; loadJobs las espera
    // para pintar una sola vez, ya con el % y el orden correctos
    userSkillsReady = loadUserSkills();
    loadJobs();
    loadSavedJobs();
    setupEventListeners();
    updateFilterBadges();
});

// Cargar trabajos desde el backend
async function loadJobs() {
    const container = document.querySelector('.opportunities-list');
    if (!container) {
        return;
    }

    try {
        container.innerHTML = '<div class="loading-message">Cargando oportunidades...</div>';
        
        const response = await fetchWithAuth(`${API_BASE_URL}/jobs`);
        
        
        if (response.ok) {
            const data = await response.json();
            allJobs = Array.isArray(data) ? data : (data.content || []);
            await userSkillsReady;
            displayJobs(allJobs);
        } else {
            const errorText = await response.text();
            throw new Error(`Error ${response.status}: ${errorText}`);
        }
    } catch (error) {
        container.innerHTML = `
            <div class="error-message">
                <h3>Error al cargar oportunidades</h3>
                <p>${error.message || 'Por favor, intenta de nuevo más tarde'}</p>
                <button onclick="loadJobs()" class="btn btn-primary">Reintentar</button>
            </div>
        `;
    }
}

// Habilidades de quien inicio sesion (solo estudiantes: las empresas no tienen)
async function loadUserSkills() {
    const datos = JSON.parse(localStorage.getItem('userData') || 'null');
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
// Antes era 60 + 5 por habilidad pedida + 10 si era remota (no miraba tu perfil).
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
        lista.sort((a, b) => (b.salaryMax || 0) - (a.salaryMax || 0));
    } else if (userSkills) {
        // Mayor % primero; a igual %, la que tiene mas habilidades tuyas
        const puntaje = job => { const m = getSkillMatch(job); return m ? m.pct * 100 + m.tiene : -1; };
        lista.sort((a, b) => puntaje(b) - puntaje(a));
    }
    return lista;
}

// Aviso arriba de la lista cuando no se puede calcular el %
function matchHint() {
    const datos = JSON.parse(localStorage.getItem('userData') || 'null');
    if (!datos) {
        return '<p class="recommend-hint"><i data-ico="bulb"></i> <span><a href="login-usuario.html">Inicia sesión</a> para ver qué tanto encajas con cada vacante.</span></p>';
    }
    if (datos.userType !== 'empresa' && userSkills && userSkills.size === 0) {
        return '<p class="recommend-hint"><i data-ico="bulb"></i> <span><a href="perfil-usuario.html">Agrega tus habilidades</a> y te mostramos qué tanto encajas con cada vacante.</span></p>';
    }
    return '';
}

// Mostrar trabajos en el DOM
function displayJobs(jobs) {
    const container = document.querySelector('.opportunities-list');

    if (!jobs || jobs.length === 0) {
        shownJobs = [];
        container.innerHTML = `
            <div class="no-results-message">
                <h3>No se encontraron oportunidades</h3>
                <p>Intenta ajustar los filtros de búsqueda</p>
            </div>
        `;
        updateResultsCount(0);
        return;
    }

    // Siempre en el orden elegido (antes los filtros y la busqueda lo ignoraban)
    shownJobs = sortList(jobs);
    container.innerHTML = matchHint() + shownJobs.map(job => createJobCard(job)).join('');
    updateResultsCount(jobs.length);
    attachJobCardListeners();
}

// Crear tarjeta de trabajo
function createJobCard(job) {
    const salary = job.salaryMin && job.salaryMax 
        ? `${formatCurrency(job.salaryMin)} - ${formatCurrency(job.salaryMax)}`
        : job.salaryMin 
        ? `Desde ${formatCurrency(job.salaryMin)}`
        : 'Salario a convenir';

    // Las habilidades que ya tienes van primero, en turquesa y con palomita:
    // asi se ve de donde sale el % del anillo
    const pedidas = uniqueJobSkills(job);
    const tuyas = [...pedidas.keys()].filter(k => userSkills && userSkills.has(k));
    const orden = [...tuyas, ...[...pedidas.keys()].filter(k => !tuyas.includes(k))];
    const skills = orden.length > 0
        ? orden.slice(0, 4).map(k => tuyas.includes(k)
            ? `<span class="skill is-common"><i data-ico="check"></i>${pedidas.get(k)}</span>`
            : `<span class="skill">${pedidas.get(k)}</span>`).join('')
        : '<span class="skill">Sin especificar</span>';

    // Sin habilidades tuyas o de la vacante no hay con que comparar: sin anillo
    const match = getSkillMatch(job);
    const anillo = match
        ? `<div class="match-ring" data-pct="${match.pct}" role="img"
                title="Tienes ${match.tiene} de ${match.pedidas} habilidades que pide"
                aria-label="${match.pct} por ciento: tienes ${match.tiene} de ${match.pedidas} habilidades que pide"></div>`
        : '';

    const isSaved = savedJobIds.has(job.id);
    const saveButtonClass = isSaved ? 'btn-save saved' : 'btn-save';
    const saveButtonText = isSaved ? '<i data-ico="heart"></i> Guardado' : '<i data-ico="save"></i> Guardar';

    return `
        <div class="opportunity-card" data-job-id="${job.id}">
            <div class="card-header-opp">
                <div class="company-logo-opp">${job.companyName ? job.companyName.charAt(0) : '<i data-ico="building"></i>'}</div>
                <div class="card-info">
                    <h3 class="job-title">${job.title}</h3>
                    <p class="company-name">${job.companyName || 'Empresa Confidencial'}</p>
                </div>
                ${anillo}
            </div>
            
            <div class="card-meta">
                <span class="meta-item"><i data-ico="pin"></i> ${job.location || 'Remoto'}</span>
                <span class="meta-item"><i data-ico="briefcase"></i> ${translateJobType(job.type)}</span>
                <span class="meta-item"><i data-ico="cap"></i> ${translateExperienceLevel(job.experienceLevel)}</span>
                <span class="meta-item"><i data-ico="money"></i> ${salary}</span>
            </div>
            
            <p class="card-description">${truncateText(job.description, 150)}</p>
            
            <div class="card-skills">
                ${skills}
            </div>
            
            <div class="card-footer">
                <span class="post-date"><i data-ico="calendar"></i> ${formatDate(job.postedDate)}</span>
                <div class="card-actions">
                    <button class="${saveButtonClass}" data-job-id="${job.id}">${saveButtonText}</button>
                    <button class="btn-apply" data-job-id="${job.id}">Aplicar</button>
                </div>
            </div>
        </div>
    `;
}

// Configurar event listeners
function setupEventListeners() {
    
    // Búsqueda
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.querySelector('.btn-search-main');
    
    if (searchInput && searchBtn) {
        const debouncedSearch = debounce(performSearch, 300);
        searchBtn.addEventListener('click', performSearch);
        searchInput.addEventListener('input', debouncedSearch);
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                performSearch();
            }
        });
    }

    // Filtros: se aplican al instante (antes habia que pulsar "Aplicar
    // filtros" y, al cargar, salian casillas marcadas que no filtraban nada)
    const applyFilterBtn = document.querySelector('.btn-apply-filters');
    if (applyFilterBtn) {
        applyFilterBtn.addEventListener('click', applyFilters);
    }

    const clearFilterBtn = document.querySelector('.btn-clear-filters');
    if (clearFilterBtn) {
        clearFilterBtn.addEventListener('click', clearFilters);
    }

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
}

// Adjuntar listeners a las tarjetas de trabajo
function attachJobCardListeners() {
    // Botones de aplicar
    document.querySelectorAll('.btn-apply').forEach(btn => {
        btn.addEventListener('click', function() {
            const jobId = this.dataset.jobId;
            applyToJob(jobId);
        });
    });

    // Botones de guardar
    document.querySelectorAll('.btn-save').forEach(btn => {
        btn.addEventListener('click', function() {
            const jobId = this.dataset.jobId;
            toggleSaveJob(jobId, this);
        });
    });
}

// Aplicar a trabajo
async function applyToJob(jobId) {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');

    if (!localStorage.getItem('userData')) {
        if (confirm('Debes iniciar sesión para aplicar a esta oportunidad.\n¿Deseas ir a la página de inicio de sesión?')) {
            window.location.href = 'login-usuario.html';
        }
        return;
    }
    
    // Verificar que sea un usuario (no una empresa)
    if (userData.role === 'EMPRESA' || userData.role === 'ADMIN') {
        alert('<i data-ico="close"></i> Solo los usuarios pueden aplicar a ofertas de trabajo.\n\nLas empresas y administradores no pueden postularse.');
        return;
    }

    const job = allJobs.find(j => j.id == jobId);
    if (!job) {
        return;
    }

    const confirmMessage = `¿Deseas aplicar a esta posición?\n\n<i data-ico="list"></i> Puesto: ${job.title}\n<i data-ico="building"></i> Empresa: ${job.companyName || 'Empresa Confidencial'}\n<i data-ico="pin"></i> Ubicación: ${job.location || 'No especificada'}`;
    
    if (confirm(confirmMessage)) {
        try {
            
            const response = await fetchWithAuth(`${API_BASE_URL}/applications`, {
                method: 'POST',
                body: JSON.stringify({
                    jobId: jobId,
                    coverLetter: `Estimado equipo, estoy muy interesado en la posición de ${job.title} y creo que mi perfil se alinea perfectamente con los requisitos.`
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                alert(`<i data-ico="check"></i> ¡Aplicación enviada exitosamente!\n\n<i data-ico="list"></i> Puesto: ${job.title}\n<i data-ico="building"></i> Empresa: ${job.companyName || 'Empresa Confidencial'}\n\nLa empresa revisará tu perfil pronto.`);
                
                // Deshabilitar el botón para evitar aplicaciones duplicadas
                const btn = document.querySelector(`.btn-apply[data-job-id="${jobId}"]`);
                if (btn) {
                    btn.disabled = true;
                    btn.textContent = 'Ya aplicaste';
                    btn.classList.add('applied');
                }
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Error al enviar aplicación');
            }
        } catch (error) {
            alert('<i data-ico="close"></i> Error al enviar la aplicación: ' + error.message);
        }
    }
}

// Guardar/desguardar trabajo
function toggleSaveJob(btn) {
    const jobId = btn.dataset.jobId;
    
    if (btn.classList.contains('saved')) {
        // Desguardar
        btn.classList.remove('saved');
        btn.innerHTML = '<i data-ico="save"></i> Guardar';
        
        // TODO: Implementar DELETE a /api/saved-jobs/:id
    } else {
        // Guardar
        btn.classList.add('saved');
        btn.innerHTML = '<i data-ico="check"></i> Guardado';
        
        // TODO: Implementar POST a /api/saved-jobs
        
        // Feedback visual
        btn.style.animation = 'pulse 0.5s ease';
        setTimeout(() => {
            btn.style.animation = '';
        }, 500);
    }
}

// Realizar búsqueda
async function performSearch() {
    const query = document.getElementById('searchInput').value.trim();

    if (!query) {
        displayJobs(allJobs);
        return;
    }

    if (searchAbortController) searchAbortController.abort();
    searchAbortController = new AbortController();

    try {
        const response = await fetchWithAuth(
            `${API_BASE_URL}/jobs/search?keyword=${encodeURIComponent(query)}`,
            { signal: searchAbortController.signal }
        );
        if (response.ok) {
            // /jobs/search responde con una pagina { content: [...] }, igual que /jobs
            const data = await response.json();
            displayJobs(Array.isArray(data) ? data : (data.content || []));
        } else {
            displayJobs([]);
        }
    } catch (error) {
        if (error.name !== 'AbortError') displayJobs(allJobs);
    }
}

function normalizeStr(str) {
    return str ? str.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase() : '';
}

// Aplicar filtros
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
    
    // Desmarcar todos los checkboxes
    document.querySelectorAll('.filter-card input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
    });
    
    // Resetear rango de salario
    const salaryRange = document.getElementById('salaryRange');
    if (salaryRange) {
        salaryRange.value = salaryRange.max;
        document.getElementById('maxSalary').textContent = formatCurrency(salaryRange.max);
    }

    // Limpiar filtros actuales
    currentFilters = {};

    updateFilterBadges();

    // Mostrar todas otra vez (ya estan cargadas: no hace falta pedirlas)
    if (allJobs.length) applyFilters(); else loadJobs();

}

// Ordenar trabajos
function sortJobs() {
    // Reordena lo que se esta viendo (antes partia de todas las vacantes y se
    // perdian los filtros y la busqueda); displayJobs aplica el orden elegido
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
    if (resultsCount) {
        resultsCount.textContent = `Mostrando ${count} oportunidad${count !== 1 ? 'es' : ''}`;
    }
}

function translateJobType(type) {
    const types = {
        'empleo': 'Tiempo Completo',
        'practica': 'Práctica',
        'freelance': 'Freelance'
    };
    // Algunas vacantes llegan como "práctica" (con tilde) y salian en minuscula
    return types[normalizeStr(type).trim()] || type;
}

function translateExperienceLevel(level) {
    const levels = {
        'sin-experiencia': 'Sin Experiencia',
        'junior': 'Junior',
        'semi-senior': 'Semi-Senior',
        'senior': 'Senior'
    };
    return levels[level] || level;
}

// Cargar trabajos guardados del usuario
async function loadSavedJobs() {
    if (!localStorage.getItem('userData')) return;
    // Las empresas no guardan vacantes (el backend responde 403)
    try { if (JSON.parse(localStorage.getItem('userData')).userType === 'empresa') return; } catch (e) { return; }

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/saved-jobs/job-ids`);

        if (response.ok) {
            const ids = await response.json();
            savedJobIds = new Set(ids);
        }
    } catch (error) {
    }
}

// Guardar o quitar trabajo de guardados
async function toggleSaveJob(jobId, buttonElement) {
    if (!localStorage.getItem('userData')) {
        if (confirm('Debes iniciar sesión para guardar oportunidades.\n¿Deseas ir a la página de inicio de sesión?')) {
            window.location.href = 'login-usuario.html';
        }
        return;
    }

    const isSaved = savedJobIds.has(jobId);

    try {
        if (isSaved) {
            // Quitar de guardados
            const response = await fetchWithAuth(`${API_BASE_URL}/saved-jobs/job/${jobId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                savedJobIds.delete(jobId);
                buttonElement.classList.remove('saved');
                buttonElement.innerHTML = '<i data-ico="save"></i> Guardar';
            }
        } else {
            // Agregar a guardados
            const response = await fetchWithAuth(`${API_BASE_URL}/saved-jobs`, {
                method: 'POST',
                body: JSON.stringify({ jobId: jobId })
            });

            if (response.ok) {
                savedJobIds.add(jobId);
                buttonElement.classList.add('saved');
                buttonElement.innerHTML = '<i data-ico="heart"></i> Guardado';
            }
        }
    } catch (error) {
        alert('Error al actualizar el estado. Por favor intenta de nuevo.');
    }
}


