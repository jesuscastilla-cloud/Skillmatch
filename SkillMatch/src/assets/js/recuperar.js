/**
 * "¿Olvidaste tu contraseña?" (docs/CAMBIOS-FRONTEND.md, F11).
 * Paso 1: el correo -> el servidor envía un código (responde igual exista o no la cuenta).
 * Paso 2: código + contraseña nueva -> se cambia y se cierran las demás sesiones.
 */
document.addEventListener('DOMContentLoaded', function () {
    const paso1 = document.getElementById('recuperar-paso1');
    const paso2 = document.getElementById('recuperar-paso2');
    if (!paso1 || !paso2) return;

    const errorMessage = document.getElementById('error-message');
    const successMessage = document.getElementById('success-message');
    const nota = document.getElementById('recuperar-nota');
    const reenviar = document.getElementById('recuperar-reenviar');
    const irLogin = document.getElementById('recuperar-ir-login');
    const ESPERA_REENVIO = 60; // el servidor envía un código por minuto
    let correo = '';
    let reloj = null;

    function mostrar(caja, texto) {
        errorMessage.style.display = 'none';
        successMessage.style.display = 'none';
        if (!texto) return;
        caja.textContent = texto;
        caja.style.display = 'block';
    }
    const error = texto => mostrar(errorMessage, texto);
    const exito = texto => mostrar(successMessage, texto);

    /** El texto que manda el servidor: {message} o, si falló la validación, {campo: mensaje}. */
    async function textoDelServidor(response, porDefecto) {
        try {
            const datos = await response.json();
            if (datos.message) return datos.message;
            const primero = Object.values(datos).find(v => typeof v === 'string');
            if (primero) return primero;
        } catch (_) { /* sin cuerpo JSON */ }
        return porDefecto;
    }

    async function enviar(ruta, cuerpo) {
        return fetch(`${API_CONFIG.BASE_URL}${ruta}`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cuerpo)
        });
    }

    function ocupado(boton, siNo, texto) {
        boton.disabled = siNo;
        if (siNo) { boton.dataset.texto = boton.textContent; boton.textContent = texto; }
        else if (boton.dataset.texto) boton.textContent = boton.dataset.texto;
    }

    /** "Pedir otro código" se habilita cuando el servidor ya deja enviar otro. */
    function esperarReenvio() {
        let quedan = ESPERA_REENVIO;
        clearInterval(reloj);
        reenviar.disabled = true;
        reenviar.textContent = `Pedir otro código (${quedan} s)`;
        reloj = setInterval(() => {
            quedan -= 1;
            if (quedan > 0) {
                reenviar.textContent = `Pedir otro código (${quedan} s)`;
            } else {
                clearInterval(reloj);
                reenviar.disabled = false;
                reenviar.textContent = 'Pedir otro código';
            }
        }, 1000);
    }

    /** Pide el código. Devuelve true si el servidor lo aceptó. */
    async function pedirCodigo(boton) {
        ocupado(boton, true, 'Enviando...');
        try {
            const response = await enviar('/auth/forgot-password', { email: correo });
            if (!response.ok) {
                error(await textoDelServidor(response, 'No se pudo enviar el código. Intenta de nuevo.'));
                return false;
            }
            exito(await textoDelServidor(response, 'Si el correo tiene cuenta, te enviamos un código.'));
            return true;
        } catch (_) {
            error('Error de conexión. Por favor, verifica que el servidor esté corriendo e intenta de nuevo.');
            return false;
        } finally {
            ocupado(boton, false);
        }
    }

    // ---------- Paso 1 ----------
    paso1.addEventListener('submit', async function (e) {
        e.preventDefault();
        const campo = document.getElementById('recuperar-email');
        correo = campo.value.trim();
        if (!correo || !campo.checkValidity()) {
            error(!correo ? 'Escribe tu correo.' : 'Ese correo no parece bien escrito.');
            campo.focus();
            return;
        }
        if (await pedirCodigo(paso1.querySelector('button[type="submit"]'))) {
            nota.textContent = `Escribe el código que llegó a ${correo} y tu contraseña nueva.`;
            paso1.hidden = true;
            paso2.hidden = false;
            esperarReenvio();
            document.getElementById('recuperar-codigo').focus();
        }
    });

    // ---------- Paso 2 ----------
    paso2.addEventListener('submit', async function (e) {
        e.preventDefault();
        const codigo = document.getElementById('recuperar-codigo').value.replace(/\s/g, '');
        const clave = document.getElementById('recuperar-clave').value;
        const clave2 = document.getElementById('recuperar-clave2').value;

        let problema = '', campo = '';
        if (!/^\d{6}$/.test(codigo)) { problema = 'El código tiene 6 números.'; campo = 'recuperar-codigo'; }
        else if (clave.length < 8 || clave.length > 72) { problema = 'La contraseña debe tener entre 8 y 72 caracteres.'; campo = 'recuperar-clave'; }
        else if (clave !== clave2) { problema = 'Las dos contraseñas no coinciden.'; campo = 'recuperar-clave2'; }
        if (problema) {
            error(problema);
            document.getElementById(campo).focus();
            return;
        }

        const boton = paso2.querySelector('button[type="submit"]');
        ocupado(boton, true, 'Cambiando...');
        try {
            const response = await enviar('/auth/reset-password', { email: correo, codigo, newPassword: clave });
            if (!response.ok) {
                error(await textoDelServidor(response, 'No se pudo cambiar la contraseña. Intenta de nuevo.'));
                return;
            }
            // El servidor cerró todas las sesiones: la que hubiera en este navegador ya no sirve
            if (typeof limpiarSesion === 'function') limpiarSesion();
            clearInterval(reloj);
            paso2.hidden = true;
            irLogin.hidden = false;
            document.getElementById('recuperar-titulo').textContent = 'Contraseña cambiada';
            exito(await textoDelServidor(response, 'Listo: tu contraseña quedó cambiada. Ya puedes iniciar sesión.'));
            irLogin.focus();
        } catch (_) {
            error('Error de conexión. Por favor, verifica que el servidor esté corriendo e intenta de nuevo.');
        } finally {
            ocupado(boton, false);
        }
    });

    reenviar.addEventListener('click', async function () {
        if (await pedirCodigo(reenviar)) esperarReenvio();
    });

    document.getElementById('recuperar-otro-correo').addEventListener('click', function () {
        clearInterval(reloj);
        paso2.reset();
        paso2.hidden = true;
        paso1.hidden = false;
        mostrar(null);
        document.getElementById('recuperar-email').focus();
    });
});
