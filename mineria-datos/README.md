# SkillMatch - Análisis de datos (Minería de Datos I)

## Proyecto
SkillMatch es una plataforma local que conecta talento joven con empresas de Cartagena según sus habilidades, con el propósito de reducir el desempleo juvenil.

## Problema que aborda este análisis
¿Las habilidades que pide una vacante permiten predecir su categoría laboral (informática, desarrollo de negocios, finanzas, ventas o recursos humanos), y cuáles se asocian más con cada una? Es la base de datos del porcentaje de compatibilidad de la plataforma.

## Integrantes
Willer Rivero Marriaga (análisis de datos), Luis Amaya, Jesús, Andrés y Luis Reyes (documentación).

## Tecnologías
Python, pandas, NumPy, scikit-learn, matplotlib, seaborn, Google Colab y MinedApp (https://cr1085.github.io/minedApp/).

## Fuente de los datos
Kaggle, "job-skill-set" (archivo all_job_post.csv, 1.167 vacantes). Detalles, licencia y cómo obtenerlo en data/README.md.

## Cómo ejecutar el análisis
1. Descargar all_job_post.csv (ver data/README.md) y subirlo a una carpeta de Google Drive.
2. Abrir SkillMatch_Clasificacion_Vacantes_por_Habilidades.ipynb en Google Colab.
3. Ajustar la variable ruta (paso 0) a la carpeta de Drive donde está el CSV.
4. Menú Entorno de ejecución, Ejecutar todas.
Las dependencias están en requirements.txt.

## Resultados (conjunto de prueba, 234 vacantes)
- Modelo de referencia (siempre la categoría más frecuente): exactitud 0,2051
- Regresión logística: exactitud 0,7308, F1 macro 0,7346
- Validación cruzada de 5 pliegues (exactitud media): regresión logística 0,7728, Naive Bayes 0,7792, Random Forest 0,7888
- La mayor confusión del modelo es entre desarrollo de negocios y ventas (35 de 63 errores).
Limitaciones: los datos son vacantes en inglés de origen LinkedIn, sin ubicación; no representan necesariamente a Cartagena, y este análisis no valida todavía el porcentaje de compatibilidad de la plataforma.

## Contenido de esta carpeta
- SkillMatch_Clasificacion_Vacantes_por_Habilidades.ipynb: análisis completo, ejecutado.
- resultados/: métricas, comparación de modelos, habilidades por categoría, dataset preparado y figuras.
- resultados/minedapp/reporte_minedapp.md: reporte de MinedApp completado con resultados reales.

## Documentos de la entrega
- Propuesta del modelo predictivo: ../documentos/propuesta_modelo.pdf
- Informe metodológico: ../documentos/informe_metodologico.pdf
