# Guía de lenguaje de SkillMatch

SkillMatch es una bolsa de empleo para **todo tipo de personas y empresas** de Cartagena y la región:
quien busca su primer empleo o una práctica, quien tiene un oficio, técnicos, tecnólogos y
profesionales; hoteles, restaurantes, comercios, constructoras, empresas de logística, salud,
tecnología y cualquier otro sector. Los textos se escriben para que los entienda cualquiera,
sin importar su nivel de estudios ni su área.

## Principios

1. **Español de Colombia, de todos los días.** Las palabras que usa la gente en una entrevista o en un
   aviso de empleo, no las de un equipo de sistemas.
2. **Sin inglés ni jerga técnica.** Si existe una palabra en español, se usa esa.
3. **Ejemplos de muchos oficios.** En ejemplos, placeholders y demostraciones se mezclan sectores:
   mesero, recepcionista, auxiliar de bodega, vendedor, contador, enfermera, conductor, electricista,
   desarrollador. Nunca solo cargos de tecnología.
4. **Nadie se queda por fuera.** "Personas", "quien busca trabajo", "candidatos"; no solo "estudiantes"
   ni "talento joven".
5. **No prometer lo que no existe.** Nada de "algoritmo inteligente", "te avisamos" o "tu perfil
   trabaja por ti" si el sistema no lo hace.
6. **Mayúscula solo al inicio** y en nombres propios (ver `docs/ANALISIS-PROFUNDO.md`).

## Glosario

| No usar | Usar |
|---|---|
| match, matching, fit | compatibilidad, qué tanto encajas |
| skills, stack | habilidades |
| aplicar, aplicación (a una vacante) | postularse, postulación |
| candidaturas | postulaciones |
| feedback | comentarios, recomendaciones |
| networking, red profesional | red de contactos, contactos |
| freelance | independiente, por proyecto |
| junior / semi-senior / senior | sin experiencia · hasta 1 año · de 1 a 3 años · más de 3 años |
| seniority | experiencia que buscas |
| usuario (para quien busca trabajo) | persona que busca trabajo, candidato; botón: "Busco trabajo" |
| talento joven | personas de la región |
| oportunidades (como sección) | vacantes |
| email | correo electrónico |
| roadmap | lo que viene |
| badges, ranking, mentee | insignias, calificaciones, persona acompañada |
| remoto / híbrido (sin explicar) | remoto (desde casa) / híbrido (casa y sitio de trabajo) en filtros y formularios |

Se mantienen porque así se dicen en Colombia: vacante, empleo, práctica, hoja de vida, perfil,
postulación, entrevista, salario, prestación de servicios.

## Valores del backend y lo que se muestra

El backend guarda valores fijos; la interfaz muestra el texto de la derecha.

| Campo | Valor guardado | Se muestra |
|---|---|---|
| Tipo | `empleo` · `práctica` · `freelance` | Empleo · Práctica · Independiente |
| Modalidad | `presencial` · `remoto` · `híbrido` | Presencial · Remoto · Híbrido |
| Experiencia | `sin-experiencia` · `junior` · `semi-senior` · `senior` | Sin experiencia · Hasta 1 año · De 1 a 3 años · Más de 3 años |

## Para Jesús (backend)

- Los datos de prueba (`DataSeeder`) solo tienen vacantes, cargos y habilidades de sistemas
  (Desarrollador, DevOps, Java, Kubernetes...). Si la base publicada se llenó con ellos, todo el sitio
  parece de tecnología. Conviene mezclar sectores: turismo, comercio, logística, salud, construcción.
- La notificación de una postulación dice "Tu aplicación para X ha sido aceptada": debería decir
  "postulación".
- `createNewJobNotification` existe pero nadie la llama: no hay avisos de vacantes nuevas.
