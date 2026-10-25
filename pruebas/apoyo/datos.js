// Datos inventados para las pruebas. Las fechas se calculan desde ahora (hora de
// Colombia), asi "Hoy", "Ayer" y "Cierra pronto" dan siempre lo mismo.
process.env.TZ = 'America/Bogota';

const pad = n => String(n).padStart(2, '0');
// Como LocalDateTime de Java: sin zona horaria
function enFormatoJava(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function haceDias(dias, hora) {
    const d = new Date();
    d.setDate(d.getDate() - dias);
    if (hora !== undefined) d.setHours(hora, 15, 0, 0); else d.setMinutes(d.getMinutes() - 30);
    return enFormatoJava(d);
}
function enDias(dias) {
    const d = new Date();
    d.setDate(d.getDate() + dias);
    d.setHours(23, 59, 0, 0);
    return enFormatoJava(d);
}

function crearDatos() {
    const usuarios = [
        { id: 'u-valentina', email: 'valentina@prueba.test', firstName: 'Valentina', lastName: 'Herrera', phone: '3000000001',
          headline: 'Mesera con experiencia', location: 'Cartagena de Indias', bio: 'Persona de prueba.', role: 'USER',
          skills: [
              { id: 's-1', name: 'Atención al cliente', level: 'INTERMEDIO' },
              { id: 's-2', name: 'Inglés básico', level: 'BASICO' },
              { id: 's-3', name: 'Manejo de bandeja', level: 'INTERMEDIO' }
          ], experiences: [], educations: [], certifications: [] },
        { id: 'u-andres', email: 'andres@prueba.test', firstName: 'Andrés', lastName: 'Julio', phone: '3000000002',
          headline: 'Auxiliar de bodega', location: 'Turbaco', role: 'USER',
          skills: [{ id: 's-4', name: 'Cargue y descargue', level: 'INTERMEDIO' }], experiences: [], educations: [], certifications: [] },
        { id: 'u-sara', email: 'sara@prueba.test', firstName: 'Sara', lastName: 'Villalba', phone: '3000000003',
          headline: 'Operaria de aseo', location: 'Cartagena de Indias', role: 'USER', skills: [], experiences: [], educations: [], certifications: [] },
        { id: 'u-hotel', email: 'hotel@prueba.test', firstName: 'Hotel Puerta del Mar', lastName: 'Empresa', phone: '3000000010',
          role: 'EMPRESA', companyId: 'c-hotel', skills: [], experiences: [], educations: [], certifications: [] },
        { id: 'u-digital', email: 'digital@prueba.test', firstName: 'Caribe Digital Estudio', lastName: 'Empresa', phone: '3000000011',
          role: 'EMPRESA', companyId: 'c-digital', skills: [], experiences: [], educations: [], certifications: [] }
    ];

    const empresas = [
        { id: 'c-hotel', userId: 'u-hotel', name: 'Hotel Puerta del Mar', industry: 'Turismo y hotelería', size: 'large',
          location: 'Cartagena de Indias', description: 'Hotel frente al mar en Bocagrande.', email: 'hotel@prueba.test',
          isVerified: true, active: true, createdAt: haceDias(60, 9) },
        { id: 'c-digital', userId: 'u-digital', name: 'Caribe Digital Estudio', industry: 'Tecnología y publicidad', size: 'small',
          location: 'Cartagena', description: 'Agencia digital en el Centro.', email: 'digital@prueba.test',
          isVerified: false, active: true, createdAt: haceDias(40, 9) }
    ];

    const vacante = (id, companyId, title, type, experienceLevel, modality, location, salaryMin, salaryMax, skills, publicada, cierra, status = 'abierta') => ({
        id, companyId, title, type, experienceLevel, modality, location, salaryMin, salaryMax, skills,
        description: `En la empresa buscamos a alguien para ${title.toLowerCase()}.`,
        requirements: ['Bachiller'], responsibilities: ['Atender a las personas'], benefits: ['Uniforme'],
        duration: type === 'práctica' ? '6 meses' : null,
        postedDate: haceDias(publicada), createdAt: haceDias(publicada), updatedAt: haceDias(publicada),
        expirationDate: enDias(cierra), status, active: status === 'abierta'
    });
    const vacantes = [
        vacante('j-recepcion', 'c-hotel', 'Recepcionista bilingüe', 'empleo', 'junior', 'presencial', 'Cartagena de Indias', 1900000, 2300000, ['Inglés conversacional', 'Atención al cliente', 'Manejo de reservas'], 0, 3),
        vacante('j-mesero', 'c-hotel', 'Mesero o mesera', 'empleo', 'sin-experiencia', 'presencial', 'Cartagena', 1423500, 1700000, ['Atención al cliente', 'Manejo de bandeja', 'Inglés básico'], 1, 40),
        vacante('j-cocina', 'c-hotel', 'Auxiliar de cocina', 'empleo', 'sin-experiencia', 'presencial', 'Turbaco', 1423500, 1550000, ['Manipulación de alimentos', 'Trabajo en equipo'], 5, 30),
        vacante('j-practica-hotel', 'c-hotel', 'Práctica en recepción', 'práctica', 'sin-experiencia', 'presencial', 'Cartagena de Indias', 1423500, 1423500, ['Atención al cliente', 'Excel básico'], 8, 60),
        vacante('j-eventos', 'c-hotel', 'Coordinador o coordinadora de eventos', 'empleo', 'senior', 'presencial', 'Cartagena de Indias', 3200000, 4000000, ['Organización de eventos', 'Negociación'], 20, 10, 'cerrada'),
        vacante('j-web', 'c-digital', 'Desarrollador o desarrolladora web', 'empleo', 'semi-senior', 'híbrido', 'Cartagena de Indias', 3500000, 4500000, ['JavaScript', 'HTML y CSS', 'Bases de datos'], 2, 45),
        vacante('j-diseno', 'c-digital', 'Diseñador o diseñadora gráfica', 'empleo', 'junior', 'remoto', 'Cartagena', 2000000, 2500000, ['Diseño gráfico', 'Illustrator'], 3, 20),
        vacante('j-foto', 'c-digital', 'Fotógrafo o fotógrafa de productos', 'freelance', 'junior', 'presencial', 'Barranquilla', null, null, ['Fotografía', 'Edición de fotos'], 6, 25),
        vacante('j-practica-web', 'c-digital', 'Práctica en desarrollo de software', 'práctica', 'sin-experiencia', 'remoto', 'Cartagena de Indias', 1423500, 1423500, ['JavaScript', 'Ganas de aprender'], 12, 5),
        vacante('j-redes', 'c-digital', 'Persona para manejar redes sociales', 'empleo', 'junior', 'remoto', 'Arjona', 1800000, 2200000, ['Redes sociales', 'Redacción'], 15, 35)
    ];

    const postulaciones = [
        { id: 'a-1', userId: 'u-valentina', jobId: 'j-mesero', status: 'pendiente', coverLetter: 'Me interesa mucho.', appliedDate: haceDias(1, 10) },
        { id: 'a-2', userId: 'u-andres', jobId: 'j-recepcion', status: 'revisada', coverLetter: '', appliedDate: haceDias(0) },
        { id: 'a-3', userId: 'u-andres', jobId: 'j-mesero', status: 'aceptada', coverLetter: 'Tengo disponibilidad inmediata.', appliedDate: haceDias(1, 12) },
        { id: 'a-4', userId: 'u-sara', jobId: 'j-mesero', status: 'pendiente', coverLetter: '', appliedDate: haceDias(1, 15) }
    ];

    const guardadas = [{ id: 'g-1', userId: 'u-valentina', jobId: 'j-web', savedAt: haceDias(2) }];

    const conexiones = [
        { id: 'k-1', userId: 'u-valentina', connectedUserId: 'u-andres', status: 'accepted', message: 'Hola, conectemos.', requestedAt: haceDias(5, 9), respondedAt: haceDias(4, 9) },
        { id: 'k-2', userId: 'u-sara', connectedUserId: 'u-valentina', status: 'pending', message: '', requestedAt: haceDias(1, 9), respondedAt: null }
    ];

    const mensajes = [
        { id: 'm-1', senderId: 'u-valentina', receiverId: 'u-digital', content: 'Hola, vi la vacante de desarrollador web.', isRead: true, sentAt: haceDias(9, 10) },
        { id: 'm-2', senderId: 'u-digital', receiverId: 'u-valentina', content: '¿Tienes un portafolio?', isRead: true, sentAt: haceDias(9, 11) },
        { id: 'm-3', senderId: 'u-valentina', receiverId: 'u-digital', content: 'Sí, te comparto el enlace.', isRead: true, sentAt: haceDias(1, 9) },
        { id: 'm-4', senderId: 'u-valentina', receiverId: 'u-digital', content: '¿Cómo va mi proceso?', isRead: false, sentAt: haceDias(0) },
        { id: 'm-5', senderId: 'u-andres', receiverId: 'u-valentina', content: '¡Me llamaron para una segunda entrevista!', isRead: false, sentAt: haceDias(1, 18) }
    ];

    const avisos = [
        { id: 'n-1', userId: 'u-valentina', type: 'connection_request', content: 'Sara Villalba quiere conectar contigo.', relatedId: 'k-2', isRead: false, createdAt: haceDias(1, 9) },
        { id: 'n-2', userId: 'u-valentina', type: 'message', content: 'Tienes un mensaje nuevo.', relatedId: 'u-andres', isRead: true, createdAt: haceDias(1, 18) }
    ];

    return { usuarios, empresas, vacantes, postulaciones, guardadas, conexiones, mensajes, avisos, siguiente: 100 };
}

module.exports = { crearDatos, haceDias, enDias, enFormatoJava };
