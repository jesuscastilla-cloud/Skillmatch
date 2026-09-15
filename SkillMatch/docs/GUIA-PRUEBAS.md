# 🧪 GUÍA DE PRUEBAS - SkillMatch Backend

## ✅ Estado Actual
- **Backend:** ✅ Corriendo en http://localhost:8080
- **Base de datos:** ✅ MySQL conectado
- **Tablas:** ✅ 7 tablas creadas
- **Endpoints:** ✅ 50+ endpoints disponibles

---

## 🎯 Formas de Probar el Backend

### **Opción 1: Interfaz Web Interactiva (MÁS FÁCIL)** ⭐

1. Abre el archivo: `c:\Users\amaya\Desktop\PA\SkillMatch\test-api.html`
2. Se abrirá una página web bonita con botones para probar cada endpoint
3. Haz clic en los botones y verás las respuestas en tiempo real

**Funcionalidades:**
- ✅ Verificar estado del servidor
- ✅ Registrar usuarios
- ✅ Iniciar sesión (guarda el token automáticamente)
- ✅ Listar, buscar y crear empresas
- ✅ Listar, buscar y filtrar ofertas
- ✅ Crear postulaciones
- ✅ Test completo automático

---

### **Opción 2: Script de PowerShell (AUTOMATIZADO)**

1. Abre PowerShell en: `c:\Users\amaya\Desktop\PA\SkillMatch`
2. Ejecuta:
```powershell
.\test-api.ps1
```

**Qué hace:**
- ✅ Verifica servidor
- ✅ Registra usuario automáticamente
- ✅ Hace login y obtiene token
- ✅ Crea empresa de prueba
- ✅ Crea oferta de prueba
- ✅ Crea postulación de prueba
- ✅ Muestra resumen de todos los tests

**Ejemplo de salida:**
```
=================================
  SKILLMATCH API TESTER
=================================

[1] Verificando servidor...
✅ SUCCESS: GET /jobs
   Servidor funcionando correctamente ✓

[2] Registrando usuario de prueba...
✅ SUCCESS: POST /auth/register
   Usuario registrado: testuser_1234@example.com

[3] Iniciando sesión...
✅ SUCCESS: POST /auth/login
   Token JWT obtenido ✓
   Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

...
```

---

### **Opción 3: Navegador Web (MANUAL)**

Abre tu navegador y prueba estos endpoints directamente:

#### **Endpoints Públicos (sin autenticación):**

```
✅ Listar empresas:
http://localhost:8080/api/companies

✅ Buscar empresas:
http://localhost:8080/api/companies/search?keyword=Tech

✅ Listar ofertas:
http://localhost:8080/api/jobs

✅ Buscar ofertas:
http://localhost:8080/api/jobs/search?keyword=Desarrollador

✅ Filtrar ofertas:
http://localhost:8080/api/jobs/filter?type=empleo&modality=remoto

✅ Ofertas recientes:
http://localhost:8080/api/jobs/recent
```

---

### **Opción 4: Postman / Thunder Client (PROFESIONAL)**

#### **1. Importar Collection:**
Crea una nueva colección en Postman con estas requests:

#### **A. Registro de Usuario**
```
POST http://localhost:8080/api/auth/register
Content-Type: application/json

{
  "username": "testuser",
  "email": "test@example.com",
  "password": "password123"
}
```

#### **B. Login**
```
POST http://localhost:8080/api/auth/login
Content-Type: application/json

{
  "username": "test@example.com",
  "password": "password123"
}

RESPUESTA:
{
  "token": "eyJhbGci...",
  "type": "Bearer"
}
```

**⚠️ IMPORTANTE:** Copia el token de la respuesta para usarlo en los siguientes requests.

#### **C. Crear Empresa (requiere token)**
```
POST http://localhost:8080/api/companies
Content-Type: application/json
Authorization: Bearer TU_TOKEN_AQUI

{
  "name": "TechCorp SA",
  "email": "contact@techcorp.com",
  "description": "Empresa de tecnología",
  "industry": "Tecnología",
  "size": "50-200",
  "location": "Bogotá"
}
```

#### **D. Crear Oferta (requiere token)**
```
POST http://localhost:8080/api/jobs
Content-Type: application/json
Authorization: Bearer TU_TOKEN_AQUI

{
  "companyId": 1,
  "title": "Desarrollador Full Stack",
  "description": "Buscamos desarrollador con experiencia",
  "type": "empleo",
  "experienceLevel": "semi-senior",
  "salaryMin": 3000000,
  "salaryMax": 5000000,
  "location": "Bogotá",
  "modality": "híbrido",
  "requirements": ["React", "Node.js"],
  "skills": ["JavaScript", "TypeScript"]
}
```

#### **E. Crear Postulación (requiere token)**
```
POST http://localhost:8080/api/applications
Content-Type: application/json
Authorization: Bearer TU_TOKEN_AQUI

{
  "jobId": 1,
  "resume": "https://drive.google.com/mi-cv",
  "coverLetter": "Me interesa esta posición porque..."
}
```

---

### **Opción 5: cURL (TERMINAL)**

Si tienes curl instalado:

```bash
# Listar ofertas
curl http://localhost:8080/api/jobs

# Registrar usuario
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"test\",\"email\":\"test@example.com\",\"password\":\"pass123\"}"

# Login
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"test@example.com\",\"password\":\"pass123\"}"
```

---

## 📊 Verificar Base de Datos MySQL

Abre MySQL Workbench o el cliente que uses:

```sql
USE skillmatch;

-- Ver usuarios registrados
SELECT * FROM users;

-- Ver empresas
SELECT * FROM companies;

-- Ver ofertas
SELECT * FROM jobs;

-- Ver postulaciones
SELECT * FROM applications;

-- Ver experiencias laborales
SELECT * FROM experiences;

-- Ver educación
SELECT * FROM educations;

-- Ver habilidades
SELECT * FROM skills;

-- Contar registros
SELECT 
    (SELECT COUNT(*) FROM users) as usuarios,
    (SELECT COUNT(*) FROM companies) as empresas,
    (SELECT COUNT(*) FROM jobs) as ofertas,
    (SELECT COUNT(*) FROM applications) as postulaciones;
```

---

## 🎯 Test Completo del Flujo

**Escenario:** Usuario se registra, busca ofertas y se postula.

1. **Registrar Usuario** → POST `/api/auth/register`
2. **Hacer Login** → POST `/api/auth/login` (guarda el token)
3. **Ver Ofertas** → GET `/api/jobs`
4. **Buscar Oferta Específica** → GET `/api/jobs/search?keyword=Desarrollador`
5. **Ver Detalles de Oferta** → GET `/api/jobs/1`
6. **Postularse** → POST `/api/applications` (con token)
7. **Ver Mis Postulaciones** → GET `/api/applications/my-applications` (con token)

**Escenario:** Empresa crea ofertas.

1. **Registrar Usuario Empresa** → POST `/api/auth/register`
2. **Login** → POST `/api/auth/login`
3. **Crear Empresa** → POST `/api/companies` (con token)
4. **Crear Oferta** → POST `/api/jobs` (con token, companyId)
5. **Ver Postulaciones** → GET `/api/applications/job/1` (con token)
6. **Actualizar Estado** → PATCH `/api/applications/1/status?status=revisada` (con token)

---

## ⚡ Tests Rápidos

### **Test 1: Servidor funcionando**
```
http://localhost:8080/api/jobs
```
✅ Debería retornar `[]` o lista de jobs.

### **Test 2: Endpoint no existente**
```
http://localhost:8080/api/noexiste
```
❌ Debería retornar error 404.

### **Test 3: Endpoint protegido sin token**
```
POST http://localhost:8080/api/companies
```
❌ Debería retornar error 403 (Forbidden).

---

## 📝 Endpoints Más Importantes

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/register` | Registrar usuario | No |
| POST | `/api/auth/login` | Login (retorna JWT) | No |
| GET | `/api/companies` | Listar empresas | No |
| POST | `/api/companies` | Crear empresa | Sí |
| GET | `/api/jobs` | Listar ofertas | No |
| POST | `/api/jobs` | Crear oferta | Sí |
| GET | `/api/jobs/search?keyword=X` | Buscar ofertas | No |
| POST | `/api/applications` | Postularse | Sí |
| GET | `/api/applications/my-applications` | Mis postulaciones | Sí |

---

## 🔧 Solución de Problemas

### **Problema: "Cannot connect to server"**
✅ **Solución:** Verifica que el backend esté corriendo:
```powershell
cd c:\Users\amaya\Downloads\backend
.\mvnw.cmd spring-boot:run
```

### **Problema: "403 Forbidden"**
✅ **Solución:** Necesitas hacer login y usar el token en el header:
```
Authorization: Bearer TU_TOKEN_AQUI
```

### **Problema: "MySQL connection error"**
✅ **Solución:** Verifica que MySQL esté corriendo:
```powershell
Get-Service MySQL*
```

### **Problema: "CORS error en navegador"**
✅ **Solución:** CORS ya está habilitado, pero si usas archivo local (file://), abre el test-api.html desde un servidor local o usa la opción de PowerShell.

---

## 📚 Documentación Completa

Ver archivo completo: `c:\Users\amaya\Desktop\PA\SkillMatch\docs\ENDPOINTS-API.md`

---

## ✅ Checklist de Verificación

- [ ] Backend corriendo en puerto 8080
- [ ] MySQL conectado
- [ ] Puedo registrar usuarios
- [ ] Puedo hacer login y obtener token
- [ ] Puedo listar empresas
- [ ] Puedo listar ofertas
- [ ] Puedo crear postulaciones (con token)
- [ ] Las validaciones funcionan (emails, campos requeridos)
- [ ] Los filtros y búsquedas funcionan

---

**🎉 Si todos los tests pasan, tu backend está 100% funcional!**
