#!/usr/bin/env bash
# Arranque local del backend SkillMatch (Linux / macOS)
# Uso:  ./start.sh
set -e

export MONGODB_URI="${MONGODB_URI:-mongodb://localhost:27017/skillmatch}"
export JWT_SECRET="${JWT_SECRET:-skillmatch-clave-local-de-desarrollo-no-usar-en-produccion-2026}"
export SEED_ENABLED="${SEED_ENABLED:-false}"

echo "Iniciando backend SkillMatch en http://localhost:8080 ..."
echo "Salud: http://localhost:8080/api/health"
./mvnw spring-boot:run
