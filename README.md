# Sofre Digital Node Test

App de prueba para validar el deploy automático de proyectos **Node.js + PostgreSQL**.

Muestra un dashboard con info del deploy (versión, commit, host/contenedor, uptime), el estado de la conexión a Postgres, un contador de visitas y un muro de mensajes persistidos en la base.

## Stack

- Node.js 20+ / Express 5
- PostgreSQL (driver `pg`)
- Frontend estático (HTML + CSS + JS, sin build)

## Variables de entorno

| Variable | Default | Descripción |
|---|---|---|
| `PORT` | `3000` | Puerto HTTP |
| `DATABASE_URL` | — | URL de conexión (`postgres://user:pass@host:5432/db`) |
| `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` | — | Alternativa a `DATABASE_URL` |
| `DATABASE_SSL` | `false` | `true` para conectar con SSL |
| `APP_ENV` | `NODE_ENV` | Nombre del entorno que muestra la UI |
| `GIT_COMMIT` | — | Hash del commit deployado (opcional) |
| `DEPLOYED_AT` | — | Fecha ISO del deploy (opcional) |

Las tablas se crean solas al arrancar (`CREATE TABLE IF NOT EXISTS`). La app reintenta la conexión a la base durante ~30 s antes de fallar.

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/` | Dashboard |
| GET | `/health` | Liveness (200 si el proceso vive) |
| GET | `/ready` | Readiness (200 si la base responde, 503 si no) |
| GET | `/api/info` | Info de la app y de la base |
| POST | `/api/visits` | Incrementa y devuelve el contador |
| GET | `/api/messages` | Últimos 50 mensajes |
| POST | `/api/messages` | Crea un mensaje `{ "author", "content" }` |

## Correr con Docker (app + Postgres)

```bash
docker compose up -d --build
```

Abrir http://localhost:3000

### Detrás de un antivirus/proxy con inspección TLS (ej. Kaspersky)

Si `npm` falla con `SELF_SIGNED_CERT_IN_CHAIN`, pasar el certificado raíz como build secret (no queda en la imagen). En esta máquina está en `.certs/kaspersky-ca.pem` (ignorado por git):

```bash
docker build --secret id=npm_ca,src=.certs/kaspersky-ca.pem -t sofre-digital-node-test .
docker compose up -d
```

## Correr solo la imagen (Postgres externo)

```bash
docker build -t sofre-digital-node-test .
docker run -d -p 3000:3000 \
  -e DATABASE_URL=postgres://user:pass@host:5432/db \
  -e GIT_COMMIT=$(git rev-parse HEAD) \
  -e DEPLOYED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ) \
  sofre-digital-node-test
```

## Correr local sin Docker

```bash
npm install
cp .env.example .env   # ajustar valores
node --env-file=.env src/server.js
```
