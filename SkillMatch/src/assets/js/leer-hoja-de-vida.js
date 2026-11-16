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

    /* ---------- Habilidades: solo lo que de verdad es una habilidad ---------- */
    //
    // Revision 2026-11-15 (Luis: "coge cosas que no son habilidades"). Antes, todo lo
    // que estaba bajo "Habilidades" separado por comas se proponia marcado: entraban
    // rotulos ("Habilidades blandas: liderazgo"), cualidades ("Puntual"), la ciudad,
    // los puntos de nivel ("○○") y el nivel pegado al nombre ("Excel básico").
    // Ahora cada pedazo pasa por estos filtros, en orden:
    //  1. Se le quita el nivel ("Excel (Avanzado)", "Inglés B1", "AutoCAD 80%", "●●●○○")
    //     y se guarda aparte, para usarlo como nivel de esa habilidad.
    //  2. Si esta en el catalogo, se propone con su nombre de siempre y MARCADA
    //     ("Microsoft Excel", "Manejo de Excel" -> "Excel").
    //  3. Si es ruido (correo, telefono, ciudad, fecha, un rotulo), se descarta.
    //  4. Si es una cualidad ("Responsable", "Buena presentación personal"), no se
    //     propone: se avisa que va mejor en "Acerca de ti".
    //  5. Si es una frase larga, se buscan dentro las habilidades del catalogo
    //     ("Control de versiones con Git y GitHub" -> Git, GitHub).
    //  6. Lo corto que no se reconoce se muestra SIN MARCAR y con "Revisa".
    // Ademas, las habilidades del catalogo que aparecen en la experiencia, los cursos
    // o el perfil se ofrecen aparte, sin marcar: hay evidencia, pero decide la persona.

    // Catalogo: 'Nombre como se guarda|otra forma|otra forma' (las otras formas en
    // minusculas y sin tildes). Las de HERRAMIENTAS tienen nombres que no se
    // confunden con palabras comunes: se buscan tambien dentro de frases.
    const HERRAMIENTAS = [
        'Excel|microsoft excel|ms excel|excel avanzado', 'Word|microsoft word|ms word', 'PowerPoint|power point|microsoft powerpoint',
        'Outlook|microsoft outlook', 'Office|microsoft office|ms office|paquete office|paquete de office|ofimatica|herramientas ofimaticas|office 365|microsoft 365',
        'Google Workspace|g suite|gsuite|google drive|google docs|google sheets', 'Macros en Excel|macros|vba|excel vba', 'Power BI|powerbi', 'Tableau',
        'Photoshop|adobe photoshop', 'Illustrator|adobe illustrator', 'InDesign|adobe indesign', 'Premiere|adobe premiere|premiere pro',
        'After Effects|adobe after effects', 'Lightroom|adobe lightroom', 'Canva', 'Figma', 'CorelDRAW|corel draw|coreldraw|corel',
        'AutoCAD|autocad 2d|autocad 3d', 'Revit', 'SketchUp|sketch up', 'SAP', 'Siigo', 'World Office', 'Helisa', 'Opera PMS|opera pms',
        'Python', 'Java', 'JavaScript|js|java script', 'TypeScript|ts', 'HTML|html5', 'CSS|css3', 'React|react.js|reactjs', 'Angular',
        'Vue.js|vue|vuejs', 'Node.js|node|nodejs', 'Spring Boot|springboot|spring', 'Django', 'Flask', 'PHP', 'Laravel', 'C#|c sharp',
        '.NET|dotnet|.net core|asp.net', 'Kotlin', 'Swift', 'Flutter', 'Dart', 'C++|cpp', 'SQL', 'MySQL', 'PostgreSQL|postgres|postgre sql',
        'SQL Server|sql server|microsoft sql server', 'MongoDB|mongo|mongo db', 'Oracle|oracle database', 'Firebase', 'Git', 'GitHub|git hub',
        'GitLab', 'Docker', 'Kubernetes|k8s', 'AWS|amazon web services', 'Azure|microsoft azure', 'GCP|google cloud', 'Linux', 'Scrum', 'Jira',
        'WordPress|word press', 'Shopify', 'Android|android studio', 'Bootstrap', 'Tailwind CSS|tailwind', 'jQuery', 'Sass|scss',
        'REST API|api rest|apis rest|restful|servicios rest', 'GraphQL', 'CI/CD|ci cd', 'TDD'
    ];
    const OFICIOS = [
        'Atención al cliente|servicio al cliente|atencion y servicio al cliente|servicio y atencion al cliente|atencion a clientes|atencion al publico|servicio al publico',
        'Ventas|venta|tecnicas de venta|tecnicas de ventas|asesoria comercial', 'Manejo de caja|caja|caja registradora|manejo de caja registradora|cuadre de caja',
        'Trabajo en equipo|trabajar en equipo|capacidad de trabajo en equipo|capacidad para trabajar en equipo|trabajo colaborativo',
        'Comunicación|comunicacion efectiva|buena comunicacion|habilidades comunicativas|comunicacion oral y escrita', 'Comunicación asertiva',
        'Liderazgo', 'Trabajo bajo presión|trabajar bajo presion|manejo de la presion|tolerancia a la presion',
        'Resolución de problemas|solucion de problemas|resolver problemas|solucionar problemas', 'Resolución de conflictos|manejo de conflictos|solucion de conflictos',
        'Toma de decisiones|tomar decisiones', 'Negociación', 'Pensamiento crítico', 'Pensamiento analítico|capacidad analitica|analisis de datos',
        'Creatividad', 'Adaptabilidad|adaptacion al cambio|capacidad de adaptacion|flexibilidad', 'Gestión del tiempo|manejo del tiempo|administracion del tiempo',
        'Organización y planeación|organizacion|planificacion|planeacion|organizacion y planificacion', 'Aprendizaje rápido|facilidad de aprendizaje|capacidad de aprendizaje',
        'Atención al detalle|atencion a los detalles', 'Empatía',
        'Servicio de mesa|servicio a la mesa|atencion de mesas', 'Cocina|cocina nacional', 'Cocina internacional', 'Repostería|pasteleria|reposteria y pasteleria',
        'Panadería', 'Coctelería', 'Bartender|bartending', 'Barismo|barista', 'Manipulación de alimentos|curso de manipulacion de alimentos|buenas practicas de manufactura|bpm',
        'Recepción', 'Recepción hotelera', 'Reservas|manejo de reservas|reservaciones', 'Check-in y check-out|check in|check-in|check out|check-out|check in y check out',
        'Housekeeping|camareria', 'Hotelería', 'Turismo', 'Guía turístico|guianza turistica|guia turistica|guianza',
        'Facturación|facturacion electronica', 'Contabilidad', 'Archivo|gestion documental|manejo de archivo|archivo y correspondencia', 'Nómina|liquidacion de nomina',
        'Cartera|cobranza|gestion de cartera', 'Bodega e inventarios|inventarios|inventario|control de inventarios|manejo de inventarios|bodega|almacen|almacenamiento',
        'Logística', 'Compras', 'Call center|contact center|telemercadeo', 'Mercadeo|marketing', 'Marketing digital|mercadeo digital',
        'Redes sociales|manejo de redes sociales|gestion de redes sociales|community manager', 'Diseño gráfico', 'Fotografía', 'Edición de video|edicion de videos',
        'Gestión de proyectos|administracion de proyectos', 'Recursos humanos|talento humano|seleccion de personal', 'Comercio exterior|comercio internacional',
        'Operaciones portuarias|operacion portuaria', 'Conducción|manejo de vehiculos', 'Montacargas|operacion de montacargas|manejo de montacargas',
        'Electricidad|instalaciones electricas|electricidad residencial', 'Soldadura|soldadura mig|soldadura tig', 'Construcción|obra civil',
        'Mantenimiento|mantenimiento preventivo|mantenimiento correctivo|mantenimiento preventivo y correctivo', 'Plomería', 'Carpintería',
        'Refrigeración|aire acondicionado|refrigeracion y aire acondicionado', 'Mecánica automotriz', 'Seguridad y salud en el trabajo|sst|sg-sst|sg sst|seguridad industrial|hseq',
        'Trabajo en alturas|curso de alturas|curso de trabajo en alturas', 'Primeros auxilios', 'Enfermería', 'Aseo y limpieza|servicios generales|limpieza|aseo',
        'Vigilancia|seguridad privada', 'Peluquería', 'Manicure|manicura', 'Maquillaje'
    ].concat(['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'C3'].map(c => {
        const k = c.toLowerCase();
        return 'Licencia de conducción ' + c + '|licencia ' + k + '|licencia de conduccion ' + k + '|pase ' + k + '|licencia de conduccion categoria ' + k + '|licencia categoria ' + k;
    }));
    const IDIOMAS = ['Inglés|english', 'Francés', 'Portugués', 'Italiano', 'Alemán', 'Español|castellano', 'Mandarín|chino mandarin|chino'];

    const CATALOGO = new Map();      // forma plana -> { nombre, enTexto, idioma }
    [[HERRAMIENTAS, true], [OFICIOS, false], [IDIOMAS, false]].forEach(([grupo, herramienta]) => grupo.forEach(fila => {
        const [nombre, ...otras] = fila.split('|');
        [plano(nombre)].concat(otras).forEach(forma => {
            if (!CATALOGO.has(forma)) CATALOGO.set(forma, { nombre, idioma: grupo === IDIOMAS,
                // Dentro de una frase: las herramientas, y las formas de dos o mas palabras ("manejo de caja")
                enTexto: forma.length >= 3 && (herramienta || forma.includes(' ')) });
        });
    }));
    // Las formas largas primero: "sql server" antes que "sql"
    const FORMAS = [...CATALOGO.keys()].sort((a, b) => b.length - a.length);
    const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const BUSCADORES = new Map(FORMAS.map(f => [f, new RegExp('(^|[^a-z0-9+#.])' + escRe(f) + '(?=$|[^a-z0-9+#])', 'g')]));

    // Cualidades: dicen como es la persona, no lo que sabe hacer. Una empresa no las
    // busca como habilidad; van mejor en "Acerca de ti".
    const CUALIDAD = /^(persona |muy |soy )?(responsable|puntual|honest[oa]|proactiv[oa]|dinamic[oa]|organizad[oa]|ordenad[oa]|respetuos[oa]|amable|carismatic[oa]|comprometid[oa]|disciplinad[oa]|leal|sociable|paciente|perseverante|persistente|trabajador(a)?|emprendedor(a)?|creativ[oa]|colaborador(a)?|cordial|atent[oa]|servicial|recursiv[oa]|optimista|positiv[oa]|alegre|extrovertid[oa]|eficiente|eficaz|confiable|autodidacta|humilde|tolerante|amigable|educad[oa]|etica|responsabilidad|puntualidad|honestidad|respeto|compromiso|lealtad|disciplina|etica profesional|sentido de pertenencia|proactividad|iniciativa|motivacion|vocacion de servicio|(buena |excelente )?actitud( positiva| de servicio)?|(buena |excelente )?presentacion( personal)?|disponibilidad\b.*|ganas de aprender|deseos de superacion)$/;
    // Rotulos que agrupan habilidades ("Blandas:", "Lenguajes:"): no son habilidades
    const ROTULO = /^(habilidades|competencias|conocimientos|destrezas|aptitudes|herramientas|otras|otros|blandas|duras|tecnicas|personales|profesionales|interpersonales|informaticas|tecnologicas|digitales|software|programas|lenguajes( de programacion)?|frameworks|librerias|bases de datos|plataformas|ofimatica|idiomas|nivel|tecnologias)( (blandas|duras|tecnicas|personales|profesionales|informaticas|tecnologicas|digitales|de programacion|y destrezas|y competencias|laborales))*$/;
    const DEPARTAMENTOS = /^(bolivar|atlantico|sucre|cordoba|magdalena|cesar|la guajira|antioquia|valle( del cauca)?|santander|cundinamarca|colombia)$/;
    // Lo que se le quita adelante a una habilidad: "Manejo de", "Conocimientos en"...
    const RELLENO = /^(manejo|dominio|uso|conocimientos?( basicos| avanzados)?|nociones|experiencia|habilidad(es)?|capacidad|curso|operacion|herramientas?|programa|software|plataforma|buen|buena|excelente)( (de(l| la| las| los)?|en|para|con|sobre))? /;

    // Niveles, de la forma en que los escriben las hojas de vida
    const NIVEL_PALABRA = [
        [/^(basic[oa]|elemental|principiante|baj[oa]|a1|a2)$/, 'BASICO'],
        [/^(intermedi[oa]|medi[oa]|conversacional|b1|b2)$/, 'INTERMEDIO'],
        [/^(avanzad[oa]|alt[oa]|superior|c1)$/, 'AVANZADO'],
        [/^(expert[oa]|nativ[oa]|lengua materna|bilingue|c2)$/, 'EXPERTO']
    ];
    const nivelDePalabra = p => { const n = NIVEL_PALABRA.find(([re]) => re.test(p)); return n ? n[1] : ''; };
    const nivelDeFraccion = f => (f <= 0.4 ? 'BASICO' : f <= 0.6 ? 'INTERMEDIO' : f <= 0.85 ? 'AVANZADO' : 'EXPERTO');
    // Palabras de nivel que se pueden quitar del final o de un parentesis. "Alto", "medio" y
    // "bajo" solo con "nivel" delante o entre parentesis: "Trabajo bajo presión" no tiene nivel.
    const NIVEL_FUERTE = 'b[aá]sic[oa]|intermedi[oa]|avanzad[oa]|expert[oa]|nativ[oa]|biling[uü]e|elemental|principiante|conversacional|lengua materna';
    const NIVEL_DEBIL = 'alt[oa]|medi[oa]|baj[oa]|superior';
    const CEFR = /(?:^|[\s(,:-])([abc][12])(?=$|[\s),.])/i;

    /** Separa el nivel del nombre: "Excel (Avanzado)" -> { texto: "Excel", nivel: "AVANZADO" } */
    function quitarNivel(texto) {
        let t = ' ' + texto + ' ';
        let nivel = '';
        const tomar = n => { if (n && !nivel) nivel = n; return ' '; };
        // Puntos o estrellas: "●●●○○" (los convierte antes partirRenglon) o "4/5"
        t = t.replace(/\(?\s*nivel (\d+)\/(\d+)\s*\)?/gi, (x, a, b) => tomar(nivelDeFraccion(a / b)));
        t = t.replace(/\(?\s*(\d)\s*\/\s*(5|10)\s*\)?/g, (x, a, b) => tomar(nivelDeFraccion(a / b)));
        t = t.replace(/\(?\s*(\d{1,3})\s*%\s*\)?/g, (x, n) => tomar(nivelDeFraccion(Math.min(100, n) / 100)));
        // Entre parentesis: "(Avanzado)", "(nivel medio)"
        t = t.replace(new RegExp('\\(\\s*(?:nivel\\s+)?(' + NIVEL_FUERTE + '|' + NIVEL_DEBIL + ')\\s*\\)', 'gi'), (x, p) => tomar(nivelDePalabra(plano(p))));
        // Con "nivel" delante: "nivel alto"
        t = t.replace(new RegExp('[\\s:,-]+nivel\\s+(' + NIVEL_FUERTE + '|' + NIVEL_DEBIL + ')(?=\\s)', 'gi'), (x, p) => tomar(nivelDePalabra(plano(p))));
        // Al final o al principio: "Excel avanzado", "Avanzado en Excel"
        t = t.replace(new RegExp('[\\s:,-]+(' + NIVEL_FUERTE + ')\\s*$', 'i'), (x, p) => tomar(nivelDePalabra(plano(p))));
        t = t.replace(new RegExp('^\\s*(' + NIVEL_FUERTE + ')\\s+(en|de)\\s+', 'i'), (x, p) => tomar(nivelDePalabra(plano(p))));
        t = t.replace(/\(\s*\)/g, ' ').replace(/\s+/g, ' ').replace(/^[\s:,\-–|]+|[\s:,\-–|]+$/g, '');
        return { texto: t, nivel };
    }
    // Un pedazo que es solo un nivel: "Avanzado", "(B2)", "Intermedio (B2)", "80%", "nivel alto"
    const SOLO_NIVEL = new RegExp('^(?:[\\s(),:\\-–]*(?:nivel\\s*:?\\s*)?(?:' + plano(NIVEL_FUERTE + '|' + NIVEL_DEBIL).replace(/\[aa\]/g, 'a').replace(/\[uu\]/g, 'u') +
        '|[abc][12]|\\d{1,3}\\s*%|\\d\\s*/\\s*(?:5|10)|nivel \\d+/\\d+))+[\\s(),:\\-–]*$');
    const soloNivel = texto => SOLO_NIVEL.test(plano(texto));
    const CEFR_SOLO = /^[\s(]*[abc][12][\s)]*$/i;
    const PALABRA_NIVEL = { BASICO: 'básico', INTERMEDIO: 'intermedio', AVANZADO: 'avanzado', EXPERTO: 'experto' };
    /** El nivel de un pedazo que es solo nivel; el del Marco Europeo (B2) manda sobre la palabra */
    function nivelDeTexto(texto) {
        const p = plano(texto).replace(/[(),:]/g, ' ').replace(/\s+/g, ' ').trim();
        const c = p.match(/(?:^|\s)([abc][12])(?=$|\s)/);
        if (c) return nivelDePalabra(c[1]);
        return nivelDePalabra(p.replace(/^nivel\s*/, '')) || quitarNivel(' ' + texto + ' ').nivel;
    }

    const delCatalogo = p => CATALOGO.get(p) || CATALOGO.get(p.replace(RELLENO, '')) || CATALOGO.get(p.replace(/^(persona |muy )/, ''));

    /** "MANEJO DE INVENTARIOS" -> "Manejo de inventarios"; "repostería" -> "Repostería" */
    function presentable(texto) {
        let t = texto.trim();
        if (t.length > 4 && t === t.toUpperCase() && /[A-ZÁÉÍÓÚÑ]{3}/.test(t)) t = t.toLowerCase();
        return t.charAt(0).toUpperCase() + t.slice(1);
    }

    /** Las habilidades del catalogo que aparecen dentro de un texto. "todas": tambien las de una palabra */
    function buscarEnTexto(texto, todas) {
        let p = ' ' + plano(texto).replace(/[“”"«»]/g, ' ') + ' ';
        const halladas = [];
        FORMAS.forEach(forma => {
            const c = CATALOGO.get(forma);
            if (!c.enTexto && !(todas && forma.length >= 4 && !c.idioma)) return;
            const re = BUSCADORES.get(forma);
            re.lastIndex = 0;
            if (!re.test(p)) return;
            if (!halladas.includes(c.nombre)) halladas.push(c.nombre);
            re.lastIndex = 0;
            p = p.replace(re, (x, antes) => antes + ' '.repeat(forma.length)); // no la cuenta otra vez dentro de otra
        });
        return halladas;
    }

    /** Un pedazo ("Microsoft Excel (Avanzado)") -> que es: del catalogo, cualidad, frase, desconocida o nada */
    function clasificar(pedazo) {
        const original = pedazo.replace(/^[\s\-–*\d.)•·]+/, '').replace(/[.:;]+$/, '').trim();
        if (original.length < 2) return null;
        const { texto, nivel } = quitarNivel(original);
        const p = plano(texto).replace(/[“”"«»]/g, '').trim();
        if (!p) return null;
        let c = delCatalogo(p) || delCatalogo(p.replace(/[(),:]/g, ' ').replace(/\s+/g, ' ').trim());
        if (c) return { tipo: 'catalogo', nombre: c.nombre, nivel };
        // "Inglés B1": el B1 es nivel solo en un idioma ("Licencia B1" ya la reconocio el catalogo)
        const cefr = texto.match(CEFR);
        if (cefr) {
            c = delCatalogo(plano(texto.replace(cefr[1], ' ')).replace(/[(),:-]/g, ' ').replace(/\s+/g, ' ').trim());
            if (c && c.idioma) return { tipo: 'catalogo', nombre: c.nombre, nivel: nivelDePalabra(cefr[1].toLowerCase()) || nivel };
        }
        // Ruido: contacto, lugares, fechas, numeros, rotulos
        if (CORREO.test(texto) || /https?:|www\.|\.com\b/i.test(texto) || telefonoDe(texto) || /^[\d\s.,/%-]+$/.test(p)) return null;
        if (ciudadDe(texto) && p.split(' ').length <= 3) return null;
        if (DEPARTAMENTOS.test(p) || ROTULO.test(p) || fechasDe(texto).fechas.length && sinFechas(texto).length < 4) return null;
        if (p.replace(/[^a-z]/g, '').length < 2) return null;
        // Cualidades, solas o en pareja ("honesta y proactiva")
        const piezas = p.split(/\s*(?:,|\by\b|\be\b)\s*/).filter(Boolean);
        if (piezas.every(x => CUALIDAD.test(x))) return { tipo: 'cualidad', nombres: texto.split(/\s*(?:,|\by\b|\be\b)\s*/).filter(Boolean).map(presentable) };
        // "Word y Excel": si cada pieza es del catalogo, son varias
        if (piezas.length > 1 && piezas.every(x => delCatalogo(x))) return { tipo: 'varias', nombres: piezas.map(x => delCatalogo(x).nombre), nivel };
        const palabras = p.split(' ').length;
        if (palabras > 4 || original.length > 50 || /[.!?]/.test(original)) return { tipo: 'frase', texto: original };
        const sinRelleno = texto.replace(new RegExp('^\\s*(' + RELLENO.source.slice(1, -1) + ')\\s*', 'i'), '').trim();
        const nombre = presentable(plano(sinRelleno) && sinRelleno.length >= 2 ? sinRelleno : texto);
        return { tipo: 'desconocida', nombre: nombre.slice(0, MAXIMO_HABILIDAD), nivel };
    }

    /** Un renglon de la seccion -> pedazos: "Blandas: liderazgo, comunicación | Excel - Avanzado" */
    function partirRenglon(texto) {
        // Puntos o estrellas de nivel: "●●●○○" -> "(nivel 3/5)"
        let t = texto.replace(/[●◉★⬤■]+[○◯☆□]+|[●◉★⬤■]{2,}(?=\s*$)/g, m => {
            const llenos = (m.match(/[●◉★⬤■]/g) || []).length;
            return ' (nivel ' + llenos + '/' + m.length + ') ';
        });
        const pedazos = [];
        // "Inglés" + "B1" -> "Inglés (intermedio)"; "Licencia de conducción" + "B1" -> "Licencia de conducción B1"
        const conNivel = (base, s) => {
            const c = delCatalogo(plano(base));
            if (CEFR_SOLO.test(s) && !(c && c.idioma)) return base + ' ' + s.replace(/[()]/g, '').trim();
            const n = nivelDeTexto(s);
            return n ? base + ' (' + PALABRA_NIVEL[n] + ')' : base;
        };
        t.split(/\s*(?:[•·●▪■◦➢➤✓✔|;]|\s[-–]\s)\s*/).forEach(segmento => {
            if (!segmento.trim()) return;
            // "Excel - Avanzado" o "Excel | Avanzado": el nivel suelto va con lo de antes
            if (soloNivel(segmento) && pedazos.length) { pedazos[pedazos.length - 1] = conNivel(pedazos[pedazos.length - 1], segmento); return; }
            let s = segmento;
            // "Lenguajes: Java, Python" -> se quita el rotulo; "Español: Nativo" -> "Español (Nativo)"
            const dos = s.match(/^([^:]{2,40}):\s*(.+)$/);
            if (dos) {
                if (soloNivel(dos[2])) s = conNivel(dos[1], dos[2]);
                else if (!delCatalogo(plano(dos[1]))) s = dos[2];
                else s = dos[1] + ', ' + dos[2];
            }
            // "Herramientas ofimáticas (Word, Excel, Outlook)": lo de adentro tambien
            s = s.replace(/\(([^()]*(?:,|\sy\s)[^()]*)\)/g, ', $1');
            s.split(/\s*,\s*/).forEach(x => {
                if (!x.trim()) return;
                if (soloNivel(x) && pedazos.length) pedazos[pedazos.length - 1] = conNivel(pedazos[pedazos.length - 1], x);
                else pedazos.push(x);
            });
        });
        return pedazos;
    }

    /**
     * Las habilidades de las secciones "Habilidades" e "Idiomas".
     * Devuelve { habilidades: [{ nombre, nivel, revisa }], cualidades: [nombres] }
     */
    function habilidadesDe(lineas) {
        const habilidades = [];
        const cualidades = [];
        let ultima = null;
        const poner = (nombre, nivel, revisa) => {
            const igual = habilidades.find(h => plano(h.nombre) === plano(nombre));
            if (igual) { if (!igual.nivel && nivel) igual.nivel = nivel; if (!revisa) igual.revisa = false; ultima = igual; return; }
            ultima = { nombre: nombre.slice(0, MAXIMO_HABILIDAD), nivel: nivel || '', revisa: !!revisa };
            habilidades.push(ultima);
        };
        lineas.forEach(l => {
            // El nivel en el renglon de abajo ("Inglés" y debajo "B2"): es de la anterior
            if (soloNivel(l.texto)) { if (ultima && !ultima.nivel) ultima.nivel = nivelDeTexto(l.texto); ultima = null; return; }
            ultima = null;
            partirRenglon(l.texto).forEach(clasificarPedazo);
        });
        return { habilidades, cualidades };

        function clasificarPedazo(pedazo) {
            const c = clasificar(pedazo);
            if (!c) return;
            if (c.tipo === 'catalogo') poner(c.nombre, c.nivel, false);
            else if (c.tipo === 'varias') c.nombres.forEach(n => poner(n, c.nivel, false));
            else if (c.tipo === 'cualidad') c.nombres.forEach(n => { if (!cualidades.some(x => plano(x) === plano(n))) cualidades.push(n); });
            else if (c.tipo === 'frase') buscarEnTexto(c.texto, true).forEach(n => poner(n, '', false));
            else poner(c.nombre, c.nivel, true);
        }
    }

    /** Las del catalogo que se mencionan en la experiencia, los cursos o el perfil */
    function mencionadasEn(porSeccion, yaEstan) {
        const vistas = new Set(yaEstan.map(h => plano(h.nombre)));
        const salida = [];
        [['experiencia', 'tu experiencia'], ['cursos', 'tus cursos'], ['perfil', 'tu perfil'], ['otros', 'tus proyectos']].forEach(([s, donde]) => {
            const texto = (porSeccion[s] || []).map(l => l.texto).join('\n');
            buscarEnTexto(texto, s === 'cursos').forEach(nombre => {
                if (vistas.has(plano(nombre))) return;
                vistas.add(plano(nombre));
                salida.push({ nombre, donde });
            });
        });
        return salida;
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

        const halladas = habilidadesDe((porSeccion.habilidades || []).concat(porSeccion.idiomas || []));
        return {
            nombre, correo,
            telefono: telefono ? { valor: telefono, revisa: false } : null,
            ciudad: ciudad ? { valor: ciudad, revisa: false } : null,
            titular, bio,
            habilidades: halladas.habilidades,
            cualidades: halladas.cualidades,
            mencionadas: mencionadasEn(porSeccion, halladas.habilidades),
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
            const vacio = !hallado.telefono && !hallado.ciudad && !hallado.titular && !hallado.bio && !hallado.habilidades.length && !hallado.mencionadas.length && !hallado.estudios.length && !hallado.experiencias.length;
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

        // Las del catalogo que solo se mencionan en la experiencia, los cursos o el perfil
        const mencionadas = (h.mencionadas || []).filter(s => !yaTiene.has(plano(s.nombre)));
        const nombreNivel = k => (NIVELES.find(n => n[0] === k) || [, ''])[1];
        const chip = (s, marcada, titulo) => `
                    <label class="lector-chip${s.revisa ? ' revisa' : ''}"${titulo ? ` title="${esc(titulo)}"` : ''}><input type="checkbox" data-elegible data-habilidad="${esc(s.nombre)}"${s.nivel ? ` data-nivel-propio="${s.nivel}"` : ''}${marcada ? ' checked' : ''}><span>${esc(s.nombre)}</span>${s.nivel ? `<span class="lector-chip-nivel">${nombreNivel(s.nivel)}</span>` : ''}${s.revisa ? '<span class="lector-etiqueta">Revisa</span>' : ''}</label>`;
        const conNivel = nuevas.some(s => s.nivel);
        const desconocidas = nuevas.some(s => s.revisa);
        const cualidades = h.cualidades || [];
        const habilidades = nuevas.length || mencionadas.length || cualidades.length ? `
            <fieldset class="lector-grupo">
                <legend>${nuevas.length ? cuantas(nuevas.length, 'habilidad', 'habilidades') : 'Habilidades'}</legend>
                ${nuevas.length ? `<div class="lector-chips">${nuevas.map(s => chip(s, !s.revisa)).join('')}
                </div>
                ${desconocidas ? '<p class="lector-nota">Las que dicen «Revisa» no las reconocimos como habilidades: márcalas solo si lo son.</p>' : ''}` : ''}
                ${mencionadas.length ? `
                <p class="lector-subtitulo">También las mencionas en tu hoja de vida</p>
                <div class="lector-chips" data-mencionadas>${mencionadas.map(s => chip(s, false, 'Aparece en ' + s.donde)).join('')}
                </div>
                <p class="lector-nota">Aparecen en ${esc(lista([...new Set(mencionadas.map(s => s.donde))]))}, no en tus habilidades: márcalas si las dominas.</p>` : ''}
                ${nuevas.length || mencionadas.length ? `
                <label class="lector-nivel">${conNivel ? 'Nivel para las que no lo dicen' : 'Nivel para estas habilidades'}
                    <select data-nivel>${NIVELES.map(([k, t]) => `<option value="${k}"${k === 'INTERMEDIO' ? ' selected' : ''}>${t}</option>`).join('')}</select>
                </label>
                <p class="lector-nota">${conNivel ? 'Las que traen su nivel en tu hoja de vida lo conservan. ' : ''}Después puedes cambiar el nivel de cada una en tu perfil.${repetidas.length ? ' Ya tienes ' + esc(lista(repetidas.map(s => s.nombre))) + ': no se repiten.' : ''}</p>` : ''}
                ${cualidades.length ? `<p class="lector-nota" data-cualidades>No agregamos ${esc(lista(cualidades.map(c => '«' + c + '»')))}: son cualidades tuyas, no habilidades que una empresa busque. Cuéntalas en «Acerca de ti».</p>` : ''}
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
            !h.habilidades.length && h.mencionadas.length && cuantas(h.mencionadas.length, 'habilidad mencionada', 'habilidades mencionadas'),
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
        // Cada una con el nivel que traia la hoja de vida; si no traia, el elegido
        const habilidades = [...form.querySelectorAll('[data-habilidad]:checked')].map(c => ({ nombre: c.dataset.habilidad, nivel: c.dataset.nivelPropio || nivel }));
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
        habilidades.forEach(s => tareas.push({ grupo: 'habilidad', hacer: () => enviar(base + '/skills', 'POST', { name: s.nombre, level: s.nivel }) }));
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
