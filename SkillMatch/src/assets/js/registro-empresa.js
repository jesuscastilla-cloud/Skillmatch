// Registro de empresas
//
// Antes pedía NIT, sector, tamaño, sitio web, contacto, ciudad, dirección,
// perfiles buscados, modalidad, experiencia, rango salarial y el RUT en PDF,
// pero solo se enviaban nombre, correo y teléfono (y la descripción, que era
// obligatoria, tampoco se guardaba). Ahora se pide solo lo que se guarda. Lo
// demás vuelve cuando el backend deje a la empresa editar sus datos (hoy
// PUT /companies/{id} es solo para administradores).

document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('form-registro-empresa');
    if (!form) return;

    const pasos = Array.from(form.querySelectorAll('.form-step'));
    const pestanas = Array.from(form.querySelectorAll('.stepper .step'));
    let actual = 0;

    const valor = id => document.getElementById(id).value.trim();

    // ---- La tarjeta de tu empresa se arma mientras escribes (revision 2026-11-13) ----
    // La misma idea que el registro de persona: al lado del formulario, como la veran las
    // personas que buscan trabajo. Solo una vista (aria-hidden); en el celular no aparece.
    (function tarjetaDeEmpresa() {
        const contenedor = form.parentElement;
        if (!contenedor || contenedor.querySelector('.registro-vista-previa')) return;
        const icono = n => (window.SkillMatchUI ? SkillMatchUI.icono(n) : '');
        const vista = document.createElement('aside');
        vista.className = 'registro-vista-previa vp-empresa';
        vista.setAttribute('aria-hidden', 'true');
        vista.innerHTML =
            '<p class="vp-titulo">Así te verán las personas</p>' +
            '<div class="vp-tarjeta">' +
                '<div class="vp-portada"></div>' +
                '<div class="vp-avatar vp-logo"><span>' + icono('building') + '</span></div>' +
                '<p class="vp-nombre vp-vacio">Tu empresa</p>' +
                '<p class="vp-titular">Busca personas en SkillMatch</p>' +
                '<p class="vp-descripcion vp-vacio">A qué se dedica tu empresa y a quién buscas.</p>' +
                '<p class="vp-ciudad">' + icono('briefcase') + '<span>Tus vacantes aparecerán aquí</span></p>' +
            '</div>';
        form.after(vista);
        // Una clase en lugar de :has() en el CSS: :has() hacia mas lento recalcular estilos en todo el sitio
        contenedor.classList.add('con-vista-previa');
        const $ = s => vista.querySelector(s);
        const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const llega = (el, desde) => { if (!reducido && el.animate) el.animate([Object.assign({ offset: 0 }, desde)], { duration: 420, easing: 'cubic-bezier(.16, 1, .3, 1)', fill: 'backwards' }); };
        function pintar() {
            const nombre = valor('empresa-nombre');
            const n = $('.vp-nombre');
            if (n.classList.contains('vp-vacio') && nombre) llega(n, { opacity: 0, transform: 'translateY(6px)' });
            n.textContent = nombre || 'Tu empresa';
            n.classList.toggle('vp-vacio', !nombre);
            const iniciales = nombre.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('');
            const logo = $('.vp-logo span');
            if (iniciales && logo.textContent !== iniciales) {
                if (!logo.textContent) llega($('.vp-logo'), { transform: 'scale(.8) rotate(-6deg)' });
                logo.textContent = iniciales;
            } else if (!iniciales && logo.textContent) logo.innerHTML = icono('building');
            const d = valor('empresa-descripcion');
            const desc = $('.vp-descripcion');
            desc.textContent = d ? (d.length > 160 ? d.slice(0, 157) + '…' : d) : 'A qué se dedica tu empresa y a quién buscas.';
            desc.classList.toggle('vp-vacio', !d);
        }
        ['empresa-nombre', 'empresa-descripcion'].forEach(id => {
            const campo = document.getElementById(id);
            if (campo) campo.addEventListener('input', pintar);
        });
        pintar();
    })();

    function mostrar(indice) {
        pasos.forEach((p, i) => {
            p.classList.toggle('active', i === indice);
            p.setAttribute('aria-hidden', String(i !== indice));
        });
        pestanas.forEach((t, i) => {
            t.classList.toggle('active', i === indice);
            t.classList.toggle('completed', i < indice);
            t.setAttribute('aria-selected', String(i === indice));
        });
        actual = indice;
        const primero = pasos[indice].querySelector('input');
        if (primero) primero.focus();
    }

    // El campo que fallo en la ultima revision: el error queda unido a el (aria-invalid y
    // aria-describedby, ui.js) y recibe el foco, asi se sabe que corregir (revision 2026-11-13)
    let campoMal = '';
    const mal = (id, texto) => { campoMal = id; return texto; };

    function error(paso, mensaje) {
        const aviso = pasos[paso].querySelector('.error-text');
        aviso.textContent = mensaje || '';
        aviso.hidden = !mensaje;
        if (!aviso.id) aviso.id = 'error-paso-' + (paso + 1);
        if (window.SkillMatchUI && SkillMatchUI.desmarcarCampos) SkillMatchUI.desmarcarCampos(pasos[paso]);
        const campo = mensaje && campoMal && document.getElementById(campoMal);
        campoMal = '';
        if (campo && window.SkillMatchUI && SkillMatchUI.marcarCampo) {
            SkillMatchUI.marcarCampo(campo, aviso.id);
            campo.focus({ preventScroll: true });
        }
        if (mensaje) aviso.scrollIntoView({ block: 'nearest' });
    }

    function validarCuenta() {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor('empresa-email'))) return mal('empresa-email', 'Escribe un correo válido para la empresa.');
        const clave = document.getElementById('empresa-pass').value;
        if (clave.length < 8) return mal('empresa-pass', 'La contraseña debe tener al menos 8 caracteres.');
        if (clave !== document.getElementById('empresa-pass2').value) return mal('empresa-pass2', 'Las contraseñas no coinciden.');
        return '';
    }

    function validarEmpresa() {
        const enNombre = Validar.empresa(valor('empresa-nombre'));
        if (enNombre) return mal('empresa-nombre', enNombre);
        if (!/^\+?[\d\s-]{7,20}$/.test(valor('empresa-telefono'))) return mal('empresa-telefono', 'Escribe un teléfono válido, solo con números.');
        if (valor('empresa-descripcion').length < 20) return mal('empresa-descripcion', 'Cuéntanos un poco más sobre la empresa (al menos 20 caracteres).');
        if (!document.getElementById('empresa-terminos').checked) return mal('empresa-terminos', 'Para crear la cuenta debes aceptar la política de tratamiento de datos.');
        return '';
    }

    document.getElementById('next-step-emp-1').addEventListener('click', () => {
        const problema = validarCuenta();
        error(0, problema);
        if (!problema) mostrar(1);
    });
    document.getElementById('prev-step-emp-2').addEventListener('click', () => mostrar(0));

    /** Con la cuenta ya creada: guarda la sesión, la descripción y lleva al perfil. */
    async function terminar(datos) {
        guardarSesion(datos.expiresAt); // el token queda solo en la cookie httpOnly (F4)
        // userType: sin él, hasta volver a entrar, el sitio la trataba como
        // una persona (por ejemplo, le mostraba "Postularme" en Vacantes)
        saveUserData({
            id: datos.id,
            companyId: datos.companyId || null,
            firstName: datos.firstName,
            lastName: datos.lastName,
            email: datos.email,
            role: datos.role,
            userType: 'empresa'
        });

        // La descripción va a "Acerca de nosotros" (antes se pedía y se perdía)
        let guardada = false;
        if (datos.companyId) {
            guardada = await fetchWithAuth(`/companies/${datos.companyId}/description`, {
                method: 'PATCH',
                body: JSON.stringify({ description: valor('empresa-descripcion') })
            }).then(r => r.ok).catch(() => false);
        }

        alert(guardada
            ? '¡Bienvenido a SkillMatch! Ya puedes publicar tu primera vacante.'
            : 'La cuenta quedó creada, pero la descripción no se guardó. Agrégala en "Acerca de nosotros".');
        const volver = typeof destinoPedido === 'function' ? destinoPedido() : '';
        window.location.href = volver && !/^(perfil-usuario|hoja-de-vida|conexiones)\.html(\?(?!id=)|$)/.test(volver) ? volver : 'perfil-empresa.html';
    }

    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        if (actual === 0) {
            document.getElementById('next-step-emp-1').click();
            return;
        }
        const enCuenta = validarCuenta();
        if (enCuenta) { mostrar(0); error(0, enCuenta); return; }
        const enEmpresa = validarEmpresa();
        error(1, enEmpresa);
        if (enEmpresa) return;

        const boton = form.querySelector('button[type="submit"]');
        boton.disabled = true;
        boton.textContent = 'Creando la cuenta…';

        try {
            const respuesta = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.REGISTRO_EMPRESA}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({
                    email: valor('empresa-email'),
                    password: document.getElementById('empresa-pass').value,
                    firstName: valor('empresa-nombre'),
                    lastName: 'Empresa',
                    phone: valor('empresa-telefono'),
                    userType: 'EMPRESA',
                    // Prueba de la autorización (Ley 1581): el servidor guarda qué se aceptó, versión y fecha
                    aceptaPolitica: document.getElementById('empresa-terminos').checked
                })
            });

            if (!respuesta.ok) {
                const cuerpo = await respuesta.json().catch(() => ({}));
                const mensaje = cuerpo.message || cuerpo.error || 'No se pudo crear la cuenta.';
                if (/correo|email/i.test(mensaje)) { mostrar(0); error(0, mensaje); } else { error(1, mensaje); }
                boton.disabled = false;
                boton.textContent = 'Crear la cuenta';
                return;
            }

            // 202: el servidor pide confirmar el correo (F10); la cuenta se crea con el código
            if (respuesta.status === 202) {
                RegistroCodigo.mostrar({
                    correo: valor('empresa-email'),
                    ocultar: [form, document.querySelector('.google-registro')],
                    alEntrar: terminar,
                    alCorregir: () => {
                        boton.disabled = false;
                        boton.textContent = 'Crear la cuenta';
                        mostrar(0);
                    }
                });
                return;
            }

            await terminar(await respuesta.json());
        } catch (err) {
            error(1, 'No pudimos conectar con SkillMatch. Revisa tu conexión e intenta de nuevo.');
            boton.disabled = false;
            boton.textContent = 'Crear la cuenta';
        }
    });
});
