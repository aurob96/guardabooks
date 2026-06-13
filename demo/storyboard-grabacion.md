# Storyboard de grabacion

## Preparacion

Usa una ventana de navegador de 1280 x 720 o 1440 x 900. Mantener el zoom en 100%.

Para este demo local sin Docker:

```bash
node demo/mock-api.mjs
cd apps/web
npm_config_cache=../../.npm-cache VITE_API_URL=http://127.0.0.1:4000/api npm run dev -- --host 127.0.0.1 --port 5173
```

Abre `http://127.0.0.1:5173`.

Nota: `mock-api.mjs` es solo para grabar el demo sin Docker. La aplicacion real puede levantarse con `docker compose up --build` cuando Docker este disponible.

## Toma 1: Apertura

Pantalla: catalogo principal.

Accion: dejar la pantalla quieta 3 segundos, mostrando el titulo "Catalogo de casa" y las tarjetas de libros.

Narracion: "Hola, en este demo voy a presentar Biblioteca..."

## Toma 2: Busqueda y filtros

Pantalla: catalogo.

Accion: escribir `platon` en la busqueda, borrar, cambiar vista de cuadricula a lista y volver a cuadricula.

Narracion: "Desde la parte superior puedo buscar por titulo, autor, ISBN..."

## Toma 3: Gestion fisica

Pantalla: Herramientas > Gestion de estanterias.

Accion: abrir Herramientas, entrar a Gestion de estanterias, mostrar las secciones Estanterias, Repisas, Generos y Subgeneros.

Narracion: "Aqui se configura la estructura fisica..."

## Toma 4: Crear libro

Pantalla: Herramientas > Crear nuevo libro.

Accion: abrir el panel de nuevo libro, mostrar escaneo, ISBN, busqueda sin ISBN y el formulario manual.

Campos sugeridos:

- Titulo: `El nombre de la rosa`
- Autor: `Umberto Eco`
- Ano: `1980`
- Editorial: `Lumen`
- Genero libre: `Literatura`

Narracion: "La aplicacion permite cuatro formas de ingreso..."

## Toma 5: Clasificacion y ubicacion

Pantalla: panel de agregar libro.

Accion: pulsar "Sugerir con IA", mostrar Dewey/LC, elegir estanteria y repisa.

Narracion: "La aplicacion tambien puede sugerir clasificacion con IA..."

## Toma 6: Tejuelo

Pantalla: seccion de tejuelo dentro del panel de agregar libro.

Accion: mostrar vista previa del tejuelo y guardar el libro.

Narracion: "El ultimo paso es generar el tejuelo..."

## Toma 7: Prestamo

Pantalla: catalogo.

Accion: pulsar Prestar en una tarjeta y mostrar el formulario de prestamo. No es necesario guardar si no se quiere modificar el demo.

Narracion: "Desde una tarjeta del catalogo puedo registrar un prestamo..."

## Toma 8: Cierre

Pantalla: catalogo con varios libros.

Accion: dejar la pantalla quieta 3 segundos.

Narracion: "En resumen, Biblioteca une catalogo, ubicacion fisica, clasificacion, tejuelos y prestamos..."
