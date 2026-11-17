// Como aprende SkillMatch (como-aprende.html)
//
// Dibuja la ficha tecnica y los 10 pasos del modelo predictivo, en el orden en que ocurren:
// problema, datos, variables, arbol, evaluacion, importancia, umbrales, simulador,
// reentrenamiento y reglas de asociacion. Lo pide SkillMatchModelo.cargar(): primero
// GET /api/public/modelo (el servidor aprende cada noche) y, si no responde,
// assets/data/modelo-predictivo.json (el script de Python).
//
// Todo lo que se muestra son cifras de todas las postulaciones juntas, nunca de una persona.

(function () {
    'use strict';

    const $ = id => document.getElementById(id);
    const escapar = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const coma = (n, d) => Number(n).toLocaleString('es-CO', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
    const pct = (p, d) => coma(p * 100, d == null ? 1 : d).replace(/,0$/, '') + ' %';

    // Las palabras tecnicas: al tocarlas se explican en una frase
    const TERMINOS = {
        clasificacion: 'Clasificación binaria supervisada: el modelo aprende de ejemplos que ya tienen la respuesta correcta (etiqueta) y predice una de dos clases para casos nuevos; aquí, aceptada o rechazada.',
        balance: 'Balance de clases: cuántos ejemplos hay de cada clase. Si una clase domina, un modelo puede acertar mucho solo repitiéndola; por eso se compara con la línea base.',
        onehot: 'Codificación one-hot: una variable con varias categorías se convierte en una columna por categoría, con 1 en la que corresponde y 0 en las demás.',
        arbol: 'Árbol de decisión CART (Classification and Regression Trees): divide los datos con preguntas de sí o no sobre una variable a la vez, hasta llegar a hojas con una proporción de cada clase. Es el mismo algoritmo de DecisionTreeClassifier en scikit-learn.',
        gini: 'Impureza de Gini: 1 − (p² + q²), donde p y q son las proporciones de aceptadas y rechazadas en un nodo. Vale 0 si todas son de una clase y 0,5 si están mitad y mitad. El mejor corte es el que más la reduce.',
        sobreajuste: 'Sobreajuste: cuando un modelo memoriza los ejemplos de entrenamiento en lugar de aprender patrones generales, y falla con datos nuevos. Limitar la profundidad y el tamaño mínimo de las hojas lo previene.',
        cv: 'Validación cruzada de k pliegues (k = 5): los datos se parten en 5 grupos; cada grupo se usa una vez para evaluar y las otras cuatro para entrenar. Así cada postulación se evalúa exactamente una vez con un modelo que no la vio.',
        fuga: 'Fuga de datos: cuando información de los datos de evaluación se filtra al entrenamiento y las métricas salen mejores de lo que serían en la realidad. Agrupar por vacante evita que postulaciones de la misma vacante queden a los dos lados.',
        logistica: 'Regresión logística: modelo lineal que combina las variables con un peso cada una y transforma el resultado en una probabilidad con la función sigmoide. Aquí se usa con regularización L2 y las variables estandarizadas.',
        linea_base: 'Línea base (clasificador de clase mayoritaria): siempre predice la clase más frecuente. Es el mínimo que cualquier modelo debe superar para aportar algo.',
        importancia: 'Importancia de Gini (mean decrease in impurity): para cada variable se suma cuánto bajó la impureza ponderada en los nodos que la usan, y se divide por el total. Es el feature_importances_ de scikit-learn.',
        matriz: 'Matriz de confusión: cruza la clase real con la predicha. VP y VN son aciertos; FP es un falso positivo (predijo aceptada y fue rechazada) y FN un falso negativo (predijo rechazada y fue aceptada).',
        exactitud: 'Exactitud (accuracy): (VP + VN) / total. La proporción de predicciones correctas.',
        precision: 'Precisión: VP / (VP + FP). De las que predijo «aceptada», cuántas lo fueron.',
        sensibilidad: 'Sensibilidad o exhaustividad (recall): VP / (VP + FN). De las que fueron aceptadas, cuántas detectó.',
        f1: 'F1: media armónica de precisión y sensibilidad, 2·P·S / (P + S). Con esta métrica se elige entre el árbol y la regresión logística.',
        roc: 'ROC-AUC: área bajo la curva ROC. Mide qué tan bien ordena las postulaciones de más a menos probables: 0,5 equivale al azar y 1 es perfecto.',
        asociacion: 'Reglas de asociación: técnica de minería de datos (análisis de canasta) que busca elementos que aparecen juntos. Soporte = casos con A y B; confianza = P(B | A); lift = P(B | A) / P(B).'
    };

    let M = null;

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
    const termino = (clave, texto) => `<button type="button" class="mp-termino" data-termino="${clave}">${texto}</button>`;

    function barras(lista, filas, max) {
        lista.innerHTML = filas.map((f, i) => `
            <li class="ib-fila${f.destacada ? ' destacada' : ''}" style="--i:${i}">
                <span class="ib-nombre">${escapar(f.nombre)}</span>
                <span class="ib-valor">${escapar(f.valor)}${f.extra ? `<small>${escapar(f.extra)}</small>` : ''}</span>
                <span class="ib-barra"><span style="--p:${max ? Math.min(1, f.n / max) : 0}"></span></span>
            </li>`).join('');
        requestAnimationFrame(() => lista.classList.add('visible'));
    }

    const fechaLarga = f => new Date(f).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });

    // ---------- Ficha tecnica ----------
    function pintarFicha() {
        const p = M.parametros || {};
        const e = M.examen || {};
        const ganador = e.ganador === 'logistica' ? 'Regresión logística (mejor F1 que el árbol)' : 'Árbol de decisión (mejor F1 que la regresión logística)';
        const filas = [
            ['Tipo de problema', 'Clasificación binaria supervisada'],
            ['Variable objetivo', 'Postulación aceptada (1) o rechazada (0)'],
            ['Datos de entrenamiento', M.estado === 'listo'
                ? `${coma(M.datos.respondidas)} postulaciones respondidas (${coma(M.datos.aceptadas)} aceptadas y ${coma(M.datos.rechazadas)} rechazadas)`
                : `Aún no hay suficientes: ${coma(M.datos.respondidas)} de al menos ${M.datos.minimo.total}`],
            ['Variables de entrada', `${M.variables.length} características numéricas y binarias`],
            ['Algoritmo principal', `Árbol de decisión CART, criterio de Gini, profundidad máxima ${p.profundidad_maxima}, mínimo ${p.casos_por_hoja} muestras por hoja`],
            ['Modelos de comparación', 'Regresión logística (regularización L2, variables estandarizadas) y línea base de clase mayoritaria'],
            ['Validación', `Validación cruzada estratificada de ${p.pliegues} pliegues${p.examen === 'por vacante' ? ', agrupada por vacante' : ''}`],
            ['Métricas', 'Exactitud, precisión, sensibilidad, F1 y ROC-AUC'],
            ['Modelo seleccionado', M.estado !== 'listo' ? 'Ninguno todavía' : ganador + (M.examen.le_gana_al_flojo ? '' : '. Todavía no se usa en la plataforma porque no supera a la línea base')],
            ['Salida para la persona', `Nivel de posibilidades: buenas (≥ ${pct(M.niveles.buenas, 0)}), regulares (≥ ${pct(M.niveles.regulares, 0)}) o bajas`],
            ['Reentrenamiento', 'Automático, cada noche a las 3:30 a. m. (hora de Colombia)'],
            ['Implementación', 'Java, en el servidor de SkillMatch, con resultados equivalentes a scikit-learn (script de referencia en Python)']
        ];
        $('mpFicha').innerHTML = filas.map(f => `<dt>${f[0]}</dt><dd>${escapar(f[1])}</dd>`).join('');
    }

    // ---------- 1. Estado ----------
    function pintarEstado() {
        const d = M.datos;
        $('mpDemo').hidden = !M.demostracion;
        if (M.estado === 'listo') {
            $('mpEstado').innerHTML = `<i data-ico="check"></i> <span>Último entrenamiento: <strong>${fechaLarga(M.fecha)}</strong>, con <strong>${coma(d.respondidas)}</strong> postulaciones respondidas.</span>`;
        } else {
            $('mpEstado').innerHTML = `<i data-ico="sprout"></i> <span>Esperando datos: <strong>faltan ${coma(d.faltan)} respuestas</strong> para el primer entrenamiento.</span>`;
            $('mpFaltan').hidden = false;
            const necesarias = Math.max(d.minimo.total, d.respondidas + d.faltan);
            $('mpFaltanBarra').style.transform = `scaleX(${d.respondidas / necesarias})`;
            $('mpFaltanTexto').textContent = `Se necesitan al menos ${d.minimo.total} postulaciones respondidas, con ${d.minimo.por_clase} o más de cada clase. Hoy hay ${d.respondidas} (${d.aceptadas} aceptadas y ${d.rechazadas} rechazadas).`;
        }
    }

    // ---------- 2. Datos ----------
    function pintarDatos() {
        const d = M.datos;
        const parte = n => d.respondidas ? pct(n / d.respondidas, 0) : '';
        const filas = [
            { nombre: 'Postulaciones respondidas (ejemplos)', valor: coma(d.respondidas), n: d.respondidas },
            { nombre: 'Aceptadas (clase positiva, 1)', valor: coma(d.aceptadas), extra: parte(d.aceptadas), n: d.aceptadas, destacada: true },
            { nombre: 'Rechazadas (clase negativa, 0)', valor: coma(d.rechazadas), extra: parte(d.rechazadas), n: d.rechazadas }
        ];
        if (d.de_ejemplo) filas.push({ nombre: 'De vacantes de ejemplo', valor: coma(d.de_ejemplo), n: d.de_ejemplo });
        barras($('mpDatos'), filas, d.respondidas);
    }

    // ---------- 3. Variables ----------
    const TIPOS = { entero: 'numérica', decimal: 'numérica', si_no: 'binaria (0 o 1)' };
    function pintarVariables() {
        $('mpVariables').innerHTML = M.variables.map(v => `
            <li><i data-ico="${escapar(v.icono)}"></i><div><strong>${escapar(v.nombre)}</strong>
                <span>${escapar(v.explicacion)}</span>
                <small class="mp-var-tipo"><code>${escapar(v.id)}</code> · ${TIPOS[v.tipo] || 'numérica'}</small></div></li>`).join('');
    }

    // ---------- 4. El arbol ----------
    const COL = 210, FILA = 58, CAJA_W = 178;
    let posiciones = {};

    function pintarArbol() {
        const marco = $('mpArbol');
        if (M.estado !== 'listo') {
            marco.innerHTML = '<p class="ib-vacio">El árbol aparece después del primer entrenamiento.</p>';
            return;
        }
        // Hojas una debajo de otra; cada nodo, a la altura media de sus dos ramas
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

    // Lo que dice un nodo: cuantas postulaciones llegan, como llegan y que proporcion fue aceptada
    function leerNodo(id) {
        const n = M.arbol[id];
        const padre = M.arbol.find(p => !p.hoja && (p.si === id || p.no === id));
        const como = padre ? `las ${n.n} postulaciones que ${padre.si === id ? padre.frase_si : padre.frase_no}` : `las ${n.n} postulaciones del conjunto (nodo raíz)`;
        let frase = `${n.hoja ? 'Hoja' : 'Nodo'}: llegan ${como}. De ellas, ${n.aceptadas} fueron aceptadas: probabilidad estimada de ${pct(n.prob)}.`;
        if (!n.hoja) frase += ` Pregunta del nodo: ${n.pregunta}`;
        else frase += ` Nivel: ${n.posibilidad}.`;
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

    // ---------- 5. Evaluacion ----------
    function pintarExamen() {
        if (M.estado !== 'listo') {
            $('mpMatriz').innerHTML = '<p class="ib-vacio">La evaluación se hace en el primer entrenamiento.</p>';
            $('mpComparacion').innerHTML = '';
            return;
        }
        const m = M.examen.matriz;
        const celda = (clase, sigla, n, texto) => `<td class="mp-celda ${clase}"><span class="mp-celda-n">${n}</span><strong>${sigla}</strong><small>${texto}</small></td>`;
        $('mpMatriz').innerHTML = `
            <table class="mp-confusion">
                <caption class="sr-only">Matriz de confusión del árbol en validación cruzada</caption>
                <thead>
                    <tr><td class="mp-esquina" rowspan="2"></td><th colspan="2" scope="colgroup" class="mp-eje">Predicción del modelo</th></tr>
                    <tr><th scope="col">Aceptada</th><th scope="col">Rechazada</th></tr>
                </thead>
                <tbody>
                    <tr><th scope="row"><span class="mp-eje-fila">Real:</span> Aceptada</th>
                        ${celda('acierto', 'VP', m.vp, 'Verdaderos positivos')}${celda('error', 'FN', m.fn, 'Falsos negativos')}</tr>
                    <tr><th scope="row"><span class="mp-eje-fila">Real:</span> Rechazada</th>
                        ${celda('error', 'FP', m.fp, 'Falsos positivos')}${celda('acierto', 'VN', m.vn, 'Verdaderos negativos')}</tr>
                </tbody>
            </table>
            <p class="mp-matriz-nota">${termino('matriz', '¿Cómo se lee?')} La diagonal (VP y VN) son los aciertos: ${m.vp + m.vn} de ${m.vp + m.vn + m.fp + m.fn}.</p>`;

        const e = M.examen.modelos;
        const metricas = [['exactitud', 'Exactitud'], ['precision', 'Precisión'], ['sensibilidad', 'Sensibilidad'], ['f1', 'F1'], ['roc_auc', 'ROC-AUC']];
        const claveTermino = { roc_auc: 'roc' };
        const enUso = M.examen.ganador === 'logistica' ? 'logistica' : 'arbol';
        const fila = (clave, nombre) => `<tr class="${clave === enUso ? 'mp-en-uso' : ''}"><th scope="row">${nombre}${clave === enUso ? ' <span class="mp-chip">seleccionado</span>' : ''}</th>${metricas.map(([k]) => `<td class="num">${e[clave][k] == null ? '–' : coma(e[clave][k], 2)}</td>`).join('')}</tr>`;
        $('mpComparacion').innerHTML = `
            <div class="mp-tabla-marco"><table class="mp-metricas">
                <caption class="sr-only">Métricas de cada modelo en validación cruzada (de 0 a 1)</caption>
                <thead><tr><th scope="col">Modelo</th>${metricas.map(([k, n]) => `<th scope="col" class="num">${termino(claveTermino[k] || k, n)}</th>`).join('')}</tr></thead>
                <tbody>${fila('arbol', 'Árbol de decisión')}${fila('logistica', 'Regresión logística')}${fila('flojo', `Línea base (siempre «${escapar(M.examen.clase_mas_comun)}»)`)}</tbody>
            </table></div>
            <p class="mp-matriz-nota">Valores de 0 a 1; más alto es mejor. «Seleccionado»: el de mayor F1 entre el árbol y la regresión logística.</p>`;

        const a = e.arbol.exactitud, b = e.flojo.exactitud;
        $('mpVeredicto').innerHTML = M.examen.le_gana_al_flojo
            ? `<i data-ico="trophy"></i> <span><strong>El modelo supera a la línea base.</strong> El árbol tiene una exactitud de ${pct(a)} frente a ${pct(b)} de la línea base (se exige una diferencia de al menos ${pct(M.examen.margen, 0)}). Por eso la plataforma muestra estimaciones y consejos.</span>`
            : `<i data-ico="alert"></i> <span><strong>El modelo todavía no supera a la línea base.</strong> El árbol tiene una exactitud de ${pct(a)} y la línea base de ${pct(b)}; se exige que la supere por al menos ${pct(M.examen.margen, 0)}. Mientras sea así, la plataforma no muestra estimaciones ni consejos.${M.fuente === 'semilla' ? ' Es el resultado esperado con estos datos: en los datos de ejemplo la respuesta de cada postulación se asignó al azar, así que no hay un patrón real que aprender.' : ''}</span>`;
        $('mpVeredicto').classList.toggle('gana', !!M.examen.le_gana_al_flojo);
    }

    // ---------- 6. Importancia ----------
    function pintarImportancia() {
        if (M.estado !== 'listo' || !M.importancia.length) {
            $('mpImportancia').innerHTML = '<li class="ib-vacio">Aparece después del primer entrenamiento.</li>';
            return;
        }
        const max = M.importancia[0].valor;
        barras($('mpImportancia'), M.importancia.map((v, i) => ({
            nombre: v.nombre, valor: pct(v.valor), n: v.valor, destacada: i === 0
        })), max);
        const sinUso = M.variables.length - M.importancia.length;
        if (sinUso > 0) {
            const li = document.createElement('li');
            li.className = 'ib-vacio';
            li.textContent = `Las otras ${sinUso} variables no aparecen en ningún corte del árbol: su importancia es 0 %.`;
            $('mpImportancia').appendChild(li);
        }
    }

    // ---------- 7. Umbrales ----------
    function pintarUmbrales() {
        const b = M.niveles.buenas, r = M.niveles.regulares;
        $('mpUmbrales').innerHTML = `
            <div class="mp-escala" role="img" aria-label="De 0 a ${pct(r, 0)}: bajas; de ${pct(r, 0)} a ${pct(b, 0)}: regulares; desde ${pct(b, 0)}: buenas">
                <span class="bajas" style="flex:${r}"><strong>Bajas</strong><small>menos de ${pct(r, 0)}</small></span>
                <span class="regulares" style="flex:${b - r}"><strong>Regulares</strong><small>${pct(r, 0)} a ${pct(b - 0.01, 0)}</small></span>
                <span class="buenas" style="flex:${1 - b}"><strong>Buenas</strong><small>${pct(b, 0)} o más</small></span>
            </div>
            <div class="mp-escala-ejes" aria-hidden="true"><span>0 %</span><span style="left:${r * 100}%">${pct(r, 0)}</span><span style="left:${b * 100}%">${pct(b, 0)}</span><span>100 %</span></div>`;
    }

    // ---------- 8. Simulador ----------
    function leerControles() {
        const f = $('mpControles').elements;
        const anos = Number(f.anos_experiencia.value);
        const palabras = Number(f.palabras_carta.value);
        const porc = Number(f.pct_habilidades.value);
        $('oHab').value = porc + ' %';
        $('oAnos').value = coma(anos, anos % 1 ? 1 : 0);
        $('oEst').value = f.num_estudios.value;
        $('oPerfil').value = f.perfil_completo.value + ' %';
        $('oCarta').value = palabras;
        $('oDias').value = f.dias_para_postularse.value;
        $('oPost').value = f.postulantes_previos.value;
        return {
            pct_habilidades: porc,
            nivel_dominio: porc > 0 ? Number(f.nivel_dominio.value) : 0,
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
            postulantes_previos: Number(f.postulantes_previos.value)
        };
    }

    function probar() {
        const r = SkillMatchModelo.evaluar(leerControles(), M);
        $('mpResultado').innerHTML = SkillMatchModelo.recuadroHtml(r, { mostrarSiempre: true });
        marcarCamino(r);
    }

    // ---------- 9. Reentrenamiento ----------
    function pintarHistorial() {
        const h = M.historial || [];
        if (!h.length) { $('mpLinea').innerHTML = '<p class="ib-vacio">Todavía no hay entrenamientos registrados.</p>'; return; }
        const fecha = f => f.split('-').reverse().join('/');
        // La tabla siempre; la grafica solo cuando hay al menos 3 entrenamientos (con uno o dos no hay tendencia que ver)
        const tabla = `
            <div class="mp-tabla-marco"><table class="mp-metricas mp-registro">
                <caption class="sr-only">Registro de entrenamientos</caption>
                <thead><tr><th scope="col">Fecha</th><th scope="col" class="num">Respondidas</th><th scope="col" class="num">Exactitud del árbol</th><th scope="col" class="num">Línea base</th><th scope="col" class="num">Diferencia</th></tr></thead>
                <tbody>${h.slice(-8).reverse().map(p => {
                    const dif = p.exactitud_arbol - p.exactitud_flojo;
                    return `<tr><th scope="row">${fecha(p.fecha)}</th><td class="num">${p.respondidas == null ? '–' : coma(p.respondidas)}</td><td class="num">${pct(p.exactitud_arbol)}</td><td class="num">${pct(p.exactitud_flojo)}</td><td class="num ${dif >= 0 ? 'mp-mas' : 'mp-menos'}">${dif >= 0 ? '+' : '−'}${coma(Math.abs(dif) * 100, 1)} pts</td></tr>`;
                }).join('')}</tbody>
            </table></div>`;
        let grafica = '';
        if (h.length >= 3) {
            const W = 640, H = 210, I = 44, A = 16;
            const x = i => I + i * (W - I - A) / (h.length - 1);
            const y = v => A + (1 - v) * (H - 2 * A - 16);
            const linea = clave => h.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p[clave]).toFixed(1)}`).join(' ');
            const puntos = (clave, clase) => h.map((p, i) => `<circle class="${clase}" cx="${x(i)}" cy="${y(p[clave])}" r="4"><title>${fecha(p.fecha)}: ${pct(p[clave])}</title></circle>`).join('');
            const guias = [0, 0.5, 1].map(v => `<line class="mp-guia" x1="${I}" x2="${W - A}" y1="${y(v)}" y2="${y(v)}"/><text x="${I - 8}" y="${y(v) + 4}" text-anchor="end">${v * 100} %</text>`).join('');
            const fechas = [0, h.length - 1].map(i => `<text x="${x(i)}" y="${H - 2}" text-anchor="middle">${fecha(h[i].fecha).slice(0, 5)}</text>`).join('');
            grafica = `
                <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Exactitud del árbol y de la línea base en cada entrenamiento">
                    ${guias}${fechas}
                    <path class="mp-l-flojo" d="${linea('exactitud_flojo')}"/>${puntos('exactitud_flojo', 'mp-p-flojo')}
                    <path class="mp-l-arbol" d="${linea('exactitud_arbol')}"/>${puntos('exactitud_arbol', 'mp-p-arbol')}
                </svg>
                <ul class="mp-leyenda"><li><span class="mp-punto arbol"></span>Exactitud del árbol</li><li><span class="mp-punto flojo"></span>Línea base</li></ul>`;
        }
        $('mpLinea').innerHTML = grafica + tabla +
            (h.length < 3 ? `<p class="mp-matriz-nota">${h.length === 1 ? 'Hay un solo entrenamiento registrado' : 'Hay dos entrenamientos registrados'}; la gráfica de evolución aparece desde el tercero.</p>` : '');
    }

    // ---------- 10. Reglas de asociacion ----------
    function pintarJuntas() {
        const reglas = M.habilidades_juntas || [];
        if (!reglas.length) {
            $('mpJuntas').innerHTML = '<li class="ib-vacio">Todavía no hay vacantes suficientes para encontrar reglas que cumplan los mínimos.</li>';
            return;
        }
        $('mpJuntas').innerHTML = reglas.slice(0, 6).map((r, i) => `
            <li style="--i:${i}">
                <span class="mp-hab">${escapar(r.si)}</span>
                <i data-ico="arrow"></i>
                <span class="mp-hab destacada">${escapar(r.entonces)}</span>
                <span class="mp-juntas-dato">
                    <span><strong>${r.vacantes}</strong> vacantes de soporte</span>
                    <span>Confianza <strong>${pct(r.confianza, 0)}</strong></span>
                    <span>Lift <strong>${coma(r.lift, 1)}</strong></span>
                </span>
            </li>`).join('');
    }

    // ---------- Detalles tecnicos ----------
    function pintarDetalles() {
        const p = M.parametros || {};
        const filas = [
            ['Algoritmo', escapar(p.algoritmo || 'CART')],
            ['Profundidad máxima', p.profundidad_maxima],
            ['Mínimo de muestras por hoja', p.casos_por_hoja],
            ['Validación cruzada', `${p.pliegues} pliegues${p.examen === 'por vacante' ? ', estratificados y agrupados por vacante' : ', estratificados'}`],
            ['Semilla aleatoria', p.semilla],
            ['Umbral de decisión en la evaluación', 'probabilidad ≥ 0,5 se cuenta como «aceptada»'],
            ['Criterio para superar la línea base', M.examen ? `exactitud ≥ línea base + ${pct(M.examen.margen, 0)}` : '–'],
            ['Criterio de selección del modelo', 'mayor F1 entre árbol y regresión logística'],
            ['Mínimo de datos', `${M.datos.minimo.total} respondidas, con ${M.datos.minimo.por_clase} de cada clase`],
            ['Entrenado con', M.motor === 'java' ? 'el servidor (EntrenadorModelo.java), cada noche' : 'el script de referencia 2-modelo/entrenar_modelo.py (scikit-learn)'],
            ['Origen de los datos', M.fuente === 'semilla' ? 'datos de ejemplo de la plataforma (DataSeeder)' : 'la base de datos de la plataforma'],
            ['Fecha del modelo', escapar(M.fecha)]
        ];
        const m = M.examen && M.examen.matriz;
        $('mpDetallesCuerpo').innerHTML = `
            <dl class="mp-ficha mp-ficha-detalle">${filas.map(f => `<dt>${f[0]}</dt><dd>${f[1]}</dd>`).join('')}</dl>
            ${m && M.estado === 'listo' ? `<p class="detalle-fuente">Matriz de confusión del árbol: VP ${m.vp}, VN ${m.vn}, FP ${m.fp}, FN ${m.fn}. Los resultados del servidor y del script de Python se comparan en las pruebas automáticas del backend (EntrenadorModeloTest).</p>` : ''}`;
    }

    function iniciar() {
        SkillMatchModelo.cargar().then(m => {
            M = m;
            pintarFicha(); pintarEstado(); pintarDatos(); pintarVariables(); pintarArbol(); pintarExamen();
            pintarImportancia(); pintarUmbrales(); pintarHistorial(); pintarJuntas(); pintarDetalles();
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
