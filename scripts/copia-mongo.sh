#!/usr/bin/env bash
# Copia de seguridad CIFRADA de la base de SkillMatch (ver docs/OPERACION.md, sección 3).
#
# Uso (Git Bash en Windows, o cualquier bash):
#   export MONGODB_URI='mongodb+srv://...'      # la de Render (Atlas); no se guarda en ningún lado
#   export COPIA_CLAVE='frase larga secreta'     # la del gestor de contraseñas; sin ella, gpg la pide
#   bash scripts/copia-mongo.sh
#
# Opcional: COPIAS_DIR (por defecto ~/copias-skillmatch), COPIAS_GUARDAR (por defecto 4).
#
# Por qué solo 4: la política promete que una cuenta borrada sale de las copias a los 30 días.
# Con una copia por semana, la más vieja tiene unos 28 días.
set -euo pipefail

: "${MONGODB_URI:?Falta MONGODB_URI (la conexión a la base que se va a copiar)}"
COPIAS_DIR="${COPIAS_DIR:-$HOME/copias-skillmatch}"
COPIAS_GUARDAR="${COPIAS_GUARDAR:-4}"
REPO="$(cd "$(dirname "$0")/.." && pwd)"

# Las copias tienen datos personales: nunca dentro del repositorio (terminarían en GitHub)
# (se revisa ANTES de crear la carpeta, para no dejar una vacía dentro del repo)
COPIAS_DIR="$(realpath -m "$COPIAS_DIR")"
case "$COPIAS_DIR/" in
  "$REPO"/*) echo "ERROR: COPIAS_DIR está dentro del repositorio ($REPO). Usa una carpeta fuera." >&2; exit 1 ;;
esac
mkdir -p "$COPIAS_DIR"

# mongodump y mongorestore: del PATH o de la instalación normal en Windows
buscar() {
  if command -v "$1" >/dev/null 2>&1; then command -v "$1"; return; fi
  for d in "/c/Program Files/MongoDB/Tools/"*/bin; do
    [ -x "$d/$1.exe" ] && { echo "$d/$1.exe"; return; }
  done
  echo "ERROR: no encuentro $1. Instala las MongoDB Database Tools (gratis)." >&2; exit 1
}
MONGODUMP="$(buscar mongodump)"
MONGORESTORE="$(buscar mongorestore)"
command -v gpg >/dev/null || { echo "ERROR: falta gpg (viene con Git para Windows)." >&2; exit 1; }

# La URI lleva la contraseña de MongoDB: va en un archivo temporal privado, no en la línea de
# comandos (ahí la vería cualquier programa que liste los procesos). Se borra al salir.
TMP="$(mktemp -d)"
chmod 700 "$TMP"
trap 'rm -rf "$TMP"' EXIT
printf 'uri: "%s"\n' "$MONGODB_URI" > "$TMP/config.yaml"
chmod 600 "$TMP/config.yaml"

# gpg: la clave por un descriptor de archivo (tampoco en la línea de comandos)
cifrar()    { if [ -n "${COPIA_CLAVE:-}" ]; then gpg --batch --yes --pinentry-mode loopback --passphrase-fd 3 "$@" 3<<<"$COPIA_CLAVE"; else gpg "$@"; fi; }

ARCHIVO="$COPIAS_DIR/skillmatch-$(date +%Y-%m-%d-%H%M).archive.gpg"
echo "Copiando la base..."
"$MONGODUMP" --config="$TMP/config.yaml" --archive --gzip --quiet \
  | cifrar --symmetric --cipher-algo AES256 --output "$ARCHIVO"

# Una copia que no se puede leer no es una copia. Dos comprobaciones:
echo "Comprobando la copia..."
fallo() {
  echo "--- $1:" >&2
  grep -v "^$" "$TMP/err" | tail -n 15 >&2
  echo "ERROR: la copia no se pudo comprobar. Se borra para no confiar en ella." >&2
  rm -f "$ARCHIVO"
  exit 1
}
# 1. Descifrarla COMPLETA: gpg revisa al final que ningún byte se haya dañado
cifrar --decrypt --quiet "$ARCHIVO" 2>"$TMP/err" >/dev/null || fallo "Lo que dijo gpg"
# 2. Simulacro de restauración: revisa la estructura. Solo lee el comienzo y se cierra,
#    así que el "Broken pipe" de gpg en ese momento no cuenta (ya se comprobó en el paso 1)
{ cifrar --decrypt --quiet "$ARCHIVO" 2>/dev/null || true; }   | "$MONGORESTORE" --archive --gzip --dryRun 2>"$TMP/err" >/dev/null || fallo "Lo que dijo mongorestore"
echo "Copia lista: $ARCHIVO ($(du -h "$ARCHIVO" | cut -f1))"

# Rotación: solo las COPIAS_GUARDAR más recientes
ls -1t "$COPIAS_DIR"/skillmatch-*.archive.gpg | tail -n +"$((COPIAS_GUARDAR + 1))" | while read -r vieja; do
  echo "Borrando copia vieja: $vieja"
  rm -f "$vieja"
done
