
# SkillMatch — Guía de instalación y ejecución

Plataforma de conexión entre usuarios y empresas, estilo LinkedIn. Backend con Spring Boot + MongoDB, frontend con HTML/CSS/JS vanilla.

---

## Requisitos previos

Antes de correr el proyecto necesitas tener instalado:

| Herramienta | Versión mínima | Descarga |
|---|---|---|
| Java JDK | 17 o superior | https://adoptium.net |
| MongoDB Community Server | 7.x o 8.x | https://www.mongodb.com/try/download/community |

> El proyecto fue probado con Java 17 y MongoDB 8.3.2 en Windows 11.

Maven **no necesitas instalarlo** — el proyecto incluye `mvnw.cmd` que lo descarga automáticamente.

---

## Paso 1 — Instalar MongoDB

1. Descarga el instalador `.msi` desde https://www.mongodb.com/try/download/community
2. Ejecuta el instalador y selecciona **Complete**
3. Deja marcada la opción **"Install MongoDB as a Service"** — esto hace que MongoDB arranque automáticamente con Windows

Para verificar que está corriendo, abre CMD y escribe:

```
mongosh
```

Si aparece el prompt `test>` todo está bien. Escribe `exit` para salir.

---

## Paso 2 — Correr el backend

Abre una terminal (CMD o PowerShell) y navega a la carpeta `backend`:

```
cd backend
```

Luego ejecuta:

```
.\mvnw.cmd spring-boot:run -DskipTests
```

> El flag `-DskipTests` es necesario porque los tests de integración requieren configuración adicional.

La primera vez Maven descarga las dependencias, puede tardar unos minutos. Cuando veas esta línea, el backend está listo:

```
Started BackendApplication in X seconds
```

El servidor queda corriendo en **http://localhost:8080**

Al iniciar, el sistema crea automáticamente datos de prueba en MongoDB:
- 100 usuarios
- 50 empresas
- 100 ofertas de trabajo
- 100 aplicaciones

---

## Paso 3 — Correr el frontend

1. Abre la carpeta `SkillMatch/src/pages/` en VS Code
2. Click derecho sobre `index.html`
3. Selecciona **"Open with Live Server"**

El frontend se abre en el navegador en `http://localhost:5500`.

> **Importante:** el frontend debe abrirse con Live Server en el puerto 5500 o 5501. Otros puertos o métodos de apertura causarán errores de CORS con el backend.

---

## Estructura del proyecto

```
SkillMatchProject/
├── backend/                  # API REST — Spring Boot + MongoDB
│   ├── src/main/java/        # Código fuente Java
│   ├── src/main/resources/   # application.properties y migraciones
│   └── mvnw.cmd              # Maven wrapper para Windows
└── SkillMatch/
    └── src/
        ├── pages/            # HTML de cada pantalla
        └── assets/
            ├── js/           # Lógica del frontend
            └── css/          # Estilos
```

---

## Documentación adicional

Dentro de `SkillMatch/docs/` encontrarás:

- `ENDPOINTS-API.md` — lista completa de endpoints REST disponibles
- `GUIA-PRUEBAS.md` — cómo probar la API con Postman o Thunder Client

---

## Tecnologías usadas

**Backend**
- Java 17 
- Spring Boot 3.5.14
- Spring Security + JWT
- MongoDB
- Maven

**Frontend**
- HTML5 / CSS3
- JavaScript
- Live Server
