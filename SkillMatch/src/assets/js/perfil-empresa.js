// SkillMatch - Perfil de Empresa
// Script para funcionalidad completa de la página

let currentOffers = [];
let currentCompanyData = {};

function sanitize(text) {
    // Tambien escapa comillas (sirve dentro de atributos); ver api-config.js
    return escaparHtml(text);
}

document.addEventListener('DOMContentLoaded', function() {
    if (!isAuthenticated()) {
        window.location.href = 'login-empresa.html';
        return;
    }
    loadCompanyData();
    setupEventListeners();
    loadOffers();
    loadActivityStats();
});

// Tamano de la empresa tal como lo guarda el registro
const TAMANOS_EMPRESA = {
    micro: '1 a 10 personas', small: '11 a 50 personas', pequena: '11 a 50 personas',
    medium: '51 a 200 personas', mediana: '51 a 200 personas',
    large: 'Más de 200 personas', grande: 'Más de 200 personas'
};

// Iniciales de la empresa (antes salia "ST" para todas: un servicio externo
// con el nombre fijo "Soluciones Tech")
function companyInitials(nombre) {
    return String(nombre || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

// Cargar datos de la empresa: todo sale del backend; lo que no existe no se muestra
function loadCompanyData() {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');

    if (!localStorage.getItem('userData')) {
        alert('Debes iniciar sesión para ver esta página');
        window.location.href = 'login-empresa.html';
        return;
    }

    // Validar que exista companyId
    if (!userData.companyId) {
        alert('Tu cuenta no tiene una empresa asociada.\n\nPor favor contacta al administrador o cierra sesión e inicia sesión nuevamente.');
        return;
    }

    currentCompanyData = userData;
    pintarCabecera({ name: userData.firstName });

    fetchWithAuth(`${API_BASE_URL}/companies/${userData.companyId}`)
    .then(response => {
        if (!response.ok) throw new Error('Empresa no encontrada');
        return response.json();
    })
    .then(company => {
        currentCompanyData = { ...userData, ...company };
        pintarCabecera(company);

        // "Acerca de"
        const aboutElement = document.getElementById('companyAbout');
        if (aboutElement) {
            const p = document.createElement('p');
            p.textContent = company.description ||
                'Aún no has agregado una descripción. Usa el lápiz para contar qué hace tu empresa.';
            if (!company.description) p.className = 'empty-text';
            aboutElement.replaceChildren(p);
        }

        // Beneficios: solo si la empresa los guardo (texto separado por comas o lineas)
        const lista = String(company.benefits || '').split(/[\n,;]+/).map(b => b.trim()).filter(Boolean);
        const tarjeta = document.getElementById('companyBenefitsCard');
        if (tarjeta && lista.length) {
            const ul = document.getElementById('companyBenefits');
            ul.replaceChildren(...lista.map(b => { const li = document.createElement('li'); li.textContent = b; return li; }));
            tarjeta.hidden = false;
        }
    })
    .catch(() => {
        const aboutElement = document.getElementById('companyAbout');
        if (aboutElement) aboutElement.innerHTML = '<p class="error-text">No se pudo cargar la información de la empresa.</p>';
    });
}

// Nombre, logo, sector y datos de la cabecera
function pintarCabecera(company) {
    const nombre = company.name || 'Mi empresa';
    document.getElementById('companyName').textContent = nombre;
    document.title = nombre + ' - SkillMatch Cartagena';

    const logo = document.getElementById('companyLogo');
    if (logo) {
        if (company.logo) {
            const img = document.createElement('img');
            img.src = company.logo;
            img.alt = '';
            logo.replaceChildren(img);
        } else {
            logo.textContent = companyInitials(nombre);
        }
    }

    const industria = document.getElementById('companyIndustry');
    if (industria) industria.textContent = company.industry || '';

    const meta = document.getElementById('companyMeta');
    if (!meta) return;
    const datos = [];
    if (company.location) datos.push(['pin', company.location]);
    if (company.size) datos.push(['users', TAMANOS_EMPRESA[String(company.size).toLowerCase()] || company.size]);
    if (company.foundedYear) datos.push(['calendar', 'Desde ' + company.foundedYear]);
    meta.replaceChildren(...datos.map(([ico, texto]) => {
        const span = document.createElement('span');
        span.className = 'meta-tag';
        span.innerHTML = `<i data-ico="${ico}"></i> `;
        span.append(texto);
        return span;
    }));
    if (company.website) {
        const a = document.createElement('a');
        a.className = 'meta-tag';
        a.href = /^https?:\/\//.test(company.website) ? company.website : 'https://' + company.website;
        a.target = '_blank';
        a.rel = 'noopener';
        a.innerHTML = '<i data-ico="globe"></i> ';
        a.append(company.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''));
        meta.append(a);
    }
    if (company.isVerified) {
        const v = document.createElement('span');
        v.className = 'meta-tag es-verificada';
        v.innerHTML = '<i data-ico="check"></i> Empresa verificada';
        meta.append(v);
    }
}

// Resumen de actividad con las cifras reales del backend. Antes:
// "Contrataciones exitosas" mostraba las ofertas activas y "Miembros del
// equipo" las postulaciones pendientes.
function loadActivityStats() {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    if (!userData.companyId) return;

    const poner = (id, valor) => { const el = document.getElementById(id); if (el) el.textContent = valor; };
    fetchWithAuth(`${API_BASE_URL}/companies/${userData.companyId}/statistics`)
    .then(response => {
        if (!response.ok) throw new Error('Error al cargar estadísticas');
        return response.json();
    })
    .then(stats => {
        poner('statOfertasActivas', stats.activeJobs || 0);
        poner('statPostulaciones', stats.totalApplications || 0);
        poner('statPorRevisar', stats.pendingApplications || 0);
        // Postulaciones que ya tienen respuesta (aceptadas, revisadas o rechazadas)
        poner('statRespuesta', stats.totalApplications ? Math.round(stats.responseRate || 0) + ' %' : '–');
    })
    .catch(() => {
        ['statOfertasActivas', 'statPostulaciones', 'statPorRevisar', 'statRespuesta'].forEach(id => poner(id, '–'));
    });
}

// Cargar ofertas desde backend
function loadOffers() {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');

    if (!userData.companyId) {
        const savedOffers = JSON.parse(localStorage.getItem('companyOffers') || '[]');
        currentOffers = savedOffers;
        if (savedOffers.length > 0) {
            renderOffers(savedOffers);
        }
        return;
    }

    // Cargar desde backend
    fetchWithAuth(`${API_BASE_URL}/jobs/company/${userData.companyId}`)
    .then(response => {
        if (!response.ok) throw new Error('Error al cargar ofertas');
        return response.json();
    })
    .then(async data => {
        // Transformar datos del backend al formato del frontend

        // Obtener el conteo de candidatos para cada oferta
        const offersWithCandidates = await Promise.all(data.map(async job => {
            let candidateCount = 0;
            try {
                const countResponse = await fetchWithAuth(`${API_BASE_URL}/applications/job/${job.id}/count`);
                if (countResponse.ok) {
                    candidateCount = await countResponse.json();
                }
            } catch (error) {
            }
            
            // Tipo: el backend lo manda en minuscula y a veces con tilde ("práctica");
            // la clase pinta el color de la etiqueta
            const tipo = String(job.type || 'empleo').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
            const TIPOS = { empleo: ['employment', 'Empleo'], practica: ['practice', 'Práctica'], freelance: ['freelance', 'Freelance'] };
            const [claseTipo, nombreTipo] = TIPOS[tipo] || ['employment', job.type || 'Empleo'];
            // La fecha esta en postedDate; createdAt llega vacio y salia "31/12/1969"
            const fecha = job.postedDate || job.createdAt;
            return {
                id: job.id,
                title: job.title,
                type: claseTipo,
                typeLabel: nombreTipo,
                description: job.description,
                salary: job.salaryRange,
                location: job.location,
                publishDate: fecha ? new Date(fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Sin fecha',
                candidates: candidateCount,
                status: (job.status?.toLowerCase() === 'abierta' || job.active) ? 'active' : 'archived'
            };
        }));
        
        currentOffers = offersWithCandidates;
        renderOffers(currentOffers);
    })
    .catch(error => {
        // Fallback a localStorage
        const savedOffers = JSON.parse(localStorage.getItem('companyOffers') || '[]');
        currentOffers = savedOffers;
        if (savedOffers.length > 0) {
            renderOffers(savedOffers);
        } else {
            const lista = document.getElementById('offersList');
            if (lista) lista.innerHTML = '<p class="error-text">No se pudieron cargar las ofertas.</p>';
        }
    });
}

// Renderizar ofertas
function renderOffers(offers) {
    const offersList = document.getElementById('offersList');
    if (!offersList) return;
    
    if (offers.length === 0) {
        offersList.innerHTML = '<div class="empty-state"><p>Aún no has publicado ofertas.</p><button type="button" class="btn btn-primary" onclick="openNewOfferModal()"><i data-ico="plus"></i> Publicar mi primera oferta</button></div>';
        return;
    }
    
    offersList.innerHTML = offers.map((offer, index) => {
        const offerId = offer.id || index;
        return `
        <div class="offer-card" data-offer-id="${offerId}">
            <div class="offer-card-header">
                <div class="offer-title-section">
                    <h3>${sanitize(offer.title)}</h3>
                    <span class="offer-type-badge ${offer.type}">${offer.typeLabel}</span>
                </div>
                <button class="offer-menu-btn" onclick="showOfferMenu('${offerId}')" title="Opciones">⋮</button>
            </div>
            <div class="offer-card-info">
                <div class="offer-info-row">
                    <span class="info-label">Candidatos:</span>
                    <span class="info-value">${offer.candidates || 0} interesados</span>
                </div>
                <div class="offer-info-row">
                    <span class="info-label">Publicado:</span>
                    <span class="info-value">${offer.publishDate || 'Hoy'}</span>
                </div>
                <div class="offer-info-row">
                    <span class="info-label">Estado:</span>
                    <span class="status-badge ${offer.status === 'active' ? 'active' : 'inactive'}">${offer.status === 'active' ? 'Activa' : 'Archivada'}</span>
                </div>
            </div>
            <div class="offer-card-actions">
                <button class="btn-offer-action primary" onclick="viewOfferCandidates('${offerId}')">Ver candidatos</button>
                <button class="btn-offer-action" onclick="editOffer('${offerId}')">Editar</button>
                <button class="btn-offer-action ${offer.status === 'active' ? '' : 'success'}" onclick="toggleOfferStatus('${offerId}')">
                    ${offer.status === 'active' ? 'Archivar' : 'Reabrir'}
                </button>
            </div>
        </div>
    `;
    }).join('');
}

// ========================================
// EVENT LISTENERS
// ========================================

function setupEventListeners() {
    
    // "Cerrar sesión" (#btnCerrarSesion) lo maneja ui.js en todas las páginas
    // (data-cerrar-sesion): avisa al backend y borra todo lo guardado

    // (Portada, logo y datos de la empresa ya no se editan aqui: el backend solo
    // deja a la empresa cambiar su descripcion y esos botones guardaban en el
    // navegador, sin llegar al servidor)

    // Botón Editar "Acerca de"
    const btnEditAbout = document.getElementById('btnEditAbout');
    if (btnEditAbout) {
        btnEditAbout.addEventListener('click', openEditAboutModal);
    }
    
    // Botón Nueva Oferta
    const btnNewOffer = document.getElementById('btnNewOffer');
    if (btnNewOffer) {
        btnNewOffer.addEventListener('click', () => openNewOfferModal());
    }
}

// ========================================
// FUNCIONES DE OFERTAS
// ========================================

function showOfferMenu(offerId) {
    if (confirm('¿Deseas eliminar esta oferta?')) {
        deleteOffer(offerId);
    }
}

function deleteOffer(offerId) {

    // Eliminar en backend
    fetchWithAuth(`${API_BASE_URL}/jobs/${offerId}`, { method: 'DELETE' })
    .then(response => {
        if (!response.ok) throw new Error('Error al eliminar oferta');
        return response.json();
    })
    .then(data => {
        currentOffers = currentOffers.filter((offer, index) => (offer.id || index) !== offerId);
        localStorage.setItem('companyOffers', JSON.stringify(currentOffers));
        renderOffers(currentOffers);
        showNotification('Oferta eliminada correctamente');
    })
    .catch(error => {
        // Fallback: eliminar solo de localStorage
        currentOffers = currentOffers.filter((offer, index) => (offer.id || index) !== offerId);
        localStorage.setItem('companyOffers', JSON.stringify(currentOffers));
        renderOffers(currentOffers);
        showNotification('Oferta eliminada localmente');
    });
}

function viewOfferCandidates(offerId) {
    const offer = currentOffers.find((o, i) => (o.id || i) === offerId);
    if (offer) {
        showCandidatesModal(offer);
    }
}

function editOffer(offerId) {
    const offer = currentOffers.find((o, i) => (o.id || i) === offerId);
    if (offer) {
        openNewOfferModal(offer, offerId);
    }
}

function toggleOfferStatus(offerId) {
    const offerIndex = currentOffers.findIndex((o, i) => (o.id || i) === offerId);
    if (offerIndex === -1) return;

    const currentStatus = currentOffers[offerIndex].status;
    const backendStatus = currentStatus === 'active' ? 'CERRADA' : 'ABIERTA';
    const newLocalStatus = currentStatus === 'active' ? 'archived' : 'active';

    fetchWithAuth(`${API_BASE_URL}/jobs/${offerId}/status?status=${backendStatus}`, { method: 'PATCH' })
    .then(async response => {
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.message || `Error ${response.status}`);
        }
        return response.json();
    })
    .then(() => {
        currentOffers[offerIndex].status = newLocalStatus;
        localStorage.setItem('companyOffers', JSON.stringify(currentOffers));
        renderOffers(currentOffers);
        showNotification(newLocalStatus === 'active' ? 'Oferta reabierta' : 'Oferta archivada');
    })
    .catch(error => {
        alert('Error al cambiar el estado de la oferta: ' + error.message);
    });
}

// ========================================
// MODALES
// ========================================

function openEditAboutModal() {
    const aboutElement = document.getElementById('companyAbout');
    const aboutText = aboutElement?.querySelector('p')?.textContent || '';
    
    createModal('Editar "Acerca de nosotros"', `
        <div class="form-group">
            <label for="editAboutText">Descripción de la empresa</label>
            <textarea id="editAboutText" rows="6" style="width:100%;padding:0.8rem;border:1px solid #e4e6e9;border-radius:8px;font-family:inherit;">${aboutText}</textarea>
            <small>Describe tu empresa, misión, visión y valores</small>
        </div>
    `, () => {
        const newText = document.getElementById('editAboutText').value.trim();
        if (!newText) {
            alert('La descripción no puede estar vacía');
            return;
        }
        
        const userData = JSON.parse(localStorage.getItem('userData') || '{}');

        if (!userData.companyId) {
            alert('Error: No se encontró información de sesión');
            return;
        }
        
        // Actualizar en el backend con PATCH para actualización parcial
        fetchWithAuth(`${API_BASE_URL}/companies/${userData.companyId}/description`, {
            method: 'PATCH',
            body: JSON.stringify({
                description: newText
            })
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => {
                    throw new Error(err.message || 'Error al actualizar descripción');
                });
            }
            return response.json();
        })
        .then(data => {
            
            // Actualizar UI
            const aboutElement = document.getElementById('companyAbout');
            if (aboutElement) {
                const p = document.createElement('p');
                p.textContent = newText;
                aboutElement.replaceChildren(p);
            }
            
            // Actualizar datos locales
            currentCompanyData.description = newText;
            
            showNotification('Descripción actualizada correctamente');
            closeModal();
        })
        .catch(error => {
            alert(`Error al guardar la descripción: ${error.message}`);
        });
    });
}

function openNewOfferModal(existingOffer = null, offerId = null) {
    const isEdit = existingOffer !== null;
    
    createModal(isEdit ? 'Editar oferta' : 'Nueva oferta', `
        <div class="form-group">
            <label for="offerTitle">Título de la oferta *</label>
            <input type="text" id="offerTitle" placeholder="ej. Desarrollador Frontend Senior" value="${sanitize(existingOffer?.title)}" required>
        </div>
        <div class="form-group">
            <label for="offerType">Tipo de oferta *</label>
            <select id="offerType" required>
                <option value="practice" ${existingOffer?.type === 'practice' ? 'selected' : ''}>Práctica</option>
                <option value="employment" ${existingOffer?.type === 'employment' ? 'selected' : ''}>Empleo</option>
                <option value="freelance" ${existingOffer?.type === 'freelance' ? 'selected' : ''}>Freelance</option>
            </select>
        </div>
        <div class="form-group">
            <label for="offerDescription">Descripción *</label>
            <textarea id="offerDescription" rows="4" placeholder="Describe las responsabilidades y requisitos..." required>${sanitize(existingOffer?.description)}</textarea>
        </div>
        <div class="form-group">
            <label for="offerSalary">Rango salarial (opcional)</label>
            <input type="text" id="offerSalary" placeholder="ej. $2M - $3M / mes" value="${sanitize(existingOffer?.salary)}">
        </div>
        <div class="form-group">
            <label for="offerLocation">Ubicación *</label>
            <input type="text" id="offerLocation" placeholder="ej. Cartagena de Indias" value="${sanitize(existingOffer?.location || 'Cartagena de Indias')}" required>
        </div>
    `, () => {
        const title = document.getElementById('offerTitle').value;
        const type = document.getElementById('offerType').value;
        const description = document.getElementById('offerDescription').value;
        const salary = document.getElementById('offerSalary').value;
        const location = document.getElementById('offerLocation').value;
        
        if (!title || !type || !description || !location) {
            alert('Por favor completa todos los campos obligatorios (*)');
            return;
        }
        
        const typeLabels = { practice: 'práctica', employment: 'empleo', freelance: 'freelance' };
        const userData = JSON.parse(localStorage.getItem('userData') || '{}');
        
        // Preparar datos para el backend
        
        if (!userData.companyId) {
            alert('No se encontró el identificador de la empresa.\n\nPor favor, cierra sesión e inicia sesión nuevamente para sincronizar tus datos.');
            return;
        }

        const backendData = {
            companyId: userData.companyId,
            title,
            description,
            type: typeLabels[type],
            location,
            modality: 'híbrido',
            experienceLevel: 'junior' // Valor por defecto si no se especifica
        };
        
        // Agregar salario si existe
        if (salary) {
            const salaryMatch = salary.match(/\$?([\d.,]+)\s*-?\s*\$?([\d.,]+)?/);
            if (salaryMatch) {
                backendData.salaryMin = parseFloat(salaryMatch[1].replace(/[.,]/g, '')) || 0;
                backendData.salaryMax = salaryMatch[2] ? parseFloat(salaryMatch[2].replace(/[.,]/g, '')) : backendData.salaryMin;
            }
        }
        
        // Determinar endpoint y método
        const url = isEdit ? `${API_BASE_URL}/jobs/${offerId}` : `${API_BASE_URL}/jobs`;
        const method = isEdit ? 'PUT' : 'POST';
        
        
        // Guardar en backend
        fetchWithAuth(url, {
            method: method,
            body: JSON.stringify(backendData)
        })
        .then(async response => {
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Error desconocido' }));
                throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            
            // Actualizar lista local
            const offerData = {
                id: data.id,
                title: data.title,
                type: data.type?.toLowerCase() || 'employment',
                typeLabel: data.type || 'Empleo',
                description: data.description,
                salary: data.salaryRange,
                location: data.location,
                publishDate: new Date(data.createdAt).toLocaleDateString('es-ES'),
                candidates: 0,
                status: 'active'
            };
            
            if (isEdit) {
                const index = currentOffers.findIndex((o, i) => (o.id || i) === offerId);
                if (index !== -1) {
                    currentOffers[index] = offerData;
                }
            } else {
                currentOffers.unshift(offerData);
            }
            
            localStorage.setItem('companyOffers', JSON.stringify(currentOffers));
            renderOffers(currentOffers);
            showNotification(isEdit ? 'Oferta actualizada en la base de datos' : 'Oferta publicada en la base de datos');
            closeModal();
        })
        .catch(error => {
            alert('Error al guardar la oferta:\n\n' + error.message + '\n\nRevisa la consola (F12) para más detalles.');
        });
    });
}

async function showCandidatesModal(offer) {

    // Mostrar modal con loading
    const modal = createModal(`Candidatos para: ${sanitize(offer.title)}`, `
        <div style="text-align:center;padding:2rem;">
            <p>Cargando candidatos...</p>
        </div>
    `);
    
    // Ocultar botones de acción mientras carga
    const modalActions = modal.querySelector('.modal-actions');
    if (modalActions) modalActions.style.display = 'none';
    
    try {
        // Obtener aplicaciones para esta oferta
        const response = await fetchWithAuth(`${API_BASE_URL}/applications/job/${offer.id}`);
        
        if (!response.ok) {
            throw new Error('Error al cargar candidatos');
        }
        
        const applications = await response.json();
        
        // Generar contenido del modal
        let content = '';
        
        if (applications.length === 0) {
            content = `
                <div style="text-align:center;padding:2rem;">
                    <p style="color:#65676b;font-size:1.1rem;">No hay candidatos para esta oferta todavía.</p>
                </div>
            `;
        } else {
            content = `
                <div style="max-height:500px;overflow-y:auto;">
                    <p style="margin-bottom:1.5rem;color:#65676b;">
                        <strong>${applications.length}</strong> candidato${applications.length !== 1 ? 's' : ''} ha${applications.length !== 1 ? 'n' : ''} aplicado a esta oferta.
                    </p>
                    ${applications.map(app => createCandidateCard(app, offer.id)).join('')}
                </div>
            `;
        }
        
        // Actualizar contenido del modal
        const modalBody = modal.querySelector('.modal-body');
        if (modalBody) {
            modalBody.innerHTML = content;
        }
        
        // Mostrar botón de cerrar
        if (modalActions) {
            modalActions.style.display = 'flex';
            modalActions.innerHTML = '<button class="btn-secondary-modal" onclick="closeModal()">Cerrar</button>';
        }
        
    } catch (error) {
        const modalBody = modal.querySelector('.modal-body');
        if (modalBody) {
            modalBody.innerHTML = `
                <div style="text-align:center;padding:2rem;">
                    <p style="color:#dc3545;">Error al cargar los candidatos. Por favor, intenta de nuevo.</p>
                </div>
            `;
        }
        
        // Mostrar botón de cerrar
        if (modalActions) {
            modalActions.style.display = 'flex';
            modalActions.innerHTML = '<button class="btn-secondary-modal" onclick="closeModal()">Cerrar</button>';
        }
    }
}

function createCandidateCard(application, offerId) {
    const appliedDate = new Date(application.appliedDate).toLocaleDateString('es-ES', {
        day: 'numeric', month: 'long', year: 'numeric'
    });

    const statusConfig = {
        'pendiente': { color: '#b45309', bg: '#fef3c7', border: '#fcd34d', label: 'Pendiente' },
        'revisada':  { color: '#0369a1', bg: '#e0f2fe', border: '#7dd3fc', label: 'Revisada'  },
        'aceptada':  { color: '#166534', bg: '#dcfce7', border: '#86efac', label: 'Aceptada'  },
        'rechazada': { color: '#991b1b', bg: '#fee2e2', border: '#fca5a5', label: 'Rechazada' }
    };

    const status = application.status?.toLowerCase() || 'pendiente';
    const sc = statusConfig[status] || statusConfig['pendiente'];

    const name = sanitize(application.userName) || 'Candidato';
    const initials = name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
    const avatarColors = ['#0369a1','#0891b2','#0d9488','#059669','#7c3aed','#9333ea','#c026d3'];
    const avatarBg = avatarColors[name.charCodeAt(0) % avatarColors.length];

    const avatarHtml = application.userProfileImageUrl
        ? `<img src="${sanitize(application.userProfileImageUrl)}"
                alt="${name}"
                onerror="this.outerHTML=this.nextElementSibling.outerHTML;this.nextElementSibling.style.display='flex';"
                style="width:64px;height:64px;border-radius:50%;object-fit:cover;display:block;">
           <div style="display:none;width:64px;height:64px;border-radius:50%;background:${avatarBg};color:white;font-size:1.4rem;font-weight:700;align-items:center;justify-content:center;">${initials}</div>`
        : `<div style="width:64px;height:64px;border-radius:50%;background:${avatarBg};color:white;font-size:1.4rem;font-weight:700;display:flex;align-items:center;justify-content:center;">${initials}</div>`;

    const infoRow = (icon, label, value, isLink = false) => {
        if (!value) return '';
        const content = isLink
            ? `<a href="mailto:${value}" style="color:#0369a1;text-decoration:none;font-weight:500;">${sanitize(value)}</a>`
            : `<span style="color:#374151;">${sanitize(value)}</span>`;
        return `
            <div style="display:flex;align-items:center;gap:0.5rem;padding:0.4rem 0;">
                <span style="font-size:0.95rem;width:1.1rem;text-align:center;flex-shrink:0;">${icon}</span>
                <span style="font-size:0.8rem;color:#6b7280;font-weight:600;min-width:4.5rem;">${label}</span>
                <span style="font-size:0.875rem;">${content}</span>
            </div>`;
    };

    return `
        <div style="border:1px solid #e5e7eb;border-radius:14px;background:white;overflow:hidden;margin-bottom:1rem;box-shadow:0 1px 4px rgba(0,0,0,0.06);">

            <!-- Header con avatar y datos principales -->
            <div style="display:flex;align-items:flex-start;gap:1.25rem;padding:1.5rem 1.5rem 1.25rem;">
                <div style="flex-shrink:0;">${avatarHtml}</div>
                <div style="flex:1;min-width:0;">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap;">
                        <div>
                            <h4 style="margin:0 0 0.2rem 0;color:#111827;font-size:1.1rem;font-weight:700;line-height:1.3;">${name}</h4>
                            <p style="margin:0;color:#6b7280;font-size:0.875rem;font-weight:500;">${sanitize(application.userHeadline) || 'Profesional'}</p>
                        </div>
                        <span style="flex-shrink:0;display:inline-flex;align-items:center;padding:0.3rem 0.85rem;border-radius:999px;font-size:0.78rem;font-weight:700;letter-spacing:0.03em;color:${sc.color};background:${sc.bg};border:1px solid ${sc.border};">
                            ${sc.label}
                        </span>
                    </div>

                    <!-- Info de contacto -->
                    <div style="margin-top:0.9rem;border-top:1px solid #f3f4f6;padding-top:0.75rem;">
                        ${infoRow('<i data-ico="mail"></i>', 'Email', application.userEmail, true)}
                        ${infoRow('<i data-ico="phone"></i>', 'Teléfono', application.userPhone)}
                        ${infoRow('⊙', 'Ubicación', application.userLocation)}
                        <div style="display:flex;align-items:center;gap:0.5rem;padding:0.4rem 0;">
                            <span style="font-size:0.95rem;width:1.1rem;text-align:center;flex-shrink:0;"><i data-ico="clock"></i></span>
                            <span style="font-size:0.8rem;color:#9ca3af;">Aplicó el ${appliedDate}</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Carta de presentación -->
            ${application.coverLetter ? `
                <div style="margin:0 1.5rem 1.25rem;background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;padding:1rem;">
                    <p style="margin:0 0 0.5rem 0;color:#374151;font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;">Carta de presentación</p>
                    <p style="margin:0;color:#4b5563;font-size:0.875rem;line-height:1.7;">${sanitize(application.coverLetter)}</p>
                </div>
            ` : ''}

            <!-- Acciones -->
            <div style="display:flex;gap:0.6rem;flex-wrap:wrap;padding:1rem 1.5rem;background:#f9fafb;border-top:1px solid #f3f4f6;">
                <button onclick="viewCandidateProfile('${application.userId}')"
                        style="display:inline-flex;align-items:center;gap:0.4rem;padding:0.5rem 1rem;background:#1e3a5f;color:white;border:none;border-radius:8px;cursor:pointer;font-size:0.85rem;font-weight:600;">
                    Ver perfil
                </button>
                <!-- Nombre y correo en data-: dentro del onclick una comilla en el nombre ejecutaba codigo -->
                <button data-email="${escaparHtml(application.userEmail)}" data-nombre="${escaparHtml(application.userName)}" onclick="contactCandidateByEmail(this.dataset.email, this.dataset.nombre)"
                        style="display:inline-flex;align-items:center;gap:0.4rem;padding:0.5rem 1rem;background:white;color:#0369a1;border:1.5px solid #bfdbfe;border-radius:8px;cursor:pointer;font-size:0.85rem;font-weight:600;">
                    Contactar
                </button>
                ${status === 'pendiente' ? `
                    <button onclick="updateCandidateStatus('${application.id}', 'aceptada', '${offerId}')"
                            style="display:inline-flex;align-items:center;gap:0.4rem;padding:0.5rem 1rem;background:#16a34a;color:white;border:none;border-radius:8px;cursor:pointer;font-size:0.85rem;font-weight:600;">
                        <i data-ico="check"></i> Aceptar
                    </button>
                    <button onclick="updateCandidateStatus('${application.id}', 'rechazada', '${offerId}')"
                            style="display:inline-flex;align-items:center;gap:0.4rem;padding:0.5rem 1rem;background:white;color:#dc2626;border:1.5px solid #fecaca;border-radius:8px;cursor:pointer;font-size:0.85rem;font-weight:600;">
                        <i data-ico="close"></i> Rechazar
                    </button>
                ` : ''}
            </div>
        </div>
    `;
}

// Función para contactar candidato por email
function contactCandidateByEmail(email, candidateName) {
    const companyName = currentCompanyData.firstName || 'Nuestra empresa';
    const subject = encodeURIComponent(`Oportunidad laboral en ${companyName}`);
    const body = encodeURIComponent(`Hola ${candidateName},\n\nNos ha interesado tu perfil y nos gustaría ponernos en contacto contigo para discutir una oportunidad laboral.\n\nSaludos,\n${companyName}`);
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
}

async function updateCandidateStatus(applicationId, newStatus, offerId) {
    try {
        const params = new URLSearchParams({ status: newStatus });
        const response = await fetchWithAuth(
            `${API_BASE_URL}/applications/${applicationId}/status?${params}`,
            { method: 'PATCH' }
        );

        if (response.ok) {
            showNotification(`Candidato ${newStatus === 'aceptada' ? 'aceptado' : 'rechazado'} exitosamente`);
            const offer = currentOffers.find(o => o.id === offerId);
            if (offer) {
                setTimeout(() => showCandidatesModal(offer), 500);
            }
        } else {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.message || `Error ${response.status}`);
        }
    } catch (error) {
        alert('Error al actualizar el estado del candidato: ' + error.message);
    }
}

function viewCandidateProfile(candidateId) {
    showNotification('Abriendo perfil del candidato...');
    setTimeout(() => {
        window.location.href = 'perfil-usuario.html';
    }, 1000);
}

function contactCandidate(candidateId, candidateName) {
    showNotification(`Abriendo chat con ${candidateName}...`);
}

// ========================================
// UTILIDADES
// ========================================

function createModal(title, content, onSave = null, saveButtonText = 'Guardar') {
    const existingModal = document.getElementById('genericModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    const modal = document.createElement('div');
    modal.id = 'genericModal';
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:600px;width:90%;">
            <div class="modal-header">
                <h2>${title}</h2>
                <button class="modal-close" onclick="closeModal()">&times;</button>
            </div>
            <div class="modal-body">
                ${content}
            </div>
            <div class="modal-actions">
                <button class="btn-secondary-modal" onclick="closeModal()">Cancelar</button>
                ${onSave ? `<button class="btn-primary-modal" id="modalSaveBtn">${saveButtonText}</button>` : ''}
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    if (onSave) {
        document.getElementById('modalSaveBtn').addEventListener('click', onSave);
    }
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
    
    return modal;
}

function closeModal() {
    const modal = document.getElementById('genericModal');
    if (modal) {
        modal.remove();
    }
}

// Avisos de ui.js, los mismos del resto del sitio (antes uno propio con
// estilos en linea, arriba a la derecha)
function showNotification(message, tipo) {
    if (window.SkillMatchUI) SkillMatchUI.aviso(message, tipo);
    else alert(message);
}

// Cargar aplicaciones recibidas por la empresa
async function loadApplications() {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');

    if (!userData.companyId) {
        return;
    }
    
    try {
        
        const response = await fetchWithAuth(`${API_BASE_URL}/applications/company/${userData.companyId}`);
        
        if (response.ok) {
            const data = await response.json();
            const applications = Array.isArray(data) ? data : (data.content || []);
            displayApplications(applications);
        } else {
            throw new Error('Error ' + response.status);
        }
    } catch (error) {
        const lista = document.getElementById('applications-list');
        if (lista) lista.innerHTML = '<p class="error-text">No se pudieron cargar las postulaciones.</p>';
    }
}

// Normalizar estado (español -> inglés)
function normalizeStatus(status) {
    const statusMap = {
        'pendiente': 'pending',
        'revisada': 'reviewed',
        'aceptada': 'accepted',
        'rechazada': 'rejected'
    };
    return statusMap[status.toLowerCase()] || status.toLowerCase();
}

// Mostrar las postulaciones en la seccion "Postulaciones recibidas". Antes el
// codigo buscaba un contenedor (.company-profile-content) que no existe y no
// mostraba nada: en su lugar se veian candidatos inventados.
const POSTULACIONES_VISIBLES = 5;
function displayApplications(applications) {
    const applicationsList = document.getElementById('applications-list');
    if (!applicationsList) return;

    if (applications.length === 0) {
        applicationsList.innerHTML = '<div class="empty-state"><p>Aún no has recibido postulaciones. Cuando alguien se postule a tus ofertas, aparecerá aquí.</p></div>';
        return;
    }

    // Las mas recientes primero
    const ordenadas = [...applications].sort((a, b) => new Date(b.appliedDate || 0) - new Date(a.appliedDate || 0));
    const cuenta = estado => applications.filter(app => normalizeStatus(app.status) === estado).length;

    applicationsList.innerHTML = `
        <div class="apps-summary apps-summary-4">
            <div><strong>${cuenta('pending')}</strong><span>Pendientes</span></div>
            <div><strong>${cuenta('reviewed')}</strong><span>Revisadas</span></div>
            <div><strong>${cuenta('accepted')}</strong><span>Aceptadas</span></div>
            <div><strong>${cuenta('rejected')}</strong><span>Rechazadas</span></div>
        </div>
        <div class="applications-list">
            ${ordenadas.map((app, i) => createApplicationCard(app, i >= POSTULACIONES_VISIBLES)).join('')}
        </div>
        ${ordenadas.length > POSTULACIONES_VISIBLES ? `<button type="button" class="btn btn-secondary btn-ver-todas" onclick="showAllApplications(this)">Ver todas (${ordenadas.length})</button>` : ''}
    `;
}

function showAllApplications(boton) {
    document.querySelectorAll('#applications-list .application-card[hidden]').forEach(card => { card.hidden = false; });
    boton.remove();
}

// Crear tarjeta de aplicación
function createApplicationCard(application, oculta) {
    const normalizedStatus = normalizeStatus(application.status);

    // Mismas etiquetas de estado que el resto del sitio (antes colores en linea)
    const estados = {
        pending:  ['pendiente', 'Pendiente', 'clock'],
        reviewed: ['revisada', 'Revisada', 'eye'],
        accepted: ['aceptada', 'Aceptada', 'check'],
        rejected: ['rechazada', 'Rechazada', 'close']
    };
    const [claseEstado, textoEstado, icono] = estados[normalizedStatus] || estados.pending;

    const appliedDate = application.appliedDate
        ? new Date(application.appliedDate).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
        : 'fecha desconocida';

    return `
        <div class="application-card" data-application-id="${application.id}"${oculta ? ' hidden' : ''}>
            <div class="application-header">
                <div class="candidate-info">
                    <h3>${sanitize(application.userName || 'Candidato')}</h3>
                    <p class="application-job">${sanitize(application.jobTitle || 'Oferta sin título')}${application.userHeadline ? ' · ' + sanitize(application.userHeadline) : ''}</p>
                </div>
                <span class="status-badge ${claseEstado}"><i data-ico="${icono}"></i> ${textoEstado}</span>
            </div>
            <p class="application-date"><i data-ico="calendar"></i> Se postuló el ${appliedDate}</p>
            ${application.coverLetter ? `
                <p class="cover-letter-preview">${sanitize(application.coverLetter.substring(0, 150))}${application.coverLetter.length > 150 ? '...' : ''}</p>
            ` : ''}
            <div class="application-actions">
                <button class="btn btn-secondary btn-small" onclick="viewCandidateProfile('${application.userId}')">Ver perfil</button>
                ${normalizedStatus === 'pending' || normalizedStatus === 'reviewed' ? `
                    <button class="btn btn-primary btn-small" onclick="updateApplicationStatus('${application.id}', 'aceptada')"><i data-ico="check"></i> Aceptar</button>
                    <button class="btn btn-secondary btn-small" onclick="updateApplicationStatus('${application.id}', 'rechazada')"><i data-ico="close"></i> Rechazar</button>
                ` : ''}
            </div>
        </div>
    `;
}

// Actualizar estado de aplicación
async function updateApplicationStatus(applicationId, newStatus) {
    try {
        const params = new URLSearchParams({ status: newStatus });
        const response = await fetchWithAuth(
            `${API_BASE_URL}/applications/${applicationId}/status?${params}`,
            { method: 'PATCH' }
        );

        if (response.ok) {
            showNotification(`Postulación ${newStatus === 'aceptada' ? 'aceptada' : 'rechazada'}`);
            loadApplications();
            // Las cifras del resumen cambian (por revisar, respondidas)
            loadActivityStats();
        } else {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.message || `Error ${response.status}`);
        }
    } catch (error) {
        alert('Error al actualizar el estado de la aplicación: ' + error.message);
    }
}

// Ver perfil del candidato - IMPLEMENTADO
function viewCandidateProfile(userId) {
    // Abrir perfil en nueva pestaña
    window.open(`perfil-usuario.html?id=${userId}`, '_blank');
}

// Cargar aplicaciones al cargar la página
document.addEventListener('DOMContentLoaded', function() {
    // Dar tiempo para que se carguen los datos de la empresa
    // Sin esperar: la seccion ya existe en el HTML
    if (typeof isAuthenticated === 'function' && isAuthenticated()) loadApplications();
});

