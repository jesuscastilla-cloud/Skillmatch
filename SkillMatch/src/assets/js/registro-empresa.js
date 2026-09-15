function toggleRoleTag(el) {
    el.classList.toggle('active');
    const input = document.getElementById('empresa-perfiles');
    let current = input.value.split(',').map(v => v.trim()).filter(v => v);
    if (el.classList.contains('active')) {
        if (!current.includes(el.textContent.trim())) current.push(el.textContent.trim());
    } else {
        current = current.filter(v => v !== el.textContent.trim());
    }
    input.value = current.join(', ');
}

(function () {
    const form = document.getElementById('form-registro-empresa');
    const steps = Array.from(form.querySelectorAll('.form-step'));
    const stepTabs = Array.from(form.querySelectorAll('.stepper .step'));
    let current = 0;

    const show = (index) => {
        steps.forEach((panel, i) => {
            const isActive = i === index;
            panel.classList.toggle('active', isActive);
            panel.setAttribute('aria-hidden', String(!isActive));
        });
        stepTabs.forEach((tab, i) => {
            const isActive = i === index;
            tab.classList.toggle('active', isActive);
            tab.classList.toggle('completed', i < index);
            tab.setAttribute('aria-selected', String(isActive));
            tab.setAttribute('tabindex', isActive ? '0' : '-1');
        });
        current = index;
    };

    const validateStep = (index) => {
        const container = steps[index];
        const required = Array.from(container.querySelectorAll('[required]'));
        const invalidFields = [];

        for (const field of required) {
            const label = field.closest('.form-group')?.querySelector('label')?.textContent
                       || field.getAttribute('name') || field.id;

            if (field.type === 'checkbox' && !field.checked) {
                invalidFields.push(label);
                field.style.border = '2px solid #e74c3c';
                continue;
            }
            if (field.tagName === 'SELECT') {
                if (!field.value) {
                    invalidFields.push(label);
                    field.style.border = '2px solid #e74c3c';
                    continue;
                }
            } else if (!field.value || field.value.trim() === '') {
                invalidFields.push(label);
                field.style.border = '2px solid #e74c3c';
                continue;
            }
            field.style.border = '';
        }

        if (invalidFields.length > 0) {
            alert('Por favor completa los siguientes campos:\n\n' + invalidFields.join('\n'));
        }
        return invalidFields.length === 0;
    };

    form.querySelector('#next-step-emp-1').addEventListener('click', () => {
        if (!validateStep(0)) return;
        show(1);
    });
    form.querySelector('#prev-step-emp-2').addEventListener('click', () => show(0));
    form.querySelector('#next-step-emp-2').addEventListener('click', () => {
        if (!validateStep(1)) return;
        show(2);
    });
    form.querySelector('#prev-step-emp-3').addEventListener('click', () => show(1));
    show(0);
})();

document.getElementById('form-registro-empresa').addEventListener('submit', async function (e) {
    e.preventDefault();

    const email = document.getElementById('empresa-email').value.trim();
    const pass = document.getElementById('empresa-pass').value;
    const pass2 = document.getElementById('empresa-pass2').value;
    const nombre = document.getElementById('empresa-nombre').value.trim();
    const telefono = document.getElementById('empresa-telefono').value.trim();
    const descripcion = document.getElementById('empresa-descripcion').value.trim();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) { alert('Correo corporativo no válido.'); return; }
    if (pass.length < 8) { alert('La contraseña debe tener mínimo 8 caracteres.'); return; }
    if (pass !== pass2) { alert('Las contraseñas no coinciden.'); return; }
    if (nombre.length < 3) { alert('Ingresa la razón social válida.'); return; }
    const telefonoRegex = /^\+?[\d\s-]{7,}$/;
    if (!telefonoRegex.test(telefono)) { alert('Número de teléfono no válido.'); return; }
    if (descripcion.length < 20) { alert('Agrega una descripción más completa (20+ caracteres).'); return; }

    const registerData = {
        email,
        password: pass,
        firstName: nombre,
        lastName: 'Empresa',
        phone: telefono,
        userType: 'EMPRESA'
    };

    try {
        const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.REGISTRO_EMPRESA}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(registerData)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Error desconocido' }));
            alert('Error en el registro: ' + (errorData.message || errorData.error || 'Error desconocido'));
            return;
        }

        const data = await response.json();

        if (data.token) saveToken(data.token);
        saveUserData({
            id: data.id,
            email: data.email,
            firstName: data.firstName,
            lastName: data.lastName,
            role: data.role,
            companyId: data.companyId
        });

        alert('¡Registro exitoso! Bienvenido a SkillMatch');
        window.location.href = 'perfil-empresa.html';

    } catch (error) {
        alert('Error al conectar con el servidor. Verifica que el backend esté corriendo.');
    }
});
