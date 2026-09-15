// Utilidades compartidas del frontend

function formatCurrency(value) {
    const num = typeof value === 'number' ? value : parseInt(value);
    if (Number.isNaN(num)) return '$0';
    return '$' + Math.round(num).toLocaleString('es-CO');
}

// showTimeToday=true  → muestra HH:MM para hoy (usado en mensajes)
// showTimeToday=false → muestra 'Hoy' para hoy (usado en oportunidades, default)
function formatDate(dateString, showTimeToday = false) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        return showTimeToday
            ? date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
            : 'Hoy';
    }
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays} días`;
    if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} semanas`;
    return date.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });
}

function truncateText(text, maxLength) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}
