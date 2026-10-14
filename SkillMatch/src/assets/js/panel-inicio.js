// Panel de inicio (index.html), solo con sesion
//
// Antes, quien entraba con su cuenta veia en la portada lo mismo que un
// visitante, con "Crear mi perfil". Ahora, en lugar del heroe, ve lo suyo:
// - Persona: saludo, cuatro cifras (postulaciones en proceso, mensajes sin
//   leer, solicitudes de conexion y vacantes guardadas), sus ultimas
//   postulaciones como una linea de pasos, lo que le falta al perfil y las
//   vacantes que mejor encajan con sus habilidades.
// - Empresa: saludo, sus cifras y accesos para publicar y ver candidatos.
// Las secciones que invitan a registrarse se ocultan: ya tiene cuenta.
// Usa cargarHabilidadesPersona y calcularCoincidencia de search-handler.js.
(function () {
    'use strict';

    let datos = null;
    try {
        datos = localStorage.getItem('token') ? JSON.parse(localStorage.getItem('userData') || 'null') : null;
    } catch (e) { datos = null; }
    const panel = document.getElementById('panelInicio');
    if (!datos || !datos.id || !panel) return;
    const esEmpresa = datos.userType === 'empresa';

    // ---- Utilidades ----

    const numero = n => Number(n || 0).toLocaleString('es-CO');
    const plural = (n, uno, varios) => (n === 1 ? uno : varios);

    async function pedir(ruta, porDefecto) {
        try {
            const r = await fetchWithAuth(ruta);
            return r.ok ? await r.json() : porDefecto;
        } catch (e) {
            return porDefecto;
        }
    }

    function saludo() {
        const hora = new Date().getHours();
        return hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';
    }

    function hoy() {
        const texto = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
        return texto.charAt(0).toUpperCase() + texto.slice(1);
    }

    function cuandoTePostulaste(fecha) {
        const dia = f => { const d = new Date(f); d.setHours(0, 0, 0, 0); return d; };
        const dias = Math.round((dia(new Date()) - dia(fecha)) / 86400000);
        if (dias <= 0) return 'te postulaste hoy';
        if (dias === 1) return 'te postulaste ayer';
        if (dias <= 30) return `te postulaste hace ${dias} días`;
        return 'te postulaste el ' + new Date(fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    // ---- Estructura ----

    // El panel toma el lugar del heroe (presentacion para visitantes) y queda
    // como destino de "Saltar al contenido"
    function mostrarPanel(html) {
        const heroe = document.querySelector('.hero');
        if (heroe) {
            heroe.hidden = true;
            if (heroe.id === 'main') heroe.removeAttribute('id');
        }
        document.querySelectorAll('.usuarios-empresas, .cta-final').forEach(s => { s.hidden = true; });
        panel.innerHTML = html;
        panel.id = 'main';
        panel.hidden = false;
    }

    function cifra(c) {
        return `
            <li>
                <a class="panel-cifra" href="${c.href}" id="${c.id}">
                    <span class="panel-cifra-ico"><i data-ico="${c.ico}"></i></span>
                    <span class="panel-cifra-valor" data-valor>–</span>
                    <span class="panel-cifra-nombre" data-nombre>${c.nombre[1]}</span>
                </a>
            </li>`;
    }

    function pintarCifra(id, n, nombres, atencion) {
        const el = document.getElementById(id);
        if (!el) return;
        el.querySelector('[data-valor]').textContent = n === null ? '–' : numero(n);
        el.querySelector('[data-nombre]').textContent = nombres[n === 1 ? 0 : 1];
        el.classList.toggle('pide-atencion', !!atencion && n > 0);
    }

    function cargandoFilas(n) {
        return Array.from({ length: n }, () =>
            '<li class="panel-cargando" aria-hidden="true"><span class="skeleton skeleton-title"></span><span class="skeleton skeleton-line w-60"></span></li>').join('');
    }

    // ---- Persona ----

    const CIFRAS_PERSONA = [
        { id: 'panelProceso', ico: 'send', href: 'perfil-usuario.html?tab=applications', nombre: ['postulación en proceso', 'postulaciones en proceso'] },
        { id: 'panelMensajes', ico: 'chat', href: 'mensajes.html', nombre: ['mensaje sin leer', 'mensajes sin leer'] },
        { id: 'panelSolicitudes', ico: 'handshake', href: 'conexiones.html?tab=solicitudes', nombre: ['solicitud de conexión', 'solicitudes de conexión'] },
        { id: 'panelGuardadas', ico: 'bookmark', href: 'oportunidades.html?guardadas=1', nombre: ['vacante guardada', 'vacantes guardadas'] }
    ];

    // Pasos de una postulacion: enviada, revisada y la respuesta de la empresa
    function pasosPostulacion(estado) {
        const clave = String(estado || 'PENDIENTE').toUpperCase();
        const respuesta = clave === 'ACEPTADA' ? 'Aceptada' : clave === 'RECHAZADA' ? 'Rechazada' : 'Respuesta';
        const nivel = { PENDIENTE: 0, REVISADA: 1, ACEPTADA: 2, RECHAZADA: 2 }[clave] || 0;
        const pasos = ['Enviada', 'Revisada', respuesta];
        const textoEstado = clave === 'PENDIENTE' ? 'Enviada' : clave === 'REVISADA' ? 'Revisada' : respuesta;
        return `
            <ol class="pasos${clave === 'ACEPTADA' ? ' aceptada' : clave === 'RECHAZADA' ? ' rechazada' : ''}" aria-label="Estado: ${textoEstado}">
                ${pasos.map((p, i) => `<li class="${i < nivel ? 'hecho' : i === nivel ? 'actual' : ''}"${i === nivel ? ' aria-current="step"' : ''}>${p}</li>`).join('')}
            </ol>`;
    }

    function filaPostulacion(app) {
        const titulo = escaparHtml(app.jobTitle || 'Vacante');
        const enlace = app.jobId ? `<a href="oportunidades.html?jobId=${encodeURIComponent(app.jobId)}">${titulo}</a>` : titulo;
        return `
            <li class="panel-postulacion">
                <div class="panel-postulacion-datos">
                    <h3>${enlace}</h3>
                    <p>${escaparHtml(app.companyName || 'Empresa confidencial')} · ${cuandoTePostulaste(app.appliedDate)}</p>
                </div>
                ${pasosPostulacion(app.status)}
            </li>`;
    }

    function tarjetaVacante(v) {
        const anillo = v.coincidencia
            ? `<div class="match-ring" data-pct="${v.coincidencia.pct}" role="img" title="Tienes ${v.coincidencia.tiene} de ${v.coincidencia.pedidas} habilidades que pide"
                    aria-label="${v.coincidencia.pct} por ciento: tienes ${v.coincidencia.tiene} de ${v.coincidencia.pedidas} habilidades que pide"></div>`
            : '';
        const lugar = [v.companyName, v.location].filter(Boolean).map(escaparHtml).join(' · ');
        return `
            <li class="panel-vacante">
                <div class="panel-vacante-datos">
                    <h3><a href="oportunidades.html?jobId=${encodeURIComponent(v.id)}">${escaparHtml(v.title || 'Vacante')}</a></h3>
                    ${lugar ? `<p>${lugar}</p>` : ''}
                </div>
                ${anillo}
            </li>`;
    }

    async function panelPersona() {
        const nombre = escaparHtml((datos.firstName || '').split(' ')[0]);
        mostrarPanel(`
            <div class="panel-franja">
                <div class="container">
                    <div class="panel-cabeza">
                        <div>
                            <p class="panel-fecha">${hoy()}</p>
                            <h1 id="panelSaludo">${saludo()}${nombre ? ', ' + nombre : ''}</h1>
                            <p class="panel-sub">Esto es lo que tienes pendiente en SkillMatch.</p>
                        </div>
                        <a class="btn btn-accent" href="oportunidades.html"><i data-ico="search"></i> Buscar vacantes</a>
                    </div>
                    <ul class="panel-cifras" aria-label="Tu resumen">${CIFRAS_PERSONA.map(cifra).join('')}</ul>
                </div>
            </div>
            <div class="container panel-cuerpo">
                <section class="panel-bloque panel-postulaciones" aria-labelledby="panelPostTitulo">
                    <div class="panel-bloque-titulo">
                        <h2 id="panelPostTitulo">Tus postulaciones</h2>
                        <a href="perfil-usuario.html?tab=applications" id="panelVerPostulaciones" hidden>Ver todas <i data-ico="arrow"></i></a>
                    </div>
                    <ul class="panel-lista" id="panelPostulaciones">${cargandoFilas(3)}</ul>
                </section>
                <section class="panel-bloque panel-perfil" aria-labelledby="panelPerfilTitulo">
                    <h2 id="panelPerfilTitulo">Tu perfil</h2>
                    <div id="panelPerfil"><ul class="panel-lista">${cargandoFilas(2)}</ul></div>
                </section>
                <section class="panel-bloque panel-vacantes" aria-labelledby="panelVacTitulo">
                    <div class="panel-bloque-titulo">
                        <h2 id="panelVacTitulo">Vacantes que encajan contigo</h2>
                        <a href="oportunidades.html">Ver más en Vacantes <i data-ico="arrow"></i></a>
                    </div>
                    <p class="panel-nota" id="panelVacNota"></p>
                    <ul class="panel-vacantes-lista" id="panelVacantes">${cargandoFilas(3)}</ul>
                </section>
            </div>`);

        const id = encodeURIComponent(datos.id);
        const [postulaciones, noLeidos, solicitudes, guardadas, perfil, habilidades, estudios, experiencias] = await Promise.all([
            pedir('/applications/my-applications', null),
            pedir('/messages/unread-count', null),
            pedir('/connections/pending-requests', null),
            pedir('/saved-jobs/my-saved-jobs', null),
            pedir(`/users/${id}`, {}),
            pedir(`/users/${id}/skills`, []),
            pedir(`/users/${id}/educations`, []),
            // El backend responde 400 en experiencias: igual que Mi perfil, cuenta como pendiente
            pedir(`/users/${id}/experiences`, [])
        ]);

        // Cifras
        const apps = Array.isArray(postulaciones) ? postulaciones : [];
        const enProceso = apps.filter(a => ['PENDIENTE', 'REVISADA'].includes(String(a.status || '').toUpperCase())).length;
        pintarCifra('panelProceso', postulaciones ? enProceso : null, CIFRAS_PERSONA[0].nombre);
        pintarCifra('panelMensajes', noLeidos ? Number(noLeidos.count) || 0 : null, CIFRAS_PERSONA[1].nombre, true);
        pintarCifra('panelSolicitudes', Array.isArray(solicitudes) ? solicitudes.length : null, CIFRAS_PERSONA[2].nombre, true);
        pintarCifra('panelGuardadas', Array.isArray(guardadas) ? guardadas.length : null, CIFRAS_PERSONA[3].nombre);

        // Ultimas postulaciones
        const lista = document.getElementById('panelPostulaciones');
        const recientes = apps.slice().sort((a, b) => new Date(b.appliedDate || 0) - new Date(a.appliedDate || 0)).slice(0, 3);
        if (!postulaciones) {
            lista.innerHTML = '<li class="panel-vacio">No pudimos cargar tus postulaciones. Intenta de nuevo en un momento.</li>';
        } else if (!recientes.length) {
            lista.innerHTML = '<li class="panel-vacio">Aún no te has postulado a ninguna vacante. <a href="oportunidades.html">Busca las que encajan contigo</a>.</li>';
        } else {
            lista.innerHTML = recientes.map(filaPostulacion).join('');
            const verTodas = document.getElementById('panelVerPostulaciones');
            verTodas.hidden = false;
            if (apps.length > 3) verTodas.firstChild.textContent = `Ver las ${apps.length} `;
        }

        // Perfil: la misma lista que Mi perfil (asi el porcentaje coincide)
        const pasos = [
            ['Información básica', !!(perfil.firstName && perfil.lastName && perfil.email)],
            ['Teléfono', !!perfil.phone],
            ['Habilidades', habilidades.length > 0],
            ['Experiencia', Array.isArray(experiencias) && experiencias.length > 0],
            ['Estudios', estudios.length > 0]
        ];
        const hechos = pasos.filter(p => p[1]).length;
        const pct = Math.round(hechos / pasos.length * 100);
        const faltan = pasos.filter(p => !p[1]);
        document.getElementById('panelPerfil').innerHTML = `
            <p class="panel-perfil-pct"><strong>${pct} %</strong> completo</p>
            <div class="panel-barra" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="Avance del perfil"><span style="--p:${pct / 100}"></span></div>
            ${faltan.length
                ? `<p class="panel-nota">Te falta:</p>
                   <ul class="panel-faltan">${faltan.map(p => `<li><a href="perfil-usuario.html"><i data-ico="plus"></i> ${p[0]}</a></li>`).join('')}</ul>`
                : '<p class="panel-nota">Tu perfil está completo.</p>'}
            <a class="btn btn-secondary btn-small panel-ir-perfil" href="perfil-usuario.html">Ir a mi perfil</a>`;

        // Vacantes que encajan: las 50 mas recientes comparadas con tus habilidades,
        // sin las que ya te postulaste
        const vacantes = document.getElementById('panelVacantes');
        const nota = document.getElementById('panelVacNota');
        try {
            await cargarHabilidadesPersona();
            const pagina = await pedir('/jobs?page=0&size=50', null);
            if (!pagina) throw new Error('sin vacantes');
            const yaPostulado = new Set(apps.map(a => String(a.jobId)));
            const todas = (pagina.content || []).filter(v => !yaPostulado.has(String(v.id)))
                .map(v => ({ ...v, coincidencia: calcularCoincidencia(v.skills || []) }));
            const conPct = todas.filter(v => v.coincidencia && v.coincidencia.pct > 0)
                .sort((a, b) => b.coincidencia.pct - a.coincidencia.pct);
            if (conPct.length) {
                nota.textContent = 'Entre las vacantes más recientes, las que más coinciden con tus habilidades.';
                vacantes.innerHTML = conPct.slice(0, 3).map(tarjetaVacante).join('');
            } else {
                nota.innerHTML = habilidades.length
                    ? 'Las vacantes más recientes todavía no piden tus habilidades. Estas son las más nuevas:'
                    : 'Agrega tus habilidades en <a href="perfil-usuario.html">tu perfil</a> y aquí verás las vacantes que mejor encajan contigo. Por ahora, las más nuevas:';
                vacantes.innerHTML = todas.slice(0, 3).map(tarjetaVacante).join('');
            }
        } catch (e) {
            vacantes.innerHTML = '<li class="panel-vacio">No pudimos cargar las vacantes. Intenta de nuevo en un momento.</li>';
        }
        // La primera vez: un recorrido por el panel (ui.js, SkillMatchUI.recorrido)
        setTimeout(() => {
            if (!window.SkillMatchUI || !SkillMatchUI.recorrido) return;
            SkillMatchUI.recorrido({ clave: 'inicio-persona', pasos: [
                { objetivo: '#panelSaludo', titulo: 'Este es tu inicio', texto: 'Cada vez que entres a SkillMatch verás aquí lo tuyo: cómo van tus postulaciones, tus mensajes y las vacantes que encajan contigo.' },
                { objetivo: '.panel-cifras', titulo: 'Tu resumen', texto: 'Postulaciones en proceso, mensajes sin leer, solicitudes de conexión y vacantes guardadas. Toca cualquiera para ir directo.' },
                { objetivo: '.panel-postulaciones', titulo: 'Tus postulaciones, paso a paso', texto: 'Mira si la empresa ya revisó tu postulación y cuál fue su respuesta.' },
                { objetivo: '.panel-perfil', titulo: 'Tu perfil', texto: 'Completa lo que falta. Con tus habilidades, SkillMatch calcula qué tanto encajas en cada vacante.' },
                { objetivo: '.panel-vacantes', titulo: 'Vacantes para ti', texto: 'Las vacantes más recientes que más coinciden con lo que sabes hacer.' },
                { objetivo: '.search-section .search-box', titulo: 'Busca lo que quieras', texto: 'Escribe un cargo, una habilidad o una empresa. Para volver a ver este recorrido, toca la lupa de arriba y escribe «recorrido».' }
            ] });
        }, 600);
    }

    // ---- Empresa ----

    async function panelEmpresa() {
        const nombre = escaparHtml(datos.firstName || '');
        const cifras = [
            { id: 'panelActivas', ico: 'briefcase', href: 'perfil-empresa.html', nombre: ['oferta activa', 'ofertas activas'] },
            { id: 'panelPorRevisar', ico: 'clock', href: 'perfil-empresa.html?tab=applicants', nombre: ['postulación por revisar', 'postulaciones por revisar'] },
            { id: 'panelRecibidas', ico: 'inbox', href: 'perfil-empresa.html?tab=applicants', nombre: ['postulación recibida', 'postulaciones recibidas'] },
            { id: 'panelMensajesEmpresa', ico: 'chat', href: 'mensajes.html', nombre: ['mensaje sin leer', 'mensajes sin leer'] }
        ];
        mostrarPanel(`
            <div class="panel-franja">
                <div class="container">
                    <div class="panel-cabeza">
                        <div>
                            <p class="panel-fecha">${hoy()}</p>
                            <h1 id="panelSaludo">${saludo()}${nombre ? ', ' + nombre : ''}</h1>
                            <p class="panel-sub">Así van tus vacantes en SkillMatch.</p>
                        </div>
                        <div class="panel-acciones">
                            <a class="btn btn-accent" href="perfil-empresa.html?nueva=1"><i data-ico="plus"></i> Publicar una vacante</a>
                            <a class="btn btn-secondary" href="perfil-empresa.html?tab=applicants">Ver candidatos</a>
                        </div>
                    </div>
                    <ul class="panel-cifras" aria-label="Tu resumen">${cifras.map(cifra).join('')}</ul>
                </div>
            </div>`);

        const [stats, noLeidos] = await Promise.all([
            datos.companyId ? pedir(`/companies/${encodeURIComponent(datos.companyId)}/statistics`, null) : null,
            pedir('/messages/unread-count', null)
        ]);
        pintarCifra('panelActivas', stats ? stats.activeJobs || 0 : null, cifras[0].nombre);
        pintarCifra('panelPorRevisar', stats ? stats.pendingApplications || 0 : null, cifras[1].nombre, true);
        pintarCifra('panelRecibidas', stats ? stats.totalApplications || 0 : null, cifras[2].nombre);
        pintarCifra('panelMensajesEmpresa', noLeidos ? Number(noLeidos.count) || 0 : null, cifras[3].nombre, true);
    }

    if (esEmpresa) panelEmpresa(); else panelPersona();
})();
