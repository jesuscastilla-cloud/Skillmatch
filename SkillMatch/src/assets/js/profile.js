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
    if (userIdFromUrl) {
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
            if (user.isOtherUser) {
                hideEditButtons();
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
    
    // Ocultar botón de editar perfil
    const editProfileBtn = document.getElementById('editProfileBtn');
    if (editProfileBtn) editProfileBtn.style.display = 'none';
    
    // Ocultar sección de progreso del perfil
    const profileProgress = document.querySelector('.profile-progress');
    if (profileProgress) profileProgress.style.display = 'none';
    
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
    document.getElementById('userHeadline').textContent = user.headline || 'Usuario de SkillMatch';
    document.getElementById('userLocation').textContent = `<i data-ico="pin"></i> ${user.location || 'Cartagena, Colombia'}`;

    setProfileAvatar(user.profileImageUrl, fullName);

    // Cargar estadísticas reales del backend
    loadUserStatistics(user.id);

    // Calcular progreso del perfil
    calculateProfileProgress(user);
}

// Cargar estadísticas reales del usuario
async function loadUserStatistics(userId) {
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/users/${userId}/statistics`);

        if (response.ok) {
            const stats = await response.json();
            
            document.getElementById('profileViews').textContent = stats.profileViews || 0;
            document.getElementById('applicationsCount').textContent = stats.applicationsCount || 0;
            document.getElementById('matchRate').textContent = (stats.matchRate || 0) + '%';
            
            // Actualizar barra de progreso con el valor del backend
            const percentage = stats.profileCompleteness || 0;
            document.getElementById('profileProgress').style.width = percentage + '%';
            document.getElementById('progressPercentage').textContent = percentage;
        } else {
            document.getElementById('profileViews').textContent = '0';
            document.getElementById('applicationsCount').textContent = '0';
            document.getElementById('matchRate').textContent = '50%';
        }
    } catch (error) {
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

// Renderizar la lista de verificación
function renderProfileChecklist() {
    const checklist = document.getElementById('profileChecklist');
    if (checklist) {
        checklist.innerHTML = Object.entries(profileChecks).map(([key, value]) => 
            `<li class="${value ? 'completed' : ''}">
                ${value ? '<i data-ico="check"></i>' : '<i data-ico="bookmark"></i>'} ${key}
            </li>`
        ).join('');
    }
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
            // Habilidades por defecto si no hay en backend
            const defaultSkills = ['JavaScript', 'HTML', 'CSS', 'React'];
            displaySkills(defaultSkills.map(name => ({ name })));
        }
    } catch (error) {
        skillsContainer.innerHTML = '<p class="error-text">Error cargando habilidades</p>';
    }
}

// Mostrar habilidades con opción de eliminar
function displaySkills(skills) {
    const skillsContainer = document.getElementById('userSkills');
    
    if (!skills || skills.length === 0) {
        skillsContainer.innerHTML = '<p class="empty-text">Aún no has agregado habilidades</p>';
        updateProfileChecklist('skills', false);
        return;
    }

    skillsContainer.innerHTML = skills.map(skill => 
        `<span class="skill-tag">
            ${skill.name} 
            <span class="skill-level">${formatSkillLevel(skill.level)}</span>
            <button class="btn-remove-skill" onclick="deleteSkill('${skill.id}')" title="Eliminar"><i data-ico="close"></i></button>
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
    
    if (!confirm('¿Estás seguro de eliminar esta habilidad?')) {
        return;
    }
    

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
    
    if (!experiences || experiences.length === 0) {
        container.innerHTML = '<p class="empty-text">Aún no has agregado experiencia laboral</p>';
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
                        <h3>${exp.position}</h3>
                        <button class="btn-delete-item" onclick="deleteExperience('${exp.id}')" title="Eliminar"><i data-ico="trash"></i></button>
                    </div>
                    <p class="company">${exp.company}</p>
                    <p class="timeline">${startDate} - ${endDate}${exp.location ? ' | ' + exp.location : ''}</p>
                    ${exp.description ? `<p class="description">${exp.description}</p>` : ''}
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
    
    if (!confirm('¿Estás seguro de eliminar esta experiencia?')) {
        return;
    }
    
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
    
    if (!educations || educations.length === 0) {
        container.innerHTML = '<p class="empty-text">Aún no has agregado información educativa</p>';
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
                        <h3>${edu.degree}</h3>
                        <button class="btn-delete-item" onclick="deleteEducation('${edu.id}')" title="Eliminar"><i data-ico="trash"></i></button>
                    </div>
                    <p class="school">${edu.school}</p>
                    <p class="timeline">${startDate} - ${endDate}${edu.fieldOfStudy ? ' | ' + edu.fieldOfStudy : ''}</p>
                    ${edu.description ? `<p class="description">${edu.description}</p>` : ''}
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
    
    if (!confirm('¿Estás seguro de eliminar esta educación?')) {
        return;
    }
    
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

// Cargar oportunidades recomendadas
async function loadRecommendedJobs() {
    const user = getUserData();
    if (!user) return;

    const jobsContainer = document.getElementById('recommendedJobs');

    try {
        // Obtener trabajos recientes del backend
        const response = await fetchWithAuth(`${API_BASE_URL}/jobs/recent`);

        if (response.ok) {
            let jobs = await response.json();
            
            // Limitar a 5 trabajos y calcular matchScore simulado
            jobs = jobs.slice(0, 5).map(job => ({
                ...job,
                matchScore: Math.floor(Math.random() * 20) + 80 // 80-100%
            }));
            
            displayRecommendedJobs(jobs);
        } else {
            jobsContainer.innerHTML = '<p class="empty-text">No hay oportunidades disponibles en este momento</p>';
        }
    } catch (error) {
        jobsContainer.innerHTML = '<p class="error-text">Error cargando oportunidades</p>';
    }
}

// Mostrar oportunidades recomendadas
function displayRecommendedJobs(jobs) {
    const jobsContainer = document.getElementById('recommendedJobs');
    
    if (!jobs || jobs.length === 0) {
        jobsContainer.innerHTML = '<p class="empty-text">No hay oportunidades disponibles</p>';
        return;
    }

    jobsContainer.innerHTML = jobs.map(job => `
        <div class="opportunity-item-compact">
            <div class="opportunity-header-compact">
                <h4>${job.title}</h4>
                <span class="match-badge-small ${getMatchClass(job.matchScore)}">${job.matchScore}%</span>
            </div>
            <p class="opportunity-company-compact">${job.company?.name || job.companyName || ''}</p>
            <p class="opportunity-location-compact"><i data-ico="pin"></i> ${job.location}</p>
            <button class="btn-apply-compact" onclick="applyToJob('${job.id}')">Aplicar Ahora</button>
        </div>
    `).join('');
}

// Obtener clase de match
function getMatchClass(score) {
    if (score >= 90) return 'match-excellent';
    if (score >= 80) return 'match-good';
    return 'match-fair';
}

// Aplicar a oportunidad
async function applyToJob(jobId) {
    const user = getUserData();
    if (!user) return;

    if (!confirm('¿Deseas aplicar a esta oportunidad?')) {
        return;
    }

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/applications`, {
            method: 'POST',
            body: JSON.stringify({
                jobId: jobId,
                coverLetter: 'Aplicación desde el perfil de usuario'
            })
        });

        if (response.ok) {
            alert('¡Aplicación enviada exitosamente! La empresa revisará tu perfil pronto.');
            // Recargar estadísticas para actualizar el contador
            loadUserStatistics(user.id);
        } else {
            const error = await response.json();
            alert(error.message || 'Ya has aplicado a esta oferta o ocurrió un error');
        }
    } catch (error) {
        alert('Error al enviar la aplicación. Intenta nuevamente.');
    }
}

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
                            name: app.companyName,
                            appliedDate: new Date(app.appliedDate),
                            status: app.status
                        });
                    }
                }
            });

            const companies = Array.from(companiesMap.values())
                .sort((a, b) => b.appliedDate - a.appliedDate)
                .slice(0, 5);

            if (companies.length === 0) {
                companiesContainer.innerHTML = '<p class="empty-text">Aún no has aplicado a ninguna empresa</p>';
                return;
            }

            companiesContainer.innerHTML = companies.map(company => {
                const daysAgo = Math.floor((new Date() - company.appliedDate) / (1000 * 60 * 60 * 24));
                const statusText = company.status === 'ACEPTADA' ? '<i data-ico="check"></i> Aceptada' : 
                                  company.status === 'RECHAZADA' ? '<i data-ico="close"></i> Rechazada' : 
                                  '<i data-ico="clock"></i> En revisión';
                
                return `
                    <div class="company-item-compact">
                        <div class="company-logo-compact"><i data-ico="building"></i></div>
                        <div class="company-info-compact">
                            <h4>${company.name}</h4>
                            <p>Aplicaste hace ${daysAgo} ${daysAgo === 1 ? 'día' : 'días'}</p>
                            <p class="status-badge">${statusText}</p>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            companiesContainer.innerHTML = '<p class="empty-text">No se pudieron cargar las empresas</p>';
        }
    } catch (error) {
        companiesContainer.innerHTML = '<p class="error-text">Error cargando empresas</p>';
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

function openPhotoModal() {
    document.getElementById('changePhotoModal').style.display = 'flex';
}

function closePhotoModal() {
    document.getElementById('changePhotoModal').style.display = 'none';
}

function openCoverModal() {
    document.getElementById('changeCoverModal').style.display = 'flex';
}

function closeCoverModal() {
    document.getElementById('changeCoverModal').style.display = 'none';
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
            const user = getUserData();
            setProfileAvatar(data.profileImageUrl, `${user.firstName} ${user.lastName}`);
            alert('<i data-ico="check"></i> Foto de perfil actualizada exitosamente');
            closePhotoModal();
        } else {
            const error = await response.json();
            alert('<i data-ico="close"></i> Error: ' + (error.message || 'No se pudo actualizar la foto'));
        }
    } catch (error) {
        alert('<i data-ico="close"></i> Error al actualizar la foto de perfil');
    }
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
            document.querySelector('.profile-cover').style.backgroundImage = `url(${data.coverImageUrl})`;
            document.querySelector('.profile-cover').style.backgroundSize = 'cover';
            document.querySelector('.profile-cover').style.backgroundPosition = 'center';
            alert('<i data-ico="check"></i> Portada actualizada exitosamente');
            closeCoverModal();
        } else {
            const error = await response.json();
            alert('<i data-ico="close"></i> Error: ' + (error.message || 'No se pudo actualizar la portada'));
        }
    } catch (error) {
        alert('<i data-ico="close"></i> Error al actualizar la portada');
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

    // Botón cerrar sesión
    const logoutBtns = document.querySelectorAll('a[href*="login"], .btn-login');
    logoutBtns.forEach(btn => {
        if (btn.textContent.includes('Cerrar Sesión') || btn.textContent.includes('Cerrar sesión')) {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
                    logout();
                }
            });
        }
    });

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
        changePhotoForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const imageUrl = document.getElementById('photoUrl').value;
            updateProfileImage(imageUrl);
        });
    }

    // Form cambiar portada
    const changeCoverForm = document.getElementById('changeCoverForm');
    if (changeCoverForm) {
        changeCoverForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const imageUrl = document.getElementById('coverUrl').value;
            updateCoverImage(imageUrl);
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
