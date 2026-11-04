"""
Compara varios algoritmos de clasificacion para predecir la categoria de una vacante
(category: BUSINESS-DEVELOPMENT, FINANCE, HR, INFORMATION-TECHNOLOGY o SALES) a partir de las
habilidades que exige (job_skill_set).

Datos: all_job_post.csv (Kaggle "job-skill-set", 1.167 vacantes). No viene en el repositorio:
descargalo (ver README.md) y dejalo en esta carpeta, o pasa la ruta como argumento:

    python comparar_modelos.py
    python comparar_modelos.py C:/ruta/a/all_job_post.csv

Resultados: resultados/comparacion_modelos.csv y resultados/reglas_arbol.txt
"""
import ast
import sys
from collections import Counter
from pathlib import Path

import pandas as pd
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.naive_bayes import BernoulliNB
from sklearn.neighbors import KNeighborsClassifier
from sklearn.preprocessing import MultiLabelBinarizer
from sklearn.tree import DecisionTreeClassifier, export_text

SEMILLA = 42        # misma semilla que el cuaderno de Colab, para que los resultados se puedan repetir
MIN_VACANTES = 10   # una habilidad se usa solo si aparece en al menos 10 vacantes del entrenamiento

# valores del cuaderno de Colab que este script debe reproducir
ESPERADO = {'exactitud_prueba': 0.7308, 'f1_macro_prueba': 0.7346, 'referencia_prueba': 0.2051}

CARPETA = Path(__file__).resolve().parent
RESULTADOS = CARPETA / 'resultados'
ruta_csv = Path(sys.argv[1]) if len(sys.argv) > 1 else CARPETA / 'all_job_post.csv'


def a_lista(texto):
    # "['Communication', 'Excel', 'excel']" -> ['communication', 'excel'] (minusculas, sin repetidos)
    try:
        habilidades = ast.literal_eval(texto)
    except Exception:
        return []
    return sorted({h.strip().lower() for h in habilidades if isinstance(h, str) and h.strip()})


# paso 1: cargar los datos y convertir el texto de habilidades en una lista
if not ruta_csv.exists():
    sys.exit(f'No encuentro {ruta_csv}. Descarga all_job_post.csv (ver README.md).')
df = pd.read_csv(ruta_csv)
df['habilidades'] = df['job_skill_set'].apply(a_lista)
print(f'Vacantes: {len(df)}')

# paso 2: dividir 80/20 ANTES de construir las variables, para que la prueba no influya en ellas
entrenamiento, prueba = train_test_split(df[['category', 'habilidades']], test_size=0.2,
                                         random_state=SEMILLA, stratify=df['category'])
y_train, y_test = entrenamiento['category'], prueba['category']

# paso 3: conservar solo las habilidades frecuentes del entrenamiento y codificarlas como 0/1
conteo = Counter(h for lista in entrenamiento['habilidades'] for h in lista)
validas = {h for h, c in conteo.items() if c >= MIN_VACANTES}
filtrar = lambda lista: [h for h in lista if h in validas]
mlb = MultiLabelBinarizer()
X_train = mlb.fit_transform(entrenamiento['habilidades'].apply(filtrar))
X_test = mlb.transform(prueba['habilidades'].apply(filtrar))
print(f'Entrenamiento: {len(entrenamiento)}  Prueba: {len(prueba)}  Habilidades usadas: {X_train.shape[1]}')

# paso 4: comparar los modelos con validacion cruzada de 5 pliegues en el entrenamiento
# y con la prueba (234 vacantes que ningun modelo vio)
cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=SEMILLA)
modelos = {
    'Referencia (clase mas frecuente)': DummyClassifier(strategy='most_frequent'),
    'Regresion logistica': LogisticRegression(max_iter=1000, random_state=SEMILLA),
    'Naive Bayes (Bernoulli)': BernoulliNB(),
    'Arbol de decision (profundidad 5)': DecisionTreeClassifier(max_depth=5, random_state=SEMILLA),
    'Arbol de decision (sin limite)': DecisionTreeClassifier(random_state=SEMILLA),
    'Random Forest (200 arboles)': RandomForestClassifier(n_estimators=200, random_state=SEMILLA, n_jobs=-1),
    'KNN (k=7, distancia de Jaccard)': KNeighborsClassifier(n_neighbors=7, metric='jaccard'),
}
filas = []
for nombre, modelo in modelos.items():
    # la distancia de Jaccard compara conjuntos de habilidades: KNN recibe las columnas como verdadero/falso
    a, b = (X_train.astype(bool), X_test.astype(bool)) if isinstance(modelo, KNeighborsClassifier) else (X_train, X_test)
    puntajes = cross_val_score(modelo, a, y_train, cv=cv, scoring='accuracy')
    pred = modelo.fit(a, y_train).predict(b)
    filas.append({
        'modelo': nombre,
        'exactitud_cv_media': round(puntajes.mean(), 4),
        'exactitud_cv_desv': round(puntajes.std(), 4),
        'exactitud_prueba': round(accuracy_score(y_test, pred), 4),
        'f1_macro_prueba': round(f1_score(y_test, pred, average='macro'), 4),
    })
comparacion = pd.DataFrame(filas)
print()
print(comparacion.to_string(index=False))

# paso 5: reglas de un arbol de profundidad 4 (se leen como "si la vacante pide X y no pide Y, entonces...")
arbol = DecisionTreeClassifier(max_depth=4, random_state=SEMILLA).fit(X_train, y_train)
reglas = export_text(arbol, feature_names=list(mlb.classes_))
encabezado = (
    'Reglas de un arbol de decision de profundidad 4 (entrenamiento, 933 vacantes)\n'
    f'Exactitud en prueba de este arbol: {accuracy_score(y_test, arbol.predict(X_test)):.4f}\n'
    'Como leerlas: "habilidad <= 0.50" significa que la vacante NO pide esa habilidad;\n'
    '"habilidad >  0.50" significa que SI la pide. "class" es la categoria que predice esa rama.\n\n'
)
print()
print(encabezado + reglas)

# paso 6: guardar los resultados
RESULTADOS.mkdir(exist_ok=True)
comparacion.to_csv(RESULTADOS / 'comparacion_modelos.csv', index=False, encoding='utf-8')
(RESULTADOS / 'reglas_arbol.txt').write_text(encabezado + reglas, encoding='utf-8')

# paso 7: comprobar que se reproducen las cifras del cuaderno de Colab
rl = comparacion.set_index('modelo').loc['Regresion logistica']
obtenido = {'exactitud_prueba': rl['exactitud_prueba'], 'f1_macro_prueba': rl['f1_macro_prueba'],
            'referencia_prueba': comparacion.set_index('modelo').loc['Referencia (clase mas frecuente)', 'exactitud_prueba']}
print('Comprobacion contra el cuaderno de Colab:')
for clave, valor in ESPERADO.items():
    print(f'  {clave}: esperado {valor:.4f}  obtenido {obtenido[clave]:.4f}  {"OK" if abs(obtenido[clave] - valor) < 5e-5 else "NO COINCIDE"}')
if X_train.shape[1] != 198 or any(abs(obtenido[k] - v) >= 5e-5 for k, v in ESPERADO.items()):
    sys.exit('Los resultados no coinciden con el cuaderno de Colab.')
