# Guion demo de 1 minuto: Biblioteca + IA

Pregunta: Describe algo que hayas construido o automatizado usando IA. ¿Como lo hiciste? Mostralo en pantalla.

## Guion narrado

Construí Biblioteca, una aplicación personal para organizar libros físicos en casa, y usé IA para automatizar una de las partes más tediosas: clasificar cada libro.

Antes, para registrar un libro había que buscar datos, decidir género, escribir etiquetas, ubicarlo en una repisa y crear el tejuelo manualmente. En esta app el usuario puede escanear un ISBN o buscar un libro por título; la aplicación trae metadatos públicos y luego usa IA para sugerir clasificación Dewey, clasificación LC, género, subgénero y etiquetas.

Lo hice conectando el frontend en React con una API propia. La API consulta fuentes como Open Library o Google Books, normaliza los datos y, cuando hay suficiente información del libro, manda título, autores, sinopsis y temas a un asistente de IA para recibir una clasificación editable.

En pantalla se ve el catálogo de mi biblioteca, con filtros por género y estantería. Si abro “Crear nuevo libro”, puedo buscar o ingresar un libro, pedir “Sugerir con IA”, revisar la clasificación propuesta, elegir la repisa física y generar el tejuelo antes de guardarlo.

El resultado es que registrar un libro deja de ser un proceso manual y repetitivo, y se convierte en un flujo guiado que ayuda a mantener ordenada una biblioteca real.

## Qué mostrar en pantalla

1. Catálogo principal con varios libros.
2. Barra de búsqueda y filtros por género/estantería.
3. Herramientas > Crear nuevo libro.
4. Formulario de libro con botón “Clasificar con IA” o “Sugerir con IA”.
5. Campos Dewey, LC, etiquetas, ubicación y tejuelo.
6. Volver al catálogo y mostrar el libro ya organizado.

## Versión aún más corta

Construí una app llamada Biblioteca para organizar libros físicos en casa. Usé IA para automatizar la clasificación de cada libro: la app toma datos como título, autor, sinopsis o ISBN, consulta fuentes públicas y luego sugiere Dewey, LC, género, subgénero y etiquetas.

Lo hice con un frontend en React y una API propia que conecta la búsqueda de metadatos con un asistente de IA. La sugerencia no se guarda automáticamente: aparece en pantalla para revisarla y editarla.

En el demo se ve el catálogo, el flujo para crear un libro, la opción de clasificar con IA, la ubicación en estantería y la generación del tejuelo. Así automaticé una tarea repetitiva y convertí el registro de libros en un proceso rápido y guiado.
