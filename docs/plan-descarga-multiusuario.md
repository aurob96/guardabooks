# Plan de descarga y multiusuario

## Objetivo

Convertir Biblioteca personal en una aplicacion que diferentes usuarios puedan instalar y usar sin cambiar URLs ni compartir datos por accidente.

## Version 2.1.0 - base movil

- Usar una sola URL para web y API mediante `/api`.
- Permitir acceso desde celular en la misma red local.
- Mantener manifest y service worker para instalacion como PWA.
- Mostrar accion de instalacion cuando el navegador la ofrece.

## Fase 1 - publicacion estable

- Publicar web y API bajo un dominio HTTPS unico, por ejemplo `biblioteca.tudominio.com`.
- Mantener la API detras de `/api` para que la app instalada conserve la misma direccion.
- Configurar backups de PostgreSQL y almacenamiento persistente de portadas.
- Agregar healthchecks publicos y monitoreo basico.

Guia operativa: [publicacion-estable.md](publicacion-estable.md).

## Fase 2 - cuentas y separacion de datos

- Crear registro e inicio de sesion con JWT.
- Asociar libros, estanterias, generos, etiquetas y prestamos a un `userId` o `libraryId`.
- Agregar roles: propietario, editor y lector.
- Migrar datos existentes a una biblioteca inicial.
- Probar que un usuario no pueda consultar ni modificar datos de otro.

Implementacion inicial: [fase-2-multiusuarios.md](fase-2-multiusuarios.md).

## Fase 3 - instalacion para usuarios

- PWA publica como canal principal: instalar desde navegador en Android, iOS y escritorio.
- Definir iconos, nombre corto, capturas y pagina de bienvenida para instalacion.
- Revisar funcionamiento offline: catalogo en lectura, cola de cambios y sincronizacion posterior.
- Evaluar empaquetado con Capacitor solo si se necesitan tiendas, notificaciones nativas o camara con permisos mas controlados.

## Fase 4 - operacion

- Panel de administracion para bibliotecas y usuarios.
- Recuperacion de contrasena y rotacion de sesiones.
- Exportacion e importacion de datos por biblioteca.
- Politica de privacidad y terminos si la app se comparte fuera del hogar.
