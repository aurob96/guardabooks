# Publicacion estable - Fase 1

## Objetivo

Publicar Biblioteca personal bajo un dominio HTTPS unico, manteniendo la API detras de `/api` para que la PWA instalada conserve la misma direccion en computador y celular.

## Arquitectura recomendada

- Dominio: `biblioteca.tudominio.com`.
- Caddy: recibe HTTP/HTTPS, obtiene certificados y renueva HTTPS automaticamente.
- Web: contenedor Nginx con la app React construida como PWA.
- API: contenedor Node/Express en `api:4000`.
- Base de datos: PostgreSQL remoto, por ejemplo Neon.
- Portadas: carpeta persistente `storage/covers` en el servidor.
- Backups: `pg_dump` periodico desde `scripts/backup-postgres.sh`.

## Preparar servidor

1. Contrata o prepara un servidor Linux con Docker y Docker Compose.
2. Apunta el DNS del dominio al servidor:

```text
biblioteca.tudominio.com -> IP_PUBLICA_DEL_SERVIDOR
```

3. Abre los puertos publicos `80` y `443`.
4. Copia el proyecto al servidor.

Caddy necesita que el dominio apunte al servidor y que los puertos `80` y `443` esten accesibles para emitir y renovar HTTPS automaticamente.

## Configurar produccion

En el servidor:

```bash
cd /ruta/a/Biblioteca
cp .env.production.example .env.production
```

Edita `.env.production`:

```env
APP_DOMAIN=biblioteca.tudominio.com
DATABASE_URL=postgresql://usuario:password@host/database?sslmode=require
JWT_SECRET=una-clave-larga-y-segura
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-6
```

No uses `localhost` en `DATABASE_URL` para produccion. La base debe ser accesible desde el servidor.

## Levantar la aplicacion

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

Ver estado:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

Ver logs:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f
```

## Verificaciones

Abre:

```text
https://biblioteca.tudominio.com
https://biblioteca.tudominio.com/api/health
```

La primera URL debe mostrar la app. La segunda debe responder el estado de la API.

## Backups

Crear backup manual:

```bash
ENV_FILE=.env.production ./scripts/backup-postgres.sh
```

Si tu proveedor usa otra version de PostgreSQL, puedes elegir la imagen de herramientas:

```bash
POSTGRES_BACKUP_IMAGE=postgres:18 ENV_FILE=.env.production ./scripts/backup-postgres.sh
```

Restaurar un backup:

```bash
ENV_FILE=.env.production ./scripts/restore-postgres.sh backups/biblioteca-YYYYMMDD-HHMMSS.dump
```

Para automatizarlo, agrega una tarea diaria en cron:

```cron
15 3 * * * cd /ruta/a/Biblioteca && ENV_FILE=.env.production ./scripts/backup-postgres.sh >> backups/backup.log 2>&1
```

## Portadas

Las portadas locales se guardan en:

```text
storage/covers
```

Esa carpeta debe permanecer en el servidor y debe incluirse en la estrategia de backup si empiezas a subir portadas propias.

## Monitoreo basico

Configura un monitor externo que revise:

```text
https://biblioteca.tudominio.com/api/health
```

Con una frecuencia de 1 a 5 minutos es suficiente para esta fase. Si falla, revisa logs con:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=100 api caddy
```
