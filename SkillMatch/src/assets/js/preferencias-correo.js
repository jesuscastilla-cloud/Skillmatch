/* =====================================================================
 *  SkillMatch - "Correos que recibo"
 *
 *  PDF: "Cada persona elige qué correos recibe". Abre una ventana de ui.js
 *  (SkillMatchUI.ventana) con un interruptor por tipo de correo y los guarda
 *  en PUT /api/correos/preferencias. El botón es #correosBtn, en el menú
 *  "Más" de perfil-usuario.html y perfil-empresa.html.
 *
 *  Los códigos de seguridad (entrar, cambiar la contraseña) no se pueden apagar.
 * ===================================================================== */
(function () {
    'use strict';

    const PERSONAS = [
        { k: 'respuesta', t: 'Cuando una empresa responde mi postulación', d: 'Si no te aceptaron, el correo trae un consejo para la próxima.' },
        { k: 'mensajes', t: 'Cuando tengo un mensaje sin leer', d: 'Si lleva más de 2 horas sin leer. Como máximo uno al día por conversación.' },
        { k: 'vacantes', t: 'Vacantes nuevas para mí', d: 'Los lunes: las 3 vacantes nuevas que más se parecen a tus habilidades.' }
    ];
    const EMPRESAS = [
        { k: 'postulaciones', t: 'Cuando alguien se postula a mis vacantes', d: 'Un resumen al día, a las 7 p. m., no un correo por persona.' },
        { k: 'mensajes', t: 'Cuando tengo un mensaje sin leer', d: 'Si lleva más de 2 horas sin leer. Como máximo uno al día por conversación.' }
    ];

    const escapar = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    function esEmpresa() {
        try { return (JSON.parse(localStorage.getItem('userData') || 'null') || {}).userType === 'empresa'; } catch (e) { return false; }
    }

    function abrir() {
        if (!window.SkillMatchUI || typeof fetchWithAuth !== 'function') return;
        const opciones = esEmpresa() ? EMPRESAS : PERSONAS;
        const v = SkillMatchUI.ventana({
            id: 'ventanaCorreos',
            titulo: 'Correos que recibo',
            icono: 'mail',
            cuerpo:
                '<form class="correos-form" novalidate>' +
                  '<p class="confirmar-texto">Elige qué correos quieres recibir. Puedes cambiarlo cuando quieras; ' +
                    'cada correo trae también un enlace para dejar de recibirlo.</p>' +
                  '<ul class="correos-lista">' + opciones.map(o =>
                    '<li><label class="correos-opcion"><input type="checkbox" name="' + o.k + '" disabled>' +
                    '<span><strong>' + escapar(o.t) + '</strong><small>' + escapar(o.d) + '</small></span></label></li>').join('') +
                  '</ul>' +
                  '<p class="correos-nota"><i data-ico="lock"></i> Los códigos de seguridad (para entrar o cambiar la contraseña) siempre llegan.</p>' +
                  '<p class="error-text" role="alert" hidden></p>' +
                  '<div class="modal-actions">' +
                    '<button type="button" class="btn-secondary-modal" data-cancelar>Cancelar</button>' +
                    '<button type="submit" class="btn-primary-modal" disabled>Guardar</button>' +
                  '</div>' +
                '</form>'
        });
        const form = v.cuerpo.querySelector('form');
        const error = form.querySelector('.error-text');
        const guardar = form.querySelector('[type="submit"]');
        const problema = t => { error.textContent = t || ''; error.hidden = !t; };
        form.querySelector('[data-cancelar]').addEventListener('click', v.cerrar);

        fetchWithAuth('/correos/preferencias')
            .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
            .then(p => {
                opciones.forEach(o => {
                    const c = form.elements[o.k];
                    c.checked = !!p[o.k];
                    c.disabled = false;
                });
                guardar.disabled = false;
            })
            .catch(() => problema('No pudimos cargar tus preferencias. Intenta de nuevo.'));

        form.addEventListener('submit', e => {
            e.preventDefault();
            const cambios = {};
            opciones.forEach(o => { cambios[o.k] = form.elements[o.k].checked; });
            guardar.disabled = true;
            problema('');
            fetchWithAuth('/correos/preferencias', { method: 'PUT', body: JSON.stringify(cambios) })
                .then(r => {
                    if (!r.ok) throw new Error(r.status);
                    v.cerrar();
                    SkillMatchUI.aviso('Listo: guardamos qué correos quieres recibir.', 'ok');
                })
                .catch(() => { problema('No se pudo guardar. Intenta de nuevo.'); guardar.disabled = false; });
        });
    }

    function iniciar() {
        const boton = document.getElementById('correosBtn');
        if (boton) boton.addEventListener('click', abrir);
    }

    window.SkillMatchCorreos = { abrir: abrir };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
    else iniciar();
})();
