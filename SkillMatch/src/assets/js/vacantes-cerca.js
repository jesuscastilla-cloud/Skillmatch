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
 * Tu alcance (2026-11-12): "¿Hasta donde te mueves?" (tu ciudad, 25, 50 o
 * 100 km). Se piden las vacantes de cada ciudad dentro de ese radio, con su
 * total real, y las tarjetas se reparten UNA POR CIUDAD, de la mas cerca a la
 * mas lejos: asi cada tarjeta tiene su ruta en el mapa (antes las 4 solian ser
 * de tu misma ciudad y el mapa no decia nada). Las distancias son en linea
 * recta: las vacantes solo dicen su ciudad, no su direccion.
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

    const MOSTRAR = 4;      // tarjetas (en 2x2; cada una con su ruta en el mapa)
    const POR_RONDA = 8;    // ciudades que se consultan a la vez
    const RONDAS = 3;       // hasta 24 ciudades: mas lejos ya no es "cerca"
    const RECUERDO = 'skillmatch_cerca';
    const RECUERDO_KM = 'skillmatch_cerca_km';
    const ALCANCES = [0, 25, 50, 100];   // km; 0 = solo tu ciudad

    const boton = document.getElementById('cercaUbicacion');
    const selector = document.getElementById('cercaCiudad');
    const frase = document.getElementById('cercaFrase');
    const cargando = document.getElementById('cercaCargando');
    const lista = document.getElementById('cercaLista');
    const vacio = document.getElementById('cercaVacio');
    const grupoAlcance = document.getElementById('cercaAlcance');
    const listaCiudades = document.getElementById('cercaCiudades');

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

    let alcance = (() => {
        const guardado = leerLocal(RECUERDO_KM);
        return guardado !== null && ALCANCES.includes(Number(guardado)) ? Number(guardado) : 25;
    })();
    let origenActual = null;

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
        const vacantes = contenido.filter(v => v && v.id && C.esDe(ciudad, v.location));
        // El total de la ciudad: el del servidor, salvo que haya colado vacantes de otra ciudad con un
        // nombre parecido (entonces solo se cuentan las confirmadas)
        const total = vacantes.length === contenido.length && typeof pagina.totalElements === 'number'
            ? Math.max(pagina.totalElements, vacantes.length) : vacantes.length;
        return { vacantes: vacantes, total: total };
    }
    const kmHasta = (origen, c) => C.distanciaKm(origen.lat, origen.lon, c.lat, c.lon);

    /**
     * Las ciudades dentro de tu alcance (tu ciudad siempre primero), cada una con su total y sus
     * primeras vacantes. Devuelve { ciudades, encontradas, fuera }: encontradas son las tarjetas, una por
     * ciudad en orden de cercania (si hay menos de 4 ciudades, se completa con las mas cercanas).
     * Si dentro de tu alcance no hay nada, se buscan las mas cercanas que existan, esten donde esten
     * (fuera = true): asi alguien en Madrid, o en un pueblo sin vacantes, igual ve a donde ir.
     */
    async function buscar(origen) {
        const cerca = alcance === 0 ? [] : C.porCercania(origen.lat, origen.lon)
            .filter(c => c.clave !== origen.ciudad.clave && kmHasta(origen, c) <= alcance);
        const candidatas = [origen.ciudad].concat(cerca).slice(0, POR_RONDA * RONDAS);
        const ciudades = [];
        let fallidas = 0;
        for (let i = 0; i < candidatas.length; i += POR_RONDA) {
            const grupo = candidatas.slice(i, i + POR_RONDA);
            // Una ciudad que falla no tumba a las demas
            const respuestas = await Promise.all(grupo.map(c => vacantesDe(c).catch(() => { fallidas++; return null; })));
            respuestas.forEach((r, j) => {
                if (r && r.vacantes.length) ciudades.push({ ciudad: grupo[j], km: kmHasta(origen, grupo[j]), total: r.total, vacantes: r.vacantes });
            });
        }
        if (!ciudades.length && fallidas === candidatas.length) throw new Error('No respondió ninguna ciudad');
        let fuera = false;
        if (!ciudades.length) {
            // Nada dentro de tu alcance: las mas cercanas que haya, por rondas, de cerca a lejos
            fuera = true;
            const pedidas = new Set(candidatas.map(c => c.clave));
            const todas = C.porCercania(origen.lat, origen.lon).filter(c => !pedidas.has(c.clave));
            let encontradasFuera = 0;
            for (let ronda = 0; ronda < RONDAS && encontradasFuera < MOSTRAR; ronda++) {
                const grupo = todas.slice(ronda * POR_RONDA, (ronda + 1) * POR_RONDA);
                if (!grupo.length) break;
                const respuestas = await Promise.all(grupo.map(c => vacantesDe(c).catch(() => null)));
                respuestas.forEach((r, j) => {
                    if (!r || !r.vacantes.length) return;
                    ciudades.push({ ciudad: grupo[j], km: kmHasta(origen, grupo[j]), total: r.total, vacantes: r.vacantes });
                    encontradasFuera += r.vacantes.length;
                });
            }
        }
        const vistas = new Set(), encontradas = [];
        for (let ronda = 0; ronda < MOSTRAR && encontradas.length < MOSTRAR; ronda++) {
            ciudades.forEach(c => {
                const v = c.vacantes[ronda];
                if (!v || vistas.has(v.id) || encontradas.length >= MOSTRAR) return;
                vistas.add(v.id);
                encontradas.push({ vacante: v, ciudad: c.ciudad });
            });
        }
        // Las tarjetas, de la mas cerca a la mas lejos
        encontradas.sort((x, y) => kmHasta(origen, x.ciudad) - kmHasta(origen, y.ciudad));
        return { ciudades: ciudades, encontradas: encontradas, fuera: fuera };
    }

    // ---- Pintar ----
    function nombreLugar(origen) {
        // "cerca de" solo si de verdad esta cerca: desde Madrid, la ciudad mas cercana de la lista queda a
        // miles de km y la frase decia "tu ubicacion (cerca de Puerto Carreno)"
        if (!origen.porUbicacion) return origen.ciudad.corto;
        return kmHasta(origen, origen.ciudad) <= 50 ? `tu ubicación (cerca de ${origen.ciudad.corto})` : 'tu ubicación';
    }

    // i: su numero en la lista; el mapa (mapa-cerca.js) lo usa para iluminar su punto
    function tarjeta({ vacante, ciudad }, origen, i) {
        const aqui = ciudad.clave === origen.ciudad.clave;
        const km = Math.max(1, Math.round(C.distanciaKm(origen.lat, origen.lon, ciudad.lat, ciudad.lon)));
        const distancia = aqui ? `En ${escaparHtml(ciudad.corto)}` : `${escaparHtml(ciudad.corto)} · a ${km} km`;
        const modalidades = typeof MODALIDADES_VACANTE !== 'undefined' ? MODALIDADES_VACANTE : {};
        const modalidad = modalidades[C.normalizar(vacante.modality)] || '';
        const salario = typeof formatSalaryRange === 'function' ? formatSalaryRange(vacante.salaryMin, vacante.salaryMax) : '';
        // El numero es el mismo del punto de esta vacante en el mapa (el mapa es decorativo: aria-hidden)
        return `<li class="cerca-tarjeta" data-i="${i}">
                <span class="cerca-numero" aria-hidden="true">${i + 1}</span>
                <span class="cerca-distancia${aqui ? ' es-aqui' : ''}"${aqui ? '' : ' title="Distancia en línea recta"'}><i data-ico="pin"></i> ${distancia}</span>
                <h3 class="cerca-cargo"><a class="cerca-enlace" href="oportunidades.html?jobId=${encodeURIComponent(vacante.id)}">${escaparHtml(vacante.title || 'Vacante')}</a></h3>
                ${vacante.companyName ? `<p class="cerca-empresa">${escaparHtml(vacante.companyName)}</p>` : ''}
                <p class="cerca-datos">
                    ${modalidad ? `<span><i data-ico="desktop"></i> ${modalidad}</span>` : ''}
                    ${salario ? `<span><i data-ico="money"></i> ${escaparHtml(salario)}</span>` : ''}
                </p>
            </li>`;
    }

    // El mapa de la seccion (mapa-cerca.js); si no esta, las tarjetas funcionan igual
    const mapa = () => window.SkillMatchMapaCerca || null;

    function mostrarCargando(origen) {
        if (mapa()) mapa().cargando(origen);
        frase.textContent = 'Buscando vacantes ' + alcanceTexto() + ' de ' + nombreLugar(origen) + '…';
        lista.hidden = true;
        vacio.hidden = true;
        cargando.hidden = false;
        if (window.SkillMatchUI) SkillMatchUI.skeletons(cargando, 3);
    }

    const alcanceTexto = () => alcance === 0 ? 'en tu ciudad' : 'a ' + alcance + ' km o menos';

    // Las ciudades dentro de tu alcance, con cuantas vacantes tiene cada una. Al pasar el mouse por una,
    // el mapa ilumina su ruta (la de su tarjeta)
    function pintarCiudades(ciudades, encontradas, origen) {
        if (!listaCiudades) return;
        if (ciudades.length < 2) { listaCiudades.hidden = true; listaCiudades.innerHTML = ''; return; }
        listaCiudades.innerHTML = ciudades.map(c => {
            const i = encontradas.findIndex(e => e.ciudad.clave === c.ciudad.clave);
            const aqui = c.ciudad.clave === origen.ciudad.clave;
            const km = Math.max(1, Math.round(c.km));
            return '<li class="cerca-ciudad-fila' + (aqui ? ' es-aqui' : '') + '"' + (i >= 0 ? ' data-i="' + i + '"' : '') + '>' +
                '<span class="cerca-ciudad-nombre">' + escaparHtml(c.ciudad.corto) + '</span>' +
                '<span class="cerca-ciudad-km">' + (aqui ? 'tu ciudad' : km + ' km') + '</span>' +
                '<span class="cerca-ciudad-total">' + c.total.toLocaleString('es-CO') + '</span></li>';
        }).join('');
        listaCiudades.hidden = false;
    }

    function mostrarResultado(resultado, origen) {
        const encontradas = resultado.encontradas, ciudades = resultado.ciudades;
        cargando.hidden = true;
        cargando.innerHTML = '';
        cargando.removeAttribute('aria-busy');
        const lugar = nombreLugar(origen);
        if (!encontradas.length) {
            if (mapa()) mapa().vacio(origen);
            pintarCiudades([], [], origen);
            // Ni dentro de tu alcance ni en las ciudades mas cercanas
            frase.textContent = 'Todavía no hay vacantes abiertas cerca de ' + lugar + '.';
            lista.hidden = true;
            lista.innerHTML = '';
            vacio.innerHTML = `<div class="estado-vacio">
                    <span class="estado-vacio-icono"><i data-ico="pin"></i></span>
                    <div>
                        <p class="estado-vacio-titulo">Nada cerca por ahora</p>
                        <p class="estado-vacio-texto">Amplía hasta dónde te mueves, prueba con otra ciudad o mira todas las vacantes abiertas.</p>
                    </div>
                </div>`;
            vacio.hidden = false;
            return;
        }
        const total = ciudades.reduce((t, c) => t + c.total, 0);
        const vacantes = total === 1 ? '1 vacante abierta' : total.toLocaleString('es-CO') + ' vacantes abiertas';
        if (resultado.fuera) {
            frase.textContent = (alcance === 0 ? 'No hay vacantes abiertas en ' + lugar : 'No hay vacantes abiertas ' + alcanceTexto() + ' de ' + lugar) +
                '. Estas son las más cercanas, de la más cerca a la más lejos (en línea recta).';
        } else {
            frase.textContent = alcance === 0
                ? vacantes + ' en ' + lugar + '. Aquí tienes las más recientes.'
                : vacantes + ' ' + alcanceTexto() + ' de ' + lugar + ', en ' + (ciudades.length === 1 ? '1 ciudad' : ciudades.length + ' ciudades') +
                  '. Una por ciudad, de la más cerca a la más lejos (en línea recta).';
        }
        lista.innerHTML = encontradas.map((e, i) => tarjeta(e, origen, i)).join('');
        lista.hidden = false;
        vacio.hidden = true;
        pintarCiudades(ciudades, encontradas, origen);
        const totales = {};
        ciudades.forEach(c => { totales[c.ciudad.clave] = c.total; });
        if (mapa()) mapa().mostrar(origen, encontradas, { radio: alcance, totales: totales });
    }

    function mostrarError(origen) {
        if (mapa()) mapa().error(origen);
        cargando.hidden = true;
        cargando.innerHTML = '';
        cargando.removeAttribute('aria-busy');
        lista.hidden = true;
        lista.innerHTML = '';
        pintarCiudades([], [], origen);
        frase.textContent = 'No pudimos cargar las vacantes cercanas.';
        vacio.innerHTML = `<div class="estado-vacio">
                <span class="estado-vacio-icono"><i data-ico="alert"></i></span>
                <div>
                    <p class="estado-vacio-titulo">No pudimos cargar las vacantes cercanas</p>
                    <p class="estado-vacio-texto">Revisa tu conexión e inténtalo de nuevo.</p>
                    <button type="button" class="btn btn-secondary btn-small" data-cerca-reintentar>Intentar de nuevo</button>
                </div>
            </div>`;
        vacio.hidden = false;
        vacio.querySelector('[data-cerca-reintentar]').addEventListener('click', () => cargarDesde(origen));
    }

    async function cargarDesde(origen) {
        const miTurno = ++turno;
        origenActual = origen;
        marcarCiudad(origen.ciudad);
        mostrarCargando(origen);
        try {
            const resultado = await buscar(origen);
            if (miTurno === turno) mostrarResultado(resultado, origen);
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

    // ---- ¿Hasta donde te mueves? (un grupo de opciones: flechas para moverse, como las pestanas) ----
    function prepararAlcance() {
        if (!grupoAlcance) return;
        const opciones = Array.from(grupoAlcance.querySelectorAll('[data-km]'));
        const marcar = () => opciones.forEach(o => {
            const si = +o.dataset.km === alcance;
            o.setAttribute('aria-checked', String(si));
            o.tabIndex = si ? 0 : -1;
        });
        const elegir = (o, enfocar) => {
            if (enfocar) o.focus();
            if (+o.dataset.km === alcance) return;
            alcance = +o.dataset.km;
            try { localStorage.setItem(RECUERDO_KM, String(alcance)); } catch (e) { /* sin almacenamiento */ }
            marcar();
            if (origenActual) cargarDesde(origenActual);
        };
        opciones.forEach(o => o.addEventListener('click', () => elegir(o, false)));
        grupoAlcance.addEventListener('keydown', e => {
            const i = opciones.indexOf(document.activeElement);
            if (i < 0) return;
            const paso = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
            let destino = null;
            if (paso) destino = opciones[(i + paso + opciones.length) % opciones.length];
            else if (e.key === 'Home') destino = opciones[0];
            else if (e.key === 'End') destino = opciones[opciones.length - 1];
            if (!destino) return;
            e.preventDefault();
            elegir(destino, true);
        });
        marcar();
    }

    // Pasar el mouse por una ciudad de la lista ilumina su ruta en el mapa (y su tarjeta)
    if (listaCiudades) {
        const filaDe = el => el && el.closest && el.closest('.cerca-ciudad-fila[data-i]');
        listaCiudades.addEventListener('pointerover', e => { const f = filaDe(e.target); if (f && mapa() && mapa().resaltar) mapa().resaltar(+f.dataset.i); });
        listaCiudades.addEventListener('pointerleave', () => { if (mapa() && mapa().resaltar) mapa().resaltar(null); });
    }

    async function iniciar() {
        prepararAlcance();
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
