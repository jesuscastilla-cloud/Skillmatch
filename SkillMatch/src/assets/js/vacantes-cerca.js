/* ===============================================================
 * SkillMatch — Inicio: vacantes cerca de ti
 * ---------------------------------------------------------------
 * Muestra las vacantes abiertas mas cercanas a la persona, de la mas
 * cerca a la mas lejos (ciudades.js dice donde queda cada ciudad).
 *
 * Desde donde se mide, en este orden:
 *   1. La ciudad que la persona eligio en la lista (se recuerda aqui).
 *   2. Su ubicacion, si antes la acepto y el permiso sigue dado
 *      (entonces el navegador no vuelve a preguntar).
 *   3. La ciudad de su perfil, si tiene sesion.
 *   4. Cartagena.
 *
 * La ubicacion se pide solo al tocar "Usar mi ubicacion": si el
 * navegador pregunta apenas se entra, mucha gente bloquea sin saber
 * para que es, y despues la pagina ya no puede volver a preguntar.
 * Las coordenadas no salen del navegador ni se guardan: al servidor
 * solo va el nombre de cada ciudad, como en el filtro de Vacantes.
 * Las empresas no ven esta seccion (no buscan empleo).
 * =============================================================== */
(function () {
    'use strict';

    const seccion = document.getElementById('cerca');
    const C = window.SkillMatchCiudades;
    if (!seccion || !C) return;

    const MOSTRAR = 6;      // tarjetas
    const POR_RONDA = 8;    // ciudades que se consultan a la vez
    const RONDAS = 3;       // hasta 24 ciudades: mas lejos ya no es "cerca"
    const RECUERDO = 'skillmatch_cerca';

    const boton = document.getElementById('cercaUbicacion');
    const selector = document.getElementById('cercaCiudad');
    const frase = document.getElementById('cercaFrase');
    const cargando = document.getElementById('cercaCargando');
    const lista = document.getElementById('cercaLista');
    const vacio = document.getElementById('cercaVacio');

    const leerLocal = clave => { try { return localStorage.getItem(clave); } catch (e) { return null; } };
    let datos = null;
    try { datos = JSON.parse(leerLocal('userData') || 'null'); } catch (e) { datos = null; }
    // El token vive solo en la cookie httpOnly (F4): aqui queda cuando vence la sesion
    const conSesion = !!(Number(leerLocal('skillmatch_sesion_vence') || 0) > Date.now() && datos && datos.id);
    const esEmpresa = conSesion && (String(datos.role || '').toUpperCase() === 'EMPRESA' || datos.userType === 'empresa');
    if (esEmpresa) { seccion.hidden = true; return; }

    // La lista de ciudades: primero Bolivar, como el filtro de Inicio. "Turbaco (Bolívar)": la lista de la
    // marca muestra "Turbaco" y debajo "Bolívar"
    (function llenarCiudades() {
        const orden = (a, b) => a.nombre.localeCompare(b.nombre, 'es');
        const opcion = c => `<option value="${c.clave}">${c.nombre}${c.nombre === c.departamento ? '' : ` (${c.departamento})`}</option>`;
        const bolivar = C.lista.filter(c => c.departamento === 'Bolívar').sort(orden);
        const otras = C.lista.filter(c => c.departamento !== 'Bolívar').sort(orden);
        selector.innerHTML = `<optgroup label="Bolívar">${bolivar.map(opcion).join('')}</optgroup>` +
            `<optgroup label="Otras ciudades">${otras.map(opcion).join('')}</optgroup>`;
    })();

    const puedeUbicar = 'geolocation' in navigator && window.isSecureContext;
    let turno = 0;          // cada busqueda nueva deja sin efecto la anterior
    let desdeCodigo = false; // al marcar la ciudad desde aqui, la lista avisa "change": no es una eleccion

    function recordar(valor) { try { localStorage.setItem(RECUERDO, JSON.stringify(valor)); } catch (e) { /* sin almacenamiento */ } }
    function recuerdo() { try { return JSON.parse(leerLocal(RECUERDO) || 'null'); } catch (e) { return null; } }

    function marcarCiudad(ciudad) {
        desdeCodigo = true;
        selector.value = ciudad.clave;
        selector.dispatchEvent(new Event('change', { bubbles: true }));   // repinta la lista de la marca
        desdeCodigo = false;
    }

    // ---- Pedir las vacantes ----
    async function vacantesDe(ciudad) {
        const url = `${API_BASE_URL}/jobs/filter?location=${encodeURIComponent(C.patron(ciudad))}` +
            `&size=${MOSTRAR}&sortBy=postedDate&direction=desc`;
        const respuesta = await fetch(url, { headers: { 'Accept': 'application/json' } });
        if (!respuesta.ok) throw new Error(`API respondió ${respuesta.status}`);
        const pagina = await respuesta.json();
        const contenido = Array.isArray(pagina) ? pagina : (pagina.content || []);
        // El servidor busca el nombre dentro del texto: aqui se confirma que de verdad sea esa ciudad
        return contenido.filter(v => v && v.id && C.esDe(ciudad, v.location));
    }

    async function buscar(origen) {
        const ciudades = C.porCercania(origen.lat, origen.lon);
        const vistas = new Set();
        const encontradas = [];
        let pedidas = 0, fallidas = 0;
        for (let ronda = 0; ronda < RONDAS && encontradas.length < MOSTRAR; ronda++) {
            const grupo = ciudades.slice(ronda * POR_RONDA, (ronda + 1) * POR_RONDA);
            // Una ciudad que falla no tumba a las demas
            const respuestas = await Promise.all(grupo.map(c => vacantesDe(c).catch(() => { fallidas++; return []; })));
            pedidas += grupo.length;
            // Las respuestas vienen en el orden del grupo: de la ciudad mas cercana a la mas lejana
            respuestas.forEach((vacantes, i) => vacantes.forEach(v => {
                if (vistas.has(v.id)) return;
                vistas.add(v.id);
                encontradas.push({ vacante: v, ciudad: grupo[i] });
            }));
        }
        if (!encontradas.length && fallidas === pedidas) throw new Error('No respondió ninguna ciudad');
        return encontradas.slice(0, MOSTRAR);
    }

    // ---- Pintar ----
    function nombreLugar(origen) {
        return origen.porUbicacion ? `tu ubicación (cerca de ${origen.ciudad.corto})` : origen.ciudad.corto;
    }

    // Datos de muestra (empresas "(ejemplo)"): la tarjeta lo dice y el nombre va sin el parentesis
    const UI = () => window.SkillMatchUI;
    const esEjemplo = v => !!(UI() && UI().esEjemplo(v.companyName));

    // Jerarquia de cada tarjeta: cargo, empresa, luego lugar, salario y modalidad, y al
    // final las acciones (Ver vacante y Guardar). Postularse pide sesion: se dice antes.
    function tarjeta({ vacante, ciudad }, origen) {
        const aqui = ciudad.clave === origen.ciudad.clave;
        const km = Math.max(1, Math.round(C.distanciaKm(origen.lat, origen.lon, ciudad.lat, ciudad.lon)));
        const distancia = aqui ? `En ${escaparHtml(ciudad.corto)}` : `${escaparHtml(ciudad.corto)} · a ${km} km`;
        const modalidades = typeof MODALIDADES_VACANTE !== 'undefined' ? MODALIDADES_VACANTE : {};
        const modalidad = modalidades[C.normalizar(vacante.modality)] || '';
        const salario = typeof formatSalaryRange === 'function' ? formatSalaryRange(vacante.salaryMin, vacante.salaryMax) : '';
        const empresa = vacante.companyName ? (UI() ? UI().sinEjemplo(vacante.companyName) : vacante.companyName) : '';
        const guardada = typeof savedOpportunityIds !== 'undefined' && savedOpportunityIds.has(vacante.id);
        const ver = `oportunidades.html?jobId=${encodeURIComponent(vacante.id)}`;
        return `<li class="cerca-tarjeta">
                ${esEjemplo(vacante) ? UI().etiquetaEjemplo() : ''}
                <h3 class="cerca-cargo"><a class="cerca-enlace" href="${ver}">${escaparHtml(vacante.title || 'Vacante')}</a></h3>
                ${empresa ? `<p class="cerca-empresa">${escaparHtml(empresa)}</p>` : ''}
                <p class="cerca-datos">
                    <span class="cerca-distancia${aqui ? ' es-aqui' : ''}"${aqui ? '' : ' title="Distancia en línea recta"'}><i data-ico="pin"></i> ${distancia}</span>
                    ${salario ? `<span><i data-ico="money"></i> ${escaparHtml(salario)}</span>` : ''}
                    ${modalidad ? `<span><i data-ico="desktop"></i> ${modalidad}</span>` : ''}
                </p>
                <div class="cerca-acciones">
                    <a class="btn btn-primary btn-small" href="${ver}">Ver vacante</a>
                    <button type="button" class="btn btn-secondary btn-small cerca-guardar${guardada ? ' saved' : ''}" data-id="${escaparHtml(vacante.id)}" aria-pressed="${guardada}">
                        <i data-ico="${guardada ? 'heart' : 'bookmark'}"></i> <span>${guardada ? 'Guardada' : 'Guardar'}</span>
                    </button>
                </div>
                ${conSesion ? '' : '<p class="cerca-nota">Para postularte, inicia sesión.</p>'}
            </li>`;
    }

    // Guardar desde la portada: lo mismo que en Vacantes (search-handler.js tiene la lista)
    async function guardar(boton) {
        if (!conSesion) {
            if (UI()) UI().aviso('Inicia sesión para guardar vacantes.', 'info', 0, { texto: 'Iniciar sesión', alHacer: () => { window.location.href = 'login.html'; } });
            return;
        }
        const id = boton.dataset.id;
        const ya = savedOpportunityIds.has(id);
        boton.disabled = true;
        try {
            const r = ya
                ? await fetchWithAuth(`${API_BASE_URL}/saved-jobs/job/${encodeURIComponent(id)}`, { method: 'DELETE' })
                : await fetchWithAuth(`${API_BASE_URL}/saved-jobs`, { method: 'POST', body: JSON.stringify({ jobId: id }) });
            if (!r.ok) throw new Error(String(r.status));
            if (ya) savedOpportunityIds.delete(id); else savedOpportunityIds.add(id);
            boton.classList.toggle('saved', !ya);
            boton.setAttribute('aria-pressed', String(!ya));
            boton.innerHTML = `<i data-ico="${ya ? 'bookmark' : 'heart'}"></i> <span>${ya ? 'Guardar' : 'Guardada'}</span>`;
            if (UI()) UI().guardado(ya ? 'Vacante quitada de guardadas' : 'Vacante guardada');
        } catch (e) {
            if (UI()) UI().noSeGuardo('No pudimos guardar la vacante. Revisa tu conexión e intenta de nuevo.', () => guardar(boton));
        } finally {
            boton.disabled = false;
        }
    }
    lista.addEventListener('click', e => {
        const boton = e.target.closest('.cerca-guardar');
        if (boton) guardar(boton);
    });

    // Dos vacantes reales junto a la tarjeta del match, en el hero
    function enElHero(encontradas) {
        const hero = document.getElementById('heroVacantes');
        if (!hero) return;
        const dos = encontradas.slice(0, 2);
        hero.innerHTML = dos.map(({ vacante }) => {
            const empresa = vacante.companyName ? (UI() ? UI().sinEjemplo(vacante.companyName) : vacante.companyName) : '';
            return `<li class="hero-vacante">
                    <a href="oportunidades.html?jobId=${encodeURIComponent(vacante.id)}">
                        <span class="hero-vacante-cargo">${escaparHtml(vacante.title || 'Vacante')}</span>
                        <span class="hero-vacante-empresa">${escaparHtml(empresa)}${esEjemplo(vacante) ? ' ' + UI().etiquetaEjemplo() : ''}</span>
                    </a>
                </li>`;
        }).join('');
        hero.hidden = !dos.length;
    }

    // "Vista de ejemplo": si alguna vacante es de muestra, la seccion lo dice arriba
    function avisoDeEjemplo(encontradas) {
        const aviso = document.getElementById('cercaEjemplo');
        if (!aviso) return;
        const hay = encontradas.some(e => esEjemplo(e.vacante));
        aviso.innerHTML = hay ? '<i data-ico="bulb"></i> <span><strong>Vista de ejemplo.</strong> Las vacantes marcadas como «Ejemplo» son datos de muestra para ver cómo funciona SkillMatch: no son ofertas reales.</span>' : '';
        aviso.hidden = !hay;
    }

    function mostrarCargando(origen) {
        frase.textContent = `Buscando las vacantes más cercanas a ${nombreLugar(origen)}…`;
        lista.hidden = true;
        vacio.hidden = true;
        cargando.hidden = false;
        if (window.SkillMatchUI) SkillMatchUI.skeletons(cargando, 3);
    }

    function mostrarResultado(encontradas, origen) {
        cargando.hidden = true;
        cargando.innerHTML = '';
        cargando.removeAttribute('aria-busy');
        const lugar = nombreLugar(origen);
        if (!encontradas.length) {
            frase.textContent = `Todavía no hay vacantes abiertas cerca de ${lugar}.`;
            lista.hidden = true;
            lista.innerHTML = '';
            vacio.innerHTML = `<div class="estado-vacio">
                    <span class="estado-vacio-icono"><i data-ico="pin"></i></span>
                    <div>
                        <p class="estado-vacio-titulo">Nada cerca por ahora</p>
                        <p class="estado-vacio-texto">Prueba con otra ciudad en la lista o mira todas las vacantes abiertas.</p>
                    </div>
                </div>`;
            vacio.hidden = false;
            return;
        }
        const n = encontradas.length;
        frase.textContent = `${n === 1 ? 'La vacante abierta más cercana' : `Las ${n} vacantes abiertas más cercanas`} a ${lugar}, de la más cerca a la más lejos.`;
        lista.innerHTML = encontradas.map(e => tarjeta(e, origen)).join('');
        lista.hidden = false;
        vacio.hidden = true;
        enElHero(encontradas);
        avisoDeEjemplo(encontradas);
    }

    function mostrarError(origen) {
        cargando.hidden = true;
        cargando.innerHTML = '';
        cargando.removeAttribute('aria-busy');
        lista.hidden = true;
        lista.innerHTML = '';
        frase.textContent = 'No pudimos cargar las vacantes cercanas.';
        vacio.innerHTML = `<div class="estado-vacio">
                <span class="estado-vacio-icono"><i data-ico="alert"></i></span>
                <div>
                    <p class="estado-vacio-titulo">No pudimos cargar las vacantes cercanas</p>
                    <p class="estado-vacio-texto">Revisa tu conexión e inténtalo de nuevo.</p>
                    <button type="button" class="btn btn-secondary btn-small" data-cerca-reintentar>Reintentar</button>
                </div>
            </div>`;
        vacio.hidden = false;
        vacio.querySelector('[data-cerca-reintentar]').addEventListener('click', () => cargarDesde(origen));
    }

    async function cargarDesde(origen) {
        const miTurno = ++turno;
        marcarCiudad(origen.ciudad);
        mostrarCargando(origen);
        try {
            const encontradas = await buscar(origen);
            if (miTurno === turno) mostrarResultado(encontradas, origen);
        } catch (e) {
            if (miTurno === turno) mostrarError(origen);
        }
    }

    const desdeCiudad = ciudad => ({ lat: ciudad.lat, lon: ciudad.lon, ciudad: ciudad, porUbicacion: false });

    // ---- La ubicacion del navegador ----
    function ubicar(alFallar) {
        const texto = boton.querySelector('span');
        boton.disabled = true;
        boton.setAttribute('aria-busy', 'true');
        texto.textContent = 'Buscando tu ubicación…';
        const listo = () => { boton.disabled = false; boton.removeAttribute('aria-busy'); texto.textContent = 'Usar mi ubicación'; };
        navigator.geolocation.getCurrentPosition(posicion => {
            listo();
            const { latitude, longitude } = posicion.coords;
            recordar({ modo: 'ubicacion' });
            cargarDesde({ lat: latitude, lon: longitude, ciudad: C.porCercania(latitude, longitude)[0], porUbicacion: true });
        }, error => {
            listo();
            if (alFallar) alFallar(error);
        }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 10 * 60 * 1000 });
    }

    function avisarFallo(error) {
        const mensaje = error && error.code === 1
            ? 'No diste permiso para usar tu ubicación. Elige tu ciudad en la lista.'
            : 'No pudimos saber dónde estás. Elige tu ciudad en la lista.';
        if (window.SkillMatchUI) SkillMatchUI.aviso(mensaje, 'info');
    }

    // ---- Desde donde empezar ----
    async function ciudadDelPerfil() {
        if (!conSesion || typeof fetchWithAuth !== 'function') return null;
        try {
            const respuesta = await fetchWithAuth(`${API_BASE_URL}/users/${encodeURIComponent(datos.id)}`);
            if (!respuesta.ok) return null;
            const perfil = await respuesta.json();
            return C.desdeTexto(perfil && perfil.location);
        } catch (e) { return null; }
    }

    async function permisoDado() {
        if (!puedeUbicar || !navigator.permissions) return false;
        try { return (await navigator.permissions.query({ name: 'geolocation' })).state === 'granted'; }
        catch (e) { return false; }
    }

    async function iniciar() {
        // Las guardadas de la persona, para que "Guardar" diga "Guardada" donde ya lo esta
        if (conSesion && typeof loadSavedOpportunities === 'function') {
            try { await loadSavedOpportunities(); } catch (e) { /* sin guardadas igual se ven las vacantes */ }
        }
        if (puedeUbicar) {
            boton.hidden = false;
            boton.addEventListener('click', () => ubicar(avisarFallo));
        }
        selector.addEventListener('change', () => {
            if (desdeCodigo) return;
            const ciudad = C.porClave(selector.value);
            if (!ciudad) return;
            recordar({ modo: 'ciudad', clave: ciudad.clave });
            cargarDesde(desdeCiudad(ciudad));
        });

        const antes = recuerdo();
        const elegida = antes && antes.modo === 'ciudad' && C.porClave(antes.clave);
        if (elegida) return cargarDesde(desdeCiudad(elegida));

        const respaldo = async () => cargarDesde(desdeCiudad((await ciudadDelPerfil()) || C.porClave('cartagena')));
        // Con el permiso ya dado el navegador no pregunta: se usa la ubicacion de una vez
        if (antes && antes.modo === 'ubicacion' && await permisoDado()) return ubicar(respaldo);
        return respaldo();
    }

    // Los esqueletos, los avisos y la lista de la marca son de ui.js, que se carga despues de este archivo
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
    else iniciar();
})();
