# SkillMatch Cartagena

## 🎯 Descripción
SkillMatch es una plataforma profesional innovadora diseñada para conectar usuarios de Cartagena con oportunidades laborales locales. Utilizando tecnología de matching inteligente, creamos conexiones perfectas entre el talento local y las empresas de la región.

## ✨ Versión 2.0 - Sistema Profesional Completo

Se ha implementado un sistema robusto y profesional inspirado en las mejores prácticas de LinkedIn, pero diseñado específicamente para la conexión usuarios-empresas en Cartagena.

### 👥 Características Para Usuarios
- **Perfil Profesional Completo** - Experiencia, educación, certificaciones y proyectos
- **Oportunidades Personalizadas** - Sistema de búsqueda y filtros avanzados
- **Conexiones y Networking** - Conectar con empresas y recibir mensajes
- **Recomendaciones** - Testimonios y evaluaciones de empresas
- **Portfolio** - Showcase de proyectos y logros
- **Match Score** - Compatibilidad inteligente con ofertas

### 💼 Características Para Empresas
- **Perfil Corporativo** - Información, certificaciones y beneficios
- **Gestión de Ofertas** - Publicar y administrar oportunidades
- **Candidatos Recomendados** - IA sugiere candidatos ideales
- **Analytics** - Métricas de reclutamiento y contratación
- **Mensajería Directa** - Chat con candidatos interesados
- **Testimonios** - Feedback de candidatos contratados

## 📂 Nuevas Páginas Implementadas

| Página | Archivo | Descripción |
|--------|---------|-------------|
| 👤 Perfil Usuario | `perfil-usuario.html` | Perfil completo con experiencia, educación, proyectos y recomendaciones |
| 💼 Oportunidades | `oportunidades.html` | Búsqueda avanzada de empleos, prácticas y proyectos freelance |
| 🤝 Conexiones | `conexiones.html` | Networking, sugerencias, empresas interesadas y mensajes |
| 🏢 Perfil Empresa | `perfil-empresa.html` | Dashboard empresarial con ofertas, candidatos y analytics |

## 📊 Impacto Actual
- **150+** Usuarios Registrados
- **45** Empresas Aliadas
- **89%** Tasa de Match Exitoso
- **3.2x** Más Oportunidades vs Método Tradicional

## 🚀 Próximas Funcionalidades
- **Simulador de Entrevistas IA**: Practica entrevistas con IA que simula diferentes tipos de entrevistadores
- **Predictor de Demanda Laboral**: Análisis del mercado local para recomendar habilidades en demanda
- **Sistema de Reputación**: Ranking basado en proyectos completados y feedback empresarial
- **Red de Mentorías**: Conexión con profesionales exitosos de Cartagena

## Estructura del Proyecto

```
SkillMatch/
├── src/
│   ├── pages/                 # Páginas HTML
│   │   ├── index.html         # Página principal
│   │   ├── login.html         # Página de login
│   │   ├── login-empresa.html
│   │   ├── login-usuario.html
│   │   ├── registro-empresa.html
│   │   └── registro-usuario.html
│   │
│   └── assets/               # Recursos estáticos
│       ├── css/              # Estilos CSS
│       │   └── app.css       # Estilos unificados (base, componentes, secciones, responsive)
│       └── img/              # Imágenes
```

## Características

- Interfaz moderna y responsive
- Registro y login de usuarios
- Perfiles para usuarios y empresas
- Sistema de búsqueda de oportunidades
- Diseño intuitivo y amigable

## Tecnologías Utilizadas
- HTML5
- CSS3
- Diseño Responsive
- Interfaz Intuitiva y Moderna

## Estado del Proyecto
Actualmente en desarrollo, con las siguientes fases planificadas:
- [x] Diseño de interfaz de usuario
- [x] Implementación del frontend estático
- [ ] Configuración de base de datos
- [ ] Desarrollo del backend
- [ ] Implementación de API
- [ ] Integración frontend-backend

## Misión
Potenciar el ecosistema empresarial y educativo de Cartagena de Indias, facilitando la conexión entre el talento local y las oportunidades laborales de la región.

## Cómo Iniciar el Proyecto

1. Clonar el repositorio
2. Abrir con Visual Studio Code
3. Instalar la extensión "Live Server"
4. Click derecho en `src/pages/index.html`
5. Seleccionar "Open with Live Server"

Si ves estilos faltantes, verifica que la página cargue `../assets/css/app.css`. Todas las páginas han sido actualizadas para usarlo.

## Páginas Principales

1. **Inicio** (`index.html`)
   - Landing page principal
   - Información del servicio
   - Estadísticas y beneficios

2. **Login** (`login.html`)
   - Acceso para usuarios
   - Selección de tipo de usuario

3. **Registro**
   - Formulario para usuarios
   - Formulario para empresas

## Estilos

Convención CSS unificada:
- `src/assets/css/app.css`: estilos compartidos del sitio (base, botones, formularios, secciones, tarjetas y media queries). También contiene los antiguos overrides de la landing.

Todos los estilos que vivían en `Style.css` ahora residen en `app.css` para evitar duplicidad y mantener una única fuente de verdad.

Nota: La antigua carpeta de módulos (`assets/css/modules/`) y archivos como `base.css`, `components.css` y `layout.css` fueron integrados en `app.css` para simplificar mantenimiento.

## Desarrollo

## Documentación

La documentación del proyecto se encuentra en `docs/`:
- Inicio rápido: `docs/quick-start.md`
- Características: `docs/features.md`
- Guía de navegación: `docs/navigation-guide.md`
- Resumen de implementación: `docs/implementation-summary.md`
- Resumen ejecutivo: `docs/executive-summary.md`
- Índice de archivos: `docs/file-index.md`
- Resumen visual: `docs/visual-summary.txt`

El proyecto está siendo desarrollado con un enfoque en:
- Experiencia de usuario intuitiva
- Diseño responsive y moderno
- Optimización para todos los navegadores
- Accesibilidad web

---
Desarrollado para conectar el talento local en Cartagena de Indias.
© 2025 SkillMatch Cartagena