// Directorio de empresas (empresas.html) y perfil publico de cada una (empresa.html)
//
// Antes no habia donde conocer a las empresas: "Empresas" en la barra llevaba a
// una seccion de la portada y el nombre de la empresa en Vacantes no llevaba a
// ningun lado. Todo sale de endpoints publicos (/companies y /jobs/company).
// No se muestran el correo ni el telefono de la empresa, solo su sitio web.

// El backend guarda el tamano sin numeros (small, medium, large, enterprise)
const TAMANOS = {
    micro: 'Microempresa', small: 'Pequeña', pequena: 'Pequeña',
    medium: 'Mediana', mediana: 'Mediana', large: 'Grande', grande: 'Grande', enterprise: 'Muy grande'
};
const TIPOS_VACANTE = { empleo: 'Empleo', practica: 'Práctica', freelance: 'Independiente' };
const MODALIDADES_VACANTE = { presencial: 'Presencial', remoto: 'Remoto', hibrido: 'Híbrido' };
const POR_PAGINA = 24;
const RECIENTES = 6;

const sinTildes = t => String(t || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const iniciales = nombre => String(nombre || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
const numero = n => Number(n).toLocaleString('es-CO');
const plural = (n, uno, varios) => `${numero(n)} ${n === 1 ? uno : varios}`;

function sesionActual() {
    try {
        return haySesion() ? JSON.parse(localStorage.getItem('userData') || 'null') : null;
    } catch (e) {
        return null;
    }
}

// ---- Consultas (publicas: sin token) ----

// No mas de 4 consultas a la vez (el servidor es gratuito)
function enFila(maximo) {
    let activas = 0;
    const cola = [];
    const siguiente = () => {
        if (activas >= maximo || !cola.length) return;
        activas++;
        const { tarea, ok, falla } = cola.shift();
        tarea().then(ok, falla).finally(() => { activas--; siguiente(); });
    };
    return tarea => new Promise((ok, falla) => { cola.push({ tarea, ok, falla }); siguiente(); });
}
const enTurno = enFila(4);

function pedirJson(ruta) {
    return enTurno(async () => {
        const r = await fetch(API_BASE_URL + ruta);
        if (!r.ok) {
            const error = new Error(`El servidor respondió ${r.status}`);
            error.status = r.status;
            throw error;
        }
        return r.json();
    });
}

// Vacantes abiertas de una empresa (el backend tambien manda las cerradas).
// Se guarda la promesa: si la empresa sale dos veces, se pide una sola vez.
const vacantesDe = new Map();
function vacantesAbiertas(id) {
    if (!vacantesDe.has(id)) {
        vacantesDe.set(id, pedirJson(`/jobs/company/${encodeURIComponent(id)}`)
            .then(lista => (lista || []).filter(v => v.active !== false && sinTildes(v.status || 'abierta') === 'abierta')));
    }
    return vacantesDe.get(id);
}

// ---- Tarjetas del directorio ----

function tarjetaEmpresa(c) {
    const lugar = [c.industry, c.location].filter(Boolean).map(escaparHtml).join(' · ');
    return `
        <li class="empresa-tarjeta">
            <span class="empresa-avatar" aria-hidden="true"${c.userId ? ` data-logo-cuenta="${escaparHtml(String(c.userId))}"` : ''}>${escaparHtml(iniciales(c.name))}</span>
            <div class="empresa-datos">
                <h3><a class="empresa-enlace" href="empresa.html?id=${encodeURIComponent(c.id)}">${escaparHtml(c.name || 'Empresa')}</a></h3>
                ${lugar ? `<p>${lugar}</p>` : ''}
                <p class="empresa-vacantes" data-empresa="${escaparHtml(c.id)}"><span class="skeleton skeleton-line w-60"></span></p>
            </div>
        </li>`;
}

function tarjetasCargando(n) {
    return Array.from({ length: n }, () => `
        <li class="empresa-tarjeta" aria-hidden="true">
            <span class="skeleton skeleton-avatar"></span>
            <div class="empresa-datos"><span class="skeleton skeleton-title"></span><span class="skeleton skeleton-line w-60"></span></div>
        </li>`).join('');
}

// Cuantas vacantes abiertas tiene cada tarjeta: se pide cuando la tarjeta
// esta por verse (no las 24 de golpe al abrir la pagina)
const observadorVacantes = 'IntersectionObserver' in window
    ? new IntersectionObserver(entradas => entradas.forEach(e => {
        if (!e.isIntersecting) return;
        observadorVacantes.unobserve(e.target);
        pintarVacantes(e.target);
    }), { rootMargin: '200px' })
    : null;

function observarVacantes(raiz) {
    raiz.querySelectorAll('.empresa-vacantes[data-empresa]:not([data-listo])').forEach(el => {
        el.dataset.listo = '1';
        if (observadorVacantes) observadorVacantes.observe(el); else pintarVacantes(el);
    });
}

function pintarVacantes(el) {
    vacantesAbiertas(el.dataset.empresa)
        .then(lista => {
            el.classList.toggle('con-vacantes', lista.length > 0);
            el.innerHTML = lista.length
                ? `<i data-ico="briefcase"></i> ${plural(lista.length, 'vacante abierta', 'vacantes abiertas')}`
                : 'Sin vacantes abiertas';
        })
        .catch(() => { el.textContent = ''; });
}

// ---- Directorio ----

function iniciarDirectorio() {
    const lista = document.getElementById('empresasLista');
    if (!lista) return;
    const cuenta = document.getElementById('empresasCuenta');
    const titulo = document.getElementById('empresasTitulo');
    const mas = document.getElementById('empresasMas');
    const buscador = document.getElementById('empresaBuscar');
    const recientes = document.getElementById('empresasRecientesBloque');

    // El aviso para registrar una empresa es para quien todavia no tiene cuenta
    const cta = document.getElementById('directorioCta');
    if (cta && sesionActual()) cta.hidden = true;

    // Todas (paginas del servidor, A-Z) o resultados de una busqueda (se
    // muestran de a 24 desde la lista que ya llego)
    let modo = 'todas', pagina = 0, ultima = false, resultados = [], mostrados = 0, turno = 0;

    function pintar(empresas, agregar) {
        if (!agregar) lista.innerHTML = '';
        lista.insertAdjacentHTML('beforeend', empresas.map(tarjetaEmpresa).join(''));
        observarVacantes(lista);
    }

    async function cargarPagina() {
        const mio = ++turno;
        mas.hidden = true;
        if (pagina === 0) lista.innerHTML = tarjetasCargando(6);
        try {
            const datos = await pedirJson(`/companies?status=active&page=${pagina}&size=${POR_PAGINA}&sort=name,asc`);
            if (mio !== turno) return;
            pintar(datos.content || [], pagina > 0);
            if (pagina === 0 && !(datos.content || []).length) {
                lista.innerHTML = '<li class="directorio-vacio">Todavía no hay empresas registradas. Cuando se registren, aquí verás a qué se dedica cada una y sus vacantes.</li>';
            }
            ultima = datos.last !== false;
            cuenta.textContent = plural(datos.totalElements || 0, 'empresa', 'empresas');
            mas.hidden = ultima;
            pagina++;
        } catch (e) {
            if (mio !== turno) return;
            lista.innerHTML = '<li class="directorio-vacio">No pudimos cargar las empresas. Intenta de nuevo en un momento.</li>';
        }
    }

    function mostrarMasResultados() {
        pintar(resultados.slice(mostrados, mostrados + POR_PAGINA), mostrados > 0);
        mostrados += POR_PAGINA;
        mas.hidden = mostrados >= resultados.length;
    }

    async function buscar(texto) {
        const mio = ++turno;
        modo = 'busqueda';
        recientes.hidden = true;
        titulo.textContent = 'Resultados';
        lista.innerHTML = tarjetasCargando(3);
        mas.hidden = true;
        // textoParaBuscar (api-config.js): el servidor usa el texto como expresion regular
        try {
            const datos = await pedirJson('/companies/search?keyword=' + encodeURIComponent(textoParaBuscar(texto)));
            if (mio !== turno) return;
            resultados = (datos || []).sort((a, b) => String(a.name).localeCompare(String(b.name), 'es'));
            mostrados = 0;
            cuenta.textContent = `${plural(resultados.length, 'empresa', 'empresas')} para “${texto}”`;
            if (!resultados.length) {
                lista.innerHTML = `<li class="directorio-vacio">No encontramos empresas con “${escaparHtml(texto)}”. Prueba con otra palabra, como un sector o una ciudad.</li>`;
                return;
            }
            mostrarMasResultados();
        } catch (e) {
            if (mio !== turno) return;
            lista.innerHTML = '<li class="directorio-vacio">No pudimos buscar. Intenta de nuevo en un momento.</li>';
        }
    }

    function volverATodas() {
        modo = 'todas';
        pagina = 0;
        recientes.hidden = false;
        titulo.textContent = 'Todas las empresas';
        cargarPagina();
    }

    mas.addEventListener('click', () => (modo === 'todas' ? cargarPagina() : mostrarMasResultados()));

    // La busqueda queda en la direccion (?q=): se puede compartir y volver a ella
    let espera = 0;
    function alEscribir() {
        clearTimeout(espera);
        espera = setTimeout(() => {
            const texto = buscador.value.trim();
            const direccion = new URL(window.location.href);
            if (texto.length >= 2) direccion.searchParams.set('q', texto); else direccion.searchParams.delete('q');
            history.replaceState(null, '', direccion);
            if (texto.length >= 2) buscar(texto);
            else if (modo !== 'todas') volverATodas();
        }, 300);
    }
    buscador.addEventListener('input', alEscribir);
    document.getElementById('buscarEmpresas').addEventListener('submit', e => { e.preventDefault(); alEscribir(); });

    cargarRecientes();
    const pedida = (new URLSearchParams(window.location.search).get('q') || '').trim();
    if (pedida.length >= 2) {
        buscador.value = pedida;
        buscar(pedida);
    } else {
        cargarPagina();
    }
}

// "Publicaron vacantes hace poco": las empresas con mas vacantes entre las 100
// mas recientes; sus datos (sector, ciudad) se piden aparte
async function cargarRecientes() {
    const bloque = document.getElementById('empresasRecientesBloque');
    const lista = document.getElementById('empresasRecientes');
    lista.innerHTML = tarjetasCargando(RECIENTES);
    try {
        const paginas = await Promise.all([0, 1].map(i => pedirJson(`/jobs?page=${i}&size=50`)));
        const veces = new Map();
        paginas.flatMap(p => p.content || []).forEach(v => {
            if (v.companyId) veces.set(v.companyId, (veces.get(v.companyId) || 0) + 1);
        });
        const ids = [...veces.entries()].sort((a, b) => b[1] - a[1]).slice(0, RECIENTES).map(([id]) => id);
        if (!ids.length) { bloque.hidden = true; return; }
        const empresas = (await Promise.all(ids.map(id => pedirJson('/companies/' + encodeURIComponent(id)).catch(() => null)))).filter(Boolean);
        if (!empresas.length) { bloque.hidden = true; return; }
        lista.innerHTML = empresas.map(tarjetaEmpresa).join('');
        observarVacantes(lista);
    } catch (e) {
        bloque.hidden = true;
    }
}

// ---- Perfil publico de una empresa ----

function salarioDe(v) {
    if (v.salaryMin && v.salaryMax) return `$${numero(v.salaryMin)} - $${numero(v.salaryMax)}`;
    if (v.salaryMin) return `Desde $${numero(v.salaryMin)}`;
    if (v.salaryMax) return `Hasta $${numero(v.salaryMax)}`;
    return 'Salario a convenir';
}

function filaVacante(v) {
    const datos = [
        TIPOS_VACANTE[sinTildes(v.type)] || v.type,
        MODALIDADES_VACANTE[sinTildes(v.modality)] || v.modality,
        v.location
    ].filter(Boolean).map(escaparHtml).join(' · ');
    const fecha = v.postedDate
        ? 'Publicada el ' + new Date(v.postedDate).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
        : '';
    return `
        <li class="empresa-vacante">
            <div class="empresa-vacante-datos">
                <h3><a href="oportunidades.html?jobId=${encodeURIComponent(v.id)}">${escaparHtml(v.title || 'Vacante')}</a></h3>
                <p>${datos}</p>
            </div>
            <div class="empresa-vacante-extra">
                <p class="empresa-vacante-salario">${salarioDe(v)}</p>
                ${fecha ? `<p>${fecha}</p>` : ''}
            </div>
        </li>`;
}

function dato(nombre, valor) {
    return valor ? `<div><dt>${nombre}</dt><dd>${valor}</dd></div>` : '';
}

function pintarPerfil(c, vacantes) {
    const contenedor = document.getElementById('empresaContenido');
    document.title = `${c.name || 'Empresa'} - SkillMatch Cartagena`;
    const lugar = [c.industry, c.location].filter(Boolean).map(escaparHtml).join(' · ');
    const web = c.website ? urlSegura(c.website) : '';
    const dominio = web && web !== '#' ? escaparHtml(c.website.replace(/^https?:\/\//i, '').replace(/\/$/, '')) : '';
    const enlaceWeb = dominio ? `<a href="${web}" target="_blank" rel="noopener noreferrer">${dominio}</a>` : '';

    // Escribirle: solo personas con sesion (las empresas no se escriben entre si)
    const sesion = sesionActual();
    let accion = '';
    if (c.userId && sesion && sesion.userType !== 'empresa') {
        accion = `<a class="btn btn-primary btn-small" href="mensajes.html?userId=${encodeURIComponent(c.userId)}"><i data-ico="chat"></i> Escribir a la empresa</a>`;
    } else if (c.userId && !sesion) {
        accion = '<a class="btn btn-secondary btn-small" href="login.html">Inicia sesión para escribirle</a>';
    }

    const abiertas = (vacantes || []).slice().sort((a, b) => new Date(b.postedDate || 0) - new Date(a.postedDate || 0));
    const listaVacantes = vacantes === null
        ? '<p class="empresa-vacio">No pudimos cargar sus vacantes. Intenta de nuevo en un momento.</p>'
        : abiertas.length
            ? `<ul class="empresa-vacantes-lista">${abiertas.map(filaVacante).join('')}</ul>`
            : '<p class="empresa-vacio">Por ahora no tiene vacantes abiertas. <a href="oportunidades.html">Ver otras vacantes</a></p>';

    contenedor.innerHTML = `
        <div class="empresa-cabeza con-portada">
            <div class="empresa-portada" id="empresaPortada" aria-hidden="true"></div>
            <span class="empresa-avatar grande" id="empresaLogo" aria-hidden="true">${escaparHtml(iniciales(c.name))}</span>
            <div class="empresa-cabeza-texto">
                <h1>${escaparHtml(c.name || 'Empresa')}</h1>
                ${lugar ? `<p>${lugar}</p>` : ''}
            </div>
            ${accion ? `<div class="empresa-cabeza-accion">${accion}</div>` : ''}
        </div>
        <div class="empresa-cuerpo">
            <div class="empresa-principal">
                <section class="empresa-bloque" aria-labelledby="empresaAcercaTitulo">
                    <h2 id="empresaAcercaTitulo">Acerca de la empresa</h2>
                    <p class="empresa-descripcion">${c.description ? escaparHtml(c.description) : 'Esta empresa todavía no ha escrito su descripción.'}</p>
                </section>
                ${c.benefits ? `
                <section class="empresa-bloque" aria-labelledby="empresaBeneficiosTitulo">
                    <h2 id="empresaBeneficiosTitulo">Beneficios</h2>
                    <p class="empresa-descripcion">${escaparHtml(c.benefits)}</p>
                </section>` : ''}
                <section class="empresa-bloque" aria-labelledby="empresaVacantesTitulo">
                    <h2 id="empresaVacantesTitulo">Vacantes abiertas${vacantes ? ` <span class="empresa-cuenta">${numero(abiertas.length)}</span>` : ''}</h2>
                    ${listaVacantes}
                </section>
            </div>
            <aside class="empresa-bloque empresa-ficha" aria-labelledby="empresaFichaTitulo">
                <h2 id="empresaFichaTitulo">Datos</h2>
                <dl>
                    ${dato('Sector', escaparHtml(c.industry || ''))}
                    ${dato('Ciudad', escaparHtml(c.location || ''))}
                    ${dato('Tamaño', TAMANOS[sinTildes(c.size)] || '')}
                    ${dato('Fundada en', c.foundedYear ? escaparHtml(String(c.foundedYear)) : '')}
                    ${dato('Sitio web', enlaceWeb)}
                </dl>
            </aside>
        </div>`;
}

// Logo y portada que la empresa eligio en "Mi empresa". Se guardan en su cuenta
// de usuario, y el backend solo la muestra a quien tiene sesion: los visitantes
// ven las iniciales y la portada de la marca (docs/PENDIENTES-BACKEND.md, 2.2).
async function imagenesDeEmpresa(c) {
    if (!c.userId || !sesionActual() || typeof fetchWithAuth !== 'function') return;
    try {
        const r = await fetchWithAuth(`/users/${encodeURIComponent(c.userId)}`);
        if (!r.ok) return;
        const cuenta = await r.json();
        const portada = document.getElementById('empresaPortada');
        const url = cuenta.coverImageUrl && window.SkillMatchImagen ? SkillMatchImagen.rutaPortada(cuenta.coverImageUrl) : null;
        if (portada && url) portada.style.backgroundImage = `url("${url}")`;
        const logo = document.getElementById('empresaLogo');
        if (logo && cuenta.profileImageUrl) {
            const img = document.createElement('img');
            img.src = cuenta.profileImageUrl;
            img.alt = '';
            img.onerror = () => { logo.textContent = iniciales(c.name); };
            logo.replaceChildren(img);
        }
    } catch (e) { /* se quedan las iniciales y la portada de la marca */ }
}

function perfilNoDisponible(contenedor, noExiste) {
    document.title = (noExiste ? 'Empresa no encontrada' : 'Empresa') + ' - SkillMatch Cartagena';
    contenedor.innerHTML = `
        <div class="empresa-no-encontrada">
            <h1>${noExiste ? 'No encontramos esta empresa' : 'No pudimos cargar la empresa'}</h1>
            <p>${noExiste ? 'Puede que el enlace esté incompleto o que la empresa ya no esté en SkillMatch.' : 'Revisa tu conexión e intenta de nuevo en un momento.'}</p>
            <a class="btn btn-primary" href="empresas.html">Ver todas las empresas</a>
        </div>`;
}

async function iniciarPerfil() {
    const contenedor = document.getElementById('empresaContenido');
    if (!contenedor) return;
    const seccion = document.getElementById('empresaPublica');
    const id = new URLSearchParams(window.location.search).get('id');
    if (!id) {
        perfilNoDisponible(contenedor, true);
    } else {
        try {
            const [empresa, vacantes] = await Promise.all([
                pedirJson('/companies/' + encodeURIComponent(id)),
                vacantesAbiertas(id).catch(() => null)
            ]);
            pintarPerfil(empresa, vacantes);
            imagenesDeEmpresa(empresa);
        } catch (e) {
            // El backend responde 404 si no existe (y 400 si el id no tiene forma de id)
            perfilNoDisponible(contenedor, e.status === 404 || e.status === 400);
        }
    }
    seccion.removeAttribute('aria-busy');
}

document.addEventListener('DOMContentLoaded', () => {
    iniciarDirectorio();
    iniciarPerfil();
});
