// index.js
// Maneja selección de filtros en la página principal

document.addEventListener('DOMContentLoaded', () => {
    const searchBtn = document.querySelector('.search-btn');
    const searchInput = document.querySelector('.search-input');
    const locationSelect = document.getElementById('location-select');
    const modalitySelect = document.getElementById('modality-select');
    const experienceSelect = document.getElementById('experience-select');
    const salarySelect = document.getElementById('salary-select');

    const filters = {
        q: '',
        location: '',
        modality: '',
        experience: '',
        salary: ''
    };

    // Actualiza valor cuando se escribe en search
    searchInput.addEventListener('input', (e) => {
        filters.q = e.target.value;
    });

    // Cuando cambia la ubicación
    if (locationSelect) {
        locationSelect.addEventListener('change', (e) => {
            filters.location = e.target.value;
        });
    }

    // Cuando cambia la modalidad
    if (modalitySelect) {
        modalitySelect.addEventListener('change', (e) => {
            filters.modality = e.target.value;
        });
    }

    // Cuando cambia la experiencia
    if (experienceSelect) {
        experienceSelect.addEventListener('change', (e) => {
            filters.experience = e.target.value;
        });
    }

    // Cuando cambia el salario
    if (salarySelect) {
        salarySelect.addEventListener('change', (e) => {
            filters.salary = e.target.value;
        });
    }

    // Al hacer click en Buscar - conectar con search-handler
    searchBtn.addEventListener('click', () => {
        const criteria = {
            q: filters.q,
            location: filters.location,
            modality: filters.modality,
            experience: filters.experience,
            salary: filters.salary
        };
        // Llamar a función del search-handler
        if (typeof performSearch === 'function') {
            performSearch(criteria);
            // Scroll suave al contenedor de resultados
            const resultsContainer = document.getElementById('results-container');
            if (resultsContainer) {
                resultsContainer.scrollIntoView({ behavior: 'smooth' });
            }
        } else {
        }
    });
});

/* ---------------------------------------------------------------
 * Cifras reales en la portada.
 * Si la API no responde, los guiones se quedan como estan: la
 * pagina nunca muestra un cero falso ni un error al visitante.
 * --------------------------------------------------------------- */
(function () {
    const destinos = document.querySelectorAll('[data-stat]');
    if (!destinos.length || typeof API_BASE_URL === 'undefined') return;

    // Cuenta hasta el valor real en vez de aparecer de golpe.
    function contarHasta(el, valor) {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            el.textContent = valor.toLocaleString('es-CO');
            return;
        }
        const inicio = performance.now();
        const duracion = 900;
        const paso = function (ahora) {
            const avance = Math.min(1, (ahora - inicio) / duracion);
            const suave = 1 - Math.pow(1 - avance, 3);
            el.textContent = Math.round(valor * suave).toLocaleString('es-CO');
            if (avance < 1) requestAnimationFrame(paso);
        };
        requestAnimationFrame(paso);
    }

    fetch(`${API_BASE_URL}/public/stats`)
        .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
        .then(function (datos) {
            destinos.forEach(function (el) {
                const valor = datos[el.dataset.stat];
                if (typeof valor === 'number') contarHasta(el, valor);
            });
        })
        .catch(function () { /* sin conexion: se quedan los guiones */ });
})();
