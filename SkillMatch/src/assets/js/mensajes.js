// Script para la página de mensajes
//
// Una conversación se abre desde la lista, desde "Nuevo mensaje" (con tus
// conexiones) o con mensajes.html?userId=... (botón "Mensaje" de Conexiones,
// de un perfil, de una postulación o la notificación de un mensaje).
// Antes "Nuevo mensaje" decía "Función en desarrollo" y ?userId= se ignoraba:
// no había forma de empezar una conversación.

let conversations = [];
let currentConversationUserId = null;
let currentMessages = [];
let firmaMensajes = '';      // para repintar solo cuando algo cambió
let personas = undefined;    // tus conexiones para "Nuevo mensaje" (null = no cargaron)
let enviando = false;
let vistaArchivadas = false; // la lista muestra las archivadas en lugar de las demas
let perfilConversacion = ''; // a donde lleva "Ver perfil" (persona o empresa)

document.addEventListener('DOMContentLoaded', async function() {

    // Verificar autenticación
    if (!isAuthenticated()) {
        window.location.href = 'login-usuario.html';
        return;
    }

    setupEventListeners();
    await loadConversations();

    // Abrir la conversación que pide la dirección
    const pedida = new URLSearchParams(window.location.search).get('userId');
    if (pedida) openConversation(pedida);

    // Mensajes nuevos: el chat abierto cada 5 s y la lista cada 20 s,
    // solo con la pestaña visible (antes también con la pestaña oculta)
    setInterval(() => { if (!document.hidden) refreshCurrentConversation(); }, 5000);
    setInterval(() => { if (!document.hidden) refrescarLista(); }, 20000);
});

function setupEventListeners() {
    // Enviar mensaje
    const sendBtn = document.getElementById('sendMessageBtn');
    const messageInput = document.getElementById('messageInput');

    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }

    if (messageInput) {
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }

    // Búsqueda de conversaciones
    const searchInput = document.getElementById('searchConversations');
    if (searchInput) {
        searchInput.addEventListener('input', filterConversations);
    }

    // Nuevo mensaje: elegir a quién escribirle entre tus conexiones
    const newMessageBtn = document.getElementById('newMessageBtn');
    if (newMessageBtn) newMessageBtn.addEventListener('click', abrirNuevoMensaje);

    const buscarPersona = document.getElementById('buscarPersona');
    if (buscarPersona) buscarPersona.addEventListener('input', () => pintarPersonas(buscarPersona.value));

    const listaPersonas = document.getElementById('listaPersonas');
    if (listaPersonas) {
        listaPersonas.addEventListener('click', (e) => {
            const boton = e.target.closest('.persona');
            if (!boton) return;
            cerrarNuevoMensaje();
            openConversation(boton.dataset.id);
        });
    }

    document.querySelectorAll('[data-cerrar-modal]').forEach(b => b.addEventListener('click', cerrarNuevoMensaje));

    // Ver perfil: el de la persona o, si es una empresa, su perfil publico
    // (antes abria un perfil de persona vacio)
    const viewProfileBtn = document.getElementById('viewProfileBtn');
    if (viewProfileBtn) {
        viewProfileBtn.addEventListener('click', () => {
            if (currentConversationUserId) {
                window.location.href = perfilConversacion || `perfil-usuario.html?id=${encodeURIComponent(currentConversationUserId)}`;
            }
        });
    }

    // "⋯" de la cabecera: archivar o eliminar la conversacion abierta
    const chatMenuBtn = document.getElementById('chatMenuBtn');
    if (chatMenuBtn) {
        chatMenuBtn.addEventListener('click', () => {
            const conv = conversations.find(c => String(c.otherUserId) === String(currentConversationUserId));
            if (!conv) {
                SkillMatchUI.aviso('Todavía no hay mensajes en esta conversación.', 'info', 2600);
                return;
            }
            abrirMenu(chatMenuBtn, opcionesConversacion(conv));
        });
    }

    // Lista: abrir una conversacion, su "⋯" o la pestaña de archivadas
    const lista = document.getElementById('conversationsList');
    if (lista) {
        lista.addEventListener('click', (e) => {
            const menu = e.target.closest('.conv-menu');
            if (menu) {
                const conv = conversations.find(c => String(c.otherUserId) === menu.dataset.userId);
                if (conv) abrirMenu(menu, opcionesConversacion(conv));
                return;
            }
            const archivadas = e.target.closest('[data-ver-archivadas]');
            if (archivadas) { verArchivadas(archivadas.dataset.verArchivadas === '1'); return; }
            const item = e.target.closest('.conversation-item');
            if (item) openConversation(item.dataset.userId);
        });
    }

    // Mensajes: "⋯" de cada uno, clic derecho o mantener presionado (celular)
    const chat = document.getElementById('chatMessages');
    if (chat) {
        chat.addEventListener('click', (e) => {
            const boton = e.target.closest('.mensaje-menu');
            if (boton) abrirMenuMensaje(boton.closest('.message'), boton);
        });
        chat.addEventListener('contextmenu', (e) => {
            const burbuja = e.target.closest('.message-content');
            if (!burbuja) return;
            e.preventDefault();
            abrirMenuMensaje(burbuja.closest('.message'), null, { x: e.clientX, y: e.clientY });
        });
        let presion = null;
        chat.addEventListener('pointerdown', (e) => {
            const burbuja = e.pointerType === 'touch' && e.target.closest('.message-content');
            if (!burbuja) return;
            const inicio = { x: e.clientX, y: e.clientY };
            presion = { inicio, temporizador: setTimeout(() => { presion = null; abrirMenuMensaje(burbuja.closest('.message'), null, inicio); }, 550) };
        });
        const soltar = () => { if (presion) { clearTimeout(presion.temporizador); presion = null; } };
        chat.addEventListener('pointerup', soltar);
        chat.addEventListener('pointercancel', soltar);
        chat.addEventListener('pointermove', (e) => {
            if (presion && Math.hypot(e.clientX - presion.inicio.x, e.clientY - presion.inicio.y) > 10) soltar();
        });
        chat.addEventListener('scroll', () => { soltar(); cerrarMenu(); });
    }

    // El menu de acciones se cierra al tocar afuera, con Escape o al cambiar el tamaño
    document.addEventListener('click', (e) => {
        if (menuAbierto && !menuAbierto.menu.contains(e.target) && !(menuAbierto.ancla && menuAbierto.ancla.contains(e.target))) cerrarMenu();
    });
    document.addEventListener('keydown', teclasDelMenu);
    window.addEventListener('resize', () => cerrarMenu());

    // En celular: volver de un chat a la lista
    const volver = document.getElementById('backToListBtn');
    if (volver) {
        volver.addEventListener('click', () => {
            document.querySelector('.messages-container').classList.remove('viendo-chat');
            history.replaceState(null, '', 'mensajes.html');
        });
    }
}

// Nombre para mostrar: las empresas se registran con apellido "Empresa"
// ("Digital Dreams Empresa"); se muestra solo "Digital Dreams"
function nombreVisible(nombre, apellido) {
    if (apellido === 'Empresa') return (nombre || '').trim();
    return `${nombre || ''} ${apellido || ''}`.trim();
}

function sinTildes(texto) {
    return (texto || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// El backend devuelve el último mensaje de cada conversación (senderId,
// receiverName, content...), no "otherUserId" y "otherUserName" como esperaba
// este archivo: por eso cada conversación salía como "Usuario", sin texto, y
// al tocarla no se abría. Aquí se traduce, con los no leídos de cada una.
async function obtenerConversaciones() {
    const [respuesta, respuestaNoLeidos] = await Promise.all([
        fetchWithAuth(`${API_BASE_URL}/messages/conversations`),
        fetchWithAuth(`${API_BASE_URL}/messages/unread-counts-by-conversation`).catch(() => null)
    ]);
    if (!respuesta.ok) throw new Error('Error al cargar conversaciones');
    const ultimos = await respuesta.json();
    const noLeidos = (respuestaNoLeidos && respuestaNoLeidos.ok) ? await respuestaNoLeidos.json() : {};
    const miId = String((getUserData() || {}).id);

    return ultimos.map(m => {
        if (m.otherUserId) return m; // por si el backend cambia al formato esperado
        const yoEnvie = String(m.senderId) === miId;
        const otro = yoEnvie ? m.receiverId : m.senderId;
        return {
            otherUserId: otro,
            // Las empresas se registran con apellido "Empresa": se muestra solo su nombre
            // (la expresion habia perdido la barra de \s: "Caribe Digital Estudio Empresa")
            otherUserName: ((yoEnvie ? m.receiverName : m.senderName) || 'Usuario').replace(/\s+Empresa$/, ''),
            lastMessageContent: (yoEnvie ? 'Tú: ' : '') + (m.content || ''),
            lastMessageDate: m.sentAt,
            unreadCount: Number(noLeidos[otro] || 0)
        };
    }).sort((a, b) => String(b.lastMessageDate).localeCompare(String(a.lastMessageDate)));
}

// Cargar conversaciones
async function loadConversations() {
    const container = document.getElementById('conversationsList');

    try {
        conversations = await obtenerConversaciones();
        filterConversations();
    } catch (error) {
        container.innerHTML = '<div class="error-message">No pudimos cargar tus conversaciones. Intenta de nuevo.</div>';
    }
}

// La lista se repinta solo si cambió (sin parpadeos cada 20 s)
async function refrescarLista() {
    try {
        const nuevas = await obtenerConversaciones();
        const firma = lista => lista.map(c => c.otherUserId + c.lastMessageDate + c.unreadCount).join('|');
        if (firma(nuevas) === firma(conversations)) return;
        conversations = nuevas;
        filterConversations();
    } catch (error) { /* sin conexión: se intenta en la siguiente vuelta */ }
}

// Mostrar conversaciones
function displayConversations(conversationsList, numArchivadas = 0, archivadas = {}) {
    const container = document.getElementById('conversationsList');
    document.querySelector('.messages-container').classList.toggle('tiene-lista', conversations.length > 0);
    if (menuAbierto && container.contains(menuAbierto.ancla)) cerrarMenu(false);

    if (conversations.length === 0) {
        // Lista vacia: un texto corto aqui y la invitacion grande a la derecha
        // (antes la misma ilustracion salia en los dos paneles y la derecha decia
        // "Selecciona una conversacion" sin haber ninguna)
        container.innerHTML = '<p class="conversations-vacio">Aún no tienes conversaciones.</p>';
        const invitacion = document.querySelector('#chatEmpty .empty-state');
        if (invitacion) {
            invitacion.innerHTML = '<h2>Empieza tu primera conversación</h2>' +
                '<p>Escríbele a una de tus conexiones o a una empresa que te interese.</p>' +
                '<div class="empty-acciones">' +
                '<button type="button" class="btn btn-primary" onclick="abrirNuevoMensaje()"><i data-ico="plus"></i> Nuevo mensaje</button>' +
                '<a href="conexiones.html" class="btn btn-secondary">Buscar conexiones</a></div>';
        }
        return;
    }

    // Arriba de la lista: la entrada a "Archivadas" o, dentro, la vuelta
    const fila = vistaArchivadas
        ? '<button type="button" class="conv-archivadas" data-ver-archivadas="0"><i data-ico="arrow"></i><span>Archivadas</span><small>Volver a tus conversaciones</small></button>'
        : (numArchivadas ? `<button type="button" class="conv-archivadas" data-ver-archivadas="1"><i data-ico="archive"></i><span>Archivadas</span><small>${numArchivadas}</small></button>` : '');

    if (conversationsList.length === 0) {
        container.innerHTML = fila + '<p class="conversations-vacio">' +
            (vistaArchivadas ? 'No tienes conversaciones archivadas.' : 'Ninguna conversación coincide con tu búsqueda.') + '</p>';
        return;
    }

    container.innerHTML = fila + conversationsList.map((conv, i) => {
        const isUnread = conv.unreadCount > 0;
        const unreadClass = isUnread ? 'unread' : '';
        const activa = String(conv.otherUserId) === String(currentConversationUserId) ? ' active' : '';
        // El lector de pantalla lo lee junto al nombre: "1 sin leer", no un número suelto
        const unreadBadge = isUnread ? `<span class="unread-badge" id="sinLeer${i}">${conv.unreadCount}<span class="sr-only"> sin leer</span></span>` : '';
        const nombre = escaparHtml(conv.otherUserName || 'Usuario');
        // Al buscar se ven tambien las archivadas: llevan su etiqueta
        const etiqueta = !vistaArchivadas && estaArchivada(conv, archivadas) ? '<span class="conv-etiqueta">Archivada</span>' : '';

        return `
            <div class="conversation-item ${unreadClass}${activa}" data-user-id="${escaparHtml(conv.otherUserId)}">
                <div class="conversation-avatar" aria-hidden="true">${conv.otherUserName ? escaparHtml(conv.otherUserName.charAt(0)) : '<i data-ico="user"></i>'}</div>
                <div class="conversation-info">
                    <div class="conversation-header">
                        <h2><button type="button" class="conv-abrir"${activa ? ' aria-current="true"' : ''}${isUnread ? ` aria-describedby="sinLeer${i}"` : ''}>${nombre}</button></h2>
                        <span class="conversation-time">${formatDate(conv.lastMessageDate, true)}</span>
                    </div>
                    <p class="conversation-preview">${etiqueta}${escaparHtml(truncateText(conv.lastMessageContent || '', 50))}</p>
                </div>
                ${unreadBadge}
                <button type="button" class="conv-menu" data-user-id="${escaparHtml(conv.otherUserId)}" aria-label="Opciones de la conversación con ${nombre}" aria-haspopup="menu" aria-expanded="false"><i data-ico="more"></i></button>
            </div>
        `;
    }).join('');
}

// Abrir una conversación (exista o no)
async function openConversation(userId) {
    if (!userId || userId === 'undefined' || userId === 'null') return;
    const yo = getUserData() || {};
    if (String(userId) === String(yo.id)) return; // el backend no deja escribirse a uno mismo

    currentConversationUserId = userId;
    currentMessages = [];
    firmaMensajes = '';
    perfilConversacion = '';
    cerrarMenu(false);

    // Marcar como activa
    document.querySelectorAll('.conversation-item').forEach(item => {
        const es = item.dataset.userId === String(userId);
        item.classList.toggle('active', es);
        const boton = item.querySelector('.conv-abrir');
        // Vacío, aria-current significa "no": tiene que decir "true"
        if (boton && es) boton.setAttribute('aria-current', 'true');
        else if (boton) boton.removeAttribute('aria-current');
    });

    // Mostrar área de chat (en celular reemplaza a la lista)
    // #chatActive trae la clase .hidden (display: none !important): con solo
    // style.display = 'flex' nunca se mostraba y el chat quedaba en blanco
    document.getElementById('chatEmpty').style.display = 'none';
    const chat = document.getElementById('chatActive');
    chat.classList.remove('hidden');
    chat.style.display = 'flex';
    document.querySelector('.messages-container').classList.add('viendo-chat');

    // La dirección recuerda con quién se habla: al recargar sigue abierta
    history.replaceState(null, '', 'mensajes.html?userId=' + encodeURIComponent(userId));

    pintarCabecera(userId);
    await loadMessages(userId);

    // Marcar como leído
    markConversationAsRead(userId);
}

// Nombre y titular de la otra persona: de la lista o, si es una
// conversación nueva, del perfil
async function pintarCabecera(userId) {
    const conv = conversations.find(c => String(c.otherUserId) === String(userId));
    const nombreEl = document.getElementById('chatUserName');
    const avatarEl = document.getElementById('chatAvatar');
    const titularEl = document.getElementById('chatUserStatus');
    const poner = (nombre, titular) => {
        if (String(userId) !== String(currentConversationUserId)) return;
        nombreEl.textContent = nombre || 'Usuario';
        avatarEl.textContent = (nombre || '?').charAt(0).toUpperCase();
        titularEl.textContent = titular || '';
    };
    poner(conv ? conv.otherUserName : 'Cargando…', '');

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/users/${encodeURIComponent(userId)}`);
        if (!response.ok) throw new Error();
        const persona = await response.json();
        const esEmpresa = persona.lastName === 'Empresa';
        poner(nombreVisible(persona.firstName, persona.lastName) || (conv && conv.otherUserName),
              esEmpresa ? 'Empresa' : (persona.headline || ''));
        if (esEmpresa) buscarPerfilDeEmpresa(userId, persona.firstName);
    } catch (error) {
        if (!conv) poner('Usuario', '');
    }
}

// La conversacion es con la cuenta de la empresa: su perfil publico se busca
// por el nombre y se confirma con el userId
async function buscarPerfilDeEmpresa(userId, nombre) {
    try {
        const respuesta = await fetchWithAuth(`${API_BASE_URL}/companies/search?keyword=${encodeURIComponent(textoParaBuscar(nombre || ''))}`);
        if (!respuesta.ok) return;
        const datos = await respuesta.json();
        const empresa = (Array.isArray(datos) ? datos : (datos.content || [])).find(c => String(c.userId) === String(userId));
        if (empresa && String(userId) === String(currentConversationUserId)) {
            perfilConversacion = 'empresa.html?id=' + encodeURIComponent(empresa.id);
            document.getElementById('viewProfileBtn').title = 'Ver perfil de la empresa';
        }
    } catch (error) { /* se queda el perfil de la cuenta */ }
}

// "Hoy", "Ayer", "Lunes, 13 de octubre" o, de otro año, "13 de octubre de 2025"
function etiquetaDia(fecha) {
    const d = new Date(fecha);
    if (Number.isNaN(d.getTime())) return '';
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const dia = new Date(d); dia.setHours(0, 0, 0, 0);
    const dias = Math.round((hoy - dia) / 86400000);
    if (dias === 0) return 'Hoy';
    if (dias === 1) return 'Ayer';
    const opciones = dia.getFullYear() === hoy.getFullYear()
        ? { weekday: 'long', day: 'numeric', month: 'long' }
        : { day: 'numeric', month: 'long', year: 'numeric' };
    const texto = d.toLocaleDateString('es-CO', opciones);
    return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function horaMensaje(fecha) {
    const d = new Date(fecha);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
}

// Cargar mensajes de una conversación. Con "silencioso" (la revisión de
// cada 5 s) no muestra "Cargando…", repinta solo si llegó algo nuevo y no
// mueve la vista si estás leyendo mensajes anteriores (antes hacía las dos
// cosas cada 5 s).
async function loadMessages(otherUserId, silencioso) {
    if (!otherUserId || otherUserId === 'undefined') return;

    const container = document.getElementById('chatMessages');
    if (!silencioso) container.innerHTML = '<div class="loading-message">Cargando mensajes...</div>';

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/messages/conversation/${encodeURIComponent(otherUserId)}`);
        if (!response.ok) throw new Error('Error al cargar mensajes');
        const mensajes = await response.json();
        if (String(otherUserId) !== String(currentConversationUserId)) return; // se cambió de chat mientras cargaba

        const firma = mensajes.map(m => m.id + (m.isRead ? 'l' : '')).join('|');
        if (silencioso && firma === firmaMensajes) return;
        const alFinal = container.scrollHeight - container.scrollTop - container.clientHeight < 80;

        firmaMensajes = firma;
        currentMessages = mensajes;
        displayMessages(mensajes);
        if (!silencioso || alFinal) scrollToBottom();
    } catch (error) {
        if (!silencioso) container.innerHTML = '<div class="error-message">No pudimos cargar los mensajes. Intenta de nuevo.</div>';
    }
}

function displayMessages(messages) {
    const container = document.getElementById('chatMessages');
    const userData = getUserData() || {};
    const myUserId = userData.id;
    // Al repintar el chat, el menu de un mensaje queda suelto: se cierra
    if (menuAbierto && menuAbierto.deMensaje) cerrarMenu(false);

    if (messages.length === 0) {
        const nombre = document.getElementById('chatUserName').textContent;
        container.innerHTML = `<div class="no-messages chat-primer-mensaje">
            <p>Aún no hay mensajes con ${escaparHtml(nombre)}.</p>
            <p>Escribe el primero: preséntate y cuéntale por qué le escribes.</p></div>`;
        return;
    }

    let diaAnterior = '';
    container.innerHTML = messages.map(msg => {
        const isMyMessage = String(msg.senderId) === String(myUserId);
        const messageClass = isMyMessage ? 'message-sent' : 'message-received';
        // Un separador cada vez que cambia el dia ("Hoy", "Ayer", "Lunes, 13 de octubre")
        const dia = etiquetaDia(msg.sentAt);
        const separador = dia && dia !== diaAnterior ? `<div class="chat-dia" role="separator"><span>${dia}</span></div>` : '';
        if (dia) diaAnterior = dia;
        // Tus mensajes: una palomita al enviarlo y dos turquesa cuando lo leen
        // (antes solo salia una, y solo cuando ya lo habian leido)
        const estado = !isMyMessage ? '' : msg.isRead
            ? '<span class="message-estado es-leido" role="img" aria-label="Leído" title="Leído"><i data-ico="check"></i><i data-ico="check"></i></span>'
            : '<span class="message-estado" role="img" aria-label="Enviado" title="Enviado"><i data-ico="check"></i></span>';

        return `${separador}
            <div class="message ${messageClass}" data-id="${escaparHtml(msg.id)}">
                <div class="message-content">
                    <p>${escaparHtml(msg.content)}</p>
                    ${msg.attachmentUrl ? `<a href="${urlSegura(msg.attachmentUrl)}" target="_blank" rel="noopener" class="message-attachment"><i data-ico="clip"></i> Adjunto</a>` : ''}
                </div>
                <div class="message-info">
                    <span class="message-time">${horaMensaje(msg.sentAt)}</span>
                    ${estado}
                    <button type="button" class="mensaje-menu" aria-label="Opciones del mensaje" aria-haspopup="menu" aria-expanded="false"><i data-ico="more"></i></button>
                </div>
            </div>
        `;
    }).join('');
}

// Enviar mensaje
async function sendMessage() {
    if (!currentConversationUserId || enviando) return;

    const input = document.getElementById('messageInput');
    const boton = document.getElementById('sendMessageBtn');
    const content = input.value.trim();

    if (!content) return;

    enviando = true;
    boton.disabled = true;
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/messages`, {
            method: 'POST',
            body: JSON.stringify({
                receiverId: currentConversationUserId,
                content: content
            })
        });

        if (!response.ok) throw new Error('Error al enviar mensaje');
        input.value = '';
        await loadMessages(currentConversationUserId, true);
        scrollToBottom();
        await loadConversations(); // una conversación nueva aparece en la lista
    } catch (error) {
        alert('No se pudo enviar el mensaje. Revisa tu conexión e intenta de nuevo.');
    } finally {
        enviando = false;
        boton.disabled = false;
        input.focus();
    }
}

// Marcar conversación como leída
async function markConversationAsRead(otherUserId) {
    if (!otherUserId || otherUserId === 'undefined') return;

    try {
        await fetchWithAuth(`${API_BASE_URL}/messages/conversation/${encodeURIComponent(otherUserId)}/read-all`, {
            method: 'PATCH'
        });

        // El número junto a "Mensajes" en la barra también baja
        if (window.SkillMatchUI && SkillMatchUI.actualizarNoLeidos) SkillMatchUI.actualizarNoLeidos();

        // Actualizar contador de no leídos
        const conversation = conversations.find(c => String(c.otherUserId) === String(otherUserId));
        if (conversation) {
            conversation.unreadCount = 0;
        }

        // Actualizar badge en la conversación
        const item = document.querySelector(`.conversation-item[data-user-id="${CSS.escape(String(otherUserId))}"]`);
        if (item) {
            item.classList.remove('unread');
            const badge = item.querySelector('.unread-badge');
            if (badge) badge.remove();
        }
    } catch (error) {
    }
}

// Refrescar conversación actual
async function refreshCurrentConversation() {
    if (currentConversationUserId) {
        await loadMessages(currentConversationUserId, true);
    }
}

// Filtrar conversaciones (también repinta la lista con el filtro puesto).
// Las archivadas van aparte: en su propia vista, o al buscar.
function filterConversations() {
    const campo = document.getElementById('searchConversations');
    const searchTerm = sinTildes(campo ? campo.value.trim() : '');
    const archivadas = limpiarArchivadas();
    const enArchivo = conversations.filter(c => estaArchivada(c, archivadas));
    if (vistaArchivadas && !enArchivo.length) vistaArchivadas = false;

    // Buscando se ven todas (las archivadas tambien); si no, las de la vista actual
    const base = searchTerm ? conversations : conversations.filter(c => estaArchivada(c, archivadas) === vistaArchivadas);
    const filtered = !searchTerm ? base : base.filter(conv =>
        sinTildes(conv.otherUserName).includes(searchTerm) ||
        sinTildes(conv.lastMessageContent).includes(searchTerm)
    );

    displayConversations(filtered, searchTerm ? 0 : enArchivo.length, archivadas);
}

// ---- Archivadas ----
// El backend todavia no guarda chats archivados: se recuerdan en este
// navegador, por cuenta, con la fecha del ultimo mensaje al archivar. Si llega
// uno nuevo (la fecha cambia), la conversacion vuelve sola a la lista.
function claveArchivadas() {
    return 'skillmatch_archivadas_' + ((getUserData() || {}).id || '');
}

function leerArchivadas() {
    try { return JSON.parse(localStorage.getItem(claveArchivadas()) || '{}') || {}; } catch (e) { return {}; }
}

function guardarArchivadas(archivadas) {
    try { localStorage.setItem(claveArchivadas(), JSON.stringify(archivadas)); } catch (e) { /* sin almacenamiento */ }
}

function estaArchivada(conv, archivadas) {
    return !!conv && archivadas[conv.otherUserId] === String(conv.lastMessageDate);
}

// Quita las que ya no corresponden: con mensajes nuevos o que ya no existen
function limpiarArchivadas() {
    const archivadas = leerArchivadas();
    let cambio = false;
    Object.keys(archivadas).forEach(id => {
        const conv = conversations.find(c => String(c.otherUserId) === id);
        if (!conv || archivadas[id] !== String(conv.lastMessageDate)) { delete archivadas[id]; cambio = true; }
    });
    if (cambio) guardarArchivadas(archivadas);
    return archivadas;
}

function verArchivadas(si) {
    vistaArchivadas = si;
    filterConversations();
    const primero = document.querySelector('#conversationsList [data-ver-archivadas], #conversationsList .conversation-item');
    if (primero && primero.matches('[data-ver-archivadas]')) primero.focus();
}

function archivarConversacion(conv, archivar) {
    const archivadas = leerArchivadas();
    if (archivar) archivadas[conv.otherUserId] = String(conv.lastMessageDate);
    else delete archivadas[conv.otherUserId];
    guardarArchivadas(archivadas);
    const nombre = escaparHtml(conv.otherUserName || 'esta persona');
    if (archivar && String(conv.otherUserId) === String(currentConversationUserId)) cerrarChat();
    filterConversations();
    SkillMatchUI.aviso(archivar
        ? `Archivaste la conversación con <strong>${nombre}</strong>. Vuelve a tu lista si te escribe de nuevo.`
        : `La conversación con <strong>${nombre}</strong> volvió a tu lista.`, 'ok');
}

// "Eliminar" es para ti: el backend marca cada mensaje como borrado de tu
// lado (la otra persona los sigue viendo; si los dos los borran, desaparecen)
async function eliminarConversacion(conv) {
    const nombre = conv.otherUserName || 'esta persona';
    const si = await SkillMatchUI.confirmar({
        titulo: '¿Eliminar la conversación?',
        texto: `Se borra solo de tus mensajes: ${nombre} la seguirá viendo. Si te vuelve a escribir, aparecerá de nuevo con los mensajes nuevos.`,
        aceptar: 'Eliminar',
        peligro: true
    });
    if (!si) return;
    try {
        const respuesta = await fetchWithAuth(`${API_BASE_URL}/messages/conversation/${encodeURIComponent(conv.otherUserId)}`);
        if (!respuesta.ok) throw new Error();
        const mensajes = await respuesta.json();
        let fallas = 0;
        // De cinco en cinco, para no llenar el servidor de pedidos a la vez
        for (let i = 0; i < mensajes.length; i += 5) {
            const resultados = await Promise.all(mensajes.slice(i, i + 5).map(m =>
                fetchWithAuth(`${API_BASE_URL}/messages/${encodeURIComponent(m.id)}`, { method: 'DELETE' }).then(r => r.ok).catch(() => false)));
            fallas += resultados.filter(ok => !ok).length;
        }
        if (fallas) throw new Error();
        const archivadas = leerArchivadas();
        delete archivadas[conv.otherUserId];
        guardarArchivadas(archivadas);
        if (String(conv.otherUserId) === String(currentConversationUserId)) cerrarChat();
        SkillMatchUI.aviso(`Eliminaste la conversación con <strong>${escaparHtml(nombre)}</strong>.`, 'ok');
    } catch (error) {
        SkillMatchUI.aviso('No pudimos eliminar toda la conversación. Intenta de nuevo.', 'error');
    }
    await loadConversations();
}

function opcionesConversacion(conv) {
    const archivada = estaArchivada(conv, leerArchivadas());
    return [
        { texto: archivada ? 'Desarchivar' : 'Archivar', icono: 'archive', accion: () => archivarConversacion(conv, !archivada) },
        { texto: 'Eliminar conversación', icono: 'trash', peligro: true, accion: () => eliminarConversacion(conv) }
    ];
}

// Cerrar el chat abierto y volver a "Selecciona una conversación"
function cerrarChat() {
    currentConversationUserId = null;
    currentMessages = [];
    firmaMensajes = '';
    document.getElementById('chatActive').classList.add('hidden');
    document.getElementById('chatActive').style.display = '';
    document.getElementById('chatEmpty').style.display = '';
    document.querySelector('.messages-container').classList.remove('viendo-chat');
    document.querySelectorAll('.conversation-item.active').forEach(item => item.classList.remove('active'));
    document.querySelectorAll('.conv-abrir[aria-current]').forEach(boton => boton.removeAttribute('aria-current'));
    history.replaceState(null, '', 'mensajes.html');
}

// ---- Copiar o eliminar un mensaje ----
function abrirMenuMensaje(mensajeEl, ancla, punto) {
    if (!mensajeEl) return;
    const mensaje = currentMessages.find(m => String(m.id) === mensajeEl.dataset.id);
    if (!mensaje) return;
    abrirMenu(ancla || mensajeEl.querySelector('.message-content'), [
        { texto: 'Copiar', icono: 'copy', accion: () => copiarMensaje(mensaje.content || '') },
        { texto: 'Eliminar para mí', icono: 'trash', peligro: true, accion: () => eliminarMensaje(mensaje) }
    ], punto);
    if (menuAbierto) menuAbierto.deMensaje = true;
}

function copiarMensaje(texto) {
    const listo = () => SkillMatchUI.aviso('Mensaje copiado.', 'ok', 1800);
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(texto).then(listo, () => copiarALaAntigua(texto) && listo());
    } else if (copiarALaAntigua(texto)) {
        listo();
    }
}

// Sin permiso del portapapeles (por ejemplo en http desde el celular)
function copiarALaAntigua(texto) {
    const area = document.createElement('textarea');
    area.value = texto;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    area.remove();
    if (!ok) SkillMatchUI.aviso('No se pudo copiar. Selecciona el texto y cópialo a mano.', 'error');
    return ok;
}

async function eliminarMensaje(mensaje) {
    const si = await SkillMatchUI.confirmar({
        titulo: '¿Eliminar este mensaje?',
        texto: 'Se borra solo para ti: la otra persona lo seguirá viendo.',
        aceptar: 'Eliminar',
        peligro: true
    });
    if (!si) return;
    try {
        const respuesta = await fetchWithAuth(`${API_BASE_URL}/messages/${encodeURIComponent(mensaje.id)}`, { method: 'DELETE' });
        if (!respuesta.ok) throw new Error();
        firmaMensajes = '';
        await loadMessages(currentConversationUserId, true);
        refrescarLista(); // si era el ultimo, cambia lo que se ve en la lista
    } catch (error) {
        SkillMatchUI.aviso('No pudimos eliminar el mensaje. Intenta de nuevo.', 'error');
    }
}

// ---- Menu de acciones (de una conversacion o de un mensaje) ----
let menuAbierto = null;

function abrirMenu(ancla, opciones, punto) {
    cerrarMenu(false);
    const menu = document.createElement('div');
    menu.className = 'menu-acciones';
    menu.setAttribute('role', 'menu');
    menu.innerHTML = opciones.map((o, i) =>
        `<button type="button" role="menuitem" data-i="${i}"${o.peligro ? ' class="es-peligro"' : ''}>${SkillMatchUI.icono(o.icono)}<span>${escaparHtml(o.texto)}</span></button>`).join('');
    document.body.appendChild(menu);

    // Junto al boton (o donde se toco), sin salirse de la pantalla
    const caja = menu.getBoundingClientRect();
    const r = punto ? { left: punto.x, right: punto.x, top: punto.y, bottom: punto.y } : ancla.getBoundingClientRect();
    let x = punto ? r.left : r.right - caja.width;
    let y = r.bottom + 6;
    if (y + caja.height > window.innerHeight - 8) y = r.top - caja.height - 6;
    x = Math.max(8, Math.min(x, window.innerWidth - caja.width - 8));
    y = Math.max(8, y);
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';

    menu.addEventListener('click', (e) => {
        const boton = e.target.closest('[data-i]');
        if (!boton) return;
        cerrarMenu(false);
        opciones[Number(boton.dataset.i)].accion();
    });
    menuAbierto = { menu, ancla: punto ? null : ancla, desde: Date.now() };
    if (ancla && !punto) ancla.setAttribute('aria-expanded', 'true');
    menu.querySelector('button').focus();
}

function cerrarMenu(devolverFoco) {
    if (!menuAbierto) return;
    const { menu, ancla } = menuAbierto;
    // Recien abierto con el dedo: el toque que lo abrio no lo cierra
    if (devolverFoco === undefined && Date.now() - menuAbierto.desde < 400) return;
    menu.remove();
    if (ancla) {
        ancla.setAttribute('aria-expanded', 'false');
        if (devolverFoco && document.body.contains(ancla)) ancla.focus();
    }
    menuAbierto = null;
}

// Escape cierra; flechas arriba y abajo recorren las opciones
function teclasDelMenu(e) {
    if (!menuAbierto) return;
    if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        cerrarMenu(true);
        return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const botones = [...menuAbierto.menu.querySelectorAll('button')];
    const actual = botones.indexOf(document.activeElement);
    e.preventDefault();
    const siguiente = (actual + (e.key === 'ArrowDown' ? 1 : -1) + botones.length) % botones.length;
    botones[siguiente].focus();
}

// ---- Nuevo mensaje ----

async function abrirNuevoMensaje() {
    const modal = document.getElementById('newMessageModal');
    const buscador = document.getElementById('buscarPersona');
    modal.classList.add('active');
    buscador.value = '';
    setTimeout(() => buscador.focus(), 50);
    if (personas === undefined || personas === null) {
        document.getElementById('listaPersonas').innerHTML = '<li class="nuevo-mensaje-vacio">Cargando tus conexiones…</li>';
        personas = await cargarPersonas();
    }
    pintarPersonas('');
}

function cerrarNuevoMensaje() {
    document.getElementById('newMessageModal').classList.remove('active');
}

// Tus conexiones aceptadas: en cada una, "la otra persona" es la que no eres tú
async function cargarPersonas() {
    const miId = String((getUserData() || {}).id);
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/connections/my-connections`);
        if (!response.ok) throw new Error();
        const conexiones = await response.json();
        return conexiones.map(c => {
            const soyQuienPidio = String(c.userId) === miId;
            return {
                id: soyQuienPidio ? c.connectedUserId : c.userId,
                nombre: (soyQuienPidio ? c.connectedUserName : c.userName) || 'Usuario',
                titular: (soyQuienPidio ? c.connectedUserHeadline : c.userHeadline) || ''
            };
        }).filter(p => p.id);
    } catch (error) {
        return null;
    }
}

function pintarPersonas(texto) {
    const lista = document.getElementById('listaPersonas');
    const esEmpresa = (getUserData() || {}).userType === 'empresa';
    const pista = esEmpresa
        ? '<br>Para escribirle a un candidato, ábrelo desde «Postulaciones recibidas» en tu perfil.'
        : '';

    if (personas === null) {
        lista.innerHTML = '<li class="nuevo-mensaje-vacio">No pudimos cargar tus conexiones. Intenta de nuevo.</li>';
        return;
    }
    if (!personas.length) {
        lista.innerHTML = `<li class="nuevo-mensaje-vacio">Aún no tienes conexiones. <a href="conexiones.html">Conecta con alguien</a> para escribirle.${pista}</li>`;
        return;
    }

    const q = sinTildes(texto.trim());
    const filtradas = personas.filter(p => sinTildes(p.nombre + ' ' + p.titular).includes(q));
    if (!filtradas.length) {
        lista.innerHTML = `<li class="nuevo-mensaje-vacio">Ninguna conexión coincide con «${escaparHtml(texto.trim())}».</li>`;
        return;
    }

    lista.innerHTML = filtradas.map(p => `
        <li>
            <button type="button" class="persona" data-id="${escaparHtml(p.id)}">
                <span class="connection-avatar-circle">${escaparHtml(p.nombre.charAt(0).toUpperCase())}</span>
                <span class="persona-texto">
                    <strong>${escaparHtml(p.nombre)}</strong>
                    ${p.titular ? `<small>${escaparHtml(p.titular)}</small>` : ''}
                </span>
                <i data-ico="chat"></i>
            </button>
        </li>`).join('');
}

// Utilidades
function scrollToBottom() {
    const container = document.getElementById('chatMessages');
    container.scrollTop = container.scrollHeight;
}
