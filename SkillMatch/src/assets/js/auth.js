document.addEventListener('DOMContentLoaded', function () {
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
            const msg = 'Por favor, completa todos los campos';
            if (errorMessage) { errorMessage.textContent = msg; errorMessage.style.display = 'block'; }
            else alert(msg);
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
                const data = await response.json();
                saveToken(data.token);

                const role = data.role || 'USER';
                const isEmpresa = role === 'EMPRESA' || role === 'ROLE_EMPRESA';

                if (isEmpresa && !data.companyId) {
                    const msg = 'Tu cuenta no tiene una empresa asociada. Contacta al administrador.';
                    if (errorMessage) { errorMessage.textContent = msg; errorMessage.style.display = 'block'; }
                    else alert(msg);
                    loginBtn.disabled = false;
                    loginBtn.textContent = 'Iniciar sesión';
                    return;
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
