# Fase 2 - cuentas y separacion de datos

## Que incluye la version 2.2.0

- Registro e inicio de sesion con JWT.
- Sesiones guardadas en el navegador para la PWA instalada.
- Modelo de `User`, `Library` y `LibraryMember`.
- Roles base: `OWNER`, `EDITOR` y `READER`.
- Aislamiento por biblioteca para libros, estanterias, generos, subgeneros y prestamos.
- Panel de miembros para propietarios.
- Migracion automatica de datos existentes a una biblioteca inicial.

## Migracion de datos existentes

Al arrancar la API, la app crea una biblioteca inicial si aun no existe y asigna a esa biblioteca los libros, generos y estanterias que todavia no tengan `libraryId`.

El primer usuario que se registre queda como `OWNER` de esa biblioteca inicial. Asi conserva el catalogo existente sin tener que mover datos a mano.

Los siguientes usuarios que se registren crean su propia biblioteca. Para que vean la biblioteca principal, un propietario debe agregarlos desde `Herramientas > Usuarios de la biblioteca`.

## Roles

- `OWNER`: administra libros, estanterias, generos, prestamos y miembros.
- `EDITOR`: administra libros, estanterias, generos y prestamos.
- `READER`: puede consultar la biblioteca, pero no modificarla.

## Despliegue

Antes de actualizar produccion, haz backup:

```bash
cd ~/Biblioteca
ENV_FILE=.env.production ./scripts/backup-postgres.sh
```

Luego sube la nueva version al servidor y ejecuta:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

Despues abre `https://app.guardabooks.com`, crea la primera cuenta y verifica que aparezcan los libros existentes.

## Pruebas recomendadas

- Crear primera cuenta y confirmar que ve los libros existentes.
- Crear segunda cuenta y confirmar que empieza con una biblioteca vacia.
- Desde la primera cuenta, agregar la segunda como `READER`.
- Confirmar que `READER` puede ver libros pero no crear, editar ni eliminar.
- Cambiar el rol a `EDITOR` y confirmar que puede crear un libro.
- Quitar el miembro y confirmar que ya no puede acceder a esa biblioteca.
