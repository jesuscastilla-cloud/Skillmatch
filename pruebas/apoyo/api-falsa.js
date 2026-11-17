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
    // Lo que aprendio el modelo: el JSON que el script de Python deja en el sitio
    const modeloDelSitio = () => JSON.parse(require('fs').readFileSync(
        require('path').join(__dirname, '../../SkillMatch/src/assets/data/modelo-predictivo.json'), 'utf8'));
    // Que correos recibe cada cuenta (como PreferenciasCorreo: vacantes apagado al empezar)
    const preferenciasDe = {};
    const preferencias = id => preferenciasDe[id] || (preferenciasDe[id] = { respuesta: true, mensajes: true, vacantes: false, postulaciones: true, invitaciones: true });
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
            jobId: a.jobId, jobTitle: j && j.title, companyName: c && c.name, jobStatus: j && String(j.status || '').toUpperCase(), jobActive: j ? j.active !== false : null, status: a.status, resume: null,
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

    // ---- Invitaciones y planes: lo mismo que InvitacionService y PlanService
    const CATALOGO = [
        { id: 'BASICO', nombre: 'Básico', precioMensual: 0, periodo: 'mes', moneda: 'COP', invitacionesMes: 20, maxPorEnvio: 10, procesosActivos: 2, horariosPorProceso: 3,
          recordatorios: false, exportarRespuestas: false, beneficios: ['Invita hasta 20 candidatos al mes a una entrevista o evaluación', 'Hasta 10 candidatos en cada envío', 'Propón hasta 3 horarios por proceso', 'Mira quién confirmó y quién no puede, en un solo panel'] },
        { id: 'PROFESIONAL', nombre: 'Profesional', precioMensual: 49900, periodo: 'mes', moneda: 'COP', invitacionesMes: 300, maxPorEnvio: 50, procesosActivos: 15, horariosPorProceso: 8,
          recordatorios: true, exportarRespuestas: true, beneficios: ['Invita hasta 300 candidatos al mes', 'Hasta 50 candidatos en cada envío', 'Propón hasta 8 horarios por proceso, con cupos en cada uno', 'Envía un recordatorio a quienes no han respondido', 'Descarga las respuestas en Excel', 'Hasta 15 procesos abiertos a la vez'] }
    ];
    const aJava = f => { const x = new Date(f.getTime() - f.getTimezoneOffset() * 60000); return x.toISOString().slice(0, 19); };
    const ahoraJava = () => aJava(new Date());
    const empresaDe = yo => d.empresas.find(c => c.userId === yo) || null;
    const esAdmin = yo => (usuario(yo) || {}).role === 'ADMIN';
    const planDe = companyId => {
        const x = d.planes[companyId];
        return x && x.plan === 'PROFESIONAL' && new Date(x.vigenteHasta) > new Date() ? CATALOGO[1] : CATALOGO[0];
    };
    const inicioMes = () => { const f = new Date(); f.setDate(1); f.setHours(0, 0, 0, 0); return f; };
    const usoMes = companyId => d.invitados.filter(ic => ic.companyId === companyId && new Date(ic.createdAt) >= inicioMes()).length;
    const vencida = inv => new Date(inv.respondeAntesDe) < new Date();
    const estadoReal = (ic, inv) => (ic.estado === 'PENDIENTE' && vencida(inv) ? 'VENCIDA' : ic.estado);
    const resumenPlan = emp => {
        const plan = planDe(emp.id); const x = d.planes[emp.id];
        const pendiente = d.solicitudes.some(s => s.companyId === emp.id && s.estado === 'PENDIENTE');
        const lista = d.comercial.banco && d.comercial.numeroCuenta && d.comercial.titular && d.comercial.correoPagos;
        const finMes = inicioMes(); finMes.setMonth(finMes.getMonth() + 1);
        return { plan, vigenteHasta: plan.id === 'PROFESIONAL' ? x.vigenteHasta : null,
            vencidoEl: plan.id !== 'PROFESIONAL' && x && x.plan === 'PROFESIONAL' ? x.vigenteHasta : null,
            uso: { invitacionesMes: usoMes(emp.id), limiteMes: plan.invitacionesMes,
                procesosActivos: d.invitaciones.filter(i => i.companyId === emp.id && i.estado === 'ACTIVA' && !vencida(i)).length,
                limiteProcesos: plan.procesosActivos, seRenuevaEl: aJava(finMes) },
            solicitudes: d.solicitudes.filter(s => s.companyId === emp.id).slice(0, 5),
            pago: pendiente && lista ? { ...d.comercial } : null, pagoPorTransferencia: !!lista };
    };
    const resumenInv = inv => {
        const lista = d.invitados.filter(ic => ic.invitacionId === inv.id);
        const cuentas = { pendiente: 0, confirmada: 0, rechazada: 0, vencida: 0, cancelada: 0 };
        lista.forEach(ic => { cuentas[estadoReal(ic, inv).toLowerCase()]++; });
        const plan = planDe(inv.companyId);
        return { ...inv, cuentas, total: lista.length, vencida: vencida(inv), recordatorios: plan.recordatorios, exportarRespuestas: plan.exportarRespuestas,
            horarios: inv.horarios.map(h => ({ ...h, confirmados: lista.filter(ic => ic.estado === 'CONFIRMADA' && ic.horarioId === h.id).length })) };
    };
    const detalleInv = inv => ({ ...resumenInv(inv), candidatos: d.invitados.filter(ic => ic.invitacionId === inv.id).map(ic => {
        const u = usuario(ic.userId);
        return { id: ic.id, applicationId: ic.applicationId, userId: ic.userId, nombre: nombre(u), titular: u && u.headline, foto: null,
            estado: estadoReal(ic, inv), horarioId: ic.horarioId, comentario: ic.comentario, respondidaEn: ic.respondidaEn, recordadaEn: ic.recordadaEn };
    }) });
    const vistaCandidato = ic => {
        const inv = d.invitaciones.find(i => i.id === ic.invitacionId);
        const abierta = inv.estado === 'ACTIVA' && !vencida(inv);
        return { ...inv, invitacionId: inv.id, id: ic.id, applicationId: ic.applicationId, empresa: (empresa(inv.companyId) || {}).name,
            miEstado: estadoReal(ic, inv), horarioId: ic.horarioId, comentario: ic.comentario, respondidaEn: ic.respondidaEn,
            puedeResponder: abierta && ic.estado !== 'CANCELADA',
            lugar: inv.lugar, enlace: ic.estado === 'CONFIRMADA' ? inv.enlace : null,
            horarios: inv.horarios.map(h => {
                const ocupados = d.invitados.filter(x => x.invitacionId === inv.id && x.estado === 'CONFIRMADA' && x.horarioId === h.id).length;
                const mio = ic.horarioId === h.id && ic.estado === 'CONFIRMADA';
                return { id: h.id, inicio: h.inicio, disponible: mio || (ocupados < h.cupos && new Date(h.inicio) > new Date()) };
            }) };
    };

    const rutas = [

        // ---- Planes (PlanController) y su catalogo (CatalogoPlanes.java)
        ['GET', /^\/public\/planes$/, () => [200, CATALOGO]],
        ['GET', /^\/admin\/correos\/estado$/, (p, q, c, yo) => yo === 'u-admin'
            ? [200, { enviadosHoy: 12, descartadosHoy: 0, topeDiario: 400, pendientes: 0, reservadoParaCodigos: 100 }] : [403, {}]],
        ['GET', /^\/planes\/mio$/, (p, q, c, yo) => {
            const emp = empresaDe(yo); if (!emp) return [403, { message: 'Esta cuenta no tiene una empresa' }];
            return [200, resumenPlan(emp)];
        }],
        ['POST', /^\/planes\/solicitudes$/, (p, q, c, yo) => {
            const emp = empresaDe(yo); if (!emp) return [403, {}];
            if (!c || c.plan !== 'PROFESIONAL') return [400, { message: 'Ese plan no se puede solicitar.' }];
            const meses = c.meses || 1;
            if (![1, 3, 6].includes(meses)) return [400, { message: 'Elige 1, 3 o 6 meses.' }];
            if (d.solicitudes.some(s => s.companyId === emp.id && s.estado === 'PENDIENTE')) return [400, { message: 'Ya tienes una solicitud pendiente de verificación.' }];
            const u = usuario(yo);
            d.solicitudes.unshift({ id: nuevoId('sol'), companyId: emp.id, companyName: emp.name, userId: yo, plan: 'PROFESIONAL', meses,
                valor: 49900 * meses, contactoNombre: c.contactoNombre || nombre(u), contactoCorreo: u.email, contactoTelefono: c.contactoTelefono || null,
                nota: c.nota || null, estado: 'PENDIENTE', createdAt: ahoraJava() });
            return [201, resumenPlan(emp)];
        }],
        ['DELETE', /^\/planes\/solicitudes\/([^/]+)$/, (p, q, c, yo) => {
            const emp = empresaDe(yo); const s = d.solicitudes.find(x => x.id === p[1] && emp && x.companyId === emp.id);
            if (!s) return [404, { message: 'Solicitud no encontrada' }];
            if (s.estado !== 'PENDIENTE') return [400, { message: 'Esta solicitud ya fue atendida.' }];
            s.estado = 'CANCELADA'; return [200, resumenPlan(emp)];
        }],
        ['GET', /^\/admin\/planes\/solicitudes$/, (p, q, c, yo) => {
            if (!esAdmin(yo)) return [403, { message: 'Acceso denegado' }];
            const e = q.get('estado');
            return [200, d.solicitudes.filter(s => !e || s.estado === e).map(s => ({ ...s, planActual: planDe(s.companyId).id }))];
        }],
        ['POST', /^\/admin\/planes\/solicitudes\/([^/]+)\/(aprobar|rechazar)$/, (p, q, c, yo) => {
            if (!esAdmin(yo)) return [403, { message: 'Acceso denegado' }];
            const s = d.solicitudes.find(x => x.id === p[1]);
            if (!s) return [404, { message: 'Solicitud no encontrada' }];
            if (s.estado !== 'PENDIENTE') return [400, { message: 'Esta solicitud ya fue atendida.' }];
            if (p[2] === 'rechazar') {
                if (!c || !c.nota) return [400, { message: 'Escribe el motivo para la empresa.' }];
                s.estado = 'RECHAZADA'; s.notaAdmin = c.nota;
            } else {
                const meses = (c && c.meses) || s.meses;
                const actual = d.planes[s.companyId];
                const desde = actual && new Date(actual.vigenteHasta) > new Date() ? new Date(actual.vigenteHasta) : new Date();
                desde.setMonth(desde.getMonth() + meses);
                d.planes[s.companyId] = { plan: 'PROFESIONAL', vigenteHasta: aJava(desde) };
                s.estado = 'APROBADA'; s.meses = meses; s.notaAdmin = (c && c.nota) || null;
            }
            s.atendidaEn = ahoraJava();
            return [200, s];
        }],
        ['GET', /^\/admin\/planes\/empresas$/, (p, q, c, yo) => esAdmin(yo)
            ? [200, Object.entries(d.planes).filter(([, x]) => new Date(x.vigenteHasta) > new Date())
                .map(([id, x]) => ({ companyId: id, companyName: (empresa(id) || {}).name, vigenteHasta: x.vigenteHasta, invitacionesMes: usoMes(id) }))]
            : [403, {}]],
        ['GET', /^\/admin\/comercial$/, (p, q, c, yo) => (esAdmin(yo) ? [200, d.comercial] : [403, {}])],
        ['PUT', /^\/admin\/comercial$/, (p, q, c, yo) => {
            if (!esAdmin(yo)) return [403, {}];
            d.comercial = { ...c, actualizado: ahoraJava() };
            return [200, d.comercial];
        }],

        // ---- Invitaciones a la siguiente etapa (InvitacionController)
        ['POST', /^\/invitaciones$/, (p, q, c, yo) => {
            const emp = empresaDe(yo); if (!emp) return [403, {}];
            const job = vacante(c.jobId);
            if (!job || job.companyId !== emp.id) return [403, { message: 'Esa vacante no es de tu empresa' }];
            const plan = planDe(emp.id);
            const ids = [...new Set(c.applicationIds || [])];
            if (ids.length > plan.maxPorEnvio) return [409, { codigo: 'cupo', message: `Tu plan permite invitar hasta ${plan.maxPorEnvio} candidatos en cada envío.` }];
            const usadas = usoMes(emp.id);
            if (usadas + ids.length > plan.invitacionesMes) {
                const quedan = Math.max(0, plan.invitacionesMes - usadas);
                return [409, { codigo: 'cupo', message: quedan ? `Te quedan ${quedan} invitaciones este mes y elegiste ${ids.length}.` : `Ya usaste las ${plan.invitacionesMes} invitaciones de este mes.` }];
            }
            if ((c.horarios || []).length > plan.horariosPorProceso) return [409, { codigo: 'cupo', message: `Tu plan permite proponer hasta ${plan.horariosPorProceso} horarios por proceso.` }];
            const apps = ids.map(id => d.postulaciones.find(a => a.id === id));
            if (apps.some(a => !a || a.jobId !== job.id)) return [400, { message: 'Algunos candidatos no se postularon a esta vacante.' }];
            if (apps.some(a => ['rechazada', 'retirada'].includes(a.status))) return [400, { message: 'No puedes invitar a quien retiró su postulación o ya fue rechazado.' }];
            const horarios = c.horarios.map((h, i) => ({ id: 'h' + (i + 1) + '-' + d.siguiente, inicio: h.inicio, cupos: h.cupos }))
                .sort((a, b) => a.inicio.localeCompare(b.inicio));
            const primero = new Date(horarios[0].inicio);
            const limite = c.respondeAntesDe || aJava(new Date(primero.getTime() - 2 * 3600 * 1000));
            const inv = { id: nuevoId('inv'), companyId: emp.id, companyUserId: yo, jobId: job.id, jobTitle: job.title, tipo: c.tipo, modalidad: c.modalidad,
                lugar: c.lugar || null, enlace: c.enlace || null, indicaciones: c.indicaciones || null, duracionMinutos: c.duracionMinutos || 30,
                horarios, respondeAntesDe: limite, estado: 'ACTIVA', createdAt: ahoraJava() };
            d.invitaciones.unshift(inv);
            apps.forEach(a => d.invitados.push({ id: nuevoId('ic'), invitacionId: inv.id, applicationId: a.id, userId: a.userId, companyId: emp.id,
                jobId: job.id, estado: 'PENDIENTE', horarioId: null, comentario: null, respondidaEn: null, recordadaEn: null, createdAt: ahoraJava() }));
            return [201, detalleInv(inv)];
        }],
        ['GET', /^\/invitaciones$/, (p, q, c, yo) => {
            const emp = empresaDe(yo); if (!emp) return [403, {}];
            return [200, d.invitaciones.filter(i => i.companyId === emp.id).map(resumenInv)];
        }],
        ['GET', /^\/invitaciones\/mias$/, (p, q, c, yo) => [200, d.invitados.filter(ic => ic.userId === yo).map(vistaCandidato)]],
        ['GET', /^\/invitaciones\/([^/]+)$/, (p, q, c, yo) => {
            const emp = empresaDe(yo); const inv = d.invitaciones.find(i => i.id === p[1] && emp && i.companyId === emp.id);
            return inv ? [200, detalleInv(inv)] : [404, { message: 'Proceso no encontrado' }];
        }],
        ['POST', /^\/invitaciones\/([^/]+)\/(recordar|cancelar)$/, (p, q, c, yo) => {
            const emp = empresaDe(yo); const inv = d.invitaciones.find(i => i.id === p[1] && emp && i.companyId === emp.id);
            if (!inv) return [404, { message: 'Proceso no encontrado' }];
            if (p[2] === 'cancelar') {
                inv.estado = 'CANCELADA';
                d.invitados.filter(ic => ic.invitacionId === inv.id && ['PENDIENTE', 'CONFIRMADA'].includes(ic.estado)).forEach(ic => { ic.estado = 'CANCELADA'; });
                return [200, detalleInv(inv)];
            }
            if (!planDe(inv.companyId).recordatorios) return [409, { codigo: 'cupo', message: 'Los recordatorios están en el plan Profesional.' }];
            let n = 0;
            d.invitados.filter(ic => ic.invitacionId === inv.id && ic.estado === 'PENDIENTE').forEach(ic => {
                if (ic.recordadaEn && Date.now() - new Date(ic.recordadaEn) < 864e5) return;
                ic.recordadaEn = ahoraJava(); n++;
            });
            return [200, { ...detalleInv(inv), recordados: n }];
        }],
        ['POST', /^\/invitaciones\/respuestas\/([^/]+)$/, (p, q, c, yo) => {
            const ic = d.invitados.find(x => x.id === p[1] && x.userId === yo);
            if (!ic) return [404, { message: 'Invitación no encontrada' }];
            const inv = d.invitaciones.find(i => i.id === ic.invitacionId);
            if (inv.estado === 'CANCELADA' || ic.estado === 'CANCELADA') return [400, { message: 'La empresa canceló esta invitación.' }];
            if (new Date(inv.respondeAntesDe) < new Date()) return [400, { message: 'El plazo para responder ya terminó.' }];
            if (c.asiste) {
                const h = inv.horarios.find(x => x.id === c.horarioId);
                if (!h) return [400, { message: 'Elige uno de los horarios propuestos.' }];
                const ocupados = d.invitados.filter(x => x.invitacionId === inv.id && x.estado === 'CONFIRMADA' && x.horarioId === h.id && x.id !== ic.id).length;
                if (ocupados >= h.cupos) return [400, { message: 'Ese horario ya se llenó. Elige otro.' }];
                ic.estado = 'CONFIRMADA'; ic.horarioId = h.id;
            } else { ic.estado = 'RECHAZADA'; ic.horarioId = null; }
            ic.comentario = c.comentario || null; ic.respondidaEn = ahoraJava();
            return [200, vistaCandidato(ic)];
        }],
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
        // Modelo predictivo: por defecto, lo mismo que publica el script de Python en el sitio
        // (las pruebas pueden cambiarlo con api.estado.modelo)
        ['GET', /^\/public\/modelo$/, () => [200, estado.modelo || modeloDelSitio()]],
        ['GET', /^\/modelo\/mis-postulaciones$/, (p, q, c, yo) => {
            if (!yo) return [401, {}];
            const u = usuario(yo);
            const enProceso = d.postulaciones.filter(a => a.userId === yo && ['pendiente', 'revisada'].includes(String(a.status).toLowerCase()));
            return [200, enProceso.map(a => {
                const j = vacante(a.jobId) || {};
                const suyas = new Set((u.skills || []).map(s => s.name.toLowerCase()));
                const pedidas = j.skills || [];
                const tiene = pedidas.filter(h => suyas.has(String(h).toLowerCase())).length;
                return { applicationId: a.id, faltan: pedidas.filter(h => !suyas.has(String(h).toLowerCase())),
                    caracteristicas: { pct_habilidades: pedidas.length ? Math.round(100 * tiene / pedidas.length) : 0,
                        nivel_dominio: tiene ? 2 : 0, anos_experiencia: 0, alcanza_experiencia: 1, num_estudios: 0,
                        perfil_completo: 60, tiene_carta: a.coverLetter ? 1 : 0, palabras_carta: String(a.coverLetter || '').split(/\s+/).filter(Boolean).length,
                        misma_ciudad: 1, tipo_empleo: 1, tipo_practica: 0, tipo_freelance: 0, dias_para_postularse: 1, postulantes_previos: 0 } };
            })];
        }],
        ['GET', /^\/correos\/preferencias$/, (p, q, c, yo) => yo ? [200, preferencias(yo)] : [401, {}]],
        ['PUT', /^\/correos\/preferencias$/, (p, q, c, yo) => {
            if (!yo) return [401, {}];
            Object.assign(preferencias(yo), c);
            return [200, preferencias(yo)];
        }],
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
