# CatalogEx

CatalogEx stores geospatial product metadata and searches product footprints. It provides product CRUD operations, paginated listing, and equality, numeric, and spatial search.

## Architecture

The HTTP API uses Fastify and TypeBox for routes and request validation. Product controllers handle HTTP responses, services apply product rules, and repositories use Drizzle to query PostgreSQL. PostGIS stores and searches Polygon and MultiPolygon footprints. `openapi.yaml` defines the API contract.

Configuration comes from `config/default.json`, private local configuration, and environment overrides. Configuration is validated using `vectorCatalogexV1` from `@map-colonies/schemas`, which references the common database and telemetry schemas.

The application container creates and shares dependencies within one application instance. `/liveness` checks that the HTTP service responds; `/readiness` checks the database.

## Requirements

- Node.js 24 and npm (`.nvmrc` specifies the Node version).
- PostgreSQL with PostGIS. The local development database uses PostgreSQL 17 with PostGIS 3.5.
- Docker is optional if you already have a suitable database.

## Local setup

1. Install dependencies:

   ```bash
   npm ci
   ```

2. Start a PostgreSQL/PostGIS database. If you already use a private local `compose.yaml`, you can start its database with:

   ```bash
   docker compose up -d --wait db
   ```

   Compose is a local development option; its file is not included in this repository.

3. Create `config/local.json` with credentials for that database:

   ```json
   {
     "database": {
       "host": "127.0.0.1",
       "port": 5436,
       "database": "catalog",
       "username": "catalogAdmin",
       "password": "your-private-password",
       "ssl": {
         "enabled": false
       }
     }
   }
   ```

   Adjust the values to match your database. This file is ignored by Git. Shared, non-secret settings live in `config/default.json`. The shared configuration schema defines validation and supported environment overrides. Do not put passwords in `default.json`.

4. Apply migrations and start the API:

   ```bash
   npm run db:migrate
   npm run dev
   ```

   The API listens on `127.0.0.1:8080` by default. If that port is occupied, use:

   ```bash
   PORT=18080 npm run dev
   ```

   If the Compose application is already using port 8080, stop only that application before starting the development process:

   ```bash
   docker compose stop app
   ```

5. Check the service and run the project checks:

   ```bash
   curl -i http://127.0.0.1:8080/liveness
   curl -i http://127.0.0.1:8080/readiness
   npm run format
   npm run lint
   npm run typecheck
   npm run build
   npm test
   ```

   Adjust the URLs if you changed the port. Integration tests need a migrated PostgreSQL/PostGIS database. A separate test database is recommended.

## Database configuration

The API and migration process use the same database configuration.

| Environment variable       | Configuration field            |
| -------------------------- | ------------------------------ |
| `DB_HOST`                  | `database.host`                |
| `DB_PORT`                  | `database.port`                |
| `DB_NAME`                  | `database.database`            |
| `DB_USERNAME`              | `database.username`            |
| `DB_PASSWORD`              | `database.password`            |
| `DB_ENABLE_SSL_AUTH`       | `database.ssl.enabled`         |
| `DB_CERT_PATH`             | `database.ssl.cert`            |
| `DB_KEY_PATH`              | `database.ssl.key`             |
| `DB_CA_PATH`               | `database.ssl.ca`              |
| `DB_POOL_MAX`              | `database.maxConnections`      |
| `DB_IDLE_TIMEOUT_MS`       | `database.idleTimeoutMs`       |
| `DB_CONNECTION_TIMEOUT_MS` | `database.connectionTimeoutMs` |

When SSL is enabled, the shared schema requires client certificate and private key paths. A CA path is optional; when omitted, Node.js uses its default trusted CAs. Server certificate verification remains enabled. Password and SSL settings can coexist.

The `POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD` variables used by the PostgreSQL Docker image initialize the database container. Keep those names in the database service; the API and migration containers use the `DB_*` variables above.

## API examples

The examples assume the default port 8080. `POST /products` returns `201`, a generated `{ "id": "..." }`, and a `Location` header.

```bash
curl -i http://127.0.0.1:8080/products \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Example raster",
    "boundingPolygon": {
      "type": "Polygon",
      "coordinates": [[[34,31],[35,31],[35,32],[34,32],[34,31]]]
    },
    "consumptionLink": "https://example.com/wmts",
    "productType": "raster",
    "consumptionProtocol": "WMTS",
    "resolutionBest": 0.5,
    "minZoom": 0,
    "maxZoom": 18
  }'
```

Copy the returned ID for the requests that address one product:

```bash
PRODUCT_ID='paste-returned-id-here'

curl -i 'http://127.0.0.1:8080/products?limit=20&offset=0'
curl -i "http://127.0.0.1:8080/products/$PRODUCT_ID"

curl -i 'http://127.0.0.1:8080/products/search?limit=20&offset=0' \
  -H 'Content-Type: application/json' \
  -d '{"equal":{"productType":"raster"},"less":{"resolutionBest":1}}'

curl -i -X PATCH "http://127.0.0.1:8080/products/$PRODUCT_ID" \
  -H 'Content-Type: application/json' \
  -d '{"description":"Updated description"}'

curl -i -X DELETE "http://127.0.0.1:8080/products/$PRODUCT_ID"
```

Listing and search return `items`, `limit`, `offset`, and `hasMore`. The default limit is 20, with a maximum of 100. Search conditions combine with AND. Spatial search supports `contains`, `within`, and `intersects` against a supplied GeoJSON footprint. See `openapi.yaml` for the full request and response contract.

## Database changes

After changing `src/db/schema.ts`, run `npm run db:generate`, review the generated SQL, and commit the SQL and Drizzle metadata together. Apply committed migrations with `npm run db:migrate`.

## Container images

Build the API and migration images from the same revision:

```bash
docker build -t catalogex-service .
docker build -f migrations.Dockerfile -t catalogex-migrations .
```

Run the migration image as a one-off job before starting or updating the API. Both images take the same `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, and `DB_PASSWORD` settings at runtime, along with SSL settings when enabled.

Use a database hostname reachable from the containers. For example, replace the network and private env file below with your own values:

```bash
docker run --rm \
  --network catalogex-db-network \
  --env-file "$HOME/.config/catalogex/postgres.env" \
  catalogex-migrations &&
docker run --rm \
  --network catalogex-db-network \
  --env-file "$HOME/.config/catalogex/postgres.env" \
  -p 8080:8080 \
  catalogex-service
```

The private env file must use the API's `DB_*` connection variables. When SSL is enabled, mount the certificate files into both containers and use their container paths in the corresponding environment variables.

Start the service image after the migration exits successfully. Only the migration image contains the SQL migration files.
