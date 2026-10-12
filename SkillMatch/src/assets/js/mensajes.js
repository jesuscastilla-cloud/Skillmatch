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

    // Ver perfil
    const viewProfileBtn = document.getElementById('viewProfileBtn');
    if (viewProfileBtn) {
        viewProfileBtn.addEventListener('click', () => {
            if (currentConversationUserId) {
                window.location.href = `perfil-usuario.html?id=${encodeURIComponent(currentConversationUserId)}`;
            }
        });
    }

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
            otherUserName: ((yoEnvie ? m.receiverName : m.senderName) || 'Usuario').replace(/s+Empresa$/, ''),
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
function displayConversations(conversationsList) {
    const container = document.getElementById('conversationsList');
    document.querySelector('.messages-container').classList.toggle('tiene-lista', conversations.length > 0);

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

    if (conversationsList.length === 0) {
        container.innerHTML = '<p class="conversations-vacio">Ninguna conversación coincide con tu búsqueda.</p>';
        return;
    }

    container.innerHTML = conversationsList.map(conv => {
        const isUnread = conv.unreadCount > 0;
        const unreadClass = isUnread ? 'unread' : '';
        const activa = String(conv.otherUserId) === String(currentConversationUserId) ? ' active' : '';
        const unreadBadge = isUnread ? `<span class="unread-badge">${conv.unreadCount}</span>` : '';

        return `
            <div class="conversation-item ${unreadClass}${activa}" data-user-id="${escaparHtml(conv.otherUserId)}" onclick="openConversation(this.dataset.userId)">
                <div class="conversation-avatar">${conv.otherUserName ? escaparHtml(conv.otherUserName.charAt(0)) : '<i data-ico="user"></i>'}</div>
                <div class="conversation-info">
                    <div class="conversation-header">
                        <h2>${escaparHtml(conv.otherUserName || 'Usuario')}</h2>
                        <span class="conversation-time">${formatDate(conv.lastMessageDate, true)}</span>
                    </div>
                    <p class="conversation-preview">${escaparHtml(truncateText(conv.lastMessageContent || '', 50))}</p>
                </div>
                ${unreadBadge}
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

    // Marcar como activa
    document.querySelectorAll('.conversation-item').forEach(item => {
        item.classList.toggle('active', item.dataset.userId === String(userId));
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
    } catch (error) {
        if (!conv) poner('Usuario', '');
    }
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

    if (messages.length === 0) {
        const nombre = document.getElementById('chatUserName').textContent;
        container.innerHTML = `<div class="no-messages chat-primer-mensaje">
            <p>Aún no hay mensajes con ${escaparHtml(nombre)}.</p>
            <p>Escribe el primero: preséntate y cuéntale por qué le escribes.</p></div>`;
        return;
    }

    container.innerHTML = messages.map(msg => {
        const isMyMessage = String(msg.senderId) === String(myUserId);
        const messageClass = isMyMessage ? 'message-sent' : 'message-received';

        return `
            <div class="message ${messageClass}">
                <div class="message-content">
                    <p>${escaparHtml(msg.content)}</p>
                    ${msg.attachmentUrl ? `<a href="${urlSegura(msg.attachmentUrl)}" target="_blank" rel="noopener" class="message-attachment"><i data-ico="clip"></i> Adjunto</a>` : ''}
                </div>
                <div class="message-info">
                    <span class="message-time">${formatDate(msg.sentAt, true)}</span>
                    ${isMyMessage && msg.isRead ? '<span class="message-read" title="Leído"><i data-ico="check"></i></span>' : ''}
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

// Filtrar conversaciones (también repinta la lista con el filtro puesto)
function filterConversations() {
    const campo = document.getElementById('searchConversations');
    const searchTerm = sinTildes(campo ? campo.value.trim() : '');

    const filtered = !searchTerm ? conversations : conversations.filter(conv =>
        sinTildes(conv.otherUserName).includes(searchTerm) ||
        sinTildes(conv.lastMessageContent).includes(searchTerm)
    );

    displayConversations(filtered);
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
