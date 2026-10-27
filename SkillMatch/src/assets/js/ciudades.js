/* ===============================================================
 * SkillMatch — ciudades de Colombia con sus coordenadas
 * ---------------------------------------------------------------
 * Para "Vacantes cerca de ti" (vacantes-cerca.js): saber que tan lejos
 * queda cada ciudad de la persona y ordenar las vacantes por cercania.
 *
 * - Coordenadas aproximadas del centro de cada municipio (grados
 *   decimales). Para ordenar por cercania no hace falta mas precision.
 * - Estan las 48 ciudades del filtro "Ciudad o municipio" de Inicio, los
 *   municipios alrededor de Cartagena, el resto de la costa, las capitales
 *   de todos los departamentos y las areas metropolitanas grandes.
 * - Distancia en linea recta (formula de haversine): gratis, sin ningun
 *   servicio de mapas. No es la distancia por carretera.
 * - Una vacante de una ciudad que no este aqui no sale en "cerca de ti",
 *   pero si en Vacantes. Para sumar una ciudad basta una linea mas.
 * =============================================================== */
(function () {
    'use strict';

    // [clave, nombre, departamento, latitud, longitud, nombre corto para buscar (si es distinto)]
    const DATOS = [
        // Bolivar
        ['cartagena', 'Cartagena de Indias', 'Bolívar', 10.3910, -75.4794, 'Cartagena'],
        ['turbaco', 'Turbaco', 'Bolívar', 10.3326, -75.4114],
        ['turbana', 'Turbaná', 'Bolívar', 10.2744, -75.4427],
        ['arjona', 'Arjona', 'Bolívar', 10.2546, -75.3441],
        ['clemencia', 'Clemencia', 'Bolívar', 10.5667, -75.3283],
        ['santa_rosa', 'Santa Rosa', 'Bolívar', 10.4442, -75.3697],
        ['santa_catalina', 'Santa Catalina', 'Bolívar', 10.6036, -75.2878],
        ['villanueva', 'Villanueva', 'Bolívar', 10.4442, -75.2742],
        ['mahates', 'Mahates', 'Bolívar', 10.2333, -75.1897],
        ['maria_la_baja', 'María La Baja', 'Bolívar', 9.9822, -75.3008],
        ['san_juan_nepomuceno', 'San Juan Nepomuceno', 'Bolívar', 9.9522, -75.0814],
        ['el_carmen_de_bolivar', 'El Carmen de Bolívar', 'Bolívar', 9.7175, -75.1217, 'Carmen de Bolívar'],
        ['magangue', 'Magangué', 'Bolívar', 9.2414, -74.7533],
        ['mompox', 'Mompox', 'Bolívar', 9.2417, -74.4264],
        // Atlantico
        ['barranquilla', 'Barranquilla', 'Atlántico', 10.9685, -74.7813],
        ['soledad', 'Soledad', 'Atlántico', 10.9184, -74.7646],
        ['malambo', 'Malambo', 'Atlántico', 10.8597, -74.7739],
        ['puerto_colombia', 'Puerto Colombia', 'Atlántico', 10.9878, -74.9547],
        ['baranoa', 'Baranoa', 'Atlántico', 10.7944, -74.9161],
        ['sabanalarga', 'Sabanalarga', 'Atlántico', 10.6306, -74.9214],
        // Magdalena, Sucre y Cordoba
        ['santa_marta', 'Santa Marta', 'Magdalena', 11.2408, -74.1990],
        ['cienaga', 'Ciénaga', 'Magdalena', 11.0069, -74.2472],
        ['sincelejo', 'Sincelejo', 'Sucre', 9.3047, -75.3978],
        ['corozal', 'Corozal', 'Sucre', 9.3181, -75.2933],
        ['tolu', 'Tolú', 'Sucre', 9.5236, -75.5817],
        ['covenas', 'Coveñas', 'Sucre', 9.4022, -75.6808],
        ['monteria', 'Montería', 'Córdoba', 8.7479, -75.8814],
        ['cerete', 'Cereté', 'Córdoba', 8.8853, -75.7906],
        ['lorica', 'Lorica', 'Córdoba', 9.2364, -75.8136],
        ['sahagun', 'Sahagún', 'Córdoba', 8.9461, -75.4428],
        // Cesar y La Guajira
        ['valledupar', 'Valledupar', 'Cesar', 10.4631, -73.2532],
        ['aguachica', 'Aguachica', 'Cesar', 8.3083, -73.6167],
        ['riohacha', 'Riohacha', 'La Guajira', 11.5444, -72.9072],
        ['maicao', 'Maicao', 'La Guajira', 11.3778, -72.2392],
        // Antioquia
        ['medellin', 'Medellín', 'Antioquia', 6.2442, -75.5812],
        ['bello', 'Bello', 'Antioquia', 6.3373, -75.5580],
        ['envigado', 'Envigado', 'Antioquia', 6.1759, -75.5917],
        ['itagui', 'Itagüí', 'Antioquia', 6.1719, -75.6114],
        ['sabaneta', 'Sabaneta', 'Antioquia', 6.1515, -75.6166],
        ['rionegro', 'Rionegro', 'Antioquia', 6.1551, -75.3737],
        ['apartado', 'Apartadó', 'Antioquia', 7.8828, -76.6258],
        ['turbo', 'Turbo', 'Antioquia', 8.0931, -76.7283],
        // Bogota y Cundinamarca
        ['bogota', 'Bogotá D.C.', 'Bogotá D.C.', 4.7110, -74.0721, 'Bogotá'],
        ['soacha', 'Soacha', 'Cundinamarca', 4.5794, -74.2168],
        ['chia', 'Chía', 'Cundinamarca', 4.8615, -74.0587],
        ['cajica', 'Cajicá', 'Cundinamarca', 4.9186, -74.0278],
        ['zipaquira', 'Zipaquirá', 'Cundinamarca', 5.0221, -74.0048],
        ['funza', 'Funza', 'Cundinamarca', 4.7166, -74.2122],
        ['mosquera', 'Mosquera', 'Cundinamarca', 4.7059, -74.2302],
        ['madrid', 'Madrid', 'Cundinamarca', 4.7325, -74.2642],
        ['facatativa', 'Facatativá', 'Cundinamarca', 4.8136, -74.3545],
        ['fusagasuga', 'Fusagasugá', 'Cundinamarca', 4.3364, -74.3639],
        ['girardot', 'Girardot', 'Cundinamarca', 4.3032, -74.8034],
        // Valle del Cauca
        ['cali', 'Cali', 'Valle del Cauca', 3.4516, -76.5320],
        ['palmira', 'Palmira', 'Valle del Cauca', 3.5394, -76.3036],
        ['jamundi', 'Jamundí', 'Valle del Cauca', 3.2611, -76.5406],
        ['yumbo', 'Yumbo', 'Valle del Cauca', 3.5823, -76.4914],
        ['buenaventura', 'Buenaventura', 'Valle del Cauca', 3.8801, -77.0312],
        ['tulua', 'Tuluá', 'Valle del Cauca', 4.0847, -76.1953],
        ['buga', 'Buga', 'Valle del Cauca', 3.9009, -76.2978],
        ['cartago', 'Cartago', 'Valle del Cauca', 4.7464, -75.9117],
        // Santanderes
        ['bucaramanga', 'Bucaramanga', 'Santander', 7.1193, -73.1227],
        ['floridablanca', 'Floridablanca', 'Santander', 7.0622, -73.0864],
        ['giron', 'Girón', 'Santander', 7.0682, -73.1698],
        ['piedecuesta', 'Piedecuesta', 'Santander', 6.9878, -73.0497],
        ['barrancabermeja', 'Barrancabermeja', 'Santander', 7.0653, -73.8547],
        ['san_gil', 'San Gil', 'Santander', 6.5554, -73.1340],
        ['barichara', 'Barichara', 'Santander', 6.6361, -73.2231],
        ['cucuta', 'Cúcuta', 'Norte de Santander', 7.8939, -72.5078],
        ['villa_del_rosario', 'Villa del Rosario', 'Norte de Santander', 7.8336, -72.4742],
        ['ocana', 'Ocaña', 'Norte de Santander', 8.2378, -73.3561],
        // Eje cafetero, Tolima y Huila
        ['pereira', 'Pereira', 'Risaralda', 4.8133, -75.6961],
        ['dosquebradas', 'Dosquebradas', 'Risaralda', 4.8392, -75.6673],
        ['manizales', 'Manizales', 'Caldas', 5.0703, -75.5138],
        ['armenia', 'Armenia', 'Quindío', 4.5339, -75.6811],
        ['ibague', 'Ibagué', 'Tolima', 4.4389, -75.2322],
        ['neiva', 'Neiva', 'Huila', 2.9273, -75.2819],
        // Sur y Pacifico
        ['popayan', 'Popayán', 'Cauca', 2.4448, -76.6147],
        ['pasto', 'Pasto', 'Nariño', 1.2136, -77.2811],
        ['ipiales', 'Ipiales', 'Nariño', 0.8303, -77.6444],
        ['tumaco', 'Tumaco', 'Nariño', 1.8067, -78.7647],
        ['quibdo', 'Quibdó', 'Chocó', 5.6947, -76.6611],
        ['mocoa', 'Mocoa', 'Putumayo', 1.1522, -76.6464],
        ['florencia', 'Florencia', 'Caquetá', 1.6144, -75.6062],
        // Boyaca, Llanos, Amazonia e islas
        ['tunja', 'Tunja', 'Boyacá', 5.5353, -73.3678],
        ['duitama', 'Duitama', 'Boyacá', 5.8269, -73.0336],
        ['sogamoso', 'Sogamoso', 'Boyacá', 5.7145, -72.9339],
        ['villavicencio', 'Villavicencio', 'Meta', 4.1420, -73.6266],
        ['yopal', 'Yopal', 'Casanare', 5.3378, -72.3959],
        ['arauca', 'Arauca', 'Arauca', 7.0847, -70.7591],
        ['puerto_carreno', 'Puerto Carreño', 'Vichada', 6.1890, -67.4859],
        ['san_jose_del_guaviare', 'San José del Guaviare', 'Guaviare', 2.5729, -72.6459],
        ['inirida', 'Inírida', 'Guainía', 3.8653, -67.9239],
        ['mitu', 'Mitú', 'Vaupés', 1.2537, -70.2345],
        ['leticia', 'Leticia', 'Amazonas', -4.2153, -69.9406],
        ['san_andres', 'San Andrés', 'San Andrés y Providencia', 12.5847, -81.7006]
    ];

    /** Minusculas y sin tildes: "Bogotá" y "bogota" quedan iguales. */
    function normalizar(texto) {
        return String(texto || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    }

    const LISTA = DATOS.map(function (d) {
        const corto = d[5] || d[1];
        return { clave: d[0], nombre: d[1], departamento: d[2], lat: d[3], lon: d[4], corto: corto,
            // Palabra completa: "Buga" no debe encontrarse dentro de "Bugalagrande"
            reconocer: new RegExp('(^|[^a-z])' + normalizar(corto).replace(/ /g, '\\s+') + '($|[^a-z])') };
    });

    /** Kilometros en linea recta entre dos puntos (haversine: la Tierra como esfera de 6371 km). */
    function distanciaKm(lat1, lon1, lat2, lon2) {
        const rad = Math.PI / 180;
        const dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
        return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
    }

    /** Todas las ciudades de la mas cercana a la mas lejana, cada una con sus km. */
    function porCercania(lat, lon) {
        return LISTA.map(function (c) { return Object.assign({ km: distanciaKm(lat, lon, c.lat, c.lon) }, c); })
            .sort(function (a, b) { return a.km - b.km; });
    }

    /** La ciudad que nombra un texto ("Cartagena de Indias, Bolívar" -> Cartagena); la mas larga gana. */
    function desdeTexto(texto) {
        const t = normalizar(texto);
        let mejor = null;
        LISTA.forEach(function (c) { if (c.reconocer.test(t) && (!mejor || c.corto.length > mejor.corto.length)) mejor = c; });
        return mejor;
    }

    /** Si el texto de ubicacion de una vacante es de esa ciudad. */
    function esDe(ciudad, texto) { return ciudad.reconocer.test(normalizar(texto)); }

    /** Patron para la busqueda por ciudad del servidor (expresion regular sin mayusculas): cada letra con
     *  tilde pasa a "." (cualquier letra), asi "Bogot." encuentra "Bogotá" y "Bogota". */
    function patron(ciudad) { return ciudad.corto.replace(/[^A-Za-z ]/g, '.'); }

    function porClave(clave) { return LISTA.find(function (c) { return c.clave === clave; }) || null; }

    window.SkillMatchCiudades = { lista: LISTA, normalizar: normalizar, distanciaKm: distanciaKm, porCercania: porCercania,
        desdeTexto: desdeTexto, esDe: esDe, patron: patron, porClave: porClave };
})();
