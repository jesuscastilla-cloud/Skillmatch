# Reporte de Minería de Datos

**Proyecto:** SkillMatch – Clasificación de vacantes por habilidades
**Fecha:** 13/10/2026

## 1. Definición del problema

SkillMatch conecta talento joven con vacantes según sus habilidades. Se busca comprobar si las habilidades que pide una vacante permiten predecir su categoría (informática, desarrollo de negocios, finanzas, ventas o recursos humanos), como base para el motor de compatibilidad de la plataforma.

- **Tipo de tarea:** clasificacion
- **Variable objetivo:** category

## 2. Datos

- **Archivo:** dataset_vacantes_minedapp_top30.csv
- **Filas:** 1167
- **Columnas:** 31
- **Numéricas:** communication, problem solving, adaptability, teamwork, leadership, collaboration, time management, interpersonal skills, relationship building, customer service, data analysis, attention to detail, project management, organizational skills, negotiation, presentation skills, business development, sales, strategic thinking, financial analysis, analytical skills, team collaboration, employee relations, self-motivation, financial reporting, flexibility, customer relationship management, microsoft office, performance management, budgeting
- **Categóricas:** category

## 3. Preprocesamiento

- **Nulos:** none
- **Outliers:** none
- **Escalado:** none
- **Codificación:** label

## 4. Modelado

- **Algoritmo:** Regresión Logística
- **Test size:** 0.2
- **Random state:** 42

## 5. Evaluación

Métricas sugeridas para clasificacion:

- **Accuracy** (accuracy_score): Proporción de aciertos globales.
- **Precision** (precision_score): De los predichos positivos, cuántos lo son realmente.
- **Recall** (recall_score): De los positivos reales, cuántos se detectaron.
- **F1-Score** (f1_score): Media armónica entre Precision y Recall.
- **Matriz de confusión** (confusion_matrix): Tabla VP, VN, FP, FN.

## 6. Resultados reales (ejecutados en Google Colab)

Modelo oficial: regresión logística con 198 habilidades (las que aparecen en al menos 10 vacantes del entrenamiento), división 80/20 estratificada, semilla 42. Cuaderno: SkillMatch_Clasificacion_Vacantes_por_Habilidades.ipynb.

- Modelo de referencia (siempre la categoría más frecuente): exactitud 0,2051
- Regresión logística, conjunto de prueba (234 vacantes): exactitud 0,7308, F1 macro 0,7346
- Validación cruzada de 5 pliegues: regresión logística 0,7728; Naive Bayes 0,7792; Random Forest 0,7888

## 7. Comparación con la corrida de MinedApp

Con el archivo compacto de MinedApp (solo las 30 habilidades más frecuentes) el mismo modelo alcanza exactitud 0,6624 y F1 ponderado 0,6661. Usar 198 habilidades en lugar de 30 sube el resultado a 0,7308, es decir, las habilidades menos frecuentes aportan información para distinguir categorías. En esta corrida las clases salen codificadas: 0 = BUSINESS-DEVELOPMENT, 1 = FINANCE, 2 = HR, 3 = INFORMATION-TECHNOLOGY, 4 = SALES.

## 8. Interpretación

Las categorías mejor identificadas son finanzas, recursos humanos e informática. La mayoría de los errores del modelo oficial (35 de 63) confunden desarrollo de negocios con ventas, porque comparten habilidades como relación con clientes y CRM.

## 9. Limitaciones

- Los datos son vacantes en inglés de origen LinkedIn, sin columna de ubicación; no se puede asegurar que representen el mercado de Cartagena.
- Las habilidades fueron extraídas automáticamente de las descripciones y pueden tener ruido.
- Con 234 vacantes de prueba, una cifra puede variar unos 3 puntos por azar.
- Este análisis valida que las habilidades distinguen categorías de vacantes; no valida el porcentaje de compatibilidad de la plataforma.
- El código generado por MinedApp en la Etapa 3 tuvo un error (NameError) que se corrigió al probarlo.

---
*Reporte generado por la Guía Interactiva de Minería de Datos y completado por el equipo con los resultados reales de Colab.*
