"""
Prototipo del modelo predictivo de SkillMatch: ¿sera aceptada esta postulacion?

Es el modelo de la propuesta "SkillMatch: modelo predictivo, version afinada", hecho con
scikit-learn antes de programarlo en Java. Sirve para tres cosas:
  1. Ver la mineria funcionando aunque las empresas todavia no hayan respondido.
  2. Probar si los ajustes de la propuesta sirven con 30, 72, 150 y 500 postulaciones.
  3. Despues, comprobar que el modelo en Java da lo mismo, leyendo el CSV anonimo de SkillMatch.

Sin argumentos usa DATOS DE DEMOSTRACION (inventados, nunca se mezclan con los reales):

    python prototipo_modelo_postulaciones.py
    python prototipo_modelo_postulaciones.py C:/ruta/postulaciones_anonimas.csv

El CSV real debe traer las 12 variables (ver VARIABLES), vacante_id y aceptada (1 o 0).
Si trae las columnas parte_1 ... parte_10 (la parte del examen de cada fila en cada repeticion,
de 0 a 4), se usan esas mismas partes, para que Python y Java presenten exactamente el mismo examen.

Resultados: resultados/prototipo/ y resultados/figuras/prototipo_*.png
"""
import sys
from pathlib import Path

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.base import clone
from sklearn.dummy import DummyClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score, roc_auc_score
from sklearn.model_selection import StratifiedGroupKFold, StratifiedKFold
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.tree import DecisionTreeClassifier, export_text, plot_tree

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

SEMILLA = 42
TAMANOS = [30, 72, 150, 500]   # 72 = las postulaciones que tiene SkillMatch hoy
PARTES = 5                     # el examen se hace en 5 partes
REPETICIONES = 10              # y se repite 10 veces: 50 examenes
MARGEN = 0.05                  # cuanto tiene que ganar un modelo para que cuente como mejor

# Las 12 variables de la propuesta, tomadas en el momento de postularse
VARIABLES = [
    'pct_habilidades',          # 1  % de las habilidades pedidas que tiene (0 a 1)
    'nivel_dominio',            # 2  1 basico, 2 intermedio, 3 avanzado
    'anios_experiencia',        # 3
    'experiencia_alcanza',      # 4  1 si alcanza lo que pide la vacante
    'num_estudios',             # 5
    'perfil_completo',          # 6  0 a 1
    'tiene_carta',              # 7  1 o 0
    'palabras_carta',           # 8
    'misma_ciudad_o_remota',    # 9  1 o 0
    'tipo_vacante',             # 10 empleo, practica o independiente
    'dias_hasta_postularse',    # 11
    'postulantes_previos',      # 12 solo los que se postularon ANTES
]
TIPOS = ['empleo', 'practica', 'independiente']

# Lo que la persona puede cambiar pronto, y el consejo que le damos.
# La ciudad, los anios de experiencia y el tipo de vacante no dan consejo.
CONSEJOS = {
    'pct_habilidades': 'agrega a tu perfil las habilidades que pide la vacante',
    'tiene_carta': 'escribe una carta de presentacion corta',
    'palabras_carta': 'escribe una carta un poco mas completa',
    'perfil_completo': 'completa tu perfil',
    'num_estudios': 'registra tus estudios',
}

CARPETA = Path(__file__).resolve().parent
SALIDA = CARPETA / 'resultados' / 'prototipo'
FIGURAS = CARPETA / 'resultados' / 'figuras'

# Colores de las graficas (paleta validada para daltonismo y contraste)
AZUL, NARANJA, GRIS = '#2a78d6', '#eb6834', '#8a8984'
TINTA, TINTA_SUAVE, REJILLA = '#0b0b0b', '#52514e', '#e4e3df'


# ---------------------------------------------------------------- datos de demostracion

def generar_demostracion(n, rng):
    """Inventa n postulaciones respondidas con una regla escondida que el modelo debe descubrir."""
    n_vacantes = max(PARTES, round(n / 6))   # unas 6 postulaciones por vacante
    vacantes = pd.DataFrame({
        'vacante_id': [f'V{i:03d}' for i in range(n_vacantes)],
        'habilidades_pedidas': rng.integers(2, 7, n_vacantes),
        'anios_pedidos': rng.choice([0, 1, 2, 3], n_vacantes, p=[.35, .35, .2, .1]),
        'tipo_vacante': rng.choice(TIPOS, n_vacantes, p=[.55, .35, .10]),
        # que tan exigente es la empresa: el modelo no lo ve, pero las postulaciones a la misma
        # vacante se parecen por esto (por eso el examen no reparte una vacante entre partes)
        'exigencia': rng.normal(0, 0.8, n_vacantes),
    })
    # cada vacante recibe al menos una postulacion; el resto se reparte al azar
    indices = np.concatenate([np.arange(n_vacantes), rng.integers(0, n_vacantes, n - n_vacantes)])
    d = vacantes.iloc[indices].reset_index(drop=True)

    tiene = rng.binomial(d['habilidades_pedidas'], rng.beta(2, 2, n))
    d['pct_habilidades'] = (tiene / d['habilidades_pedidas']).round(2)
    d['nivel_dominio'] = rng.choice([1, 2, 3], n, p=[.35, .45, .2])
    d['anios_experiencia'] = np.clip(rng.gamma(1.5, 1.0, n), 0, 10).round(1)
    d['experiencia_alcanza'] = (d['anios_experiencia'] >= d['anios_pedidos']).astype(int)
    d['num_estudios'] = rng.integers(0, 4, n)
    d['perfil_completo'] = rng.uniform(0.3, 1.0, n).round(2)
    d['tiene_carta'] = (rng.random(n) < 0.55).astype(int)
    d['palabras_carta'] = np.where(d['tiene_carta'] == 1, rng.integers(15, 220, n), 0)
    d['misma_ciudad_o_remota'] = (rng.random(n) < 0.8).astype(int)
    d['dias_hasta_postularse'] = rng.integers(0, 30, n)
    # cuantos se habian postulado antes a la misma vacante (nunca los que llegaron despues)
    d['postulantes_previos'] = (d.groupby('vacante_id')['dias_hasta_postularse']
                                 .rank(method='first').astype(int) - 1)

    # La regla escondida. Los dias, los postulantes previos, los estudios y el tipo NO influyen:
    # un buen modelo deberia darles poca importancia.
    logit = (-1.6 + 3.0 * (d['pct_habilidades'] - 0.5) + 0.9 * d['tiene_carta']
             + 0.8 * d['experiencia_alcanza'] + 1.5 * (d['perfil_completo'] - 0.65)
             + 0.3 * (d['nivel_dominio'] - 2) + 0.5 * (d['misma_ciudad_o_remota'] - 0.8)
             - d['exigencia'])
    d['aceptada'] = (rng.random(n) < 1 / (1 + np.exp(-logit))).astype(int)
    return d[['vacante_id'] + VARIABLES + ['aceptada']]


# ---------------------------------------------------------------- preparar y modelos

def matriz_x(d):
    """Las 12 variables como numeros. El tipo de vacante se vuelve 3 columnas de 0 y 1."""
    x = d[VARIABLES].drop(columns='tipo_vacante').astype(float)
    for tipo in TIPOS:
        x[f'tipo_{tipo}'] = (d['tipo_vacante'] == tipo).astype(float)
    return x


def parametros_arbol(n):
    """Limites que crecen con los datos, para que el arbol no se aprenda los ejemplos de memoria."""
    return dict(
        criterion='gini',
        max_depth=3 if n < 100 else 4,
        min_samples_leaf=max(5, round(0.10 * n)),
        # sklearn pondera la mejora por la parte de los datos que llega al nodo; Java debe hacer igual
        min_impurity_decrease=0.01,
        class_weight='balanced',        # cada aceptada pesa mas cuando hay pocas
        random_state=SEMILLA,
    )


def crear_modelos(n):
    return {
        'Árbol de decisión': DecisionTreeClassifier(**parametros_arbol(n)),
        'Regresión logística': make_pipeline(
            StandardScaler(), LogisticRegression(class_weight='balanced', max_iter=1000)),
        'Modelo flojo': DummyClassifier(strategy='most_frequent'),
    }


# ---------------------------------------------------------------- el examen

def particiones(d, y, repeticion, por_vacante):
    """Las 5 partes de una repeticion. Si el CSV trae parte_1..parte_10, se usan esas."""
    columna = f'parte_{repeticion + 1}'
    if columna in d.columns:
        parte = d[columna].to_numpy()
        return [(np.where(parte != k)[0], np.where(parte == k)[0]) for k in range(PARTES)]
    if por_vacante:
        cv = StratifiedGroupKFold(PARTES, shuffle=True, random_state=SEMILLA + repeticion)
        return list(cv.split(np.zeros(len(y)), y, d['vacante_id']))
    cv = StratifiedKFold(PARTES, shuffle=True, random_state=SEMILLA + repeticion)
    return list(cv.split(np.zeros(len(y)), y))


def prob_aceptada(modelo, x):
    clases = list(modelo.classes_)
    if 1 not in clases:
        return np.zeros(len(x))
    return modelo.predict_proba(x)[:, clases.index(1)]


def examinar(modelo, d, x, y, por_vacante=True):
    """50 examenes con postulaciones que el modelo no vio. Devuelve las notas promedio y su margen."""
    f1s, exactitudes, aucs = [], [], []
    matriz = None
    for r in range(REPETICIONES):
        prob_fuera = np.zeros(len(y))
        pred_fuera = np.zeros(len(y), dtype=int)
        for entreno, examen in particiones(d, y, r, por_vacante):
            m = clone(modelo).fit(x.iloc[entreno], y[entreno])
            pred = m.predict(x.iloc[examen])
            f1s.append(f1_score(y[examen], pred, average='macro', labels=[0, 1], zero_division=0))
            exactitudes.append(accuracy_score(y[examen], pred))
            prob_fuera[examen] = prob_aceptada(m, x.iloc[examen])
            pred_fuera[examen] = pred
        # ROC-AUC y matriz se calculan juntando los 5 examenes: con 6 casos por parte no se puede
        aucs.append(roc_auc_score(y, prob_fuera))
        if r == 0:
            matriz = confusion_matrix(y, pred_fuera, labels=[1, 0])
    return {
        'f1_macro': np.mean(f1s), 'f1_macro_desv': np.std(f1s),
        'exactitud': np.mean(exactitudes), 'roc_auc': np.mean(aucs),
        # acerto que si, se le escapo, falsa alarma, acerto que no
        'acerto_si': matriz[0, 0], 'se_le_escapo': matriz[0, 1],
        'falsa_alarma': matriz[1, 0], 'acerto_no': matriz[1, 1],
    }


def decidir(d, notas):
    """El estado del modelo y quien gana, con las reglas de la propuesta."""
    aceptadas = int(d['aceptada'].sum())
    rechazadas = len(d) - aceptadas
    vacantes = d['vacante_id'].nunique()
    arbol = notas['Árbol de decisión']['f1_macro']
    logistica = notas['Regresión logística']['f1_macro']
    flojo = notas['Modelo flojo']['f1_macro']
    ganador = 'Regresión logística' if logistica > arbol + MARGEN else 'Árbol de decisión'
    if len(d) < 30 or min(aceptadas, rechazadas) < 8 or vacantes < PARTES:
        faltan = []
        if len(d) < 30:
            faltan.append(f'{30 - len(d)} respuestas')
        if aceptadas < 8:
            faltan.append(f'{8 - aceptadas} aceptadas')
        if rechazadas < 8:
            faltan.append(f'{8 - rechazadas} rechazadas')
        if vacantes < PARTES:
            faltan.append(f'{PARTES - vacantes} vacantes')
        return 'Esperando datos', ganador, 'faltan ' + ', '.join(faltan)
    if notas[ganador]['f1_macro'] - flojo >= MARGEN:
        return 'Activo', ganador, ''
    return 'Aprendiendo', ganador, 'todavía no le gana a adivinar'


# ---------------------------------------------------------------- lo que ve la persona

class Recuadro:
    """Posibilidades (buenas, regulares, bajas) y consejo, a partir del arbol entrenado."""

    def __init__(self, arbol, x, y):
        self.arbol = arbol
        self.columnas = list(x.columns)
        self.promedio = y.mean()
        caminos = arbol.decision_path(x)                    # que nodos recorre cada postulacion
        pasan = np.asarray(caminos.sum(axis=0)).ravel()
        aceptadas = np.asarray(caminos.T @ y).ravel()
        # % real de aceptadas en cada nodo (sin los pesos por clase, que solo sirven para aprender)
        self.pct_nodo = np.divide(aceptadas, pasan, out=np.zeros(len(pasan)), where=pasan > 0)

    def nivel(self, pct):
        if pct >= 1.5 * self.promedio:
            return 'buenas'
        if pct <= 0.5 * self.promedio:
            return 'bajas'
        return 'regulares'

    def para(self, fila):
        t = self.arbol.tree_
        nodo, consejo = 0, None
        while t.children_left[nodo] != -1:                 # -1 = hoja
            variable = self.columnas[t.feature[nodo]]
            izquierda, derecha = t.children_left[nodo], t.children_right[nodo]
            va, otro = (izquierda, derecha) if fila[variable] <= t.threshold[nodo] else (derecha, izquierda)
            if consejo is None and variable in CONSEJOS and self.pct_nodo[va] < self.pct_nodo[otro]:
                consejo = CONSEJOS[variable]
            nodo = va
        if consejo is None:
            consejo = 'tu perfil encaja con lo que pide la vacante'
        return self.nivel(self.pct_nodo[nodo]), round(self.pct_nodo[nodo], 2), consejo


def valentina():
    """La postulacion del ejemplo de la propuesta."""
    return pd.DataFrame([{
        'vacante_id': 'ejemplo', 'pct_habilidades': 0.67, 'nivel_dominio': 2,
        'anios_experiencia': 1.0, 'experiencia_alcanza': 1, 'num_estudios': 1,
        'perfil_completo': 0.8, 'tiene_carta': 1, 'palabras_carta': 40,
        'misma_ciudad_o_remota': 1, 'tipo_vacante': 'empleo',
        'dias_hasta_postularse': 2, 'postulantes_previos': 7, 'aceptada': 0,
    }])


# ---------------------------------------------------------------- graficas

def estilo_ejes(ax):
    for lado in ('top', 'right'):
        ax.spines[lado].set_visible(False)
    for lado in ('left', 'bottom'):
        ax.spines[lado].set_color(REJILLA)
    ax.tick_params(colors=TINTA_SUAVE, labelsize=9.5)
    ax.grid(axis='y', color=REJILLA, linewidth=0.8)
    ax.set_axisbelow(True)


def grafica_f1(resumen, ruta, demostracion):
    fig, ax = plt.subplots(figsize=(8, 4.6), dpi=150)
    estilo_ejes(ax)
    tamanos = sorted(resumen['postulaciones'].unique())
    posicion = {n: i for i, n in enumerate(tamanos)}
    series = [('Árbol de decisión', AZUL, -0.12), ('Regresión logística', NARANJA, 0.0),
              ('Modelo flojo', GRIS, 0.12)]
    for modelo, color, corrimiento in series:
        f = resumen[resumen['modelo'] == modelo].sort_values('postulaciones')
        xs = [posicion[n] + corrimiento for n in f['postulaciones']]
        ax.errorbar(xs, f['f1_macro'], yerr=f['f1_macro_desv'], fmt='o', color=color,
                    ecolor=color, elinewidth=2, capsize=0, markersize=7,
                    markeredgecolor='white', markeredgewidth=1.5, label=modelo)
        ax.plot(xs, f['f1_macro'], color=color, linewidth=2, alpha=0.5)
    ax.set_xticks(range(len(tamanos)), [f'{n}' for n in tamanos])
    ax.set_xlim(-0.5, len(tamanos) - 0.5)
    ax.set_ylim(0, 1)
    ax.set_xlabel('Postulaciones respondidas', color=TINTA_SUAVE, fontsize=10)
    ax.set_ylabel('F1 macro (promedio ± desviación, 50 exámenes)', color=TINTA_SUAVE, fontsize=10)
    arbol = resumen[resumen['modelo'] == 'Árbol de decisión'].sort_values('postulaciones')
    flojo = resumen[resumen['modelo'] == 'Modelo flojo'].sort_values('postulaciones')
    ventaja = (arbol['f1_macro'].to_numpy() - flojo['f1_macro'].to_numpy())
    gana = [n for n, v in zip(tamanos, ventaja) if v >= MARGEN]
    if not gana:
        titulo = 'El árbol todavía no le gana al modelo flojo con ninguna cantidad de datos'
    elif gana[0] == tamanos[0]:
        titulo = f'El árbol le gana al modelo flojo desde {tamanos[0]} postulaciones'
    else:
        titulo = (f'El árbol le gana al modelo flojo desde {gana[0]} postulaciones; '
                  f'con {tamanos[0]} todavía no')
    fig.suptitle(titulo, x=0.07, ha='left', fontsize=11.5, fontweight='bold', color=TINTA)
    nota = 'Datos de demostración (inventados). ' if demostracion else ''
    ax.set_title(nota + 'La barra vertical es el margen: más corta, nota más confiable.',
                 loc='left', fontsize=9.5, color=TINTA_SUAVE)
    ax.legend(frameon=False, fontsize=9.5, loc='lower right', labelcolor=TINTA)
    fig.tight_layout()
    fig.savefig(ruta, facecolor='white')
    plt.close(fig)


def grafica_arbol(arbol, columnas, ruta, n, demostracion):
    fig, ax = plt.subplots(figsize=(13, 6.5), dpi=150)
    plot_tree(arbol, feature_names=columnas, class_names=['rechazada', 'aceptada'],
              filled=False, rounded=True, impurity=False, proportion=True, fontsize=9, ax=ax)
    nota = ', datos de demostración' if demostracion else ''
    ax.set_title(f'Árbol aprendido con {n} postulaciones{nota}', loc='left',
                 fontsize=11.5, fontweight='bold', color=TINTA)
    fig.tight_layout()
    fig.savefig(ruta, facecolor='white')
    plt.close(fig)


# ---------------------------------------------------------------- todo junto

def cargar():
    if len(sys.argv) > 1:
        ruta = Path(sys.argv[1])
        d = pd.read_csv(ruta)
        faltan = [c for c in ['vacante_id'] + VARIABLES + ['aceptada'] if c not in d.columns]
        if faltan:
            sys.exit(f'Al CSV le faltan columnas: {faltan}')
        print(f'Datos reales: {ruta} ({len(d)} postulaciones respondidas)')
        return {len(d): d}, False
    rng = np.random.default_rng(SEMILLA)
    print('DATOS DE DEMOSTRACIÓN: inventados, solo prueban el método.')
    return {n: generar_demostracion(n, rng) for n in TAMANOS}, True


def main():
    SALIDA.mkdir(parents=True, exist_ok=True)
    FIGURAS.mkdir(parents=True, exist_ok=True)
    conjuntos, demostracion = cargar()

    filas, fuga, importancias, ejemplos = [], [], [], []
    for n, d in conjuntos.items():
        x, y = matriz_x(d), d['aceptada'].to_numpy()
        notas = {nombre: examinar(m, d, x, y) for nombre, m in crear_modelos(n).items()}
        estado, ganador, detalle = decidir(d, notas)
        for nombre, nota in notas.items():
            filas.append({'postulaciones': n, 'aceptadas': int(y.sum()),
                          'vacantes': d['vacante_id'].nunique(), 'modelo': nombre,
                          **{k: round(float(v), 4) if isinstance(v, float) else v
                             for k, v in nota.items()},
                          'estado': estado, 'ganador': ganador == nombre, 'detalle': detalle})

        # Que pasa si el examen mezcla postulaciones de la misma vacante
        mezclado = examinar(crear_modelos(n)['Árbol de decisión'], d, x, y, por_vacante=False)
        fuga.append({'postulaciones': n,
                     'f1_macro_por_vacante': round(notas['Árbol de decisión']['f1_macro'], 4),
                     'f1_macro_mezclado': round(mezclado['f1_macro'], 4),
                     'diferencia': round(mezclado['f1_macro'] - notas['Árbol de decisión']['f1_macro'], 4)})

        # El arbol final aprende con todos los datos
        arbol = DecisionTreeClassifier(**parametros_arbol(n)).fit(x, y)
        (SALIDA / f'arbol_{n}.txt').write_text(
            f'Árbol con {n} postulaciones ({int(y.sum())} aceptadas). Estado: {estado}.\n'
            f'Límites: {parametros_arbol(n)}\n\n' + export_text(arbol, feature_names=list(x.columns)),
            encoding='utf-8')
        for variable, peso in zip(x.columns, arbol.feature_importances_):
            importancias.append({'postulaciones': n, 'variable': variable, 'importancia': round(peso, 4)})

        recuadro = Recuadro(arbol, x, y)
        casos = pd.concat([valentina(), d.sample(5, random_state=SEMILLA)], ignore_index=True)
        for i, fila in matriz_x(casos).iterrows():
            nivel, pct, consejo = recuadro.para(fila)
            ejemplos.append({'postulaciones': n,
                             'caso': 'Valentina' if i == 0 else f'demostración {i}',
                             'pct_habilidades': casos.loc[i, 'pct_habilidades'],
                             'tiene_carta': casos.loc[i, 'tiene_carta'],
                             'perfil_completo': casos.loc[i, 'perfil_completo'],
                             'pct_aceptadas_en_su_hoja': pct, 'promedio': round(recuadro.promedio, 2),
                             # fuera del estado Activo solo se muestran las habilidades que faltan
                             'posibilidades': nivel if estado == 'Activo' else '(no se muestran)',
                             'consejo': consejo if estado == 'Activo'
                             else '(solo las habilidades que le faltan)',
                             'estado_del_modelo': estado})

        if n == 150 or len(conjuntos) == 1:
            grafica_arbol(arbol, list(x.columns), FIGURAS / f'prototipo_arbol_{n}.png', n, demostracion)

    resumen = pd.DataFrame(filas)
    resumen.to_csv(SALIDA / 'resumen_por_tamano.csv', index=False, encoding='utf-8')
    pd.DataFrame(fuga).to_csv(SALIDA / 'examen_por_vacante_vs_mezclado.csv', index=False, encoding='utf-8')
    pd.DataFrame(importancias).to_csv(SALIDA / 'importancia_variables.csv', index=False, encoding='utf-8')
    pd.DataFrame(ejemplos).to_csv(SALIDA / 'posibilidades_ejemplos.csv', index=False, encoding='utf-8')
    if demostracion:
        pd.concat([d.assign(escenario=n) for n, d in conjuntos.items()]).to_csv(
            SALIDA / 'datos_demostracion.csv', index=False, encoding='utf-8')
    if len(conjuntos) > 1:
        grafica_f1(resumen, FIGURAS / 'prototipo_f1_por_tamano.png', demostracion)

    pd.set_option('display.width', 160)
    print('\nNotas del examen (F1 macro promedio ± desviación en 50 exámenes):')
    print(resumen[['postulaciones', 'aceptadas', 'vacantes', 'modelo', 'f1_macro', 'f1_macro_desv',
                   'roc_auc', 'estado', 'ganador']].to_string(index=False))
    print('\nExamen por vacante frente a examen mezclado (árbol):')
    print(pd.DataFrame(fuga).to_string(index=False))
    print('\nEl recuadro de Valentina:')
    print(pd.DataFrame(ejemplos).query("caso == 'Valentina'")[
        ['postulaciones', 'pct_aceptadas_en_su_hoja', 'promedio', 'posibilidades', 'consejo',
         'estado_del_modelo']].to_string(index=False))
    print(f'\nArchivos en {SALIDA} y {FIGURAS}')


if __name__ == '__main__':
    main()
