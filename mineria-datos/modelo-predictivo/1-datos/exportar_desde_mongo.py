"""
SkillMatch - modelo predictivo
Paso 1 (con los datos reales de la plataforma): exportar la tabla de ejemplos.

Lee la base MongoDB de SkillMatch (la de Render) SOLO PARA LEER, junta cada
postulacion respondida (aceptada o rechazada) con lo que se mira de ella
(caracteristicas.py) y guarda un CSV anonimo: sin nombres, correos,
telefonos, fotos ni empresas.

Uso (PowerShell en Windows):
    pip install -r ..\\2-modelo\\requirements.txt
    $env:MONGODB_URI = "mongodb+srv://..."     # la de Render; NO se escribe en ningun archivo
    python exportar_desde_mongo.py

Uso (Git Bash / Linux / Mac):
    export MONGODB_URI='mongodb+srv://...'
    python exportar_desde_mongo.py

Opciones:
    --salida datos/ejemplos.csv   donde guardar la tabla (por defecto esa)
    --base skillmatch             nombre de la base si la URI no lo trae

Importante: la URI lleva la contrasena de la base. No la pegues en el codigo,
ni en un chat, ni la subas a GitHub.
"""

import argparse
import csv
import os
import sys
from collections import Counter
from pathlib import Path

from caracteristicas import postulantes_previos, COLUMNAS, fila

AQUI = Path(__file__).resolve().parent


def main():
    p = argparse.ArgumentParser(description="Exporta la tabla de ejemplos desde MongoDB")
    p.add_argument("--salida", default=str(AQUI / "datos" / "ejemplos.csv"))
    p.add_argument("--base", default=None)
    args = p.parse_args()

    uri = os.environ.get("MONGODB_URI")
    if not uri:
        sys.exit("Falta la variable de entorno MONGODB_URI (la conexion a la base de Render).")

    try:
        from pymongo import MongoClient
    except ImportError:
        sys.exit("Falta pymongo: pip install pymongo")

    cliente = MongoClient(uri, serverSelectionTimeoutMS=15000)
    db = cliente[args.base] if args.base else cliente.get_default_database()
    print(f"Conectado a la base '{db.name}' (solo lectura)")

    # Solo los campos que hacen falta: nada de fotos, contrasenas ni consentimientos
    campos_usuario = {"firstName": 1, "lastName": 1, "email": 1, "phone": 1, "location": 1,
                      "skills": 1, "experiences": 1, "educations": 1}
    usuarios = {str(u["_id"]): u for u in db.users.find({}, campos_usuario)}
    vacantes = {str(v["_id"]): v for v in db.jobs.find({}, {
        "companyId": 1, "skills": 1, "experienceLevel": 1, "location": 1, "modality": 1,
        "type": 1, "postedDate": 1, "createdAt": 1})}
    empresas = {str(e["_id"]): e.get("name", "") for e in db.companies.find({}, {"name": 1})}
    postulaciones = list(db.applications.find({}, {
        "userId": 1, "jobId": 1, "status": 1, "coverLetter": 1, "appliedDate": 1, "createdAt": 1}))
    cliente.close()

    previos = postulantes_previos(postulaciones, lambda a: str(a.get("jobId")))
    # Cada vacante pasa a ser un numero (para armar el examen por vacante), sin su id real
    numero = {}
    estados = Counter(str(a.get("status", "PENDIENTE")).upper() for a in postulaciones)

    filas, sin_datos = [], 0
    for a, antes in zip(postulaciones, previos):
        u = usuarios.get(str(a.get("userId")))
        v = vacantes.get(str(a.get("jobId")))
        if not u or not v:
            sin_datos += 1  # la persona o la vacante ya no existen
            continue
        n_vacante = numero.setdefault(str(a.get("jobId")), len(numero))
        f = fila(a, u, v, empresas.get(str(v.get("companyId")), ""), antes, n_vacante)
        if f:
            filas.append(f)

    salida = Path(args.salida)
    salida.parent.mkdir(parents=True, exist_ok=True)
    with salida.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=COLUMNAS)
        w.writeheader()
        w.writerows(filas)

    # Las habilidades de cada vacante (para "habilidades que suelen ir juntas"); sin nombres
    with salida.with_name("vacantes_habilidades.csv").open("w", encoding="utf-8") as fh:
        fh.write("habilidades\n")
        for v in vacantes.values():
            fh.write(";".join(str(h).replace(";", ",") for h in (v.get("skills") or [])) + "\n")

    aceptadas = sum(f["aceptada"] for f in filas)
    print(f"Postulaciones en la base: {len(postulaciones)}  ({dict(estados)})")
    print(f"Sin persona o vacante: {sin_datos}")
    print(f"Ejemplos (respondidas): {len(filas)}  -> {aceptadas} aceptadas, {len(filas) - aceptadas} rechazadas")
    print(f"De vacantes o personas de ejemplo: {sum(f['es_ejemplo'] for f in filas)}")
    print(f"Guardado en {salida}")


if __name__ == "__main__":
    main()
