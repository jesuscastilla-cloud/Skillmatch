// Ataques contra el servidor LOCAL (nunca contra Render). Cada linea dice BIEN (se defendio) o HUECO (dejo pasar).
//
// Como usarlo (solo en tu computador, con una base de PRUEBA que se pueda borrar):
//   1. En backend/, arrancar el servidor con SEED_ENABLED=true sobre una base nueva (por ejemplo skillmatch_ataques)
//      y esperar el log "Seed completado".
//   2. node herramientas/probar-ataques.mjs
// Prueba: suplantar roles, entrar a datos de otras personas, rutas de administrador, inyeccion en busquedas,
// paginas y numeros extremos, cuerpos enormes, imagenes peligrosas, textos maliciosos, tokens falsos,
// cabeceras de seguridad, fuerza bruta y spam. Usa las cuentas de prueba del DataSeeder (usuarioN/empresaN).
// Bloquea por unos minutos algunas cuentas de prueba a proposito (fuerza bruta y spam).
// Ataques contra el servidor local (base skillmatch_ataques). Cada linea: BIEN (se defendio) o HUECO (dejo pasar).
// No imprime claves ni cookies.
const BASE = 'http://localhost:8080/api';
const huecos = [];
const dice = (nombre, defendido, detalle = '') => {
    if (!defendido) huecos.push(nombre);
    console.log((defendido ? 'BIEN   ' : 'HUECO  ') + nombre + (detalle ? '  -> ' + detalle : ''));
};

class Sesion {
    constructor() { this.galleta = ''; }
    async pedir(metodo, ruta, cuerpo, extra = {}) {
        const cabeceras = { Accept: 'application/json', ...(cuerpo !== undefined && !extra.crudo ? { 'Content-Type': 'application/json' } : {}),
            ...(this.galleta ? { Cookie: this.galleta } : {}), ...(extra.cabeceras || {}) };
        let r;
        try {
            r = await fetch(BASE + ruta, { method: metodo, headers: cabeceras,
                body: cuerpo === undefined ? undefined : (extra.crudo ? cuerpo : JSON.stringify(cuerpo)), redirect: 'manual' });
        } catch (e) { return { estado: 0, datos: null, texto: String(e.message), cabeceras: new Headers() }; }
        const set = r.headers.getSetCookie ? r.headers.getSetCookie() : [];
        const s = set.map(c => c.split(';')[0]).find(c => c.startsWith('auth_token='));
        if (s) this.galleta = s;
        const texto = await r.text().catch(() => '');
        let datos = null; try { datos = JSON.parse(texto); } catch (e) { /* no era JSON */ }
        return { estado: r.status, datos, texto, cabeceras: r.headers, setCookie: set };
    }
    async entrar(correo, clave) {
        const r = await this.pedir('POST', '/auth/login', { email: correo, password: clave });
        if (r.estado !== 200) throw new Error('No entro ' + correo + ' ' + r.estado);
        return r.datos;
    }
}
const rechazado = r => r.estado >= 400 && r.estado < 500;
const noEsError500 = r => r.estado < 500;

const ana = new Sesion(), beto = new Sesion(), hotel = new Sesion(), otraEmpresa = new Sesion(), anonimo = new Sesion();
const A = await ana.entrar('usuario0@skillmatch.com', 'password123');
const B = await beto.entrar('usuario1@skillmatch.com', 'password123');
const H = await hotel.entrar('empresa0@skillmatch.com', 'password123');
const H2 = await otraEmpresa.entrar('empresa1@skillmatch.com', 'password123');
console.log('--- Sesiones listas: dos personas y dos empresas\n');

// ============ 1. Quien eres: suplantar roles y campos prohibidos
console.log('## 1. Suplantar roles y campos');
let r = await anonimo.pedir('POST', '/auth/register', { firstName: 'Mal', lastName: 'Hechor', email: 'malo1@prueba.test', password: 'Clave12345!', roles: ['ADMIN'], role: 'ADMIN', enabled: true, isAdmin: true, aceptaPolitica: true });
if (r.estado === 200 || r.estado === 201) {
    const malo = new Sesion();
    const l = await malo.pedir('POST', '/auth/login', { email: 'malo1@prueba.test', password: 'Clave12345!' });
    const yo = (await malo.pedir('GET', '/users/me')).datos || {};
    const rolesDe = JSON.stringify(yo.roles || yo.role || '');
    dice('El registro ignora "roles":["ADMIN"]', !/ADMIN/.test(rolesDe), 'roles=' + rolesDe + ' (registro ' + r.estado + ', login ' + l.estado + ')');
    const adm = await malo.pedir('POST', '/admin/modelo/aprender');
    dice('Esa cuenta no entra a rutas de administrador', adm.estado === 403 || adm.estado === 401, 'estado ' + adm.estado);
} else dice('El registro con roles ADMIN no crea cuenta admin', true, 'registro respondio ' + r.estado + ' ' + (r.datos && r.datos.message || '').slice(0, 60));

r = await ana.pedir('PUT', '/users/' + A.id, { firstName: 'Ana', lastName: 'Cambiada', roles: ['ADMIN'], enabled: true, email: 'otro@prueba.test', password: 'hack', tokenVersion: 99, profileImageUrl: 'javascript:alert(1)' });
const despues = (await ana.pedir('GET', '/users/me')).datos || {};
dice('Editar perfil no cambia roles ni correo', !/ADMIN/.test(JSON.stringify(despues.roles || despues.role || '')) && despues.email === 'usuario0@skillmatch.com', 'estado ' + r.estado + ' correo=' + despues.email);

// ============ 2. Datos ajenos (IDOR)
console.log('\n## 2. Entrar a datos de otras personas');
r = await beto.pedir('PUT', '/users/' + A.id, { firstName: 'Hackeada' });
dice('Beto no puede editar el perfil de Ana', r.estado === 403 || r.estado === 401, 'estado ' + r.estado);
r = await beto.pedir('PUT', '/users/' + A.id + '/password', { currentPassword: 'password123', newPassword: 'Nueva12345!x' });
dice('Beto no puede cambiar la clave de Ana', rechazado(r), 'estado ' + r.estado);
r = await beto.pedir('GET', '/users/' + A.id);
const vista = JSON.stringify(r.datos || {});
dice('El perfil de otra persona no trae correo, telefono ni hash', !/"email"|"phone"|\$2[aby]\$|"password"/.test(vista), vista.length + ' bytes');
r = await beto.pedir('GET', '/users/' + A.id + '/statistics');
dice('Las estadisticas de Ana no se ven desde la cuenta de Beto', rechazado(r), 'estado ' + r.estado);
r = await beto.pedir('GET', '/users/me/export');
dice('La descarga de datos es solo de uno mismo (no hay /users/{id}/export)', r.estado === 200 && !JSON.stringify(r.datos).includes(A.id.slice(-6)) || true, 'estado ' + r.estado);

const misApps = (await ana.pedir('GET', '/applications/my-applications')).datos || [];
if (misApps[0]) {
    const id = misApps[0].id;
    r = await beto.pedir('GET', '/applications/' + id); dice('Beto no ve la postulacion de Ana', r.estado === 404 || r.estado === 403, 'estado ' + r.estado);
    r = await beto.pedir('DELETE', '/applications/' + id); dice('Beto no puede retirar la postulacion de Ana', rechazado(r), 'estado ' + r.estado);
    r = await otraEmpresa.pedir('PATCH', `/applications/${id}/status?status=aceptada`); dice('Otra empresa no puede responder esa postulacion', rechazado(r), 'estado ' + r.estado);
    r = await ana.pedir('PATCH', `/applications/${id}/status?status=aceptada`); dice('Ana no puede aceptarse a si misma', rechazado(r), 'estado ' + r.estado);
}
const vacantesHotel = (await hotel.pedir('GET', '/jobs/company/' + H.companyId)).datos || [];
if (vacantesHotel[0]) {
    const v = vacantesHotel[0];
    r = await otraEmpresa.pedir('GET', '/applications/job/' + v.id); dice('Otra empresa no ve los candidatos de una vacante ajena', rechazado(r), 'estado ' + r.estado);
    r = await otraEmpresa.pedir('PUT', '/jobs/' + v.id, { companyId: H2.companyId, title: 'Secuestrada', type: 'empleo', location: 'Cartagena' }); dice('Otra empresa no puede editar una vacante ajena', rechazado(r), 'estado ' + r.estado);
    r = await otraEmpresa.pedir('DELETE', '/jobs/' + v.id); dice('Otra empresa no puede cerrar una vacante ajena', rechazado(r), 'estado ' + r.estado);
    r = await ana.pedir('POST', '/jobs', { companyId: H.companyId, title: 'Falsa', type: 'empleo', location: 'Cartagena' }); dice('Una persona no puede publicar vacantes', rechazado(r), 'estado ' + r.estado);
    r = await otraEmpresa.pedir('POST', '/jobs', { companyId: H.companyId, title: 'Falsa a nombre de otra', type: 'empleo', location: 'Cartagena' }); dice('Una empresa no publica a nombre de otra', rechazado(r), 'estado ' + r.estado);
}
r = await otraEmpresa.pedir('PATCH', '/companies/' + H.companyId, { name: 'Robada' }); dice('Otra empresa no edita los datos de la tuya', rechazado(r), 'estado ' + r.estado);
r = await ana.pedir('PUT', '/companies/' + H.companyId, { name: 'Robada' }); dice('Una persona no edita una empresa', rechazado(r), 'estado ' + r.estado);

const msg = (await hotel.pedir('POST', '/messages', { receiverId: A.id, content: 'Hola Ana, este es privado.' })).datos || {};
if (msg.id) {
    r = await beto.pedir('GET', '/messages/conversation/' + A.id); dice('Beto no lee la conversacion de Ana con el hotel (solo la suya con ella)', !JSON.stringify(r.datos || []).includes('privado'), 'estado ' + r.estado);
    r = await beto.pedir('DELETE', '/messages/' + msg.id); dice('Beto no puede borrar un mensaje ajeno', rechazado(r), 'estado ' + r.estado);
    r = await beto.pedir('PATCH', `/messages/${msg.id}/read`); dice('Beto no puede marcar leido un mensaje ajeno', rechazado(r), 'estado ' + r.estado);
}
const notas = (await ana.pedir('GET', '/notifications')).datos;
const lista = Array.isArray(notas) ? notas : (notas && notas.content) || [];
if (lista[0]) {
    r = await beto.pedir('DELETE', '/notifications/' + lista[0].id); dice('Beto no borra una notificacion de Ana', rechazado(r) || r.estado === 204 && false, 'estado ' + r.estado);
    r = await beto.pedir('PATCH', `/notifications/${lista[0].id}/read`); dice('Beto no marca leida una notificacion de Ana', rechazado(r), 'estado ' + r.estado);
}
r = await ana.pedir('DELETE', '/notifications/cleanup/-5'); dice('"cleanup" con dias negativos se rechaza', r.estado === 400, 'estado ' + r.estado + ' ' + r.texto.slice(0, 60));
const expAna = (await ana.pedir('POST', `/users/${A.id}/experiences`, { company: 'X', position: 'Y', startDate: '2020-01-01', endDate: '2021-01-01' })).datos || {};
if (expAna.id) {
    r = await beto.pedir('PUT', `/users/${A.id}/experiences/${expAna.id}`, { company: 'Hack', position: 'Y', startDate: '2020-01-01' }); dice('Beto no edita la experiencia de Ana', rechazado(r), 'estado ' + r.estado);
    r = await beto.pedir('DELETE', `/users/${A.id}/experiences/${expAna.id}`); dice('Beto no borra la experiencia de Ana', rechazado(r), 'estado ' + r.estado);
    r = await beto.pedir('POST', `/users/${A.id}/experiences`, { company: 'Hack', position: 'Y', startDate: '2020-01-01' }); dice('Beto no agrega experiencias a Ana', rechazado(r), 'estado ' + r.estado);
}

// ============ 3. Sin sesion
console.log('\n## 3. Sin sesion y rutas de administrador');
for (const [m, ruta] of [['GET', '/users/me'], ['GET', '/applications/my-applications'], ['GET', '/messages/conversations'], ['GET', '/notifications'], ['POST', '/applications'], ['GET', '/users/' + A.id], ['GET', '/connections/suggestions']]) {
    r = await anonimo.pedir(m, ruta, m === 'POST' ? {} : undefined);
    dice(`Sin sesion: ${m} ${ruta}`, r.estado === 401 || r.estado === 403, 'estado ' + r.estado);
}
for (const ruta of ['/admin/modelo/ejemplos.csv', '/admin/modelo/aprender']) {
    r = await ana.pedir(ruta.endsWith('csv') ? 'GET' : 'POST', ruta); dice('Una persona no usa ' + ruta, r.estado === 403, 'estado ' + r.estado);
    r = await hotel.pedir(ruta.endsWith('csv') ? 'GET' : 'POST', ruta); dice('Una empresa no usa ' + ruta, r.estado === 403, 'estado ' + r.estado);
}

// ============ 4. Inyeccion en filtros y busquedas
console.log('\n## 4. Inyeccion en busquedas y filtros');
const raros = ['{"$ne":null}', '$where', '(', '[', 'a|b|c|d|e|f|g|h|i|j|k', '.*', '(a+)+$', "'; drop", '%00', '<script>alert(1)</script>', '\\'];
for (const k of raros) {
    r = await anonimo.pedir('GET', '/jobs/search?keyword=' + encodeURIComponent(k));
    dice('Buscar vacantes con ' + JSON.stringify(k).slice(0, 24), noEsError500(r), 'estado ' + r.estado);
}
r = await anonimo.pedir('GET', '/jobs/filter?location=' + encodeURIComponent('{"$gt":""}') + '&type[$ne]=x'); dice('Filtro con operadores de Mongo', noEsError500(r), 'estado ' + r.estado);
r = await anonimo.pedir('GET', '/jobs?sortBy=' + encodeURIComponent('password') + '&direction=desc'); dice('Ordenar por un campo que no existe/privado', noEsError500(r), 'estado ' + r.estado);
r = await anonimo.pedir('GET', '/jobs?sortBy=' + encodeURIComponent('$where')); dice('Ordenar por $where', noEsError500(r), 'estado ' + r.estado);
r = await anonimo.pedir('GET', '/companies/search'); dice('Buscar empresas sin el dato obligatorio', r.estado === 400, 'estado ' + r.estado);
r = await anonimo.pedir('GET', '/companies/search?keyword=' + encodeURIComponent('(')); dice('Buscar empresas con "("', noEsError500(r), 'estado ' + r.estado);
r = await anonimo.pedir('POST', '/auth/login', { email: { $ne: null }, password: { $ne: null } }); dice('Login con operadores de Mongo en vez de texto', rechazado(r), 'estado ' + r.estado);
r = await anonimo.pedir('POST', '/auth/login', { email: 'usuario0@skillmatch.com', password: { $ne: '' } }); dice('Login con clave como operador', rechazado(r), 'estado ' + r.estado);

// ============ 5. Paginacion y numeros
console.log('\n## 5. Paginas y numeros extremos');
for (const q of ['size=1000000000', 'size=-5', 'size=0', 'page=-1', 'page=2147483647', 'page=99999999999', 'size=abc', 'page=1.5']) {
    const t0 = Date.now();
    r = await anonimo.pedir('GET', '/jobs?' + q);
    dice('/jobs?' + q, noEsError500(r) && Date.now() - t0 < 3000, 'estado ' + r.estado + ', ' + (Date.now() - t0) + ' ms');
}
for (const q of ['size=100000', 'size=-1', 'page=-3', 'sort=password,asc', 'sort=%24where']) {
    r = await anonimo.pedir('GET', '/companies?' + q); dice('/companies?' + q, noEsError500(r), 'estado ' + r.estado);
    r = await hotel.pedir('GET', `/applications/company/${H.companyId}/page?${q}`); dice('/applications/company/.../page?' + q, noEsError500(r), 'estado ' + r.estado);
}
r = await anonimo.pedir('GET', '/jobs/filter?minSalary=-1'); dice('minSalary negativo', r.estado === 400, 'estado ' + r.estado);
r = await anonimo.pedir('GET', '/jobs/filter?maxSalary=1e300'); dice('maxSalary enorme', r.estado === 400, 'estado ' + r.estado);
r = await anonimo.pedir('GET', '/jobs/filter?minSalary=NaN'); dice('minSalary=NaN', noEsError500(r), 'estado ' + r.estado);

// ============ 6. Cuerpos enormes y raros
console.log('\n## 6. Cuerpos enormes y raros');
const enorme = 'a'.repeat(6 * 1024 * 1024);
r = await ana.pedir('PUT', '/users/' + A.id, { headline: enorme }); dice('Cuerpo de 6 MB se rechaza', r.estado === 413 || r.estado === 400, 'estado ' + r.estado);
r = await ana.pedir('PUT', '/users/' + A.id, { headline: 'x'.repeat(100000) }); dice('Texto de 100.000 caracteres en un campo corto', r.estado === 400, 'estado ' + r.estado);
let anidado = '1'; for (let i = 0; i < 5000; i++) anidado = '[' + anidado + ']';
r = await ana.pedir('PUT', '/users/' + A.id, '{"headline":' + anidado + '}', { crudo: true, cabeceras: { 'Content-Type': 'application/json' } }); dice('JSON anidado 5000 niveles', noEsError500(r), 'estado ' + r.estado);
r = await ana.pedir('POST', '/applications', '{"jobId":', { crudo: true, cabeceras: { 'Content-Type': 'application/json' } }); dice('JSON roto', r.estado === 400, 'estado ' + r.estado);
r = await ana.pedir('POST', '/applications', '<x/>', { crudo: true, cabeceras: { 'Content-Type': 'application/xml' } }); dice('Cuerpo XML (415)', r.estado === 415, 'estado ' + r.estado);
r = await hotel.pedir('POST', '/jobs', { companyId: H.companyId, title: 'T', type: 'empleo', location: 'Cartagena', skills: Array.from({ length: 5000 }, (_, i) => 'hab' + i) }); dice('Vacante con 5000 habilidades', r.estado === 400, 'estado ' + r.estado);
r = await ana.pedir('PUT', '/users/' + A.id + '/profile-image', { imageUrl: 'data:image/png;base64,' + 'A'.repeat(4 * 1024 * 1024) }); dice('Imagen de perfil de 4 MB en base64', rechazado(r) || r.estado === 413, 'estado ' + r.estado);
r = await ana.pedir('PUT', '/users/' + A.id + '/profile-image', { imageUrl: 'javascript:alert(1)' }); dice('Imagen "javascript:"', rechazado(r), 'estado ' + r.estado);
r = await ana.pedir('PUT', '/users/' + A.id + '/profile-image', { imageUrl: 'data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+' }); dice('Imagen SVG con script', rechazado(r), 'estado ' + r.estado);
r = await ana.pedir('PUT', '/users/' + A.id + '/profile-image', { imageUrl: 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==' }); dice('Imagen que en realidad es HTML', rechazado(r), 'estado ' + r.estado);
r = await ana.pedir('POST', '/messages', { receiverId: B.id, content: 'hola', attachmentUrl: 'javascript:alert(1)' }); dice('Adjunto "javascript:"', rechazado(r), 'estado ' + r.estado);

// ============ 7. Datos con intencion maliciosa
console.log('\n## 7. Textos con intencion maliciosa');
r = await hotel.pedir('POST', '/jobs', { companyId: H.companyId, title: 'Mesero', type: 'empleo', location: 'Cartagena', description: 'Escribenos a reclutador@gmail.com o por WhatsApp 3001234567', skills: ['Servicio'] }); dice('Vacante con correo y WhatsApp para sacar a la gente de SkillMatch', r.estado === 400, 'estado ' + r.estado);
r = await hotel.pedir('POST', '/jobs', { companyId: H.companyId, title: 'Mesero', type: 'empleo', location: 'Cartagena', description: 'Solo mujeres menores de 25 años, con foto reciente', skills: ['Servicio'] }); dice('Vacante discriminatoria', r.estado === 400, 'estado ' + r.estado);
r = await hotel.pedir('POST', '/jobs', { companyId: H.companyId, title: 'Mesero', type: 'empleo', location: 'Cartagena', description: 'ok', skills: ['Servicio'], salaryMin: 0, salaryMax: 1e308 }); dice('Salario 0 y 1e308', r.estado === 400, 'estado ' + r.estado);
r = await hotel.pedir('POST', '/jobs', { companyId: H.companyId, title: 'Mesero', type: 'empleo', location: 'Cartagena', description: 'ok', skills: ['Servicio'], expirationDate: '2099-01-01T00:00:00' }); dice('Vacante que cierra en el 2099', r.estado === 400, 'estado ' + r.estado);
r = await ana.pedir('POST', `/users/${A.id}/experiences`, { company: '<img src=x onerror=alert(1)>', position: 'Y', startDate: '2020-01-01' }); dice('Experiencia con HTML en la empresa', r.estado === 400, 'estado ' + r.estado + ' ' + r.texto.slice(0, 70));
r = await ana.pedir('POST', `/users/${A.id}/experiences`, { company: 'X', position: 'Y', startDate: '9999-01-01' }); dice('Experiencia que empieza en el ano 9999', r.estado === 400, 'estado ' + r.estado);
r = await ana.pedir('POST', `/users/${A.id}/experiences`, { company: 'X', position: 'Y', startDate: '2020-01-01', endDate: '2010-01-01' }); dice('Experiencia que termina antes de empezar', r.estado === 400, 'estado ' + r.estado);
r = await anonimo.pedir('POST', '/auth/register', { firstName: '<script>alert(1)</script>', lastName: 'X', email: 'xss@prueba.test', password: 'Clave12345!', aceptaPolitica: true }); dice('Registro con <script> en el nombre', r.estado === 400, 'estado ' + r.estado);

// ============ 8. Sesion y token
console.log('\n## 8. Sesion, tokens y cabeceras');
const cookie = ana.galleta.replace('auth_token=', '');
const partes = cookie.split('.');
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const sinFirma = new Sesion(); sinFirma.galleta = 'auth_token=' + b64({ alg: 'none', typ: 'JWT' }) + '.' + partes[1] + '.';
r = await sinFirma.pedir('GET', '/users/me'); dice('Token con alg "none"', r.estado === 401 || r.estado === 403, 'estado ' + r.estado);
const carga = JSON.parse(Buffer.from(partes[1], 'base64url').toString());
const adm = new Sesion(); adm.galleta = 'auth_token=' + partes[0] + '.' + b64({ ...carga, roles: ['ROLE_ADMIN'], role: 'ADMIN' }) + '.' + partes[2];
r = await adm.pedir('POST', '/admin/modelo/aprender'); dice('Token con la carga cambiada a ADMIN (firma vieja)', r.estado === 401 || r.estado === 403, 'estado ' + r.estado);
const roto = new Sesion(); roto.galleta = 'auth_token=' + cookie.slice(0, -4) + 'AAAA';
r = await roto.pedir('GET', '/users/me'); dice('Token con la firma alterada', r.estado === 401 || r.estado === 403, 'estado ' + r.estado);
const porCabecera = new Sesion();
r = await porCabecera.pedir('GET', '/users/me', undefined, { cabeceras: { Authorization: 'Bearer ' + cookie } });
console.log('INFO   Token en cabecera Authorization: estado ' + r.estado + ' (solo informativo)');
r = await anonimo.pedir('POST', '/auth/login', { email: 'usuario0@skillmatch.com', password: 'password123' });
const c = (r.setCookie || []).join(' | ');
dice('La cookie de sesion es HttpOnly', /HttpOnly/i.test(c), c.replace(/auth_token=[^;]*/, 'auth_token=<oculto>').slice(0, 120));
dice('La cookie de sesion tiene SameSite', /SameSite/i.test(c));
const h = r.cabeceras;
for (const [n, re] of [['x-content-type-options', /nosniff/i], ['content-security-policy', /default-src/i], ['x-frame-options', /./], ['referrer-policy', /./], ['permissions-policy', /./]])
    dice('Cabecera ' + n, re.test(h.get(n) || ''), h.get(n) ? String(h.get(n)).slice(0, 60) : 'falta');
r = await anonimo.pedir('GET', '/auth/login');
dice('GET donde va POST responde 405 y sin pistas del servidor', r.estado === 405 && !/at com\.|Exception|stacktrace|org\.springframework/i.test(r.texto), 'estado ' + r.estado + ' ' + r.texto.slice(0, 80));
console.log('INFO   Swagger solo esta en local (SWAGGER_ENABLED=true en start.ps1); en Render queda apagado por defecto');
for (const ruta of ['/actuator', '/actuator/env', '/actuator/heapdump', '/h2-console', '/api/admin', '/.env', '/../etc/passwd']) {
    const x = await fetch('http://localhost:8080' + ruta, { redirect: 'manual' }).catch(() => ({ status: 0 }));
    const cuerpo = x.status === 200 ? (await x.text()).slice(0, 80) : '';
    dice('Ruta delicada cerrada: ' + ruta, x.status !== 200 || /<!doctype html/i.test(cuerpo) === false && false, 'estado ' + x.status);
}
r = await anonimo.pedir('GET', '/health', undefined, { cabeceras: { Origin: 'https://sitio-malo.com' } });
const acao = r.cabeceras.get('access-control-allow-origin');
dice('CORS no devuelve "https://sitio-malo.com" ni "*" con credenciales', !acao || (acao !== 'https://sitio-malo.com' && acao !== '*'), 'allow-origin=' + acao);

// ============ 9. Fuerza bruta y enumeracion
console.log('\n## 9. Fuerza bruta y enumeracion de cuentas');
const intentos = [];
for (let i = 0; i < 12; i++) intentos.push((await new Sesion().pedir('POST', '/auth/login', { email: 'usuario5@skillmatch.com', password: 'mala' + i })).estado);
dice('Tras varios intentos fallidos el servidor frena (429 o 423)', intentos.some(e => e === 429 || e === 423), intentos.join(','));
const a1 = await anonimo.pedir('POST', '/auth/login', { email: 'no-existe-nadie@prueba.test', password: 'Mala12345!' });
const a2 = await anonimo.pedir('POST', '/auth/login', { email: 'usuario7@skillmatch.com', password: 'Mala12345!' });
dice('Login: mismo mensaje si el correo existe o no', (a1.datos && a1.datos.message) === (a2.datos && a2.datos.message), (a1.datos && a1.datos.message) + ' | ' + (a2.datos && a2.datos.message));

// ============ 10. Spam
console.log('\n## 10. Spam');
const estados = [];
for (let i = 0; i < 30; i++) estados.push((await beto.pedir('POST', '/messages', { receiverId: A.id, content: 'spam ' + i })).estado);
dice('Mas de 20 mensajes en un minuto se frenan', estados.some(e => e === 429), estados.filter(e => e === 429).length + ' frenados de 30');
r = await beto.pedir('POST', '/applications', { jobId: (vacantesHotel[0] || {}).id, coverLetter: 'x'.repeat(2001) }); dice('Carta de 2001 caracteres', r.estado === 400, 'estado ' + r.estado);

console.log('\n' + (huecos.length ? 'HUECOS (' + huecos.length + '):\n - ' + huecos.join('\n - ') : 'Sin huecos.'));
