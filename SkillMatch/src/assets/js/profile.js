// Script para la página de perfil de usuario con conexión al backend

let currentUserProfile = {};

// Obtener datos del usuario desde localStorage o URL
function getUserData() {
    // Verificar si hay un ID de usuario en la URL (para ver otros perfiles)
    const urlParams = new URLSearchParams(window.location.search);
    const userIdFromUrl = urlParams.get('id');
    
    const userData = localStorage.getItem('userData');

    if (!userData) {
        alert('Debes iniciar sesión para ver esta página');
        window.location.href = 'login-usuario.html';
        return null;
    }
    
    // Si hay un ID en la URL, devolver un objeto con ese ID (cargar desde backend)
    let propio = null;
    try { propio = JSON.parse(userData); } catch (e) { /* datos dañados */ }
    if (userIdFromUrl && String(userIdFromUrl) !== String(propio && propio.id)) {
        return { id: userIdFromUrl, isOtherUser: true };
    }
    
    // Si no hay ID en URL, usar el usuario actual
    if (!userData) {
        alert('Error al cargar datos de usuario');
        window.location.href = 'login-usuario.html';
        return null;
    }
    
    const parsed = JSON.parse(userData);
    let id = parsed?.id || parsed?.userId;
    if (!id) {
        try {
            const token = localStorage.getItem('token');
            if (token) {
                const payload = JSON.parse(atob(token.split('.')[1]));
                id = payload.userId || null;
            }
        } catch (e) { /* token malformed */ }
    }
    return { ...parsed, id, isOtherUser: false };
}

// Cerrar sesión — usa la función global de api-config.js

// Cargar perfil del usuario
async function loadUserProfile() {
    const user = getUserData();
    if (!user) return;


    try {
        // Cargar información del perfil
        const response = await fetchWithAuth(`${API_BASE_URL}/users/${user.id}`);

        if (response.ok) {
            const profileData = await response.json();
            currentUserProfile = { ...profileData, isOtherUser: user.isOtherUser };
            displayUserProfile(currentUserProfile);
            
            // Si estamos viendo el perfil de otro usuario, ocultar botones de edición
            // y ofrecer escribirle
            if (user.isOtherUser) {
                hideEditButtons();
                const mensaje = document.getElementById('messageUserBtn');
                if (mensaje) {
                    mensaje.href = 'mensajes.html?userId=' + encodeURIComponent(user.id);
                    mensaje.hidden = false;
                }
            }
        } else {
            displayUserProfile(user);
        }
    } catch (error) {
        displayUserProfile(user);
    }
}

// Ocultar botones de edición cuando se visualiza el perfil de otro usuario
function hideEditButtons() {
    
    // Ocultar todos los botones de edición
    const editButtons = document.querySelectorAll('.btn-edit, .edit-btn, .add-btn, button[onclick*="edit"], button[onclick*="add"]');
    editButtons.forEach(btn => {
        btn.style.display = 'none';
    });
    
    // Ocultar botón de editar perfil, la portada, la foto y los "+ Agregar"
    // (no tienen onclick y el selector de arriba no los encontraba)
    ['editProfileBtn', 'changePasswordBtn', 'editCoverBtn', 'editAvatarBtn', 'addSkillBtn', 'addExperienceBtn', 'addEducationBtn'].forEach(id => {
        const boton = document.getElementById(id);
        if (boton) boton.style.display = 'none';
    });
    
    // Ocultar la tarjeta de progreso completa (antes quedaba el titulo solo)
    const profileProgress = document.querySelector('.profile-progress');
    if (profileProgress) profileProgress.closest('.profile-card').style.display = 'none';

    // Las postulaciones son las de quien inicio sesion, no las de este perfil
    const applicationsCard = document.getElementById('applicationsCard');
    if (applicationsCard) applicationsCard.style.display = 'none';

    // "Vacantes para ti" se calculaba con las habilidades de la otra persona
    const recomendadas = document.getElementById('recommendedJobs');
    if (recomendadas) recomendadas.closest('.sidebar-card').style.display = 'none';
}

/** true cuando se ve el perfil de otra persona: sin botones para borrar
 *  lo suyo (antes salian la X de las habilidades y las papeleras) */
function esPerfilAjeno() {
    const id = new URLSearchParams(window.location.search).get('id');
    if (!id) return false;
    try { return String(id) !== String(JSON.parse(localStorage.getItem('userData')).id); } catch (e) { return true; }
}

const AVATAR_COLORS = ['#0369a1','#0891b2','#0d9488','#059669','#7c3aed','#9333ea','#c026d3','#e11d48','#b45309'];

function setProfileAvatar(profileImageUrl, fullName) {
    const img = document.getElementById('profileImage');
    const initialsDiv = document.getElementById('profileInitials');
    if (!img || !initialsDiv) return;

    if (profileImageUrl) {
        img.src = profileImageUrl;
        img.classList.remove('avatar-img-hidden');
        initialsDiv.style.display = 'none';
    } else {
        img.classList.add('avatar-img-hidden');
        const initials = (fullName || '?')
            .split(' ')
            .filter(Boolean)
            .slice(0, 2)
            .map(w => w[0].toUpperCase())
            .join('');
        const bg = AVATAR_COLORS[(fullName || '').charCodeAt(0) % AVATAR_COLORS.length];
        initialsDiv.style.display = 'flex';
        initialsDiv.style.background = bg;
        initialsDiv.textContent = initials;
    }
}

// Mostrar información del perfil
function displayUserProfile(user) {
    const fullName = `${user.firstName} ${user.lastName}`;
    document.getElementById('userName').textContent = fullName;
    document.getElementById('userHeadline').textContent = user.headline || 'Perfil en SkillMatch';
    // El icono va como HTML y la ciudad como texto (con textContent el icono
    // salia escrito tal cual; con append la ciudad nunca se lee como codigo)
    const ubicacion = document.getElementById('userLocation');
    ubicacion.innerHTML = '<i data-ico="pin"></i> ';
    ubicacion.append(user.location || 'Cartagena, Colombia');

    setProfileAvatar(user.profileImageUrl, fullName);
    // La portada guardada (antes solo se pintaba justo despues de cambiarla:
    // al recargar volvia la de siempre)
    applyCover(user.coverImageUrl);

    // Ya no se muestran las "estadisticas" de /users/{id}/statistics: las vistas
    // del perfil son inventadas (50 + postulaciones x 5 + dias x 2) y el "match
    // promedio" era en realidad el % de perfil completo, repetido y distinto
    // del de la lista de progreso. Las postulaciones reales van a la derecha.

    // Conexiones reales (antes el "0 conexiones" del HTML nunca cambiaba)
    if (!user.isOtherUser) loadConnectionsCount();

    // Calcular progreso del perfil
    calculateProfileProgress(user);
}

// Cuenta las conexiones de quien inicio sesion. En el perfil de otra persona
// no hay de donde sacarlas, asi que el dato se oculta en vez de mentir.
async function loadConnectionsCount() {
    const destino = document.getElementById('userConnections');
    if (!destino) return;
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/connections/my-connections`);
        if (!response.ok) throw new Error();
        const total = (await response.json()).length;
        destino.innerHTML = '<i data-ico="users"></i> ' + total + (total === 1 ? ' conexión' : ' conexiones');
    } catch (error) {
        destino.style.display = 'none';
    }
}

// Estado global de completitud del perfil
const profileChecks = {
    'Información básica': false,
    'Teléfono': false,
    'Habilidades agregadas': false,
    'Experiencia agregada': false,
    'Educación agregada': false
};

// Actualizar un elemento específico del checklist
function updateProfileChecklist(checkType, value) {
    switch(checkType) {
        case 'skills':
            profileChecks['Habilidades agregadas'] = value;
            break;
        case 'experience':
            profileChecks['Experiencia agregada'] = value;
            break;
        case 'education':
            profileChecks['Educación agregada'] = value;
            break;
    }
    renderProfileChecklist();
}

// Que formulario abre cada pendiente de la lista
const PASOS_PERFIL = {
    'Información básica': () => openEditModal(),
    'Teléfono': () => openEditModal(),
    'Habilidades agregadas': () => openAddSkillModal(),
    'Experiencia agregada': () => openAddExperienceModal(),
    'Educación agregada': () => openAddEducationModal()
};

// Renderizar la lista de verificación
function renderProfileChecklist() {
    const checklist = document.getElementById('profileChecklist');
    if (checklist) {
        // Lo hecho queda como texto; lo pendiente es un boton que lleva directo
        // al formulario que falta llenar
        checklist.innerHTML = Object.entries(profileChecks).map(([key, value]) =>
            value
                ? `<li class="completed"><i data-ico="check"></i> ${key}</li>`
                : `<li><button type="button" class="progress-step" data-paso="${key}">
                       <i data-ico="circle"></i> ${key} <i data-ico="plus"></i>
                   </button></li>`
        ).join('');
        if (!checklist.dataset.listo) {
            checklist.dataset.listo = '1';
            checklist.addEventListener('click', (e) => {
                const paso = e.target.closest('.progress-step');
                if (paso && PASOS_PERFIL[paso.dataset.paso]) PASOS_PERFIL[paso.dataset.paso]();
            });
        }
    }
    // El porcentaje sale de la misma lista: 100 % solo con todo completo
    const total = Object.keys(profileChecks).length;
    const hechos = Object.values(profileChecks).filter(Boolean).length;
    const porcentaje = Math.round(hechos / total * 100);
    const barra = document.getElementById('profileProgress');
    const texto = document.getElementById('progressPercentage');
    if (barra) barra.style.width = porcentaje + '%';
    if (texto) texto.textContent = porcentaje;
}

// Calcular progreso del perfil
function calculateProfileProgress(user) {
    profileChecks['Información básica'] = !!(user.firstName && user.lastName && user.email);
    profileChecks['Teléfono'] = !!user.phone;
    // Las demás se actualizarán cuando se carguen los datos correspondientes
    
    renderProfileChecklist();
}

// Cargar habilidades del usuario
async function loadUserSkills() {
    const user = getUserData();
    if (!user) return;

    const skillsContainer = document.getElementById('userSkills');

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/users/${user.id}/skills`);

        if (response.ok) {
            const skills = await response.json();
            displaySkills(skills);
        } else {
            // Antes mostraba JavaScript, HTML, CSS y React como si fueran suyas
            skillsContainer.innerHTML = '<p class="error-text">No se pudieron cargar las habilidades</p>';
            setUserSkillNames([]);
        }
    } catch (error) {
        skillsContainer.innerHTML = '<p class="error-text">Error cargando habilidades</p>';
        setUserSkillNames([]);
    }
}

// Mostrar habilidades con opción de eliminar
function displaySkills(skills) {
    const skillsContainer = document.getElementById('userSkills');
    
    // Las recomendaciones de la derecha se comparan con estas habilidades
    setUserSkillNames((skills || []).map(skill => skill.name));

    const ajeno = esPerfilAjeno();
    if (!skills || skills.length === 0) {
        skillsContainer.innerHTML = `<p class="empty-text">${ajeno ? 'Esta persona aún no ha agregado habilidades' : 'Aún no has agregado habilidades'}</p>`;
        updateProfileChecklist('skills', false);
        return;
    }

    skillsContainer.innerHTML = skills.map(skill =>
        `<span class="skill-tag">
            ${escaparHtml(skill.name)}
            <span class="skill-level">${formatSkillLevel(skill.level)}</span>
            ${ajeno ? '' : `<button class="btn-remove-skill" onclick="deleteSkill('${escaparHtml(skill.id)}')" title="Eliminar"><i data-ico="close"></i></button>`}
        </span>`
    ).join('');
    
    updateProfileChecklist('skills', true);
}

// Formatear nivel de skill
function formatSkillLevel(level) {
    const levels = {
        'BASICO': '<i data-ico="star"></i>',
        'INTERMEDIO': '<i data-ico="star"></i><i data-ico="star"></i>',
        'AVANZADO': '<i data-ico="star"></i><i data-ico="star"></i><i data-ico="star"></i>',
        'EXPERTO': '<i data-ico="star"></i><i data-ico="star"></i><i data-ico="star"></i><i data-ico="star"></i>'
    };
    return levels[level] || '';
}

// Abrir modal de agregar skill
function openAddSkillModal() {
    document.getElementById('addSkillModal').style.display = 'flex';
}

// Cerrar modal de agregar skill
function closeAddSkillModal() {
    document.getElementById('addSkillModal').style.display = 'none';
    document.getElementById('addSkillForm').reset();
}

// Agregar una nueva skill
async function addSkill(event) {
    event.preventDefault();
    
    const user = getUserData();
    if (!user) return;
    
    const skillName = document.getElementById('skillName').value.trim();
    const skillLevel = document.getElementById('skillLevel').value;


    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/users/${user.id}/skills`, {
            method: 'POST',
            body: JSON.stringify({
                name: skillName,
                level: skillLevel
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            alert('¡Habilidad agregada exitosamente!');
            closeAddSkillModal();
            loadUserSkills(); // Recargar skills
        } else {
            const error = await response.json();
            alert(error.message || 'Error al agregar la habilidad');
        }
    } catch (error) {
        alert('Error al conectar con el servidor');
    }
}

// Eliminar una skill
async function deleteSkill(skillId) {
    const user = getUserData();
    if (!user) return;
    
    // Pregunta de la marca (antes confirm() del navegador)
    const quitar = await SkillMatchUI.confirmar({ titulo: 'Quitar habilidad', texto: '¿Quieres quitar esta habilidad de tu perfil?', aceptar: 'Quitar', peligro: true });
    if (!quitar) return;
    

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/users/${user.id}/skills/${skillId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            alert('Habilidad eliminada exitosamente');
            loadUserSkills(); // Recargar skills
        } else {
            const error = await response.json();
            alert(error.message || 'Error al eliminar la habilidad');
        }
    } catch (error) {
        alert('Error al conectar con el servidor');
    }
}

// ============ EXPERIENCE FUNCTIONS ============

// Cargar experiencias del usuario
async function loadUserExperiences() {
    const user = getUserData();
    if (!user) return;

    const container = document.getElementById('experienceContainer');

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/users/${user.id}/experiences`);

        if (response.ok) {
            const experiences = await response.json();
            displayExperiences(experiences);
        } else {
            container.innerHTML = '<p class="empty-text">No se pudieron cargar las experiencias</p>';
        }
    } catch (error) {
        container.innerHTML = '<p class="error-text">Error cargando experiencias</p>';
    }
}

// Mostrar experiencias
function displayExperiences(experiences) {
    const container = document.getElementById('experienceContainer');
    
    const ajeno = esPerfilAjeno();
    if (!experiences || experiences.length === 0) {
        container.innerHTML = `<p class="empty-text">${ajeno ? 'Esta persona aún no ha agregado experiencia laboral' : 'Aún no has agregado experiencia laboral'}</p>`;
        updateProfileChecklist('experience', false);
        return;
    }

    container.innerHTML = experiences.map(exp => {
        const startDate = new Date(exp.startDate).toLocaleDateString('es-ES', { year: 'numeric', month: 'short' });
        const endDate = exp.isCurrent ? 'Actualidad' : new Date(exp.endDate).toLocaleDateString('es-ES', { year: 'numeric', month: 'short' });
        
        return `
            <div class="experience-item">
                <div class="experience-badge"><i data-ico="briefcase"></i></div>
                <div class="experience-content">
                    <div class="experience-header">
                        <h3>${escaparHtml(exp.position)}</h3>
                        ${ajeno ? '' : `<button class="btn-delete-item" onclick="deleteExperience('${escaparHtml(exp.id)}')" title="Eliminar"><i data-ico="trash"></i></button>`}
                    </div>
                    <p class="company">${escaparHtml(exp.company)}</p>
                    <p class="timeline">${startDate} - ${endDate}${exp.location ? ' | ' + escaparHtml(exp.location) : ''}</p>
                    ${exp.description ? `<p class="description">${escaparHtml(exp.description)}</p>` : ''}
                </div>
            </div>
        `;
    }).join('');
    
    updateProfileChecklist('experience', true);
}

// Abrir modal agregar experiencia
function openAddExperienceModal() {
    document.getElementById('addExperienceModal').style.display = 'flex';
}

// Cerrar modal agregar experiencia
function closeAddExperienceModal() {
    document.getElementById('addExperienceModal').style.display = 'none';
    document.getElementById('addExperienceForm').reset();
}

// Agregar experiencia
async function addExperience(event) {
    event.preventDefault();
    
    const user = getUserData();
    if (!user) return;
    
    const isCurrent = document.getElementById('expIsCurrent').checked;

    const data = {
        company: document.getElementById('expCompany').value,
        position: document.getElementById('expPosition').value,
        startDate: document.getElementById('expStartDate').value,
        endDate: isCurrent ? null : document.getElementById('expEndDate').value,
        isCurrent: isCurrent,
        location: document.getElementById('expLocation').value,
        description: document.getElementById('expDescription').value
    };
    
    
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/users/${user.id}/experiences`, {
            method: 'POST',
            body: JSON.stringify(data)
        });

        if (response.ok) {
            alert('¡Experiencia agregada exitosamente!');
            closeAddExperienceModal();
            loadUserExperiences();
        } else {
            const error = await response.json();
            alert(error.message || 'Error al agregar la experiencia');
        }
    } catch (error) {
        alert('Error al conectar con el servidor');
    }
}

// Eliminar experiencia
async function deleteExperience(expId) {
    const user = getUserData();
    if (!user) return;
    
    const quitar = await SkillMatchUI.confirmar({ titulo: 'Quitar experiencia', texto: '¿Quieres quitar esta experiencia de tu perfil?', aceptar: 'Quitar', peligro: true });
    if (!quitar) return;
    
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/users/${user.id}/experiences/${expId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            alert('Experiencia eliminada exitosamente');
            loadUserExperiences();
        } else {
            const error = await response.json();
            alert(error.message || 'Error al eliminar la experiencia');
        }
    } catch (error) {
        alert('Error al conectar con el servidor');
    }
}

// ============ EDUCATION FUNCTIONS ============

// Cargar educación del usuario
async function loadUserEducations() {
    const user = getUserData();
    if (!user) return;

    const container = document.getElementById('educationContainer');

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/users/${user.id}/educations`);

        if (response.ok) {
            const educations = await response.json();
            displayEducations(educations);
        } else {
            container.innerHTML = '<p class="empty-text">No se pudo cargar la educación</p>';
        }
    } catch (error) {
        container.innerHTML = '<p class="error-text">Error cargando educación</p>';
    }
}

// Mostrar educación
function displayEducations(educations) {
    const container = document.getElementById('educationContainer');
    
    const ajeno = esPerfilAjeno();
    if (!educations || educations.length === 0) {
        container.innerHTML = `<p class="empty-text">${ajeno ? 'Esta persona aún no ha agregado estudios' : 'Aún no has agregado información educativa'}</p>`;
        updateProfileChecklist('education', false);
        return;
    }

    container.innerHTML = educations.map(edu => {
        const startDate = new Date(edu.startDate).toLocaleDateString('es-ES', { year: 'numeric', month: 'short' });
        const endDate = edu.isCurrent ? 'Actualidad' : new Date(edu.endDate).toLocaleDateString('es-ES', { year: 'numeric', month: 'short' });
        
        return `
            <div class="education-item">
                <div class="education-badge"><i data-ico="cap"></i></div>
                <div class="education-content">
                    <div class="education-header">
                        <h3>${escaparHtml(edu.degree)}</h3>
                        ${ajeno ? '' : `<button class="btn-delete-item" onclick="deleteEducation('${escaparHtml(edu.id)}')" title="Eliminar"><i data-ico="trash"></i></button>`}
                    </div>
                    <p class="school">${escaparHtml(edu.school)}</p>
                    <p class="timeline">${startDate} - ${endDate}${edu.fieldOfStudy ? ' | ' + escaparHtml(edu.fieldOfStudy) : ''}</p>
                    ${edu.description ? `<p class="description">${escaparHtml(edu.description)}</p>` : ''}
                </div>
            </div>
        `;
    }).join('');
    
    updateProfileChecklist('education', true);
}

// Abrir modal agregar educación
function openAddEducationModal() {
    document.getElementById('addEducationModal').style.display = 'flex';
}

// Cerrar modal agregar educación
function closeAddEducationModal() {
    document.getElementById('addEducationModal').style.display = 'none';
    document.getElementById('addEducationForm').reset();
}

// Agregar educación
async function addEducation(event) {
    event.preventDefault();
    
    const user = getUserData();
    if (!user) return;
    
    const isCurrent = document.getElementById('eduIsCurrent').checked;

    const data = {
        school: document.getElementById('eduSchool').value,
        degree: document.getElementById('eduDegree').value,
        fieldOfStudy: document.getElementById('eduFieldOfStudy').value,
        startDate: document.getElementById('eduStartDate').value,
        endDate: isCurrent ? null : document.getElementById('eduEndDate').value,
        isCurrent: isCurrent,
        description: document.getElementById('eduDescription').value
    };


    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/users/${user.id}/educations`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            alert('¡Educación agregada exitosamente!');
            closeAddEducationModal();
            loadUserEducations();
        } else {
            const error = await response.json();
            alert(error.message || 'Error al agregar la educación');
        }
    } catch (error) {
        alert('Error al conectar con el servidor');
    }
}

// Eliminar educación
async function deleteEducation(eduId) {
    const user = getUserData();
    if (!user) return;
    
    const quitar = await SkillMatchUI.confirmar({ titulo: 'Quitar estudio', texto: '¿Quieres quitar este estudio de tu perfil?', aceptar: 'Quitar', peligro: true });
    if (!quitar) return;
    
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/users/${user.id}/educations/${eduId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            alert('Educación eliminada exitosamente');
            loadUserEducations();
        } else {
            const error = await response.json();
            alert(error.message || 'Error al eliminar la educación');
        }
    } catch (error) {
        alert('Error al conectar con el servidor');
    }
}

// Recomendaciones: antes cada vacante mostraba un porcentaje al azar
// (Math.random entre 80 y 100) que cambiaba al recargar. Ahora se cuenta
// cuantas habilidades de la vacante tiene la persona y se ordena por eso.
// Se pinta cuando ya llegaron las dos cosas: vacantes y habilidades.
let recentJobs = null;      // null = todavia no llegan
let userSkillNames = null;

// Minusculas y sin tildes, para que "Programación" y "programacion" coincidan
function normalizeSkill(nombre) {
    return String(nombre || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function setUserSkillNames(nombres) {
    userSkillNames = nombres.map(normalizeSkill);
    if (recentJobs) displayRecommendedJobs();
}

// Cargar oportunidades recomendadas
async function loadRecommendedJobs() {
    const user = getUserData();
    if (!user) return;

    const jobsContainer = document.getElementById('recommendedJobs');

    try {
        // Obtener trabajos recientes del backend
        const response = await fetchWithAuth(`${API_BASE_URL}/jobs/recent`);

        if (response.ok) {
            recentJobs = await response.json();
            if (userSkillNames) displayRecommendedJobs();
        } else {
            jobsContainer.innerHTML = '<p class="empty-text">No hay oportunidades disponibles en este momento</p>';
        }
    } catch (error) {
        jobsContainer.innerHTML = '<p class="error-text">Error cargando oportunidades</p>';
    }
}

// Mostrar oportunidades recomendadas
function displayRecommendedJobs() {
    const jobsContainer = document.getElementById('recommendedJobs');

    if (!recentJobs || recentJobs.length === 0) {
        jobsContainer.innerHTML = '<p class="empty-text">No hay oportunidades disponibles</p>';
        return;
    }

    const propias = new Set(userSkillNames);
    const jobs = recentJobs.map(job => {
        // Los datos de prueba repiten habilidades ("Angular, Git, Angular")
        const pedidas = [...new Set((job.skills || []).map(normalizeSkill))].filter(Boolean);
        const tiene = pedidas.filter(s => propias.has(s)).length;
        return { job, pedidas: pedidas.length, tiene };
    });
    // Mas coincidencias primero; a igualdad, la que pide menos (le falta menos).
    // Sin habilidades no hay con que comparar: quedan las mas recientes.
    if (propias.size) jobs.sort((a, b) => (b.tiene - a.tiene) || (a.pedidas - b.pedidas));
    jobs.splice(4);

    const aviso = propias.size === 0
        ? '<p class="recommend-hint"><i data-ico="bulb"></i> Agrega tus habilidades y te mostramos cuáles vacantes encajan contigo.</p>'
        : '';

    jobsContainer.innerHTML = aviso + jobs.map(({ job, pedidas, tiene }) => {
        // Naranja solo cuando tiene todas (el acento se reserva para el match alto)
        const clase = tiene === 0 ? 'match-fair' : (tiene === pedidas ? 'match-excellent' : 'match-good');
        const etiqueta = pedidas && propias.size
            ? `<span class="match-badge-small ${clase}" title="Habilidades que ya tienes de las que pide la vacante">${tiene} de ${pedidas}</span>`
            : '';
        return `
        <div class="opportunity-item-compact">
            <div class="opportunity-header-compact">
                <h3>${escaparHtml(job.title)}</h3>
                ${etiqueta}
            </div>
            <p class="opportunity-company-compact">${escaparHtml(job.company?.name || job.companyName)}</p>
            <p class="opportunity-location-compact"><i data-ico="pin"></i> ${escaparHtml(job.location)}</p>
            <a class="btn-apply-compact" href="oportunidades.html?jobId=${encodeURIComponent(job.id)}">Ver y postularme</a>
        </div>`;
    }).join('');
}

// (Postularse se hace en Vacantes, con el mensaje que escribe la persona: antes
// aquí se mandaba la carta "Aplicación desde el perfil de usuario" sin preguntar.)

// Cargar empresas con las que el usuario ha interactuado
async function loadInterestedCompanies() {
    const user = getUserData();
    if (!user) return;
    
    const companiesContainer = document.getElementById('interestedCompanies');

    try {
        // Obtener aplicaciones del usuario
        const response = await fetchWithAuth(`${API_BASE_URL}/applications/my-applications`);

        if (response.ok) {
            const applications = await response.json();
            
            // Extraer empresas únicas de las aplicaciones
            const companiesMap = new Map();
            applications.forEach(app => {
                if (app.companyName && app.jobId) {
                    if (!companiesMap.has(app.jobId)) {
                        companiesMap.set(app.jobId, {
                            id: app.id,
                            jobId: app.jobId,
                            name: app.companyName,
                            job: app.jobTitle,
                            appliedDate: new Date(app.appliedDate),
                            status: app.status
                        });
                    }
                }
            });

            const companies = Array.from(companiesMap.values())
                .sort((a, b) => b.appliedDate - a.appliedDate);
            misPostulaciones = companies;

            if (companies.length === 0) {
                companiesContainer.innerHTML = '<p class="empty-text">Aún no te has postulado a ninguna vacante.</p>' +
                    '<a href="oportunidades.html" class="btn-view-all">Buscar vacantes <i data-ico="arrow"></i></a>';
                return;
            }

            const estadoDe = estadoPostulacion;
            const cuenta = (...estados) => companies.filter(c => estados.includes(estadoDe(c))).length;

            // Resumen arriba (reemplaza las estadisticas inventadas de la izquierda)
            const resumen = `
                <div class="apps-summary">
                    <div><strong>${companies.length}</strong><span>Enviadas</span></div>
                    <div><strong>${cuenta('PENDIENTE', 'REVISADA')}</strong><span>En proceso</span></div>
                    <div><strong>${cuenta('ACEPTADA')}</strong><span>Aceptadas</span></div>
                </div>`;

            companiesContainer.innerHTML = resumen + companies.slice(0, 4).map(company => {
                const daysAgo = Math.floor((new Date() - company.appliedDate) / (1000 * 60 * 60 * 24));
                const cuando = daysAgo <= 0 ? 'Hoy' : `Hace ${daysAgo} ${daysAgo === 1 ? 'día' : 'días'}`;
                const clave = estadoDe(company);
                const estado = ESTADOS_POSTULACION[clave] || ESTADOS_POSTULACION.PENDIENTE;

                return `
                    <div class="company-item-compact">
                        <div class="company-logo-compact">${escaparHtml((company.name || '?').charAt(0))}</div>
                        <div class="company-info-compact">
                            <h3>${escaparHtml(company.job || company.name)}</h3>
                            <p>${company.job ? escaparHtml(company.name) + ' · ' : ''}${cuando}</p>
                            <p class="status-badge ${clave.toLowerCase()}"><i data-ico="${estado.ico}"></i> ${estado.texto}</p>
                        </div>
                    </div>
                `;
            }).join('') +
                // Todas, con la opcion de retirar (antes solo se veian 4 y no habia como retirar)
                `<button type="button" class="btn-view-all" onclick="verPostulaciones()">${companies.length > 4 ? `Ver las ${companies.length}` : 'Ver todas'} <i data-ico="arrow"></i></button>`;
        } else {
            companiesContainer.innerHTML = '<p class="empty-text">No se pudieron cargar tus postulaciones</p>';
        }
    } catch (error) {
        companiesContainer.innerHTML = '<p class="error-text">Error cargando tus postulaciones</p>';
    }
}



// ---- Mis postulaciones: todas, y retirar las que siguen en proceso ----

// El backend manda el estado en minusculas ("revisada") y aqui se comparaba
// con "ACEPTADA": todas salian "En revision"
const ESTADOS_POSTULACION = {
    PENDIENTE: { texto: 'Enviada',   ico: 'clock' },
    REVISADA:  { texto: 'Revisada',  ico: 'eye' },
    ACEPTADA:  { texto: 'Aceptada',  ico: 'check' },
    RECHAZADA: { texto: 'Rechazada', ico: 'close' }
};
const estadoPostulacion = c => String(c.status || 'PENDIENTE').toUpperCase();
// Se puede retirar mientras la empresa no haya decidido
const SE_PUEDE_RETIRAR = ['PENDIENTE', 'REVISADA'];
let misPostulaciones = [];
let ventanaPostulaciones = null;

// "Te postulaste hoy / ayer / hace 5 días" por días de calendario
function cuandoTePostulaste(fecha) {
    const dia = f => { const d = new Date(f); d.setHours(0, 0, 0, 0); return d; };
    const dias = Math.round((dia(new Date()) - dia(fecha)) / 86400000);
    if (dias <= 0) return 'Te postulaste hoy';
    if (dias === 1) return 'Te postulaste ayer';
    if (dias <= 30) return `Te postulaste hace ${dias} días`;
    return 'Te postulaste el ' + new Date(fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
}

function filaPostulacion(c) {
    const clave = estadoPostulacion(c);
    const estado = ESTADOS_POSTULACION[clave] || ESTADOS_POSTULACION.PENDIENTE;
    const titulo = escaparHtml(c.job || 'Vacante');
    const enlace = c.jobId ? `<a href="oportunidades.html?jobId=${encodeURIComponent(c.jobId)}">${titulo}</a>` : titulo;
    const accion = SE_PUEDE_RETIRAR.includes(clave) && c.id
        ? `<button type="button" class="btn-retirar" data-retirar="${escaparHtml(c.id)}">Retirar</button>`
        : '';
    return `
        <li class="postulacion-fila" data-id="${escaparHtml(c.id || '')}">
            <div class="postulacion-datos">
                <h3>${enlace}</h3>
                <p>${escaparHtml(c.name || 'Empresa confidencial')} · ${cuandoTePostulaste(c.appliedDate)}</p>
            </div>
            <p class="status-badge ${clave.toLowerCase()}"><i data-ico="${estado.ico}"></i> ${estado.texto}</p>
            <div class="postulacion-accion">${accion}</div>
        </li>`;
}

function verPostulaciones() {
    if (!misPostulaciones.length) return;
    ventanaPostulaciones = SkillMatchUI.ventana({
        id: 'ventanaPostulaciones',
        titulo: 'Mis postulaciones',
        icono: 'send',
        ancha: true,
        cuerpo: `<p class="postulaciones-ayuda">Puedes retirar una postulación mientras la empresa no la haya aceptado ni rechazado. Al retirarla, la empresa deja de verla.</p>
            <ul class="postulaciones-lista">${misPostulaciones.map(filaPostulacion).join('')}</ul>`
    });
    ventanaPostulaciones.cuerpo.addEventListener('click', e => {
        const boton = e.target.closest('button');
        if (!boton) return;
        const accion = boton.closest('.postulacion-accion');
        if (boton.dataset.retirar) {
            // Se confirma ahi mismo, sin ventanas del navegador
            accion.innerHTML = `<span class="retiro-pregunta">¿Retirarla?</span>
                <button type="button" class="btn-retirar confirmar" data-confirmar="${escaparHtml(boton.dataset.retirar)}">Sí, retirar</button>
                <button type="button" class="btn-retiro-no" data-no="${escaparHtml(boton.dataset.retirar)}">No</button>`;
            accion.querySelector('[data-confirmar]').focus();
        } else if (boton.dataset.no) {
            accion.innerHTML = `<button type="button" class="btn-retirar" data-retirar="${escaparHtml(boton.dataset.no)}">Retirar</button>`;
            accion.querySelector('button').focus();
        } else if (boton.dataset.confirmar) {
            retirarPostulacion(boton.dataset.confirmar, boton);
        }
    });
}

async function retirarPostulacion(id, boton) {
    boton.disabled = true;
    boton.textContent = 'Retirando…';
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/applications/${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (!response.ok) throw new Error(`El servidor respondió ${response.status}`);
        const retirada = misPostulaciones.find(c => c.id === id);
        misPostulaciones = misPostulaciones.filter(c => c.id !== id);
        const fila = boton.closest('.postulacion-fila');
        if (fila) fila.remove();
        SkillMatchUI.aviso(`Retiraste tu postulación${retirada && retirada.job ? ' a ' + escaparHtml(retirada.job) : ''}.`, 'ok');
        if (!misPostulaciones.length && ventanaPostulaciones) ventanaPostulaciones.cerrar();
        loadInterestedCompanies();
    } catch (error) {
        boton.disabled = false;
        boton.textContent = 'Sí, retirar';
        SkillMatchUI.aviso('No se pudo retirar la postulación. Intenta de nuevo.', 'error');
    }
}

// Funciones para modales
function openEditModal() {
    const user = getUserData();
    if (!user) return;

    // Cargar datos actuales
    fetchWithAuth(`${API_BASE_URL}/users/${user.id}`)
    .then(response => response.json())
    .then(data => {
        document.getElementById('editFirstName').value = data.firstName || '';
        document.getElementById('editLastName').value = data.lastName || '';
        document.getElementById('editEmail').value = data.email || '';
        document.getElementById('editPhone').value = data.phone || '';
        document.getElementById('editHeadline').value = data.headline || '';
        document.getElementById('editLocation').value = data.location || '';
        document.getElementById('editBio').value = data.bio || '';
        
        document.getElementById('editProfileModal').style.display = 'flex';
    })
    .catch(error => {
        alert('Error al cargar los datos del perfil');
    });
}

function closeEditModal() {
    document.getElementById('editProfileModal').style.display = 'none';
}

// Editores de imagen (editor-imagen.js). Se crean la primera vez que se abre
// cada ventana. Los minimos de pixeles evitan fotos que se verian borrosas:
// la foto se ve a 128 px (256 en pantallas nitidas) y la portada a ~1140 px.
let photoEditor = null, coverEditor = null, coverGallery = null;

function openPhotoModal() {
    if (!photoEditor) {
        photoEditor = SkillMatchImagen.editor(document.getElementById('photoEditor'), {
            aspecto: [1, 1], minimo: [300, 300], salida: [400, 400], redondo: true,
            nombre: 'tu foto de perfil', maxKB: 120,
            alCambiar: listo => { document.getElementById('savePhotoBtn').disabled = !listo; }
        });
    }
    photoEditor.reiniciar();
    document.getElementById('changePhotoModal').style.display = 'flex';
}

function closePhotoModal() {
    document.getElementById('changePhotoModal').style.display = 'none';
    if (photoEditor) photoEditor.reiniciar();
}

// Pestanas de la ventana de portada: "Galeria" o "Subir foto"
function showCoverTab(cual) {
    const subir = cual === 'subir';
    document.getElementById('coverTabGallery').classList.toggle('active', !subir);
    document.getElementById('coverTabGallery').setAttribute('aria-selected', String(!subir));
    document.getElementById('coverTabUpload').classList.toggle('active', subir);
    document.getElementById('coverTabUpload').setAttribute('aria-selected', String(subir));
    document.getElementById('coverGallery').hidden = subir;
    document.getElementById('coverUpload').hidden = !subir;
    updateCoverSaveButton();
}

// En "Subir foto" no se puede guardar hasta que haya una imagen valida
function updateCoverSaveButton() {
    const subir = !document.getElementById('coverUpload').hidden;
    document.getElementById('saveCoverBtn').disabled = subir && !(coverEditor && coverEditor.listo());
}

function openCoverModal() {
    if (!coverGallery) {
        coverGallery = SkillMatchImagen.galeria(document.getElementById('coverGallery'), {
            actual: currentUserProfile.coverImageUrl || 'galeria:marca'
        });
        coverEditor = SkillMatchImagen.editor(document.getElementById('coverUpload'), {
            aspecto: [4, 1], minimo: [1200, 300], salida: [1600, 400],
            nombre: 'la portada', maxKB: 320,
            alCambiar: updateCoverSaveButton
        });
        document.getElementById('coverTabGallery').addEventListener('click', () => showCoverTab('galeria'));
        document.getElementById('coverTabUpload').addEventListener('click', () => showCoverTab('subir'));
    }
    coverEditor.reiniciar();
    // Si la portada actual es una foto propia, se abre en "Subir foto"
    const actual = currentUserProfile.coverImageUrl || '';
    showCoverTab(actual && actual.indexOf('galeria:') !== 0 ? 'subir' : 'galeria');
    document.getElementById('changeCoverModal').style.display = 'flex';
}

function closeCoverModal() {
    document.getElementById('changeCoverModal').style.display = 'none';
    if (coverEditor) coverEditor.reiniciar();
}

// Pinta la portada guardada: de la galeria, una foto subida o la de siempre
function applyCover(valor) {
    const portada = document.querySelector('.profile-cover');
    if (!portada) return;
    const url = SkillMatchImagen.rutaPortada(valor);
    if (url) {
        portada.style.backgroundImage = `url("${url}")`;
        portada.style.backgroundSize = 'cover';
        portada.style.backgroundPosition = 'center';
        portada.style.backgroundBlendMode = 'normal';
    } else {
        // "galeria:marca" o vacio: se queda la portada del CSS
        portada.style.removeProperty('background-image');
        portada.style.removeProperty('background-size');
        portada.style.removeProperty('background-position');
        portada.style.removeProperty('background-blend-mode');
    }
}

// Avisos de ui.js (alert() mostraba "<i data-ico...>" como texto)
function notify(mensaje, tipo) {
    if (window.SkillMatchUI) SkillMatchUI.aviso(mensaje, tipo);
    else alert(mensaje);
}

// Actualizar perfil
async function updateProfile(formData) {
    const user = getUserData();

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/users/${user.id}`, {
            method: 'PUT',
            body: JSON.stringify(formData)
        });

        if (response.ok) {
            const data = await response.json();
            
            // Actualizar localStorage
            const existing = JSON.parse(localStorage.getItem('userData') || '{}');
            const updatedUser = {
                ...existing,
                firstName: data.user.firstName,
                lastName: data.user.lastName,
                email: data.user.email
            };
            localStorage.setItem('userData', JSON.stringify(updatedUser));
            
            alert('<i data-ico="check"></i> Perfil actualizado exitosamente');
            closeEditModal();
            loadUserProfile();
        } else {
            const error = await response.json();
            alert('<i data-ico="close"></i> Error: ' + (error.message || 'No se pudo actualizar el perfil'));
        }
    } catch (error) {
        alert('<i data-ico="close"></i> Error al actualizar el perfil');
    }
}

// Actualizar foto de perfil
async function updateProfileImage(imageUrl) {
    const user = getUserData();

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/users/${user.id}/profile-image`, {
            method: 'PUT',
            body: JSON.stringify({ imageUrl })
        });

        if (response.ok) {
            const data = await response.json();
            currentUserProfile.profileImageUrl = data.profileImageUrl;
            const nombre = `${currentUserProfile.firstName || ''} ${currentUserProfile.lastName || ''}`.trim();
            setProfileAvatar(data.profileImageUrl, nombre);
            notify('Foto de perfil actualizada');
            closePhotoModal();
            return true;
        }
        const error = await response.json().catch(() => ({}));
        notify(error.message || 'No se pudo actualizar la foto', 'error');
    } catch (error) {
        notify('Error al actualizar la foto de perfil', 'error');
    }
    return false;
}

// Actualizar portada
async function updateCoverImage(imageUrl) {
    const user = getUserData();

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/users/${user.id}/cover-image`, {
            method: 'PUT',
            body: JSON.stringify({ imageUrl })
        });

        if (response.ok) {
            const data = await response.json();
            currentUserProfile.coverImageUrl = data.coverImageUrl;
            applyCover(data.coverImageUrl);
            notify('Portada actualizada');
            closeCoverModal();
            return true;
        }
        const error = await response.json().catch(() => ({}));
        notify(error.message || 'No se pudo actualizar la portada', 'error');
    } catch (error) {
        notify('Error al actualizar la portada', 'error');
    }
    return false;
}

// Vacantes guardadas: antes se guardaban con "Guardar" pero no había dónde verlas
async function loadSavedJobsCard() {
    const tarjeta = document.getElementById('savedJobsCard');
    const lista = document.getElementById('savedJobsList');
    if (!tarjeta || !lista) return;
    // Son las de quien inició sesión, no las de la persona que se está viendo
    if (esPerfilAjeno()) { tarjeta.style.display = 'none'; return; }

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/saved-jobs/my-saved-jobs`);
        if (!response.ok) throw new Error(`El servidor respondió ${response.status}`);
        pintarGuardadas(await response.json());
    } catch (error) {
        lista.innerHTML = '<p class="empty-text">No se pudieron cargar tus vacantes guardadas</p>';
    }
}

function pintarGuardadas(guardadas) {
    const lista = document.getElementById('savedJobsList');
    const cuenta = document.getElementById('savedJobsCount');
    if (cuenta) cuenta.textContent = guardadas.length ? `(${guardadas.length})` : '';

    if (!guardadas.length) {
        lista.innerHTML = '<p class="empty-text">Aún no has guardado vacantes. Pulsa "Guardar" en las que te interesen y aquí las tienes a mano.</p>' +
            '<a href="oportunidades.html" class="btn-view-all">Buscar vacantes <i data-ico="arrow"></i></a>';
        return;
    }

    // Días de calendario: "hoy" es desde la medianoche, no las últimas 24 horas
    const dia = fecha => { const d = new Date(fecha); d.setHours(0, 0, 0, 0); return d; };
    const cuando = fecha => {
        if (!fecha) return '';
        const dias = Math.round((dia(new Date()) - dia(fecha)) / 86400000);
        return dias <= 0 ? 'Guardada hoy' : dias === 1 ? 'Guardada ayer' : `Guardada hace ${dias} días`;
    };

    // Sin el círculo con la inicial (como "Vacantes para ti"): la columna es
    // angosta y el título se partía letra por letra
    lista.innerHTML = guardadas.slice(0, 3).map(g => {
        // Si la vacante se borró, el backend no manda su id ni su título
        if (!g.jobId) {
            return `<div class="company-item-compact guardada-item">
                <div class="company-info-compact"><h3>Vacante que ya no está publicada</h3><p>${cuando(g.savedAt)}</p></div>
            </div>`;
        }
        const titulo = escaparHtml(g.jobTitle || 'Vacante');
        return `<div class="company-item-compact guardada-item">
            <div class="company-info-compact">
                <h3><a href="oportunidades.html?jobId=${encodeURIComponent(g.jobId)}">${titulo}</a></h3>
                <p>${escaparHtml(g.companyName || 'Empresa confidencial')}${g.location ? ' · ' + escaparHtml(g.location) : ''}</p>
                <p>${cuando(g.savedAt)}</p>
            </div>
            <button type="button" class="btn-quitar-guardada" data-job-id="${escaparHtml(g.jobId)}" aria-label="Quitar ${titulo} de tus guardadas" title="Quitar de guardadas"><i data-ico="close"></i></button>
        </div>`;
    }).join('') +
        `<a href="oportunidades.html?guardadas=1" class="btn-view-all">${guardadas.length > 3 ? `Ver las ${guardadas.length}` : 'Verlas en Vacantes'} <i data-ico="arrow"></i></a>`;
}

// "Quitar" de cada guardada (un solo escuchador para toda la lista)
async function quitarGuardada(boton) {
    boton.disabled = true;
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/saved-jobs/job/${encodeURIComponent(boton.dataset.jobId)}`, { method: 'DELETE' });
        if (!response.ok) throw new Error();
        if (window.SkillMatchUI) SkillMatchUI.aviso('Vacante quitada de tus guardadas.', 'ok');
        loadSavedJobsCard();
    } catch (error) {
        boton.disabled = false;
        if (window.SkillMatchUI) SkillMatchUI.aviso('No se pudo quitar la vacante. Intenta de nuevo.', 'error');
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {

    if (!isAuthenticated()) {
        window.location.href = 'login-usuario.html';
        return;
    }

    // Cargar datos del perfil
    loadUserProfile();
    loadUserSkills();
    loadUserExperiences();
    loadUserEducations();
    loadRecommendedJobs();
    loadInterestedCompanies();
    loadSavedJobsCard();
    const guardadas = document.getElementById('savedJobsList');
    if (guardadas) {
        guardadas.addEventListener('click', e => {
            const boton = e.target.closest('.btn-quitar-guardada');
            if (boton) quitarGuardada(boton);
        });
    }

    // "Cerrar sesión" lo maneja ui.js en todas las páginas (data-cerrar-sesion)

    // Cambiar contraseña: la ventana es de ui.js (la misma en el perfil de empresa)
    const changePasswordBtn = document.getElementById('changePasswordBtn');
    if (changePasswordBtn) changePasswordBtn.addEventListener('click', () => SkillMatchUI.cambiarContrasena());

    // Botón editar perfil
    const editProfileBtn = document.getElementById('editProfileBtn');
    if (editProfileBtn) {
        editProfileBtn.addEventListener('click', openEditModal);
    }

    // Botón editar portada
    const editCoverBtn = document.getElementById('editCoverBtn');
    if (editCoverBtn) {
        editCoverBtn.addEventListener('click', openCoverModal);
    }

    // Botón editar avatar
    const editAvatarBtn = document.getElementById('editAvatarBtn');
    if (editAvatarBtn) {
        editAvatarBtn.addEventListener('click', openPhotoModal);
    }

    // Form editar perfil
    const editProfileForm = document.getElementById('editProfileForm');
    if (editProfileForm) {
        editProfileForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const formData = {
                firstName: document.getElementById('editFirstName').value,
                lastName: document.getElementById('editLastName').value,
                email: document.getElementById('editEmail').value,
                phone: document.getElementById('editPhone').value,
                headline: document.getElementById('editHeadline').value,
                location: document.getElementById('editLocation').value,
                bio: document.getElementById('editBio').value
            };
            
            updateProfile(formData);
        });
    }

    // Form cambiar foto
    const changePhotoForm = document.getElementById('changePhotoForm');
    if (changePhotoForm) {
        changePhotoForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            if (!photoEditor || !photoEditor.listo()) return;
            const liberar = window.SkillMatchUI ? SkillMatchUI.ocupado(document.getElementById('savePhotoBtn')) : () => {};
            try {
                // La foto sale recortada, a 400 x 400 y comprimida (data URL)
                await updateProfileImage(await photoEditor.exportar());
            } catch (error) {
                photoEditor.error('No se pudo preparar la foto. Prueba con otra imagen.');
            } finally {
                liberar();
            }
        });
    }

    // Form cambiar portada
    const changeCoverForm = document.getElementById('changeCoverForm');
    if (changeCoverForm) {
        changeCoverForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const subir = !document.getElementById('coverUpload').hidden;
            let valor;
            if (subir) {
                if (!coverEditor || !coverEditor.listo()) return;
            } else {
                valor = coverGallery && coverGallery.valor();
                // Nada elegido, o la misma que ya tiene: no hace falta guardar
                if (!valor || valor === (currentUserProfile.coverImageUrl || 'galeria:marca')) {
                    closeCoverModal();
                    return;
                }
            }
            const liberar = window.SkillMatchUI ? SkillMatchUI.ocupado(document.getElementById('saveCoverBtn')) : () => {};
            try {
                // Foto propia: recortada a 1600 x 400 y comprimida (data URL)
                if (subir) valor = await coverEditor.exportar();
                const ok = await updateCoverImage(valor);
                if (ok && coverGallery && !subir) coverGallery.marcar(valor.slice('galeria:'.length));
            } catch (error) {
                if (coverEditor) coverEditor.error('No se pudo preparar la portada. Prueba con otra imagen.');
            } finally {
                liberar();
            }
        });
    }

    // Cerrar modales al hacer click fuera
    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    });

    // Botón agregar habilidad
    const addSkillBtn = document.getElementById('addSkillBtn');
    if (addSkillBtn) {
        addSkillBtn.addEventListener('click', openAddSkillModal);
    }

    // Form agregar skill
    const addSkillForm = document.getElementById('addSkillForm');
    if (addSkillForm) {
        addSkillForm.addEventListener('submit', addSkill);
    }

    // Botón agregar experiencia
    const addExperienceBtn = document.getElementById('addExperienceBtn');
    if (addExperienceBtn) {
        addExperienceBtn.addEventListener('click', openAddExperienceModal);
    }

    // Form agregar experiencia
    const addExperienceForm = document.getElementById('addExperienceForm');
    if (addExperienceForm) {
        addExperienceForm.addEventListener('submit', addExperience);
    }

    // Botón agregar educación
    const addEducationBtn = document.getElementById('addEducationBtn');
    if (addEducationBtn) {
        addEducationBtn.addEventListener('click', openAddEducationModal);
    }

    // Form agregar educación
    const addEducationForm = document.getElementById('addEducationForm');
    if (addEducationForm) {
        addEducationForm.addEventListener('submit', addEducation);
    }

    // Checkbox "Trabajo actual" - deshabilitar fecha fin
    const expIsCurrent = document.getElementById('expIsCurrent');
    if (expIsCurrent) {
        expIsCurrent.addEventListener('change', function() {
            document.getElementById('expEndDate').disabled = this.checked;
            if (this.checked) {
                document.getElementById('expEndDate').value = '';
            }
        });
    }

    // Checkbox "Estudio actual" - deshabilitar fecha fin
    const eduIsCurrent = document.getElementById('eduIsCurrent');
    if (eduIsCurrent) {
        eduIsCurrent.addEventListener('change', function() {
            document.getElementById('eduEndDate').disabled = this.checked;
            if (this.checked) {
                document.getElementById('eduEndDate').value = '';
            }
        });
    }

});
