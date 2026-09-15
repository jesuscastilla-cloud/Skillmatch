// Script para la página de oportunidades con backend integration

let allJobs = [];
let currentFilters = {};
let savedJobIds = new Set();
let searchAbortController = null;

function debounce(fn, delay) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

// Cargar oportunidades al iniciar
document.addEventListener('DOMContentLoaded', function() {
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
            if (allJobs.length > 0) {
            }
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
                <button onclick="loadJobs()" class="btn-primary">Reintentar</button>
            </div>
        `;
    }
}

// Mostrar trabajos en el DOM
function displayJobs(jobs) {
    const container = document.querySelector('.opportunities-list');
    
    if (!jobs || jobs.length === 0) {
        container.innerHTML = `
            <div class="no-results-message">
                <h3>No se encontraron oportunidades</h3>
                <p>Intenta ajustar los filtros de búsqueda</p>
            </div>
        `;
        updateResultsCount(0);
        return;
    }

    container.innerHTML = jobs.map(job => createJobCard(job)).join('');
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

    const skills = job.skills && job.skills.length > 0
        ? job.skills.slice(0, 4).map(skill => `<span class="skill">${skill}</span>`).join('')
        : '<span class="skill">Sin especificar</span>';

    const matchScore = calculateMatchScore(job);
    const matchClass = matchScore >= 80 ? 'match-high' : matchScore >= 60 ? 'match-medium' : 'match-low';

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
                <div class="match-ring" data-pct="${matchScore}" role="img"
                     aria-label="${matchScore} por ciento de coincidencia con tu perfil"></div>
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

    // Filtros
    const applyFilterBtn = document.querySelector('.btn-apply-filters');
    if (applyFilterBtn) {
        applyFilterBtn.addEventListener('click', applyFilters);
    }

    const clearFilterBtn = document.querySelector('.btn-clear-filters');
    if (clearFilterBtn) {
        clearFilterBtn.addEventListener('click', clearFilters);
    }

    document.querySelectorAll('.filter-card input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', updateFilterBadges);
    });

    // Rango de salario - actualización en tiempo real
    const salaryRange = document.getElementById('salaryRange');
    if (salaryRange) {
        salaryRange.addEventListener('input', function() {
            const value = parseInt(this.value);
            document.getElementById('maxSalary').textContent = formatCurrency(value);
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
            const jobs = await response.json();
            displayJobs(jobs);
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

    // Recargar todas las oportunidades
    loadJobs();

}

// Ordenar trabajos
function sortJobs() {
    const sortValue = document.getElementById('sortSelect').value;
    let sorted = [...allJobs];

    switch(sortValue) {
        case 'recent':
            sorted.sort((a, b) => new Date(b.postedDate) - new Date(a.postedDate));
            break;
        case 'salary':
            sorted.sort((a, b) => (b.salaryMax || 0) - (a.salaryMax || 0));
            break;
        case 'match':
            sorted.sort((a, b) => calculateMatchScore(b) - calculateMatchScore(a));
            break;
    }

    displayJobs(sorted);
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
    return types[type] || type;
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
                buttonElement.textContent = '<i data-ico="save"></i> Guardar';
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
                buttonElement.textContent = '<i data-ico="heart"></i> Guardado';
            }
        }
    } catch (error) {
        alert('Error al actualizar el estado. Por favor intenta de nuevo.');
    }
}

function calculateMatchScore(job) {
    // Algoritmo simple de matching - puede mejorarse
    let score = 60; // Base score
    
    // Bonus por habilidades (requiere lógica más compleja con el perfil del usuario)
    if (job.skills && job.skills.length > 0) {
        score += Math.min(20, job.skills.length * 5);
    }
    
    // Bonus por modalidad remota
    if (job.modality === 'remoto' || job.modality === 'híbrido') {
        score += 10;
    }
    
    return Math.min(100, score);
}

