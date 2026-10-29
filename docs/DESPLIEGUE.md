# Guía de despliegue de SkillMatch

Esta guía asume que no hay nada creado todavía. Al final vas a tener la app
completa (API + páginas) funcionando en una URL pública, con MongoDB Atlas.

La idea central del arreglo: **un solo servicio sirve el backend y el frontend**.
Eso elimina de raíz los problemas de CORS, de URLs mal configuradas y de tener
dos despliegues que hay que mantener sincronizados.

---

## Paso 1 — Crear la base de datos en MongoDB Atlas

1. Entra a <https://cloud.mongodb.com> y crea un cluster gratuito (M0).
2. En **Database Access**, crea un usuario. Anota el usuario y la contraseña.
   - Evita caracteres raros en la contraseña. Si usas `@ # ? / :` vas a tener
     que codificarlos en la URI (`@` → `%40`, `#` → `%23`).
3. En **Network Access**, agrega la IP `0.0.0.0/0` (acceso desde cualquier lugar).
   Sin esto el hosting no puede conectarse, y es el error #1 al desplegar.
4. En **Database → Connect → Drivers**, copia la cadena. Se ve así:

```
mongodb+srv://usuario:contrasena@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

5. Agrégale el nombre de la base de datos justo antes del `?`:

```
mongodb+srv://usuario:contrasena@cluster0.xxxxx.mongodb.net/skillmatch?retryWrites=true&w=majority
```

Esa cadena final es tu `MONGODB_URI`.

---

## Paso 2 — Generar la clave JWT

La aplicación **no arranca** si esta clave tiene menos de 32 caracteres (antes
fallaba con un error críptico; ahora te lo dice claro en el log).

```bash
openssl rand -base64 48
```

Si no tienes `openssl`, sirve cualquier cadena larga y aleatoria de 40+ caracteres.

---

## Paso 3 — Probar en local antes de subir

```bash
# Desde la raíz del repositorio
docker build -t skillmatch .
docker run -p 8080:8080 \
  -e MONGODB_URI="mongodb+srv://usuario:contrasena@cluster0.xxxxx.mongodb.net/skillmatch" \
  -e JWT_SECRET="tu-clave-de-al-menos-32-caracteres" \
  skillmatch
```

Luego abre:

- <http://localhost:8080/api/health> → debe responder `"mongodb": "UP"`
- <http://localhost:8080/> → debe cargar la página de inicio
- <http://localhost:8080/swagger-ui.html> → documentación de la API

Si `/api/health` dice `DOWN`, el problema es la URI o el Network Access de
Atlas. No sigas al paso 4 hasta que esto dé `UP`.

### Sin Docker (solo backend)

```bash
cd backend
./start.sh            # Linux / macOS
.\start.ps1           # Windows
```

Y abre el frontend con Live Server desde `SkillMatch/src/pages/index.html`.
El archivo `api-config.js` detecta que estás en `localhost` y apunta solo a
`http://localhost:8080/api`.

---

## Paso 4 — Desplegar en Railway

1. Sube el repositorio a GitHub.
2. En Railway: **New Project → Deploy from GitHub repo**.
3. Railway detecta el `Dockerfile` de la raíz y el `railway.json`
   (que ya trae configurado el healthcheck en `/api/health`).
4. En **Variables**, agrega:

   | Variable      | Valor                                              |
   |---------------|----------------------------------------------------|
   | `MONGODB_URI` | la cadena del paso 1                               |
   | `JWT_SECRET`  | la clave del paso 2                                |

   No pongas `PORT`: Railway lo inyecta solo.

5. En **Settings → Networking → Generate Domain**.
6. Abre `https://tu-dominio.up.railway.app/api/health` para confirmar.

### Render

Igual, pero usa el `render.yaml` incluido: **New → Blueprint**, apunta al repo,
y define `MONGODB_URI` cuando lo pida.

---

## Paso 5 — Llenar la base con datos de prueba (opcional, una sola vez)

La semilla viene **apagada** por defecto. Para poblar una base vacía:

1. Agrega la variable `SEED_ENABLED=true` y redespliega.
2. Espera a ver en los logs `Seed completado exitosamente`.
3. Vuelve a poner `SEED_ENABLED=false` y redespliega.

Puedes ajustar el tamaño con `SEED_USERS`, `SEED_COMPANIES`, `SEED_JOBS`,
`SEED_APPLICATIONS`. Los valores por defecto (150 / 40 / 120 / 300) están
pensados para el plan gratuito de Atlas.

Los usuarios creados son `usuario0@skillmatch.com` … y las empresas
`empresa0@skillmatch.com` …, todos con contraseña `password123`.

---

## Alternativa: frontend separado (Netlify) y backend en Railway

Solo si necesitas separarlos:

1. En Netlify, publica la carpeta `SkillMatch/src`.
2. Edita `SkillMatch/src/assets/js/api-config.js` y pon la URL del backend:

```js
const API_URL_PRODUCCION = 'https://tu-dominio.up.railway.app/api';
```

3. En Railway agrega estas variables:

```
ALLOWED_ORIGINS=https://tu-sitio.netlify.app
COOKIE_SECURE=true
COOKIE_SAME_SITE=None
```

---

## Todas las variables de entorno

| Variable | Obligatoria | Por defecto | Para qué sirve |
|---|---|---|---|
| `MONGODB_URI` | Sí | `mongodb://localhost:27017/skillmatch` | Conexión a Mongo |
| `JWT_SECRET` | Sí | clave de desarrollo | Firma de los tokens (mín. 32 caracteres) |
| `PORT` | No | `8080` | Lo inyecta el hosting |
| `JWT_EXPIRATION` | No | `86400000` | Duración del token en ms |
| `ALLOWED_ORIGINS` | No | localhost + dominios comunes | CORS |
| `COOKIE_SECURE` | No | `false` | `true` si usas HTTPS |
| `COOKIE_SAME_SITE` | No | `Lax` | `None` si el front está en otro dominio |
| `SEED_ENABLED` | No | `false` | Poblar datos de prueba |
| `RATE_LIMIT_MAX` | No | `20` | Intentos de login por IP/minuto |
| `LOG_LEVEL_APP` | No | `INFO` | `DEBUG` para diagnosticar |

También sirven `MONGO_URL`, `MONGODB_URL` y `SPRING_DATA_MONGODB_URI` como
nombres alternativos de la URI, por si el hosting inyecta uno de esos.

---

## Errores comunes y qué significan

| Lo que ves | Causa real | Solución |
|---|---|---|
| `/api/health` responde `"mongodb": "DOWN"` | Atlas no acepta la conexión | Network Access → `0.0.0.0/0` |
| `MongoTimeoutException` en los logs | URI mal escrita o contraseña sin codificar | Revisa la URI, codifica `@` como `%40` |
| La app no arranca: `JWT_SECRET ... al menos 32 caracteres` | Clave corta | Genera una nueva con `openssl rand -base64 48` |
| El deploy se queda "building" y muere | Faltan `MONGODB_URI` o `JWT_SECRET` | Agrégalas en Variables |
| Error de CORS en la consola del navegador | Frontend en otro dominio sin permiso | Agrega el dominio a `ALLOWED_ORIGINS`, o sirve el frontend desde el backend |
| `429 Demasiados intentos` | Límite de login por IP | Sube `RATE_LIMIT_MAX` |
| Páginas cargan sin estilos | Ruta de los assets | Entra por `/` , no abras el `.html` suelto |

Para ver qué está pasando, los logs muestran al arrancar un bloque con el puerto,
el destino de Mongo (con la contraseña oculta) y si la conexión funcionó.

---

## Notas sobre las pruebas

`mvn test` incluye una prueba de integración (`AuthIntegrationTest`) que
necesita un MongoDB corriendo en `localhost:27017`. Si no lo tienes, usa:

```bash
mvn clean package -DskipTests
```

Es lo que hace el `Dockerfile`, así que el despliegue no se ve afectado.
