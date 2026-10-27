# Operación de SkillMatch: incidentes, copias, secretos y brechas

Qué hacer cuando algo sale mal, y lo que hay que hacer con calma antes de que pase. Sale de la auditoría
(`docs/AUDITORIA-BACKEND.md`, sección 5 y fase 11).

> Lo legal (sección 5) es una guía para hablar con un abogado, **no** una asesoría legal. Verificar plazos y
> obligaciones con quien conozca la Ley 1581 y la Superintendencia de Industria y Comercio (SIC).

---

## 1. Accesos y contactos

Quién puede entrar a cada servicio. Sin esto, en una emergencia se pierde tiempo buscando quién tiene la clave.
Revisar cada 6 meses y quitar a quien ya no trabaje en el proyecto.

| Servicio | Para qué | Quién tiene acceso | Verificación en dos pasos |
|---|---|---|---|
| Render | Servidor y variables de entorno (secretos) | [completar] | [sí/no] |
| MongoDB Atlas | La base de datos | [completar] | [sí/no] |
| GitHub | El código; cada push a `main` despliega | [completar] | [sí/no] |
| Google Cloud | "Continuar con Google" (fase 10) | [completar] | [sí/no] |
| Brevo | Correos (fase 8) | [completar] | [sí/no] |
| Twilio | SMS / WhatsApp (fase 9, si se activa) | [completar] | [sí/no] |

- **Responsable de datos** (quien decide y avisa en un incidente): [completar nombre y correo].
- **Correo de contacto para las personas** (el de `politica-datos.html`): [completar].
- **Abogado o asesor** para la sección 5: [completar].

Activar la verificación en dos pasos en **todos** estos servicios es la protección más barata que existe.

---

## 2. Respuesta ante incidentes

Un incidente es cualquier cosa que ponga en riesgo los datos o el servicio: una contraseña filtrada, alguien
entrando a cuentas ajenas, la base borrada, el sitio caído, un correo raro de "tus datos fueron publicados".

### 2.1 Qué tan grave es

| Nivel | Ejemplos | Cuándo actuar |
|---|---|---|
| **Crítico** | Se filtró `MONGODB_URI` o `JWT_SECRET`; alguien descargó datos de la base; la base fue borrada | Ya mismo, aunque sea de noche |
| **Alto** | Una cuenta tomada por otra persona; un fallo que deja ver datos ajenos | El mismo día |
| **Medio** | Ataque de fuerza bruta (muchos 429); el sitio caído | En horas |
| **Bajo** | Un error 500 que se repite; spam de registros | Esta semana |

### 2.2 Paso a paso

1. **Anotar la hora** en que se detectó y quién lo detectó. Todo lo que siga va en el registro (2.5).
2. **Contener** (detener el daño), según el caso, con los comandos de 2.3:
   - Una cuenta tomada → cerrar sus sesiones y, si hace falta, desactivarla.
   - Se filtró `JWT_SECRET` → rotarlo (cierra **todas** las sesiones).
   - Se filtró la contraseña de MongoDB → cambiarla en Atlas y actualizar `MONGODB_URI` en Render.
   - No se sabe qué pasa pero hay daño → **suspender el servicio** en Render ("Suspend Service").
3. **Evaluar:** qué datos, de cuántas personas, desde cuándo. Buscar en los logs (2.4) y en la base.
4. **Avisar** si hubo datos personales en riesgo (sección 5). El plazo corre desde que se detectó.
5. **Corregir** la causa (en una rama, nunca directo en `main`) y restaurar desde una copia si hace falta (3.4).
6. **Escribir qué pasó**, sin culpar a nadie: causa, arreglo, cómo evitar que se repita.

### 2.3 Comandos para contener

Se corren con `mongosh` contra la base real. La URI está en Render (variable `MONGODB_URI`); **no** pegarla en
chats ni en archivos del repositorio. En PowerShell: `$env:MONGODB_URI = '...'` y luego `mongosh $env:MONGODB_URI`.

```javascript
// Buscar la cuenta
db.users.findOne({ email: "persona@correo.com" }, { _id: 1, email: 1, enabled: 1, tokenVersion: 1 })

// Cerrar TODAS las sesiones de esa cuenta (sus tokens dejan de servir al instante)
db.users.updateOne({ email: "persona@correo.com" }, { $inc: { tokenVersion: 1 } })

// Desactivarla (no puede entrar, ni con contraseña, ni con Google, ni con código)
db.users.updateOne({ email: "persona@correo.com" }, { $set: { enabled: false }, $inc: { tokenVersion: 1 } })

// Volver a activarla cuando esté resuelto (la persona entra y crea contraseña nueva con "¿Olvidaste tu contraseña?")
db.users.updateOne({ email: "persona@correo.com" }, { $set: { enabled: true } })
```

Cerrar **todas** las sesiones de **todo** el sitio: rotar `JWT_SECRET` (4.2).

### 2.4 Qué buscar en los logs de Render

Render > el servicio > **Logs**, con el buscador. El plan gratis guarda pocos días: si hay un incidente, copiar
los logs relevantes **ya** (y guardarlos fuera del repositorio, porque pueden tener IPs).

| Buscar | Qué significa |
|---|---|
| `Error interno [` | Un error 500. La persona ve un código (por ejemplo `a1b2c3d4`); buscar ese código da el detalle |
| `Límite de intentos para IP` | Alguien llegó a 20 intentos por minuto en login, registro, códigos o Google |
| `Cuenta bloqueada` | 5 contraseñas equivocadas seguidas en una cuenta (bloqueo de 15 minutos) |
| `Login exitoso: id=` | Entradas a una cuenta (para ver desde cuándo entra alguien) |
| `unida a Google con correo sin verificar` | Se cortó un posible robo por pre-registro (fase 10) |
| `Exportación de datos personales` | Alguien descargó los datos de su cuenta |
| `Contraseña actualizada` / `Contraseña recuperada` | Cambios de contraseña (cierran las otras sesiones) |
| `Retención:` | Lo que borraron las tareas nocturnas (postulaciones viejas, cuentas inactivas) |

### 2.5 Registro del incidente (plantilla)

Copiar en un documento privado (no en el repositorio si tiene datos personales):

```
Incidente N.º:            Nivel: crítico / alto / medio / bajo
Detectado el:             (fecha y hora)       Por:
Qué se vio:
Qué datos y de cuántas personas (estimado):
Desde cuándo pudo estar pasando:
Contención (qué se hizo y a qué hora):
¿Hay que avisar a la SIC y a las personas? (sección 5)  Sí / No — por qué:
Avisos enviados (a quién, cuándo):
Causa:
Arreglo (rama / commit):
Cómo evitar que se repita:
Cerrado el:
```

---

## 3. Copias de seguridad

### 3.1 Por qué hacen falta

El plan gratis de MongoDB Atlas (M0) **no** hace copias automáticas (confirmarlo en Atlas > el clúster >
"Backup"). Si alguien borra la base o un error la daña, sin copia se pierde todo.

### 3.2 Las reglas

- **Una copia por semana** con `scripts/copia-mongo.sh`. Sale cifrada (AES-256) y comprobada.
- **Se guardan solo las 4 últimas** (unos 28 días). La política de datos promete que una cuenta borrada sale de
  las copias a los 30 días; guardar copias más viejas rompería esa promesa.
- **Nunca dentro del repositorio** (el script se niega) ni sin cifrar: tienen correos, teléfonos y mensajes.
- **Dos lugares:** la carpeta del computador (`~/copias-skillmatch`) y una copia de esa carpeta en otro sitio
  (por ejemplo una carpeta personal de Google Drive u OneDrive). Al estar cifradas, el servicio no puede leerlas.
- **La clave de cifrado** (`COPIA_CLAVE`, una frase larga) va en un gestor de contraseñas, **nunca** junto a las
  copias. Si se pierde la clave, las copias no sirven; dejarla también con una segunda persona de confianza.

### 3.3 Hacer la copia (cada semana)

En **Git Bash**, desde la carpeta del proyecto:

```bash
export MONGODB_URI='mongodb+srv://...'
export COPIA_CLAVE='la frase del gestor de contraseñas'
bash scripts/copia-mongo.sh
```

Debe terminar en `Copia lista: ...`. Si dice `ERROR`, la copia no quedó: revisar el mensaje. Al cerrar Git Bash
las dos variables se borran solas.

Programarla (opcional): en el Programador de tareas de Windows, una tarea semanal que ejecute Git Bash con ese
script. Necesita las dos variables guardadas en el usuario de Windows; si no se quiere eso, mejor un recordatorio
semanal en el calendario y hacerla a mano (toma un minuto).

### 3.4 Restaurar

**Prueba mensual** (la copia que nunca se probó no es una copia). Necesita MongoDB corriendo en el computador:

```bash
export COPIA_CLAVE='la frase'
bash scripts/restaurar-mongo.sh ~/copias-skillmatch/skillmatch-AAAA-MM-DD-HHMM.archive.gpg
```

Restaura en la base local `skillmatch-restaurada` y muestra cuántos documentos tiene cada colección. Comparar con
lo que se espera (por ejemplo, que `users` tenga más o menos las cuentas que hay en el sitio). Después, borrar esa
base local: `mongosh mongodb://localhost:27017/skillmatch-restaurada --eval 'db.dropDatabase()'`.

**Desastre real** (restaurar sobre Atlas):
1. Suspender el servicio en Render (para que nadie escriba mientras tanto).
2. Restaurar primero en local y revisar que la copia esté bien (como la prueba mensual).
3. Restaurar en Atlas. El script pide escribir `RESTAURAR`:
   ```bash
   export DESTINO_URI='mongodb+srv://...'       # la de Atlas, SIN el nombre de la base al final
   export BASE_DESTINO='skillmatch'             # el nombre real de la base (el que va en MONGODB_URI)
   bash scripts/restaurar-mongo.sh ~/copias-skillmatch/skillmatch-....archive.gpg
   ```
4. Reanudar el servicio. Al arrancar, el backend vuelve a crear los índices que falten.
5. Lo creado entre la copia y el desastre se perdió: anotarlo en el registro del incidente.

---

## 4. Rotación de secretos

Rotar es cambiar una clave por otra nueva. Se hace **cada 6 meses** y **ya mismo** si se filtró (se pegó en un chat,
se subió a GitHub, la vio alguien que no debía). Generar claves nuevas en Git Bash con:

```bash
openssl rand -base64 48
```

### 4.1 Registro de rotaciones

| Secreto | Última rotación | Próxima | Quién |
|---|---|---|---|
| `JWT_SECRET` | [completar] | +6 meses | |
| Contraseña de MongoDB (`MONGODB_URI`) | [completar] | +6 meses | |
| `GOOGLE_CLIENT_SECRET` | [completar] | +6 meses | |
| `MAIL_PASSWORD` (Brevo) | [completar] | +6 meses | |
| `TWILIO_AUTH_TOKEN` (si se usa) | [completar] | +6 meses | |
| `COPIA_CLAVE` (copias) | [completar] | Si se filtra | |

> La contraseña de MongoDB se filtró en un chat (pendientes 1.3 del informe): si no se ha cambiado, cambiarla ya.

### 4.2 Paso a paso

- **`JWT_SECRET`** (firma de las sesiones):
  1. Generar una nueva con `openssl rand -base64 48`.
  2. Render > Environment > `JWT_SECRET` > pegar > guardar. Render redespliega solo.
  3. Efecto: **todas** las sesiones se cierran; cada persona vuelve a entrar. Avisarlo si es un cambio planeado.
- **Contraseña de MongoDB:**
  1. Atlas > Database Access > el usuario de la app > Edit > Edit Password > generar una nueva.
  2. Armar la `MONGODB_URI` nueva con esa contraseña y ponerla en Render > Environment.
  3. Actualizar los `.env` locales de quien los tenga. La contraseña vieja deja de servir al guardar en Atlas:
     hacer los pasos seguidos para que el sitio no quede caído.
  4. Revisar en Atlas > Network Access que no esté abierto `0.0.0.0/0` sin necesidad.
- **`GOOGLE_CLIENT_SECRET`:**
  1. Google Cloud > APIs y servicios > Credenciales > el ID de cliente > "Agregar secreto".
  2. Poner el nuevo en Render. Cuando el sitio funcione con él, **desactivar y borrar** el viejo en Google Cloud.
- **`MAIL_PASSWORD` (Brevo):** Brevo > SMTP y API > generar una "SMTP key" nueva > ponerla en Render > borrar la
  vieja en Brevo.
- **`TWILIO_AUTH_TOKEN`:** Twilio > Account > API keys & tokens > "Request a secondary token" > ponerlo en Render >
  "Promote" > borrar el viejo.
- **`COPIA_CLAVE`:** las copias viejas siguen con la clave vieja. Hacer una copia nueva con la clave nueva y, cuando
  las 4 copias sean nuevas (un mes), borrar la clave vieja del gestor.

### 4.3 Si un secreto se subió a GitHub

Borrarlo del código **no basta**: queda en el historial. Rotarlo **primero** (4.2) y después limpiar. Para revisar
que no haya otros, la herramienta gratis `gitleaks` (`gitleaks detect` en la carpeta del proyecto).

---

## 5. Notificación de brechas (datos personales)

Una brecha es cuando datos personales quedan expuestos, se pierden o los ve quien no debía.

### 5.1 A quién avisar (Colombia, Ley 1581 de 2012) — verificar con el abogado

- **A la SIC:** la Ley 1581 (art. 17, literal n, y art. 18, literal k) obliga a informar a la Superintendencia de
  Industria y Comercio cuando se violen los códigos de seguridad y haya riesgo para la información de las personas.
  La SIC pide reportarlo dentro de los **15 días hábiles** siguientes a detectarlo; quien está inscrito en el
  Registro Nacional de Bases de Datos (RNBD) lo hace allí. Preguntar al abogado:
  - si SkillMatch debe inscribirse en el RNBD (depende del tamaño de la empresa) y, si no, por qué canal se avisa;
  - si el plazo y la forma siguen vigentes.
- **A las personas afectadas:** lo antes posible, con lo que pasó, qué datos y qué deben hacer (abajo).
- **Europa (solo si hubiera usuarios allí y aplicara el RGPD):** 72 horas a la autoridad de protección de datos.

### 5.2 Plantilla: aviso a la SIC (lo que hay que tener listo)

```
Responsable del tratamiento: SkillMatch — [razón social / NIT si existe] — [contacto]
Fecha y hora en que se detectó el incidente:
Fecha (o rango) en que ocurrió:
Qué pasó (breve):
Tipo de datos afectados: (correo, nombre, teléfono, hoja de vida, mensajes, contraseñas cifradas, ...)
Número aproximado de personas afectadas:
¿Hay datos de menores de edad? (el registro exige ser mayor de edad)
Medidas tomadas para contener:
Medidas para que no se repita:
¿Se avisó a las personas? ¿Cuándo y cómo?
```

### 5.3 Plantilla: aviso a las personas

```
Asunto: Aviso de seguridad sobre tu cuenta de SkillMatch

Hola [nombre],

El [fecha] detectamos [qué pasó, en palabras simples]. Esto pudo afectar estos datos tuyos: [lista].
[No / Sí] se vieron afectadas tus contraseñas (las guardamos cifradas; aun así, te recomendamos cambiarla).

Lo que hicimos: [contención y arreglo].
Lo que te recomendamos: cambiar tu contraseña en SkillMatch y en otros sitios donde uses la misma; desconfiar de
correos que pidan tus datos a nombre de SkillMatch.

Si tienes preguntas, escríbenos a [correo de contacto].
[Nombre del responsable de datos] — SkillMatch
```

Enviarlo por correo (Brevo) a las cuentas afectadas. Si son muchas, mostrar además un aviso en el sitio.

---

## 6. Calendario

| Cada | Qué | Sección |
|---|---|---|
| Semana | Copia cifrada de la base | 3.3 |
| Semana | Mirar los logs de Render buscando `Error interno [` y `Límite de intentos` | 2.4 |
| Mes | Probar la restauración de la última copia en local | 3.4 |
| 6 meses | Rotar secretos y revisar quién tiene acceso | 4, 1 |
| Año | Revisar con el abogado la política de datos y este documento | 5 |
