// Registro de personas que buscan trabajo
//
// Antes el formulario tenía tres pasos y exigía profesión, área, años de
// experiencia, estudios, departamento, modalidad, contrato, aspiración
// salarial y hasta la hoja de vida en PDF, pero solo se enviaban nombre,
// correo, teléfono y contraseña: todo lo demás se perdía. Ahora se pide solo
// lo que SkillMatch guarda, y el paso 2 queda en el perfil recién creado.

document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('form-registro-usuario');
    if (!form) return;

    const pasos = Array.from(form.querySelectorAll('.form-step'));
    const pestanas = Array.from(form.querySelectorAll('.stepper .step'));
    const etiquetas = SkillMatchUI.etiquetas(
        document.getElementById('usuario-habilidades'),
        document.getElementById('usuario-habilidad')
    );
    let actual = 0;

    const valor = id => document.getElementById(id).value.trim();

    // ---- Tu tarjeta se arma mientras escribes (plan, fase 4 §5; revision 2026-11-13) ----
    // Al lado del formulario (en pantallas anchas) va la tarjeta con la que te veran las
    // empresas: el nombre aparece al escribirlo, cada habilidad llega como una pieza y la
    // ciudad pone su pin. Es solo una vista: el lector de pantalla ya tiene los campos.
    (function tarjetaQueSeArma() {
        const contenedor = form.parentElement;
        if (!contenedor || contenedor.querySelector('.registro-vista-previa')) return;
        const icono = n => (window.SkillMatchUI ? SkillMatchUI.icono(n) : '');
        const vista = document.createElement('aside');
        vista.className = 'registro-vista-previa';
        vista.setAttribute('aria-hidden', 'true');
        vista.innerHTML =
            '<p class="vp-titulo">Así te verán las empresas</p>' +
            '<div class="vp-tarjeta">' +
                '<div class="vp-portada"></div>' +
                '<div class="vp-avatar"><span>Tú</span></div>' +
                '<p class="vp-nombre vp-vacio">Tu nombre</p>' +
                '<p class="vp-titular vp-vacio">A qué te dedicas</p>' +
                '<p class="vp-ciudad">' + icono('pin') + '<span></span></p>' +
                '<div class="vp-habilidades"><span class="vp-hueco">Tus habilidades</span><span class="vp-hueco"></span><span class="vp-hueco"></span></div>' +
                '<div class="vp-avance"><span class="vp-barra"><span></span></span><span class="vp-cuenta">0 %</span></div>' +
            '</div>';
        form.after(vista);
        // Una clase en lugar de :has() en el CSS: :has() hacia mas lento recalcular estilos en todo el sitio
        contenedor.classList.add('con-vista-previa');
        const $ = s => vista.querySelector(s);
        const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const llega = (el, desde) => { if (!reducido && el.animate) el.animate([Object.assign({ offset: 0 }, desde)], { duration: 420, easing: 'cubic-bezier(.16, 1, .3, 1)', fill: 'backwards' }); };
        const texto = (sel, valorActual, vacio) => {
            const el = $(sel);
            const antes = el.classList.contains('vp-vacio');
            el.textContent = valorActual || vacio;
            el.classList.toggle('vp-vacio', !valorActual);
            if (antes && valorActual) llega(el, { opacity: 0, transform: 'translateY(6px)' });
        };
        function pintar() {
            const nombre = [valor('usuario-nombre'), valor('usuario-apellidos')].filter(Boolean).join(' ');
            texto('.vp-nombre', nombre, 'Tu nombre');
            texto('.vp-titular', valor('usuario-titular'), 'A qué te dedicas');
            const iniciales = nombre.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('');
            const avatar = $('.vp-avatar span');
            if (avatar.textContent !== (iniciales || 'Tú')) {
                avatar.textContent = iniciales || 'Tú';
                if (iniciales.length === 1 && avatar.dataset.lleno !== '1') llega($('.vp-avatar'), { transform: 'scale(.8)' });
                avatar.dataset.lleno = iniciales ? '1' : '';
            }
            $('.vp-ciudad span').textContent = valor('usuario-ciudad') || 'Tu ciudad';
            // Que tan completa va la tarjeta: lo mismo que mira el perfil
            const hechos = [nombre, valor('usuario-titular'), valor('usuario-ciudad'), etiquetas.obtener().length, valor('usuario-sobre-mi')].filter(Boolean).length;
            const pct = Math.round(hechos / 5 * 100);
            $('.vp-barra > span').style.transform = 'scaleX(' + (pct / 100) + ')';
            $('.vp-cuenta').textContent = pct + ' %';
        }
        let anteriores = [];
        function pintarHabilidades() {
            const lista = etiquetas.obtener();
            const caja = $('.vp-habilidades');
            caja.innerHTML = lista.length ? '' : '<span class="vp-hueco">Tus habilidades</span><span class="vp-hueco"></span><span class="vp-hueco"></span>';
            lista.forEach(h => {
                const chip = document.createElement('span');
                chip.className = 'vp-habilidad';
                chip.textContent = h;
                caja.appendChild(chip);
                // Solo la nueva llega, como una pieza que encaja
                if (!anteriores.includes(h)) llega(chip, { opacity: 0, transform: 'translateY(-14px) scale(.8)' });
            });
            anteriores = lista.slice();
            pintar();
        }
        ['usuario-nombre', 'usuario-apellidos', 'usuario-titular', 'usuario-ciudad', 'usuario-sobre-mi'].forEach(id => {
            const campo = document.getElementById(id);
            if (campo) campo.addEventListener('input', pintar);
        });
        new MutationObserver(pintarHabilidades).observe(document.getElementById('usuario-habilidades'), { childList: true });
        pintar();
    })();

    function mostrar(indice) {
        pasos.forEach((p, i) => p.classList.toggle('active', i === indice));
        pestanas.forEach((t, i) => {
            t.classList.toggle('active', i === indice);
            t.classList.toggle('completed', i < indice);
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
        const vacio = ['usuario-nombre', 'usuario-apellidos', 'usuario-email', 'usuario-telefono'].find(id => !valor(id));
        if (vacio) return mal(vacio, 'Completa tu nombre, tus apellidos, tu correo y tu teléfono.');
        // Solo letras, espacios, - y ' (las mismas reglas que el servidor)
        const enNombre = Validar.persona(valor('usuario-nombre'), 'El nombre');
        if (enNombre) return mal('usuario-nombre', enNombre);
        const enApellido = Validar.persona(valor('usuario-apellidos'), 'El apellido');
        if (enApellido) return mal('usuario-apellidos', enApellido);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor('usuario-email'))) return mal('usuario-email', 'Escribe un correo válido, por ejemplo nombre@gmail.com.');
        if (!/^\+?[\d\s-]{7,20}$/.test(valor('usuario-telefono'))) return mal('usuario-telefono', 'Escribe un teléfono válido, solo con números.');
        const clave = document.getElementById('usuario-pass').value;
        if (clave.length < 8) return mal('usuario-pass', 'La contraseña debe tener al menos 8 caracteres.');
        if (clave !== document.getElementById('usuario-pass2').value) return mal('usuario-pass2', 'Las contraseñas no coinciden.');
        return '';
    }

    document.getElementById('next-step-1').addEventListener('click', () => {
        const problema = validarCuenta();
        error(0, problema);
        if (!problema) mostrar(1);
    });
    document.getElementById('prev-step-2').addEventListener('click', () => mostrar(0));

    /** Con la cuenta ya creada: guarda la sesión, lo del paso 2 y lleva al perfil. */
    async function terminar(datos) {
        guardarSesion(datos.expiresAt); // el token queda solo en la cookie httpOnly (F4)
        saveUserData({
            id: datos.id,
            companyId: null,
            firstName: datos.firstName,
            lastName: datos.lastName,
            email: datos.email,
            role: datos.role || 'USER',
            userType: 'usuario'
        });

        // Lo del paso 2 se guarda en el perfil recién creado
        const perfil = {};
        if (valor('usuario-titular')) perfil.headline = valor('usuario-titular');
        if (valor('usuario-ciudad')) perfil.location = valor('usuario-ciudad');
        if (valor('usuario-sobre-mi')) perfil.bio = valor('usuario-sobre-mi');
        const guardados = [];
        if (Object.keys(perfil).length) {
            guardados.push(fetchWithAuth(`/users/${datos.id}`, { method: 'PUT', body: JSON.stringify(perfil) }));
        }
        etiquetas.obtener().forEach(nombre => {
            guardados.push(fetchWithAuth(`/users/${datos.id}/skills`, {
                method: 'POST',
                body: JSON.stringify({ name: nombre, level: 'INTERMEDIO' })
            }));
        });
        const resultados = await Promise.all(guardados.map(p => p.then(r => r.ok).catch(() => false)));
        const fallas = resultados.filter(ok => !ok).length;

        alert(fallas
            ? 'Tu perfil quedó creado, pero algunos datos no se guardaron. Complétalos desde tu perfil.'
            : '¡Bienvenido a SkillMatch! Tu perfil quedó creado.');
        // Si venia de una vacante (?volver= desde el login), vuelve alla
        const volver = typeof destinoPedido === 'function' ? destinoPedido() : '';
        window.location.href = volver && !/^perfil-empresa\.html/.test(volver) ? volver : 'perfil-usuario.html';
    }

    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        // Enter en el paso 1 pasa al siguiente en vez de enviar
        if (actual === 0) {
            document.getElementById('next-step-1').click();
            return;
        }

        const problema = validarCuenta();
        if (problema) { mostrar(0); error(0, problema); return; }
        if (!document.getElementById('usuario-mayor').checked) {
            mal('usuario-mayor');
            error(1, 'Para registrarte en SkillMatch debes tener 18 años o más.');
            return;
        }
        if (!document.getElementById('usuario-terminos').checked) {
            mal('usuario-terminos');
            error(1, 'Para crear tu perfil debes aceptar la política de tratamiento de datos.');
            return;
        }
        error(1, '');

        const boton = form.querySelector('button[type="submit"]');
        boton.disabled = true;
        boton.textContent = 'Creando tu perfil…';

        try {
            const respuesta = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.REGISTRO_USUARIO}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: valor('usuario-email'),
                    password: document.getElementById('usuario-pass').value,
                    firstName: valor('usuario-nombre'),
                    lastName: valor('usuario-apellidos'),
                    phone: valor('usuario-telefono'),
                    userType: 'USER',
                    // Prueba de la autorización (Ley 1581): el servidor guarda qué se aceptó, versión y fecha
                    aceptaPolitica: document.getElementById('usuario-terminos').checked,
                    mayorDeEdad: document.getElementById('usuario-mayor').checked
                })
            });

            if (!respuesta.ok) {
                const cuerpo = await respuesta.json().catch(() => ({}));
                const mensaje = cuerpo.message || cuerpo.error || 'No se pudo crear la cuenta.';
                // Un correo repetido o un nombre que no vale se corrigen en el paso 1
                if (/correo|email|nombre|apellido/i.test(mensaje)) { mostrar(0); error(0, mensaje); } else { error(1, mensaje); }
                boton.disabled = false;
                boton.textContent = 'Crear mi perfil';
                return;
            }

            // 202: el servidor pide confirmar el correo (F10); la cuenta se crea con el código
            if (respuesta.status === 202) {
                RegistroCodigo.mostrar({
                    correo: valor('usuario-email'),
                    ocultar: [form, document.querySelector('.google-registro')],
                    alEntrar: terminar,
                    alCorregir: () => {
                        boton.disabled = false;
                        boton.textContent = 'Crear mi perfil';
                        mostrar(0);
                    }
                });
                return;
            }

            await terminar(await respuesta.json());
        } catch (err) {
            error(1, 'No pudimos conectar con SkillMatch. Revisa tu conexión e intenta de nuevo.');
            boton.disabled = false;
            boton.textContent = 'Crear mi perfil';
        }
    });
});
