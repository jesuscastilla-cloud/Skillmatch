# El modelo predictivo de SkillMatch

SkillMatch aprende de las postulaciones que las empresas ya **aceptaron o rechazaron** para decirle a cada
persona si sus posibilidades en una vacante son **buenas, regulares o bajas**, y qué la ayudaría a mejorar.

En minería de datos es **clasificación supervisada** con un **árbol de decisión** (CART, máximo 4 niveles y
5 casos por hoja), comparado con una **regresión logística** y con un **«modelo flojo»** que siempre dice
lo más común. Se examina con **validación cruzada de 5 pliegues por vacante**.

## Dónde está cada parte

| Parte | Dónde |
|---|---|
| El modelo que corre en SkillMatch (aprende solo cada noche, 3:30 a. m.) | `backend/.../modelo/` y `service/ModeloPredictivoService.java` |
| Lo que mira de cada postulación | `service/TablaEjemplosService.java` (Java) y `1-datos/caracteristicas.py` (Python): iguales |
| El mismo modelo en Python con scikit-learn (para el profesor y para comprobar) | `2-modelo/entrenar_modelo.py` |
| Todo en Google Colab, con 8 ejercicios | `SkillMatch_modelo_predictivo_Colab.ipynb` |
| La página «Cómo aprende SkillMatch» | `SkillMatch/src/pages/como-aprende.html` |
| El recuadro en «Mis postulaciones» y los correos | `profile.js`, `modelo-predictivo.js` y `service/AvisosCorreoService.java` |

## Qué mira y qué no

Cada postulación respondida es un ejemplo. De cada una mira: cuántas de las habilidades pedidas tiene y qué
tan bien las domina, años de experiencia y si alcanzan, estudios, qué tan completo está el perfil, si
escribió carta y qué tan larga, si vive en la ciudad de la vacante (o es remota), tipo de vacante, qué tan
rápido se postuló y **cuántas personas se habían postulado antes**.

**Nunca** mira nombre, correo, teléfono, foto, edad, sexo ni qué empresa es (Ley 931 y Ley 1581).

## Dos cuidados contra la trampa de la «fuga de datos»

1. **Solo los postulantes previos.** Cuenta las personas que se postularon a la vacante *antes*, no el
   total. Las que llegan después son información del futuro: al postularse nadie la tiene.
2. **El examen por vacante.** Todas las postulaciones de una misma vacante quedan en el mismo grupo del
   examen. Si una vacante quedara repartida entre el estudio y el examen, el modelo se examinaría con algo
   que ya vio y sacaría una nota mejor de la que merece. Python (`pliegues_por_vacante`) y Java
   (`Pliegues.porVacante`) reparten con la misma regla, sin azar, y una prueba comprueba que dan lo mismo.

## Resultado con respuestas sorteadas al azar (control negativo)

`generar_datos_semilla.py` reproduce la **primera versión** del `DataSeeder.java`, donde la respuesta de la
empresa se sorteaba al azar. Hoy el `DataSeeder` ya no sortea: sus respuestas de ejemplo salen de una regla
escrita en `DemostracionModelo.java` (marcadas `ejemplo = true`, «Demostración» en la página), y el modelo
sí le gana al flojo. Con las respuestas sorteadas, hay 151 postulaciones respondidas (77 aceptadas y 74 rechazadas):

| Modelo | Exactitud | F1 | ROC-AUC |
|---|---|---|---|
| Árbol de decisión | 0,464 | 0,537 | 0,437 |
| Regresión logística | 0,450 | 0,465 | 0,447 |
| Modelo flojo (siempre «aceptada») | 0,510 | 0,675 | 0,500 |

**El árbol no le gana al modelo flojo, y eso es lo correcto**: con respuestas sorteadas no hay nada que
aprender (un ROC-AUC de 0,5 es como lanzar una moneda). La página lo dice con esas palabras y SkillMatch no da
consejos. El cuaderno de Colab trae el **control positivo**: con un patrón escondido a propósito, el mismo
modelo sí lo encuentra (exactitud 0,82 contra 0,63 del flojo). El modelo aprenderá de verdad cuando las
empresas respondan postulaciones reales.

## Cómo correrlo

**En Google Colab (lo más fácil):** abre `SkillMatch_modelo_predictivo_Colab.ipynb` en
https://colab.research.google.com (Archivo → Subir cuaderno) y Entorno de ejecución → Ejecutar todas.
Descarga el proyecto solo.

**En tu PC** (Python 3.10 o más nuevo), desde esta carpeta:

```powershell
pip install -r 2-modelo\requirements.txt
cd 1-datos
python generar_datos_semilla.py
cd ..\2-modelo
python entrenar_modelo.py --datos ..\1-datos\datos\ejemplos_semilla.csv
```

Con los datos reales: `exportar_desde_mongo.py` lee la base (pide la variable `MONGODB_URI`; nunca la
escribas en un archivo) o descarga el CSV anónimo desde `GET /api/admin/modelo/ejemplos.csv` con una cuenta
de administrador. `--sin-ejemplos` deja fuera las vacantes «(ejemplo)».

**Comprobar que el navegador da lo mismo que Python** (desde la raíz del proyecto):

```powershell
node mineria-datos/modelo-predictivo/pruebas/comparar-python-y-javascript.js
```

Si cambias lo que mira el modelo, cámbialo en los tres lugares (Python, Java y `modelo-predictivo.js`),
vuelve a correr los dos scripts y copia `ejemplos_semilla.csv`, `vacantes_habilidades.csv`,
`resultados/predicciones.csv` y el JSON a `backend/src/test/resources/modelo/`: las pruebas de Java
comparan contra ellos.

Basado en la propuesta del equipo y en el prototipo de `mineria-datos/prototipo_modelo_postulaciones.py`.
