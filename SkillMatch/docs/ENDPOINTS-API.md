# 📋 RESUMEN DE ENDPOINTS - SkillMatch Backend

## 🔒 Autenticación
Base URL: `http://localhost:8080/api/auth`

| Método | Endpoint | Descripción | Autenticación |
|--------|----------|-------------|---------------|
| POST | `/register` | Registrar nuevo usuario | No |
| POST | `/login` | Iniciar sesión (retorna JWT) | No |

**Body de registro:**
```json
{
  "username": "usuario123",
  "email": "usuario@example.com",
  "password": "password123"
}
```

**Body de login:**
```json
{
  "username": "usuario@example.com",
  "password": "password123"
}
```

---

## 👥 Usuarios
Base URL: `http://localhost:8080/api/users`

| Método | Endpoint | Descripción | Roles |
|--------|----------|-------------|-------|
| GET | `/me` | Obtener perfil del usuario autenticado | USER, EMPRESA, ADMIN |
| GET | `/{id}` | Obtener usuario por ID | ADMIN |
| GET | `/` | Listar todos los usuarios | ADMIN |
| PUT | `/{id}` | Actualizar usuario | USER (propio), ADMIN |
| DELETE | `/{id}` | Eliminar usuario | ADMIN |

---

## 🏢 Empresas (Companies)
Base URL: `http://localhost:8080/api/companies`

| Método | Endpoint | Descripción | Roles |
|--------|----------|-------------|-------|
| POST | `/` | Crear nueva empresa | EMPRESA, ADMIN |
| PUT | `/{id}` | Actualizar empresa | EMPRESA, ADMIN |
| GET | `/{id}` | Obtener empresa por ID | Público |
| GET | `/` | Listar empresas (activas con ?active=true) | Público |
| GET | `/search?keyword=XXX` | Buscar empresas por palabra clave | Público |
| GET | `/filter?industry=X&location=Y` | Filtrar empresas | Público |
| DELETE | `/{id}` | Eliminar empresa (soft delete) | EMPRESA, ADMIN |
| POST | `/{id}/verify` | Verificar empresa | ADMIN |

**Body para crear empresa:**
```json
{
  "name": "TechCorp SA",
  "email": "contact@techcorp.com",
  "description": "Empresa de tecnología innovadora",
  "industry": "Tecnología",
  "size": "50-200",
  "location": "Bogotá",
  "website": "https://techcorp.com",
  "phone": "+57 300 123 4567",
  "foundedYear": 2015,
  "benefits": "Trabajo remoto, seguro médico, capacitaciones"
}
```

---

## 💼 Ofertas Laborales (Jobs)
Base URL: `http://localhost:8080/api/jobs`

| Método | Endpoint | Descripción | Roles |
|--------|----------|-------------|-------|
| POST | `/` | Crear nueva oferta | EMPRESA, ADMIN |
| PUT | `/{id}` | Actualizar oferta | EMPRESA, ADMIN |
| GET | `/{id}` | Obtener oferta por ID | Público |
| GET | `/` | Listar ofertas activas | Público |
| GET | `/recent` | Listar ofertas más recientes | Público |
| GET | `/search?keyword=XXX` | Buscar por palabra clave | Público |
| GET | `/filter?type=X&modality=Y` | Filtrar ofertas | Público |
| GET | `/company/{companyId}` | Ofertas de una empresa | Público |
| PATCH | `/{id}/status?status=X` | Cambiar estado (abierta/cerrada/pausada) | EMPRESA, ADMIN |
| DELETE | `/{id}` | Eliminar oferta (soft delete) | EMPRESA, ADMIN |

**Parámetros de filtro:**
- `type`: empleo, práctica, freelance
- `modality`: presencial, remoto, híbrido
- `experienceLevel`: junior, semi-senior, senior, sin-experiencia
- `location`: texto de ubicación
- `minSalary` / `maxSalary`: rangos salariales

**Body para crear oferta:**
```json
{
  "companyId": 1,
  "title": "Desarrollador Full Stack",
  "description": "Buscamos desarrollador con experiencia en React y Node.js",
  "type": "empleo",
  "experienceLevel": "semi-senior",
  "salaryMin": 3000000,
  "salaryMax": 5000000,
  "location": "Bogotá",
  "modality": "híbrido",
  "requirements": ["React", "Node.js", "PostgreSQL"],
  "responsibilities": ["Desarrollar features", "Code reviews"],
  "skills": ["JavaScript", "TypeScript", "Git"],
  "benefits": ["Trabajo remoto", "Seguro médico"],
  "expirationDate": "2025-12-31T23:59:59"
}
```

---

## 📝 Postulaciones (Applications)
Base URL: `http://localhost:8080/api/applications`

| Método | Endpoint | Descripción | Roles |
|--------|----------|-------------|-------|
| POST | `/` | Crear postulación | USER, ADMIN |
| GET | `/{id}` | Obtener postulación por ID | USER, EMPRESA, ADMIN |
| GET | `/my-applications` | Mis postulaciones | USER, ADMIN |
| GET | `/job/{jobId}` | Postulaciones de una oferta | EMPRESA, ADMIN |
| GET | `/company/{companyId}` | Postulaciones de una empresa | EMPRESA, ADMIN |
| GET | `/status/{status}` | Por estado (pendiente/revisada/aceptada/rechazada) | EMPRESA, ADMIN |
| PATCH | `/{id}/status?status=X&notes=Y` | Actualizar estado | EMPRESA, ADMIN |
| DELETE | `/{id}` | Eliminar postulación | USER, ADMIN |
| GET | `/job/{jobId}/count` | Contar postulaciones | Público |
| GET | `/check?jobId=X` | Verificar si ya se postuló | USER, ADMIN |

**Body para crear postulación:**
```json
{
  "jobId": 1,
  "resume": "https://drive.google.com/mi-cv",
  "coverLetter": "Me interesa esta posición porque..."
}
```

---

## 💡 Modelos de Perfil

### 🎓 Experiencia Laboral (Experience)
Estos modelos solo tienen repositorios, se pueden agregar controllers después si se necesitan.

**Repositorio disponible:** `ExperienceRepository`
- `findByUserId(userId)` - Experiencias de un usuario
- `findByUserIdAndIsCurrentTrue(userId)` - Trabajos actuales
- `findByUserIdOrderByStartDateDesc(userId)` - Ordenadas por fecha

**Estructura:**
```json
{
  "userId": 1,
  "company": "TechCorp",
  "position": "Desarrollador Full Stack",
  "startDate": "2020-01-15",
  "endDate": "2023-06-30",
  "isCurrent": false,
  "description": "Desarrollo de aplicaciones web",
  "location": "Bogotá"
}
```

### 📚 Educación (Education)
**Repositorio disponible:** `EducationRepository`
- `findByUserId(userId)` - Educación de un usuario
- `findByUserIdAndIsCurrentTrue(userId)` - Estudios actuales
- `findByUserIdOrderByStartDateDesc(userId)` - Ordenadas por fecha

**Estructura:**
```json
{
  "userId": 1,
  "school": "Universidad Nacional",
  "degree": "Ingeniería de Sistemas",
  "fieldOfStudy": "Desarrollo de Software",
  "startDate": "2015-01-15",
  "endDate": "2020-12-15",
  "isCurrent": false,
  "description": "Énfasis en desarrollo web"
}
```

### 🛠️ Habilidades (Skill)
**Repositorio disponible:** `SkillRepository`
- `findByUserId(userId)` - Habilidades de un usuario
- `findByUserIdAndLevel(userId, level)` - Por nivel
- `findByUserIdOrderByExperienceDesc(userId)` - Ordenadas por experiencia

**Estructura:**
```json
{
  "userId": 1,
  "name": "React",
  "level": "avanzado",
  "yearsOfExperience": 3,
  "description": "Desarrollo de SPAs con React y Redux"
}
```

---

## 🔐 Autenticación JWT

**Header requerido en endpoints protegidos:**
```
Authorization: Bearer <tu_token_jwt>
```

**Roles disponibles:**
- `USER` - Usuario normal (puede postularse)
- `EMPRESA` - Empresa (puede crear ofertas)
- `ADMIN` - Administrador (acceso total)

---

## 📊 Estado del Backend

✅ **Backend funcionando en:** http://localhost:8080
✅ **Base de datos:** MySQL 5.5.0 (localhost:3306/skillmatch)
✅ **Tablas creadas:** 7 (users, companies, jobs, applications, experiences, educations, skills)
✅ **Repositorios JPA:** 8
✅ **Controllers:** 4 (Auth, User, Company, Job, Application)
✅ **CORS:** Habilitado para todos los orígenes

---

## 🧪 Pruebas con cURL / Postman

### Ejemplo: Registrar usuario
```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "johndoe",
    "email": "john@example.com",
    "password": "password123"
  }'
```

### Ejemplo: Login
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john@example.com",
    "password": "password123"
  }'
```

### Ejemplo: Listar ofertas
```bash
curl http://localhost:8080/api/jobs
```

### Ejemplo: Crear postulación (con token)
```bash
curl -X POST http://localhost:8080/api/applications \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "jobId": 1,
    "coverLetter": "Me interesa esta posición..."
  }'
```

---

## 📝 Notas Importantes

1. **getUserIdFromAuthentication**: El método en `ApplicationController` actualmente retorna un placeholder (1L). Necesita implementarse correctamente para extraer el ID real del usuario autenticado del token JWT.

2. **Roles**: Por defecto los usuarios se crean con rol USER. Para crear empresas o admins, se debe modificar directamente en la base de datos o crear un endpoint específico.

3. **Soft Delete**: Las empresas y ofertas usan "soft delete" (marcan active=false en lugar de eliminar).

4. **Validaciones**: Todos los DTOs tienen validaciones con Jakarta Validation (@NotBlank, @Email, @Size, etc.).

5. **Búsquedas**: Implementadas con @Query de JPA para búsquedas eficientes con LIKE y filtros múltiples.

---

**Generado:** 26 de noviembre de 2025
**Versión Backend:** 0.0.1-SNAPSHOT
**Spring Boot:** 3.2.12
**Java:** 21 LTS
