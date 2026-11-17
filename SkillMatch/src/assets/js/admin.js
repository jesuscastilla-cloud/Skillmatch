/* =====================================================================
 *  SkillMatch - Administracion de planes (admin.html)
 *  Solo cuentas con rol ADMIN (el servidor lo exige en /api/admin/**).
 *   - Solicitudes de activacion: aprobar (con los meses) o rechazar (con el motivo).
 *   - Empresas con plan activo y hasta cuando.
 *   - Datos para cobrar: los escribe el administrador; nunca van en el codigo.
 * ===================================================================== */
(function () {
    'use strict';

    const esc = s => (typeof escaparHtml === 'function' ? escaparHtml(s == null ? '' : String(s)) : String(s == null ? '' : s));
    const pesos = n => '$' + Number(n || 0).toLocaleString('es-CO');
    const fecha = v => (v ? new Date(v).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
    const aviso = (t, tipo) => window.SkillMatchUI && SkillMatchUI.aviso(t, tipo);
    const api = (ruta, op) => fetchWithAuth(`${API_BASE_URL}${ruta}`, op);
    const ESTADOS = { PENDIENTE: ['Pendiente', 'espera'], APROBADA: ['Aprobada', 'si'], RECHAZADA: ['Rechazada', 'no'], CANCELADA: ['Cancelada por la empresa', 'gris'] };
    let filtro = 'PENDIENTE';

    function sinPermiso() {
        document.getElementById('adminSinPermiso').hidden = false;
        document.getElementById('adminContenido').hidden = true;
    }

    // ------------------------------------------------------------------ pestanas
    function pestanas() {
        const tabs = [...document.querySelectorAll('.admin-tabs [role="tab"]')];
        const ir = t => {
            tabs.forEach(x => { const si = x === t; x.setAttribute('aria-selected', si); x.tabIndex = si ? 0 : -1; document.getElementById(x.dataset.tab).hidden = !si; });
            t.focus();
            if (t.dataset.tab === 'tabEmpresas') cargarEmpresas();
            if (t.dataset.tab === 'tabComercial') cargarComercial();
        };
        tabs.forEach((t, i) => {
            t.addEventListener('click', () => ir(t));
            t.addEventListener('keydown', e => {
                if (e.key === 'ArrowRight') ir(tabs[(i + 1) % tabs.length]);
                if (e.key === 'ArrowLeft') ir(tabs[(i - 1 + tabs.length) % tabs.length]);
            });
        });
        document.querySelectorAll('.admin-filtros [data-estado]').forEach(b => b.addEventListener('click', () => {
            filtro = b.dataset.estado;
            document.querySelectorAll('.admin-filtros [data-estado]').forEach(x => x.setAttribute('aria-pressed', x === b));
            cargarSolicitudes();
        }));
    }

    // ------------------------------------------------------------------ solicitudes
    async function cargarSolicitudes() {
        const ul = document.getElementById('adminSolicitudes');
        ul.setAttribute('aria-busy', 'true');
        const r = await api(`/admin/planes/solicitudes${filtro ? '?estado=' + filtro : ''}`).catch(() => null);
        if (r && (r.status === 401 || r.status === 403)) return sinPermiso();
        if (!r || !r.ok) { ul.innerHTML = '<li class="invitaciones-error"><p>No pudimos cargar las solicitudes.</p></li>'; return; }
        const lista = await r.json();
        if (filtro === 'PENDIENTE') {
            const c = document.getElementById('adminPendientes');
            c.textContent = lista.length ? String(lista.length) : '';
        }
        ul.setAttribute('aria-busy', 'false');
        if (!lista.length) {
            ul.innerHTML = `<li class="admin-vacio"><i data-ico="inbox"></i><p>${filtro === 'PENDIENTE' ? 'No hay solicitudes pendientes. Cuando una empresa pida el plan Profesional, aparecerá aquí.' : 'Todavía no hay solicitudes.'}</p></li>`;
            return;
        }
        ul.innerHTML = lista.map(s => {
            const [t, cl] = ESTADOS[s.estado] || ESTADOS.PENDIENTE;
            return `<li class="admin-solicitud">
                <div class="admin-solicitud-cabeza">
                    <span class="plan-icono"><i data-ico="building"></i></span>
                    <div><h3>${esc(s.companyName || 'Empresa')}</h3><p>Plan Profesional · ${s.meses} ${s.meses === 1 ? 'mes' : 'meses'} · <strong>${pesos(s.valor)}</strong></p></div>
                    <span class="estado-pill is-${cl}">${t}</span>
                </div>
                <dl class="admin-datos">
                    <div><dt>Contacto</dt><dd>${esc(s.contactoNombre || '—')}</dd></div>
                    <div><dt>Correo</dt><dd>${s.contactoCorreo ? `<a href="mailto:${esc(s.contactoCorreo)}">${esc(s.contactoCorreo)}</a>` : '—'}</dd></div>
                    <div><dt>Teléfono</dt><dd>${esc(s.contactoTelefono || '—')}</dd></div>
                    <div><dt>Pedida el</dt><dd>${esc(fecha(s.createdAt))}</dd></div>
                    <div><dt>Plan actual</dt><dd>${s.planActual === 'PROFESIONAL' ? 'Profesional' : 'Básico'}</dd></div>
                    ${s.atendidaEn ? `<div><dt>Atendida el</dt><dd>${esc(fecha(s.atendidaEn))}</dd></div>` : ''}
                </dl>
                ${s.nota ? `<p class="admin-nota"><strong>Nota de la empresa:</strong> ${esc(s.nota)}</p>` : ''}
                ${s.notaAdmin ? `<p class="admin-nota"><strong>Nota para la empresa:</strong> ${esc(s.notaAdmin)}</p>` : ''}
                ${s.estado === 'PENDIENTE' ? `<div class="admin-acciones">
                    <button type="button" class="btn btn-secondary btn-small" data-rechazar="${esc(s.id)}"><i data-ico="close"></i> Rechazar</button>
                    <button type="button" class="btn btn-primary btn-small" data-aprobar="${esc(s.id)}" data-meses="${s.meses}" data-empresa="${esc(s.companyName || '')}"><i data-ico="check"></i> Aprobar y activar</button></div>` : ''}
            </li>`;
        }).join('');
        ul.querySelectorAll('[data-aprobar]').forEach(b => b.addEventListener('click', () => decidir(b.dataset.aprobar, true, Number(b.dataset.meses), b.dataset.empresa)));
        ul.querySelectorAll('[data-rechazar]').forEach(b => b.addEventListener('click', () => decidir(b.dataset.rechazar, false)));
    }

    function decidir(id, aprobar, meses, empresa) {
        const v = SkillMatchUI.ventana({
            id: 'ventanaDecision', titulo: aprobar ? 'Aprobar y activar' : 'Rechazar solicitud', icono: aprobar ? 'check' : 'close',
            cuerpo: `${aprobar ? `<p>Activas el plan Profesional de <strong>${esc(empresa)}</strong>. Hazlo cuando hayas verificado el pago.</p>
                <div class="form-group"><label for="decMeses">Meses</label><select id="decMeses">${[1, 2, 3, 4, 5, 6, 12].map(m => `<option value="${m}"${m === meses ? ' selected' : ''}>${m} ${m === 1 ? 'mes' : 'meses'}</option>`).join('')}</select>
                <small>Si ya tiene el plan activo, el tiempo se suma al que le queda.</small></div>` :
                '<p>La empresa verá el motivo en su página de planes y recibirá un aviso.</p>'}
                <div class="form-group"><label for="decNota">${aprobar ? 'Nota para la empresa (opcional)' : 'Motivo'}</label>
                    <textarea id="decNota" rows="3" maxlength="500"></textarea></div>
                <p class="error-text" id="decError" role="alert" hidden></p>
                <div class="modal-actions"><button type="button" class="btn-secondary-modal" data-no>Volver</button>
                    <button type="button" class="btn-primary-modal${aprobar ? '' : ' btn-peligro'}" data-si>${aprobar ? 'Activar plan' : 'Rechazar'}</button></div>`
        });
        v.cuerpo.querySelector('[data-no]').addEventListener('click', v.cerrar);
        v.cuerpo.querySelector('[data-si]').addEventListener('click', async e => {
            const nota = v.cuerpo.querySelector('#decNota').value.trim();
            const err = v.cuerpo.querySelector('#decError');
            if (!aprobar && !nota) { err.textContent = 'Escribe el motivo para la empresa.'; err.hidden = false; return; }
            if (/[<>]/.test(nota)) { err.textContent = 'No uses los símbolos < ni >.'; err.hidden = false; return; }
            e.target.disabled = true;
            const cuerpo = aprobar ? { meses: Number(v.cuerpo.querySelector('#decMeses').value), nota: nota || null } : { nota };
            const r = await api(`/admin/planes/solicitudes/${encodeURIComponent(id)}/${aprobar ? 'aprobar' : 'rechazar'}`, { method: 'POST', body: JSON.stringify(cuerpo) }).catch(() => null);
            const res = r ? await r.json().catch(() => ({})) : {};
            if (!r || !r.ok) { e.target.disabled = false; err.textContent = res.message || 'No se pudo guardar. Intenta de nuevo.'; err.hidden = false; return; }
            v.cerrar();
            aviso(aprobar ? 'Activaste el plan y le avisamos a la empresa.' : 'Rechazaste la solicitud y le avisamos a la empresa.', 'ok');
            cargarSolicitudes();
        });
    }

    // ------------------------------------------------------------------ empresas con plan
    async function cargarEmpresas() {
        const caja = document.getElementById('adminEmpresas');
        const r = await api('/admin/planes/empresas').catch(() => null);
        if (!r || !r.ok) { caja.innerHTML = '<p class="error-text">No pudimos cargar las empresas.</p>'; return; }
        const lista = await r.json();
        caja.setAttribute('aria-busy', 'false');
        caja.innerHTML = lista.length ? `<div class="planes-tabla-caja"><table class="planes-tabla admin-tabla">
            <thead><tr><th scope="col">Empresa</th><th scope="col">Activo hasta</th><th scope="col">Invitaciones este mes</th></tr></thead>
            <tbody>${lista.map(e => `<tr><th scope="row">${esc(e.companyName)}</th><td>${esc(fecha(e.vigenteHasta))}</td><td>${e.invitacionesMes}</td></tr>`).join('')}</tbody></table></div>`
            : '<div class="admin-vacio"><i data-ico="building"></i><p>Ninguna empresa tiene el plan Profesional activo todavía.</p></div>';
    }

    // ------------------------------------------------------------------ datos para cobrar
    async function cargarComercial() {
        const form = document.getElementById('adminComercial');
        const r = await api('/admin/comercial').catch(() => null);
        if (!r || !r.ok) return;
        const c = await r.json();
        [...form.elements].forEach(el => { if (el.name && c[el.name] != null) el.value = c[el.name]; });
        estadoComercial(c);
    }

    function estadoComercial(c) {
        const listo = c.banco && c.numeroCuenta && c.titular && c.correoPagos;
        document.getElementById('adminComercialEstado').innerHTML = listo
            ? `<p class="estado-pill is-si"><i data-ico="check"></i> Las empresas ven estos datos al solicitar la activación</p>${c.actualizado ? `<small>Actualizado el ${esc(fecha(c.actualizado))}</small>` : ''}`
            : '<p class="estado-pill is-espera"><i data-ico="alert"></i> Faltan datos: las empresas pueden solicitar la activación y ustedes las contactan por correo</p>';
    }

    function prepararComercial() {
        const form = document.getElementById('adminComercial');
        form.addEventListener('submit', async e => {
            e.preventDefault();
            const err = document.getElementById('adminComercialError');
            const datos = {};
            [...form.elements].forEach(el => { if (el.name) datos[el.name] = el.value.trim() || null; });
            if (Object.values(datos).some(v => v && /[<>]/.test(v))) { err.textContent = 'No uses los símbolos < ni >.'; err.hidden = false; return; }
            if (datos.correoPagos && !/^\S+@\S+\.\S+$/.test(datos.correoPagos)) { err.textContent = 'Escribe un correo válido.'; err.hidden = false; return; }
            err.hidden = true;
            const b = form.querySelector('[type="submit"]');
            b.disabled = true;
            const r = await api('/admin/comercial', { method: 'PUT', body: JSON.stringify(datos) }).catch(() => null);
            const res = r ? await r.json().catch(() => ({})) : {};
            b.disabled = false;
            if (!r || !r.ok) { err.textContent = res.message || (res.errors && Object.values(res.errors)[0]) || 'No se pudieron guardar los datos.'; err.hidden = false; return; }
            estadoComercial(res);
            aviso('Guardaste los datos para cobrar.', 'ok');
        });
    }

    function iniciar() {
        let datos = null;
        try { datos = JSON.parse(localStorage.getItem('userData') || 'null'); } catch (e) { /* sin sesion */ }
        const haySesionActiva = typeof haySesion === 'function' ? haySesion() : !!datos;
        if (!haySesionActiva || !datos || String(datos.role).toUpperCase().indexOf('ADMIN') === -1) return sinPermiso();
        document.getElementById('adminContenido').hidden = false;
        pestanas();
        prepararComercial();
        cargarSolicitudes();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
