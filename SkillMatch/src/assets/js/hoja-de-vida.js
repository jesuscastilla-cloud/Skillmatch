// Hoja de vida en PDF (hoja-de-vida.html)
//
// Arma una hoja de vida con los datos reales del perfil y la descarga en PDF
// con la impresion del navegador ("Guardar como PDF"): sin librerias ni
// servicios externos. Las reglas @media print de app.css (seccion 24e) dejan
// solo la hoja, en tamano carta.
// - Sin ?id=: la de quien inicio sesion, con su correo y telefono.
// - Con ?id=: la de otra persona (por ejemplo, una empresa viendo a un
//   candidato), sin correo ni telefono: esos datos solo los ve la empresa en
//   la postulacion.

const NIVELES_HABILIDAD = { BASICO: 'Básico', INTERMEDIO: 'Intermedio', AVANZADO: 'Avanzado', EXPERTO: 'Experto' };

function sesionHoja() {
    try {
        return haySesion() ? JSON.parse(localStorage.getItem('userData') || 'null') : null;
    } catch (e) {
        return null;
    }
}

async function pedirHoja(ruta) {
    const r = await fetchWithAuth(ruta);
    if (!r.ok) throw new Error(`El servidor respondió ${r.status}`);
    return r.json();
}

// "2025-09-12" se lee como fecha local: con new Date() salia el dia anterior
// (hora de Colombia) y a veces el mes anterior
function mesAnio(fecha) {
    if (!fecha) return '';
    const m = String(fecha).match(/^(\d{4})-(\d{2})/);
    const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, 1) : new Date(fecha);
    if (isNaN(d)) return '';
    const texto = d.toLocaleDateString('es-CO', { month: 'short', year: 'numeric' }).replace('.', '');
    return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function periodo(item) {
    const desde = mesAnio(item.startDate);
    const hasta = item.isCurrent || item.current ? 'Actualidad' : mesAnio(item.endDate);
    return [desde, hasta].filter(Boolean).join(' – ');
}

function seccion(titulo, contenido) {
    return contenido ? `<section class="hoja-seccion"><h2>${titulo}</h2>${contenido}</section>` : '';
}

function pintarHoja(p, habilidades, experiencias, estudios, certificaciones, propia) {
    const nombre = `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'Sin nombre';
    document.title = `Hoja de vida de ${nombre} - SkillMatch`;
    const contacto = [
        p.location ? `<li><i data-ico="pin"></i> ${escaparHtml(p.location)}</li>` : '',
        propia && p.email ? `<li><i data-ico="mail"></i> ${escaparHtml(p.email)}</li>` : '',
        propia && p.phone ? `<li><i data-ico="phone"></i> ${escaparHtml(p.phone)}</li>` : ''
    ].join('');

    const listaHabilidades = habilidades.length
        ? `<ul class="hoja-habilidades">${habilidades.map(h => `
            <li><span>${escaparHtml(h.name)}</span>${NIVELES_HABILIDAD[String(h.level || '').toUpperCase()] ? `<small>${NIVELES_HABILIDAD[String(h.level).toUpperCase()]}</small>` : ''}</li>`).join('')}</ul>`
        : '';

    const ordenar = lista => lista.slice().sort((a, b) => String(b.startDate || '').localeCompare(String(a.startDate || '')));
    const listaExperiencia = experiencias && experiencias.length
        ? ordenar(experiencias).map(e => `
            <div class="hoja-item">
                <div class="hoja-item-cabeza">
                    <h3>${escaparHtml(e.position || 'Cargo')}</h3>
                    <span>${periodo(e)}</span>
                </div>
                <p class="hoja-item-lugar">${[e.company, e.location].filter(Boolean).map(escaparHtml).join(' · ')}</p>
                ${e.description ? `<p>${escaparHtml(e.description)}</p>` : ''}
            </div>`).join('')
        : '';
    const listaEstudios = estudios.length
        ? ordenar(estudios).map(e => `
            <div class="hoja-item">
                <div class="hoja-item-cabeza">
                    <h3>${escaparHtml(e.degree || e.fieldOfStudy || 'Estudios')}</h3>
                    <span>${periodo(e)}</span>
                </div>
                <p class="hoja-item-lugar">${[e.school, e.degree && e.fieldOfStudy ? e.fieldOfStudy : ''].filter(Boolean).map(escaparHtml).join(' · ')}</p>
                ${e.description ? `<p>${escaparHtml(e.description)}</p>` : ''}
            </div>`).join('')
        : '';
    const listaCertificaciones = certificaciones.length
        ? certificaciones.map(c => `
            <div class="hoja-item">
                <div class="hoja-item-cabeza">
                    <h3>${escaparHtml(c.name || 'Certificación')}</h3>
                    <span>${mesAnio(c.issueDate)}</span>
                </div>
                ${c.issuer ? `<p class="hoja-item-lugar">${escaparHtml(c.issuer)}</p>` : ''}
            </div>`).join('')
        : '';

    const hoja = document.getElementById('hoja');
    hoja.innerHTML = `
        <header class="hoja-cabeza">
            <h2 class="hoja-nombre">${escaparHtml(nombre)}</h2>
            ${p.headline ? `<p class="hoja-titular">${escaparHtml(p.headline)}</p>` : ''}
            ${contacto ? `<ul class="hoja-contacto">${contacto}</ul>` : ''}
        </header>
        ${seccion('Perfil', p.bio ? `<p class="hoja-texto">${escaparHtml(p.bio)}</p>` : '')}
        ${seccion('Experiencia', listaExperiencia)}
        ${seccion('Estudios', listaEstudios)}
        ${seccion('Habilidades', listaHabilidades)}
        ${seccion('Certificaciones', listaCertificaciones)}
        ${!p.bio && !listaExperiencia && !listaEstudios && !listaHabilidades
            ? '<p class="hoja-vacia no-imprimir">Todavía no hay datos para la hoja de vida. Agrega a qué te dedicas, tus habilidades y tus estudios en tu perfil.</p>'
            : ''}
        <p class="hoja-pie">Hoja de vida generada en SkillMatch Cartagena el ${new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}.</p>`;
    hoja.removeAttribute('aria-busy');
}

async function iniciarHoja() {
    const hoja = document.getElementById('hoja');
    if (!hoja) return;
    const sesion = sesionHoja();
    if (!sesion) {
        window.location.href = 'login.html';
        return;
    }
    const pedida = new URLSearchParams(window.location.search).get('id');
    const id = pedida || sesion.id;
    const propia = !pedida || String(pedida) === String(sesion.id);
    const volver = document.getElementById('hojaVolver');
    if (volver && !propia) volver.setAttribute('href', 'perfil-usuario.html?id=' + encodeURIComponent(id));
    if (!propia) {
        const titulo = document.querySelector('.hoja-barra p');
        if (titulo) titulo.textContent = 'Se arma con los datos del perfil de esta persona. Su correo y teléfono no salen aquí.';
    }

    const usuario = encodeURIComponent(id);
    const opcional = ruta => pedirHoja(ruta).catch(() => null);
    try {
        const [perfil, habilidades, experiencias, estudios, certificaciones] = await Promise.all([
            pedirHoja(`/users/${usuario}`),
            opcional(`/users/${usuario}/skills`),
            opcional(`/users/${usuario}/experiences`),
            opcional(`/users/${usuario}/educations`),
            opcional(`/users/${usuario}/certifications`)
        ]);
        pintarHoja(perfil, habilidades || [], experiencias, estudios || [], certificaciones || [], propia);
        // El backend hoy responde 400 en experiencias: se avisa en pantalla (no en el PDF)
        if (experiencias === null) {
            const aviso = document.getElementById('hojaAviso');
            aviso.textContent = 'No pudimos cargar la experiencia laboral (es un error del servidor que ya está reportado). La hoja sale sin esa sección por ahora.';
            aviso.hidden = false;
        }
        const descargar = document.getElementById('hojaDescargar');
        descargar.disabled = false;
        descargar.addEventListener('click', () => window.print());
    } catch (e) {
        hoja.removeAttribute('aria-busy');
        hoja.innerHTML = '<p class="hoja-vacia">No pudimos cargar la hoja de vida. Revisa tu conexión e intenta de nuevo.</p>';
    }
}

document.addEventListener('DOMContentLoaded', iniciarHoja);
