/* =====================================================================
 *  SkillMatch — editor de imagenes (foto de perfil y portada)
 *
 *  Sin librerias y sin subir nada a terceros: la foto se lee en el
 *  navegador, se valida (tipo, peso y pixeles minimos), la persona la
 *  encuadra arrastrando y con zoom, y sale reducida y comprimida como
 *  texto (data URL) que el backend guarda en el mismo campo de siempre.
 *
 *  Tambien trae la galeria de portadas de SkillMatch (assets/img/portadas).
 *  Uso: SkillMatchImagen.editor(contenedor, opciones)
 *       SkillMatchImagen.galeria(contenedor, opciones)
 *       SkillMatchImagen.rutaPortada(valorGuardado)
 * ===================================================================== */

(function () {
    'use strict';

    const MAX_MB = 10;

    // data URL en vez de blob: (la CSP del sitio publicado no permite blob:)
    function leerComoDataUrl(file) {
        return new Promise((ok, falla) => {
            const lector = new FileReader();
            lector.onload = () => ok(lector.result);
            lector.onerror = () => falla(lector.error);
            lector.readAsDataURL(file);
        });
    }
    // Carpeta de imagenes, sacada de donde esta este archivo (sirve en local y en Render)
    const RUTA_IMG = ((document.currentScript && document.currentScript.src) || '')
        .replace(/js\/[^/]*$/, 'img/');

    const icono = (n, c) => (window.SkillMatchUI ? SkillMatchUI.icono(n, c) : '');
    const miles = n => n.toLocaleString('es-CO');

    /* ---------- Galeria de portadas ---------- */

    // "marca" es la portada de siempre (la del CSS): no tiene archivo
    const GALERIA = [
        { id: 'marca',     nombre: 'SkillMatch' },
        { id: 'caribe',    nombre: 'Mar Caribe' },
        { id: 'atardecer', nombre: 'Atardecer en la bahía' },
        { id: 'murallas',  nombre: 'Murallas' },
        { id: 'getsemani', nombre: 'Getsemaní' },
        { id: 'red',       nombre: 'Red de talento' },
        { id: 'relieve',   nombre: 'Relieve' },
        { id: 'aurora',    nombre: 'Aurora' },
        { id: 'plano',     nombre: 'Plano técnico' }
    ];
    const PREFIJO = 'galeria:';

    /** Convierte lo guardado en coverImageUrl en algo que se pueda pintar.
     *  "galeria:caribe" -> ruta del SVG; "galeria:marca" o vacio -> null
     *  (se queda la portada del CSS); una URL o data URL se usa tal cual. */
    function rutaPortada(valor) {
        if (!valor) return null;
        if (valor.indexOf(PREFIJO) === 0) {
            const id = valor.slice(PREFIJO.length);
            const item = GALERIA.find(g => g.id === id);
            return item && item.id !== 'marca' ? RUTA_IMG + 'portadas/' + item.id + '.svg' : null;
        }
        return valor;
    }

    /** Dibuja la galeria como un grupo de opciones (una sola elegida). */
    function galeria(contenedor, op) {
        op = op || {};
        let elegido = op.actual && op.actual.indexOf(PREFIJO) === 0 ? op.actual.slice(PREFIJO.length) : null;

        contenedor.classList.add('galeria-portadas');
        contenedor.setAttribute('role', 'radiogroup');
        contenedor.setAttribute('aria-label', 'Portadas de SkillMatch');
        contenedor.innerHTML = GALERIA.map(g =>
            '<button type="button" class="galeria-item" role="radio" data-id="' + g.id + '" aria-checked="false">' +
                '<span class="galeria-miniatura' + (g.id === 'marca' ? ' es-marca' : '') + '"' +
                    (g.id === 'marca' ? '' : ' style="background-image:url(\'' + RUTA_IMG + 'portadas/' + g.id + '.svg\')"') + '>' +
                    '<span class="galeria-check">' + icono('check') + '</span>' +
                '</span>' +
                '<span class="galeria-nombre">' + g.nombre + '</span>' +
            '</button>'
        ).join('');

        const botones = Array.from(contenedor.querySelectorAll('.galeria-item'));
        function marcar(id, avisar) {
            elegido = id;
            botones.forEach(b => {
                const si = b.dataset.id === id;
                b.setAttribute('aria-checked', String(si));
                // Solo la elegida (o la primera) entra con Tab; las flechas mueven entre ellas
                b.tabIndex = si || (!id && b === botones[0]) ? 0 : -1;
            });
            if (avisar && op.alElegir) op.alElegir(PREFIJO + id);
        }
        botones.forEach((b, i) => {
            b.addEventListener('click', () => marcar(b.dataset.id, true));
            b.addEventListener('keydown', e => {
                const mover = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
                if (!mover) return;
                e.preventDefault();
                const sig = botones[(i + mover + botones.length) % botones.length];
                sig.focus();
                marcar(sig.dataset.id, true);
            });
        });
        marcar(elegido, false);

        return {
            valor: () => (elegido ? PREFIJO + elegido : null),
            marcar: id => marcar(id, false)
        };
    }

    /* ---------- Editor: subir, validar y encuadrar ---------- */

    /**
     * opciones:
     *   aspecto: [ancho, alto]   proporcion del encuadre (1:1 foto, 4:1 portada)
     *   minimo:  [ancho, alto]   pixeles minimos de la foto original
     *   salida:  [ancho, alto]   tamano de la imagen que se guarda
     *   redondo: true            mascara circular (foto de perfil)
     *   nombre:  'la foto'       para los mensajes
     *   alCambiar(listo)         avisa si ya hay una imagen lista para guardar
     */
    function editor(contenedor, op) {
        const minimo = op.minimo, salida = op.salida, aspecto = op.aspecto;
        const nombre = op.nombre || 'la imagen';
        const formatos = 'JPG, PNG o WebP · mínimo ' + miles(minimo[0]) + ' × ' + miles(minimo[1]) +
                         ' px · hasta ' + MAX_MB + ' MB';

        contenedor.classList.add('editor-imagen');
        contenedor.innerHTML =
            '<label class="editor-soltar">' +
                // image/*: el iPhone entrega la foto convertida a JPG
                '<input type="file" class="editor-archivo" accept="image/*">' +
                '<span class="editor-soltar-icono">' + icono('upload') + '</span>' +
                '<strong>Arrastra tu imagen aquí</strong>' +
                '<span>o <span class="editor-enlace">elige un archivo</span> de tu equipo</span>' +
                '<small>' + formatos + '</small>' +
            '</label>' +
            '<div class="editor-encuadre" hidden>' +
                '<div class="editor-marco' + (op.redondo ? ' es-redondo' : '') + '" tabindex="0" ' +
                     'style="aspect-ratio:' + aspecto[0] + ' / ' + aspecto[1] + '" ' +
                     'aria-label="Encuadre de ' + nombre + '. Arrastra o usa las flechas para moverla; + y - para acercar.">' +
                    '<img class="editor-img" alt="" draggable="false">' +
                    '<span class="editor-mascara" aria-hidden="true"></span>' +
                '</div>' +
                '<div class="editor-controles">' +
                    '<span class="editor-zoom-ico" aria-hidden="true">' + icono('minus') + '</span>' +
                    '<input type="range" class="editor-zoom" min="1" max="3" step="0.01" value="1" aria-label="Acercar o alejar">' +
                    '<span class="editor-zoom-ico" aria-hidden="true">' + icono('plus') + '</span>' +
                    '<button type="button" class="btn btn-secondary btn-small editor-otra">' + icono('refresh') + ' Elegir otra</button>' +
                '</div>' +
                '<p class="editor-ayuda">' + icono('image') + ' <span>Arrastra para encuadrar. Se guardará a ' +
                    miles(salida[0]) + ' × ' + miles(salida[1]) + ' px.</span></p>' +
            '</div>' +
            '<p class="editor-error" role="alert" hidden></p>';

        const q = s => contenedor.querySelector(s);
        const archivo = q('.editor-archivo'), soltar = q('.editor-soltar'), encuadre = q('.editor-encuadre');
        const marco = q('.editor-marco'), img = q('.editor-img'), zoom = q('.editor-zoom'), error = q('.editor-error');

        // Estado: tamano real de la foto, centro del encuadre (en pixeles de
        // la foto) y zoom. Asi el encuadre sobrevive a cambios de tamano.
        let foto = null, cx = 0, cy = 0, z = 1, zMax = 3;

        function mostrarError(texto) {
            error.innerHTML = texto ? icono('alert') + ' <span>' + texto + '</span>' : '';
            error.hidden = !texto;
        }

        function avisar() { if (op.alCambiar) op.alCambiar(!!foto); }

        // Escala que llena el marco sin dejar huecos, y la actual con zoom
        function escalas() {
            const W = marco.clientWidth, H = marco.clientHeight;
            const s0 = Math.max(W / foto.w, H / foto.h);
            return { W, H, s0, s: s0 * z };
        }

        function limitar() {
            const { W, H, s } = escalas();
            const medioW = W / 2 / s, medioH = H / 2 / s;
            cx = Math.min(Math.max(cx, medioW), foto.w - medioW);
            cy = Math.min(Math.max(cy, medioH), foto.h - medioH);
        }

        // Solo transform: la foto se mueve y se escala, nada mas cambia
        function pintar() {
            if (!foto) return;
            limitar();
            const { W, H, s } = escalas();
            img.style.transform = 'translate(' + (W / 2 - cx * s) + 'px,' + (H / 2 - cy * s) + 'px) scale(' + s + ')';
        }

        function ponerZoom(nuevo) {
            z = Math.min(Math.max(nuevo, 1), zMax);
            zoom.value = z;
            pintar();
        }

        async function cargar(file) {
            mostrarError('');
            if (!file) return;
            // Antes solo pasaban los tipos de TIPOS: algunos celulares entregan la
            // foto sin tipo o como HEIC/HEIF (iPhone, algunos Samsung) y se
            // rechazaba aunque el navegador la pudiera abrir. Ahora se intenta
            // abrir cualquier imagen; al guardar sale en WebP o JPEG igual.
            if (file.type && file.type.indexOf('image/') !== 0) {
                mostrarError('Ese archivo no es una imagen. Sube una foto en JPG, PNG o WebP.');
                return;
            }
            if (file.size > MAX_MB * 1024 * 1024) {
                mostrarError('La imagen pesa ' + (file.size / 1048576).toFixed(1).replace('.', ',') +
                             ' MB y el máximo es ' + MAX_MB + ' MB. Prueba con una versión más liviana.');
                return;
            }
            // La foto se lee como data URL y no como blob: la politica de
            // seguridad del sitio publicado (CSP "img-src 'self' data: https:",
            // SecurityConfig.java) bloquea las imagenes blob: y en Render ninguna
            // foto abria ("No pudimos abrir esa imagen"). En local no pasaba
            // porque Live Server no manda esa politica.
            let url = '';
            const prueba = new Image();
            try {
                url = await leerComoDataUrl(file);
                prueba.src = url;
                await prueba.decode();
            } catch (e) {
                // HEIC: Safari la abre, pero Chrome y Edge en Windows o Android no
                const heic = /hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name || '');
                mostrarError(heic
                    ? 'Esa foto está en formato HEIC (el de los iPhone) y este navegador no la puede abrir. Conviértela a JPG o, en el iPhone, activa Ajustes > Cámara > Formatos > "Más compatible".'
                    : 'No pudimos abrir esa imagen. Puede estar dañada o en un formato que este navegador no lee; prueba con una foto en JPG o PNG.');
                return;
            }
            const w = prueba.naturalWidth, h = prueba.naturalHeight;
            // La restriccion de pixeles: con menos se veria borrosa al estirarse
            if (w < minimo[0] || h < minimo[1]) {
                mostrarError('Tu imagen mide ' + miles(w) + ' × ' + miles(h) + ' px. Para ' + nombre +
                             ' necesitamos al menos ' + miles(minimo[0]) + ' × ' + miles(minimo[1]) +
                             ' px, para que no se vea borrosa.');
                return;
            }
            foto = { w, h };
            img.src = url;
            img.width = w;
            img.height = h;
            soltar.hidden = true;
            encuadre.hidden = false;
            // El zoom maximo no deja recortar por debajo del minimo de pixeles
            const marcoW = marco.clientWidth || 1, marcoH = marco.clientHeight || 1;
            const s0 = Math.max(marcoW / w, marcoH / h);
            zMax = Math.max(1, Math.min(4, marcoW / (s0 * minimo[0]), marcoH / (s0 * minimo[1])));
            zoom.max = zMax.toFixed(2);
            zoom.disabled = zMax <= 1.01;
            cx = w / 2;
            cy = h / 2;
            ponerZoom(1);
            avisar();
            marco.focus({ preventScroll: true });
        }

        function reiniciar() {
            foto = null;
            img.removeAttribute('src');
            archivo.value = '';
            soltar.hidden = false;
            encuadre.hidden = true;
            mostrarError('');
            avisar();
        }

        /* Archivo: elegir, o arrastrar y soltar */
        archivo.addEventListener('change', () => cargar(archivo.files[0]));
        ['dragenter', 'dragover'].forEach(t => soltar.addEventListener(t, e => {
            e.preventDefault();
            soltar.classList.add('is-encima');
        }));
        ['dragleave', 'drop'].forEach(t => soltar.addEventListener(t, () => soltar.classList.remove('is-encima')));
        soltar.addEventListener('drop', e => {
            e.preventDefault();
            cargar(e.dataTransfer.files[0]);
        });
        q('.editor-otra').addEventListener('click', () => { reiniciar(); archivo.click(); });

        /* Encuadre: arrastrar con mouse o dedo; pellizcar para zoom */
        const punteros = new Map();
        let distanciaInicial = 0, zoomInicial = 1;
        marco.addEventListener('pointerdown', e => {
            if (!foto) return;
            marco.setPointerCapture(e.pointerId);
            punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (punteros.size === 2) {
                const [a, b] = Array.from(punteros.values());
                distanciaInicial = Math.hypot(a.x - b.x, a.y - b.y);
                zoomInicial = z;
            }
            marco.classList.add('is-arrastrando');
        });
        marco.addEventListener('pointermove', e => {
            const antes = punteros.get(e.pointerId);
            if (!antes || !foto) return;
            punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (punteros.size === 2) {
                const [a, b] = Array.from(punteros.values());
                if (distanciaInicial) ponerZoom(zoomInicial * Math.hypot(a.x - b.x, a.y - b.y) / distanciaInicial);
                return;
            }
            const { s } = escalas();
            cx -= (e.clientX - antes.x) / s;
            cy -= (e.clientY - antes.y) / s;
            pintar();
        });
        const soltarPuntero = e => {
            punteros.delete(e.pointerId);
            if (!punteros.size) marco.classList.remove('is-arrastrando');
        };
        marco.addEventListener('pointerup', soltarPuntero);
        marco.addEventListener('pointercancel', soltarPuntero);
        marco.addEventListener('wheel', e => {
            if (!foto) return;
            e.preventDefault();
            ponerZoom(z * (e.deltaY < 0 ? 1.08 : 1 / 1.08));
        }, { passive: false });
        marco.addEventListener('keydown', e => {
            if (!foto) return;
            const { s } = escalas();
            const paso = 12 / s;
            const mov = { ArrowLeft: [-paso, 0], ArrowRight: [paso, 0], ArrowUp: [0, -paso], ArrowDown: [0, paso] }[e.key];
            if (mov) { e.preventDefault(); cx += mov[0]; cy += mov[1]; pintar(); return; }
            if (e.key === '+' || e.key === '=') { e.preventDefault(); ponerZoom(z * 1.1); }
            if (e.key === '-') { e.preventDefault(); ponerZoom(z / 1.1); }
        });
        zoom.addEventListener('input', () => ponerZoom(parseFloat(zoom.value)));
        // Si el marco cambia de tamano (girar el celular), el encuadre se mantiene
        if ('ResizeObserver' in window) new ResizeObserver(pintar).observe(marco);

        /** Recorta lo que se ve en el marco, lo reduce al tamano de salida y lo
         *  comprime. Devuelve una data URL (WebP si el navegador puede, si no JPEG). */
        async function exportar() {
            if (!foto) throw new Error('No hay imagen');
            limitar();
            const { W, H, s } = escalas();
            const sw = W / s, sh = H / s;
            const sx = cx - sw / 2, sy = cy - sh / 2;
            const lienzo = document.createElement('canvas');
            lienzo.width = salida[0];
            lienzo.height = salida[1];
            const ctx = lienzo.getContext('2d');
            ctx.fillStyle = '#FFFFFF'; // las PNG transparentes quedan sobre blanco, no sobre negro
            ctx.fillRect(0, 0, salida[0], salida[1]);
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, sx, sy, sw, sh, 0, 0, salida[0], salida[1]);

            const comoBlob = (tipo, calidad) => new Promise(ok => lienzo.toBlob(ok, tipo, calidad));
            // Calidad alta primero; si pesa mas de la cuenta, se baja un poco
            const limite = op.maxKB ? op.maxKB * 1024 : 300 * 1024;
            let blob = null;
            for (const calidad of [0.86, 0.78, 0.68]) {
                blob = await comoBlob('image/webp', calidad);
                if (!blob || blob.type !== 'image/webp') blob = await comoBlob('image/jpeg', calidad);
                if (blob.size <= limite) break;
            }
            return new Promise((ok, falla) => {
                const lector = new FileReader();
                lector.onload = () => ok(lector.result);
                lector.onerror = falla;
                lector.readAsDataURL(blob);
            });
        }

        return { listo: () => !!foto, exportar, reiniciar, error: mostrarError };
    }

    window.SkillMatchImagen = { editor, galeria, rutaPortada, GALERIA };
})();
