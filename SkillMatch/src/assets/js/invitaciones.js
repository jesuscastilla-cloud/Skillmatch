/* =====================================================================
 *  SkillMatch - Invitaciones a la siguiente etapa
 *
 *  Empresa (perfil-empresa.html):
 *   - "Invitar a siguiente etapa" en Postulaciones recibidas: se eligen candidatos con
 *     casillas y se invitan todos de una vez a una entrevista o evaluacion con horarios.
 *   - Seccion "Invitaciones": cada proceso con sus cifras y el panel de respuestas.
 *   - Tarjeta "Plan y uso" en la columna de la izquierda.
 *  Persona (perfil-usuario.html):
 *   - Tarjeta "Tus invitaciones": confirmar un horario o avisar que no puede.
 *
 *  API: /api/invitaciones (ver InvitacionController) y /api/planes/mio.
 *  Las ilustraciones (SVG) tambien las usa planes.js.
 * ===================================================================== */
(function () {
    'use strict';

    const esc = s => (typeof escaparHtml === 'function' ? escaparHtml(s == null ? '' : String(s)) : String(s == null ? '' : s));
    const api = (ruta, op) => fetchWithAuth(`${API_BASE_URL}${ruta}`, op);
    const aviso = (t, tipo) => window.SkillMatchUI && SkillMatchUI.aviso(t, tipo);
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ------------------------------------------------------------------ fechas
    const fecha = v => (v ? new Date(v) : null);
    const diaHora = v => fecha(v).toLocaleString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' });
    const diaCorto = v => fecha(v).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });
    const hora = v => fecha(v).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
    const aLocal = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const mayus = t => t.charAt(0).toUpperCase() + t.slice(1);
    const pesos = n => '$' + Number(n || 0).toLocaleString('es-CO');

    // ------------------------------------------------------------------ ilustraciones (SVG con los colores de la marca)
    const ILUSTRACIONES = {
        invitar: `<svg viewBox="0 0 320 190" class="ilus" aria-hidden="true">
            <circle cx="160" cy="98" r="78" class="ilus-halo"/>
            <path d="M84 104 C 120 60, 200 60, 236 104" class="ilus-camino"/>
            <g class="ilus-flota"><rect x="128" y="58" width="64" height="48" rx="10" class="ilus-sobre"/>
              <path d="M130 62 l30 24 l30 -24" class="ilus-sobre-linea"/></g>
            <g transform="translate(48 112)"><circle r="22" class="ilus-tu"/><circle cy="-6" r="7" class="ilus-cara"/><path d="M-11 12 a11 9 0 0 1 22 0" class="ilus-cara"/>
              <circle cx="16" cy="-16" r="9" class="ilus-ok"/><path d="M12 -16 l3 3 l6 -6" class="ilus-check"/></g>
            <g transform="translate(160 150)"><circle r="22" class="ilus-azul"/><circle cy="-6" r="7" class="ilus-cara"/><path d="M-11 12 a11 9 0 0 1 22 0" class="ilus-cara"/>
              <circle cx="16" cy="-16" r="9" class="ilus-reloj"/><path d="M16 -21 v5 h4" class="ilus-check"/></g>
            <g transform="translate(272 112)"><circle r="22" class="ilus-naranja"/><circle cy="-6" r="7" class="ilus-cara"/><path d="M-11 12 a11 9 0 0 1 22 0" class="ilus-cara"/>
              <circle cx="16" cy="-16" r="9" class="ilus-ok"/><path d="M12 -16 l3 3 l6 -6" class="ilus-check"/></g>
            <circle cx="96" cy="40" r="4" class="ilus-chispa"/><circle cx="232" cy="34" r="3" class="ilus-chispa"/><circle cx="250" cy="58" r="2.5" class="ilus-chispa2"/>
        </svg>`,
        horarios: `<svg viewBox="0 0 320 190" class="ilus" aria-hidden="true">
            <circle cx="160" cy="96" r="80" class="ilus-halo"/>
            <rect x="88" y="40" width="144" height="118" rx="16" class="ilus-tarjeta"/>
            <rect x="88" y="40" width="144" height="30" rx="16" class="ilus-tarjeta-top"/>
            <rect x="88" y="56" width="144" height="14" class="ilus-tarjeta-top"/>
            <circle cx="116" cy="40" r="5" class="ilus-aro"/><circle cx="204" cy="40" r="5" class="ilus-aro"/>
            <g class="ilus-celdas">${[0, 1, 2, 3].map(f => [0, 1, 2, 3].map(c => `<rect x="${102 + c * 30}" y="${82 + f * 18}" width="22" height="12" rx="4" class="${(f === 1 && c === 2) ? 'ilus-celda-si' : (f === 2 && c === 0) ? 'ilus-celda-2' : 'ilus-celda'}"/>`).join('')).join('')}</g>
            <g class="ilus-flota"><circle cx="232" cy="150" r="20" class="ilus-ok"/><path d="M223 150 l6 6 l12 -12" class="ilus-check ilus-check-g"/></g>
        </svg>`,
        panel: `<svg viewBox="0 0 320 190" class="ilus" aria-hidden="true">
            <circle cx="160" cy="96" r="80" class="ilus-halo"/>
            <rect x="74" y="44" width="172" height="112" rx="16" class="ilus-tarjeta"/>
            ${[0, 1, 2].map(i => `<g transform="translate(92 ${66 + i * 28})"><circle r="9" class="${['ilus-tu', 'ilus-azul', 'ilus-naranja'][i]}"/>
              <rect x="18" y="-6" width="${[96, 70, 84][i]}" height="12" rx="6" class="ilus-barra"/>
              <rect x="122" y="-8" width="28" height="16" rx="8" class="${['ilus-pill-si', 'ilus-pill-espera', 'ilus-pill-si'][i]}"/></g>`).join('')}
            <g class="ilus-flota"><circle cx="246" cy="52" r="16" class="ilus-naranja"/><path d="M239 52 l5 5 l9 -9" class="ilus-check"/></g>
        </svg>`,
        listo: `<svg viewBox="0 0 320 170" class="ilus" aria-hidden="true">
            <circle cx="160" cy="84" r="70" class="ilus-halo"/>
            <circle cx="160" cy="84" r="42" class="ilus-ok-grande"/>
            <path d="M140 84 l14 14 l26 -28" class="ilus-check ilus-check-g"/>
            <circle cx="96" cy="44" r="5" class="ilus-chispa"/><circle cx="226" cy="38" r="4" class="ilus-chispa2"/><circle cx="236" cy="118" r="5" class="ilus-chispa"/>
            <circle cx="88" cy="122" r="3.5" class="ilus-chispa2"/><path d="M214 64 l10 -4" class="ilus-raya"/><path d="M100 70 l-10 -4" class="ilus-raya"/>
        </svg>`,
        planes: `<svg viewBox="0 0 360 230" class="ilus ilus-hero" aria-hidden="true">
            <circle cx="180" cy="118" r="98" class="ilus-halo"/>
            <rect x="40" y="68" width="112" height="98" rx="18" class="ilus-tarjeta"/>
            <rect x="58" y="88" width="36" height="36" rx="10" class="ilus-azul"/><path d="M68 116 v-14 h16 v14 M72 106 h8" class="ilus-cara-l"/>
            <rect x="58" y="134" width="76" height="9" rx="4.5" class="ilus-barra"/><rect x="58" y="149" width="52" height="9" rx="4.5" class="ilus-barra"/>
            <path d="M152 116 C 190 116, 196 70, 236 70 M152 116 C 190 116, 196 118, 236 118 M152 116 C 190 116, 196 166, 236 166" class="ilus-camino"/>
            ${[70, 118, 166].map((y, i) => `<g transform="translate(262 ${y})"><circle r="21" class="${['ilus-tu', 'ilus-azul', 'ilus-naranja'][i]}"/><circle cy="-6" r="7" class="ilus-cara"/><path d="M-11 11 a11 9 0 0 1 22 0" class="ilus-cara"/>
              <circle cx="17" cy="-14" r="9" class="${i === 1 ? 'ilus-reloj' : 'ilus-ok'}"/>${i === 1 ? '<path d="M17 -19 v5 h4" class="ilus-check"/>' : '<path d="M13 -14 l3 3 l6 -6" class="ilus-check"/>'}</g>`).join('')}
            <g class="ilus-flota"><rect x="160" y="22" width="58" height="40" rx="9" class="ilus-sobre"/><path d="M162 26 l27 20 l27 -20" class="ilus-sobre-linea"/></g>
            <circle cx="122" cy="40" r="4" class="ilus-chispa"/><circle cx="318" cy="208" r="4" class="ilus-chispa2"/><circle cx="36" cy="196" r="3" class="ilus-chispa"/>
        </svg>`
    };
    function ilustracion(nombre) { return ILUSTRACIONES[nombre] || ''; }

    // ------------------------------------------------------------------ plan (se pide una vez)
    let planPromesa = null;
    function plan(forzar) {
        if (!planPromesa || forzar) {
            planPromesa = api('/planes/mio').then(r => (r.ok ? r.json() : null)).catch(() => null);
        }
        return planPromesa;
    }

    const TIPOS = { ENTREVISTA: 'Entrevista', EVALUACION: 'Evaluación corta' };
    const MODALIDADES = { PRESENCIAL: 'Presencial', VIRTUAL: 'Virtual' };
    const ESTADO_PERSONA = {
        PENDIENTE: ['Sin responder', 'espera', 'clock'],
        CONFIRMADA: ['Confirmó', 'si', 'check'],
        RECHAZADA: ['No puede asistir', 'no', 'close'],
        VENCIDA: ['No respondió a tiempo', 'gris', 'clock'],
        CANCELADA: ['Proceso cancelado', 'gris', 'close']
    };

    function esEmpresa() {
        try { return (JSON.parse(localStorage.getItem('userData') || 'null') || {}).userType === 'empresa'; } catch (e) { return false; }
    }

    /* ==================================================================
     *  EMPRESA
     * ================================================================== */
    const seleccion = new Set();
    let modo = false;

    function postulaciones() { try { return typeof postulacionesEmpresa !== 'undefined' ? postulacionesEmpresa : []; } catch (e) { return []; } }
    function postulacion(id) { return postulaciones().find(a => String(a.id) === String(id)); }
    function estadoApp(app) {
        if (typeof estadoPostulacionEmpresa === 'function') return estadoPostulacionEmpresa(app);
        return String(app.status || 'pendiente').toLowerCase();
    }
    const invitable = app => app && !['rechazada', 'retirada', 'rejected'].includes(estadoApp(app));

    function prepararEmpresa() {
        const seccion = document.getElementById('candidatos');
        if (!seccion) return;
        const herramientas = seccion.querySelector('.postulaciones-herramientas');
        if (herramientas && !document.getElementById('invitarModo')) {
            herramientas.insertAdjacentHTML('beforeend',
                `<button type="button" class="btn btn-primary btn-small btn-invitar" id="invitarModo" hidden><i data-ico="send"></i> Invitar a siguiente etapa</button>`);
            document.getElementById('invitarModo').addEventListener('click', () => (modo ? salirDeModo() : entrarEnModo()));
        }
        // Las tarjetas se vuelven a pintar (ordenar, aceptar, recargar): se les pone la casilla cada vez
        const lista = document.getElementById('applications-list');
        if (lista) {
            new MutationObserver(() => {
                const hay = !!lista.querySelector('.application-card');
                const boton = document.getElementById('invitarModo');
                if (boton) boton.hidden = !hay;
                if (modo) ponerCasillas();
            }).observe(lista, { childList: true, subtree: true });
        }
        document.body.insertAdjacentHTML('beforeend', `
            <div class="invitar-barra" id="invitarBarra" role="region" aria-label="Candidatos elegidos" hidden>
                <span class="invitar-barra-cuenta" id="invitarCuenta" aria-live="polite"></span>
                <button type="button" class="invitar-barra-link" id="invitarMejores"><i data-ico="target"></i> Elegir los de 70 % o más</button>
                <button type="button" class="invitar-barra-link" id="invitarCancelar">Cancelar</button>
                <button type="button" class="btn btn-primary btn-small" id="invitarAbrir" disabled><i data-ico="send"></i> Invitar</button>
            </div>`);
        document.getElementById('invitarCancelar').addEventListener('click', salirDeModo);
        document.getElementById('invitarMejores').addEventListener('click', elegirMejores);
        document.getElementById('invitarAbrir').addEventListener('click', abrirInvitar);
        prepararPanel();
        prepararPlanLateral();
        const pedido = new URLSearchParams(location.search).get('invitacion');
        if (pedido) abrirDetalle(pedido);
    }

    function entrarEnModo() {
        modo = true;
        if (typeof mostrarVistaPostulaciones === 'function' && typeof vistaPostulaciones !== 'undefined' && vistaPostulaciones === 'tablero') mostrarVistaPostulaciones('lista', false);
        const verTodas = document.querySelector('#applications-list .btn-ver-todas');
        if (verTodas && typeof showAllApplications === 'function') showAllApplications(verTodas);
        document.getElementById('candidatos').classList.add('modo-invitar');
        const b = document.getElementById('invitarModo');
        b.innerHTML = '<i data-ico="close"></i> Salir de la selección';
        b.classList.replace('btn-primary', 'btn-secondary');
        ponerCasillas();
        actualizarBarra();
        document.getElementById('invitarBarra').hidden = false;
        document.body.classList.add('con-barra-invitar');
        document.getElementById('candidatos').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }

    function salirDeModo() {
        modo = false;
        seleccion.clear();
        const s = document.getElementById('candidatos');
        if (s) s.classList.remove('modo-invitar');
        document.querySelectorAll('.invitar-check').forEach(c => c.remove());
        document.querySelectorAll('.application-card.is-elegida').forEach(c => c.classList.remove('is-elegida'));
        const b = document.getElementById('invitarModo');
        if (b) { b.innerHTML = '<i data-ico="send"></i> Invitar a siguiente etapa'; b.classList.replace('btn-secondary', 'btn-primary'); }
        const barra = document.getElementById('invitarBarra');
        if (barra) barra.hidden = true;
        document.body.classList.remove('con-barra-invitar');
    }

    function ponerCasillas() {
        document.querySelectorAll('#applications-list .application-card').forEach(card => {
            const id = card.dataset.applicationId;
            if (card.querySelector('.invitar-check')) return;
            const app = postulacion(id);
            const ok = invitable(app);
            card.querySelector('.application-header').insertAdjacentHTML('afterbegin', ok
                ? `<label class="invitar-check" title="Elegir a ${esc(app.userName || 'este candidato')}"><input type="checkbox" data-invitar="${esc(id)}"${seleccion.has(id) ? ' checked' : ''}><span class="sr-only">Elegir a ${esc(app.userName || 'este candidato')}</span></label>`
                : `<span class="invitar-check is-no" title="Ya no está en el proceso"><i data-ico="minus"></i></span>`);
            if (seleccion.has(id)) card.classList.add('is-elegida');
            const input = card.querySelector('[data-invitar]');
            if (input) input.addEventListener('change', () => {
                if (input.checked) seleccion.add(id); else seleccion.delete(id);
                card.classList.toggle('is-elegida', input.checked);
                actualizarBarra();
            });
        });
    }

    function elegirMejores() {
        let n = 0;
        postulaciones().forEach(app => {
            if (invitable(app) && app.compatibilidad >= 70) { seleccion.add(String(app.id)); n++; }
        });
        document.querySelectorAll('[data-invitar]').forEach(i => {
            i.checked = seleccion.has(i.dataset.invitar);
            i.closest('.application-card').classList.toggle('is-elegida', i.checked);
        });
        actualizarBarra();
        aviso(n ? `Elegiste ${n} ${n === 1 ? 'candidato' : 'candidatos'} con 70 % o más de match.` : 'Ningún candidato llega al 70 % de match todavía.', n ? 'ok' : 'info');
    }

    function elegidos() { return [...seleccion].map(postulacion).filter(Boolean); }

    function actualizarBarra() {
        const lista = elegidos();
        const vacantes = new Set(lista.map(a => a.jobId));
        const cuenta = document.getElementById('invitarCuenta');
        const boton = document.getElementById('invitarAbrir');
        if (!cuenta || !boton) return;
        if (!lista.length) {
            cuenta.innerHTML = 'Elige a los candidatos que quieres invitar';
        } else if (vacantes.size > 1) {
            cuenta.innerHTML = `<strong>${lista.length}</strong> elegidos · <span class="invitar-aviso">elige candidatos de una sola vacante</span>`;
        } else {
            cuenta.innerHTML = `<strong>${lista.length}</strong> ${lista.length === 1 ? 'elegido' : 'elegidos'} · ${esc(lista[0].jobTitle || 'Vacante')}`;
        }
        boton.disabled = !lista.length || vacantes.size > 1;
        boton.innerHTML = `<i data-ico="send"></i> Invitar${lista.length ? ' (' + lista.length + ')' : ''}`;
        const mejores = document.getElementById('invitarMejores');
        if (mejores) mejores.hidden = !postulaciones().some(a => a.compatibilidad >= 0);
    }

    // ------------------------------------------------------------------ ventana de invitar (3 pasos)
    function proximoDiaHabil(horaInicio) {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
        d.setHours(horaInicio, 0, 0, 0);
        return d;
    }

    async function abrirInvitar() {
        const lista = elegidos();
        if (!lista.length) return;
        const p = await plan(true);
        const limiteHorarios = p ? p.plan.horariosPorProceso : 3;
        const quedan = p ? Math.max(0, p.uso.limiteMes - p.uso.invitacionesMes) : null;
        const cupos = Math.max(1, Math.ceil(lista.length / 2));
        const h1 = proximoDiaHabil(9), h2 = proximoDiaHabil(10);
        const datos = {
            tipo: 'ENTREVISTA', modalidad: 'PRESENCIAL', lugar: '', enlace: '', indicaciones: '', duracionMinutos: 30,
            horarios: [{ inicio: aLocal(h1), cupos }, { inicio: aLocal(h2), cupos }]
        };
        let paso = 1;

        const barra = document.getElementById('invitarBarra');
        if (barra) barra.hidden = true;
        const v = SkillMatchUI.ventana({
            id: 'ventanaInvitar', titulo: 'Invitar a siguiente etapa', icono: 'send', ancha: true,
            cuerpo: '<div class="invitar-flujo" id="invitarFlujo"></div>',
            alCerrar: () => { if (modo && barra) barra.hidden = false; }
        });
        const caja = v.cuerpo.querySelector('#invitarFlujo');

        function pasos() {
            return `<ol class="invitar-pasos" aria-label="Pasos">
                ${['Qué y dónde', 'Horarios', 'Revisar y enviar'].map((t, i) => `<li class="${i + 1 === paso ? 'is-actual' : i + 1 < paso ? 'is-hecho' : ''}"><span>${i + 1 < paso ? '<i data-ico="check"></i>' : i + 1}</span>${t}</li>`).join('')}
            </ol>`;
        }

        function pintar() {
            if (paso === 1) {
                caja.innerHTML = pasos() + `
                    <p class="invitar-intro">Vas a invitar a <strong>${lista.length} ${lista.length === 1 ? 'candidato' : 'candidatos'}</strong> de <strong>${esc(lista[0].jobTitle || 'tu vacante')}</strong>.</p>
                    <fieldset class="invitar-opciones"><legend>¿Qué sigue en tu proceso?</legend>
                        ${Object.entries(TIPOS).map(([k, t]) => `<label class="invitar-opcion"><input type="radio" name="tipo" value="${k}"${datos.tipo === k ? ' checked' : ''}>
                            <span class="invitar-opcion-caja"><i data-ico="${k === 'ENTREVISTA' ? 'chat' : 'list'}"></i><strong>${t}</strong><small>${k === 'ENTREVISTA' ? 'Una conversación para conocerse' : 'Una prueba breve de habilidades'}</small></span></label>`).join('')}
                    </fieldset>
                    <fieldset class="invitar-opciones"><legend>¿Dónde?</legend>
                        ${Object.entries(MODALIDADES).map(([k, t]) => `<label class="invitar-opcion"><input type="radio" name="modalidad" value="${k}"${datos.modalidad === k ? ' checked' : ''}>
                            <span class="invitar-opcion-caja"><i data-ico="${k === 'PRESENCIAL' ? 'building' : 'desktop'}"></i><strong>${t}</strong><small>${k === 'PRESENCIAL' ? 'En tu empresa o en otro lugar' : 'Por videollamada o en línea'}</small></span></label>`).join('')}
                    </fieldset>
                    <div class="form-group" id="invitarLugarCaja"${datos.modalidad === 'VIRTUAL' ? ' hidden' : ''}>
                        <label for="invitarLugar">Dirección</label>
                        <input type="text" id="invitarLugar" maxlength="200" placeholder="Ej.: Cra. 3 # 10-20, Bocagrande, piso 2" value="${esc(datos.lugar)}">
                        <small>Las personas la ven cuando confirman.</small>
                    </div>
                    <div class="form-group" id="invitarEnlaceCaja"${datos.modalidad === 'PRESENCIAL' ? ' hidden' : ''}>
                        <label for="invitarEnlace">Enlace de la reunión o de la evaluación</label>
                        <input type="url" id="invitarEnlace" maxlength="490" inputmode="url" placeholder="https://" value="${esc(datos.enlace)}">
                        <small>Las personas lo ven cuando confirman.</small>
                    </div>
                    <div class="invitar-fila">
                        <div class="form-group"><label for="invitarDuracion">Duración</label>
                            <select id="invitarDuracion">${[15, 30, 45, 60, 90, 120].map(m => `<option value="${m}"${datos.duracionMinutos === m ? ' selected' : ''}>${m < 60 ? m + ' minutos' : (m / 60) + (m === 60 ? ' hora' : ' horas')}</option>`).join('')}</select></div>
                    </div>
                    <div class="form-group"><label for="invitarIndicaciones">Indicaciones (opcional)</label>
                        <textarea id="invitarIndicaciones" rows="3" maxlength="1000" placeholder="Ej.: Trae tu documento de identidad. Pregunta por Laura en recepción.">${esc(datos.indicaciones)}</textarea></div>
                    <p class="error-text" id="invitarError" role="alert" hidden></p>
                    <div class="modal-actions"><button type="button" class="btn-secondary-modal" data-cerrar>Cancelar</button>
                        <button type="button" class="btn-primary-modal" data-siguiente>Siguiente: horarios <i data-ico="arrow"></i></button></div>`;
                caja.querySelectorAll('input[name="modalidad"]').forEach(r => r.addEventListener('change', () => {
                    datos.modalidad = r.value;
                    caja.querySelector('#invitarLugarCaja').hidden = r.value !== 'PRESENCIAL';
                    caja.querySelector('#invitarEnlaceCaja').hidden = r.value !== 'VIRTUAL';
                }));
            } else if (paso === 2) {
                caja.innerHTML = pasos() + `
                    <div class="invitar-horarios-cabeza">${ilustracion('horarios')}
                        <p>Propón los horarios en que puedes atender. Cada persona elige el que le sirva; cuando un horario se llena, ya no aparece.</p></div>
                    <ul class="invitar-horarios" id="invitarHorarios"></ul>
                    <button type="button" class="invitar-agregar" id="invitarAgregar"><i data-ico="plus"></i> Agregar horario</button>
                    <p class="invitar-limite" id="invitarLimiteHorarios"></p>
                    <div class="form-group invitar-plazo"><label for="invitarPlazo">Pueden responder hasta</label>
                        <input type="datetime-local" id="invitarPlazo" value="${esc(datos.respondeAntesDe || '')}">
                        <small>Si lo dejas así, hasta 2 horas antes del primer horario.</small></div>
                    <p class="error-text" id="invitarError" role="alert" hidden></p>
                    <div class="modal-actions"><button type="button" class="btn-secondary-modal" data-atras><span class="ico-atras"><i data-ico="arrow"></i></span> Atrás</button>
                        <button type="button" class="btn-primary-modal" data-siguiente>Revisar <i data-ico="arrow"></i></button></div>`;
                pintarHorarios();
                caja.querySelector('#invitarAgregar').addEventListener('click', () => {
                    const ultimo = datos.horarios.length ? new Date(datos.horarios[datos.horarios.length - 1].inicio) : proximoDiaHabil(9);
                    ultimo.setHours(ultimo.getHours() + 1);
                    datos.horarios.push({ inicio: aLocal(ultimo), cupos });
                    pintarHorarios();
                });
            } else if (paso === 3) {
                const horarios = [...datos.horarios].sort((a, b) => a.inicio.localeCompare(b.inicio));
                const primero = new Date(horarios[0].inicio);
                const limite = datos.respondeAntesDe ? new Date(datos.respondeAntesDe) : new Date(primero.getTime() - 2 * 3600 * 1000);
                caja.innerHTML = pasos() + `
                    <div class="invitar-revisar">
                        <div class="invitar-vista" aria-label="Así le llega a cada candidato">
                            <p class="invitar-vista-eti"><i data-ico="eye"></i> Así le llega a cada candidato</p>
                            <div class="invitacion-tarjeta">
                                <span class="invitacion-tipo"><i data-ico="${datos.tipo === 'ENTREVISTA' ? 'chat' : 'list'}"></i> ${TIPOS[datos.tipo]} · ${MODALIDADES[datos.modalidad]}</span>
                                <h3>${esc(empresaNombre())} te invita a la siguiente etapa</h3>
                                <p class="invitacion-vacante">${esc(lista[0].jobTitle || '')} · ${datos.duracionMinutos} minutos</p>
                                <p class="invitacion-donde"><i data-ico="${datos.modalidad === 'PRESENCIAL' ? 'pin' : 'desktop'}"></i> ${datos.modalidad === 'PRESENCIAL'
                                    ? esc(datos.lugar) : 'En línea: el enlace lo ve cada persona cuando confirma'}</p>
                                <p class="invitacion-sub">Elige el horario que te sirva:</p>
                                <ul class="invitacion-horarios-mini">${horarios.map(h => `<li><i data-ico="calendar"></i> ${esc(mayus(diaHora(h.inicio)))}</li>`).join('')}</ul>
                                <p class="invitacion-plazo"><i data-ico="clock"></i> Responde antes del ${esc(diaHora(aLocal(limite)))}</p>
                                ${datos.indicaciones ? `<p class="invitacion-indicaciones">${esc(datos.indicaciones)}</p>` : ''}
                            </div>
                        </div>
                        <div class="invitar-resumen">
                            <h3>Vas a invitar a</h3>
                            <ul class="invitar-personas">${lista.map(a => `<li>${a.compatibilidad >= 0 ? `<span class="match-ring match-ring-sm" data-pct="${a.compatibilidad}" role="img" aria-label="${a.compatibilidad} por ciento de match"></span>` : '<span class="invitar-sin-anillo"><i data-ico="user"></i></span>'}<span><strong>${esc(a.userName || 'Candidato')}</strong><small>${esc(a.userHeadline || '')}</small></span></li>`).join('')}</ul>
                            ${quedan !== null ? `<p class="invitar-uso ${lista.length > quedan ? 'is-alerta' : ''}"><i data-ico="send"></i><span>Usarás <strong>${lista.length}</strong> de las <strong>${quedan}</strong> invitaciones que te quedan este mes.</span></p>` : ''}
                            <p class="invitar-nota">Cada persona recibe un aviso en SkillMatch y, si tiene activados estos correos, también un correo. Tú ves sus respuestas en «Invitaciones».</p>
                        </div>
                    </div>
                    <div class="invitar-cupo" id="invitarCupo" hidden></div>
                    <p class="error-text" id="invitarError" role="alert" hidden></p>
                    <div class="modal-actions"><button type="button" class="btn-secondary-modal" data-atras><span class="ico-atras"><i data-ico="arrow"></i></span> Atrás</button>
                        <button type="button" class="btn-primary-modal" data-enviar><i data-ico="send"></i> Enviar ${lista.length === 1 ? 'invitación' : lista.length + ' invitaciones'}</button></div>`;
            }
            caja.querySelectorAll('[data-cerrar]').forEach(b => b.addEventListener('click', v.cerrar));
            const sig = caja.querySelector('[data-siguiente]');
            if (sig) sig.addEventListener('click', siguiente);
            const atras = caja.querySelector('[data-atras]');
            if (atras) atras.addEventListener('click', () => { leer(); paso--; pintar(); });
            const enviar = caja.querySelector('[data-enviar]');
            if (enviar) enviar.addEventListener('click', () => mandar(enviar));
        }

        function pintarHorarios() {
            const ul = caja.querySelector('#invitarHorarios');
            ul.innerHTML = datos.horarios.map((h, i) => {
                const [d, t] = h.inicio.split('T');
                return `<li class="invitar-horario">
                    <span class="invitar-horario-num">${i + 1}</span>
                    <label><span>Día</span><input type="date" data-dia="${i}" value="${d}" min="${aLocal(new Date()).slice(0, 10)}"></label>
                    <label><span>Hora</span><input type="time" data-hora="${i}" value="${t}" step="900"></label>
                    <label class="invitar-cupos"><span>Cupos</span><input type="text" data-cupos="${i}" value="${h.cupos}" aria-label="Personas en este horario"></label>
                    <button type="button" class="invitar-quitar" data-quitar="${i}" aria-label="Quitar este horario"${datos.horarios.length === 1 ? ' disabled' : ''}><i data-ico="trash"></i></button>
                </li>`;
            }).join('');
            ul.querySelectorAll('[data-cupos]').forEach(inp => { if (SkillMatchUI.soloEnteros) SkillMatchUI.soloEnteros(inp, { digitos: 2 }); });
            ul.querySelectorAll('input').forEach(inp => inp.addEventListener('change', leerHorarios));
            ul.querySelectorAll('[data-quitar]').forEach(b => b.addEventListener('click', () => { leerHorarios(); datos.horarios.splice(Number(b.dataset.quitar), 1); pintarHorarios(); }));
            const agregar = caja.querySelector('#invitarAgregar');
            agregar.disabled = datos.horarios.length >= limiteHorarios;
            caja.querySelector('#invitarLimiteHorarios').innerHTML = datos.horarios.length >= limiteHorarios
                ? `Tu plan permite ${limiteHorarios} horarios por proceso. <a href="planes.html#planes">Ver planes</a>` : '';
        }

        function leerHorarios() {
            const ul = caja.querySelector('#invitarHorarios');
            if (!ul) return;
            datos.horarios = datos.horarios.map((h, i) => ({
                inicio: `${ul.querySelector(`[data-dia="${i}"]`).value}T${ul.querySelector(`[data-hora="${i}"]`).value}`,
                cupos: Number(ul.querySelector(`[data-cupos="${i}"]`).value || 0)
            }));
        }

        function leer() {
            if (paso === 1) {
                datos.tipo = caja.querySelector('input[name="tipo"]:checked').value;
                datos.modalidad = caja.querySelector('input[name="modalidad"]:checked').value;
                datos.lugar = caja.querySelector('#invitarLugar').value.trim();
                datos.enlace = caja.querySelector('#invitarEnlace').value.trim();
                datos.duracionMinutos = Number(caja.querySelector('#invitarDuracion').value);
                datos.indicaciones = caja.querySelector('#invitarIndicaciones').value.trim();
            } else if (paso === 2) {
                leerHorarios();
                datos.respondeAntesDe = caja.querySelector('#invitarPlazo').value || null;
            }
        }

        function error(t) {
            const e = caja.querySelector('#invitarError');
            e.textContent = t; e.hidden = !t;
            return false;
        }

        function valido() {
            if (paso === 1) {
                if (datos.modalidad === 'PRESENCIAL' && !datos.lugar) return error('Escribe la dirección del lugar.');
                if (datos.modalidad === 'VIRTUAL' && !/^https?:\/\/\S+\.\S+/i.test(datos.enlace)) return error('Pega el enlace completo, que empiece por https://');
                if (/[<>]/.test(datos.lugar + datos.indicaciones)) return error('No uses los símbolos < ni >.');
            }
            if (paso === 2) {
                const ahora = Date.now();
                if (datos.horarios.some(h => !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(h.inicio))) return error('Completa el día y la hora de cada horario.');
                if (datos.horarios.some(h => new Date(h.inicio).getTime() < ahora + 2 * 3600 * 1000)) return error('Los horarios deben ser al menos 2 horas después de ahora.');
                if (datos.horarios.some(h => new Date(h.inicio).getTime() > ahora + 60 * 864e5)) return error('Los horarios deben estar dentro de los próximos 60 días.');
                if (new Set(datos.horarios.map(h => h.inicio)).size !== datos.horarios.length) return error('Hay dos horarios iguales.');
                if (datos.horarios.some(h => !(h.cupos >= 1 && h.cupos <= 50))) return error('Cada horario necesita entre 1 y 50 cupos.');
                const total = datos.horarios.reduce((s, h) => s + h.cupos, 0);
                if (total < lista.length) return error(`Los cupos suman ${total} y vas a invitar a ${lista.length}. Agrega cupos u otro horario.`);
                if (datos.respondeAntesDe) {
                    const limite = new Date(datos.respondeAntesDe).getTime();
                    const primero = Math.min(...datos.horarios.map(h => new Date(h.inicio).getTime()));
                    if (limite < ahora + 3600 * 1000) return error('Da al menos una hora para responder.');
                    if (limite > primero) return error('La fecha para responder debe ser antes del primer horario.');
                }
            }
            return error('') || true;
        }

        function siguiente() {
            leer();
            if (!valido()) return;
            paso++;
            pintar();
        }

        async function mandar(boton) {
            boton.disabled = true;
            boton.innerHTML = '<span class="spinner-inline" aria-hidden="true"></span> Enviando…';
            const cuerpo = {
                jobId: lista[0].jobId, applicationIds: lista.map(a => String(a.id)),
                tipo: datos.tipo, modalidad: datos.modalidad,
                lugar: datos.modalidad === 'PRESENCIAL' ? datos.lugar : null,
                enlace: datos.modalidad === 'VIRTUAL' ? datos.enlace : null,
                indicaciones: datos.indicaciones || null, duracionMinutos: datos.duracionMinutos,
                horarios: datos.horarios.map(h => ({ inicio: h.inicio + ':00', cupos: h.cupos })),
                respondeAntesDe: datos.respondeAntesDe ? datos.respondeAntesDe + ':00' : null
            };
            try {
                const r = await api('/invitaciones', { method: 'POST', body: JSON.stringify(cuerpo) });
                const res = await r.json().catch(() => ({}));
                if (!r.ok) {
                    boton.disabled = false;
                    boton.innerHTML = `<i data-ico="send"></i> Enviar ${lista.length === 1 ? 'invitación' : lista.length + ' invitaciones'}`;
                    if (r.status === 409 && res.codigo === 'cupo') {
                        const c = caja.querySelector('#invitarCupo');
                        c.innerHTML = `<i data-ico="sparkle"></i><div><strong>${esc(res.message)}</strong><p>Con el plan Profesional invitas hasta 300 candidatos al mes y hasta 50 en cada envío.</p></div>
                            <a class="btn btn-primary btn-small" href="planes.html#planes">Ver planes</a>`;
                        c.hidden = false;
                        return;
                    }
                    error(res.message || (res.errors && Object.values(res.errors)[0]) || 'No se pudo enviar. Intenta de nuevo.');
                    return;
                }
                caja.innerHTML = `<div class="invitar-listo">${ilustracion('listo')}
                    <h3>¡Listo! Invitaste a ${res.total} ${res.total === 1 ? 'candidato' : 'candidatos'}</h3>
                    <p>Cada persona ya tiene la invitación en sus avisos de SkillMatch, y por correo si tiene activados esos correos. Cuando respondan, lo verás en «Invitaciones».</p>
                    <div class="modal-actions"><button type="button" class="btn-secondary-modal" data-cerrar>Cerrar</button>
                        <button type="button" class="btn-primary-modal" data-ver>Ver respuestas</button></div></div>`;
                caja.querySelector('[data-cerrar]').addEventListener('click', v.cerrar);
                caja.querySelector('[data-ver]').addEventListener('click', () => { v.cerrar(); abrirDetalle(res.id); });
                if (window.SkillMatchUI && SkillMatchUI.chispa) SkillMatchUI.chispa(caja.querySelector('.ilus'));
                salirDeModo();
                plan(true).then(p => { pintarPlanLateral(p); cargarPanel(); });
            } catch (e) {
                boton.disabled = false;
                boton.innerHTML = `<i data-ico="send"></i> Enviar`;
                error('No pudimos conectar con SkillMatch. Revisa tu internet e intenta de nuevo.');
            }
        }

        pintar();
    }

    function empresaNombre() {
        const h = document.getElementById('companyName');
        if (h && h.textContent.trim()) return h.textContent.trim();
        try { return JSON.parse(localStorage.getItem('userData') || '{}').firstName || 'Tu empresa'; } catch (e) { return 'Tu empresa'; }
    }

    // ------------------------------------------------------------------ seccion "Invitaciones" y su panel
    function prepararPanel() {
        if (!document.getElementById('invitacionesLista')) return;
        cargarPanel();
    }

    async function cargarPanel() {
        const lista = document.getElementById('invitacionesLista');
        if (!lista) return;
        lista.setAttribute('aria-busy', 'true');
        try {
            const [r, p] = await Promise.all([api('/invitaciones'), plan()]);
            if (!r.ok) throw new Error(String(r.status));
            const procesos = await r.json();
            pintarUsoCabecera(p);
            if (!procesos.length) {
                lista.innerHTML = `<div class="invitaciones-vacio">${ilustracion('invitar')}
                    <h3>Invita a varios candidatos a la siguiente etapa</h3>
                    <p>Elige a quienes más encajan y envíales una invitación a una entrevista o evaluación con tus horarios. Ellos confirman su interés y eligen el horario; tú ves todas las respuestas aquí.</p>
                    <ul class="invitaciones-vacio-pasos">
                        <li><i data-ico="target"></i><span><strong>Elige</strong> candidatos con su match</span></li>
                        <li><i data-ico="calendar"></i><span><strong>Propón</strong> horarios con cupos</span></li>
                        <li><i data-ico="check"></i><span><strong>Mira</strong> quién confirmó</span></li>
                    </ul>
                    <button type="button" class="btn btn-primary" id="invitacionesEmpezar"><i data-ico="send"></i> Elegir candidatos</button></div>`;
                lista.querySelector('#invitacionesEmpezar').addEventListener('click', () => {
                    if (document.querySelector('#applications-list .application-card')) entrarEnModo();
                    else aviso('Cuando recibas postulaciones podrás elegir a quién invitar.', 'info');
                });
            } else {
                lista.innerHTML = `<ul class="procesos">${procesos.map(tarjetaProceso).join('')}</ul>`;
                lista.querySelectorAll('[data-proceso]').forEach(b => b.addEventListener('click', () => abrirDetalle(b.dataset.proceso)));
            }
        } catch (e) {
            lista.innerHTML = `<div class="invitaciones-error"><p>No pudimos cargar tus invitaciones.</p><button type="button" class="btn btn-secondary btn-small" id="invitacionesReintentar"><i data-ico="refresh"></i> Intentar de nuevo</button></div>`;
            lista.querySelector('#invitacionesReintentar').addEventListener('click', cargarPanel);
        } finally {
            lista.setAttribute('aria-busy', 'false');
        }
    }

    function estadoProceso(p) {
        if (p.estado === 'CANCELADA') return ['Cancelado', 'gris'];
        const futuro = (p.horarios || []).some(h => new Date(h.inicio) > new Date());
        if (!futuro) return ['Terminado', 'gris'];
        if (p.vencida) return ['Respuestas cerradas', 'espera'];
        return ['Recibiendo respuestas', 'si'];
    }

    function tarjetaProceso(p) {
        const c = p.cuentas || {};
        const total = p.total || 1;
        const pct = n => Math.round((n || 0) / total * 100);
        const [estado, clase] = estadoProceso(p);
        return `<li class="proceso">
            <div class="proceso-cabeza">
                <span class="proceso-icono"><i data-ico="${p.tipo === 'EVALUACION' ? 'list' : 'chat'}"></i></span>
                <div><h3>${TIPOS[p.tipo]} · ${esc(p.jobTitle)}</h3>
                    <p>${MODALIDADES[p.modalidad]} · ${(p.horarios || []).length} ${(p.horarios || []).length === 1 ? 'horario' : 'horarios'} · responden hasta el ${esc(diaCorto(p.respondeAntesDe))}, ${esc(hora(p.respondeAntesDe))}</p></div>
                <span class="proceso-estado is-${clase}">${estado}</span>
            </div>
            <div class="proceso-barra" role="img" aria-label="${c.confirmada || 0} confirmaron, ${c.pendiente || 0} sin responder, ${c.rechazada || 0} no pueden">
                <span class="is-si" style="width:${pct(c.confirmada)}%"></span><span class="is-espera" style="width:${pct(c.pendiente)}%"></span>
                <span class="is-no" style="width:${pct(c.rechazada)}%"></span><span class="is-gris" style="width:${pct((c.vencida || 0) + (c.cancelada || 0))}%"></span>
            </div>
            <div class="proceso-pie">
                <span class="proceso-cifra is-si"><i data-ico="check"></i> <strong>${c.confirmada || 0}</strong> confirmaron</span>
                <span class="proceso-cifra is-espera"><i data-ico="clock"></i> <strong>${c.pendiente || 0}</strong> sin responder</span>
                <span class="proceso-cifra is-no"><i data-ico="close"></i> <strong>${c.rechazada || 0}</strong> no pueden</span>
                <button type="button" class="btn btn-secondary btn-small" data-proceso="${esc(p.id)}">Ver respuestas <i data-ico="arrow"></i></button>
            </div>
        </li>`;
    }

    function pintarUsoCabecera(p) {
        const caja = document.getElementById('invitacionesPlan');
        if (!caja || !p) return;
        caja.innerHTML = `<a class="uso-chip" href="planes.html#plan-y-uso" title="Ver tu plan y uso">
            <span class="uso-chip-plan">Plan ${esc(p.plan.nombre)}</span>
            <span><strong>${p.uso.invitacionesMes}</strong> de ${p.uso.limiteMes} invitaciones este mes</span></a>`;
    }

    async function abrirDetalle(id) {
        const v = SkillMatchUI.ventana({ id: 'ventanaProceso', titulo: 'Respuestas', icono: 'users', ancha: true,
            cuerpo: '<div class="proceso-detalle" id="procesoDetalle"><div class="skeleton-bloque"></div><div class="skeleton-bloque"></div></div>' });
        const caja = v.cuerpo.querySelector('#procesoDetalle');
        let filtro = 'TODOS';
        let datos;
        async function cargar() {
            const r = await api(`/invitaciones/${encodeURIComponent(id)}`);
            if (!r.ok) { caja.innerHTML = '<p class="error-text">No pudimos cargar este proceso.</p>'; return; }
            datos = await r.json();
            pintar();
        }
        function pintar() {
            const d = datos;
            const c = d.cuentas || {};
            const [estado, clase] = estadoProceso(d);
            const abiertas = d.estado === 'ACTIVA' && !d.vencida;
            const porHorario = id2 => d.candidatos.filter(p => p.estado === 'CONFIRMADA' && p.horarioId === id2);
            const visibles = d.candidatos.filter(p => filtro === 'TODOS' || p.estado === filtro || (filtro === 'OTROS' && ['VENCIDA', 'CANCELADA'].includes(p.estado)));
            caja.innerHTML = `
                <div class="proceso-detalle-cabeza">
                    <div><p class="proceso-eti">${TIPOS[d.tipo]} · ${MODALIDADES[d.modalidad]} · ${d.duracionMinutos} min</p>
                        <h3>${esc(d.jobTitle)}</h3>
                        <p class="proceso-sub">${d.modalidad === 'PRESENCIAL' ? '<i data-ico="pin"></i> ' + esc(d.lugar || '') : '<i data-ico="desktop"></i> ' + esc(d.enlace || '')}</p></div>
                    <span class="proceso-estado is-${clase}">${estado}</span>
                </div>
                <div class="proceso-cifras">
                    <div class="is-si"><strong>${c.confirmada || 0}</strong><span>Confirmaron</span></div>
                    <div class="is-espera"><strong>${c.pendiente || 0}</strong><span>Sin responder</span></div>
                    <div class="is-no"><strong>${c.rechazada || 0}</strong><span>No pueden</span></div>
                    <div class="is-gris"><strong>${(c.vencida || 0) + (c.cancelada || 0)}</strong><span>Sin respuesta a tiempo</span></div>
                </div>
                <h4 class="proceso-titulo"><i data-ico="calendar"></i> Horarios</h4>
                <ul class="proceso-horarios">${d.horarios.map(h => {
                    const quienes = porHorario(h.id);
                    return `<li><div class="proceso-horario-cabeza"><strong>${esc(mayus(diaHora(h.inicio)))}</strong><span>${h.confirmados} de ${h.cupos} ${h.cupos === 1 ? 'cupo' : 'cupos'}</span></div>
                        <div class="proceso-cupo"><span style="width:${Math.min(100, Math.round(h.confirmados / h.cupos * 100))}%"></span></div>
                        <p class="proceso-nombres">${quienes.length ? quienes.map(p => esc(p.nombre)).join(' · ') : '<span class="tenue">Nadie ha elegido este horario</span>'}</p></li>`;
                }).join('')}</ul>
                <div class="proceso-herramientas">
                    <div class="proceso-filtros" role="group" aria-label="Filtrar respuestas">
                        ${[['TODOS', 'Todos'], ['CONFIRMADA', 'Confirmaron'], ['PENDIENTE', 'Sin responder'], ['RECHAZADA', 'No pueden'], ['OTROS', 'Sin respuesta a tiempo']]
                            .map(([k, t]) => `<button type="button" class="proceso-filtro" aria-pressed="${filtro === k}" data-filtro="${k}">${t}</button>`).join('')}
                    </div>
                </div>
                <ul class="proceso-personas">${visibles.map(p => {
                    const [t, cl, ico] = ESTADO_PERSONA[p.estado] || ESTADO_PERSONA.PENDIENTE;
                    const h = d.horarios.find(x => x.id === p.horarioId);
                    return `<li><span class="proceso-avatar" aria-hidden="true">${esc((p.nombre || '?').charAt(0))}</span>
                        <div><strong>${esc(p.nombre)}</strong><small>${esc(p.titular || '')}</small>
                            ${p.comentario ? `<p class="proceso-comentario">«${esc(p.comentario)}»</p>` : ''}</div>
                        <span class="proceso-persona-estado is-${cl}"><i data-ico="${ico}"></i> ${t}${h ? ' · ' + esc(diaCorto(h.inicio)) + ', ' + esc(hora(h.inicio)) : ''}</span>
                        <a class="btn-icono-texto" href="mensajes.html?userId=${encodeURIComponent(p.userId)}" title="Escribirle"><i data-ico="chat"></i><span class="sr-only">Escribirle a ${esc(p.nombre)}</span></a></li>`;
                }).join('') || '<li class="proceso-nadie">No hay candidatos con este filtro.</li>'}</ul>
                <div class="proceso-acciones">
                    ${abiertas ? `<button type="button" class="btn btn-secondary btn-small${d.recordatorios ? '' : ' is-bloqueado'}" data-accion="recordar"${(c.pendiente || 0) ? '' : ' disabled'}>
                        <i data-ico="bell"></i> Recordar a quienes no han respondido${d.recordatorios ? '' : ' <span class="plan-eti">Profesional</span>'}</button>` : ''}
                    <button type="button" class="btn btn-secondary btn-small${d.exportarRespuestas ? '' : ' is-bloqueado'}" data-accion="excel"><i data-ico="download"></i> Descargar respuestas${d.exportarRespuestas ? '' : ' <span class="plan-eti">Profesional</span>'}</button>
                    ${d.estado === 'ACTIVA' ? '<button type="button" class="btn btn-secondary btn-small btn-peligro-suave" data-accion="cancelar"><i data-ico="close"></i> Cancelar proceso</button>' : ''}
                </div>`;
            caja.querySelectorAll('[data-filtro]').forEach(b => b.addEventListener('click', () => { filtro = b.dataset.filtro; pintar(); }));
            caja.querySelectorAll('[data-accion]').forEach(b => b.addEventListener('click', () => accion(b.dataset.accion, b)));
        }
        async function accion(cual, boton) {
            if ((cual === 'recordar' && !datos.recordatorios) || (cual === 'excel' && !datos.exportarRespuestas)) {
                aviso('Esta función está en el plan Profesional. <a href="planes.html#planes">Ver planes</a>', 'info');
                return;
            }
            if (cual === 'excel') return descargar(datos);
            if (cual === 'cancelar') {
                const si = await SkillMatchUI.confirmar({ titulo: 'Cancelar proceso', texto: 'Las personas invitadas recibirán un aviso de que el proceso se canceló. Esto no se puede deshacer.', aceptar: 'Cancelar proceso', cancelar: 'Volver', peligro: true });
                if (!si) return;
            }
            boton.disabled = true;
            const r = await api(`/invitaciones/${encodeURIComponent(datos.id)}/${cual === 'recordar' ? 'recordar' : 'cancelar'}`, { method: 'POST' });
            const res = await r.json().catch(() => ({}));
            boton.disabled = false;
            if (!r.ok) { aviso(res.message || 'No se pudo completar. Intenta de nuevo.', 'error'); return; }
            datos = res;
            pintar();
            cargarPanel();
            if (cual === 'recordar') aviso(res.recordados ? `Enviaste un recordatorio a ${res.recordados} ${res.recordados === 1 ? 'persona' : 'personas'}.` : 'Ya les recordaste en las últimas 24 horas.', res.recordados ? 'ok' : 'info');
            else aviso('Cancelaste el proceso y avisamos a las personas invitadas.', 'ok');
        }
        await cargar();
    }

    function descargar(d) {
        if (!window.SkillMatchExcel) return;
        const columnas = [{ titulo: 'Nombre', ancho: 28 }, { titulo: 'Titular', ancho: 28 }, { titulo: 'Respuesta', ancho: 22 },
            { titulo: 'Horario', ancho: 22 }, { titulo: 'Comentario', ancho: 50 }, { titulo: 'Respondió el', ancho: 20 }];
        const filas = d.candidatos.map(p => {
            const h = d.horarios.find(x => x.id === p.horarioId);
            return [p.nombre, p.titular || '', (ESTADO_PERSONA[p.estado] || [p.estado])[0], h ? new Date(h.inicio) : null, p.comentario || '', p.respondidaEn ? new Date(p.respondidaEn) : null];
        });
        const archivo = SkillMatchExcel.libro({ hoja: 'Respuestas', columnas, filas });
        const nombre = `respuestas-${(d.jobTitle || 'proceso').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.xlsx`;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(archivo); a.download = nombre;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        aviso(`Descargaste las respuestas en <strong>${esc(nombre)}</strong>.`, 'ok');
    }

    // ------------------------------------------------------------------ "Plan y uso" en la columna de la izquierda
    function prepararPlanLateral() { plan().then(pintarPlanLateral); }

    function pintarPlanLateral(p) {
        const caja = document.getElementById('planLateral');
        if (!caja) return;
        if (!p) { caja.hidden = true; return; }
        const pct = Math.min(100, Math.round(p.uso.invitacionesMes / p.uso.limiteMes * 100));
        const pendiente = (p.solicitudes || []).find(s => s.estado === 'PENDIENTE');
        caja.hidden = false;
        caja.querySelector('.plan-lateral-cuerpo').innerHTML = `
            <p class="plan-lateral-nombre">Plan ${esc(p.plan.nombre)}${p.vigenteHasta ? `<small>Activo hasta el ${esc(new Date(p.vigenteHasta).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' }))}</small>` : ''}</p>
            <div class="plan-lateral-uso"><span>Invitaciones este mes</span><strong>${p.uso.invitacionesMes} de ${p.uso.limiteMes}</strong></div>
            <div class="panel-barra${pct >= 90 ? ' is-alerta' : ''}" role="progressbar" aria-valuemin="0" aria-valuemax="${p.uso.limiteMes}" aria-valuenow="${p.uso.invitacionesMes}" aria-label="Invitaciones usadas este mes"><span style="--p:${pct / 100}"></span></div>
            ${pendiente ? '<p class="plan-lateral-estado"><i data-ico="clock"></i> Solicitud pendiente de verificación</p>' : ''}
            <a class="btn btn-secondary btn-small" href="planes.html#${p.plan.id === 'PROFESIONAL' ? 'plan-y-uso' : 'planes'}">${p.plan.id === 'PROFESIONAL' ? 'Ver mi plan' : 'Ver planes'}</a>`;
    }

    /* ==================================================================
     *  PERSONA
     * ================================================================== */
    function prepararPersona() {
        const tarjeta = document.getElementById('invitacionesCard');
        if (!tarjeta) return;
        if (new URLSearchParams(location.search).get('id')) return;   // perfil de otra persona
        cargarMias();
    }

    let mias = [];
    async function cargarMias() {
        const tarjeta = document.getElementById('invitacionesCard');
        try {
            const r = await api('/invitaciones/mias');
            if (!r.ok) return;
            mias = await r.json();
        } catch (e) { return; }
        if (!mias.length) { tarjeta.hidden = true; return; }
        tarjeta.hidden = false;
        const pendientes = mias.filter(i => i.miEstado === 'PENDIENTE' && i.puedeResponder).length;
        tarjeta.querySelector('.card-title').innerHTML = `<i data-ico="calendar"></i> Tus invitaciones${pendientes ? ` <span class="invitaciones-pendientes">${pendientes} por responder</span>` : ''}`;
        tarjeta.querySelector('#invitacionesMias').innerHTML = `<ul class="mis-invitaciones">${mias.map(filaMia).join('')}</ul>`;
        tarjeta.querySelectorAll('[data-mia]').forEach(b => b.addEventListener('click', () => abrirMia(b.dataset.mia)));
        const pedida = new URLSearchParams(location.search).get('invitacion');
        if (pedida && mias.some(i => i.id === pedida)) { abrirMia(pedida); history.replaceState(null, '', location.pathname); }
    }

    function filaMia(i) {
        const h = i.horarios.find(x => x.id === i.horarioId);
        let detalle;
        if (i.miEstado === 'CONFIRMADA' && h) detalle = `<span class="mia-estado is-si"><i data-ico="check"></i> ${esc(mayus(diaCorto(h.inicio)))}, ${esc(hora(h.inicio))}</span>`;
        else if (i.miEstado === 'PENDIENTE' && i.puedeResponder) detalle = `<span class="mia-estado is-espera"><i data-ico="clock"></i> Responde antes del ${esc(diaCorto(i.respondeAntesDe))}</span>`;
        else { const [t, cl, ico] = ESTADO_PERSONA[i.miEstado] || ESTADO_PERSONA.PENDIENTE; detalle = `<span class="mia-estado is-${cl}"><i data-ico="${ico}"></i> ${i.miEstado === 'RECHAZADA' ? 'Avisaste que no puedes' : t}</span>`; }
        const accion = i.miEstado === 'PENDIENTE' && i.puedeResponder ? 'Responder' : 'Ver detalles';
        return `<li class="mia"><span class="mia-icono"><i data-ico="${i.tipo === 'EVALUACION' ? 'list' : 'chat'}"></i></span>
            <div><strong>${TIPOS[i.tipo]} · ${esc(i.empresa)}</strong><small>${esc(i.jobTitle)}</small>${detalle}</div>
            <button type="button" class="btn ${accion === 'Responder' ? 'btn-primary' : 'btn-secondary'} btn-small" data-mia="${esc(i.id)}">${accion}</button></li>`;
    }

    function abrirMia(id) {
        let i = mias.find(x => x.id === id);
        if (!i) return;
        const v = SkillMatchUI.ventana({ id: 'ventanaInvitacion', titulo: 'Invitación', icono: 'calendar', ancha: false,
            cuerpo: '<div class="mia-ventana" id="miaVentana"></div>' });
        const caja = v.cuerpo.querySelector('#miaVentana');
        let elegido = i.horarioId || null;

        function cabecera() {
            return `<div class="mia-cabeza"><span class="invitacion-tipo"><i data-ico="${i.tipo === 'EVALUACION' ? 'list' : 'chat'}"></i> ${TIPOS[i.tipo]} · ${MODALIDADES[i.modalidad]} · ${i.duracionMinutos} min</span>
                <h3>${esc(i.empresa)} te invita a la siguiente etapa</h3><p class="invitacion-vacante">${esc(i.jobTitle)}</p></div>`;
        }

        function detalleConfirmado() {
            const h = i.horarios.find(x => x.id === i.horarioId);
            return `<div class="mia-confirmada">${ilustracion('listo')}
                <h3>Tu asistencia está confirmada</h3>
                <p class="mia-cuando"><i data-ico="calendar"></i> ${esc(mayus(diaHora(h.inicio)))}</p>
                ${i.modalidad === 'PRESENCIAL' ? `<p class="mia-donde"><i data-ico="pin"></i> ${esc(i.lugar || '')}</p>` : `<p class="mia-donde"><i data-ico="desktop"></i> <a href="${esc(i.enlace || '#')}" target="_blank" rel="noopener noreferrer">Abrir el enlace de la ${i.tipo === 'EVALUACION' ? 'evaluación' : 'reunión'}</a></p>`}
                ${i.indicaciones ? `<div class="mia-indicaciones"><strong>Indicaciones</strong><p>${esc(i.indicaciones)}</p></div>` : ''}
                <div class="modal-actions">
                    ${i.puedeResponder ? '<button type="button" class="btn-secondary-modal" data-cambiar>Cambiar horario</button>' : ''}
                    <button type="button" class="btn-secondary-modal" data-calendario><i data-ico="calendar"></i> Agregar a mi calendario</button>
                    <button type="button" class="btn-primary-modal" data-cerrar>Listo</button></div></div>`;
        }

        function pintar(forzarElegir) {
            if (i.miEstado === 'CONFIRMADA' && !forzarElegir) {
                caja.innerHTML = cabecera() + detalleConfirmado();
            } else if (!i.puedeResponder) {
                const [t] = ESTADO_PERSONA[i.miEstado] || ESTADO_PERSONA.PENDIENTE;
                caja.innerHTML = cabecera() + `<div class="mia-cerrada"><i data-ico="clock"></i><p><strong>${i.miEstado === 'RECHAZADA' ? 'Avisaste que no puedes asistir.' : t + '.'}</strong>
                    ${i.miEstado === 'CANCELADA' ? 'La empresa canceló esta etapa.' : 'Esta invitación ya no recibe respuestas.'}</p></div>
                    <div class="modal-actions"><button type="button" class="btn-primary-modal" data-cerrar>Cerrar</button></div>`;
            } else {
                caja.innerHTML = cabecera() + `
                    <div class="mia-antes">
                        ${i.modalidad === 'PRESENCIAL'
                            ? `<p class="mia-donde"><i data-ico="pin"></i> <span><strong>Dónde:</strong> ${esc(i.lugar || '')}</span></p>`
                            : `<p class="mia-donde"><i data-ico="desktop"></i> <span><strong>Dónde:</strong> en línea. El enlace de la ${i.tipo === 'EVALUACION' ? 'evaluación' : 'reunión'} lo verás aquí cuando confirmes.</span></p>`}
                        ${i.indicaciones ? `<div class="mia-indicaciones"><strong>Indicaciones</strong><p>${esc(i.indicaciones)}</p></div>` : ''}
                    </div>
                    <p class="mia-instruccion">Elige el horario que te sirva:</p>
                    <div class="mia-horarios" role="radiogroup" aria-label="Horarios">${i.horarios.map(h => `
                        <label class="mia-horario${h.disponible ? '' : ' is-lleno'}"><input type="radio" name="horario" value="${esc(h.id)}"${elegido === h.id ? ' checked' : ''}${h.disponible ? '' : ' disabled'}>
                            <span><strong>${esc(mayus(fecha(h.inicio).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })))}</strong>
                            <small>${esc(hora(h.inicio))}${h.disponible ? '' : ' · Lleno'}</small></span></label>`).join('')}</div>
                    <p class="mia-plazo"><i data-ico="clock"></i> Responde antes del ${esc(diaHora(i.respondeAntesDe))}</p>
                    <div class="form-group"><label for="miaComentario">Mensaje para la empresa (opcional)</label>
                        <textarea id="miaComentario" rows="2" maxlength="300" placeholder="Ej.: Llevaré mi hoja de vida impresa.">${esc(i.comentario || '')}</textarea></div>
                    <p class="error-text" id="miaError" role="alert" hidden></p>
                    <div class="modal-actions"><button type="button" class="btn-secondary-modal" data-no-puedo>No puedo asistir</button>
                        <button type="button" class="btn-primary-modal" data-confirmar><i data-ico="check"></i> Confirmar asistencia</button></div>`;
                caja.querySelectorAll('input[name="horario"]').forEach(r => r.addEventListener('change', () => { elegido = r.value; }));
            }
            caja.querySelectorAll('[data-cerrar]').forEach(b => b.addEventListener('click', v.cerrar));
            const conf = caja.querySelector('[data-confirmar]');
            if (conf) conf.addEventListener('click', () => responder(true, conf));
            const no = caja.querySelector('[data-no-puedo]');
            if (no) no.addEventListener('click', async () => {
                const si = await SkillMatchUI.confirmar({ titulo: 'No puedo asistir', texto: 'Le avisaremos a la empresa que esta vez no puedes. Puedes cambiar tu respuesta mientras el plazo siga abierto.', aceptar: 'Avisar a la empresa', cancelar: 'Volver' });
                if (si) responder(false, no);
            });
            const cambiar = caja.querySelector('[data-cambiar]');
            if (cambiar) cambiar.addEventListener('click', () => pintar(true));
            const cal = caja.querySelector('[data-calendario]');
            if (cal) cal.addEventListener('click', () => calendario(i));
        }

        async function responder(asiste, boton) {
            const err = caja.querySelector('#miaError');
            if (asiste && !elegido) { err.textContent = 'Elige uno de los horarios.'; err.hidden = false; return; }
            const comentario = (caja.querySelector('#miaComentario') || {}).value || '';
            if (/[<>]/.test(comentario)) { err.textContent = 'No uses los símbolos < ni >.'; err.hidden = false; return; }
            boton.disabled = true;
            const r = await api(`/invitaciones/respuestas/${encodeURIComponent(i.id)}`, { method: 'POST', body: JSON.stringify({ asiste, horarioId: asiste ? elegido : null, comentario: comentario.trim() || null }) })
                .catch(() => null);
            boton.disabled = false;
            if (!r) { err.textContent = 'No pudimos conectar con SkillMatch. Intenta de nuevo.'; err.hidden = false; return; }
            const res = await r.json().catch(() => ({}));
            if (!r.ok) { err.textContent = res.message || 'No se pudo guardar tu respuesta.'; err.hidden = false; return; }
            i = res;
            mias = mias.map(x => (x.id === res.id ? res : x));
            if (asiste) {
                pintar();
                if (window.SkillMatchUI && SkillMatchUI.chispa) SkillMatchUI.chispa(caja.querySelector('.ilus'));
                aviso('Confirmaste tu asistencia. La empresa ya lo sabe.', 'ok');
            } else {
                v.cerrar();
                aviso('Le avisamos a la empresa que esta vez no puedes.', 'ok');
            }
            cargarMias();
        }
        pintar();
    }

    /** Un archivo .ics: lo abre el calendario del celular o del computador. */
    function calendario(i) {
        const h = i.horarios.find(x => x.id === i.horarioId);
        if (!h) return;
        const ini = new Date(h.inicio), fin = new Date(ini.getTime() + (i.duracionMinutos || 30) * 60000);
        const f = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
        const linea = t => String(t || '').replace(/[\\,;]/g, m => '\\' + m).replace(/\n/g, '\\n');
        const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SkillMatch//Invitaciones//ES', 'BEGIN:VEVENT',
            `UID:${i.id}@skillmatch`, `DTSTAMP:${f(new Date())}`, `DTSTART:${f(ini)}`, `DTEND:${f(fin)}`,
            `SUMMARY:${linea(TIPOS[i.tipo] + ' con ' + i.empresa + ' - ' + i.jobTitle)}`,
            `LOCATION:${linea(i.modalidad === 'PRESENCIAL' ? i.lugar : i.enlace)}`,
            `DESCRIPTION:${linea(i.indicaciones || '')}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
        a.download = 'skillmatch-' + (i.tipo === 'EVALUACION' ? 'evaluacion' : 'entrevista') + '.ics';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }

    window.SkillMatchInvitaciones = { ilustracion, plan, pesos };

    function iniciar() {
        if (typeof haySesion === 'function' && !haySesion()) return;
        if (document.getElementById('candidatos') && esEmpresa()) prepararEmpresa();
        else if (document.getElementById('invitacionesCard') && !esEmpresa()) prepararPersona();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
