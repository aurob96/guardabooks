# QA de regresion

## Automatizado

Ejecuta contra una instancia de prueba o produccion con datos descartables:

```bash
E2E_API_URL=https://app.guardabooks.com/api node scripts/e2e-api-regression.mjs
```

El script crea usuarios, una biblioteca de prueba, generos, estanterias, repisas, libros y prestamos con nombres `QA`. Tambien valida aislamiento entre bibliotecas y permisos de lector. Al final elimina los datos principales creados, aunque las cuentas de prueba quedan registradas.

## Happy paths

- Crear cuenta propietaria y entrar.
- Iniciar sesion con cuenta existente.
- Cambiar entre bibliotecas cuando el usuario pertenece a mas de una.
- Crear genero y subgenero.
- Crear estanteria con genero asociado.
- Crear repisa con capacidad y genero asociado.
- Crear libro manual con autor, editorial, genero, repisa y tejuelo.
- Editar libro existente.
- Detectar duplicado por titulo y autor.
- Prestar libro.
- Devolver prestamo.
- Reordenar libros en una repisa.
- Abrir vista de estanterias y localizar libro.
- Generar e imprimir tejuelo.
- Agregar usuario como lector, editor y propietario.
- Usuario lector consulta catalogo compartido.
- Usuario editor crea o edita libros.
- Instalar PWA desde navegador compatible.

## No happy paths

- Login con contrasena incorrecta.
- Registro con correo repetido.
- Contraseña menor a 8 caracteres.
- Acceder a `/api/books` sin token.
- Crear libro con titulo vacio.
- Crear libro con ISBN invalido.
- Crear libro en repisa llena.
- Editar o eliminar libro de otra biblioteca.
- Crear prestamo para libro ya prestado.
- Devolver prestamo inexistente.
- Reordenar repisa con libro de otra repisa.
- Lector intenta crear, editar o eliminar.
- Propietario intenta quitar el ultimo propietario.
- Agregar miembro que aun no tiene cuenta.
- Cambiar a una biblioteca donde el usuario no es miembro.
- Usar app instalada sin conexion al servidor.

## Validaciones manuales recomendadas

- Camara movil: escaneo ISBN requiere HTTPS y permisos de camara.
- PWA iOS: instalar desde compartir > agregar a pantalla de inicio.
- PWA Android/Chrome: boton `Instalar`.
- Impresion de tejuelos: revisar vista previa PDF.
- Mapa en movil: confirmar que no haya solapamientos.
- Backups: crear backup y verificar que aparezca en `backups/`.
- Healthcheck publico: `https://app.guardabooks.com/api/health`.
