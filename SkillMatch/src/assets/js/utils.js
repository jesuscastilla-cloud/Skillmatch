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
    if (Number.isNaN(date.getTime())) return '';
    // Se cuentan dias de calendario. Antes se redondeaba hacia arriba la
    // diferencia en horas: cualquier cosa de las ultimas 24 h decia "Ayer"
    // y nunca salia "Hoy" ni la hora.
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const dia = new Date(date); dia.setHours(0, 0, 0, 0);
    const diffDays = Math.round((hoy - dia) / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
        return showTimeToday
            ? date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
            : 'Hoy';
    }
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays} días`;
    if (diffDays < 30) {
        const semanas = Math.floor(diffDays / 7);
        return semanas === 1 ? 'Hace 1 semana' : `Hace ${semanas} semanas`;
    }
    return date.toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' });
}

function truncateText(text, maxLength) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}
