/*
 * Paginas legales (privacidad, politica de datos, declaracion de datos, cookies y terminos).
 *
 *  - Dibuja las pastillas para pasar de un documento a otro, marcando el actual.
 *  - Dibuja la ficha del responsable del tratamiento con los datos de DATOS_LEGALES:
 *    solo aparece una linea si el dato esta escrito. Para agregar el NIT, la direccion o el
 *    telefono basta con escribirlos aqui; se actualizan todas las paginas a la vez.
 *    (La razon social y el NIT son obligatorios para vender: ver docs/OPERACION.md.)
 */
(function () {
    'use strict';

    const DATOS_LEGALES = {
        nombre: 'SkillMatch Cartagena',   // razon social o nombre del responsable
        nit: '',                          // NIT o documento
        direccion: '',                    // direccion fisica (sin la ciudad)
        ciudad: 'Cartagena de Indias, Bolívar, Colombia',
        correo: 'skillmatchproject@gmail.com',
        telefono: ''
    };

    const DOCUMENTOS = [
        ['privacidad.html', 'Centro de privacidad'],
        ['politica-datos.html', 'Política de datos'],
        ['declaracion-datos.html', 'Declaración de datos'],
        ['cookies.html', 'Cookies'],
        ['terminos.html', 'Términos de uso']
    ];

    function esc(t) {
        return String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function pintarNavegacion() {
        const caja = document.querySelector('[data-legal-nav]');
        if (!caja) return;
        const actual = location.pathname.split('/').pop() || '';
        caja.innerHTML = '<nav class="legal-nav" aria-label="Documentos de privacidad y legales"><ul>' +
            DOCUMENTOS.map(d => '<li><a href="' + d[0] + '"' + (d[0] === actual ? ' aria-current="page"' : '') + '>' + d[1] + '</a></li>').join('') +
            '</ul></nav>';
    }

    function pintarFichas() {
        const d = DATOS_LEGALES;
        const filas = [
            ['Nombre o razón social', esc(d.nombre)],
            d.nit ? ['NIT o documento', esc(d.nit)] : null,
            ['Dirección', esc((d.direccion ? d.direccion + ', ' : '') + d.ciudad)],
            ['Correo para consultas y reclamos', '<a href="mailto:' + esc(d.correo) + '">' + esc(d.correo) + '</a>'],
            d.telefono ? ['Teléfono', esc(d.telefono)] : null
        ].filter(Boolean);
        if (!d.direccion) filas.splice(filas.findIndex(f => f[0] === 'Dirección'), 1, ['Ciudad', esc(d.ciudad)]);
        document.querySelectorAll('[data-ficha-responsable]').forEach(dl => {
            dl.innerHTML = filas.map(f => '<dt>' + f[0] + '</dt><dd>' + f[1] + '</dd>').join('');
        });
    }

    function iniciar() {
        pintarNavegacion();
        pintarFichas();
    }

    window.SkillMatchLegal = { datos: DATOS_LEGALES, documentos: DOCUMENTOS, pintar: iniciar };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
    else iniciar();
})();
