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

    function error(paso, mensaje) {
        const aviso = pasos[paso].querySelector('.error-text');
        aviso.textContent = mensaje || '';
        aviso.hidden = !mensaje;
        if (mensaje) aviso.scrollIntoView({ block: 'nearest' });
    }

    function validarCuenta() {
        if (!valor('usuario-nombre') || !valor('usuario-apellidos') || !valor('usuario-email') || !valor('usuario-telefono')) {
            return 'Completa tu nombre, tus apellidos, tu correo y tu teléfono.';
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor('usuario-email'))) return 'Escribe un correo válido, por ejemplo nombre@gmail.com.';
        if (!/^\+?[\d\s-]{7,20}$/.test(valor('usuario-telefono'))) return 'Escribe un teléfono válido, solo con números.';
        const clave = document.getElementById('usuario-pass').value;
        if (clave.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
        if (clave !== document.getElementById('usuario-pass2').value) return 'Las contraseñas no coinciden.';
        return '';
    }

    document.getElementById('next-step-1').addEventListener('click', () => {
        const problema = validarCuenta();
        error(0, problema);
        if (!problema) mostrar(1);
    });
    document.getElementById('prev-step-2').addEventListener('click', () => mostrar(0));

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
            error(1, 'Para registrarte en SkillMatch debes tener 18 años o más.');
            return;
        }
        if (!document.getElementById('usuario-terminos').checked) {
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
                    userType: 'USER'
                })
            });

            if (!respuesta.ok) {
                const cuerpo = await respuesta.json().catch(() => ({}));
                const mensaje = cuerpo.message || cuerpo.error || 'No se pudo crear la cuenta.';
                // Un correo repetido se corrige en el paso 1
                if (/correo|email/i.test(mensaje)) { mostrar(0); error(0, mensaje); } else { error(1, mensaje); }
                boton.disabled = false;
                boton.textContent = 'Crear mi perfil';
                return;
            }

            const datos = await respuesta.json();
            saveToken(datos.token);
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
            window.location.href = 'perfil-usuario.html';
        } catch (err) {
            error(1, 'No pudimos conectar con SkillMatch. Revisa tu conexión e intenta de nuevo.');
            boton.disabled = false;
            boton.textContent = 'Crear mi perfil';
        }
    });
});
