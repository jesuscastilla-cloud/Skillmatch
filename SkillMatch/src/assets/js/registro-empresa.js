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

    function error(paso, mensaje) {
        const aviso = pasos[paso].querySelector('.error-text');
        aviso.textContent = mensaje || '';
        aviso.hidden = !mensaje;
        if (mensaje) aviso.scrollIntoView({ block: 'nearest' });
    }

    function validarCuenta() {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor('empresa-email'))) return 'Escribe un correo válido para la empresa.';
        const clave = document.getElementById('empresa-pass').value;
        if (clave.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
        if (clave !== document.getElementById('empresa-pass2').value) return 'Las contraseñas no coinciden.';
        return '';
    }

    function validarEmpresa() {
        const enNombre = Validar.empresa(valor('empresa-nombre'));
        if (enNombre) return enNombre;
        if (!/^\+?[\d\s-]{7,20}$/.test(valor('empresa-telefono'))) return 'Escribe un teléfono válido, solo con números.';
        if (valor('empresa-descripcion').length < 20) return 'Cuéntanos un poco más sobre la empresa (al menos 20 caracteres).';
        if (!document.getElementById('empresa-terminos').checked) return 'Para crear la cuenta debes aceptar la política de tratamiento de datos.';
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
        window.location.href = 'perfil-empresa.html';
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
