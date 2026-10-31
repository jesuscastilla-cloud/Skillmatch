// API falsa en memoria: responde como el backend de SkillMatch (mismas formas de
// respuesta que los DTO de Java y mismas reglas de filtros) para probar el
// frontend sin servidor ni base de datos. Cada prueba empieza con datos nuevos.
const { crearDatos, haceDias } = require('./datos');

const BASE = 'http://localhost:8080/api';

// Token "JWT" de mentira. Como en el backend, viaja en la cookie httpOnly "auth_token"
// (el frontend ya no lo guarda ni lo envía en Authorization: docs/CAMBIOS-FRONTEND.md, F4)
const b64 = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
function tokenPara(userId) {
    return `${b64({ alg: 'none' })}.${b64({ sub: userId, exp: 4102444800 })}.prueba`;
}
function quienPide(cabeceras) {
    const cookie = (cabeceras.cookie || '').match(/(?:^|;\s*)auth_token=([^;]+)/);
    const auth = cookie ? cookie[1] : (cabeceras.authorization || '');
    const partes = auth.replace(/^Bearer\s+/i, '').split('.');
    if (partes.length < 2) return null;
    try { return JSON.parse(Buffer.from(partes[1], 'base64url').toString()).sub || null; } catch (e) { return null; }
}

function pagina(lista, consulta, porDefecto = 20) {
    const page = Number(consulta.get('page') || 0);
    const size = Number(consulta.get('size') || porDefecto);
    const content = lista.slice(page * size, page * size + size);
    const totalPages = Math.max(1, Math.ceil(lista.length / size));
    return { content, totalElements: lista.length, totalPages, number: page, size, first: page === 0, last: page >= totalPages - 1, empty: !content.length };
}

const contiene = (texto, buscado) => {
    try { return new RegExp(buscado, 'i').test(texto || ''); } catch (e) { return String(texto || '').toLowerCase().includes(String(buscado).toLowerCase()); }
};
const porFecha = campo => (a, b) => String(b[campo] || '').localeCompare(String(a[campo] || ''));

function crearApi(opciones = {}) {
    const d = crearDatos();
    const estado = { datos: d, llamadas: [], desconocidas: [], demora: opciones.demora || 0 };

    const usuario = id => d.usuarios.find(u => u.id === id);
    const empresa = id => d.empresas.find(c => c.id === id);
    const vacante = id => d.vacantes.find(j => j.id === id);
    const nombre = u => (u ? `${u.firstName} ${u.lastName}`.trim() : 'Usuario');
    const nuevoId = prefijo => `${prefijo}-${++d.siguiente}`;

    const perfil = u => ({ id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName, phone: u.phone || null,
        headline: u.headline || null, location: u.location || null, bio: u.bio || null,
        profileImageUrl: u.profileImageUrl || null, coverImageUrl: u.coverImageUrl || null, createdAt: haceDias(30, 9) });
    const autenticacion = u => ({ token: tokenPara(u.id), id: u.id, companyId: u.companyId || null, email: u.email,
        firstName: u.firstName, lastName: u.lastName, role: u.role, expiresAt: 4102444800000 });
    const respJob = j => {
        const c = empresa(j.companyId);
        return { ...j, companyName: c ? c.name : null, companyLogo: c ? c.logo || null : null };
    };
    const respCompania = c => ({ ...c });
    const respPostulacion = a => {
        const u = usuario(a.userId); const j = vacante(a.jobId); const c = j && empresa(j.companyId);
        return { id: a.id, userId: a.userId, userName: nombre(u), userEmail: u && u.email, userPhone: u && u.phone,
            userHeadline: u && u.headline, userLocation: u && u.location, userProfileImageUrl: u && u.profileImageUrl || null,
            jobId: a.jobId, jobTitle: j && j.title, companyName: c && c.name, status: a.status, resume: null,
            coverLetter: a.coverLetter || null, notes: a.notes || null, appliedDate: a.appliedDate, reviewedDate: a.reviewedDate || null,
            createdAt: a.appliedDate, updatedAt: a.appliedDate };
    };
    const respConexion = k => {
        const a = usuario(k.userId); const b = usuario(k.connectedUserId);
        return { id: k.id, userId: k.userId, userName: nombre(a), userEmail: a && a.email, userHeadline: a && a.headline,
            userProfileImage: null, connectedUserId: k.connectedUserId, connectedUserName: nombre(b), connectedUserEmail: b && b.email,
            connectedUserHeadline: b && b.headline, connectedUserProfileImage: null, status: k.status, message: k.message || null,
            requestedAt: k.requestedAt, respondedAt: k.respondedAt || null };
    };
    const respMensaje = m => ({ id: m.id, senderId: m.senderId, senderName: nombre(usuario(m.senderId)), senderProfileImage: null,
        receiverId: m.receiverId, receiverName: nombre(usuario(m.receiverId)), receiverProfileImage: null, content: m.content,
        isRead: !!m.isRead, readAt: m.readAt || null, sentAt: m.sentAt, attachmentUrl: null });
    const visiblePara = (m, yo) => (m.senderId === yo && !m.deletedBySender) || (m.receiverId === yo && !m.deletedByReceiver);

    const abiertas = () => d.vacantes.filter(j => j.active && j.status === 'abierta').sort(porFecha('postedDate'));

    // [metodo, patron, respuesta(params, consulta, cuerpo, yo)] -> [estado, cuerpo]
    const rutas = [
        ['GET', /^\/health$/, () => [200, { app: 'SkillMatch API', status: 'UP' }]],
        ['POST', /^\/auth\/login$/, (p, q, c) => {
            const u = d.usuarios.find(x => x.email === (c && c.email));
            return u && c.password ? [200, autenticacion(u)] : [401, { message: 'Correo o contraseña incorrectos' }];
        }],
        ['POST', /^\/auth\/register$/, (p, q, c) => {
            if (d.usuarios.some(x => x.email === c.email)) return [400, { message: 'El email ya está registrado' }];
            const esEmpresa = String(c.userType).toUpperCase() === 'EMPRESA';
            const u = { id: nuevoId('u'), email: c.email, firstName: c.firstName, lastName: c.lastName, phone: c.phone,
                role: esEmpresa ? 'EMPRESA' : 'USER', skills: [], experiences: [], educations: [], certifications: [] };
            if (esEmpresa) {
                u.companyId = nuevoId('c');
                d.empresas.push({ id: u.companyId, userId: u.id, name: c.firstName, location: 'No especificada', email: c.email, isVerified: false, active: true, createdAt: haceDias(0) });
            }
            d.usuarios.push(u);
            return [200, autenticacion(u)];
        }],
        ['POST', /^\/auth\/logout$/, () => [200, { message: 'Sesión cerrada' }]],
        ['GET', /^\/public\/stats$/, () => [200, { users: d.usuarios.filter(u => u.role === 'USER').length, companies: d.empresas.length, jobs: abiertas().length, applications: d.postulaciones.length }]],

        // Vacantes
        ['GET', /^\/jobs$/, (p, q) => [200, pagina(abiertas().map(respJob), q)]],
        ['GET', /^\/jobs\/recent$/, () => [200, abiertas().slice(0, 10).map(respJob)]],
        ['GET', /^\/jobs\/search$/, (p, q) => {
            const k = q.get('keyword') || '';
            return [200, pagina(abiertas().filter(j => contiene(j.title, k) || contiene(j.description, k)).map(respJob), q)];
        }],
        ['GET', /^\/jobs\/filter$/, (p, q) => {
            const v = n => q.get(n);
            const lista = abiertas().filter(j =>
                (!v('type') || j.type === v('type')) && (!v('modality') || j.modality === v('modality')) &&
                (!v('experienceLevel') || j.experienceLevel === v('experienceLevel')) &&
                (!v('location') || contiene(j.location, v('location'))) &&
                (!v('minSalary') || (j.salaryMax != null && j.salaryMax >= Number(v('minSalary')))) &&
                (!v('maxSalary') || (j.salaryMin != null && j.salaryMin <= Number(v('maxSalary')))));
            return [200, pagina(lista.map(respJob), q)];
        }],
        ['GET', /^\/jobs\/company\/([^/]+)$/, p => [200, d.vacantes.filter(j => j.companyId === p[1]).map(respJob)]],
        ['GET', /^\/jobs\/([^/]+)$/, p => { const j = vacante(p[1]); return j ? [200, respJob(j)] : [404, { message: 'Oferta no encontrada' }]; }],
        ['POST', /^\/jobs$/, (p, q, c) => {
            const j = { ...c, id: nuevoId('j'), status: 'abierta', active: true, postedDate: haceDias(0), createdAt: haceDias(0), updatedAt: haceDias(0) };
            d.vacantes.push(j);
            return [201, respJob(j)];
        }],
        ['PUT', /^\/jobs\/([^/]+)$/, (p, q, c) => { const j = vacante(p[1]); if (!j) return [404, {}]; Object.assign(j, c, { id: j.id }); return [200, respJob(j)]; }],
        ['PATCH', /^\/jobs\/([^/]+)\/status$/, (p, q) => {
            const j = vacante(p[1]); if (!j) return [404, {}];
            j.status = String(q.get('status')).toLowerCase(); j.active = j.status === 'abierta';
            return [200, respJob(j)];
        }],
        ['DELETE', /^\/jobs\/([^/]+)$/, p => { const j = vacante(p[1]); if (j) { j.status = 'cerrada'; j.active = false; } return [200, { message: 'Oferta cerrada' }]; }],

        // Empresas
        ['GET', /^\/companies$/, (p, q) => [200, pagina([...d.empresas].sort((a, b) => a.name.localeCompare(b.name)).map(respCompania), q, 24)]],
        ['GET', /^\/companies\/search$/, (p, q) => {
            const k = q.get('keyword') || '';
            return [200, d.empresas.filter(c => contiene(c.name, k) || contiene(c.industry, k) || contiene(c.location, k)).map(respCompania)];
        }],
        ['GET', /^\/companies\/([^/]+)\/statistics$/, p => {
            const ids = d.vacantes.filter(j => j.companyId === p[1]).map(j => j.id);
            const posts = d.postulaciones.filter(a => ids.includes(a.jobId));
            return [200, { profileViews: 0, activeJobs: d.vacantes.filter(j => j.companyId === p[1] && j.active).length, totalJobs: ids.length,
                totalApplications: posts.length, pendingApplications: posts.filter(a => a.status === 'pendiente').length,
                responseRate: posts.length ? Math.round(100 * posts.filter(a => a.status !== 'pendiente').length / posts.length) : 0 }];
        }],
        ['GET', /^\/companies\/([^/]+)$/, p => { const c = empresa(p[1]); return c ? [200, respCompania(c)] : [404, { message: 'Empresa no encontrada' }]; }],
        // Editar los datos de la empresa (PATCH /companies/{id}): null no cambia, '' quita
        ['PATCH', /^\/companies\/([^/]+)$/, (p, q, c, yo) => {
            const e = empresa(p[1]); if (!e) return [404, {}]; if (e.userId !== yo) return [403, { message: 'No es tu empresa' }];
            for (const k of ['name', 'industry', 'size', 'location', 'website', 'phone', 'benefits', 'description']) if (c[k] != null) e[k] = c[k] === '' ? null : c[k];
            if (c.foundedYear != null) e.foundedYear = c.foundedYear || null;
            const u = usuario(e.userId); if (u && c.name) u.firstName = c.name;
            return [200, respCompania(e)];
        }],
        // Cambiar el correo con un código (en la API falsa el código siempre es 123456)
        ['POST', /^\/users\/me\/email\/code$/, (p, q, c, yo) => {
            const u = usuario(yo); if (!u) return [401, {}];
            u.correoPendiente = String(c.email || '').toLowerCase();
            return [200, { message: 'Te enviamos un código de 6 números al correo nuevo.' }];
        }],
        ['POST', /^\/users\/me\/email\/verify$/, (p, q, c, yo) => {
            const u = usuario(yo);
            if (!u || !u.correoPendiente || c.codigo !== '123456') return [400, { message: 'El código no es correcto o ya venció. Pide uno nuevo.' }];
            u.email = u.correoPendiente; u.correoPendiente = null;
            return [200, { message: 'Listo: el correo de tu cuenta ahora es ' + u.email + '.', email: u.email }];
        }],
        ['PATCH', /^\/companies\/([^/]+)\/description$/, (p, q, c) => { const e = empresa(p[1]); if (!e) return [404, {}]; e.description = c.description; return [200, respCompania(e)]; }],

        // Postulaciones
        ['GET', /^\/applications\/my-applications$/, (p, q, c, yo) => [200, d.postulaciones.filter(a => a.userId === yo).map(respPostulacion)]],
        ['GET', /^\/applications\/company\/([^/]+)$/, p => {
            const ids = d.vacantes.filter(j => j.companyId === p[1]).map(j => j.id);
            return [200, d.postulaciones.filter(a => ids.includes(a.jobId)).map(respPostulacion)];
        }],
        ['GET', /^\/applications\/job\/([^/]+)\/count$/, p => [200, d.postulaciones.filter(a => a.jobId === p[1]).length]],
        ['GET', /^\/applications\/job\/([^/]+)$/, p => [200, d.postulaciones.filter(a => a.jobId === p[1]).map(respPostulacion)]],
        ['POST', /^\/applications$/, (p, q, c, yo) => {
            if (d.postulaciones.some(a => a.userId === yo && a.jobId === c.jobId)) return [400, { message: 'Ya te has postulado a esta oferta' }];
            const a = { id: nuevoId('a'), userId: yo, jobId: c.jobId, status: 'pendiente', coverLetter: c.coverLetter || '', appliedDate: haceDias(0) };
            d.postulaciones.push(a);
            return [201, respPostulacion(a)];
        }],
        ['PATCH', /^\/applications\/([^/]+)\/status$/, (p, q) => {
            const a = d.postulaciones.find(x => x.id === p[1]); if (!a) return [404, {}];
            a.status = String(q.get('status')).toLowerCase(); a.reviewedDate = haceDias(0);
            return [200, respPostulacion(a)];
        }],
        ['DELETE', /^\/applications\/([^/]+)$/, p => { d.postulaciones = d.postulaciones.filter(a => a.id !== p[1]); return [200, { message: 'Postulación retirada' }]; }],
        ['GET', /^\/applications\/([^/]+)$/, p => { const a = d.postulaciones.find(x => x.id === p[1]); return a ? [200, respPostulacion(a)] : [404, {}]; }],

        // Guardadas
        ['GET', /^\/saved-jobs\/job-ids$/, (p, q, c, yo) => [200, d.guardadas.filter(g => g.userId === yo).map(g => g.jobId)]],
        ['GET', /^\/saved-jobs\/my-saved-jobs$/, (p, q, c, yo) => [200, d.guardadas.filter(g => g.userId === yo).map(g => {
            const j = vacante(g.jobId) || {}; const e = empresa(j.companyId) || {};
            return { id: g.id, userId: yo, jobId: g.jobId, jobTitle: j.title, companyName: e.name, jobType: j.type, location: j.location, salaryRange: null, savedAt: g.savedAt, notes: null };
        })]],
        ['POST', /^\/saved-jobs$/, (p, q, c, yo) => { const g = { id: nuevoId('g'), userId: yo, jobId: c.jobId, savedAt: haceDias(0) }; d.guardadas.push(g); return [201, g]; }],
        ['DELETE', /^\/saved-jobs\/job\/([^/]+)$/, (p, q, c, yo) => { d.guardadas = d.guardadas.filter(g => !(g.userId === yo && g.jobId === p[1])); return [200, {}]; }],

        // Conexiones
        ['GET', /^\/connections\/my-connections$/, (p, q, c, yo) => [200, d.conexiones.filter(k => k.status === 'accepted' && (k.userId === yo || k.connectedUserId === yo)).map(respConexion)]],
        ['GET', /^\/connections\/pending-requests$/, (p, q, c, yo) => [200, d.conexiones.filter(k => k.status === 'pending' && k.connectedUserId === yo).map(respConexion)]],
        ['GET', /^\/connections\/sent-requests$/, (p, q, c, yo) => [200, d.conexiones.filter(k => k.status === 'pending' && k.userId === yo).map(respConexion)]],
        ['GET', /^\/connections\/suggestions$/, (p, q, c, yo) => {
            const ligados = new Set(d.conexiones.filter(k => k.userId === yo || k.connectedUserId === yo).flatMap(k => [k.userId, k.connectedUserId]));
            return [200, d.usuarios.filter(u => u.role === 'USER' && u.id !== yo && !ligados.has(u.id))
                .map(u => ({ id: u.id, firstName: u.firstName, lastName: u.lastName, headline: u.headline, location: u.location, skills: u.skills.map(s => ({ name: s.name })) }))];
        }],
        ['GET', /^\/connections\/check\/([^/]+)$/, (p, q, c, yo) => [200, { isConnected: d.conexiones.some(k => k.status === 'accepted' && [k.userId, k.connectedUserId].includes(yo) && [k.userId, k.connectedUserId].includes(p[1])) }]],
        ['POST', /^\/connections$/, (p, q, c, yo) => {
            const k = { id: nuevoId('k'), userId: yo, connectedUserId: c.connectedUserId, status: 'pending', message: c.message || '', requestedAt: haceDias(0) };
            d.conexiones.push(k);
            return [201, respConexion(k)];
        }],
        ['PATCH', /^\/connections\/([^/]+)\/(accept|reject)$/, p => {
            const k = d.conexiones.find(x => x.id === p[1]); if (!k) return [404, {}];
            k.status = p[2] === 'accept' ? 'accepted' : 'rejected'; k.respondedAt = haceDias(0);
            return [200, respConexion(k)];
        }],
        ['DELETE', /^\/connections\/([^/]+)$/, p => { d.conexiones = d.conexiones.filter(k => k.id !== p[1]); return [200, {}]; }],

        // Mensajes
        ['GET', /^\/messages\/conversations$/, (p, q, c, yo) => {
            const ultimos = new Map();
            d.mensajes.filter(m => visiblePara(m, yo)).sort(porFecha('sentAt')).forEach(m => {
                const otro = m.senderId === yo ? m.receiverId : m.senderId;
                if (!ultimos.has(otro)) ultimos.set(otro, m);
            });
            return [200, [...ultimos.values()].map(respMensaje)];
        }],
        ['GET', /^\/messages\/unread-counts-by-conversation$/, (p, q, c, yo) => {
            const cuenta = {};
            d.mensajes.filter(m => m.receiverId === yo && !m.isRead && !m.deletedByReceiver).forEach(m => { cuenta[m.senderId] = (cuenta[m.senderId] || 0) + 1; });
            return [200, cuenta];
        }],
        ['GET', /^\/messages\/unread-count$/, (p, q, c, yo) => [200, { count: d.mensajes.filter(m => m.receiverId === yo && !m.isRead && !m.deletedByReceiver).length }]],
        ['GET', /^\/messages\/conversation\/([^/]+)$/, (p, q, c, yo) => [200, d.mensajes
            .filter(m => visiblePara(m, yo) && ((m.senderId === yo && m.receiverId === p[1]) || (m.senderId === p[1] && m.receiverId === yo)))
            .sort((a, b) => String(a.sentAt).localeCompare(String(b.sentAt))).map(respMensaje)]],
        ['PATCH', /^\/messages\/conversation\/([^/]+)\/read-all$/, (p, q, c, yo) => {
            d.mensajes.filter(m => m.senderId === p[1] && m.receiverId === yo).forEach(m => { m.isRead = true; m.readAt = haceDias(0); });
            return [200, { message: 'ok' }];
        }],
        ['PATCH', /^\/messages\/([^/]+)\/read$/, p => { const m = d.mensajes.find(x => x.id === p[1]); if (m) m.isRead = true; return [200, m ? respMensaje(m) : {}]; }],
        ['POST', /^\/messages$/, (p, q, c, yo) => {
            const m = { id: nuevoId('m'), senderId: yo, receiverId: c.receiverId, content: c.content, isRead: false, sentAt: haceDias(0) };
            d.mensajes.push(m);
            return [201, respMensaje(m)];
        }],
        ['DELETE', /^\/messages\/([^/]+)$/, (p, q, c, yo) => {
            const m = d.mensajes.find(x => x.id === p[1]); if (!m) return [404, {}];
            if (m.senderId === yo) m.deletedBySender = true; else if (m.receiverId === yo) m.deletedByReceiver = true; else return [403, {}];
            if (m.deletedBySender && m.deletedByReceiver) d.mensajes = d.mensajes.filter(x => x !== m);
            return [200, { message: 'Mensaje eliminado' }];
        }],
        // Toda la conversación de una vez, solo de mi lado (F5)
        ['DELETE', /^\/messages\/conversation\/([^/]+)$/, (p, q, c, yo) => {
            d.mensajes.forEach(m => {
                if (m.senderId === yo && m.receiverId === p[1]) m.deletedBySender = true;
                if (m.senderId === p[1] && m.receiverId === yo) m.deletedByReceiver = true;
            });
            d.mensajes = d.mensajes.filter(m => !(m.deletedBySender && m.deletedByReceiver));
            return [200, { message: 'Conversación eliminada' }];
        }],
        // Entrar con Google (F13): la API falsa no tiene credenciales de Google
        ['GET', /^\/auth\/google\/disponible$/, () => [200, { disponible: false }]],

        // Avisos (notificaciones)
        ['GET', /^\/notifications$/, (p, q, c, yo) => [200, d.avisos.filter(n => n.userId === yo).sort(porFecha('createdAt'))]],
        ['GET', /^\/notifications\/unread$/, (p, q, c, yo) => [200, d.avisos.filter(n => n.userId === yo && !n.isRead)]],
        ['GET', /^\/notifications\/count$/, (p, q, c, yo) => [200, { count: d.avisos.filter(n => n.userId === yo && !n.isRead).length }]],
        ['PATCH', /^\/notifications\/read-all$/, (p, q, c, yo) => { d.avisos.filter(n => n.userId === yo).forEach(n => { n.isRead = true; }); return [200, {}]; }],
        ['PATCH', /^\/notifications\/([^/]+)\/read$/, p => { const n = d.avisos.find(x => x.id === p[1]); if (n) n.isRead = true; return [200, n || {}]; }],

        // Personas
        ['GET', /^\/users\/me$/, (p, q, c, yo) => { const u = usuario(yo); return u ? [200, perfil(u)] : [401, {}]; }],
        ['PUT', /^\/users\/([^/]+)\/(profile|cover)-image$/, (p, q, c) => {
            const u = usuario(p[1]); if (!u) return [404, {}];
            if (p[2] === 'profile') u.profileImageUrl = c.imageUrl; else u.coverImageUrl = c.imageUrl;
            return [200, perfil(u)];
        }],
        ['PUT', /^\/users\/([^/]+)\/password$/, () => [200, { message: 'Contraseña actualizada' }]],
        ['GET', /^\/users\/([^/]+)\/statistics$/, () => [200, {}]],
        ['GET', /^\/users\/([^/]+)\/(skills|experiences|educations|certifications)$/, p => { const u = usuario(p[1]); return u ? [200, u[p[2]]] : [404, {}]; }],
        ['POST', /^\/users\/([^/]+)\/(skills|experiences|educations|certifications)$/, (p, q, c) => {
            const u = usuario(p[1]); if (!u) return [404, {}];
            const item = { ...c, id: nuevoId(p[2][0]) };
            u[p[2]].push(item);
            return [201, item];
        }],
        ['DELETE', /^\/users\/([^/]+)\/(skills|experiences|educations|certifications)\/([^/]+)$/, p => {
            const u = usuario(p[1]); if (!u) return [404, {}];
            u[p[2]] = u[p[2]].filter(x => x.id !== p[3]);
            return [200, {}];
        }],
        ['GET', /^\/users\/([^/]+)$/, p => { const u = usuario(p[1]); return u ? [200, perfil(u)] : [404, { message: 'Usuario no encontrado' }]; }],
        ['PUT', /^\/users\/([^/]+)$/, (p, q, c) => {
            const u = usuario(p[1]); if (!u) return [404, {}];
            ['firstName', 'lastName', 'phone', 'headline', 'location', 'bio'].forEach(k => { if (c[k] !== undefined) u[k] = c[k]; });
            return [200, perfil(u)];
        }]
    ];

    function responder(metodo, url, cabeceras, cuerpoTexto) {
        const direccion = new URL(url);
        const ruta = direccion.pathname.replace(/^\/api/, '');
        let cuerpo = null;
        try { cuerpo = cuerpoTexto ? JSON.parse(cuerpoTexto) : null; } catch (e) { cuerpo = null; }
        estado.llamadas.push(`${metodo} ${ruta}`);
        for (const [m, patron, fn] of rutas) {
            if (m !== metodo) continue;
            const p = ruta.match(patron);
            if (p) return fn(p, direccion.searchParams, cuerpo, quienPide(cabeceras));
        }
        estado.desconocidas.push(`${metodo} ${ruta}`);
        return [404, { message: `La API falsa no conoce ${metodo} ${ruta}` }];
    }

    // Se conecta al navegador de la prueba: toda llamada a la API pasa por aqui
    async function conectar(contexto) {
        await contexto.route(`${BASE}/**`, async (ruta) => {
            const pedido = ruta.request();
            const origen = pedido.headers().origin || 'http://localhost:5510';
            const cors = {
                'Access-Control-Allow-Origin': origen,
                'Access-Control-Allow-Credentials': 'true',
                'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
            };
            if (pedido.method() === 'OPTIONS') return ruta.fulfill({ status: 204, headers: cors });
            if (estado.demora) await new Promise(r => setTimeout(r, estado.demora));
            // headers() no trae la cookie y allHeaders() se queda esperando en una ruta
            // interceptada: la cookie se lee del navegador, que es la que enviaría
            const sesion = (await contexto.cookies(pedido.url())).find(k => k.name === 'auth_token' && k.value);
            const cabecerasPedido = { ...pedido.headers(), cookie: sesion ? `auth_token=${sesion.value}` : '' };
            const [codigo, cuerpo] = responder(pedido.method(), pedido.url(), cabecerasPedido, pedido.postData());
            const cabeceras = { ...cors, 'Content-Type': 'application/json' };
            // Como el backend: entrar o registrarse deja la cookie; cerrar sesión la borra
            if (codigo === 200 && cuerpo && cuerpo.token) cabeceras['Set-Cookie'] = `auth_token=${cuerpo.token}; Path=/; HttpOnly; SameSite=Lax`;
            if (/\/auth\/logout$/.test(pedido.url())) cabeceras['Set-Cookie'] = 'auth_token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax';
            await ruta.fulfill({ status: codigo, headers: cabeceras, body: JSON.stringify(cuerpo) });
        });
    }

    return { estado, conectar, tokenPara, usuario };
}

/** La sesión de una cuenta de prueba: la cookie que el backend deja al entrar. */
async function cookieDeSesion(contexto, userId) {
    await contexto.addCookies([{ name: 'auth_token', value: tokenPara(userId), domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }]);
}

module.exports = { crearApi, tokenPara, cookieDeSesion, BASE };
