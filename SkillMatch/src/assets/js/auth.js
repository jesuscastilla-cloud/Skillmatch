// Funciones globales requeridas por onclick en login.html
function showRecovery() {
    document.getElementById('loginForm').classList.remove('active');
    document.getElementById('recoveryFlow').classList.add('active');
}

function showLoginForm() {
    const rec = document.getElementById('recoveryFlow');
    if (rec) rec.classList.remove('active');
    document.getElementById('loginForm').classList.add('active');
}

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
                    loginBtn.textContent = 'Iniciar Sesión';
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
                loginBtn.textContent = 'Iniciar Sesión';
            }

        } catch (error) {
            const msg = 'Error de conexión. Por favor, verifica que el servidor esté corriendo e intenta de nuevo.';
            if (errorMessage) { errorMessage.textContent = msg; errorMessage.style.display = 'block'; }
            else alert(msg);
            loginBtn.disabled = false;
            loginBtn.textContent = 'Iniciar Sesión';
        }
    });

    // Flujo de recuperación de contraseña (solo activo si existe #form-recovery en la página)
    (function () {
        const form = document.getElementById('form-recovery');
        if (!form) return;

        const steps = Array.from(form.querySelectorAll('.form-step'));
        const stepper = Array.from(form.querySelectorAll('.stepper .step'));
        let current = 0;
        let method = 'email';

        const setHidden = (el, hidden) => { if (el) el.classList.toggle('is-hidden', hidden); };

        const show = (i) => {
            steps.forEach((s, idx) => s.classList.toggle('active', idx === i));
            stepper.forEach((el, idx) => {
                el.classList.toggle('active', idx === i);
                el.classList.toggle('completed', idx < i);
            });
            current = i;
        };

        const validateStep = (i) => {
            const cont = steps[i];
            for (const f of cont.querySelectorAll('[required]')) {
                if (f.type === 'checkbox' && !f.checked) return false;
                if (!f.value || f.value.trim() === '') return false;
                if (f.pattern && !new RegExp('^' + f.pattern + '$').test(f.value)) return false;
            }
            return true;
        };

        const radios = form.querySelectorAll('input[name="rec-method"]');
        const phoneWrap = document.getElementById('wrap-phone');
        const phoneInput = document.getElementById('rec-phone');
        const emailWrap = document.getElementById('wrap-email');
        const emailInput = document.getElementById('rec-email');
        const emailHelp = emailInput ? emailInput.nextElementSibling : null;

        radios.forEach(r => r.addEventListener('change', () => {
            method = form.querySelector('input[name="rec-method"]:checked').value;
            const sms = method === 'sms';
            setHidden(phoneWrap, !sms);
            if (phoneInput) phoneInput.required = sms;
            setHidden(emailWrap, sms);
            if (emailInput) emailInput.required = !sms;
            if (emailHelp) emailHelp.textContent = sms
                ? 'También enviaremos notificación al correo.'
                : 'Te enviaremos un código a este correo.';
        }));

        form.querySelector('#rec-next-1').addEventListener('click', () => {
            if (method === 'sms') {
                const raw = (phoneInput?.value || '').replace(/\D/g, '');
                if (raw.length < 10) { alert('Ingresa un número de teléfono válido (10 dígitos).'); return; }
            }
            if (!validateStep(0)) { alert(method === 'sms' ? 'Completa el número de teléfono.' : 'Completa el correo.'); return; }
            alert('Hemos enviado un código a tu ' + (method === 'sms' ? 'teléfono (SMS) y correo' : 'correo'));
            show(1);
        });

        form.querySelector('#rec-prev-2').addEventListener('click', () => show(0));
        form.querySelector('#rec-next-2').addEventListener('click', () => {
            const code = document.getElementById('rec-code').value.trim();
            if (!/^\d{6}$/.test(code)) { alert('Ingresa el código de 6 dígitos.'); return; }
            show(2);
        });
        form.querySelector('#rec-prev-3').addEventListener('click', () => show(1));

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            const p1 = document.getElementById('rec-pass').value;
            const p2 = document.getElementById('rec-pass2').value;
            if (p1.length < 8) { alert('La contraseña debe tener mínimo 8 caracteres.'); return; }
            if (p1 !== p2) { alert('Las contraseñas no coinciden.'); return; }
            alert('Tu contraseña ha sido restablecida. Ahora puedes iniciar sesión.');
            showLoginForm();
        });

        if (phoneInput) {
            phoneInput.addEventListener('input', () => {
                let digits = phoneInput.value.replace(/\D/g, '');
                if (digits.startsWith('57')) digits = digits.slice(2);
                if (digits.length > 10) digits = digits.slice(0, 10);
                const p1 = digits.slice(0, 3);
                const p2 = digits.slice(3, 6);
                const p3 = digits.slice(6, 10);
                let out = '+57 ';
                if (p1) out += p1;
                if (p2) out += ' ' + p2;
                if (p3) out += ' ' + p3;
                phoneInput.value = out.trim();
            });
        }
    })();
});
