/**
 * Lo que pasa cuando el servidor ya dijo "sí" (login o vuelta de Google):
 * guarda la sesión y lleva al perfil. Devuelve false si no se pudo entrar.
 */
function completarEntrada(data) {
    const errorMessage = document.getElementById('error-message');
    const successMessage = document.getElementById('success-message');

    saveToken(data.token);

    const role = data.role || 'USER';
    const isEmpresa = role === 'EMPRESA' || role === 'ROLE_EMPRESA';

    if (isEmpresa && !data.companyId) {
        const msg = 'Tu cuenta no tiene una empresa asociada. Contacta al administrador.';
        if (errorMessage) { errorMessage.textContent = msg; errorMessage.style.display = 'block'; }
        else alert(msg);
        return false;
    }

    saveUserData({
        id: data.id,
        companyId: data.companyId || null,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        role,
        userType: isEmpresa ? 'empresa' : 'usuario'
    });

    if (successMessage) {
        successMessage.textContent = '¡Inicio de sesión exitoso! Redirigiendo...';
        successMessage.style.display = 'block';
    }

    setTimeout(() => {
        window.location.href = isEmpresa ? 'perfil-empresa.html' : 'perfil-usuario.html';
    }, 1000);
    return true;
}

/* ---------- Entrar con Google (docs/CAMBIOS-FRONTEND.md, F13) ---------- */

// Lo que el backend pone en "#google-error=<motivo>" al volver de Google
const MENSAJES_GOOGLE = {
    cancelado: 'Cancelaste la entrada con Google.',
    correo_no_verificado: 'Google no confirma ese correo. Verifícalo en Google o regístrate con tu correo.',
    cuenta_desactivada: 'Esta cuenta está desactivada.',
    consentimiento: 'Para crear tu cuenta, acepta la política de datos en el registro.',
    error: 'No se pudo entrar con Google. Intenta de nuevo.'
};

/** Muestra el botón solo si el servidor tiene Google configurado. */
async function prepararBotonGoogle() {
    const bloques = document.querySelectorAll('.google-entrar');
    if (!bloques.length) return;
    try {
        const r = await fetch(`${API_CONFIG.BASE_URL}/auth/google/disponible`);
        if (!r.ok || !(await r.json()).disponible) return;
    } catch (_) {
        return; // sin servidor no hay botón; el resto de la página sigue igual
    }
    // La ida a Google la atiende el backend fuera de /api (en local, el puerto 8080)
    const base = API_CONFIG.BASE_URL.replace(/\/api\/?$/, '');
    bloques.forEach(bloque => {
        const enlace = bloque.querySelector('.btn-google');
        // data-tipo="EMPRESA" (login de empresas) o data-params="tipo=EMPRESA&acepta=1" (registros)
        const params = new URLSearchParams(enlace.getAttribute('data-params') || '');
        if (enlace.getAttribute('data-tipo')) params.set('tipo', enlace.getAttribute('data-tipo'));
        const consulta = params.toString();
        enlace.href = `${base}/oauth2/authorization/google${consulta ? '?' + consulta : ''}`;
        bloque.hidden = false;
    });
}

/** Al volver de Google: "#google=<código>" o "#google-error=<motivo>". */
async function volverDeGoogle() {
    const datos = new URLSearchParams(window.location.hash.slice(1));
    const codigo = datos.get('google');
    const motivo = datos.get('google-error');
    if (!codigo && !motivo) return;

    // Primero se borra de la barra: el código no queda en el historial ni se reenvía al recargar
    history.replaceState(null, '', window.location.pathname + window.location.search);

    const errorMessage = document.getElementById('error-message');
    const successMessage = document.getElementById('success-message');
    const mostrarError = msg => {
        if (successMessage) successMessage.style.display = 'none';
        if (errorMessage) { errorMessage.textContent = msg; errorMessage.style.display = 'block'; }
        else alert(msg);
    };

    if (motivo) {
        mostrarError(MENSAJES_GOOGLE[motivo] || MENSAJES_GOOGLE.error);
        return;
    }

    if (successMessage) {
        successMessage.textContent = 'Entrando con Google...';
        successMessage.style.display = 'block';
    }
    try {
        const response = await fetch(`${API_CONFIG.BASE_URL}/auth/google/canjear`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ codigo })
        });
        if (response.ok) {
            completarEntrada(await response.json());
            return;
        }
        let msg = MENSAJES_GOOGLE.error;
        try { msg = (await response.json()).message || msg; } catch (_) {}
        mostrarError(msg);
    } catch (_) {
        mostrarError('Error de conexión. Por favor, verifica que el servidor esté corriendo e intenta de nuevo.');
    }
}

document.addEventListener('DOMContentLoaded', function () {
    prepararBotonGoogle();
    volverDeGoogle();

    const loginForm = document.getElementById('empresa-login-form')
                   || document.getElementById('usuario-login-form')
                   || document.querySelector('#loginForm form');

    if (!loginForm) return;

    loginForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const loginBtn = document.getElementById('login-btn') || e.target.querySelector('button[type="submit"]');
        const errorMessage = document.getElementById('error-message');
        const successMessage = document.getElementById('success-message');

        if (errorMessage) errorMessage.style.display = 'none';
        if (successMessage) successMessage.style.display = 'none';

        if (!email || !password) {
            // Dice qué falta y lleva el foco ahí, como el registro
            const msg = !email && !password ? 'Escribe tu correo y tu contraseña.' : (!email ? 'Escribe tu correo.' : 'Escribe tu contraseña.');
            if (errorMessage) { errorMessage.textContent = msg; errorMessage.style.display = 'block'; }
            else alert(msg);
            document.getElementById(!email ? 'email' : 'password').focus();
            return;
        }

        loginBtn.disabled = true;
        loginBtn.textContent = 'Iniciando sesión...';

        try {
            const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.LOGIN}`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            if (response.ok) {
                if (!completarEntrada(await response.json())) {
                    loginBtn.disabled = false;
                    loginBtn.textContent = 'Iniciar sesión';
                }
            } else {
                let errorText = 'Credenciales inválidas. Por favor, verifica tu correo y contraseña.';
                try {
                    const errorData = await response.json();
                    errorText = errorData.message || errorText;
                } catch (_) {}
                if (errorMessage) { errorMessage.textContent = errorText; errorMessage.style.display = 'block'; }
                else alert(errorText);
                loginBtn.disabled = false;
                loginBtn.textContent = 'Iniciar sesión';
            }

        } catch (error) {
            const msg = 'Error de conexión. Por favor, verifica que el servidor esté corriendo e intenta de nuevo.';
            if (errorMessage) { errorMessage.textContent = msg; errorMessage.style.display = 'block'; }
            else alert(msg);
            loginBtn.disabled = false;
            loginBtn.textContent = 'Iniciar sesión';
        }
    });
});
