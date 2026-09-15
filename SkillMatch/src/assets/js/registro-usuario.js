// Manejo del formulario de registro de usuario
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('form-registro-usuario');
    
    if (!form) return;
    
    // Stepper logic (ya existe en el HTML inline, pero lo manejamos aquí también)
    const steps = Array.from(form.querySelectorAll('.form-step'));
    const stepper = Array.from(form.querySelectorAll('.stepper .step'));
    let currentStep = 0;
    
    const showStep = (stepIndex) => {
        steps.forEach((s, idx) => s.classList.toggle('active', idx === stepIndex));
        stepper.forEach((el, idx) => {
            el.classList.toggle('active', idx === stepIndex);
            el.classList.toggle('completed', idx < stepIndex);
        });
        currentStep = stepIndex;
    };
    
    const validateStep = (stepIndex) => {
        const required = steps[stepIndex].querySelectorAll('[required]');
        for (const field of required) {
            if (field.type === 'checkbox' && !field.checked) return false;
            if (!field.value || field.value.trim() === '') return false;
        }
        return true;
    };
    
    // Navegación entre pasos
    const nextBtn1 = document.getElementById('next-step-1');
    const prevBtn2 = document.getElementById('prev-step-2');
    const nextBtn2 = document.getElementById('next-step-2');
    const prevBtn3 = document.getElementById('prev-step-3');
    
    if (nextBtn1) {
        nextBtn1.addEventListener('click', () => {
            if (!validateStep(0)) {
                alert('Por favor completa todos los campos requeridos del Paso 1.');
                return;
            }
            
            // Validar contraseñas coinciden
            const pass = document.getElementById('usuario-pass').value;
            const pass2 = document.getElementById('usuario-pass2').value;
            if (pass !== pass2) {
                alert('Las contraseñas no coinciden.');
                return;
            }
            
            showStep(1);
        });
    }
    
    if (prevBtn2) prevBtn2.addEventListener('click', () => showStep(0));
    
    if (nextBtn2) {
        nextBtn2.addEventListener('click', () => {
            if (!validateStep(1)) {
                alert('Por favor completa todos los campos requeridos del Paso 2.');
                return;
            }
            showStep(2);
        });
    }
    
    if (prevBtn3) prevBtn3.addEventListener('click', () => showStep(1));
    
    // Submit del formulario
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Validar paso 3
        if (!validateStep(2)) {
            alert('Por favor completa todos los campos requeridos del Paso 3.');
            return;
        }
        
        // Obtener datos del formulario
        const nombre = document.getElementById('usuario-nombre').value.trim();
        const apellidos = document.getElementById('usuario-apellidos').value.trim();
        const email = document.getElementById('usuario-email').value.trim();
        const telefono = document.getElementById('usuario-telefono').value.trim();
        const password = document.getElementById('usuario-pass').value;
        const password2 = document.getElementById('usuario-pass2').value;
        
        // Validaciones adicionales
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            alert('Por favor ingresa un correo electrónico válido.');
            return;
        }
        
        if (password.length < 6) {
            alert('La contraseña debe tener al menos 6 caracteres.');
            return;
        }
        
        if (password !== password2) {
            alert('Las contraseñas no coinciden.');
            return;
        }
        
        // Preparar datos para enviar al backend
        const registerData = {
            email: email,
            password: password,
            firstName: nombre,
            lastName: apellidos,
            phone: telefono,
            userType: 'USER' // Especificar que es un usuario regular
        };
        
        // Deshabilitar botón de submit
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Registrando...';
        
        
        try {
            const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.REGISTRO_USUARIO}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(registerData)
            });
            
            
            if (response.ok) {
                const data = await response.json();
                
                // Guardar token y datos del usuario
                saveToken(data.token);
                saveUserData({
                    id: data.id,
                    companyId: data.companyId || null,
                    firstName: data.firstName,
                    lastName: data.lastName,
                    email: data.email,
                    role: data.role || registerData.userType || 'USER'
                });
                
                alert('¡Registro exitoso! Bienvenido a SkillMatch.');
                
                // Redirigir a la página de perfil de usuario
                window.location.href = 'perfil-usuario.html';
                
            } else {
                let errorText = 'Error al registrar. Por favor intenta de nuevo.';
                try {
                    const errorData = await response.json();
                    errorText = errorData.message || errorText;
                } catch (e) {
                    // Si no puede parsear JSON, usar el mensaje por defecto
                }
                
                alert(errorText);
                
                // Rehabilitar botón
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
            
        } catch (error) {
            alert('Error de conexión. Por favor verifica que el servidor esté corriendo e intenta de nuevo.');
            
            // Rehabilitar botón
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    });
});
