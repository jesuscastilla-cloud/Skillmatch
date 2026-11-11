/* =====================================================================
 *  SkillMatch - Modelo predictivo en el navegador
 *
 *  Lee lo que aprendio el modelo: primero GET /api/public/modelo (el servidor
 *  vuelve a aprender cada noche) y, si el servidor no responde o todavia no
 *  tiene el endpoint, assets/data/modelo-predictivo.json (lo genera
 *  2-modelo/entrenar_modelo.py). Con eso responde, para una postulacion: posibilidades buenas, regulares o bajas,
 *  el camino recorrido en el arbol y un consejo.
 *
 *  Lo usan:
 *   - como-aprende.js (la seccion "Pruebalo")
 *   - el recuadro de cada postulacion en "Mis postulaciones" (profile.js)
 *
 *  Las caracteristicas se calculan IGUAL que en 1-datos/caracteristicas.py.
 *  Si cambia una, hay que cambiar las dos.
 *
 *  Nunca muestra un porcentaje a la persona (ver "Cuidados" en el PDF):
 *  solo "buenas", "regulares" o "bajas".
 * ===================================================================== */
(function () {
    'use strict';

    const RUTA_JSON = '../assets/data/modelo-predictivo.json';
    const NIVELES = { BASICO: 1, INTERMEDIO: 2, AVANZADO: 3, EXPERTO: 4 };
    const ANOS_QUE_PIDE = { 'sin-experiencia': 0, junior: 0, 'semi-senior': 1, senior: 3 };
    const ACCIONABLES = ['pct_habilidades', 'nivel_dominio', 'anos_experiencia', 'alcanza_experiencia',
        'num_estudios', 'perfil_completo', 'tiene_carta', 'palabras_carta'];

    let modelo = null;
    let pidiendo = null;

    function pedirJson(url) {
        return fetch(url, { cache: 'no-cache' })
            .then(r => { if (!r.ok) throw new Error('Sin modelo (' + r.status + ')'); return r.json(); })
            .then(m => { if (!m || !m.datos) throw new Error('Respuesta sin modelo'); return m; });
    }

    /**
     * Carga el modelo una sola vez (las siguientes llamadas reutilizan la misma promesa).
     * Sin ruta: primero el servidor y, si falla, el archivo guardado.
     */
    function cargar(ruta) {
        if (modelo) return Promise.resolve(modelo);
        if (!pidiendo) {
            const servidor = typeof API_BASE_URL === 'string' && !ruta ? API_BASE_URL + '/public/modelo' : null;
            pidiendo = (servidor ? pedirJson(servidor).catch(() => pedirJson(RUTA_JSON)) : pedirJson(ruta || RUTA_JSON))
                .then(m => { modelo = m; return m; })
                .catch(e => { pidiendo = null; throw e; });
        }
        return pidiendo;
    }

    const texto = x => String(x == null ? '' : x).trim();
    const sinTildes = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

    function anosDeExperiencia(experiencias, hoy) {
        hoy = hoy || new Date();
        let dias = 0;
        (experiencias || []).forEach(e => {
            if (!e.startDate) return;
            const inicio = new Date(e.startDate);
            const fin = e.isCurrent || !e.endDate ? hoy : new Date(e.endDate);
            dias += Math.max(0, Math.floor((fin - inicio) / 86400000));
        });
        return Math.round(dias / 365 * 10) / 10;
    }

    function perfilCompleto(u) {
        const puntos = [
            !!(u.firstName && u.lastName && u.email), !!u.phone,
            !!(u.skills && u.skills.length), !!(u.experiences && u.experiences.length),
            !!(u.educations && u.educations.length)
        ];
        return Math.round(100 * puntos.filter(Boolean).length / puntos.length);
    }

    /**
     * Las caracteristicas de una postulacion (mismas columnas que la tabla de Python).
     * usuario: { firstName, lastName, email, phone, location, skills[{name, level}], experiences[], educations[] }
     * vacante: { skills[], experienceLevel, location, modality, type, postedDate }
     * extra:   { carta, fechaPostulacion, postulantes }
     */
    function caracteristicasDe(usuario, vacante, extra) {
        usuario = usuario || {}; vacante = vacante || {}; extra = extra || {};
        const pedidas = new Set((vacante.skills || []).map(h => texto(h).toLowerCase()).filter(Boolean));
        const suyas = new Map();
        (usuario.skills || []).forEach(h => {
            const n = texto(h.name).toLowerCase();
            if (n) suyas.set(n, NIVELES[sinTildes(texto(h.level))] || 1);
        });
        const coinciden = [...pedidas].filter(h => suyas.has(h)).map(h => suyas.get(h));
        const anos = anosDeExperiencia(usuario.experiences);
        const carta = texto(extra.carta);
        const palabras = carta ? carta.split(/\s+/).length : 0;
        const cu = texto(usuario.location).toLowerCase();
        const cv = texto(vacante.location).toLowerCase();
        const remota = texto(vacante.modality).toLowerCase() === 'remoto';
        const publicada = vacante.postedDate ? new Date(vacante.postedDate) : null;
        const postulo = extra.fechaPostulacion ? new Date(extra.fechaPostulacion) : new Date();
        const tipo = texto(vacante.type).toLowerCase();
        return {
            pct_habilidades: pedidas.size ? Math.round(100 * coinciden.length / pedidas.size) : 0,
            nivel_dominio: coinciden.length ? Math.round(coinciden.reduce((a, b) => a + b, 0) / coinciden.length * 100) / 100 : 0,
            anos_experiencia: anos,
            alcanza_experiencia: anos >= (ANOS_QUE_PIDE[texto(vacante.experienceLevel)] || 0) ? 1 : 0,
            num_estudios: (usuario.educations || []).length,
            perfil_completo: perfilCompleto(usuario),
            tiene_carta: palabras > 0 ? 1 : 0,
            palabras_carta: palabras,
            misma_ciudad: remota || (cu && cv && (cu.includes(cv) || cv.includes(cu))) ? 1 : 0,
            tipo_empleo: tipo === 'empleo' ? 1 : 0,
            tipo_practica: tipo === 'práctica' || tipo === 'practica' ? 1 : 0,
            tipo_freelance: tipo === 'freelance' || tipo === 'independiente' ? 1 : 0,
            dias_para_postularse: publicada ? Math.max(0, Math.floor((postulo - publicada) / 86400000)) : 0,
            postulantes_vacante: Number(extra.postulantes) || 0,
            // Para el consejo: las habilidades que pide y no tiene
            _faltan: (vacante.skills || []).filter((h, i, a) => a.indexOf(h) === i && !suyas.has(texto(h).toLowerCase()))
        };
    }

    function posibilidad(m, p) {
        return p >= m.niveles.buenas ? 'buenas' : (p >= m.niveles.regulares ? 'regulares' : 'bajas');
    }

    /** Recorre el arbol desde arriba. Devuelve la hoja y el camino (con la respuesta en cada pregunta). */
    function recorrer(m, x) {
        const nodos = m.arbol;
        let nodo = nodos[0];
        const camino = [];
        while (!nodo.hoja) {
            const si = Number(x[nodo.variable]) > nodo.umbral;   // igual que scikit-learn: <= va a "no"
            camino.push({ nodo: nodo, si: si });
            nodo = nodos[si ? nodo.si : nodo.no];
        }
        return { hoja: nodo, camino: camino };
    }

    /** Probabilidad de la regresion logistica (por si gana por F1). */
    function probLogistica(m, x) {
        const L = m.logistica;
        let z = L.intercepto;
        L.variables.forEach((v, i) => { z += L.coef[i] * ((Number(x[v]) || 0) - L.media[i]) / (L.escala[i] || 1); });
        return 1 / (1 + Math.exp(-z));
    }

    /**
     * El consejo sale del camino recorrido: la pregunta (de algo que la persona puede mejorar)
     * donde tomo la rama con menos aceptadas. "Suelen ser aceptadas mas", nunca "hace que te acepten".
     */
    function consejoDe(m, recorrido, x) {
        let mejor = null;
        recorrido.camino.forEach(paso => {
            const n = paso.nodo;
            if (!ACCIONABLES.includes(n.variable)) return;
            const tomada = m.arbol[paso.si ? n.si : n.no];
            const otra = m.arbol[paso.si ? n.no : n.si];
            const diferencia = otra.prob - tomada.prob;
            if (diferencia > 0.05 && (!mejor || diferencia > mejor.diferencia)) {
                mejor = { diferencia: diferencia, frase: paso.si ? n.frase_no : n.frase_si, variable: n.variable };
            }
        });
        if (!mejor) return '';
        let consejo = 'Las postulaciones que ' + mejor.frase + ' suelen ser aceptadas más.';
        if (mejor.variable === 'pct_habilidades' && x._faltan && x._faltan.length) {
            consejo += ' Te falta: ' + x._faltan.slice(0, 3).join(', ') + '.';
        }
        return consejo;
    }

    /**
     * Evalua una postulacion. Devuelve:
     *  { estado: 'esperando' | 'listo', posibilidad, consejo, camino, hoja, dar_consejos }
     */
    function evaluar(x, m) {
        m = m || modelo;
        if (!m || m.estado !== 'listo') return { estado: 'esperando', faltan: m ? m.datos.faltan : null };
        const r = recorrer(m, x);
        const p = m.examen.ganador === 'logistica' ? probLogistica(m, x) : r.hoja.prob;
        return {
            estado: 'listo',
            posibilidad: posibilidad(m, p),
            consejo: m.dar_consejos ? consejoDe(m, r, x) : '',
            dar_consejos: m.dar_consejos,
            camino: r.camino,
            hoja: r.hoja,
            demostracion: !!m.demostracion
        };
    }

    const escapar = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    /**
     * El recuadro de una postulacion (solo lo ve la persona, nunca la empresa).
     * Si el modelo no le gana al "modelo flojo", no se muestran posibilidades: serian ruido.
     * opciones.mostrarSiempre (solo para "Pruebalo"): las muestra igual, con la advertencia.
     */
    function recuadroHtml(resultado, opciones) {
        opciones = opciones || {};
        if (resultado && resultado.estado === 'listo' && !resultado.dar_consejos && !opciones.mostrarSiempre) {
            return '<div class="mp-recuadro mp-esperando" role="note"><i data-ico="sprout"></i><div>' +
                '<p class="mp-recuadro-titulo">Todavía no podemos estimar tus posibilidades' +
                (resultado.demostracion ? ' <span class="mp-etiqueta">Demostración</span>' : '') + '</p>' +
                '<p>Con las respuestas de hoy el modelo no acierta más que adivinar. Mientras más respondan las empresas, mejor aprende.</p>' +
                '<p class="mp-recuadro-nota"><a href="como-aprende.html">Cómo aprende SkillMatch</a></p></div></div>';
        }
        if (!resultado || resultado.estado !== 'listo') {
            return '<div class="mp-recuadro mp-esperando" role="note"><i data-ico="sprout"></i><div><p class="mp-recuadro-titulo">SkillMatch está aprendiendo</p>' +
                '<p>Todavía está juntando respuestas de las empresas. <a href="como-aprende.html">Cómo aprende</a></p></div></div>';
        }
        const titulos = { buenas: 'Tus posibilidades son buenas', regulares: 'Tus posibilidades son regulares', bajas: 'Tus posibilidades son bajas' };
        const iconos = { buenas: 'trending', regulares: 'target', bajas: 'bulb' };
        const consejo = resultado.dar_consejos
            ? (resultado.consejo ? escapar(resultado.consejo) : 'Tu postulación va por el camino de las que suelen ser aceptadas.')
            : 'Ojo: con los datos de hoy el modelo todavía no acierta más que adivinar, así que esto no es confiable y no damos consejos.';
        return '<div class="mp-recuadro mp-' + resultado.posibilidad + '" role="note">' +
            '<i data-ico="' + iconos[resultado.posibilidad] + '"></i>' +
            '<div><p class="mp-recuadro-titulo">' + titulos[resultado.posibilidad] +
            (resultado.demostracion ? ' <span class="mp-etiqueta">Demostración</span>' : '') + '</p>' +
            '<p>' + consejo + '</p>' +
            '<p class="mp-recuadro-nota">Es una estimación, no una promesa. La empresa decide y no ve esto. <a href="como-aprende.html">Cómo aprende SkillMatch</a></p></div></div>';
    }

    window.SkillMatchModelo = { cargar, caracteristicasDe, evaluar, recorrer, recuadroHtml, get modelo() { return modelo; } };
})();
