#!/usr/bin/env bash
# Restaura una copia hecha con copia-mongo.sh (ver docs/OPERACION.md, sección 3).
#
# Prueba mensual (lo normal): restaura en tu MongoDB LOCAL, en una base aparte, y cuenta documentos.
#   export COPIA_CLAVE='frase larga secreta'
#   bash scripts/restaurar-mongo.sh ~/copias-skillmatch/skillmatch-AAAA-MM-DD-HHMM.archive.gpg
#
# Opcional:
#   BASE_ORIGEN   nombre de la base dentro de la copia (por defecto: se detecta)
#   BASE_DESTINO  nombre de la base donde se restaura (por defecto skillmatch-restaurada)
#   DESTINO_URI   servidor donde se restaura (por defecto mongodb://localhost:27017)
#
# Desastre real (restaurar sobre Atlas): DESTINO_URI con la de Atlas y BASE_DESTINO con el nombre
# real. El script pide escribir RESTAURAR, porque reemplaza las colecciones que estén en la copia.
set -euo pipefail

ARCHIVO="${1:?Uso: restaurar-mongo.sh <archivo .archive.gpg>}"
[ -f "$ARCHIVO" ] || { echo "ERROR: no existe $ARCHIVO" >&2; exit 1; }
DESTINO_URI="${DESTINO_URI:-mongodb://localhost:27017}"
BASE_DESTINO="${BASE_DESTINO:-skillmatch-restaurada}"

buscar() {
  if command -v "$1" >/dev/null 2>&1; then command -v "$1"; return; fi
  for d in "/c/Program Files/MongoDB/Tools/"*/bin; do
    [ -x "$d/$1.exe" ] && { echo "$d/$1.exe"; return; }
  done
  echo "ERROR: no encuentro $1. Instala las MongoDB Database Tools (gratis)." >&2; exit 1
}
MONGORESTORE="$(buscar mongorestore)"

TMP="$(mktemp -d)"
chmod 700 "$TMP"
trap 'rm -rf "$TMP"' EXIT
printf 'uri: "%s"\n' "$DESTINO_URI" > "$TMP/config.yaml"
chmod 600 "$TMP/config.yaml"

descifrar() {
  if [ -n "${COPIA_CLAVE:-}" ]; then
    gpg --batch --quiet --pinentry-mode loopback --passphrase-fd 3 --decrypt "$ARCHIVO" 3<<<"$COPIA_CLAVE"
  else
    gpg --quiet --decrypt "$ARCHIVO"
  fi
}

# Antes de tocar ninguna base: descifrarla completa. gpg revisa al final que no esté dañada;
# si se restaurara de una vez, el daño se notaría cuando ya hay datos a medias.
if ! descifrar > /dev/null 2>"$TMP/err"; then
  grep -v "^$" "$TMP/err" | tail -n 5 >&2
  echo "ERROR: la copia está dañada o la clave no es la correcta. No se restauró nada." >&2
  exit 1
fi

# Qué base trae la copia (el simulacro lista "base.colección")
if [ -z "${BASE_ORIGEN:-}" ]; then
  BASE_ORIGEN="$( { descifrar | "$MONGORESTORE" --archive --gzip --dryRun -v 2>&1 \
    | sed -n 's/.*archive prelude `\([^.`]*\)\..*/\1/p' | grep -v '^admin$' | sort -u | head -1; } || true)"
  [ -n "$BASE_ORIGEN" ] || { echo "ERROR: no pude leer la copia (¿clave equivocada?)." >&2; exit 1; }
fi

case "$DESTINO_URI" in
  mongodb://localhost*|mongodb://127.0.0.1*) ;;
  *)
    echo "ATENCIÓN: vas a restaurar en un servidor que NO es local."
    echo "Las colecciones de la copia REEMPLAZARÁN a las de '$BASE_DESTINO'."
    read -r -p "Escribe RESTAURAR para seguir: " ok
    [ "$ok" = "RESTAURAR" ] || { echo "Cancelado."; exit 1; }
    ;;
esac

echo "Restaurando '$BASE_ORIGEN' de la copia en '$BASE_DESTINO'..."
# --drop: reemplaza cada colección que viene en la copia (no toca las demás)
descifrar | "$MONGORESTORE" --config="$TMP/config.yaml" --archive --gzip --drop --quiet \
  --nsInclude="$BASE_ORIGEN.*" --nsFrom="$BASE_ORIGEN.*" --nsTo="$BASE_DESTINO.*"

# Solo en local: con Atlas, la URI (y su contraseña) quedaría en la línea de comandos
case "$DESTINO_URI" in
  mongodb://localhost*|mongodb://127.0.0.1*)
    if command -v mongosh >/dev/null 2>&1; then
      echo "Documentos por colección en '$BASE_DESTINO':"
      mongosh "${DESTINO_URI%/}/$BASE_DESTINO" --quiet --eval \
        'db.getCollectionNames().sort().forEach(c => print("  " + c + ": " + db.getCollection(c).countDocuments()))'
    fi
    ;;
esac
echo "Listo."
