# Registros de SkillMatch frente a la ley colombiana (2026-10-09)

Pregunta de Luis: ¿los formularios de registro de personas y empresas piden la información suficiente,
dentro del marco de la ley? Se comparan con la norma colombiana y con Computrabajo (agencia autorizada
en Colombia) y LinkedIn.

> Esto es una revisión técnica, no asesoría legal. Antes de abrir SkillMatch al público conviene
> validarlo con un abogado laboral o de protección de datos.

## Respuesta corta

**No.** Los formularios actuales (y tampoco los anteriores) no alcanzan el mínimo que la norma
colombiana pide a una plataforma de empleo:

- **Personas:** falta el documento de identidad, la fecha y el lugar de nacimiento, el sexo, la
  residencia completa (departamento y municipio) y el nivel educativo. La experiencia y los estudios
  existen en el perfil, pero incompletos.
- **Empresas:** falta el NIT o documento, el tipo de persona (natural o jurídica), la razón social, el
  domicilio y los datos de quien registra la empresa en su nombre.
- **Vacantes:** de los 16 campos mínimos de la Resolución 2605 de 2014 faltan 7.
- **Datos personales:** no hay política de tratamiento ni aviso de privacidad (Ley 1581 de 2012).

Los formularios anteriores pedían algunos de estos datos (estudios, departamento, aspiración), pero
**no se guardaban**; por eso en el punto 5 se quitaron. La solución real necesita campos nuevos en el
backend: el frontend solo puede pedir lo que el backend guarda.

## Marco legal que aplica

1. **Autorización para operar (Ley 1636 de 2013, art. 32; Decreto 1072 de 2015, mod. Decreto 1823 de
   2020).** Gestionar y colocar empleo requiere autorización de la Unidad Administrativa Especial del
   Servicio Público de Empleo (SPE). Computrabajo opera como *agencia privada lucrativa de gestión y
   colocación de empleo* en modalidad virtual. Legalmente, "bolsa de empleo" es una entidad sin ánimo de
   lucro que atiende a un grupo específico (por ejemplo, los egresados de una universidad); una
   plataforma abierta a todo público sería una *agencia*. Los servicios a quien busca empleo deben ser
   **gratuitos**.
2. **Contenido mínimo de la hoja de vida (Resolución 295 de 2017, modificada por la Resolución 4569 de
   2025).** Datos personales (fecha, país, departamento y municipio de nacimiento; sexo; país,
   departamento y municipio de residencia), formación (nivel educativo, título, fecha de finalización,
   país, profesión) y experiencia (perfil, cargo, ocupación, ubicación, fechas). El tipo y número de
   documento se entregan aparte. *La modificación de 2025 cambió esta lista y no se pudo leer su texto
   final: hay que verificarla.*
3. **Registro del empleador (Resolución 3229 de 2022, según el reglamento de Computrabajo).** Tipo de
   persona (natural o jurídica), razón social o nombre, NIT o documento, domicilio (ciudad, departamento,
   país) y nombre, teléfono y correo de quien registra en representación del empleador.
4. **Contenido mínimo de la vacante (Resolución 2605 de 2014, art. 3).** 16 campos (tabla abajo). La
   publicación vence en máximo **6 meses**. El empleador puede pedir no mostrar su razón social ni su NIT.
5. **Datos personales (Ley 1581 de 2012; Decreto 1377 de 2013, hoy en el Decreto 1074 de 2015).**
   Autorización previa, expresa e informada en el acto de registro; decir para qué se usan los datos;
   política de tratamiento y aviso de privacidad accesibles; derechos de conocer, actualizar, rectificar,
   suprimir y revocar. Los **datos sensibles** (discapacidad, pertenencia étnica, salud, condición de
   víctima...) son siempre opcionales y se pide autorización expresa aparte. Datos de **menores** solo
   respetando su interés superior.
6. **No discriminación en las vacantes (Ley 931 de 2004).** Prohibido exigir rangos de edad; los
   requisitos deben referirse a mérito, experiencia, profesión u oficio. Tampoco se pueden poner límites
   por sexo, raza, origen, religión u opinión.
7. **Edad para trabajar (Ley 1098 de 2006, art. 35).** La edad mínima es 15 años, y de 15 a 17 se necesita
   autorización del inspector de trabajo. Lo práctico para una plataforma abierta es pedir mayoría de edad.

## Personas: qué pide cada uno

| Dato | Norma (Res. 295) | Computrabajo | LinkedIn | SkillMatch hoy | ¿El backend lo guarda? |
|---|---|---|---|---|---|
| Nombre y apellidos | sí | sí | sí | **sí** | sí |
| Correo y contraseña | — | sí | sí | **sí** | sí |
| Teléfono | contacto | sí | opcional | **sí** | sí |
| Tipo y número de documento | sí (aparte) | sí (en la hoja de vida) | no | no | **no** |
| Fecha de nacimiento | sí | sí | sí (edad mínima) | no | **no** |
| Lugar de nacimiento | sí | sí | no | no | **no** |
| Sexo | sí | sí | opcional | no | **no** |
| Residencia: departamento y municipio | sí | sí (departamento al registrarse) | sí | solo ciudad (texto libre) | solo `location` |
| Cargo o trabajo que busca | perfil | sí (al registrarse) | sí | **sí** (titular) | sí |
| Nivel educativo y título | sí | sí | sí | estudios en el perfil, sin nivel | parcial (sin nivel) |
| Experiencia (cargo, empresa, fechas, ubicación) | sí | sí | sí | en el perfil | sí, pero **responde 400** |
| Habilidades | — | sí | sí | **sí** | sí |
| Aspiración salarial | (según resumen secundario) | sí | no | no | **no** |
| Idiomas, licencia de conducción | — | sí | sí | no | **no** |
| Datos sensibles (discapacidad, etnia...) | enfoque diferencial, opcional | opcional | no | no | **no** |
| Mayor de edad | — | condiciones de uso | sí (16+) | no | (declaración) |
| Autorización de datos con enlace a la política | sí | sí | sí | casilla sin política | — |

**Cómo lo resuelven las plataformas:** el registro es rápido (Computrabajo: correo, nombre, cargo
deseado, departamento y contraseña) y la hoja de vida se completa después con los datos de la
Resolución 295. La hoja de vida solo se muestra a las empresas cuando está completa.

## Empresas: qué pide cada uno

| Dato | Norma (Res. 3229) | Computrabajo | LinkedIn | SkillMatch hoy | ¿El backend lo guarda? |
|---|---|---|---|---|---|
| Correo y contraseña | sí | sí | sí (correo del dominio de la empresa) | **sí** | sí |
| Tipo de persona (natural o jurídica) | sí | — | — | no | **no** |
| Razón social o nombre | sí | razón social y nombre comercial | nombre | nombre | solo `name` |
| NIT o documento | sí | sí, y verifica en el RUES | — | no | **no** |
| Domicilio (país, departamento, ciudad) | sí | sí, más dirección | ubicación | no | `location` (solo admin) |
| Teléfono | sí | sí | — | **sí** | sí |
| Persona que registra: nombre (y cargo) | sí | sí | perfil personal | no | **no** |
| Sector económico | (lo pide la vacante) | sí | sí | no | `industry` (solo admin) |
| Número de trabajadores | — | sí | sí | no | `size` (solo admin) |
| Sitio web | — | — | sí | no | `website` (solo admin) |
| Descripción | — | — | sí | **sí** | sí |
| Documento que lo respalda | — | sí (archivo) | verificación | no | **no** |
| Verificación de la empresa | moderación | RUES, llamada, correo | correo del dominio | no | `isVerified` (sin uso) |

**Riesgo real:** las estafas con ofertas falsas son frecuentes. Computrabajo modera cada empresa
comparando el NIT con el RUES y llamando o escribiendo antes de activarla.

## Vacantes: los 16 campos de la Resolución 2605 de 2014

| # | Campo | SkillMatch hoy |
|---|---|---|
| 1 | Título | sí |
| 2 | Descripción (funciones, habilidades, conocimientos) | sí |
| 3 | Tiempo de experiencia relacionada (meses o años) | en rangos (sin experiencia, hasta 1 año...) |
| 4 | Cantidad de vacantes | **no** |
| 5 | Cargo (ocupación u oficio) | **no** (solo título) |
| 6 | Tipo de documento del empleador | **no** |
| 7 | Número de identificación del empleador | **no** |
| 8 | Razón social | nombre de la empresa |
| 9 | Fecha de publicación | sí (automática) |
| 10 | Fecha de vencimiento (máximo 6 meses) | opcional y sin tope: **incumple** |
| 11 | Nivel de estudios requeridos | **no** |
| 12 | Profesión (si pide educación superior) | **no** |
| 13 | Salario o "a convenir" | sí |
| 14 | Departamento | **no** (solo ciudad) |
| 15 | Municipio | sí (ciudad) |
| 16 | Sector económico | sector de la empresa (sin poder editarlo) |

Reglas de moderación que usa Computrabajo y que convendría adoptar: una vacante por puesto, sin datos
de contacto en la descripción, sin pedir inversión al candidato, sin pagos solo por comisión, sin ventas
piramidales y sin exigir fotos.

## Qué se puede hacer ya en el frontend (sin tocar el backend)

1. **Fecha límite obligatoria en la vacante**, con un valor por defecto de 30 días y un tope de 6 meses
   (campo 10; el backend ya tiene `expirationDate`).
2. **Aviso de no discriminación en la ventana de oferta:** si la descripción o los requisitos piden una
   edad, un sexo, el estado civil o una foto, se avisa y no se publica hasta corregirlo (Ley 931 de 2004).
3. **Casilla "Soy mayor de 18 años"** en el registro de personas (declaración; no necesita campo nuevo).
4. **Página de política de tratamiento de datos** con la estructura que pide la Ley 1581 (responsable,
   finalidades, derechos, cómo ejercerlos, vigencia) y **enlace desde las casillas** de autorización.
   Los datos del responsable (razón social, NIT, domicilio y correo para peticiones) los deben poner
   ustedes; sin ellos la página no debe publicarse como definitiva.
5. **Avisos de moderación** en la ventana de oferta: sin datos de contacto en la descripción.

## Qué necesita el backend (Jesús)

- **Persona:** `tipoDocumento`, `numeroDocumento` (único), `fechaNacimiento`, `sexo`, lugar de
  nacimiento (país, departamento, municipio), residencia (departamento y municipio por separado),
  nivel educativo en cada estudio, aspiración salarial, idiomas y licencia de conducción (opcionales) y
  datos sensibles opcionales con su autorización aparte. Arreglar `/experiences` (responde 400).
- **Empresa:** `tipoPersona`, `nit` (único), `razonSocial` y `nombreComercial`, departamento, municipio y
  dirección, nombre, cargo, teléfono y correo de quien registra; permitir que **la empresa edite sus
  datos** (hoy `PUT /companies/{id}` es solo de ADMIN); usar `isVerified` con una verificación
  (RUES o manual) antes de dejar publicar.
- **Vacante:** `cargo` (ocupación), `cantidadVacantes`, `nivelEstudios`, `profesion`, `departamento`,
  experiencia en meses y `expirationDate` obligatoria con tope de 6 meses en el servidor.
- **Legal y operación:** decidir la figura (agencia privada lucrativa o sin ánimo de lucro) y tramitar
  la **autorización ante la Unidad del SPE** antes de operar con usuarios reales; reglamento de
  prestación de servicios público; política de tratamiento de datos; guardar la prueba de cada
  autorización (fecha, versión de la política); revisar si aplica el Registro Nacional de Bases de Datos
  de la SIC (desde el Decreto 090 de 2018, obligatorio para sociedades con activos de más de 100.000 UVT).

## Fuentes

- Unidad del SPE, trámite de autorización: https://www.serviciodeempleo.gov.co/atencion-a-la-ciudadania/tramite-en-linea/autorizacion/
- Decreto 1823 de 2020: https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=154447
- Resolución 2605 de 2014 (contenido mínimo de la vacante): https://cancilleria.gov.co/sites/default/files/Normograma/docs/resolucion_mtra_2605_2014.htm
- Resolución 295 de 2017 (hoja de vida): https://jurinfo.jep.gov.co/normograma/compilacion/docs/resolucion_mtra_0295_2017.htm
- Resolución 4569 de 2025 (modifica la 295): https://www.alcaldiabogota.gov.co/sisjur/normas/Norma1.jsp?i=192951&dt=S
- Reglamento de prestación de servicio de Computrabajo (DGNET): https://co.computrabajo.com/prestaciondeservicio/
- Registro de empresas de Computrabajo: https://empresa.co.computrabajo.com/Registro/
- Decreto 1377 de 2013: https://www.anm.gov.co/sites/default/files/decreto_1377_de_2013_0.pdf
- Ley 931 de 2004: https://www1.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=15591
