// Script para la página de mensajes

let conversations = [];
let currentConversationUserId = null;
let currentMessages = [];

document.addEventListener('DOMContentLoaded', function() {
    
    // Verificar autenticación
    if (!isAuthenticated()) {
        window.location.href = 'login-usuario.html';
        return;
    }

    // Cargar conversaciones
    loadConversations();
    
    // Event listeners
    setupEventListeners();
    
    // Actualizar cada 5 segundos
    setInterval(refreshCurrentConversation, 5000);
});

function setupEventListeners() {
    // Enviar mensaje
    const sendBtn = document.getElementById('sendMessageBtn');
    const messageInput = document.getElementById('messageInput');
    
    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }
    
    if (messageInput) {
        messageInput.addEventListener('keypress', (e) => {
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

    // Nuevo mensaje
    const newMessageBtn = document.getElementById('newMessageBtn');
    if (newMessageBtn) {
        newMessageBtn.addEventListener('click', () => {
            alert('Función en desarrollo: Selecciona un usuario desde Conexiones para enviar un mensaje');
        });
    }

    // Ver perfil
    const viewProfileBtn = document.getElementById('viewProfileBtn');
    if (viewProfileBtn) {
        viewProfileBtn.addEventListener('click', () => {
            if (currentConversationUserId) {
                window.location.href = `perfil-usuario.html?id=${currentConversationUserId}`;
            }
        });
    }

    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('token');
            localStorage.removeItem('userData');
            window.location.href = 'login.html';
        });
    }
}

// Cargar conversaciones
async function loadConversations() {
    const container = document.getElementById('conversationsList');

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/messages/conversations`);

        if (response.ok) {
            conversations = await response.json();
            displayConversations(conversations);
        } else {
            throw new Error('Error al cargar conversaciones');
        }
    } catch (error) {
        container.innerHTML = '<div class="error-message">Error al cargar conversaciones</div>';
    }
}

// Mostrar conversaciones
function displayConversations(conversationsList) {
    const container = document.getElementById('conversationsList');
    
    if (conversationsList.length === 0) {
        container.innerHTML = `
            <div class="no-conversations">
                <p>No tienes conversaciones aún</p>
                <p>Conecta con otros usuarios para comenzar a chatear</p>
            </div>
        `;
        return;
    }

    container.innerHTML = conversationsList.map(conv => {
        const isUnread = conv.unreadCount > 0;
        const unreadClass = isUnread ? 'unread' : '';
        const unreadBadge = isUnread ? `<span class="unread-badge">${conv.unreadCount}</span>` : '';
        
        return `
            <div class="conversation-item ${unreadClass}" data-user-id="${conv.otherUserId}" onclick="openConversation('${conv.otherUserId}')">
                <div class="conversation-avatar">${conv.otherUserName ? conv.otherUserName.charAt(0) : '<i data-ico="user"></i>'}</div>
                <div class="conversation-info">
                    <div class="conversation-header">
                        <h4>${conv.otherUserName || 'Usuario'}</h4>
                        <span class="conversation-time">${formatDate(conv.lastMessageDate, true)}</span>
                    </div>
                    <p class="conversation-preview">${truncateText(conv.lastMessageContent, 50)}</p>
                </div>
                ${unreadBadge}
            </div>
        `;
    }).join('');
}

// Abrir conversación
async function openConversation(userId) {
    currentConversationUserId = userId;
    
    // Marcar como activa
    document.querySelectorAll('.conversation-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`.conversation-item[data-user-id="${userId}"]`)?.classList.add('active');
    
    // Mostrar área de chat
    document.getElementById('chatEmpty').style.display = 'none';
    document.getElementById('chatActive').style.display = 'flex';
    
    // Cargar mensajes
    await loadMessages(userId);
    
    // Marcar como leído
    markConversationAsRead(userId);
}

// Cargar mensajes de una conversación
async function loadMessages(otherUserId) {
    if (!otherUserId || otherUserId === 'undefined' || otherUserId === null) {
        return;
    }
    
    const container = document.getElementById('chatMessages');

    container.innerHTML = '<div class="loading-message">Cargando mensajes...</div>';

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/messages/conversation/${otherUserId}`);

        if (response.ok) {
            currentMessages = await response.json();
            displayMessages(currentMessages);
            
            // Actualizar header del chat
            const conversation = conversations.find(c => c.otherUserId === otherUserId);
            if (conversation) {
                document.getElementById('chatUserName').textContent = conversation.otherUserName;
                document.getElementById('chatAvatar').textContent = conversation.otherUserName.charAt(0);
            }
            
            // Scroll al final
            scrollToBottom();
        } else {
            throw new Error('Error al cargar mensajes');
        }
    } catch (error) {
        container.innerHTML = '<div class="error-message">Error al cargar mensajes</div>';
    }
}

// Mostrar mensajes
function displayMessages(messages) {
    const container = document.getElementById('chatMessages');
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    const myUserId = userData.id;
    
    if (messages.length === 0) {
        container.innerHTML = '<div class="no-messages">No hay mensajes en esta conversación</div>';
        return;
    }

    container.innerHTML = messages.map(msg => {
        const isMyMessage = msg.senderId === myUserId;
        const messageClass = isMyMessage ? 'message-sent' : 'message-received';
        
        return `
            <div class="message ${messageClass}">
                <div class="message-content">
                    <p>${msg.content}</p>
                    ${msg.attachmentUrl ? `<a href="${msg.attachmentUrl}" target="_blank" class="message-attachment"><i data-ico="clip"></i> Adjunto</a>` : ''}
                </div>
                <div class="message-info">
                    <span class="message-time">${formatDate(msg.sentAt, true)}</span>
                    ${isMyMessage && msg.isRead ? '<span class="message-read"><i data-ico="check"></i></span>' : ''}
                </div>
            </div>
        `;
    }).join('');
}

// Enviar mensaje
async function sendMessage() {
    if (!currentConversationUserId) return;
    
    const input = document.getElementById('messageInput');
    const content = input.value.trim();
    
    if (!content) return;
    
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/messages`, {
            method: 'POST',
            body: JSON.stringify({
                receiverId: currentConversationUserId,
                content: content
            })
        });

        if (response.ok) {
            input.value = '';
            await loadMessages(currentConversationUserId);
            await loadConversations(); // Actualizar lista
        } else {
            throw new Error('Error al enviar mensaje');
        }
    } catch (error) {
        alert('Error al enviar mensaje');
    }
}

// Marcar conversación como leída
async function markConversationAsRead(otherUserId) {
    if (!otherUserId || otherUserId === 'undefined' || otherUserId === null) {
        return;
    }
    
    try {
        await fetchWithAuth(`${API_BASE_URL}/messages/conversation/${otherUserId}/read-all`, {
            method: 'PATCH'
        });
        
        // Actualizar contador de no leídos
        const conversation = conversations.find(c => c.otherUserId === otherUserId);
        if (conversation) {
            conversation.unreadCount = 0;
        }
        
        // Actualizar badge en la conversación
        const badge = document.querySelector(`.conversation-item[data-user-id="${otherUserId}"] .unread-badge`);
        if (badge) {
            badge.remove();
        }
        
    } catch (error) {
    }
}

// Refrescar conversación actual
async function refreshCurrentConversation() {
    if (currentConversationUserId && currentConversationUserId !== null && currentConversationUserId !== undefined) {
        const prevLength = currentMessages.length;
        await loadMessages(currentConversationUserId);
        
        // Solo hacer scroll si hay mensajes nuevos
        if (currentMessages.length > prevLength) {
            scrollToBottom();
        }
    }
}

// Filtrar conversaciones
function filterConversations() {
    const searchTerm = document.getElementById('searchConversations').value.toLowerCase();
    
    const filtered = conversations.filter(conv => 
        conv.otherUserName.toLowerCase().includes(searchTerm) ||
        conv.lastMessageContent.toLowerCase().includes(searchTerm)
    );
    
    displayConversations(filtered);
}

// Utilidades
function scrollToBottom() {
    const container = document.getElementById('chatMessages');
    container.scrollTop = container.scrollHeight;
}

