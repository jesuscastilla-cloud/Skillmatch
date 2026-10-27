// Llenar el perfil con la hoja de vida en PDF (perfil-usuario.html)
//
// Idea del video "Lectora" (moxen.studio): leer solo, confirmar a mano. El PDF
// se lee aqui, en el navegador, con pdf.js 6.4.299 (de Mozilla, gratis; licencia
// Apache-2.0 en vendor/pdfjs/LICENSE):
// no se sube a SkillMatch ni a ningun otro lado. Lo que se encuentra se muestra
// para revisar y corregir:
//  - lo dudoso va en ambar y sin marcar; un estudio o una experiencia a los que
//    les falta un dato obligatorio no se pueden marcar hasta completarlo;
//  - lo que el perfil ya tiene distinto no se reemplaza solo;
//  - las referencias no se traen (son datos de otras personas);
//  - nada se guarda hasta "Agregar a mi perfil".
// La lectura del texto (analizar) no toca la pagina: las pruebas la llaman directo.

(function () {
    'use strict';

    // pdf.js se carga solo al usarlo; su ruta sale de la de este archivo (assets/js/)
    const BASE = document.currentScript ? document.currentScript.src : window.location.href;
    const PDFJS = new URL('vendor/pdfjs/pdf.min.js', BASE).href;
    const PDFJS_TRABAJADOR = new URL('vendor/pdfjs/pdf.worker.min.js', BASE).href;
    const MAXIMO_MB = 5;
    const MAXIMO_PAGINAS = 6;
    const MAXIMO_BIO = 500;     // lo que acepta el backend (UpdateProfileRequest)
    const MAXIMO_TITULAR = 200;
    const MAXIMO_HABILIDAD = 40;
    const NIVELES = [['BASICO', 'Básico'], ['INTERMEDIO', 'Intermedio'], ['AVANZADO', 'Avanzado'], ['EXPERTO', 'Experto']];

    const plano = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
    const esc = t => escaparHtml(t == null ? '' : String(t));

    /* ---------- 1. Leer el PDF: renglones en orden de lectura ---------- */

    let pdfjs = null;
    async function cargarPdfjs() {
        if (!pdfjs) {
            pdfjs = await import(PDFJS);
            pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_TRABAJADOR;
        }
        return pdfjs;
    }

    // Cada renglon se arma con los trozos de texto que estan a la misma altura.
    // Un hueco grande en el mismo renglon separa dos bloques (un cargo y sus
    // fechas a la derecha). En las hojas de vida de dos columnas (una barra al
    // lado con contacto y habilidades) se lee una columna entera y luego la otra.
    function renglones(items, ancho) {
        const filas = [];
        items.forEach(it => {
            if (typeof it.str !== 'string' || !it.str.length) return;
            const x = it.transform[4];
            const y = it.transform[5];
            const alto = Math.abs(it.transform[3]) || it.height || 10;
            let fila = filas.find(f => Math.abs(f.y - y) <= Math.max(2, alto * 0.3));
            if (!fila) { fila = { y, trozos: [] }; filas.push(fila); }
            fila.trozos.push({ x, fin: x + (it.width || 0), s: it.str, alto });
        });
        filas.sort((a, b) => b.y - a.y);
        filas.forEach(f => {
            f.trozos.sort((a, b) => a.x - b.x);
            f.bloques = [];
            let actual = null;
            f.trozos.forEach(t => {
                const hueco = actual ? t.x - actual.fin : 0;
                if (actual && hueco > Math.max(24, t.alto * 2)) { f.bloques.push(actual); actual = null; }
                if (!actual) { actual = { x: t.x, fin: t.fin, texto: t.s, alto: t.alto }; return; }
                const espacio = hueco > t.alto * 0.15 && !/\s$/.test(actual.texto) && !/^\s/.test(t.s) ? ' ' : '';
                actual.texto += espacio + t.s;
                actual.fin = Math.max(actual.fin, t.fin);
                actual.alto = Math.max(actual.alto, t.alto);
            });
            if (actual) f.bloques.push(actual);
        });
        // Hay dos columnas si a la derecha hay al menos 4 bloques que no son solo
        // fechas y ningun texto de la izquierda pasa al otro lado. Una hoja de una
        // columna con las fechas a la derecha no cumple: sus parrafos cruzan.
        const corte = ancho * 0.36;
        const bloques = filas.flatMap(f => f.bloques);
        const soloFecha = b => fechasDe(b.texto).fechas.length && sinFechas(b.texto).length < 3;
        const derecha = bloques.filter(b => b.x >= corte && !soloFecha(b));
        const izquierda = bloques.filter(b => b.x < corte);
        const inicioDerecha = derecha.length ? Math.min(...derecha.map(b => b.x)) : Infinity;
        const limpio = b => ({ texto: b.texto.replace(/\s+/g, ' ').trim(), alto: b.alto });
        let salida;
        if (derecha.length >= 4 && izquierda.length >= 4 && izquierda.every(b => b.fin <= inicioDerecha + 2)) {
            const izquierda = [];
            const derecha = [];
            filas.forEach(f => f.bloques.forEach(b => (b.x < corte ? izquierda : derecha).push(limpio(b))));
            salida = izquierda.concat(derecha);
        } else {
            // Una columna: los bloques del mismo renglon van juntos, separados por " | "
            salida = filas.map(f => ({
                texto: f.bloques.map(b => b.texto.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' | '),
                alto: Math.max(...f.bloques.map(b => b.alto))
            }));
        }
        return salida.filter(r => r.texto);
    }

    async function leerPdf(archivo, alAvanzar) {
        const lib = await cargarPdfjs();
        const datos = new Uint8Array(await archivo.arrayBuffer());
        // Sin eval (la politica de seguridad del sitio no lo deja) ni fuentes:
        // solo se necesita el texto
        const tarea = lib.getDocument({ data: datos, isEvalSupported: false, disableFontFace: true });
        const doc = await tarea.promise;
        const paginas = Math.min(doc.numPages, MAXIMO_PAGINAS);
        const lineas = [];
        try {
            for (let n = 1; n <= paginas; n++) {
                if (alAvanzar) alAvanzar(n, paginas);
                const pagina = await doc.getPage(n);
                const contenido = await pagina.getTextContent();
                lineas.push(...renglones(contenido.items, pagina.getViewport({ scale: 1 }).width));
            }
        } finally {
            tarea.destroy(); // en pdf.js 6 se libera la tarea, no el documento
        }
        return { lineas, paginas };
    }

    /* ---------- 2. Entender el texto ---------- */

    const SECCIONES = [
        ['perfil', /^(perfil( profesional| personal| laboral)?|sobre mi|acerca de mi|resumen( profesional)?|objetivo( profesional| laboral)?|presentacion( personal)?|quien soy)$/],
        ['experiencia', /^(experiencia( laboral| profesional| de trabajo)?|historia laboral|trayectoria( laboral| profesional)?)$/],
        ['estudios', /^(educacion|formacion( academica)?|estudios( realizados| academicos)?|educacion y formacion)$/],
        ['habilidades', /^(habilidades( tecnicas| blandas| y competencias| y destrezas)?|competencias( laborales| tecnicas)?|aptitudes|conocimientos( tecnicos)?|destrezas|skills|herramientas( tecnologicas)?)$/],
        ['idiomas', /^idiomas?$/],
        ['cursos', /^(cursos( y certificaciones| realizados)?|certificaciones|certificados|formacion complementaria|diplomados)$/],
        ['referencias', /^referencias( personales| laborales| familiares)?$/],
        ['contacto', /^(contacto|datos( personales| de contacto)?|informacion( personal| de contacto)?)$/],
        ['otros', /^(intereses|hobbies|pasatiempos|logros|reconocimientos|voluntariado|proyectos)$/]
    ];

    function seccionDe(texto) {
        let t = plano(texto).replace(/^[\s•·\-–—|*_.\d]+/, '').replace(/[\s:•·\-–—|*_.]+$/, '');
        // "E X P E R I E N C I A": letras separadas por espacios
        if (/^(\S )+\S$/.test(t)) t = t.replace(/ /g, '');
        if (!t || t.length > 45) return null;
        const s = SECCIONES.find(([, re]) => re.test(t));
        return s ? s[0] : null;
    }

    const CORREO = /[\w.+-]+@[\w-]+(\.[\w-]+)+/;
    function telefonoDe(texto) {
        const candidatos = String(texto).match(/\+?[\d()][\d()\s.-]{8,18}\d/g) || [];
        for (const c of candidatos) {
            let d = c.replace(/\D/g, '');
            if (d.length === 12 && d.startsWith('57')) d = d.slice(2);
            // Celular (3xx) o fijo (60x) de Colombia, de 10 digitos
            if (d.length === 10 && /^(3|60)/.test(d)) return d.replace(/^(\d{3})(\d{3})(\d{4})$/, '$1 $2 $3');
        }
        return '';
    }

    const CIUDADES = ['Cartagena de Indias', 'Cartagena', 'Turbaco', 'Arjona', 'Magangué', 'Mompox', 'El Carmen de Bolívar',
        'Barranquilla', 'Soledad', 'Malambo', 'Santa Marta', 'Sincelejo', 'Montería', 'Valledupar', 'Riohacha', 'Bogotá',
        'Medellín', 'Cali', 'Bucaramanga', 'Cúcuta', 'Pereira', 'Manizales', 'Ibagué', 'Villavicencio', 'Pasto', 'Neiva',
        'Armenia', 'Popayán', 'Tunja'];
    function ciudadDe(texto) {
        const t = ' ' + plano(texto).replace(/[^a-z0-9 ]/g, ' ') + ' ';
        return CIUDADES.find(c => t.includes(' ' + plano(c) + ' ')) || '';
    }

    const PROFESION = /\b(tecnic|tecnolog|profesional|ingenier|licenciad|administrador|auxiliar|asistente|estudiante|contador|mesero|mesera|cocinero|cocinera|chef|bartender|recepcionista|desarrollador|disenador|enfermer|abogad|psicolog|vendedor|asesor|operari|conductor|docente|profesor|analista|coordinador|economista|comunicador|bachiller|guia turistic|programador|cajer|bodeguer|electricista|soldador|mecanic)/;
    const MESES = '(?:ene(?:ro)?|feb(?:rero)?|mar(?:zo)?|abr(?:il)?|may(?:o)?|jun(?:io)?|jul(?:io)?|ago(?:sto)?|sep(?:t(?:iembre)?)?|oct(?:ubre)?|nov(?:iembre)?|dic(?:iembre)?)';
    const NUM_MES = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12 };
    const FECHA = new RegExp('\\b(?:(' + MESES + ')\\.?\\s*(?:de\\s*|del\\s*)?|(\\d{1,2})\\s*[/-]\\s*)?((?:19|20)\\d{2})\\b', 'gi');
    const AHORA = /\b(actual(?:mente|idad)?|presente|hoy|a la fecha|en curso)\b/i;

    // "Ene 2019 - Dic 2021" -> [{ anio: 2019, mes: 1 }, { anio: 2021, mes: 12 }] y si dice "actualmente"
    function fechasDe(texto) {
        const fechas = [];
        String(texto).replace(FECHA, (todo, mesNombre, mesNumero, anio) => {
            const mes = mesNombre ? NUM_MES[plano(mesNombre).slice(0, 3)] : (mesNumero ? Number(mesNumero) : 0);
            fechas.push({ anio: Number(anio), mes: mes >= 1 && mes <= 12 ? mes : 0 });
            return todo;
        });
        return { fechas, actual: AHORA.test(plano(texto)) };
    }
    const sinFechas = t => String(t).replace(FECHA, ' ').replace(new RegExp(AHORA.source, 'gi'), ' ')
        .replace(/\(\s*\)/g, ' ').replace(/\s*(?:-|–|—|\/|\bal?\b|\bhasta\b)\s*(?=$|\|)/gi, ' ')
        .replace(/^[\s|,\-–—:]+|[\s|,\-–—:]+$/g, '').replace(/\s+/g, ' ').trim();

    // Habilidades: separadas por vinetas, comas, punto y coma o barras. Una
    // frase larga no es una habilidad: se deja fuera.
    function habilidadesDe(lineas, esIdioma) {
        const salida = [];
        lineas.forEach(l => {
            const partes = esIdioma ? [l.texto] : l.texto.split(/\s*(?:[•·●▪■◦➢➤✓✔|;,]|\s[-–]\s)\s*/);
            partes.forEach(p => {
                let s = p.replace(/^[\s\-–*\d.)•·]+/, '').replace(/[.:]+$/, '').trim();
                if (esIdioma) s = s.replace(/\s*[:\-–(),]+\s*/g, ' ').replace(/\s+/g, ' ').trim();
                if (s.length < 2 || /^\d+$/.test(s)) return;
                const palabras = s.split(/\s+/).length;
                if (s.length > 50 || palabras > 6) return;
                salida.push({ nombre: s.slice(0, MAXIMO_HABILIDAD), revisa: palabras > 4 || s.length > MAXIMO_HABILIDAD });
            });
        });
        const vistas = new Set();
        return salida.filter(h => !vistas.has(plano(h.nombre)) && vistas.add(plano(h.nombre)));
    }

    const INSTITUCION = /\b(universidad|institucion|instituto|colegio|sena|corporacion|fundacion|escuela|politecnico|liceo|academia|tecnologico|centro de formacion)\b/;
    const TITULO = /\b(bachiller|tecnic|tecnolog|profesional en|ingenier|licenciatura|licenciad|administracion|contaduria|especializa|maestria|magister|diplomado|pregrado|estudiante de|psicologia|enfermeria|derecho|medicina|economia|grado en|carrera)/;

    function rangoTexto(fechas, actual) {
        const anios = [...new Set(fechas.map(f => f.anio))].sort();
        if (!anios.length) return actual ? 'En curso' : '';
        if (actual) return anios[0] + ' – actualidad';
        return anios.length > 1 ? anios[0] + ' – ' + anios[anios.length - 1] : String(anios[0]);
    }

    function estudiosDe(lineas) {
        const lista = [];
        let actual = null;
        const nuevo = () => ({ school: '', degree: '', fechas: [], actual: false });
        const cerrar = () => { if (actual && (actual.school || actual.degree)) lista.push(actual); actual = nuevo(); };
        actual = nuevo();
        lineas.forEach(l => {
            const f = fechasDe(l.texto);
            const limpio = sinFechas(l.texto);
            // "Técnico en Sistemas | SENA" o "Técnico en Sistemas - SENA": cada parte a su campo
            const partes = limpio.split(/\s*(?:\||\s[-–—]\s|,)\s*/).filter(Boolean);
            const inst = partes.find(p => INSTITUCION.test(plano(p)));
            const tit = partes.find(p => p !== inst && TITULO.test(plano(p)));
            if (inst && (actual.school || (tit && actual.degree))) cerrar();
            else if (tit && !inst && actual.degree) cerrar();
            if (inst) actual.school = inst;
            if (tit) actual.degree = tit;
            if (!inst && !tit && partes.length === 1 && limpio.length > 3 && limpio.length < 80 && !f.fechas.length) {
                // Un renglon suelto: si falta el titulo y no parece institucion, es el titulo
                if (actual.school && !actual.degree) actual.degree = limpio;
                else if (actual.degree && !actual.school) actual.school = limpio;
            }
            actual.fechas.push(...f.fechas);
            actual.actual = actual.actual || f.actual;
        });
        cerrar();
        return lista.map(e => ({
            school: e.school.slice(0, 120), degree: e.degree.slice(0, 120),
            anios: rangoTexto(e.fechas, e.actual), revisa: !e.school || !e.degree
        }));
    }

    const esCorta = t => t.length <= 70 && !/[.;]$/.test(t.trim()) && !/^[•·●▪\-–*]/.test(t.trim());

    // Experiencia: cada renglon con fechas ("Ene 2019 - Dic 2021") es el ancla
    // de un empleo; los renglones cortos justo antes son el cargo y la empresa,
    // y lo que sigue hasta el proximo empleo es la descripcion.
    function experienciasDe(lineas) {
        const anclas = [];
        lineas.forEach((l, i) => { if (fechasDe(l.texto).fechas.length && sinFechas(l.texto).length < 90) anclas.push(i); });
        const cabeceras = anclas.map((a, k) => {
            const limite = k ? anclas[k - 1] + 1 : 0;
            let inicio = a;
            while (inicio > limite && a - inicio < 2 && esCorta(lineas[inicio - 1].texto) && !fechasDe(lineas[inicio - 1].texto).fechas.length) inicio--;
            return inicio;
        });
        return anclas.map((a, k) => {
            const textos = lineas.slice(cabeceras[k], a).map(l => l.texto)
                .concat(sinFechas(lineas[a].texto)).join(' | ').split(/\s*\|\s*/).map(t => t.trim()).filter(Boolean);
            const fin = k + 1 < anclas.length ? cabeceras[k + 1] : lineas.length;
            // "Mesera | Ene 2021 - Dic 2022" y la empresa en el renglon de abajo
            let desdeDescripcion = a + 1;
            const siguiente = lineas[a + 1];
            if (textos.length < 2 && a + 1 < fin && esCorta(siguiente.texto) && !fechasDe(siguiente.texto).fechas.length) {
                textos.push(siguiente.texto.split(/\s*\|\s*/)[0]);
                desdeDescripcion = a + 2;
            }
            const descripcion = lineas.slice(desdeDescripcion, fin).map(l => l.texto.replace(/^[•·●▪\-–*]\s*/, '')).join(' ').slice(0, 600);
            const { fechas, actual } = fechasDe(lineas[a].texto);
            const mes = f => f && f.mes ? f.anio + '-' + String(f.mes).padStart(2, '0') : '';
            return {
                position: (textos[0] || '').slice(0, 120),
                company: (textos[1] || '').slice(0, 120),
                desde: mes(fechas[0]),
                hasta: actual ? '' : mes(fechas[1]),
                actual,
                fechasTexto: rangoTexto(fechas, actual),
                description: descripcion,
                revisa: true
            };
        });
    }

    /** De los renglones del PDF a lo que se puede agregar al perfil. */
    function analizar(lineas) {
        const porSeccion = {};
        const arriba = [];   // antes del primer titulo de seccion: nombre, titular, contacto
        let seccion = null;
        lineas.forEach(l => {
            const s = seccionDe(l.texto);
            if (s) { seccion = s; porSeccion[s] = porSeccion[s] || []; return; }
            if (seccion) porSeccion[seccion].push(l); else arriba.push(l);
        });
        // Las referencias son datos de otras personas: no se leen
        const propias = lineas.filter(l => !(porSeccion.referencias || []).includes(l));
        const textoPropio = propias.map(l => l.texto).join('\n');

        const correo = (textoPropio.match(CORREO) || [''])[0];
        const telefono = telefonoDe((arriba.concat(porSeccion.contacto || [])).map(l => l.texto).join('\n')) || telefonoDe(textoPropio);
        const ciudad = ciudadDe(arriba.concat(porSeccion.contacto || []).map(l => l.texto).join('\n'));

        // El nombre es el renglon mas grande de arriba
        const primeros = (arriba.length ? arriba : lineas).slice(0, 4);
        const nombreLinea = primeros.reduce((m, l) => (!m || l.alto > m.alto ? l : m), null);
        const nombre = nombreLinea && !CORREO.test(nombreLinea.texto) ? nombreLinea.texto : '';
        let titular = null;
        const despues = arriba.slice(arriba.indexOf(nombreLinea) + 1, arriba.indexOf(nombreLinea) + 4);
        const candidato = despues.find(l => !CORREO.test(l.texto) && !telefonoDe(l.texto) && l.texto.length >= 4 && l.texto.length <= 90 && !ciudadDe(l.texto));
        if (candidato) titular = { valor: candidato.texto.split(/\s*\|\s*/)[0].slice(0, MAXIMO_TITULAR), revisa: !PROFESION.test(plano(candidato.texto)) };

        let bio = null;
        const textoPerfil = (porSeccion.perfil || []).map(l => l.texto).join(' ').replace(/\s+/g, ' ').trim();
        if (textoPerfil) {
            let valor = textoPerfil;
            let recortada = false;
            if (valor.length > MAXIMO_BIO) {
                const corte = valor.slice(0, MAXIMO_BIO);
                const punto = corte.lastIndexOf('. ');
                valor = punto > 200 ? corte.slice(0, punto + 1) : corte.slice(0, corte.lastIndexOf(' ')) + '…';
                recortada = true;
            }
            bio = { valor, recortada, revisa: recortada };
        }

        return {
            nombre, correo,
            telefono: telefono ? { valor: telefono, revisa: false } : null,
            ciudad: ciudad ? { valor: ciudad, revisa: false } : null,
            titular, bio,
            habilidades: habilidadesDe(porSeccion.habilidades || []).concat(habilidadesDe(porSeccion.idiomas || [], true)),
            estudios: estudiosDe(porSeccion.estudios || []),
            experiencias: experienciasDe(porSeccion.experiencia || []),
            secciones: Object.keys(porSeccion),
            referencias: !!porSeccion.referencias,
            renglones: lineas.length
        };
    }

    /* ---------- 3. La ventana: elegir el PDF, leerlo y revisar ---------- */

    function lista(partes) {
        const p = partes.filter(Boolean);
        return p.length > 1 ? p.slice(0, -1).join(', ') + ' y ' + p[p.length - 1] : (p[0] || '');
    }
    const cuantas = (n, uno, varios) => n + ' ' + (n === 1 ? uno : varios);

    function abrirLector() {
        const user = getUserData();
        if (!user || !window.SkillMatchUI) return;
        // Lo que ya tiene el perfil, para no repetir ni reemplazar sin preguntar.
        // Las experiencias se prueban: si el servidor no las atiende, no se ofrecen.
        const actual = Promise.all([
            fetchWithAuth(`${API_BASE_URL}/users/${encodeURIComponent(user.id)}`).then(r => (r.ok ? r.json() : {})).catch(() => ({})),
            fetchWithAuth(`${API_BASE_URL}/users/${encodeURIComponent(user.id)}/skills`).then(r => (r.ok ? r.json() : [])).catch(() => []),
            fetchWithAuth(`${API_BASE_URL}/users/${encodeURIComponent(user.id)}/experiences`).then(r => r.ok).catch(() => false)
        ]).then(([perfil, habilidades, experienciaDisponible]) => ({
            perfil: perfil.user || perfil, habilidades: Array.isArray(habilidades) ? habilidades : [], experienciaDisponible
        }));

        const v = SkillMatchUI.ventana({
            id: 'ventanaLector',
            titulo: 'Llenar con tu hoja de vida',
            icono: 'upload',
            ancha: true,
            cuerpo: `
                <p class="lector-intro">Sube tu hoja de vida en PDF y te proponemos tus datos, habilidades y estudios para tu perfil. Tú revisas y eliges qué agregar.</p>
                <label class="editor-soltar lector-soltar">
                    <input type="file" accept="application/pdf,.pdf" class="editor-archivo" data-archivo>
                    <span class="editor-soltar-icono"><i data-ico="upload"></i></span>
                    <strong>Elige tu PDF o suéltalo aquí</strong>
                    <span>Hasta ${MAXIMO_MB} MB. El que exportas desde Word o Google Docs funciona mejor.</span>
                </label>
                <p class="error-text" role="alert" hidden></p>
                <p class="lector-privado"><i data-ico="lock"></i> Tu PDF se lee aquí, en tu navegador: no se sube a SkillMatch ni a ningún otro lado.</p>`
        });
        const cuerpo = v.cuerpo;
        const entrada = cuerpo.querySelector('[data-archivo]');
        const zona = cuerpo.querySelector('.lector-soltar');
        const error = cuerpo.querySelector('.error-text');
        const problema = texto => { error.textContent = texto; error.hidden = !texto; };

        async function usar(archivo) {
            if (!archivo) return;
            problema('');
            if (!/pdf$/i.test(archivo.type) && !/\.pdf$/i.test(archivo.name)) return problema('Ese archivo no es un PDF. Elige tu hoja de vida en PDF.');
            if (archivo.size > MAXIMO_MB * 1024 * 1024) return problema(`El PDF pesa más de ${MAXIMO_MB} MB. Prueba exportándolo de nuevo, sin fotos grandes.`);
            cuerpo.innerHTML = '<div class="lector-leyendo"><span class="loading-spinner" aria-hidden="true"></span><p aria-live="polite" data-progreso>Abriendo tu PDF…</p></div>';
            const progreso = cuerpo.querySelector('[data-progreso]');
            let leido;
            try {
                leido = await leerPdf(archivo, (n, total) => { progreso.textContent = `Leyendo la página ${n} de ${total}…`; });
            } catch (e) {
                console.warn('No se pudo leer la hoja de vida:', e);
                const nombre = e && e.name;
                const texto = nombre === 'PasswordException' ? 'El PDF tiene contraseña. Quítasela o exporta uno sin contraseña.'
                    : nombre === 'InvalidPDFException' ? 'No pudimos abrir ese PDF: parece dañado.'
                    : 'No pudimos leer el PDF. Revisa tu conexión e intenta de nuevo.';
                return volverAEmpezar(texto);
            }
            if (!v.raiz.isConnected) return;
            const hallado = analizar(leido.lineas);
            const vacio = !hallado.telefono && !hallado.ciudad && !hallado.titular && !hallado.bio && !hallado.habilidades.length && !hallado.estudios.length && !hallado.experiencias.length;
            if (!leido.lineas.length) return volverAEmpezar('Este PDF es una imagen escaneada: no tiene texto que se pueda leer. Prueba con el que exportas desde Word o Google Docs.');
            if (vacio) return volverAEmpezar('Leímos tu PDF pero no encontramos datos para tu perfil. ¿Tiene títulos como "Experiencia", "Estudios" o "Habilidades"?');
            progreso.textContent = 'Comparando con tu perfil…';
            revisar(v, hallado, leido.paginas, await actual);
        }

        function volverAEmpezar(texto) {
            v.cerrar();
            abrirLector();
            const nueva = document.getElementById('ventanaLector');
            const aviso = nueva && nueva.querySelector('.error-text');
            if (aviso) { aviso.textContent = texto; aviso.hidden = false; }
        }

        entrada.addEventListener('change', () => usar(entrada.files[0]));
        zona.addEventListener('dragover', e => { e.preventDefault(); zona.classList.add('is-encima'); });
        zona.addEventListener('dragleave', () => zona.classList.remove('is-encima'));
        zona.addEventListener('drop', e => {
            e.preventDefault();
            zona.classList.remove('is-encima');
            usar(e.dataTransfer.files[0]);
        });
    }

    function item(id, nombre, contenido, opciones) {
        const o = opciones || {};
        return `
            <div class="lector-item${o.revisa ? ' revisa' : ''}"${o.atributos || ''}>
                <input type="checkbox" id="${id}" data-elegible${o.marcado ? ' checked' : ''}${o.inhabilitado ? ' disabled' : ''}>
                <div class="lector-cuerpo">
                    <label for="${id}" class="lector-nombre">${nombre}${o.revisa ? ' <span class="lector-etiqueta">Revisa</span>' : ''}</label>
                    ${contenido}
                    ${o.nota ? `<p class="lector-nota">${o.nota}</p>` : ''}
                </div>
            </div>`;
    }

    function revisar(v, h, paginas, actual) {
        const perfil = actual.perfil || {};
        const yaTiene = new Set(actual.habilidades.map(s => plano(s.name)));
        const nuevas = h.habilidades.filter(s => !yaTiene.has(plano(s.nombre)));
        const repetidas = h.habilidades.filter(s => yaTiene.has(plano(s.nombre)));
        const user = getUserData() || {};
        const otraPersona = h.nombre && user.firstName && !plano(h.nombre).includes(plano(user.firstName).split(' ')[0]);

        // Un dato que el perfil ya tiene distinto queda sin marcar: reemplazarlo es una decision
        const dato = (clave, nombre, hallado, campo) => {
            if (!hallado) return '';
            const ahora = perfil[clave];
            if (ahora && plano(ahora) === plano(hallado.valor)) return '';
            const distinto = !!ahora;
            return item('lc-' + clave, nombre, campo(hallado.valor), {
                revisa: hallado.revisa || distinto,
                marcado: !hallado.revisa && !distinto,
                atributos: ` data-dato="${clave}"`,
                nota: [distinto ? `Ahora en tu perfil: «${esc(ahora)}». Si lo marcas, se reemplaza.` : '',
                    hallado.recortada ? `Lo recortamos a ${MAXIMO_BIO} caracteres, lo máximo del perfil.` : ''].filter(Boolean).join(' ')
            });
        };
        const datos = [
            dato('phone', 'Teléfono', h.telefono, valor => `<input type="tel" class="lector-campo" data-valor value="${esc(valor)}" maxlength="20" aria-label="Teléfono">`),
            dato('location', 'Ciudad', h.ciudad, valor => `<input type="text" class="lector-campo" data-valor value="${esc(valor)}" maxlength="100" aria-label="Ciudad">`),
            dato('headline', 'Titular (lo que haces)', h.titular, valor => `<input type="text" class="lector-campo" data-valor value="${esc(valor)}" maxlength="${MAXIMO_TITULAR}" aria-label="Titular">`),
            dato('bio', 'Acerca de ti', h.bio, valor => `<textarea class="lector-campo" data-valor rows="4" maxlength="${MAXIMO_BIO}" aria-label="Acerca de ti">${esc(valor)}</textarea>`)
        ].join('');

        const habilidades = nuevas.length ? `
            <fieldset class="lector-grupo">
                <legend>${cuantas(nuevas.length, 'habilidad', 'habilidades')}</legend>
                <div class="lector-chips">${nuevas.map((s, i) => `
                    <label class="lector-chip${s.revisa ? ' revisa' : ''}"><input type="checkbox" data-elegible data-habilidad="${esc(s.nombre)}"${s.revisa ? '' : ' checked'}><span>${esc(s.nombre)}</span>${s.revisa ? '<span class="lector-etiqueta">Revisa</span>' : ''}</label>`).join('')}
                </div>
                <label class="lector-nivel">Nivel para estas habilidades
                    <select data-nivel>${NIVELES.map(([k, t]) => `<option value="${k}"${k === 'INTERMEDIO' ? ' selected' : ''}>${t}</option>`).join('')}</select>
                </label>
                <p class="lector-nota">Después puedes cambiar el nivel de cada una en tu perfil.${repetidas.length ? ' Ya tienes ' + esc(lista(repetidas.map(s => s.nombre))) + ': no se repiten.' : ''}</p>
            </fieldset>` : '';

        const estudios = h.estudios.length ? `
            <fieldset class="lector-grupo"><legend>${cuantas(h.estudios.length, 'estudio', 'estudios')}</legend>
                ${h.estudios.map((e, i) => item('lc-estudio-' + i, esc(e.degree || e.school || 'Estudio'), `
                    <div class="lector-campos">
                        <label>Institución <input type="text" data-campo="school" value="${esc(e.school)}" maxlength="120" required></label>
                        <label>Título <input type="text" data-campo="degree" value="${esc(e.degree)}" maxlength="120" required></label>
                        <label>Años <input type="text" data-campo="anios" value="${esc(e.anios)}" maxlength="40"></label>
                    </div>`, { revisa: e.revisa, marcado: !e.revisa, inhabilitado: e.revisa, atributos: ' data-estudio',
                    nota: e.revisa ? 'Completa la institución y el título para poder agregarlo.' : '' })).join('')}
            </fieldset>` : '';

        const experiencias = h.experiencias.length ? `
            <fieldset class="lector-grupo"><legend>${cuantas(h.experiencias.length, 'experiencia', 'experiencias')}</legend>
                ${actual.experienciaDisponible ? '' : '<p class="lector-aviso">Por ahora no se pueden agregar experiencias: falta un arreglo en el servidor de SkillMatch. Las mostramos para que veas lo que encontramos.</p>'}
                ${h.experiencias.map((e, i) => item('lc-experiencia-' + i, esc(e.position || 'Experiencia'), `
                    <div class="lector-campos">
                        <label>Cargo <input type="text" data-campo="position" value="${esc(e.position)}" maxlength="120" required></label>
                        <label>Empresa <input type="text" data-campo="company" value="${esc(e.company)}" maxlength="120" required></label>
                        <label>Desde <input type="month" data-campo="desde" value="${esc(e.desde)}" required></label>
                        <label>Hasta <input type="month" data-campo="hasta" value="${esc(e.hasta)}"${e.actual ? ' disabled' : ''}></label>
                        <label class="checkbox-label lector-actual"><input type="checkbox" data-campo="actual"${e.actual ? ' checked' : ''}> Trabajo aquí ahora</label>
                        <label class="lector-ancho">Qué hacías <textarea data-campo="description" rows="3" maxlength="600">${esc(e.description)}</textarea></label>
                    </div>`, { revisa: true, inhabilitado: true, atributos: ` data-experiencia${actual.experienciaDisponible ? '' : ' data-sin-servidor'}`,
                    nota: actual.experienciaDisponible ? `En tu hoja de vida dice: ${esc(e.fechasTexto || 'sin fechas')}. Revisa el cargo, la empresa y desde cuándo.` : '' })).join('')}
            </fieldset>` : '';

        const encontrado = lista([
            h.telefono && 'tu teléfono', h.ciudad && 'tu ciudad', h.titular && 'tu titular', h.bio && 'tu presentación',
            h.habilidades.length && cuantas(h.habilidades.length, 'habilidad', 'habilidades'),
            h.estudios.length && cuantas(h.estudios.length, 'estudio', 'estudios'),
            h.experiencias.length && cuantas(h.experiencias.length, 'experiencia', 'experiencias')
        ]);
        v.cuerpo.innerHTML = `
            <form class="lector" novalidate>
                <p class="lector-intro">Leímos ${cuantas(paginas, 'página', 'páginas')} y ${h.renglones} renglones de tu hoja de vida: encontramos ${encontrado}.
                    Revisa, corrige si hace falta y marca lo que quieras agregar. <strong>Nada se guarda hasta que pulses «Agregar a mi perfil».</strong></p>
                ${otraPersona ? `<p class="lector-aviso">Esta hoja de vida dice «${esc(h.nombre)}». ¿Seguro que es la tuya?</p>` : ''}
                ${h.referencias ? '<p class="lector-nota">Las referencias no se traen: son datos de otras personas.</p>' : ''}
                ${datos ? `<fieldset class="lector-grupo"><legend>Tus datos</legend>${datos}</fieldset>` : ''}
                ${habilidades}${estudios}${experiencias}
                <p class="error-text" role="alert" hidden></p>
                <div class="modal-actions lector-acciones">
                    <p class="lector-cuenta" aria-live="polite"></p>
                    <button type="button" class="btn-secondary-modal" data-cancelar>Cancelar</button>
                    <button type="submit" class="btn-primary-modal" data-agregar>Agregar a mi perfil</button>
                </div>
            </form>`;
        const form = v.cuerpo.querySelector('form');
        const boton = form.querySelector('[data-agregar]');
        const cuenta = form.querySelector('.lector-cuenta');

        // Estudios y experiencias: se pueden marcar solo con lo obligatorio escrito
        const requisitos = caja => {
            const marca = caja.querySelector('[data-elegible]');
            const listo = [...caja.querySelectorAll('[required]')].every(c => c.disabled || c.value.trim());
            const permitido = listo && !caja.hasAttribute('data-sin-servidor');
            marca.disabled = !permitido;
            if (!permitido) marca.checked = false;
        };
        const actualizar = () => {
            const marcadas = form.querySelectorAll('[data-elegible]:checked:not(:disabled)').length;
            const porRevisar = form.querySelectorAll('.revisa [data-elegible]:not(:checked):not([data-sin-servidor] *)').length;
            boton.disabled = !marcadas;
            boton.textContent = marcadas ? `Agregar a mi perfil (${marcadas})` : 'Agregar a mi perfil';
            cuenta.textContent = [marcadas ? cuantas(marcadas, 'marcado', 'marcados') : 'Nada marcado', porRevisar ? cuantas(porRevisar, 'por revisar', 'por revisar') : ''].filter(Boolean).join(' · ');
        };
        form.querySelectorAll('[data-estudio], [data-experiencia]').forEach(caja => {
            requisitos(caja);
            caja.addEventListener('input', () => { requisitos(caja); actualizar(); });
        });
        form.querySelectorAll('[data-campo="actual"]').forEach(c => c.addEventListener('change', () => {
            const hasta = c.closest('.lector-campos').querySelector('[data-campo="hasta"]');
            hasta.disabled = c.checked;
            if (c.checked) hasta.value = '';
        }));
        form.addEventListener('change', actualizar);
        actualizar();
        form.querySelector('[data-cancelar]').addEventListener('click', v.cerrar);
        form.addEventListener('submit', e => { e.preventDefault(); guardar(v, form); });
        const primero = form.querySelector('[data-elegible]:not(:disabled)');
        if (primero) primero.focus();
    }

    /* ---------- 4. Guardar lo marcado ---------- */

    async function guardar(v, form) {
        const user = getUserData();
        const boton = form.querySelector('[data-agregar]');
        const error = form.querySelector('.error-text');
        const marcado = sel => [...form.querySelectorAll(sel)].filter(c => c.querySelector('[data-elegible]:checked:not(:disabled)'));
        const datos = {};
        marcado('[data-dato]').forEach(c => { datos[c.dataset.dato] = c.querySelector('[data-valor]').value.trim(); });
        const nivel = (form.querySelector('[data-nivel]') || {}).value || 'INTERMEDIO';
        const habilidades = [...form.querySelectorAll('[data-habilidad]:checked')].map(c => c.dataset.habilidad);
        const valor = (caja, campo) => { const c = caja.querySelector(`[data-campo="${campo}"]`); return c ? (c.type === 'checkbox' ? c.checked : c.value.trim()) : ''; };
        const estudios = marcado('[data-estudio]').map(c => ({
            school: valor(c, 'school'), degree: valor(c, 'degree'), fieldOfStudy: '', description: valor(c, 'anios'), isCurrent: false
        }));
        const experiencias = marcado('[data-experiencia]').map(c => ({
            position: valor(c, 'position'), company: valor(c, 'company'),
            startDate: valor(c, 'desde') + '-01',
            endDate: valor(c, 'actual') || !valor(c, 'hasta') ? null : valor(c, 'hasta') + '-01',
            isCurrent: valor(c, 'actual'), description: valor(c, 'description'), location: ''
        }));

        const tareas = [];
        const base = `${API_BASE_URL}/users/${encodeURIComponent(user.id)}`;
        const enviar = (url, metodo, cuerpo) => fetchWithAuth(url, { method: metodo, body: JSON.stringify(cuerpo) }).then(r => { if (!r.ok) throw new Error(r.status); });
        if (Object.keys(datos).length) tareas.push({ grupo: 'datos', hacer: () => enviar(base, 'PUT', datos) });
        habilidades.forEach(nombre => tareas.push({ grupo: 'habilidad', hacer: () => enviar(base + '/skills', 'POST', { name: nombre, level: nivel }) }));
        estudios.forEach(e => tareas.push({ grupo: 'estudio', hacer: () => enviar(base + '/educations', 'POST', e) }));
        experiencias.forEach(e => tareas.push({ grupo: 'experiencia', hacer: () => enviar(base + '/experiences', 'POST', e) }));

        boton.disabled = true;
        error.hidden = true;
        const cuenta = form.querySelector('.lector-cuenta');
        const hechas = { datos: 0, habilidad: 0, estudio: 0, experiencia: 0 };
        let fallas = 0;
        // Una por una: el servidor es gratuito y asi el avance se puede contar
        for (let i = 0; i < tareas.length; i++) {
            boton.textContent = `Agregando ${i + 1} de ${tareas.length}…`;
            try { await tareas[i].hacer(); hechas[tareas[i].grupo]++; } catch (e) { fallas++; }
        }
        cuenta.textContent = '';
        ['loadUserProfile', 'loadUserSkills', 'loadUserEducations', 'loadUserExperiences'].forEach(f => { if (typeof window[f] === 'function') window[f](); });
        const resumen = lista([
            hechas.datos && 'tus datos',
            hechas.habilidad && cuantas(hechas.habilidad, 'habilidad', 'habilidades'),
            hechas.estudio && cuantas(hechas.estudio, 'estudio', 'estudios'),
            hechas.experiencia && cuantas(hechas.experiencia, 'experiencia', 'experiencias')
        ]);
        if (fallas && !resumen) {
            error.textContent = 'No se pudo agregar nada. Revisa tu conexión e intenta de nuevo.';
            error.hidden = false;
            boton.disabled = false;
            boton.textContent = 'Intentar de nuevo';
            return;
        }
        v.cerrar();
        SkillMatchUI.aviso(`Listo: agregamos ${resumen} a tu perfil.${fallas ? ` ${cuantas(fallas, 'cosa no se pudo', 'cosas no se pudieron')} agregar: inténtalo desde tu perfil.` : ''}`, fallas ? 'error' : 'ok');
    }

    /* ---------- 5. Entrada ---------- */

    document.addEventListener('DOMContentLoaded', () => {
        const boton = document.getElementById('importarCvBtn');
        if (boton) boton.addEventListener('click', abrirLector);
    });

    // Para las pruebas: la lectura del texto, sin la pagina
    window.LectorHojaDeVida = { analizar, renglones, abrir: abrirLector };
})();
