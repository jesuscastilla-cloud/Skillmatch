# Arranque local del backend SkillMatch (Windows / PowerShell)
# Uso:  .\start.ps1

# Mongo local. Para usar Atlas, reemplaza por tu cadena mongodb+srv://...
$env:MONGODB_URI = "mongodb://localhost:27017/skillmatch"

# Clave de firma de los JWT (minimo 32 caracteres)
$env:JWT_SECRET  = "skillmatch-clave-local-de-desarrollo-no-usar-en-produccion-2026"

# Pon "true" solo la primera vez, para llenar la base con datos de prueba
$env:SEED_ENABLED = "false"

Write-Host "Iniciando backend SkillMatch en http://localhost:8080 ..." -ForegroundColor Cyan
Write-Host "Salud: http://localhost:8080/api/health" -ForegroundColor DarkGray
.\mvnw.cmd spring-boot:run
