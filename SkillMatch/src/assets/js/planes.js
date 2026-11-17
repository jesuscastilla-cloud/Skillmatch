/* =====================================================================
 *  SkillMatch - Planes para empresas (planes.html)
 *
 *  - Tarjetas y comparacion con los limites reales (GET /api/public/planes).
 *  - Con sesion de empresa: "Tu plan y tu uso" (GET /api/planes/mio) y el recorrido
 *    de contratacion: elegir plan -> revisar -> "Solicitar activacion" -> estado.
 *    Sin pasarela de pago: un administrador verifica el pago y activa el plan.
 * ===================================================================== */
(function () {
    'use strict';

    const esc = s => (typeof escaparHtml === 'function' ? escaparHtml(s == null ? '' : String(s)) : String(s == null ? '' : s));
    const pesos = n => '$' + Number(n || 0).toLocaleString('es-CO');
    const aviso = (t, tipo) => window.SkillMatchUI && SkillMatchUI.aviso(t, tipo);
    const fechaLarga = v => new Date(v).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });

    let catalogo = [];
    let mio = null;

    function sesion() {
        try {
            if (typeof haySesion === 'function' && !haySesion()) return null;
            return JSON.parse(localStorage.getItem('userData') || 'null');
        } catch (e) { return null; }
    }
    const esEmpresa = () => { const s = sesion(); return !!s && s.userType === 'empresa'; };

    const ESTADOS = {
        PENDIENTE: ['Pendiente de verificación', 'espera', 'clock'],
        APROBADA: ['Plan activo', 'si', 'check'],
        RECHAZADA: ['No aprobada', 'no', 'close'],
        CANCELADA: ['Cancelada', 'gris', 'close']
    };

    // ------------------------------------------------------------------ tarjetas
    function boton(plan) {
        const s = sesion();
        if (!s) {
            return plan.precioMensual === 0
                ? `<a class="btn btn-secondary btn-plan" href="registro-empresa.html">Empezar gratis</a>`
                : `<a class="btn btn-primary btn-plan" href="login.html?tipo=empresa&volver=${encodeURIComponent('planes.html')}">Elegir plan</a>`;
        }
        if (s.userType !== 'empresa') return `<p class="plan-solo-empresas"><i data-ico="building"></i> Disponible para cuentas de empresa</p>`;
        const actual = mio && mio.plan.id === plan.id;
        const pendiente = mio && (mio.solicitudes || []).some(x => x.estado === 'PENDIENTE');
        if (plan.precioMensual === 0) {
            return actual ? `<span class="btn btn-secondary btn-plan is-actual"><i data-ico="check"></i> Tu plan actual</span>`
                : `<span class="btn btn-secondary btn-plan is-incluido">Siempre disponible</span>`;
        }
        if (pendiente) return `<a class="btn btn-secondary btn-plan" href="#plan-y-uso"><i data-ico="clock"></i> Pendiente de verificación</a>`;
        return `<button type="button" class="btn btn-primary btn-plan" data-elegir="${esc(plan.id)}">${actual ? 'Renovar o ampliar' : 'Elegir plan'}</button>`;
    }

    function tarjeta(plan) {
        const pro = plan.precioMensual > 0;
        const actual = mio && mio.plan.id === plan.id;
        return `<article class="plan-tarjeta${pro ? ' is-pro' : ''}${actual ? ' is-actual' : ''}" aria-labelledby="plan-${esc(plan.id)}">
            ${pro ? '<span class="plan-cinta"><i data-ico="sparkle"></i> Recomendado</span>' : ''}
            <div class="plan-cabeza">
                <span class="plan-icono"><i data-ico="${pro ? 'rocket' : 'sprout'}"></i></span>
                <h3 id="plan-${esc(plan.id)}">${esc(plan.nombre)}</h3>
                <p class="plan-para">${pro ? 'Para empresas que contratan cada mes' : 'Para empezar a invitar candidatos'}</p>
            </div>
            <p class="plan-precio">${pro ? `<strong>${pesos(plan.precioMensual)}</strong><span>por ${esc(plan.periodo)}</span>` : '<strong>Gratis</strong><span>siempre</span>'}</p>
            <ul class="plan-beneficios">${plan.beneficios.map(b => `<li><i data-ico="check"></i>${esc(b)}</li>`).join('')}</ul>
            <div class="plan-limites">
                <span><strong>${plan.invitacionesMes}</strong> invitaciones al mes</span>
                <span><strong>${plan.procesosActivos}</strong> procesos abiertos a la vez</span>
            </div>
            ${boton(plan)}
        </article>`;
    }

    function pintarTarjetas() {
        const caja = document.getElementById('planesTarjetas');
        caja.innerHTML = catalogo.map(tarjeta).join('');
        caja.setAttribute('aria-busy', 'false');
        caja.querySelectorAll('[data-elegir]').forEach(b => b.addEventListener('click', () => contratar(catalogo.find(p => p.id === b.dataset.elegir))));
    }

    function pintarTabla() {
        const [b, p] = [catalogo.find(x => x.precioMensual === 0), catalogo.find(x => x.precioMensual > 0)];
        if (!b || !p) return;
        const si = '<i data-ico="check" class="tabla-si" aria-label="Incluido"></i>';
        const no = '<i data-ico="minus" class="tabla-no" aria-label="No incluido"></i>';
        const filas = [
            ['Invitaciones al mes', b.invitacionesMes, p.invitacionesMes],
            ['Candidatos en cada envío', b.maxPorEnvio, p.maxPorEnvio],
            ['Procesos abiertos a la vez', b.procesosActivos, p.procesosActivos],
            ['Horarios por proceso', b.horariosPorProceso, p.horariosPorProceso],
            ['Panel de respuestas', si, si],
            ['Aviso y correo a cada candidato', si, si],
            ['Recordatorio a quienes no responden', b.recordatorios ? si : no, p.recordatorios ? si : no],
            ['Descargar respuestas en Excel', b.exportarRespuestas ? si : no, p.exportarRespuestas ? si : no]
        ];
        document.getElementById('planesTabla').insertAdjacentHTML('beforeend', `
            <thead><tr><th scope="col">Lo que incluye</th><th scope="col">${esc(b.nombre)}<small>Gratis</small></th><th scope="col" class="is-pro">${esc(p.nombre)}<small>${pesos(p.precioMensual)} al mes</small></th></tr></thead>
            <tbody>${filas.map(f => `<tr><th scope="row">${f[0]}</th><td>${f[1]}</td><td class="is-pro">${f[2]}</td></tr>`).join('')}</tbody>`);
    }

    // ------------------------------------------------------------------ plan y uso
    function pintarUso() {
        const seccion = document.getElementById('plan-y-uso');
        const caja = document.getElementById('planUso');
        if (!mio) { seccion.hidden = true; return; }
        seccion.hidden = false;
        const u = mio.uso;
        const pct = Math.min(100, Math.round(u.invitacionesMes / u.limiteMes * 100));
        const pctP = Math.min(100, Math.round(u.procesosActivos / u.limiteProcesos * 100));
        const pro = mio.plan.id === 'PROFESIONAL';
        const pendiente = (mio.solicitudes || []).find(s => s.estado === 'PENDIENTE');
        const vigencia = pro && mio.vigenteHasta
            ? `<p class="uso-vigencia"><i data-ico="calendar"></i> Activo hasta el <strong>${esc(fechaLarga(mio.vigenteHasta))}</strong></p>`
            : mio.vencidoEl ? `<p class="uso-vigencia is-alerta"><i data-ico="alert"></i> Tu plan Profesional terminó el ${esc(fechaLarga(mio.vencidoEl))}. Ahora tienes el Básico.</p>`
            : '<p class="uso-vigencia"><i data-ico="check"></i> Sin costo y sin fecha de vencimiento</p>';
        caja.innerHTML = `
            <article class="uso-tarjeta uso-plan">
                <p class="uso-eti">Tu plan</p>
                <h3><span class="plan-icono"><i data-ico="${pro ? 'rocket' : 'sprout'}"></i></span> ${esc(mio.plan.nombre)}</h3>
                ${vigencia}
                ${pro ? '' : (pendiente ? '' : '<button type="button" class="btn btn-primary btn-small" data-elegir="PROFESIONAL"><i data-ico="sparkle"></i> Pasar al Profesional</button>')}
                ${pro && !pendiente ? '<button type="button" class="btn btn-secondary btn-small" data-elegir="PROFESIONAL">Renovar o ampliar</button>' : ''}
            </article>
            <article class="uso-tarjeta">
                <p class="uso-eti">Invitaciones este mes</p>
                <p class="uso-cifra"><strong>${u.invitacionesMes}</strong> de ${u.limiteMes}</p>
                <div class="panel-barra${pct >= 90 ? ' is-alerta' : ''}" role="progressbar" aria-valuemin="0" aria-valuemax="${u.limiteMes}" aria-valuenow="${u.invitacionesMes}" aria-label="Invitaciones usadas este mes"><span style="--p:${pct / 100}"></span></div>
                <p class="uso-nota">El contador vuelve a cero el ${esc(new Date(u.seRenuevaEl).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' }))}.</p>
            </article>
            <article class="uso-tarjeta">
                <p class="uso-eti">Procesos abiertos</p>
                <p class="uso-cifra"><strong>${u.procesosActivos}</strong> de ${u.limiteProcesos}</p>
                <div class="panel-barra${pctP >= 90 ? ' is-alerta' : ''}" role="progressbar" aria-valuemin="0" aria-valuemax="${u.limiteProcesos}" aria-valuenow="${u.procesosActivos}" aria-label="Procesos abiertos"><span style="--p:${pctP / 100}"></span></div>
                <p class="uso-nota"><a href="perfil-empresa.html#invitacionesEmpresa">Ver mis invitaciones</a></p>
            </article>
            ${(mio.solicitudes || []).length ? `<article class="uso-tarjeta uso-solicitudes">
                <p class="uso-eti">Tus solicitudes</p>
                <ul>${mio.solicitudes.map(filaSolicitud).join('')}</ul>
                ${pendiente ? pago() : ''}
            </article>` : ''}`;
        caja.setAttribute('aria-busy', 'false');
        caja.querySelectorAll('[data-elegir]').forEach(b => b.addEventListener('click', () => contratar(catalogo.find(p => p.id === b.dataset.elegir))));
        caja.querySelectorAll('[data-cancelar-solicitud]').forEach(b => b.addEventListener('click', () => cancelarSolicitud(b.dataset.cancelarSolicitud, b)));
    }

    function filaSolicitud(s) {
        const [t, cl, ico] = ESTADOS[s.estado] || ESTADOS.PENDIENTE;
        return `<li class="solicitud">
            <div><strong>Profesional · ${s.meses} ${s.meses === 1 ? 'mes' : 'meses'} · ${pesos(s.valor)}</strong>
                <small>Pedida el ${esc(fechaLarga(s.createdAt))}</small>
                ${s.notaAdmin ? `<p class="solicitud-nota">${esc(s.notaAdmin)}</p>` : ''}</div>
            <span class="estado-pill is-${cl}"><i data-ico="${ico}"></i> ${t}</span>
            ${s.estado === 'PENDIENTE' ? `<button type="button" class="invitar-barra-link" data-cancelar-solicitud="${esc(s.id)}">Cancelar solicitud</button>` : ''}
        </li>`;
    }

    function pago() {
        const p = mio.pago;
        if (!p) {
            return `<div class="uso-pago"><i data-ico="mail"></i><p>Nuestro equipo está revisando tu solicitud y te contactará al correo de tu cuenta para coordinar el pago. Cuando lo verifiquemos, activamos tu plan y te avisamos aquí.</p></div>`;
        }
        const filas = [['Titular', p.titular], ['NIT', p.nit], ['Banco', p.banco], ['Tipo de cuenta', p.tipoCuenta], ['Número de cuenta', p.numeroCuenta]]
            .filter(f => f[1]).map(f => `<div><dt>${f[0]}</dt><dd>${esc(f[1])}</dd></div>`).join('');
        return `<div class="uso-pago is-datos">
            <h4><i data-ico="money"></i> Cómo pagar</h4>
            <dl>${filas}</dl>
            <p>Cuando pagues, envía el comprobante a <a href="mailto:${esc(p.correoPagos)}">${esc(p.correoPagos)}</a>${p.telefonoPagos ? ` o al ${esc(p.telefonoPagos)}` : ''}. Al verificarlo activamos tu plan y te avisamos aquí.</p>
            ${p.instrucciones ? `<p class="uso-pago-extra">${esc(p.instrucciones)}</p>` : ''}
        </div>`;
    }

    async function cancelarSolicitud(id, boton) {
        const si = await SkillMatchUI.confirmar({ titulo: 'Cancelar solicitud', texto: 'Tu solicitud del plan Profesional se cancelará. Puedes pedirla otra vez cuando quieras.', aceptar: 'Cancelar solicitud', cancelar: 'Volver', peligro: true });
        if (!si) return;
        boton.disabled = true;
        const r = await fetchWithAuth(`${API_BASE_URL}/planes/solicitudes/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => null);
        if (!r || !r.ok) { boton.disabled = false; aviso('No se pudo cancelar la solicitud. Intenta de nuevo.', 'error'); return; }
        mio = await r.json();
        pintarTodo();
        aviso('Cancelaste la solicitud.', 'ok');
    }

    // ------------------------------------------------------------------ contratacion
    function contratar(plan) {
        if (!plan) return;
        const s = sesion() || {};
        let meses = 1;
        let paso = 1;
        const datos = { nombre: `${s.firstName || ''} ${s.lastName && s.lastName !== 'Empresa' ? s.lastName : ''}`.trim(), telefono: '', nota: '' };
        const v = SkillMatchUI.ventana({ id: 'ventanaContratar', titulo: `Plan ${plan.nombre}`, icono: 'sparkle', ancha: true, cuerpo: '<div class="contratar" id="contratar"></div>' });
        const caja = v.cuerpo.querySelector('#contratar');

        function pasos() {
            return `<ol class="invitar-pasos" aria-label="Pasos">${['Elige el tiempo', 'Revisa el resumen', 'Listo'].map((t, i) =>
                `<li class="${i + 1 === paso ? 'is-actual' : i + 1 < paso ? 'is-hecho' : ''}"><span>${i + 1 < paso ? '<i data-ico="check"></i>' : i + 1}</span>${t}</li>`).join('')}</ol>`;
        }

        function pintar() {
            if (paso === 1) {
                caja.innerHTML = pasos() + `
                    <fieldset class="contratar-meses"><legend>¿Por cuánto tiempo?</legend>
                        ${[1, 3, 6].map(m => `<label class="contratar-mes"><input type="radio" name="meses" value="${m}"${m === meses ? ' checked' : ''}>
                            <span><strong>${m} ${m === 1 ? 'mes' : 'meses'}</strong><em>${pesos(plan.precioMensual * m)}</em></span></label>`).join('')}
                    </fieldset>
                    <div class="invitar-fila">
                        <div class="form-group"><label for="contratarNombre">Persona de contacto</label>
                            <input type="text" id="contratarNombre" maxlength="100" value="${esc(datos.nombre)}" autocomplete="name"></div>
                        <div class="form-group"><label for="contratarTelefono">Teléfono (opcional)</label>
                            <input type="tel" id="contratarTelefono" maxlength="25" inputmode="tel" value="${esc(datos.telefono)}" autocomplete="tel" placeholder="Ej.: 300 123 4567"></div>
                    </div>
                    <div class="form-group"><label for="contratarNota">¿Algo que debamos saber? (opcional)</label>
                        <textarea id="contratarNota" rows="2" maxlength="500" placeholder="Ej.: Necesitamos factura a nombre de otra razón social.">${esc(datos.nota)}</textarea></div>
                    <p class="error-text" id="contratarError" role="alert" hidden></p>
                    <div class="modal-actions"><button type="button" class="btn-secondary-modal" data-cerrar>Cancelar</button>
                        <button type="button" class="btn-primary-modal" data-siguiente>Revisar el resumen <i data-ico="arrow"></i></button></div>`;
                caja.querySelectorAll('input[name="meses"]').forEach(r => r.addEventListener('change', () => { meses = Number(r.value); }));
            } else if (paso === 2) {
                caja.innerHTML = pasos() + `
                    <div class="contratar-resumen">
                        <div class="contratar-total">
                            <span class="plan-icono"><i data-ico="rocket"></i></span>
                            <div><p>Plan ${esc(plan.nombre)} · ${meses} ${meses === 1 ? 'mes' : 'meses'}</p><strong>${pesos(plan.precioMensual * meses)}</strong></div>
                        </div>
                        <ul class="contratar-incluye">${plan.beneficios.map(b => `<li><i data-ico="check"></i>${esc(b)}</li>`).join('')}</ul>
                        <h4>Qué pasa después</h4>
                        <ol class="contratar-despues">
                            <li><strong>Registramos tu solicitud</strong> y la ves en «Tu plan y tu uso» como pendiente de verificación.</li>
                            <li><strong>Te indicamos cómo pagar</strong>${mio && mio.pagoPorTransferencia ? ' con los datos de transferencia que verás en esta página' : ' por el correo de tu cuenta'}.</li>
                            <li><strong>Verificamos el pago y activamos tu plan</strong>. Te avisamos en SkillMatch.</li>
                        </ol>
                        <p class="contratar-contacto"><i data-ico="user"></i> Contacto: ${esc(datos.nombre || 'el de tu cuenta')}${datos.telefono ? ' · ' + esc(datos.telefono) : ''}</p>
                    </div>
                    <p class="error-text" id="contratarError" role="alert" hidden></p>
                    <div class="modal-actions"><button type="button" class="btn-secondary-modal" data-atras>Atrás</button>
                        <button type="button" class="btn-primary-modal" data-solicitar><i data-ico="send"></i> Solicitar activación</button></div>`;
            } else {
                const p = mio && mio.pago;
                caja.innerHTML = pasos() + `<div class="invitar-listo">${window.SkillMatchInvitaciones ? SkillMatchInvitaciones.ilustracion('listo') : ''}
                    <h3>Recibimos tu solicitud</h3>
                    <p><span class="estado-pill is-espera"><i data-ico="clock"></i> Pendiente de verificación</span></p>
                    <p>${p ? 'Abajo, en «Tu plan y tu uso», tienes los datos para pagar. Cuando verifiquemos el pago, activamos tu plan y te avisamos.'
                        : 'Nuestro equipo te contactará al correo de tu cuenta para coordinar el pago. Cuando lo verifiquemos, activamos tu plan y te avisamos.'}</p>
                    <div class="modal-actions"><button type="button" class="btn-primary-modal" data-ver-uso>Ver el estado</button></div></div>`;
            }
            caja.querySelectorAll('[data-cerrar]').forEach(b => b.addEventListener('click', v.cerrar));
            const sig = caja.querySelector('[data-siguiente]');
            if (sig) sig.addEventListener('click', () => {
                datos.nombre = caja.querySelector('#contratarNombre').value.trim();
                datos.telefono = caja.querySelector('#contratarTelefono').value.trim();
                datos.nota = caja.querySelector('#contratarNota').value.trim();
                const err = caja.querySelector('#contratarError');
                if (datos.telefono && !/^[+0-9 ()-]{7,25}$/.test(datos.telefono)) { err.textContent = 'Escribe un teléfono válido.'; err.hidden = false; return; }
                if (/[<>]/.test(datos.nombre + datos.nota)) { err.textContent = 'No uses los símbolos < ni >.'; err.hidden = false; return; }
                paso = 2; pintar();
            });
            const atras = caja.querySelector('[data-atras]');
            if (atras) atras.addEventListener('click', () => { paso = 1; pintar(); });
            const sol = caja.querySelector('[data-solicitar]');
            if (sol) sol.addEventListener('click', () => solicitar(sol));
            const ver = caja.querySelector('[data-ver-uso]');
            if (ver) ver.addEventListener('click', () => { v.cerrar(); document.getElementById('plan-y-uso').scrollIntoView({ block: 'start' }); });
        }

        async function solicitar(b) {
            b.disabled = true;
            b.innerHTML = '<span class="spinner-inline" aria-hidden="true"></span> Enviando…';
            const r = await fetchWithAuth(`${API_BASE_URL}/planes/solicitudes`, { method: 'POST', body: JSON.stringify({
                plan: plan.id, meses, contactoNombre: datos.nombre || null, contactoTelefono: datos.telefono || null, nota: datos.nota || null }) }).catch(() => null);
            const res = r ? await r.json().catch(() => ({})) : {};
            if (!r || !r.ok) {
                b.disabled = false;
                b.innerHTML = '<i data-ico="send"></i> Solicitar activación';
                const err = caja.querySelector('#contratarError');
                err.textContent = (r && res.message) || 'No pudimos registrar tu solicitud. Revisa tu conexión e intenta de nuevo.';
                err.hidden = false;
                return;
            }
            mio = res;
            paso = 3;
            pintar();
            pintarTodo();
        }
        pintar();
    }

    // ------------------------------------------------------------------ inicio
    function pintarTodo() {
        pintarTarjetas();
        pintarUso();
        const final = document.getElementById('planesFinalBoton');
        if (final && esEmpresa()) { final.textContent = 'Ir a mis postulaciones'; final.href = 'perfil-empresa.html#candidatos'; }
        else if (final && sesion()) { final.textContent = 'Ver vacantes'; final.href = 'oportunidades.html'; }
    }

    async function iniciar() {
        const arte = document.getElementById('planesArte');
        if (arte && window.SkillMatchInvitaciones) arte.innerHTML = SkillMatchInvitaciones.ilustracion('planes');
        try {
            const r = await fetch(`${API_BASE_URL}/public/planes`, { credentials: 'include' });
            if (!r.ok) throw new Error(String(r.status));
            catalogo = await r.json();
        } catch (e) {
            const caja = document.getElementById('planesTarjetas');
            caja.innerHTML = `<div class="invitaciones-error"><p>No pudimos cargar los planes en este momento.</p><button type="button" class="btn btn-secondary btn-small" id="planesReintentar"><i data-ico="refresh"></i> Intentar de nuevo</button></div>`;
            caja.setAttribute('aria-busy', 'false');
            document.getElementById('planesReintentar').addEventListener('click', iniciar);
            return;
        }
        if (esEmpresa()) {
            try {
                const r = await fetchWithAuth(`${API_BASE_URL}/planes/mio`);
                if (r.ok) mio = await r.json();
            } catch (e) { /* sin el uso, la pagina sigue funcionando */ }
        }
        pintarTodo();
        pintarTabla();
        if (location.hash === '#plan-y-uso' && mio) document.getElementById('plan-y-uso').scrollIntoView({ block: 'start' });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
