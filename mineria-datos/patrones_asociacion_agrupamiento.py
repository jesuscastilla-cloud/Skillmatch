"""
Dos tecnicas descriptivas que complementan la clasificacion (comparar_modelos.py):

  1. Reglas de asociacion (Apriori): que habilidades aparecen juntas en las vacantes.
  2. Agrupamiento (K-Means): si las vacantes se agrupan solas por area, sin mirar la categoria.

Datos: resultados/dataset_vacantes_preparado.csv (ya esta en el repositorio): las 1.167 vacantes
de Kaggle con las mismas 198 habilidades del modelo, codificadas como 0/1.

    python patrones_asociacion_agrupamiento.py

Resultados: resultados/reglas_asociacion.csv, resultados/agrupamiento_kmeans.csv y
resultados/agrupamiento_silueta.csv
"""
from pathlib import Path

import pandas as pd
from mlxtend.frequent_patterns import apriori, association_rules
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score

SEMILLA = 42
SOPORTE_MIN = 0.04     # la combinacion debe aparecer en al menos 4 % de las vacantes (47 de 1.167)
CONFIANZA_MIN = 0.5    # cuando aparece el antecedente, el consecuente aparece al menos la mitad de las veces
LIFT_MIN = 1.5         # y aparece al menos 1,5 veces mas de lo que se esperaria por azar
K = 5                  # tantos grupos como categorias, para poder compararlos con ellas

CARPETA = Path(__file__).resolve().parent
RESULTADOS = CARPETA / 'resultados'

df = pd.read_csv(RESULTADOS / 'dataset_vacantes_preparado.csv')
y = df['category']
X = df.drop(columns='category').astype(bool)
print(f'Vacantes: {len(X)}  Habilidades: {X.shape[1]}')

# ------------------------------------------------------------------ 1. reglas de asociacion
conjuntos = apriori(X, min_support=SOPORTE_MIN, use_colnames=True, max_len=3)
reglas = association_rules(conjuntos, metric='lift', min_threshold=LIFT_MIN)
reglas = reglas[reglas['confidence'] >= CONFIANZA_MIN].copy()
reglas['antecedente'] = reglas['antecedents'].apply(lambda s: ' + '.join(sorted(s)))
reglas['consecuente'] = reglas['consequents'].apply(lambda s: ' + '.join(sorted(s)))


def categoria_dominante(regla):
    # entre las vacantes que tienen todas las habilidades de la regla, la categoria mas comun
    tiene = X[list(regla['antecedents'] | regla['consequents'])].all(axis=1)
    reparto = y[tiene].value_counts(normalize=True)
    return pd.Series({'categoria_dominante': reparto.index[0], 'pct_categoria_dominante': round(reparto.iloc[0], 3)})


reglas = pd.concat([reglas, reglas.apply(categoria_dominante, axis=1)], axis=1)
reglas = reglas.sort_values(['lift', 'confidence'], ascending=False)
columnas = ['antecedente', 'consecuente', 'support', 'confidence', 'lift', 'categoria_dominante', 'pct_categoria_dominante']
salida = reglas[columnas].rename(columns={'support': 'soporte', 'confidence': 'confianza'}).round(3)
salida.to_csv(RESULTADOS / 'reglas_asociacion.csv', index=False, encoding='utf-8')
print(f'\nReglas con soporte >= {SOPORTE_MIN}, confianza >= {CONFIANZA_MIN} y lift >= {LIFT_MIN}: {len(salida)}')
print(salida.head(12).to_string(index=False))

# ------------------------------------------------------------------ 2. agrupamiento K-Means
# silueta de 2 a 10 grupos (con distancia de Jaccard, que compara conjuntos de habilidades)
silueta = pd.DataFrame({'k': k, 'silueta': round(silhouette_score(
    X, KMeans(k, n_init=10, random_state=SEMILLA).fit_predict(X), metric='jaccard'), 4)} for k in range(2, 11))
silueta.to_csv(RESULTADOS / 'agrupamiento_silueta.csv', index=False)
print('\nSilueta por numero de grupos:')
print(silueta.to_string(index=False))

km = KMeans(K, n_init=20, random_state=SEMILLA).fit(X)
grupo = pd.Series(km.labels_, index=X.index)
base = X.mean()
filas = []
for g in range(K):
    en_grupo = grupo == g
    reparto = y[en_grupo].value_counts(normalize=True)
    clave = (X[en_grupo].mean() - base).sort_values(ascending=False).head(6)   # lo que mas lo distingue del total
    filas.append({'grupo': g, 'n_vacantes': int(en_grupo.sum()),
                  **{cat: round(reparto.get(cat, 0), 3) for cat in sorted(y.unique())},
                  'categoria_dominante': reparto.index[0], 'pct_categoria_dominante': round(reparto.iloc[0], 3),
                  'habilidades_clave': ', '.join(clave.index)})
grupos = pd.DataFrame(filas).sort_values('pct_categoria_dominante', ascending=False)
grupos.to_csv(RESULTADOS / 'agrupamiento_kmeans.csv', index=False, encoding='utf-8')
pureza = pd.crosstab(grupo, y).max(axis=1).sum() / len(y)
print(f'\nK-Means con {K} grupos. Pureza (vacantes en la categoria dominante de su grupo): {pureza:.3f}')
print(grupos.to_string(index=False))
