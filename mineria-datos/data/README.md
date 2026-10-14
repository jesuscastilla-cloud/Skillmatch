# Datos

## Conjunto usado
Archivo: all_job_post.csv (1.167 vacantes, 5 columnas: job_id, category, job_title, job_description, job_skill_set).
Fuente: Kaggle, conjunto "job-skill-set" de Batuhan Mutlu (2024): https://www.kaggle.com/datasets/batuhanmutlu/job-skill-set
Origen: derivado de "LinkedIn Job Postings" de Arshkon (licencia CC BY-SA 4.0): https://www.kaggle.com/datasets/arshkon/linkedin-job-postings

El CSV no se incluye en el repositorio. Para reproducir el análisis:
1. Descargarlo desde Kaggle (requiere una cuenta gratuita).
2. Dejar all_job_post.csv en la misma carpeta que use el notebook (en Colab, la carpeta de Drive indicada en la variable ruta).

## Conjunto descartado
job_market_skills_dataset (Kaggle, datos de la API de Adzuna): https://www.kaggle.com/datasets/sharmagayatri/job-market-skills-dataset
Motivo: ninguna de sus 1.000 filas trae salario, 925 son de una sola categoría (informática) y casi todas son de India.

## Archivos generados por el análisis
Están en la carpeta resultados/ (métricas, comparación de modelos, habilidades por categoría y el dataset preparado).
