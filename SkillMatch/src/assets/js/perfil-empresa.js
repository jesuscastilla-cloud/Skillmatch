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
    // "Publicar una vacante" del panel de inicio llega con ?nueva=1
    if (new URLSearchParams(window.location.search).get('nueva') === '1') openNewOfferModal();
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
        cargarImagenesEmpresa();
        actualizarPaso('descripcion', !!company.description);

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

// ---- Primeros pasos de una empresa nueva ----
// Lo que hace falta para que las personas conozcan la empresa y encuentren sus
// vacantes. Cada paso pendiente es un boton que abre lo que falta; la tarjeta
// desaparece cuando todo esta listo. null = todavia no se sabe (cargando).
const PASOS_EMPRESA = [
    { id: 'descripcion', texto: 'Cuenta a qué se dedica tu empresa', ico: 'pencil', accion: () => openEditAboutModal() },
    { id: 'logo', texto: 'Pon el logo de tu empresa', ico: 'camera', accion: () => abrirLogoEmpresa() },
    { id: 'portada', texto: 'Elige una portada', ico: 'image', accion: () => abrirPortadaEmpresa() },
    { id: 'vacantes', texto: 'Publica tu primera vacante', ico: 'plus', accion: () => openNewOfferModal() },
    { id: 'respuestas', texto: 'Responde a las personas que se postularon', ico: 'users',
      accion: () => { const s = document.getElementById('candidatos'); if (s) s.scrollIntoView({ block: 'start' }); } }
];
const estadoPasos = { descripcion: null, logo: null, portada: null, vacantes: null, respuestas: null };

function actualizarPaso(id, hecho) {
    estadoPasos[id] = hecho;
    pintarPrimerosPasos();
}

function pintarPrimerosPasos() {
    const tarjeta = document.getElementById('primerosPasos');
    if (!tarjeta) return;
    // Se espera a saber los cuatro primeros, para que no aparezca y desaparezca
    if (['descripcion', 'logo', 'portada', 'vacantes'].some(id => estadoPasos[id] === null)) return;
    const pasos = PASOS_EMPRESA.filter(p => estadoPasos[p.id] !== 'no-aplica' && estadoPasos[p.id] !== null);
    const hechos = pasos.filter(p => estadoPasos[p.id] === true).length;
    tarjeta.hidden = hechos === pasos.length;
    if (tarjeta.hidden) return;
    document.getElementById('primerosPasosCuenta').textContent = `${hechos} de ${pasos.length}`;
    const barra = document.getElementById('primerosPasosBarra');
    barra.setAttribute('aria-valuenow', String(Math.round(hechos / pasos.length * 100)));
    barra.querySelector('span').style.setProperty('--p', hechos / pasos.length);
    const lista = document.getElementById('primerosPasosLista');
    lista.innerHTML = pasos.map(p => estadoPasos[p.id] === true
        ? `<li class="hecho"><span class="primeros-pasos-marca"><i data-ico="check"></i></span> ${p.texto}</li>`
        : `<li><button type="button" class="primeros-pasos-boton" data-paso="${p.id}"><span class="primeros-pasos-marca"><i data-ico="${p.ico}"></i></span> ${p.texto} <i data-ico="arrow"></i></button></li>`
    ).join('');
    if (!lista.dataset.listo) {
        lista.dataset.listo = '1';
        lista.addEventListener('click', e => {
            const boton = e.target.closest('[data-paso]');
            const paso = boton && PASOS_EMPRESA.find(p => p.id === boton.dataset.paso);
            if (paso) paso.accion();
        });
    }
}

// ---- Logo y portada de la empresa ----
// Antes habia botones que guardaban la imagen solo en el navegador (nadie mas la
// veia) y se quitaron. El backend no deja a la empresa cambiar su "logo" (solo
// ADMIN) ni tiene portada de empresa, pero la cuenta de la empresa es un usuario
// y todo usuario guarda en el servidor su foto y su portada
// (PUT /users/{id}/profile-image y /cover-image). Ahi quedan el logo y la
// portada. Las ven quienes tienen sesion (perfil publico); para que salgan a los
// visitantes y en las tarjetas de Vacantes falta un cambio en el backend
// (docs/PENDIENTES-BACKEND.md, punto 2.2).
let imagenesEmpresa = { logo: '', portada: '' };

async function cargarImagenesEmpresa() {
    const yo = JSON.parse(localStorage.getItem('userData') || '{}');
    if (!yo.id) return;
    try {
        const r = await fetchWithAuth(`${API_BASE_URL}/users/${encodeURIComponent(yo.id)}`);
        if (!r.ok) return;
        const cuenta = await r.json();
        imagenesEmpresa = { logo: cuenta.profileImageUrl || '', portada: cuenta.coverImageUrl || '' };
        pintarLogoEmpresa(currentCompanyData.name || yo.firstName, imagenesEmpresa.logo || currentCompanyData.logo);
        pintarPortadaEmpresa(imagenesEmpresa.portada);
    } catch (e) { /* sin imagenes se quedan las iniciales y la portada de la marca */ }
    actualizarPaso('logo', !!(imagenesEmpresa.logo || currentCompanyData.logo));
    actualizarPaso('portada', !!imagenesEmpresa.portada && imagenesEmpresa.portada !== 'galeria:marca');
}

function pintarLogoEmpresa(nombre, url) {
    const logo = document.getElementById('companyLogo');
    if (!logo) return;
    if (url) {
        const img = document.createElement('img');
        img.src = url;
        img.alt = '';
        // Si la imagen no carga, vuelven las iniciales
        img.onerror = () => { logo.textContent = companyInitials(nombre); logo.classList.add('company-logo-iniciales'); };
        logo.replaceChildren(img);
        logo.classList.remove('company-logo-iniciales');
    } else {
        logo.textContent = companyInitials(nombre);
        logo.classList.add('company-logo-iniciales');
    }
}

// La portada: de la galeria de empresas, una foto subida o la de la marca (CSS)
function pintarPortadaEmpresa(valor) {
    const portada = document.getElementById('companyCover');
    if (!portada) return;
    const url = window.SkillMatchImagen ? SkillMatchImagen.rutaPortada(valor) : null;
    if (url) {
        portada.style.backgroundImage = `url("${url}")`;
        portada.style.backgroundSize = 'cover';
        portada.style.backgroundPosition = 'center';
        portada.style.backgroundBlendMode = 'normal';
    } else {
        ['background-image', 'background-size', 'background-position', 'background-blend-mode'].forEach(p => portada.style.removeProperty(p));
    }
}

async function guardarImagenEmpresa(tipo, valor) {
    const yo = JSON.parse(localStorage.getItem('userData') || '{}');
    const ruta = tipo === 'logo' ? 'profile-image' : 'cover-image';
    const response = await fetchWithAuth(`${API_BASE_URL}/users/${encodeURIComponent(yo.id)}/${ruta}`, {
        method: 'PUT',
        body: JSON.stringify({ imageUrl: valor })
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || `El servidor respondió ${response.status}`);
    }
}

// Ventana con un formulario de imagen (la crea ui.js; mismo estilo que en el perfil de persona)
function ventanaImagen(id, titulo, icono, contenido, textoGuardar) {
    const v = SkillMatchUI.ventana({
        id, titulo, icono,
        cuerpo: `<form id="${id}Form">${contenido}
            <div class="modal-actions">
                <button type="button" class="btn-secondary-modal" data-cancelar>Cancelar</button>
                <button type="submit" class="btn-primary-modal" id="${id}Guardar">${textoGuardar}</button>
            </div></form>`
    });
    v.raiz.classList.add('modal-imagen');
    v.raiz.querySelector('[data-cancelar]').addEventListener('click', v.cerrar);
    return v;
}

function abrirLogoEmpresa() {
    const v = ventanaImagen('ventanaLogo', 'Cambiar el logo', 'camera', '<div id="editorLogo"></div>', 'Guardar logo');
    const guardar = document.getElementById('ventanaLogoGuardar');
    guardar.disabled = true;
    const editor = SkillMatchImagen.editor(document.getElementById('editorLogo'), {
        aspecto: [1, 1], minimo: [200, 200], salida: [400, 400],
        nombre: 'el logo', maxKB: 120,
        alCambiar: listo => { guardar.disabled = !listo; }
    });
    document.getElementById('ventanaLogoForm').addEventListener('submit', async e => {
        e.preventDefault();
        if (!editor.listo()) return;
        const liberar = SkillMatchUI.ocupado(guardar);
        try {
            const valor = await editor.exportar();
            await guardarImagenEmpresa('logo', valor);
            imagenesEmpresa.logo = valor;
            pintarLogoEmpresa(currentCompanyData.name, valor);
            actualizarPaso('logo', true);
            showNotification('Logo actualizado. Lo ven las personas en el perfil de tu empresa.');
            v.cerrar();
        } catch (error) {
            liberar();
            editor.error('No se pudo guardar el logo: ' + escaparHtml(error.message) + '. Intenta de nuevo.');
        }
    });
}

function abrirPortadaEmpresa() {
    const v = ventanaImagen('ventanaPortada', 'Cambiar portada', 'image', `
        <div class="tab-list" role="tablist" aria-label="Origen de la portada">
            <button type="button" class="tab-btn active" role="tab" id="portadaTabGaleria" aria-selected="true" aria-controls="portadaGaleria">Para empresas</button>
            <button type="button" class="tab-btn" role="tab" id="portadaTabSubir" aria-selected="false" aria-controls="portadaSubir">Subir imagen</button>
        </div>
        <div id="portadaGaleria" role="tabpanel" aria-labelledby="portadaTabGaleria"></div>
        <div id="portadaSubir" role="tabpanel" aria-labelledby="portadaTabSubir" hidden></div>`, 'Guardar portada');
    const guardar = document.getElementById('ventanaPortadaGuardar');
    const actual = imagenesEmpresa.portada || 'galeria:marca';
    const galeria = SkillMatchImagen.galeria(document.getElementById('portadaGaleria'), {
        lista: 'empresa', actual,
        // Al elegir una, se ve en la cabecera de una vez (si cancela, vuelve la de antes)
        alElegir: valor => pintarPortadaEmpresa(valor)
    });
    const editor = SkillMatchImagen.editor(document.getElementById('portadaSubir'), {
        aspecto: [4, 1], minimo: [1200, 300], salida: [1600, 400],
        nombre: 'la portada', maxKB: 320,
        alCambiar: () => actualizarBoton()
    });
    const subiendo = () => !document.getElementById('portadaSubir').hidden;
    const actualizarBoton = () => { guardar.disabled = subiendo() && !editor.listo(); };
    const pestana = cual => {
        const subir = cual === 'subir';
        [['portadaTabGaleria', !subir], ['portadaTabSubir', subir]].forEach(([idTab, si]) => {
            const t = document.getElementById(idTab);
            t.classList.toggle('active', si);
            t.setAttribute('aria-selected', String(si));
        });
        document.getElementById('portadaGaleria').hidden = subir;
        document.getElementById('portadaSubir').hidden = !subir;
        actualizarBoton();
    };
    document.getElementById('portadaTabGaleria').addEventListener('click', () => pestana('galeria'));
    document.getElementById('portadaTabSubir').addEventListener('click', () => pestana('subir'));
    // Si la actual es una imagen propia, se abre en "Subir imagen"
    pestana(actual.indexOf('galeria:') !== 0 ? 'subir' : 'galeria');
    let guardada = false;
    // Al cerrar sin guardar, vuelve la portada de antes
    new MutationObserver((c, obs) => {
        if (v.raiz.isConnected) return;
        obs.disconnect();
        if (!guardada) pintarPortadaEmpresa(imagenesEmpresa.portada);
    }).observe(document.body, { childList: true });

    document.getElementById('ventanaPortadaForm').addEventListener('submit', async e => {
        e.preventDefault();
        let valor = galeria.valor();
        if (!subiendo() && (!valor || valor === actual)) { guardada = true; v.cerrar(); return; }
        if (subiendo() && !editor.listo()) return;
        const liberar = SkillMatchUI.ocupado(guardar);
        try {
            if (subiendo()) valor = await editor.exportar();
            await guardarImagenEmpresa('portada', valor);
            imagenesEmpresa.portada = valor;
            guardada = true;
            pintarPortadaEmpresa(valor);
            actualizarPaso('portada', valor !== 'galeria:marca');
            showNotification('Portada actualizada.');
            v.cerrar();
        } catch (error) {
            liberar();
            const mensaje = 'No se pudo guardar la portada: ' + escaparHtml(error.message) + '. Intenta de nuevo.';
            if (subiendo()) editor.error(mensaje); else showNotification(mensaje, 'error');
        }
    });
}

// Nombre, logo, sector y datos de la cabecera
function pintarCabecera(company) {
    const nombre = company.name || 'Mi empresa';
    document.getElementById('companyName').textContent = nombre;
    document.title = nombre + ' - SkillMatch Cartagena';

    pintarLogoEmpresa(nombre, imagenesEmpresa.logo || company.logo);

    const industria = document.getElementById('companyIndustry');
    if (industria) industria.textContent = company.industry || '';

    const meta = document.getElementById('companyMeta');
    if (!meta) return;
    const datos = [];
    // Una empresa nueva queda con "No especificada" (lo pone el backend): no se muestra
    if (company.location && !/^no especificad/i.test(company.location)) datos.push(['pin', company.location]);
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
        // Solo cuenta como paso si ya alguien se postulo
        actualizarPaso('respuestas', stats.totalApplications ? !stats.pendingApplications : 'no-aplica');
        // Postulaciones que ya tienen respuesta (aceptadas, revisadas o rechazadas)
        poner('statRespuesta', stats.totalApplications ? Math.round(stats.responseRate || 0) + ' %' : '–');
    })
    .catch(() => {
        ['statOfertasActivas', 'statPostulaciones', 'statPorRevisar', 'statRespuesta'].forEach(id => poner(id, '–'));
    });
}

// Cargar ofertas desde backend. La promesa queda guardada: quien quiera bajar
// hasta las postulaciones espera a que las ofertas (que van arriba) ocupen su sitio
let ofertasCargadas = Promise.resolve();
let candidatosAbiertos = false;
let recorridoEmpresaListo = false;

function recorridoMiEmpresa() {
    if (!window.SkillMatchUI || !SkillMatchUI.recorrido) return;
    SkillMatchUI.recorrido({ clave: 'mi-empresa', pasos: [
        { objetivo: '.company-header-card', titulo: 'Este es el panel de tu empresa', texto: 'Pon tu logo y elige una portada: así te reconocen las personas en tu perfil público.' },
        { objetivo: '#primerosPasos', titulo: 'Primeros pasos', texto: 'Lo que falta para que las personas conozcan tu empresa. Toca cada paso para completarlo.' },
        { objetivo: '#ofertas', titulo: 'Tus ofertas', texto: 'Publica, edita o archiva tus vacantes. En cada una ves cuántas personas se postularon y cómo van.' },
        { objetivo: '#candidatos', titulo: 'Postulaciones recibidas', texto: 'Revisa, acepta o rechaza. Puedes verlas como lista o como tablero por estado.' },
        { objetivo: 'header a[href="oportunidades.html"]', titulo: 'Vacantes', texto: 'Aquí ves las vacantes como las ven las personas, y en "Mis vacantes" solo las tuyas.' }
    ] });
}
function loadOffers() {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');

    if (!userData.companyId) {
        const lista = document.getElementById('offersList');
        if (lista) lista.innerHTML = '<p class="error-text">No encontramos tu empresa. Cierra sesión y vuelve a entrar.</p>';
        return;
    }

    // Cargar desde backend
    ofertasCargadas = fetchWithAuth(`${API_BASE_URL}/jobs/company/${userData.companyId}`)
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
            const TIPOS = { empleo: ['employment', 'Empleo'], practica: ['practice', 'Práctica'], freelance: ['freelance', 'Independiente'] };
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
        // "Ver candidatos" en Vacantes llega con ?candidatos=<id de la oferta>
        const parametros = new URLSearchParams(window.location.search);
        const pedida = parametros.get('candidatos');
        if (pedida && !candidatosAbiertos) {
            candidatosAbiertos = true;
            viewOfferCandidates(pedida);
        }
        // La primera vez, un recorrido por "Mi empresa" (si no se llego a hacer algo puntual)
        if (!recorridoEmpresaListo && !pedida && !parametros.get('nueva') && !parametros.get('tab')) {
            recorridoEmpresaListo = true;
            setTimeout(recorridoMiEmpresa, 900);
        }
    })
    .catch(error => {
        // Sin las copias del navegador: antes se mostraban como si fueran reales
        const lista = document.getElementById('offersList');
        if (lista) lista.innerHTML = '<p class="error-text">No se pudieron cargar las ofertas. Intenta de nuevo en un momento.</p>';
    });
}

// Renderizar ofertas
function renderOffers(offers) {
    const offersList = document.getElementById('offersList');
    if (!offersList) return;
    actualizarPaso('vacantes', offers.length > 0);
    
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
            <div class="oferta-cifras" data-cifras="${sanitize(String(offerId))}"></div>
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
    pintarCifrasOfertas();
}

// ---- Cifras por vacante ----
// En cada oferta, como van sus postulaciones: una barra por estado y los
// numeros. Sale de las postulaciones que la pagina ya trae (sin consultas nuevas)
// y se actualiza al aceptar, rechazar o mover en el tablero.
const ESTADOS_CIFRAS = [
    ['pendiente', 'por revisar', 'por revisar'],
    ['revisada', 'revisada', 'revisadas'],
    ['aceptada', 'aceptada', 'aceptadas'],
    ['rechazada', 'rechazada', 'rechazadas']
];
let postulacionesCargadas = false;

function pintarCifrasOfertas() {
    if (!postulacionesCargadas) return;
    document.querySelectorAll('[data-cifras]').forEach(caja => {
        const apps = postulacionesEmpresa.filter(a => String(a.jobId) === caja.dataset.cifras);
        if (!apps.length) {
            caja.innerHTML = '<p class="oferta-cifras-vacia">Todavía nadie se ha postulado.</p>';
            return;
        }
        const cuenta = estado => apps.filter(a => estadoPostulacionEmpresa(a) === estado).length;
        const partes = ESTADOS_CIFRAS.map(([estado, uno, varios]) => ({ estado, n: cuenta(estado), uno, varios })).filter(p => p.n);
        caja.innerHTML = `
            <div class="oferta-cifras-barra" role="img" aria-label="${partes.map(p => `${p.n} ${p.n === 1 ? p.uno : p.varios}`).join(', ')}">
                ${partes.map(p => `<span class="${p.estado}" style="flex-grow:${p.n}"></span>`).join('')}
            </div>
            <ul class="oferta-cifras-leyenda" aria-hidden="true">
                ${partes.map(p => `<li class="${p.estado}"><b>${p.n}</b> ${p.n === 1 ? p.uno : p.varios}</li>`).join('')}
            </ul>`;
    });
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

    // Cambiar contraseña: la ventana es de ui.js (la misma del perfil de persona)
    const changePasswordBtn = document.getElementById('changePasswordBtn');
    if (changePasswordBtn) changePasswordBtn.addEventListener('click', () => SkillMatchUI.cambiarContrasena());

    // Logo y portada (se guardan en la cuenta de la empresa)
    const botonLogo = document.getElementById('editCompanyLogoBtn');
    if (botonLogo) botonLogo.addEventListener('click', abrirLogoEmpresa);
    const botonPortada = document.getElementById('editCompanyCoverBtn');
    if (botonPortada) botonPortada.addEventListener('click', abrirPortadaEmpresa);

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

// (El botón "⋮" solo ofrecía eliminar, y en el backend eliminar no borra: cierra la
// oferta igual que "Archivar", que además se puede deshacer con "Reabrir".)

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
            <textarea id="editAboutText" rows="6" maxlength="2000">${aboutText}</textarea>
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
            actualizarPaso('descripcion', !!newText);
            
            showNotification('Descripción actualizada correctamente');
            closeModal();
        })
        .catch(error => {
            alert(`Error al guardar la descripción: ${error.message}`);
        });
    });
}

// ---- Nueva oferta / editar oferta ----
// Antes la ventana no preguntaba modalidad, nivel ni habilidades: guardaba
// siempre "híbrido" y "junior", sin habilidades no había % de compatibilidad
// y el salario del ejemplo ("$2M - $3M") quedaba en 2 pesos. Al editar era
// peor: el backend reemplaza la oferta completa y se borraban requisitos,
// responsabilidades, beneficios, duración y fecha límite.

const CIUDADES_OFERTA = ['Cartagena de Indias', 'Turbaco', 'Arjona', 'Magangué', 'Barranquilla',
    'Santa Marta', 'Montería', 'Sincelejo', 'Bogotá D.C.', 'Medellín', 'Cali', 'Bucaramanga'];

// Lo que devuelve la lista de habilidades de la ventana abierta
let habilidadesDeOferta = () => [];

function sinTildesOferta(texto) {
    return String(texto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// ---- Reglas de publicación de una vacante ----
// Lo que pide la ley colombiana a una vacante y lo que no deja pedir. Ver
// docs/REGISTRO-Y-MARCO-LEGAL.md.

// Resolución 2605 de 2014: una vacante puede estar publicada máximo 6 meses
const MESES_MAXIMOS_VACANTE = 6;

// Fecha AAAA-MM-DD en la hora de Colombia (con toISOString salía la fecha de
// mañana después de las 7 de la noche)
function fechaLocal(fecha) {
    const d = new Date(fecha);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fechaDentroDe(dias, meses) {
    const d = new Date();
    if (meses) d.setMonth(d.getMonth() + meses);
    if (dias) d.setDate(d.getDate() + dias);
    return fechaLocal(d);
}
const fechaLegible = iso => new Date(iso + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });

// Ley 931 de 2004 y artículo 13 de la Constitución: una vacante no puede pedir
// una edad, un sexo, un estado civil ni una foto; los requisitos son la
// experiencia, los estudios y lo que se sabe hacer. Cada regla dice qué
// encontró, para que la empresa sepa qué corregir. Cuidado con lo legítimo:
// "3 años de experiencia" no es una edad, "mayor de edad" sí se puede pedir y
// "experiencia en fotografía" no es pedir una foto.
const NO_ES_EXPERIENCIA = '(?!\\s+de\\s+(?:experiencia|trabajo|labor|contrato))';
const EDAD = '(?:1[5-9]|[2-6]\\d)';
const REGLAS_NO_DISCRIMINACION = [
    { motivo: 'pide una edad', patrones: [
        // La edad que se le pide a la persona ("Edad: 25", "edad entre...", "edad
        // máxima", "rango de edad"); "clientes de todas las edades" no lo es
        /\b(?:rango|límite|limite|requisito)\s+de\s+edad\b/iu,
        /\bedad\s*(?::|entre\b|máxima|maxima|mínima|minima|requerida|ideal|de\s+\d|\d)/iu,
        new RegExp(`\\b${EDAD}\\s*(?:y|a|-|hasta)\\s*${EDAD}\\s*años\\b${NO_ES_EXPERIENCIA}`, 'iu'),
        new RegExp(`\\b(?:menor(?:es)?|máximo|maximo|no\\s+mayor(?:es)?)\\s+(?:de\\s+)?${EDAD}\\s*años\\b${NO_ES_EXPERIENCIA}`, 'iu'),
        // "mayor de 18 años" es lo mismo que "mayor de edad": se permite
        new RegExp(`\\bmayor(?:es)?\\s+de\\s+(?:19|[2-6]\\d)\\s*años\\b${NO_ES_EXPERIENCIA}`, 'iu')
    ] },
    { motivo: 'pide un sexo o un género', patrones: [
        /\b(?:solo|sólo|únicamente|unicamente|exclusivamente|preferiblemente)\s+(?:hombres?|mujeres?|varones?|damas?|caballeros?|señoritas?|señoras?)\b/iu,
        /\b(?:sexo|género|genero)\s*[:-]?\s*(?:masculino|femenino|hombre|mujer)\b/iu,
        /\bseñoritas?\b/iu
    ] },
    { motivo: 'pide un estado civil o no tener hijos', patrones: [
        /\bestado\s+civil\b/iu,
        /\b(?:solter[oa]s?|casad[oa]s?)\b/iu,
        /\bsin\s+hijos\b/iu
    ] },
    { motivo: 'pide una foto o un aspecto físico', patrones: [
        /\b(?:con|enviar|envía|envia|adjuntar|adjunta|anexar|anexa|incluir|incluye)\s+(?:una\s+|su\s+|tu\s+)?(?:foto|fotografía|fotografia)\b/iu,
        /\bfoto\s+(?:reciente|tipo\s+documento|de\s+cuerpo\s+entero)\b/iu,
        /\bbuena\s+presencia\b/iu
    ] }
];
// Sin datos de contacto: las personas se postulan y escriben por SkillMatch
// (así su información queda protegida y se evitan estafas)
const REGLAS_CONTACTO = [
    /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/u,
    /(?:\+?57[\s.-]?)?\b3\d{2}[\s.-]?\d{3}[\s.-]?\d{4}\b/u,
    /\b60\d[\s.-]?\d{3}[\s.-]?\d{4}\b/u,
    /\bwhats?\s?app\b|\bwsp\b/iu
];

// Revisa los textos de la vacante: devuelve lo que no se puede publicar
function revisarVacante(textos) {
    const todo = textos.filter(Boolean).join('\n');
    const discriminacion = [];
    REGLAS_NO_DISCRIMINACION.forEach(regla => {
        for (const patron of regla.patrones) {
            const hallado = todo.match(patron);
            if (hallado) { discriminacion.push(`«${hallado[0].trim()}» (${regla.motivo})`); break; }
        }
    });
    const contacto = [];
    REGLAS_CONTACTO.forEach(patron => {
        const hallado = todo.match(patron);
        if (hallado) contacto.push(`«${hallado[0].trim()}»`);
    });
    return { discriminacion, contacto };
}

async function openNewOfferModal(existingOffer = null, offerId = null) {
    const isEdit = existingOffer !== null;
    let oferta = {};
    if (isEdit) {
        // La oferta completa: lo que el formulario no muestra también se reenvía
        try {
            const respuesta = await fetchWithAuth(`${API_BASE_URL}/jobs/${offerId}`);
            if (!respuesta.ok) throw new Error();
            oferta = await respuesta.json();
        } catch (error) {
            alert('No pudimos cargar la oferta para editarla. Intenta de nuevo.');
            return;
        }
    }

    const opciones = (lista, actual, porDefecto) => lista.map(([valor, texto]) => {
        const elegida = sinTildesOferta(actual || porDefecto) === sinTildesOferta(valor);
        return `<option value="${valor}"${elegida ? ' selected' : ''}>${texto}</option>`;
    }).join('');
    const lineas = lista => sanitize((lista || []).join('\n'));
    const hoy = fechaLocal(new Date());
    const tope = fechaDentroDe(0, MESES_MAXIMOS_VACANTE);
    // Al editar se conserva la fecha si sigue valiendo; si no, 30 días desde hoy
    const guardada = oferta.expirationDate ? String(oferta.expirationDate).slice(0, 10) : '';
    const fechaInicial = guardada && guardada >= hoy && guardada <= tope ? guardada : fechaDentroDe(30);

    createModal(isEdit ? 'Editar oferta' : 'Nueva oferta', `
        <div class="oferta-con-vista">
        <div class="form-grid oferta-form">
            <div class="form-group span-full">
                <label for="offerTitle">Título de la oferta *</label>
                <input type="text" id="offerTitle" maxlength="200" placeholder="Ej.: Auxiliar de bodega" value="${sanitize(oferta.title)}">
            </div>
            <div class="form-group">
                <label for="offerType">Tipo *</label>
                <select id="offerType">${opciones([['empleo', 'Empleo'], ['práctica', 'Práctica'], ['freelance', 'Independiente o por proyecto']], oferta.type, 'empleo')}</select>
            </div>
            <div class="form-group">
                <label for="offerModality">Modalidad *</label>
                <select id="offerModality">${opciones([['presencial', 'Presencial'], ['híbrido', 'Híbrida'], ['remoto', 'Remota (desde casa)']], oferta.modality, 'presencial')}</select>
            </div>
            <div class="form-group">
                <label for="offerLevel">Experiencia *</label>
                <select id="offerLevel">${opciones([['sin-experiencia', 'Sin experiencia'], ['junior', 'Hasta 1 año'], ['semi-senior', 'De 1 a 3 años'], ['senior', 'Más de 3 años']], oferta.experienceLevel, 'junior')}</select>
            </div>
            <div class="form-group">
                <label for="offerLocation">Ciudad *</label>
                <input type="text" id="offerLocation" maxlength="100" list="ciudadesOferta" value="${sanitize(oferta.location || 'Cartagena de Indias')}">
                <datalist id="ciudadesOferta">${CIUDADES_OFERTA.map(ciudad => `<option value="${ciudad}">`).join('')}</datalist>
            </div>
            <div class="form-group">
                <label for="offerSalaryMin">Salario mínimo (pesos al mes)</label>
                <input type="number" id="offerSalaryMin" min="0" step="50000" inputmode="numeric" placeholder="Ej.: 1800000" value="${oferta.salaryMin ?? ''}">
            </div>
            <div class="form-group">
                <label for="offerSalaryMax">Salario máximo (pesos al mes)</label>
                <input type="number" id="offerSalaryMax" min="0" step="50000" inputmode="numeric" placeholder="Ej.: 2500000" value="${oferta.salaryMax ?? ''}">
            </div>
            <p class="field-help span-full oferta-salario-vista" id="offerSalaryPreview" aria-live="polite"></p>
            <div class="form-group">
                <label for="offerDuration">Duración (opcional)</label>
                <input type="text" id="offerDuration" maxlength="100" placeholder="Ej.: 6 meses" value="${sanitize(oferta.duration)}">
            </div>
            <div class="form-group">
                <label for="offerDeadline">Recibir postulaciones hasta *</label>
                <input type="date" id="offerDeadline" min="${hoy}" max="${tope}" value="${fechaInicial}" required>
                <p class="field-help">Máximo 6 meses desde hoy: por ley una vacante no puede estar publicada más tiempo.</p>
            </div>
            <div class="form-group span-full">
                <label for="offerSkillInput">Habilidades que pide *</label>
                <div class="chips-campo" id="offerSkills">
                    <input type="text" id="offerSkillInput" maxlength="40" autocomplete="off" placeholder="Escribe una y pulsa Enter">
                </div>
                <p class="field-help">Se comparan con las habilidades de cada persona para calcular su compatibilidad.</p>
            </div>
            <div class="form-group span-full">
                <label for="offerDescription">Descripción *</label>
                <textarea id="offerDescription" rows="4" maxlength="5000" placeholder="Cuenta de qué se trata el cargo y el equipo">${sanitize(oferta.description)}</textarea>
                <p class="field-help">No pidas edad, sexo, estado civil ni foto, ni pongas teléfonos o correos: la vacante no se publica con esos datos.</p>
            </div>
            <div class="form-group span-full">
                <label for="offerRequirements">Requisitos (uno por línea)</label>
                <textarea id="offerRequirements" rows="3" placeholder="Ej.: Bachiller con curso de manipulación de alimentos">${lineas(oferta.requirements)}</textarea>
            </div>
            <div class="form-group span-full">
                <label for="offerResponsibilities">Responsabilidades (una por línea)</label>
                <textarea id="offerResponsibilities" rows="3" placeholder="Ej.: Atender a los clientes en el punto de venta">${lineas(oferta.responsibilities)}</textarea>
            </div>
            <div class="form-group span-full">
                <label for="offerBenefits">Beneficios (uno por línea)</label>
                <textarea id="offerBenefits" rows="3" placeholder="Ej.: Alimentación incluida">${lineas(oferta.benefits)}</textarea>
            </div>
            <p class="error-text span-full" id="offerError" role="alert" hidden></p>
        </div>
        <!-- Vista previa: la misma tarjeta de Vacantes, se pinta mientras se escribe -->
        <aside class="oferta-vista" aria-label="Vista previa de la vacante">
            <p class="oferta-vista-titulo"><i data-ico="eye"></i> Así la verán las personas en Vacantes</p>
            <div id="offerPreview"></div>
        </aside>
        </div>
    `, () => guardarOferta(isEdit, offerId), isEdit ? 'Guardar cambios' : 'Publicar oferta', { ancho: 1120 });

    // Habilidades como etiquetas (componente de ui.js, el mismo del registro)
    const etiquetas = SkillMatchUI.etiquetas(document.getElementById('offerSkills'), document.getElementById('offerSkillInput'), { iniciales: oferta.skills || [] });
    habilidadesDeOferta = etiquetas.obtener;
    const vista = () => {
        const min = document.getElementById('offerSalaryMin').value;
        const max = document.getElementById('offerSalaryMax').value;
        const pesos = v => '$' + Number(v).toLocaleString('es-CO');
        document.getElementById('offerSalaryPreview').textContent =
            min && max ? `Se publicará como ${pesos(min)} - ${pesos(max)} al mes.`
            : min ? `Se publicará como "desde ${pesos(min)}" al mes.`
            : max ? `Se publicará como "hasta ${pesos(max)}" al mes.`
            : 'Déjalo vacío si prefieres no publicar el salario.';
    };
    ['offerSalaryMin', 'offerSalaryMax'].forEach(id => document.getElementById(id).addEventListener('input', vista));
    // El aviso de error se va en cuanto se corrige algo
    document.querySelector('.oferta-form').addEventListener('input', () => { document.getElementById('offerError').hidden = true; });
    vista();
    // Vista previa: cualquier cambio del formulario o de las habilidades la repinta
    let cuadro = 0;
    const repintar = () => { cancelAnimationFrame(cuadro); cuadro = requestAnimationFrame(() => pintarVistaOferta(oferta.postedDate)); };
    ['input', 'change'].forEach(tipo => document.querySelector('.oferta-form').addEventListener(tipo, repintar));
    new MutationObserver(repintar).observe(document.getElementById('offerSkills'), { childList: true });
    pintarVistaOferta(oferta.postedDate);
    document.getElementById('offerTitle').focus();
}

// ---- Vista previa de la vacante ----
// La misma tarjeta que ven las personas en Vacantes (mismas clases de app.css),
// con lo que se va escribiendo. Es solo para mirar: inert la deja fuera del
// teclado y del lector de pantalla (el formulario ya tiene esos datos).
const TIPOS_VISTA = { empleo: 'Empleo', practica: 'Práctica', freelance: 'Independiente' };
const MODALIDADES_VISTA = { presencial: 'Presencial', remoto: 'Remoto', hibrido: 'Híbrido' };
const EXPERIENCIAS_VISTA = {
    'sin-experiencia': 'Sin experiencia', junior: 'Hasta 1 año de experiencia',
    'semi-senior': '1 a 3 años de experiencia', senior: 'Más de 3 años de experiencia'
};

function pintarVistaOferta(publicada) {
    const destino = document.getElementById('offerPreview');
    if (!destino) return;
    const valor = id => ((document.getElementById(id) || {}).value || '').trim();
    const falta = texto => `<span class="oferta-vista-falta">${texto}</span>`;
    const empresa = currentCompanyData.name || currentCompanyData.firstName || 'Tu empresa';
    const min = Number(valor('offerSalaryMin')) || 0;
    const max = Number(valor('offerSalaryMax')) || 0;
    const pesos = v => '$' + v.toLocaleString('es-CO');
    const salario = min && max ? `${pesos(min)} - ${pesos(max)}` : min ? `Desde ${pesos(min)}` : max ? `Hasta ${pesos(max)}` : 'Salario a convenir';
    const descripcion = valor('offerDescription');
    const corta = descripcion.length > 150 ? descripcion.slice(0, 150) + '...' : descripcion;
    const habilidades = habilidadesDeOferta();
    const etiquetas = habilidades.length
        ? habilidades.slice(0, 4).map(h => `<span class="skill">${sanitize(h)}</span>`).join('') +
          (habilidades.length > 4 ? `<span class="skill skill-mas">+${habilidades.length - 4}</span>` : '')
        : '<span class="skill">Sin especificar</span>';
    const fecha = publicada
        ? new Date(publicada).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
        : 'Hoy';
    const limite = valor('offerDeadline');
    // data-revelado: sin la animacion de entrada de ui.js (se repinta con cada
    // letra y en el celular quedaba escondida esperando entrar en pantalla)
    destino.innerHTML = `
        <div class="opportunity-card" inert data-revelado="1">
            <div class="card-header-opp">
                <div class="company-logo-opp">${sanitize(empresa.charAt(0))}</div>
                <div class="card-info">
                    <h3 class="job-title"><span class="job-title-link">${valor('offerTitle') ? sanitize(valor('offerTitle')) : falta('Título de la oferta')}</span></h3>
                    <p class="company-name">${sanitize(empresa)}</p>
                </div>
            </div>
            <div class="card-meta">
                <span class="meta-item"><i data-ico="pin"></i> ${valor('offerLocation') ? sanitize(valor('offerLocation')) : 'Sin ciudad'}</span>
                <span class="meta-item"><i data-ico="briefcase"></i> ${TIPOS_VISTA[sinTildesOferta(valor('offerType'))] || 'Empleo'}</span>
                <span class="meta-item"><i data-ico="desktop"></i> ${MODALIDADES_VISTA[sinTildesOferta(valor('offerModality'))] || 'Presencial'}</span>
                <span class="meta-item"><i data-ico="cap"></i> ${EXPERIENCIAS_VISTA[valor('offerLevel')] || 'Experiencia a convenir'}</span>
                <span class="meta-item"><i data-ico="money"></i> ${salario}</span>
            </div>
            <p class="card-description">${corta ? sanitize(corta) : falta('Aquí sale el comienzo de la descripción.')}</p>
            <div class="card-skills">${etiquetas}</div>
            <div class="card-footer">
                <span class="post-date"><i data-ico="calendar"></i> ${fecha}</span>
                <div class="card-actions">
                    <button type="button" class="btn-ver-detalle" tabindex="-1">Ver detalle</button>
                    <button type="button" class="btn-apply" tabindex="-1">Postularme</button>
                </div>
            </div>
        </div>
        ${limite ? `<p class="oferta-vista-nota"><i data-ico="clock"></i> Recibe postulaciones hasta el ${fechaLegible(limite)}.</p>` : ''}
        <p class="oferta-vista-nota"><i data-ico="eye"></i> Al abrir "Ver detalle" se ven también los requisitos, las responsabilidades y los beneficios.</p>`;
}

async function guardarOferta(isEdit, offerId) {
    const valor = id => document.getElementById(id).value.trim();
    const aviso = document.getElementById('offerError');
    const error = mensaje => {
        aviso.textContent = mensaje;
        aviso.hidden = false;
        aviso.scrollIntoView({ block: 'nearest' });
    };
    aviso.hidden = true;

    const title = valor('offerTitle');
    const description = valor('offerDescription');
    const location = valor('offerLocation');
    const skills = habilidadesDeOferta();
    const salaryMin = valor('offerSalaryMin') === '' ? null : Number(valor('offerSalaryMin'));
    const salaryMax = valor('offerSalaryMax') === '' ? null : Number(valor('offerSalaryMax'));

    if (!title || !location || !description) return error('Completa el título, la ciudad y la descripción.');
    if (!skills.length) return error('Agrega al menos una habilidad: con ellas se calcula la compatibilidad de cada persona.');
    if ([salaryMin, salaryMax].some(s => s !== null && (Number.isNaN(s) || s < 0))) return error('El salario debe ser un número en pesos.');
    // Quien escribe "2" pensando en millones publicaría un salario de 2 pesos
    if ([salaryMin, salaryMax].some(s => s !== null && s > 0 && s < 50000)) return error('Escribe el salario completo en pesos, por ejemplo 1800000.');
    if (salaryMin !== null && salaryMax !== null && salaryMin > salaryMax) return error('El salario mínimo no puede ser mayor que el máximo.');

    const fecha = valor('offerDeadline');
    const tope = fechaDentroDe(0, MESES_MAXIMOS_VACANTE);
    if (!fecha) return error('Elige hasta qué fecha recibes postulaciones.');
    if (fecha < fechaLocal(new Date())) return error('La fecha límite no puede ser anterior a hoy.');
    if (fecha > tope) return error(`La fecha límite puede ser como máximo el ${fechaLegible(tope)}: por ley una vacante no puede estar publicada más de 6 meses.`);

    const revision = revisarVacante([title, description, valor('offerRequirements'), valor('offerResponsibilities'),
        valor('offerBenefits'), valor('offerDuration'), skills.join('\n')]);
    const problemas = [];
    if (revision.discriminacion.length) {
        problemas.push('Por ley una vacante no puede pedir edad, sexo, estado civil ni foto (Ley 931 de 2004). Cambia ' +
            revision.discriminacion.join('; ') + ' por lo que se necesita para el trabajo, como la experiencia o los estudios.');
    }
    if (revision.contacto.length) {
        problemas.push('Quita los datos de contacto: ' + revision.contacto.join(', ') +
            '. Las personas se postulan y te escriben por SkillMatch; así su información queda protegida y se evitan estafas.');
    }
    if (problemas.length) return error(problemas.join(' '));

    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    if (!userData.companyId) return error('No encontramos tu empresa. Cierra sesión y vuelve a entrar.');

    const lista = id => valor(id).split('\n').map(l => l.replace(/^[-•*]\s*/, '').trim()).filter(Boolean);
    const datos = {
        companyId: userData.companyId,
        title,
        description,
        type: valor('offerType'),
        modality: valor('offerModality'),
        experienceLevel: valor('offerLevel'),
        location,
        salaryMin,
        salaryMax,
        duration: valor('offerDuration') || null,
        skills,
        requirements: lista('offerRequirements'),
        responsibilities: lista('offerResponsibilities'),
        benefits: lista('offerBenefits'),
        expirationDate: fecha + 'T23:59:59'
    };

    const boton = document.getElementById('modalSaveBtn');
    boton.disabled = true;
    try {
        const respuesta = await fetchWithAuth(isEdit ? `${API_BASE_URL}/jobs/${offerId}` : `${API_BASE_URL}/jobs`, {
            method: isEdit ? 'PUT' : 'POST',
            body: JSON.stringify(datos)
        });
        if (!respuesta.ok) {
            const cuerpo = await respuesta.json().catch(() => ({}));
            throw new Error(cuerpo.message || 'El servidor no aceptó la oferta.');
        }
        closeModal();
        showNotification(isEdit ? 'Oferta actualizada' : 'Oferta publicada');
        // La lista y las cifras se recargan del servidor (antes se armaba a mano
        // y salían fechas "1969" y el tipo en minúscula)
        loadOffers();
        loadActivityStats();
    } catch (e) {
        error('No se pudo guardar la oferta: ' + e.message);
        boton.disabled = false;
    }
}

async function showCandidatesModal(offer) {
    // Antes la ventana y cada tarjeta llevaban 20 estilos fijos (fondo blanco,
    // grises sueltos): no cambiaban en modo oscuro ni usaban la marca
    const modal = createModal(`Candidatos para: ${sanitize(offer.title)}`,
        '<p class="candidatos-estado">Cargando candidatos…</p>', null, 'Guardar', { ancho: 720 });
    const cuerpo = modal.querySelector('.modal-body');
    const acciones = modal.querySelector('.modal-actions');
    if (acciones) acciones.hidden = true;

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/applications/job/${encodeURIComponent(offer.id)}`);
        if (!response.ok) throw new Error('Error al cargar candidatos');
        const applications = await response.json();
        const n = applications.length;
        cuerpo.innerHTML = n === 0
            ? '<p class="candidatos-estado">Todavía nadie se ha postulado a esta vacante.</p>'
            : `<p class="candidatos-resumen"><strong>${n}</strong> ${n === 1 ? 'persona se postuló' : 'personas se postularon'} a esta vacante.</p>
               ${applications.map(app => createCandidateCard(app, offer.id)).join('')}`;
    } catch (error) {
        cuerpo.innerHTML = '<p class="candidatos-estado candidatos-error">No pudimos cargar los candidatos. Intenta de nuevo en un momento.</p>';
    }
    if (acciones) {
        acciones.hidden = false;
        acciones.innerHTML = '<button type="button" class="btn-secondary-modal" onclick="closeModal()">Cerrar</button>';
    }
}

const ESTADOS_CANDIDATO = { pendiente: 'Pendiente', revisada: 'Revisada', aceptada: 'Aceptada', rechazada: 'Rechazada' };

function createCandidateCard(application, offerId) {
    const fecha = new Date(application.appliedDate).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
    const status = String(application.status || 'pendiente').toLowerCase();
    const etiqueta = ESTADOS_CANDIDATO[status] || ESTADOS_CANDIDATO.pendiente;
    const name = sanitize(application.userName) || 'Persona';
    const initials = (application.userName || '?').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
    const iniciales = `<span class="candidato-iniciales"${application.userProfileImageUrl ? ' hidden' : ''}>${sanitize(initials)}</span>`;
    // Si la foto no carga, quedan las iniciales
    const avatar = application.userProfileImageUrl
        ? `<img class="candidato-foto" src="${sanitize(application.userProfileImageUrl)}" alt="" onerror="this.hidden=true;this.nextElementSibling.hidden=false">${iniciales}`
        : iniciales;
    const dato = (icono, nombre, valor) => valor
        ? `<li><i data-ico="${icono}"></i><span class="candidato-dato-nombre">${nombre}</span><span class="candidato-dato-valor">${valor}</span></li>`
        : '';
    const correo = application.userEmail ? sanitize(application.userEmail) : '';
    // Aceptar o rechazar mientras la empresa no haya decidido (igual que en la lista de postulaciones)
    const decidir = status === 'pendiente' || status === 'revisada';

    return `
        <article class="candidato-tarjeta">
            <div class="candidato-cabeza">
                <div class="candidato-avatar">${avatar}</div>
                <div class="candidato-nombre">
                    <h3>${name}</h3>
                    <p>${sanitize(application.userHeadline) || 'Sin título en su perfil'}</p>
                </div>
                <span class="status-badge ${ESTADOS_CANDIDATO[status] ? status : 'pendiente'}">${etiqueta}</span>
            </div>
            <ul class="candidato-datos">
                ${dato('mail', 'Correo', correo ? `<a href="mailto:${correo}">${correo}</a>` : '')}
                ${dato('phone', 'Teléfono', sanitize(application.userPhone))}
                ${dato('pin', 'Ciudad', sanitize(application.userLocation))}
                ${dato('clock', 'Se postuló', fecha)}
            </ul>
            ${application.coverLetter ? `
                <div class="candidato-carta">
                    <p class="candidato-carta-titulo">Su mensaje para la empresa</p>
                    <p>${sanitize(application.coverLetter)}</p>
                </div>` : ''}
            <div class="candidato-acciones">
                <button type="button" class="btn-candidato" data-id="${escaparHtml(application.userId)}" onclick="viewCandidateProfile(this.dataset.id)">Ver perfil</button>
                <a class="btn-candidato" href="hoja-de-vida.html?id=${encodeURIComponent(application.userId)}" target="_blank" rel="noopener"><i data-ico="list"></i> Hoja de vida</a>
                <a class="btn-candidato principal" href="mensajes.html?userId=${encodeURIComponent(application.userId)}"><i data-ico="chat"></i> Mensaje</a>
                <!-- Nombre y correo en data-: dentro del onclick una comilla en el nombre ejecutaba codigo -->
                ${correo ? `<button type="button" class="btn-candidato" data-email="${escaparHtml(application.userEmail)}" data-nombre="${escaparHtml(application.userName)}" onclick="contactCandidateByEmail(this.dataset.email, this.dataset.nombre)"><i data-ico="mail"></i> Correo</button>` : ''}
                ${decidir ? `
                    <button type="button" class="btn-candidato aceptar" data-id="${escaparHtml(application.id)}" data-oferta="${escaparHtml(offerId)}" onclick="updateCandidateStatus(this.dataset.id, 'aceptada', this.dataset.oferta)"><i data-ico="check"></i> Aceptar</button>
                    <button type="button" class="btn-candidato rechazar" data-id="${escaparHtml(application.id)}" data-oferta="${escaparHtml(offerId)}" onclick="updateCandidateStatus(this.dataset.id, 'rechazada', this.dataset.oferta)"><i data-ico="close"></i> Rechazar</button>
                ` : ''}
            </div>
        </article>`;
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

// ========================================
// UTILIDADES
// ========================================

function createModal(title, content, onSave = null, saveButtonText = 'Guardar', opciones = {}) {
    const existingModal = document.getElementById('genericModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    const modal = document.createElement('div');
    modal.id = 'genericModal';
    modal.className = 'modal active'; // .active: ui.js la cierra con Escape
    modal.innerHTML = `
        <div class="modal-content" style="max-width:${opciones.ancho || 600}px;width:90%;">
            <div class="modal-header">
                <h2>${title}</h2>
                <button type="button" class="modal-close" onclick="closeModal()" aria-label="Cerrar"><i data-ico="close"></i></button>
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
            postulacionDesdeAviso();
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
    postulacionesEmpresa = [...applications].sort((a, b) => new Date(b.appliedDate || 0) - new Date(a.appliedDate || 0));
    postulacionesCargadas = true;
    pintarCifrasOfertas();
    prepararVistaPostulaciones(applications.length > 0);

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

// La notificacion de una postulacion nueva llega con "?tab=applicants" (y
// ?postulacion= con cual es). Antes abria el perfil arriba y habia que buscarla.
// Ahora baja a "Postulaciones recibidas" y la marca. Solo la primera vez.
let postulacionesPedidas = new URLSearchParams(window.location.search).get('tab') === 'applicants';
function postulacionDesdeAviso() {
    if (!postulacionesPedidas) return;
    postulacionesPedidas = false;
    ofertasCargadas.finally(() => requestAnimationFrame(irAPostulacionPedida));
}

function irAPostulacionPedida() {
    if (vistaPostulaciones === 'tablero') mostrarVistaPostulaciones('lista', false);
    const pedida = new URLSearchParams(window.location.search).get('postulacion');
    const tarjeta = pedida && [...document.querySelectorAll('#applications-list .application-card')].find(t => t.dataset.applicationId === pedida);
    if (!tarjeta) {
        const seccion = document.getElementById('candidatos');
        if (seccion) seccion.scrollIntoView({ block: 'start' });
        return;
    }
    // Si quedo entre las escondidas, se muestran todas
    if (tarjeta.hidden) {
        const verTodas = document.querySelector('#applications-list .btn-ver-todas');
        if (verTodas) showAllApplications(verTodas);
    }
    SkillMatchUI.resaltar(tarjeta);
}

// ---- Tablero de postulaciones ----
// Otra forma de ver las mismas postulaciones: una columna por estado. Se
// mueven arrastrando la tarjeta (mouse) o con sus botones (teclado y celular).
// La vista elegida se recuerda en este navegador.
const COLUMNAS_TABLERO = [
    { estado: 'pendiente', titulo: 'Pendientes', ico: 'clock' },
    { estado: 'revisada', titulo: 'Revisadas', ico: 'eye' },
    { estado: 'aceptada', titulo: 'Aceptadas', ico: 'check' },
    { estado: 'rechazada', titulo: 'Rechazadas', ico: 'close' }
];
// Botones de cada tarjeta segun su columna (arrastrando se puede ir a cualquiera)
const MOVIMIENTOS_TABLERO = {
    pendiente: [['revisada', 'Marcar revisada'], ['aceptada', 'Aceptar'], ['rechazada', 'Rechazar']],
    revisada: [['aceptada', 'Aceptar'], ['rechazada', 'Rechazar']],
    aceptada: [['revisada', 'Volver a revisadas']],
    rechazada: [['revisada', 'Volver a revisadas']]
};
const VISTA_POSTULACIONES_KEY = 'skillmatch_vista_postulaciones';
let postulacionesEmpresa = [];
let vistaPostulaciones = 'lista';
try { if (localStorage.getItem(VISTA_POSTULACIONES_KEY) === 'tablero') vistaPostulaciones = 'tablero'; } catch (e) { /* sin almacenamiento: lista */ }

const estadoPostulacionEmpresa = app => String(app.status || 'pendiente').toLowerCase();

function tarjetaTablero(app) {
    const estado = estadoPostulacionEmpresa(app);
    // Sin el año cuando es del año en curso: la tarjeta es angosta
    const dia = app.appliedDate ? new Date(app.appliedDate) : null;
    const fecha = dia ? dia.toLocaleDateString('es-CO', dia.getFullYear() === new Date().getFullYear()
        ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    return `
        <li class="tablero-tarjeta" draggable="true" data-id="${escaparHtml(app.id)}">
            <a class="tablero-nombre" href="perfil-usuario.html?id=${encodeURIComponent(app.userId)}" target="_blank" rel="noopener">${sanitize(app.userName || 'Candidato')}</a>
            <p class="tablero-vacante">${sanitize(app.jobTitle || 'Oferta sin título')}</p>
            ${fecha ? `<p class="tablero-fecha">Se postuló el ${fecha}</p>` : ''}
            <div class="tablero-acciones">
                ${(MOVIMIENTOS_TABLERO[estado] || []).map(([destino, texto]) =>
                    `<button type="button" class="tablero-mover${destino === 'aceptada' ? ' aceptar' : ''}" data-mover="${destino}">${texto}</button>`).join('')}
            </div>
        </li>`;
}

function pintarTablero() {
    const tablero = document.getElementById('applications-board');
    if (!tablero) return;
    tablero.innerHTML = COLUMNAS_TABLERO.map(col => {
        const apps = postulacionesEmpresa.filter(a => estadoPostulacionEmpresa(a) === col.estado);
        return `
            <section class="tablero-columna" data-estado="${col.estado}" aria-labelledby="columna-${col.estado}">
                <h3 id="columna-${col.estado}"><i data-ico="${col.ico}"></i> ${col.titulo} <span class="tablero-cuenta">${apps.length}</span></h3>
                <ul class="tablero-lista">${apps.map(tarjetaTablero).join('') || '<li class="tablero-vacia">Ninguna por ahora</li>'}</ul>
            </section>`;
    }).join('');
}

// Muestra la lista o el tablero; "recordar" lo guarda para la proxima vez
function mostrarVistaPostulaciones(vista, recordar) {
    vistaPostulaciones = vista;
    const lista = document.getElementById('applications-list');
    const tablero = document.getElementById('applications-board');
    if (!lista || !tablero) return;
    lista.hidden = vista === 'tablero';
    tablero.hidden = vista !== 'tablero';
    if (vista === 'tablero') pintarTablero();
    document.querySelectorAll('#vistaPostulaciones .vista-btn').forEach(b => b.setAttribute('aria-pressed', b.dataset.vista === vista ? 'true' : 'false'));
    if (recordar) {
        try { localStorage.setItem(VISTA_POSTULACIONES_KEY, vista); } catch (e) { /* sin almacenamiento */ }
    }
}

// El selector solo aparece si hay postulaciones; los eventos se conectan una vez
function prepararVistaPostulaciones(hay) {
    const selector = document.getElementById('vistaPostulaciones');
    const tablero = document.getElementById('applications-board');
    if (!selector || !tablero) return;
    selector.hidden = !hay;
    if (!selector.dataset.listo) {
        selector.dataset.listo = '1';
        selector.addEventListener('click', e => {
            const boton = e.target.closest('.vista-btn');
            if (boton) mostrarVistaPostulaciones(boton.dataset.vista, true);
        });
        tablero.addEventListener('click', e => {
            const boton = e.target.closest('[data-mover]');
            if (boton) moverPostulacion(boton.closest('.tablero-tarjeta').dataset.id, boton.dataset.mover, true);
        });
        tablero.addEventListener('dragstart', e => {
            const tarjeta = e.target.closest('.tablero-tarjeta');
            if (!tarjeta) return;
            e.dataTransfer.setData('text/plain', tarjeta.dataset.id);
            e.dataTransfer.effectAllowed = 'move';
            tarjeta.classList.add('arrastrando');
        });
        tablero.addEventListener('dragend', e => {
            const tarjeta = e.target.closest('.tablero-tarjeta');
            if (tarjeta) tarjeta.classList.remove('arrastrando');
            tablero.querySelectorAll('.encima').forEach(c => c.classList.remove('encima'));
        });
        tablero.addEventListener('dragover', e => {
            const columna = e.target.closest('.tablero-columna');
            if (!columna) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            tablero.querySelectorAll('.encima').forEach(c => { if (c !== columna) c.classList.remove('encima'); });
            columna.classList.add('encima');
        });
        tablero.addEventListener('drop', e => {
            const columna = e.target.closest('.tablero-columna');
            if (!columna) return;
            e.preventDefault();
            columna.classList.remove('encima');
            moverPostulacion(e.dataTransfer.getData('text/plain'), columna.dataset.estado, false);
        });
    }
    if (!hay) mostrarVistaPostulaciones('lista', false);
    else if (vistaPostulaciones === 'tablero') mostrarVistaPostulaciones('tablero', false);
}

// Cambia el estado en el servidor. La tarjeta se mueve al instante y vuelve a
// su columna si el servidor no responde bien.
async function moverPostulacion(id, estado, conTeclado) {
    const app = postulacionesEmpresa.find(a => String(a.id) === String(id));
    if (!app || estadoPostulacionEmpresa(app) === estado) return;
    const antes = app.status;
    const columna = COLUMNAS_TABLERO.find(c => c.estado === estado);
    app.status = estado;
    pintarTablero();
    // Con teclado, el foco sigue a la tarjeta en su nueva columna
    const enfocar = () => {
        if (!conTeclado) return;
        const tarjeta = [...document.querySelectorAll('#applications-board .tablero-tarjeta')].find(t => t.dataset.id === String(id));
        const destino = tarjeta && (tarjeta.querySelector('[data-mover]') || tarjeta.querySelector('a'));
        if (destino) destino.focus();
    };
    enfocar();
    try {
        const params = new URLSearchParams({ status: estado });
        const response = await fetchWithAuth(`${API_BASE_URL}/applications/${encodeURIComponent(id)}/status?${params}`, { method: 'PATCH' });
        if (!response.ok) throw new Error(`Error ${response.status}`);
        showNotification(`${sanitize(app.userName || 'La postulación')} pasó a ${columna.titulo.toLowerCase()}.`);
        // La lista y las cifras de arriba tambien cambian
        displayApplications(postulacionesEmpresa);
        enfocar();
        loadActivityStats();
    } catch (error) {
        app.status = antes;
        pintarTablero();
        enfocar();
        showNotification('No se pudo mover la postulación. Intenta de nuevo.', 'error');
    }
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
        <div class="application-card" data-application-id="${escaparHtml(application.id)}"${oculta ? ' hidden' : ''}>
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
                <a class="btn btn-secondary btn-small" href="mensajes.html?userId=${encodeURIComponent(application.userId)}"><i data-ico="chat"></i> Mensaje</a>
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
        alert('Error al actualizar el estado de la postulación: ' + error.message);
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

