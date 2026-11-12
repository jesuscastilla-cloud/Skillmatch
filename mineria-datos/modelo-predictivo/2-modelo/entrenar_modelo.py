"""
SkillMatch - modelo predictivo
Pasos 2 y 3: aprender de la tabla de ejemplos, examinarse y guardar el resultado.

Sigue el PDF "SkillMatch: propuesta del modelo predictivo":
  - Clasificacion supervisada: aceptada (1) o rechazada (0).
  - Modelo principal: arbol de decision CART, maximo 4 niveles y 5 casos por hoja.
  - Para comparar: regresion logistica y el "modelo flojo" (siempre la clase mas comun).
  - Examen: validacion cruzada de 5 pliegues POR VACANTE (todas las postulaciones de una
    vacante quedan en el mismo grupo), con la misma proporcion de aceptadas en cada grupo.
  - Notas: exactitud, precision, sensibilidad (recall), F1 y ROC-AUC. Con F1 se elige
    entre el arbol y la logistica.
  - Datos minimos: 30 respondidas, con al menos 8 aceptadas y 8 rechazadas.
  - Importancia de variables: que dato peso mas en las preguntas del arbol.

Salidas:
  - modelo-predictivo.json  -> lo lee la pagina "Como aprende SkillMatch" y el recuadro
                               de las postulaciones (frontend).
  - resultados/             -> metricas.csv, predicciones.csv y figuras para el informe.

Uso:
    python entrenar_modelo.py --datos ../1-datos/datos/ejemplos_semilla.csv
    python entrenar_modelo.py --datos ../1-datos/datos/ejemplos.csv
    python entrenar_modelo.py --datos ... --sin-ejemplos     (deja fuera las "(ejemplo)")
"""

import argparse
import json
import math
import sys
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.dummy import DummyClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (accuracy_score, confusion_matrix, f1_score, precision_score,
                             recall_score, roc_auc_score)
from sklearn.model_selection import cross_val_predict
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.tree import DecisionTreeClassifier, export_text

AQUI = Path(__file__).resolve().parent
# La pagina "Como aprende SkillMatch" lo usa si el servidor no responde
SALIDA_JSON = AQUI.parents[2] / "SkillMatch" / "src" / "assets" / "data" / "modelo-predictivo.json"

SEMILLA = 42
MIN_TOTAL, MIN_POR_CLASE = 30, 8
PROFUNDIDAD, CASOS_POR_HOJA, PLIEGUES = 4, 5, 5
# Posibilidades que ve la persona: nunca un porcentaje (ver "Cuidados" en el PDF)
UMBRAL_BUENAS, UMBRAL_REGULARES = 0.60, 0.40

# Lo que mira el modelo, con su nombre en sencillo y el icono de ui.js.
# tipo: "entero" (cortes como 50 %), "decimal" o "si_no".
VARIABLES = [
    ("pct_habilidades", "Habilidades que tiene de las pedidas", "target", "entero",
     "Cuántas de las habilidades que pide la vacante tiene la persona, en porcentaje."),
    ("nivel_dominio", "Qué tan bien las domina", "star", "decimal",
     "Promedio del nivel de esas habilidades: 1 básico, 2 intermedio, 3 avanzado, 4 experto."),
    ("anos_experiencia", "Años de experiencia", "briefcase", "decimal",
     "La suma de las experiencias que registró en su perfil."),
    ("alcanza_experiencia", "Su experiencia alcanza lo que pide", "check", "si_no",
     "Si los años que tiene alcanzan el nivel que pide la vacante."),
    ("num_estudios", "Estudios registrados", "cap", "entero",
     "Cuántos estudios agregó a su perfil."),
    ("perfil_completo", "Qué tan completo está su perfil", "user", "entero",
     "Los mismos 5 puntos del anillo de progreso del perfil, en porcentaje."),
    ("tiene_carta", "Escribió carta", "mail", "si_no",
     "Si la postulación lleva carta de presentación."),
    ("palabras_carta", "Largo de la carta", "pencil", "entero",
     "Cuántas palabras tiene la carta."),
    ("misma_ciudad", "Vive en la ciudad de la vacante", "pin", "si_no",
     "Si vive en la misma ciudad de la vacante, o si la vacante es remota."),
    ("tipo_empleo", "Vacante de empleo", "building", "si_no", "Tipo de vacante: empleo."),
    ("tipo_practica", "Vacante de práctica", "book", "si_no", "Tipo de vacante: práctica."),
    ("tipo_freelance", "Vacante independiente", "rocket", "si_no", "Tipo de vacante: independiente (freelance)."),
    ("dias_para_postularse", "Qué tan rápido se postuló", "clock", "entero",
     "Días entre la publicación de la vacante y la postulación."),
    ("postulantes_previos", "Cuántos se postularon antes", "users", "entero",
     "Cuántas personas ya se habían postulado a esa vacante cuando esta persona lo hizo."),
]
COLS = [v[0] for v in VARIABLES]
INFO = {v[0]: v for v in VARIABLES}
# Datos que la persona puede mejorar: de aqui salen los consejos
ACCIONABLES = {"pct_habilidades", "nivel_dominio", "anos_experiencia", "alcanza_experiencia",
               "num_estudios", "perfil_completo", "tiene_carta", "palabras_carta"}


# ---------- El examen por vacante ----------

def pliegues_por_vacante(y, vacante, k=PLIEGUES):
    """
    Reparte las postulaciones en k grupos para el examen, con dos reglas:
      1. Todas las postulaciones de una misma vacante van al MISMO grupo. Si una vacante
         quedara en el estudio y en el examen, el modelo se examinaria con algo que ya vio.
      2. Cada grupo conserva, lo mas posible, la proporcion de aceptadas y rechazadas.
    Es la idea de StratifiedGroupKFold de scikit-learn, escrita sin azar para que el servidor
    (Pliegues.porVacante en Java) reparta EXACTAMENTE igual: las vacantes con mas postulaciones
    van primero y cada una entra al grupo donde las proporciones quedan mas parejas.
    """
    y = [int(v) for v in y]
    vacante = [int(v) for v in vacante]
    total = [y.count(0), y.count(1)]
    grupos = {}
    for i, v in enumerate(vacante):
        grupos.setdefault(v, []).append(i)
    orden = sorted(grupos, key=lambda v: (-len(grupos[v]), v))
    cuenta = [[0, 0] for _ in range(k)]
    tamano = [0] * k
    pliegue = [0] * len(y)
    for v in orden:
        filas = grupos[v]
        suma = [sum(1 for i in filas if y[i] == c) for c in (0, 1)]
        mejor = None
        for g in range(k):
            costo = 0.0
            for c in (0, 1):
                if total[c] == 0:
                    continue
                partes = [(cuenta[h][c] + (suma[c] if h == g else 0)) / total[c] for h in range(k)]
                media = sum(partes) / k
                costo += math.sqrt(sum((x - media) ** 2 for x in partes) / k)
            clave = (round(costo * 1e9), tamano[g], g)
            if mejor is None or clave < mejor[0]:
                mejor = (clave, g)
        g = mejor[1]
        for i in filas:
            pliegue[i] = g
        cuenta[g][0] += suma[0]
        cuenta[g][1] += suma[1]
        tamano[g] += len(filas)
    return np.array(pliegue)


# ---------- Textos de cada pregunta del arbol ----------

def textos_del_corte(var, umbral):
    """El arbol de scikit-learn pregunta "x <= umbral" (va a la izquierda).
    Aqui se escribe al reves, en positivo: la pregunta es "x > umbral" y la
    respuesta "si" va a la DERECHA. Devuelve (pregunta, frase_si, frase_no)."""
    c = math.floor(umbral) + 1           # para enteros: x > umbral  <=>  x >= c
    d = f"{umbral:.1f}".replace(".", ",")
    plural = lambda n, uno, varios: uno if n == 1 else varios
    t = {
        "pct_habilidades": (f"¿Tiene al menos el {c} % de las habilidades que pide?",
                            f"tienen al menos el {c} % de las habilidades pedidas",
                            f"tienen menos del {c} % de las habilidades pedidas"),
        "nivel_dominio": (f"¿Su nivel en esas habilidades pasa de {d} (de 4)?",
                          f"dominan esas habilidades por encima de {d} (de 4)",
                          f"las dominan en {d} o menos (de 4)"),
        "anos_experiencia": (f"¿Tiene más de {d} años de experiencia?",
                             f"tienen más de {d} años de experiencia",
                             f"tienen {d} años de experiencia o menos"),
        "alcanza_experiencia": ("¿Su experiencia alcanza lo que pide la vacante?",
                                "tienen la experiencia que pide la vacante",
                                "no alcanzan la experiencia que pide la vacante"),
        "num_estudios": (f"¿Registró al menos {c} {plural(c, 'estudio', 'estudios')}?",
                         f"registran al menos {c} {plural(c, 'estudio', 'estudios')}",
                         f"registran menos de {c} {plural(c, 'estudio', 'estudios')}"),
        "perfil_completo": (f"¿Tiene el perfil completo al {c} % o más?",
                            f"tienen el perfil completo al {c} % o más",
                            f"tienen el perfil completo a menos del {c} %"),
        "tiene_carta": ("¿Escribió carta?", "llevan carta", "no llevan carta"),
        "palabras_carta": (f"¿La carta tiene {c} palabras o más?",
                           f"llevan una carta de {c} palabras o más",
                           f"llevan una carta de menos de {c} palabras (o ninguna)"),
        "misma_ciudad": ("¿Vive en la ciudad de la vacante (o es remota)?",
                         "son de personas que viven en la ciudad de la vacante (o es remota)",
                         "son de personas que viven en otra ciudad"),
        "tipo_empleo": ("¿Es una vacante de empleo?", "son a vacantes de empleo", "son a vacantes que no son de empleo"),
        "tipo_practica": ("¿Es una vacante de práctica?", "son a vacantes de práctica", "son a vacantes que no son de práctica"),
        "tipo_freelance": ("¿Es una vacante independiente?", "son a vacantes independientes", "son a vacantes que no son independientes"),
        "dias_para_postularse": (f"¿Se postuló {c} días o más después de publicada?",
                                 f"llegan {c} días o más después de publicada la vacante",
                                 f"llegan en los primeros {c} días de publicada la vacante"),
        "postulantes_previos": (f"¿Ya había {c} postulantes o más cuando se postuló?",
                                f"llegan cuando ya había {c} postulantes o más",
                                f"llegan cuando había menos de {c} postulantes"),
    }
    return t[var]


def posibilidad(p):
    return "buenas" if p >= UMBRAL_BUENAS else ("regulares" if p >= UMBRAL_REGULARES else "bajas")


def arbol_a_json(modelo):
    """Convierte el arbol de scikit-learn en nodos que el navegador puede recorrer."""
    t = modelo.tree_
    nodos = []
    for i in range(t.node_count):
        n = int(t.n_node_samples[i])
        fr = t.value[i][0] / t.value[i][0].sum()   # fracciones de [rechazada, aceptada]
        prob = float(fr[1])
        nodo = {"id": i, "n": n, "aceptadas": int(round(prob * n)), "prob": round(prob, 4),
                "posibilidad": posibilidad(prob)}
        if t.children_left[i] == -1:
            nodo["hoja"] = True
        else:
            var = COLS[t.feature[i]]
            pregunta, frase_si, frase_no = textos_del_corte(var, float(t.threshold[i]))
            nodo.update({"variable": var, "umbral": round(float(t.threshold[i]), 4),
                         "pregunta": pregunta, "frase_si": frase_si, "frase_no": frase_no,
                         "si": int(t.children_right[i]), "no": int(t.children_left[i])})
        nodos.append(nodo)
    return nodos


def notas(y, pred, prob):
    return {
        "exactitud": round(accuracy_score(y, pred), 4),
        "precision": round(precision_score(y, pred, zero_division=0), 4),
        "sensibilidad": round(recall_score(y, pred, zero_division=0), 4),
        "f1": round(f1_score(y, pred, zero_division=0), 4),
        "roc_auc": round(roc_auc_score(y, prob), 4) if len(set(y)) == 2 else None,
    }


def main():
    p = argparse.ArgumentParser(description="Entrena y examina el modelo predictivo de SkillMatch")
    p.add_argument("--datos", required=True, help="CSV de la tabla de ejemplos (paso 1)")
    p.add_argument("--fuente", default=None, help="'semilla' o 'plataforma' (se adivina por el nombre)")
    p.add_argument("--sin-ejemplos", action="store_true", help="deja fuera las vacantes/personas '(ejemplo)'")
    p.add_argument("--salida", default=str(SALIDA_JSON))
    args = p.parse_args()

    df = pd.read_csv(args.datos)
    fuente = args.fuente or ("semilla" if "semilla" in Path(args.datos).name else "plataforma")
    de_ejemplo = int(df["es_ejemplo"].sum())
    if args.sin_ejemplos:
        df = df[df["es_ejemplo"] == 0]
    demostracion = fuente == "semilla" or (not args.sin_ejemplos and de_ejemplo > 0)

    X, y = df[COLS].astype(float), df["aceptada"].astype(int)
    total, acept = len(df), int(y.sum())
    rech = total - acept
    faltan = max(0, MIN_TOTAL - total, MIN_POR_CLASE - acept, MIN_POR_CLASE - rech)

    salida = Path(args.salida)
    anterior = json.loads(salida.read_text(encoding="utf-8")) if salida.exists() else {}
    hoy = datetime.now().strftime("%Y-%m-%d")

    resultado = {
        "version": 1,
        "fecha": datetime.now().isoformat(timespec="minutes"),
        "fuente": fuente,
        "motor": "python",
        "demostracion": demostracion,
        "datos": {"respondidas": total, "aceptadas": acept, "rechazadas": rech,
                  "de_ejemplo": de_ejemplo if not args.sin_ejemplos else 0,
                  "minimo": {"total": MIN_TOTAL, "por_clase": MIN_POR_CLASE}, "faltan": faltan},
        "variables": [{"id": v[0], "nombre": v[1], "icono": v[2], "tipo": v[3], "explicacion": v[4]}
                      for v in VARIABLES],
        "parametros": {"algoritmo": "CART (scikit-learn DecisionTreeClassifier, gini)",
                       "profundidad_maxima": PROFUNDIDAD, "casos_por_hoja": CASOS_POR_HOJA,
                       "pliegues": PLIEGUES, "examen": "por vacante", "semilla": SEMILLA},
        "niveles": {"buenas": UMBRAL_BUENAS, "regulares": UMBRAL_REGULARES},
        "habilidades_juntas": habilidades_juntas(Path(args.datos).with_name("vacantes_habilidades.csv")),
    }

    if faltan > 0:
        # Antes del minimo no hay modelo ni consejos: la pagina muestra cuantas faltan
        resultado.update({"estado": "esperando", "dar_consejos": False,
                          "historial": anterior.get("historial", [])})
        guardar(salida, resultado)
        print(f"Esperando datos: hay {total} respondidas ({acept} aceptadas, {rech} rechazadas). Faltan {faltan}.")
        return

    # ---------- El examen: 5 pliegues ----------
    pliegue = pliegues_por_vacante(y, df["vacante"])
    cv = [(np.where(pliegue != g)[0], np.where(pliegue == g)[0]) for g in range(PLIEGUES) if (pliegue == g).any()]
    modelos = {
        "arbol": DecisionTreeClassifier(max_depth=PROFUNDIDAD, min_samples_leaf=CASOS_POR_HOJA,
                                        random_state=SEMILLA),
        "logistica": make_pipeline(StandardScaler(), LogisticRegression(max_iter=2000)),
        "flojo": DummyClassifier(strategy="most_frequent"),
    }
    examen, predicciones = {}, {}
    for nombre, m in modelos.items():
        prob = cross_val_predict(m, X, y, cv=cv, method="predict_proba")[:, 1]
        pred = (prob >= 0.5).astype(int)
        if nombre == "flojo":
            pred = np.full(len(y), int(y.mode()[0]))
        examen[nombre] = notas(y, pred, prob)
        predicciones[nombre] = pred

    vn, fp, fn, vp = confusion_matrix(y, predicciones["arbol"], labels=[0, 1]).ravel()
    ganador = "logistica" if examen["logistica"]["f1"] > examen["arbol"]["f1"] else "arbol"
    # "Si el arbol no le gana al modelo flojo, no aprendio nada util" (PDF)
    margen = 0.02
    le_gana = examen["arbol"]["exactitud"] >= examen["flojo"]["exactitud"] + margen

    # ---------- El modelo final: aprende con todas las respondidas ----------
    arbol = modelos["arbol"].fit(X, y)
    logistica = modelos["logistica"].fit(X, y)
    escalador, reg = logistica.named_steps["standardscaler"], logistica.named_steps["logisticregression"]

    importancia = sorted(
        [{"id": c, "nombre": INFO[c][1], "valor": round(float(v), 4)}
         for c, v in zip(COLS, arbol.feature_importances_) if v > 0],
        key=lambda d: -d["valor"])

    historial = [h for h in anterior.get("historial", []) if h.get("fecha") != hoy]
    historial.append({"fecha": hoy, "respondidas": total,
                      "exactitud_arbol": examen["arbol"]["exactitud"],
                      "exactitud_flojo": examen["flojo"]["exactitud"]})

    resultado.update({
        "estado": "listo",
        "dar_consejos": bool(le_gana),
        "examen": {"pliegues": PLIEGUES, "modelos": examen, "ganador": ganador,
                   "le_gana_al_flojo": bool(le_gana), "margen": margen,
                   "clase_mas_comun": "aceptada" if int(y.mode()[0]) == 1 else "rechazada",
                   "matriz": {"vp": int(vp), "vn": int(vn), "fp": int(fp), "fn": int(fn)}},
        "importancia": importancia,
        "arbol": arbol_a_json(arbol),
        "logistica": {"variables": COLS,
                      "media": [round(float(v), 6) for v in escalador.mean_],
                      "escala": [round(float(v), 6) for v in escalador.scale_],
                      "coef": [round(float(v), 6) for v in reg.coef_[0]],
                      "intercepto": round(float(reg.intercept_[0]), 6)},
        "historial": historial[-60:],
    })
    guardar(salida, resultado)
    informe(df, X, y, arbol, examen, predicciones, resultado, pliegue)


def habilidades_juntas(ruta, min_vacantes=3, min_confianza=0.30, maximo=10):
    """Extra opcional del PDF (reglas de asociacion): "las vacantes que piden A suelen pedir B".
    Lee una vacante por linea, con sus habilidades separadas por ';'.
      confianza = vacantes con A y B / vacantes con A
      lift      = confianza / (vacantes con B / total)   (mayor que 1: van juntas mas de lo normal)"""
    if not ruta.exists():
        return []
    nombre, cuenta, pares, total = {}, {}, {}, 0
    for linea in ruta.read_text(encoding="utf-8").splitlines()[1:]:
        hs = []
        for h in linea.split(";"):
            k = h.strip().lower()
            if k and k not in hs:
                hs.append(k)
                nombre.setdefault(k, h.strip())
        if not hs:
            continue
        total += 1
        for a in hs:
            cuenta[a] = cuenta.get(a, 0) + 1
            for b in hs:
                if a != b:
                    pares[(a, b)] = pares.get((a, b), 0) + 1
    reglas = []
    for (a, b), juntas in pares.items():
        confianza = juntas / cuenta[a]
        lift = confianza / (cuenta[b] / total)
        if juntas >= min_vacantes and confianza >= min_confianza and lift > 1:
            reglas.append((-lift, -confianza, a, b, juntas, confianza, lift))
    reglas.sort()
    return [{"si": nombre[a], "entonces": nombre[b], "vacantes": j,
             "confianza": round(c, 4), "lift": round(l, 4)} for _, _, a, b, j, c, l in reglas[:maximo]]


def guardar(ruta, datos):
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_text(json.dumps(datos, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Guardado {ruta}")


def informe(df, X, y, arbol, examen, predicciones, r, pliegue):
    """Lo que sirve para el profesor: tablas, el arbol en texto y figuras."""
    res = AQUI / "resultados"
    res.mkdir(exist_ok=True)
    pd.DataFrame(examen).T.to_csv(res / "metricas.csv")
    out = X.copy()
    out["aceptada"] = y
    out["prob_arbol"] = arbol.predict_proba(X)[:, 1].round(4)
    out["pred_examen_arbol"] = predicciones["arbol"]
    out["pliegue"] = pliegue          # en que grupo del examen quedo (la prueba de Java usa los mismos)
    out.to_csv(res / "predicciones.csv", index=False)
    (res / "arbol.txt").write_text(export_text(arbol, feature_names=COLS, decimals=2), encoding="utf-8")

    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        from sklearn.tree import plot_tree
        fig, ax = plt.subplots(figsize=(22, 10))
        plot_tree(arbol, feature_names=COLS, class_names=["rechazada", "aceptada"],
                  filled=True, rounded=True, fontsize=8, ax=ax)
        fig.savefig(res / "fig_arbol.png", dpi=110, bbox_inches="tight")
        plt.close(fig)
        m = r["examen"]["matriz"]
        fig, ax = plt.subplots(figsize=(4.5, 4))
        ax.imshow([[m["vn"], m["fp"]], [m["fn"], m["vp"]]], cmap="Blues")
        for (i, j), v in np.ndenumerate([[m["vn"], m["fp"]], [m["fn"], m["vp"]]]):
            ax.text(j, i, str(v), ha="center", va="center", fontsize=14)
        ax.set_xticks([0, 1], ["dijo rechazada", "dijo aceptada"])
        ax.set_yticks([0, 1], ["fue rechazada", "fue aceptada"])
        ax.set_title("Matriz de confusión del árbol (5 pliegues)")
        fig.savefig(res / "fig_confusion.png", dpi=110, bbox_inches="tight")
        plt.close(fig)
    except ImportError:
        print("(sin matplotlib: no se dibujaron las figuras)")

    e = r["examen"]
    print()
    print(f"Respondidas: {r['datos']['respondidas']} ({r['datos']['aceptadas']} aceptadas)")
    print(f"{'modelo':<10} {'exactitud':>9} {'precision':>9} {'recall':>7} {'F1':>6} {'ROC-AUC':>7}")
    for n, m in e["modelos"].items():
        print(f"{n:<10} {m['exactitud']:>9.3f} {m['precision']:>9.3f} {m['sensibilidad']:>7.3f} "
              f"{m['f1']:>6.3f} {m['roc_auc'] if m['roc_auc'] is not None else float('nan'):>7.3f}")
    print(f"Ganador por F1: {e['ganador']}.  ¿El árbol le gana al flojo? {'sí' if e['le_gana_al_flojo'] else 'NO'}")
    print(f"Matriz (árbol): {e['matriz']}")
    print(f"Resultados para el informe en {res}")


if __name__ == "__main__":
    sys.exit(main())
