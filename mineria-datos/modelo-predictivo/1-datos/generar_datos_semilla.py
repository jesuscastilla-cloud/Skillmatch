"""
SkillMatch - modelo predictivo
Paso 1 (sin acceso a la base): los datos por defecto de la plataforma.

Reproduce, paso por paso, lo que hace backend/src/main/java/com/skillmatch/
backend/config/DataSeeder.java (los datos que SkillMatch crea por defecto
cuando la base esta vacia y SEED_ENABLED=true):

  - 150 personas, cada una con 2 a 5 habilidades de una lista de 40 y un nivel
    al azar (BASICO, INTERMEDIO, AVANZADO o EXPERTO), en una de 10 ciudades;
  - 40 empresas en esas ciudades;
  - 120 vacantes de empleo, practica o freelance, con 3 a 7 habilidades,
    publicadas en los ultimos 90 dias;
  - 300 postulaciones con la misma carta y un estado AL AZAR entre
    PENDIENTE, REVISADA, ACEPTADA y RECHAZADA.

Sirve para probar todo el camino (tabla -> modelo -> pagina) sin la
MONGODB_URI. Ojo con lo ultimo: como el DataSeeder escoge el estado al azar,
no hay ningun patron que aprender. El resultado honesto es que el arbol NO le
gana al "modelo flojo", y la pagina lo dice con esas palabras (como pide el PDF).

Uso:
    python generar_datos_semilla.py            -> datos/ejemplos_semilla.csv
    python generar_datos_semilla.py --semilla 7
"""

import argparse
import csv
import random
from collections import Counter
from datetime import datetime, timedelta
from pathlib import Path

from caracteristicas import postulantes_previos, COLUMNAS, fila

AQUI = Path(__file__).resolve().parent

# Las mismas listas de DataSeeder.java
SKILLS = ["Java", "Spring Boot", "JavaScript", "React", "Angular", "Vue.js", "Node.js", "Python",
          "Django", "Flask", "PHP", "Laravel", "C#", ".NET", "Ruby", "Rails", "Go", "Kotlin",
          "Swift", "Flutter", "React Native", "Docker", "Kubernetes", "AWS", "Azure", "GCP",
          "MySQL", "PostgreSQL", "MongoDB", "Redis", "Git", "CI/CD", "Agile", "Scrum",
          "REST API", "GraphQL", "Microservices", "TDD", "Design Patterns", "SQL"]
NIVELES = ["BÁSICO", "INTERMEDIO", "AVANZADO", "EXPERTO"]
CIUDADES = ["Cartagena", "Bogotá", "Medellín", "Cali", "Barranquilla", "Bucaramanga",
            "Pereira", "Manizales", "Santa Marta", "Ibagué"]
TITULOS = ["Desarrollador Full Stack", "Desarrollador Frontend", "Desarrollador Backend",
           "Ingeniero DevOps", "Analista de Datos", "Diseñador UX/UI", "QA Engineer"]
ESTADOS = ["PENDIENTE", "REVISADA", "ACEPTADA", "RECHAZADA"]


def generar(r, n_usuarios=150, n_empresas=40, n_vacantes=120, n_postulaciones=300):
    ahora = datetime.now()

    usuarios = []
    for i in range(n_usuarios):
        habilidades = r.sample(SKILLS, r.randint(2, 5))  # nextInt(4) + 2, sin repetir
        usuarios.append({
            "id": f"u{i}", "firstName": "x", "lastName": "x", "email": f"usuario{i}@skillmatch.com",
            "phone": "+573000000000", "location": r.choice(CIUDADES),
            "skills": [{"name": h, "level": r.choice(NIVELES)} for h in habilidades],
            "experiences": [], "educations": [],  # el DataSeeder no les pone ni experiencia ni estudios
        })

    empresas = [{"id": f"c{i}", "name": "Empresa", "location": r.choice(CIUDADES)} for i in range(n_empresas)]

    vacantes = []
    for i in range(n_vacantes):
        e = r.choice(empresas)
        vacantes.append({
            "id": f"j{i}", "companyId": e["id"], "title": r.choice(TITULOS),
            "type": r.choice(["empleo", "práctica", "freelance"]),
            "experienceLevel": r.choice(["sin-experiencia", "junior", "semi-senior", "senior"]),
            "location": e["location"], "modality": r.choice(["presencial", "remoto", "híbrido"]),
            "postedDate": ahora - timedelta(days=r.randrange(90)),
            "skills": [r.choice(SKILLS) for _ in range(r.randint(3, 7))],  # con repetidas, como el seed
        })

    vistas, postulaciones = set(), []
    while len(postulaciones) < min(n_postulaciones, n_usuarios * n_vacantes):
        u, v = r.choice(usuarios), r.choice(vacantes)
        if (u["id"], v["id"]) in vistas:
            continue
        vistas.add((u["id"], v["id"]))
        postulaciones.append({
            "userId": u["id"], "jobId": v["id"], "status": r.choice(ESTADOS),
            "appliedDate": ahora - timedelta(days=r.randrange(60)),
            "coverLetter": f"Me interesa mucho la posición de {v['title']} y creo que mi experiencia "
                           "se alinea perfectamente con los requisitos.",
        })
    return usuarios, empresas, vacantes, postulaciones


def main():
    p = argparse.ArgumentParser(description="Tabla de ejemplos con los datos por defecto (DataSeeder)")
    p.add_argument("--salida", default=str(AQUI / "datos" / "ejemplos_semilla.csv"))
    p.add_argument("--semilla", type=int, default=42, help="para que salga siempre lo mismo")
    args = p.parse_args()

    usuarios, empresas, vacantes, postulaciones = generar(random.Random(args.semilla))
    por_id_u = {u["id"]: u for u in usuarios}
    por_id_v = {v["id"]: v for v in vacantes}
    nombre_empresa = {e["id"]: e["name"] for e in empresas}
    previos = postulantes_previos(postulaciones, lambda a: a["jobId"])

    filas = []
    for a, antes in zip(postulaciones, previos):
        v = por_id_v[a["jobId"]]
        f = fila(a, por_id_u[a["userId"]], v, nombre_empresa[v["companyId"]], antes, int(v["id"][1:]))
        if f:
            filas.append(f)

    salida = Path(args.salida)
    salida.parent.mkdir(parents=True, exist_ok=True)
    with salida.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=COLUMNAS)
        w.writeheader()
        w.writerows(filas)

    # Las habilidades de cada vacante (para "habilidades que suelen ir juntas")
    with salida.with_name("vacantes_habilidades.csv").open("w", encoding="utf-8") as fh:
        fh.write("habilidades\n")
        for v in vacantes:
            fh.write(";".join(h.replace(";", ",") for h in v["skills"]) + "\n")

    aceptadas = sum(f["aceptada"] for f in filas)
    print(f"Postulaciones creadas: {len(postulaciones)} ({dict(Counter(a['status'] for a in postulaciones))})")
    print(f"Ejemplos (respondidas): {len(filas)} -> {aceptadas} aceptadas, {len(filas) - aceptadas} rechazadas")
    print(f"Guardado en {salida}")


if __name__ == "__main__":
    main()
