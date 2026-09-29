# SolarLab · Explorador de modelos de irradiancia
# Estudiante: Brayan Adolfo Mejia Canchala 

Aplicación web desarrollada con **Flask, HTML, CSS y JavaScript** para consultar y comparar pipelines de Machine Learning asociados a datos de irradiancia. El sistema permite visualizar los puntos espaciales, contrastar métricas, revisar matrices de confusión, consultar una coordenada y administrar los artefactos de los modelos.

## 1. ¿Qué hace la aplicación?

La aplicación funciona como una interfaz de exploración de los resultados obtenidos durante el entrenamiento de los modelos.

Sus funciones principales son:

- Mostrar los modelos registrados en la carpeta `models/`.
- Comparar dos modelos simultáneamente.
- Visualizar los puntos de predicción sobre una representación espacial construida con `canvas`.
- Cambiar la visualización entre clase predicha, clase real y aciertos/errores.
- Consultar una posición mediante latitud y longitud.
- Identificar el punto de datos más cercano y mostrar su clase real, clase predicha y valor asociado.
- Presentar Accuracy, F1 macro, MCC y AUC.
- Mostrar las matrices de confusión de ambos modelos.
- Subir metadatos `.json`, predicciones `.csv` y, opcionalmente, un pipeline `.joblib`.
- Descargar un `.joblib` almacenado o eliminar un modelo desde el repositorio.

## 2. Estructura del proyecto

```text
app/
├── app.py
├── KRidge.py
├── Procfile
├── render.yaml
├── requirements.txt
├── README.md
├── models/
│   ├── *.json
│   ├── *_predicciones.csv
│   └── *.joblib
├── static/
│   ├── app.js
│   └── style.css
└── templates/
    └── index.html
```

### Archivos principales

- `app.py`: servidor Flask y API REST. Se encarga de leer los metadatos, procesar los CSV, entregar los puntos, clasificar coordenadas y administrar los modelos.
- `templates/index.html`: estructura de la interfaz web.
- `static/style.css`: diseño visual de la aplicación.
- `static/app.js`: interacción del navegador, mapas en canvas, consultas a la API, métricas y repositorio.
- `models/`: artefactos de los modelos utilizados por la aplicación.
- `KRidge.py`: implementación auxiliar de los kernels y del clasificador KRidge usado en el proyecto.

## 3. Ejecución local

Se recomienda utilizar Python 3.11 o una versión compatible con las dependencias del proyecto.

### Crear un entorno virtual

En Windows:

```bash
python -m venv .venv
.venv\\Scripts\\activate
```

En Linux/macOS:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

### Instalar dependencias

```bash
pip install -r requirements.txt
```

### Iniciar la aplicación

Para desarrollo:

```bash
python app.py
```

Después se puede abrir:

```text
http://127.0.0.1:5000
```

Para ejecutar con Gunicorn en un entorno tipo Linux:

```bash
gunicorn app:app
```

## 4. ¿Cómo se despliega en GitHub + Render?

El proyecto está preparado para publicarse mediante un repositorio GitHub y un servicio web de Render.

### Paso 1. Crear el repositorio

1. Crear un repositorio nuevo en GitHub.
2. Subir el contenido de la carpeta `app` manteniendo la estructura de directorios.
3. Verificar que estén incluidos `requirements.txt`, `Procfile`, `render.yaml`, `app.py`, `templates/`, `static/` y `models/`.

Ejemplo de comandos:

```bash
git init
git add .
git commit -m "Primera versión de SolarLab"
git branch -M main
git remote add origin URL_DEL_REPOSITORIO
git push -u origin main
```

### Paso 2. Crear el servicio web

En Render se selecciona la opción para crear un **Web Service** y se conecta el repositorio de GitHub.

Configuración equivalente:

- Runtime: `Python`
- Build Command: `pip install -r requirements.txt`
- Start Command: `gunicorn app:app`

El archivo `render.yaml` deja documentada esta configuración para facilitar el despliegue.

### Paso 3. Esperar la construcción

Render instala las dependencias indicadas en `requirements.txt`, inicia Gunicorn y ejecuta el objeto `app` definido en `app.py`.

Al finalizar, Render asigna una dirección web pública. Esa dirección es la que se utiliza para acceder a la aplicación desplegada.

### Paso 4. Comprobar la aplicación

Después del despliegue se deben verificar al menos estas funciones:

1. La página principal carga correctamente.
2. Aparecen los modelos disponibles.
3. Los dos mapas muestran los puntos.
4. Se pueden cambiar los modelos A y B.
5. Las métricas y matrices de confusión se actualizan.
6. Una consulta por coordenadas devuelve resultados.
7. El formulario de carga acepta los archivos requeridos.

## 5. Formato esperado de un modelo

Cada modelo utiliza un archivo de metadatos `.json` y un archivo de predicciones `.csv`. El pipeline `.joblib` es opcional.

El JSON debe incluir, como mínimo, los campos utilizados por la API:

```text
id
dataset
modelo
escalador
reductor
n_clases
metricas
matriz_confusion
rangos_irradiancia
```

El CSV debe contener estas columnas:

```text
latitude
longitude
value
clase_real
clase_pred
```

## 6. API disponible

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/models` | Devuelve los modelos registrados y sus métricas. |
| POST | `/api/models` | Guarda metadatos, predicciones y un pipeline opcional. |
| DELETE | `/api/models/<id>` | Elimina los archivos asociados al modelo. |
| GET | `/api/models/<id>/points` | Devuelve los puntos y límites espaciales para dibujar el mapa. |
| GET | `/api/models/<id>/joblib` | Permite descargar el pipeline almacenado. |
| POST | `/api/clasificar` | Recibe `model_id`, `lat` y `lon` y devuelve la clasificación del punto más cercano. |

## 7. Flujo de uso de la aplicación

1. Se inicia la aplicación.
2. El frontend solicita `/api/models`.
3. Los modelos disponibles se cargan en los selectores A y B.
4. Para cada modelo se consultan sus puntos mediante `/points`.
5. Los puntos se dibujan en los dos mapas.
6. Las métricas y matrices se toman de los metadatos del modelo.
7. Al hacer clic en un mapa o introducir coordenadas, el navegador envía una petición a `/api/clasificar`.
8. El servidor busca el punto de la malla más cercano y devuelve la información de clasificación.
9. El resultado se presenta para A y B, permitiendo observar si coinciden o presentan una clasificación diferente.

## 8. Tecnologías

- Python
- Flask
- NumPy
- Pandas
- Scikit-learn
- Gunicorn
- HTML5
- CSS3
- JavaScript
- Bootstrap 5
- Bootstrap Icons

## 9 🎥 Video de demostración

En el siguiente video se muestra el funcionamiento de la aplicación:

[Ver video de demostración en YouTube](https://youtu.be/GCfedvqRWCg)


