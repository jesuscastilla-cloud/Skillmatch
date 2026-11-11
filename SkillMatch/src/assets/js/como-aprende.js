// Como aprende SkillMatch (como-aprende.html)
//
// Dibuja las 9 partes de la pagina con lo que aprendio el modelo. Lo pide
// SkillMatchModelo.cargar(): primero GET /api/public/modelo (el servidor aprende
// cada noche) y, si no responde, assets/data/modelo-predictivo.json (el script de Python).
//
// Todo lo que se muestra son cifras de todas las postulaciones juntas, nunca de una persona.

(function () {
    'use strict';

    const $ = id => document.getElementById(id);
    const escapar = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const coma = (n, d) => Number(n).toLocaleString('es-CO', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
    const deDiez = p => coma(p * 10, 1).replace(',0', '');   // 0,62 -> "6,2" (de cada 10)

    const TERMINOS = {
        arbol: 'Árbol de decisión (CART): una serie de preguntas de sí o no. Tiene máximo 4 niveles y cada color reúne al menos 5 postulaciones, para que no se aprenda los ejemplos de memoria.',
        cv: 'Validación cruzada de 5 pliegues: se parten las postulaciones en 5 grupos; cada vez se estudia con 4 y se examina con el que falta. Así cada postulación sale una vez en el examen.',
        flojo: 'Modelo flojo (modelo de referencia o de clase mayoritaria): siempre responde lo más común. Si el árbol no le gana, no aprendió nada útil.',
        importancia: 'Importancia de variables: cuánto bajó la mezcla de aceptadas y rechazadas cada vez que el árbol preguntó por ese dato.',
        matriz: 'Matriz de confusión: los cuatro casos del examen. Acertó que sí, acertó que no, falsa alarma (dijo aceptada y no lo fue) y se le escapó (dijo rechazada y sí lo fue).',
        logistica: 'Regresión logística: otro modelo, que suma los datos con un peso cada uno. Se usa para comparar; si saca mejor F1, se usa en su lugar.',
        exactitud: 'Exactitud: de cada 10 postulaciones del examen, en cuántas adivinó la respuesta de la empresa.',
        precision: 'Precisión: de las que dijo «aceptada», cuántas lo fueron de verdad.',
        sensibilidad: 'Sensibilidad (recall): de las que fueron aceptadas, cuántas encontró.',
        f1: 'F1: un promedio de precisión y sensibilidad. Con esta nota se escoge entre el árbol y la regresión logística.',
        asociacion: 'Reglas de asociación: se cuenta en cuántas vacantes aparecen dos habilidades juntas. «Confianza»: de las vacantes que piden la primera, cuántas piden también la segunda. Solo se muestran las que aparecen juntas en 3 vacantes o más y más de lo que daría el azar.',
        roc: 'ROC-AUC: qué tan bien ordena de más a menos probable. 0,5 es como tirar una moneda; 1 es perfecto.'
    };

    let M = null;

    // ---------- Palabras tecnicas: al tocarlas se explican ----------
    document.addEventListener('click', e => {
        const b = e.target.closest('.mp-termino');
        if (!b) return;
        const abierta = b.nextElementSibling && b.nextElementSibling.classList.contains('mp-definicion');
        document.querySelectorAll('.mp-definicion').forEach(d => { d.previousElementSibling.setAttribute('aria-expanded', 'false'); d.remove(); });
        if (abierta) return;
        const def = document.createElement('span');
        def.className = 'mp-definicion';
        def.textContent = TERMINOS[b.dataset.termino] || '';
        b.setAttribute('aria-expanded', 'true');
        b.after(def);
    });

    function barras(lista, filas, max) {
        lista.innerHTML = filas.map((f, i) => `
            <li class="ib-fila${f.destacada ? ' destacada' : ''}" style="--i:${i}">
                <span class="ib-nombre">${escapar(f.nombre)}</span>
                <span class="ib-valor">${escapar(f.valor)}${f.extra ? `<small>${escapar(f.extra)}</small>` : ''}</span>
                <span class="ib-barra"><span style="--p:${max ? Math.min(1, f.n / max) : 0}"></span></span>
            </li>`).join('');
        requestAnimationFrame(() => lista.classList.add('visible'));
    }

    // ---------- 1. Estado ----------
    function pintarEstado() {
        const d = M.datos;
        const fecha = new Date(M.fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
        $('mpDemo').hidden = !M.demostracion;
        if (M.estado === 'listo') {
            $('mpEstado').innerHTML = `<i data-ico="check"></i> <span>Aprendió el <strong>${fecha}</strong> con <strong>${coma(d.respondidas)}</strong> postulaciones respondidas.</span>`;
        } else {
            $('mpEstado').innerHTML = `<i data-ico="sprout"></i> <span>Esperando datos: <strong>faltan ${coma(d.faltan)} respuestas</strong> para empezar a aprender.</span>`;
            $('mpFaltan').hidden = false;
            const necesarias = Math.max(d.minimo.total, d.respondidas + d.faltan);
            $('mpFaltanBarra').style.transform = `scaleX(${d.respondidas / necesarias})`;
            $('mpFaltanTexto').textContent = `Necesita al menos ${d.minimo.total} respondidas, con ${d.minimo.por_clase} aceptadas y ${d.minimo.por_clase} rechazadas como mínimo. Hoy tiene ${d.respondidas} (${d.aceptadas} aceptadas y ${d.rechazadas} rechazadas).`;
        }
    }

    // ---------- 2. Datos ----------
    function pintarDatos() {
        const d = M.datos;
        const filas = [
            { nombre: 'Respondidas por las empresas', valor: coma(d.respondidas), n: d.respondidas },
            { nombre: 'Aceptadas', valor: coma(d.aceptadas), n: d.aceptadas, destacada: true },
            { nombre: 'Rechazadas', valor: coma(d.rechazadas), n: d.rechazadas }
        ];
        if (d.de_ejemplo) filas.push({ nombre: 'De vacantes de ejemplo', valor: coma(d.de_ejemplo), n: d.de_ejemplo });
        barras($('mpDatos'), filas, d.respondidas);
    }

    // ---------- 3. Lo que mira ----------
    function pintarVariables() {
        $('mpVariables').innerHTML = M.variables.map(v => `
            <li><i data-ico="${escapar(v.icono)}"></i><div><strong>${escapar(v.nombre)}</strong><span>${escapar(v.explicacion)}</span></div></li>`).join('');
    }

    // ---------- 4. El arbol ----------
    const COL = 210, FILA = 58, CAJA_W = 178;
    let posiciones = {};

    function pintarArbol() {
        const marco = $('mpArbol');
        if (M.estado !== 'listo') {
            marco.innerHTML = '<p class="ib-vacio">El árbol aparece cuando haya suficientes respuestas.</p>';
            return;
        }
        // Hojas una debajo de otra; cada pregunta, a la altura media de sus dos ramas
        const nodos = M.arbol;
        let fila = 0, hondo = 0;
        posiciones = {};
        (function ubicar(id, nivel) {
            const n = nodos[id];
            hondo = Math.max(hondo, nivel);
            if (n.hoja) { posiciones[id] = { x: nivel * COL, y: fila++ * FILA }; return; }
            ubicar(n.si, nivel + 1);
            ubicar(n.no, nivel + 1);
            posiciones[id] = { x: nivel * COL, y: (posiciones[n.si].y + posiciones[n.no].y) / 2 };
        })(0, 0);
        const ancho = hondo * COL + CAJA_W + 8, alto = fila * FILA;

        let lineas = '', etiquetas = '', cajas = '';
        nodos.forEach(n => {
            const p = posiciones[n.id];
            if (!n.hoja) {
                [['si', 'sí'], ['no', 'no']].forEach(([lado, palabra]) => {
                    const h = posiciones[n[lado]];
                    const x1 = p.x + CAJA_W, y1 = p.y + 22, x2 = h.x, y2 = h.y + 22, xm = (x1 + x2) / 2;
                    lineas += `<path data-de="${n.id}" data-a="${n[lado]}" d="M${x1} ${y1} C${xm} ${y1} ${xm} ${y2} ${x2} ${y2}"/>`;
                    etiquetas += `<span class="mp-rama" style="transform:translate(${x2 - 26}px, ${y2 + 2}px)">${palabra}</span>`;
                });
                cajas += `<button type="button" class="mp-nodo" data-id="${n.id}" style="transform:translate(${p.x}px, ${p.y}px)">${escapar(n.pregunta)}</button>`;
            } else {
                cajas += `<button type="button" class="mp-nodo mp-hoja ${n.posibilidad}" data-id="${n.id}" style="transform:translate(${p.x}px, ${p.y}px)">
                    <strong>${n.posibilidad[0].toUpperCase() + n.posibilidad.slice(1)}</strong> <small>${n.aceptadas} de ${n.n} aceptadas</small></button>`;
            }
        });
        marco.style.width = ancho + 'px';
        marco.style.height = alto + 'px';
        marco.innerHTML = `<svg class="mp-lineas" width="${ancho}" height="${alto}" aria-hidden="true">${lineas}</svg>${etiquetas}${cajas}`;
        marco.addEventListener('click', e => {
            const b = e.target.closest('.mp-nodo');
            if (b) leerNodo(Number(b.dataset.id));
        });
    }

    // La frase de una caja: como se llega ahi y cuantas fueron aceptadas
    function leerNodo(id) {
        const n = M.arbol[id];
        const padre = M.arbol.find(p => !p.hoja && (p.si === id || p.no === id));
        const como = padre ? (padre.si === id ? padre.frase_si : padre.frase_no) : 'llegan al árbol';
        let frase = `De las ${n.n} postulaciones que ${como}, ${n.aceptadas} fueron aceptadas (unas ${deDiez(n.prob)} de cada 10).`;
        if (!n.hoja) frase += ` Aquí pregunta: ${n.pregunta}`;
        else frase += ` Posibilidades ${n.posibilidad}.`;
        $('mpFrase').textContent = frase;
        document.querySelectorAll('.mp-nodo.activo').forEach(b => b.classList.remove('activo'));
        const b = document.querySelector(`.mp-nodo[data-id="${id}"]`);
        if (b) b.classList.add('activo');
    }

    function marcarCamino(r) {
        document.querySelectorAll('.en-camino').forEach(el => el.classList.remove('en-camino'));
        if (!r || !r.camino) return;
        r.camino.forEach(paso => {
            const a = paso.si ? paso.nodo.si : paso.nodo.no;
            document.querySelector(`.mp-nodo[data-id="${paso.nodo.id}"]`)?.classList.add('en-camino');
            document.querySelector(`.mp-lineas path[data-de="${paso.nodo.id}"][data-a="${a}"]`)?.classList.add('en-camino');
        });
        document.querySelector(`.mp-nodo[data-id="${r.hoja.id}"]`)?.classList.add('en-camino');
    }

    // ---------- 5. El examen ----------
    function pintarExamen() {
        if (M.estado !== 'listo') {
            $('mpMatriz').innerHTML = '<p class="ib-vacio">El examen se hace cuando haya suficientes respuestas.</p>';
            return;
        }
        const m = M.examen.matriz;
        const total = m.vp + m.vn + m.fp + m.fn;
        const cuadro = (clase, n, titulo, texto) => `<div class="mp-cuadro ${clase}"><span class="mp-cuadro-n">${n}</span><strong>${titulo}</strong><span>${texto}</span></div>`;
        $('mpMatriz').innerHTML =
            cuadro('acerto-si', m.vp, 'Acertó que sí', 'Dijo aceptada y lo fue') +
            cuadro('acerto-no', m.vn, 'Acertó que no', 'Dijo rechazada y lo fue') +
            cuadro('falsa-alarma', m.fp, 'Falsa alarma', 'Dijo aceptada y fue rechazada') +
            cuadro('se-escapo', m.fn, 'Se le escapó', 'Dijo rechazada y fue aceptada');

        const e = M.examen.modelos;
        barras($('mpComparacion'), [
            { nombre: 'El árbol', valor: deDiez(e.arbol.exactitud) + ' de 10', n: e.arbol.exactitud, destacada: true },
            { nombre: 'Regresión logística (otro modelo, para comparar)', valor: deDiez(e.logistica.exactitud) + ' de 10', n: e.logistica.exactitud },
            { nombre: `Modelo flojo (siempre «${M.examen.clase_mas_comun}»)`, valor: deDiez(e.flojo.exactitud) + ' de 10', n: e.flojo.exactitud }
        ], 1);
        $('mpVeredicto').innerHTML = M.examen.le_gana_al_flojo
            ? `<i data-ico="trophy"></i> <span>El árbol acierta ${deDiez(e.arbol.exactitud)} de cada 10 y le gana al modelo flojo. Por eso SkillMatch da consejos.</span>`
            : `<i data-ico="alert"></i> <span><strong>Todavía no aprendió nada útil.</strong> El árbol acierta ${deDiez(e.arbol.exactitud)} de cada 10 y el modelo flojo ${deDiez(e.flojo.exactitud)}: no le gana. Mientras sea así, SkillMatch no da consejos.${M.fuente === 'semilla' ? ' Es lo esperado con estos datos: en los datos por defecto la respuesta de cada postulación se escogió al azar.' : ''}</span>`;
        $('mpVeredicto').classList.toggle('gana', !!M.examen.le_gana_al_flojo);
        void total;
    }

    // ---------- 6. Importancia ----------
    function pintarImportancia() {
        if (M.estado !== 'listo' || !M.importancia.length) {
            $('mpImportancia').innerHTML = '<li class="ib-vacio">Aparece cuando el árbol aprenda.</li>';
            return;
        }
        const max = M.importancia[0].valor;
        barras($('mpImportancia'), M.importancia.map((v, i) => ({
            nombre: v.nombre, valor: coma(v.valor * 100) + ' %', n: v.valor, destacada: i === 0
        })), max);
    }

    // ---------- 7. Pruebalo ----------
    function leerControles() {
        const f = $('mpControles').elements;
        const anos = Number(f.anos_experiencia.value);
        const palabras = Number(f.palabras_carta.value);
        const pct = Number(f.pct_habilidades.value);
        $('oHab').value = pct + ' %';
        $('oAnos').value = coma(anos, anos % 1 ? 1 : 0);
        $('oEst').value = f.num_estudios.value;
        $('oPerfil').value = f.perfil_completo.value + ' %';
        $('oCarta').value = palabras;
        $('oDias').value = f.dias_para_postularse.value;
        $('oPost').value = f.postulantes_vacante.value;
        return {
            pct_habilidades: pct,
            nivel_dominio: pct > 0 ? Number(f.nivel_dominio.value) : 0,
            anos_experiencia: anos,
            alcanza_experiencia: anos >= Number(f.experiencia_pedida.value) ? 1 : 0,
            num_estudios: Number(f.num_estudios.value),
            perfil_completo: Number(f.perfil_completo.value),
            tiene_carta: palabras > 0 ? 1 : 0,
            palabras_carta: palabras,
            misma_ciudad: f.misma_ciudad.checked ? 1 : 0,
            tipo_empleo: f.tipo.value === 'empleo' ? 1 : 0,
            tipo_practica: f.tipo.value === 'practica' ? 1 : 0,
            tipo_freelance: f.tipo.value === 'freelance' ? 1 : 0,
            dias_para_postularse: Number(f.dias_para_postularse.value),
            postulantes_vacante: Number(f.postulantes_vacante.value)
        };
    }

    function probar() {
        const r = SkillMatchModelo.evaluar(leerControles(), M);
        $('mpResultado').innerHTML = SkillMatchModelo.recuadroHtml(r, { mostrarSiempre: true });
        marcarCamino(r);
    }

    // ---------- 8. Historial ----------
    function pintarHistorial() {
        const h = M.historial || [];
        if (!h.length) { $('mpLinea').innerHTML = '<p class="ib-vacio">Todavía no ha aprendido ninguna vez.</p>'; return; }
        const W = 640, H = 200, I = 40, A = 16;
        const x = i => h.length === 1 ? W / 2 : I + i * (W - I - A) / (h.length - 1);
        const y = v => A + (1 - v) * (H - 2 * A - 16);
        const linea = clave => h.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p[clave]).toFixed(1)}`).join(' ');
        const puntos = (clave, clase) => h.map((p, i) => `<circle class="${clase}" cx="${x(i)}" cy="${y(p[clave])}" r="4"><title>${p.fecha}: ${deDiez(p[clave])} de 10</title></circle>`).join('');
        const guias = [0, 0.5, 1].map(v => `<line class="mp-guia" x1="${I}" x2="${W - A}" y1="${y(v)}" y2="${y(v)}"/><text x="${I - 8}" y="${y(v) + 4}" text-anchor="end">${v * 10}</text>`).join('');
        const fechas = h.map((p, i) => (i === 0 || i === h.length - 1) ? `<text x="${x(i)}" y="${H - 2}" text-anchor="middle">${p.fecha.slice(5).split('-').reverse().join('/')}</text>` : '').join('');
        $('mpLinea').innerHTML = `
            <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Aciertos de cada 10 en cada aprendizaje">
                ${guias}${fechas}
                <path class="mp-l-flojo" d="${linea('exactitud_flojo')}"/>${puntos('exactitud_flojo', 'mp-p-flojo')}
                <path class="mp-l-arbol" d="${linea('exactitud_arbol')}"/>${puntos('exactitud_arbol', 'mp-p-arbol')}
            </svg>
            <ul class="mp-leyenda"><li><span class="mp-punto arbol"></span>El árbol (aciertos de cada 10)</li><li><span class="mp-punto flojo"></span>El modelo flojo</li></ul>`;
    }

    // ---------- 9. Habilidades que suelen ir juntas ----------
    function pintarJuntas() {
        const reglas = M.habilidades_juntas || [];
        if (!reglas.length) {
            $('mpJuntas').innerHTML = '<li class="ib-vacio">Todavía no hay suficientes vacantes para encontrar habilidades que vayan juntas.</li>';
            return;
        }
        $('mpJuntas').innerHTML = reglas.slice(0, 6).map((r, i) => `
            <li style="--i:${i}">
                <span class="mp-hab">${escapar(r.si)}</span>
                <i data-ico="arrow"></i>
                <span class="mp-hab destacada">${escapar(r.entonces)}</span>
                <span class="mp-juntas-dato">De cada 10 vacantes que piden ${escapar(r.si)}, ${deDiez(r.confianza)} piden también ${escapar(r.entonces)}
                    <small>(${r.vacantes} vacantes)</small></span>
            </li>`).join('');
    }

    // ---------- Los numeros exactos ----------
    function pintarDetalles() {
        if (M.estado !== 'listo') {
            $('mpDetallesCuerpo').innerHTML = `<p class="detalle-resumen">Respondidas: ${M.datos.respondidas}. Faltan ${M.datos.faltan} para el mínimo.</p>`;
            return;
        }
        const e = M.examen.modelos;
        const fila = (n, m) => `<tr><th>${n}</th>${['exactitud', 'precision', 'sensibilidad', 'f1', 'roc_auc'].map(k => `<td class="num">${m[k] == null ? '–' : coma(m[k], 3)}</td>`).join('')}</tr>`;
        const t = (k, txt) => `<button type="button" class="mp-termino" data-termino="${k}">${txt}</button>`;
        const p = M.parametros;
        $('mpDetallesCuerpo').innerHTML = `
            <p class="detalle-resumen">Promedio de ${M.examen.pliegues} pliegues estratificados (semilla ${p.semilla}). Algoritmo: ${escapar(p.algoritmo)},
               profundidad máxima ${p.profundidad_maxima}, ${p.casos_por_hoja} casos por hoja. Ganador por F1: <strong>${M.examen.ganador === 'arbol' ? 'el árbol' : 'la regresión logística'}</strong>.
               Le gana al flojo si su exactitud lo supera por ${coma(M.examen.margen * 100)} puntos o más.</p>
            <div class="detalle-tabla-marco"><table class="detalle-tabla">
                <thead><tr><th>Modelo</th><th class="num">${t('exactitud', 'Exactitud')}</th><th class="num">${t('precision', 'Precisión')}</th>
                <th class="num">${t('sensibilidad', 'Sensibilidad')}</th><th class="num">${t('f1', 'F1')}</th><th class="num">${t('roc', 'ROC-AUC')}</th></tr></thead>
                <tbody>${fila(t('arbol', 'Árbol de decisión'), e.arbol)}${fila(t('logistica', 'Regresión logística'), e.logistica)}${fila(t('flojo', 'Modelo flojo'), e.flojo)}</tbody>
            </table></div>
            <p class="detalle-fuente">Matriz de confusión del árbol: VP ${M.examen.matriz.vp}, VN ${M.examen.matriz.vn}, FP ${M.examen.matriz.fp}, FN ${M.examen.matriz.fn}.
               Generado el ${escapar(M.fecha)} ${M.motor === 'java' ? 'por el servidor (EntrenadorModelo.java), que vuelve a aprender cada noche' : 'con 2-modelo/entrenar_modelo.py (scikit-learn)'}, fuente: ${M.fuente === 'semilla' ? 'datos por defecto (DataSeeder)' : 'la base de la plataforma'}.</p>`;
    }

    function iniciar() {
        SkillMatchModelo.cargar().then(m => {
            M = m;
            pintarEstado(); pintarDatos(); pintarVariables(); pintarArbol(); pintarExamen();
            pintarImportancia(); pintarHistorial(); pintarJuntas(); pintarDetalles();
            $('mpControles').addEventListener('input', probar);
            $('mpControles').addEventListener('change', probar);
            $('mpControles').addEventListener('submit', e => e.preventDefault());
            probar();
            $('mpHistoria').setAttribute('aria-busy', 'false');
        }).catch(() => {
            $('mpError').hidden = false;
            $('mpHistoria').setAttribute('aria-busy', 'false');
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
    else iniciar();
})();
