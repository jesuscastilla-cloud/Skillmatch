/**
 * Paso del código en el registro (docs/CAMBIOS-FRONTEND.md, F10).
 * Con REGISTRO_VERIFICAR_CORREO=true, POST /auth/register responde 202 y la cuenta
 * todavía no existe: se crea cuando la persona escribe el código que le llegó al correo.
 * Lo usan registro-usuario.js y registro-empresa.js con RegistroCodigo.mostrar(...).
 */
const RegistroCodigo = (function () {
    const ESPERA_REENVIO = 60; // el servidor envía un código por minuto
    let caja, campo, nota, aviso, confirmar, reenviar, corregir;
    let correo = '';
    let alEntrar = null;
    let alCorregir = null;
    let ocultos = [];
    let reloj = null;

    function error(texto) {
        aviso.textContent = texto || '';
        aviso.hidden = !texto;
    }

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

    document.addEventListener('DOMContentLoaded', function () {
        caja = document.getElementById('registro-codigo');
        if (!caja) return;
        campo = document.getElementById('registro-codigo-campo');
        nota = document.getElementById('registro-codigo-nota');
        aviso = caja.querySelector('.error-text');
        confirmar = caja.querySelector('button[type="submit"]');
        reenviar = document.getElementById('registro-codigo-reenviar');
        corregir = document.getElementById('registro-codigo-corregir');

        caja.addEventListener('submit', async function (e) {
            e.preventDefault();
            const codigo = campo.value.replace(/\s/g, '');
            if (!/^\d{6}$/.test(codigo)) {
                error('El código tiene 6 números.');
                campo.focus();
                return;
            }
            error('');
            const texto = confirmar.textContent;
            confirmar.disabled = true;
            confirmar.textContent = 'Confirmando…';
            try {
                const response = await enviar('/auth/register/verify', { email: correo, codigo });
                if (response.ok) {
                    // La cuenta ya existe: lo mismo que tras un registro inmediato
                    clearInterval(reloj);
                    await alEntrar(await response.json());
                    return;
                }
                error(await textoDelServidor(response, 'No se pudo confirmar el código. Intenta de nuevo.'));
                campo.focus();
            } catch (_) {
                error('No pudimos conectar con SkillMatch. Revisa tu conexión e intenta de nuevo.');
            }
            confirmar.disabled = false;
            confirmar.textContent = texto;
        });

        reenviar.addEventListener('click', async function () {
            reenviar.disabled = true;
            try {
                const response = await enviar('/auth/register/resend', { email: correo });
                if (!response.ok) {
                    error(await textoDelServidor(response, 'No se pudo enviar otro código. Intenta de nuevo.'));
                    reenviar.disabled = false;
                    return;
                }
                error('');
                nota.textContent = `Te enviamos otro código a ${correo}. Usa el más reciente.`;
                esperarReenvio();
            } catch (_) {
                error('No pudimos conectar con SkillMatch. Revisa tu conexión e intenta de nuevo.');
                reenviar.disabled = false;
            }
        });

        corregir.addEventListener('click', function () {
            clearInterval(reloj);
            caja.hidden = true;
            ocultos.forEach(el => { el.hidden = false; });
            if (alCorregir) alCorregir();
        });
    });

    /**
     * Cambia el formulario por el paso del código.
     * opciones.correo: a dónde llegó el código.
     * opciones.ocultar: lo que se esconde mientras tanto (el formulario, el botón de Google...).
     * opciones.alEntrar(datos): lo que se hace con la sesión (la misma respuesta del registro inmediato).
     * opciones.alCorregir(): volver a mostrar el formulario para cambiar algún dato.
     */
    function mostrar(opciones) {
        correo = opciones.correo;
        alEntrar = opciones.alEntrar;
        alCorregir = opciones.alCorregir;
        ocultos = (opciones.ocultar || []).filter(el => el && !el.hidden);
        ocultos.forEach(el => { el.hidden = true; });

        caja.reset();
        error('');
        nota.textContent = `Escribe el código de 6 números que te enviamos a ${correo}. Tu cuenta se crea al confirmarlo.`;
        caja.hidden = false;
        esperarReenvio();
        caja.scrollIntoView({ block: 'nearest' });
        campo.focus();
    }

    return { mostrar };
})();
