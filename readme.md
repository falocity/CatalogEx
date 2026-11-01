# CatalogEx

CatalogEx stores geospatial product metadata and searches product footprints. It provides product CRUD operations, paginated listing, and equality, numeric, and spatial search.

## Architecture

The HTTP API uses Fastify and TypeBox for routes and request validation. Product controllers handle HTTP responses, services apply product rules, and repositories use Drizzle to query PostgreSQL. PostGIS stores and searches Polygon and MultiPolygon footprints. `openapi.yaml` defines the API contract.

Configuration comes from `config/default.json` with environment overrides. The application container creates and shares dependencies within one application instance. `/health/live` checks that the HTTP service responds; `/health/ready` checks the database.

## Requirements

- Node.js 24 and npm (`.nvmrc` specifies the major version).
- Docker and Docker Compose v2 for the supplied local database.
- PostgreSQL 17 with PostGIS 3.5, provided by `compose.yaml`.

## Local setup

1. Install dependencies:

   ```bash
   npm ci
   ```

2. Create a private environment file:

   ```bash
   cp .env.example .env
   ```

   Set a nonempty `POSTGRES_PASSWORD` in `.env`. Do not commit this file. The example publishes PostgreSQL on `127.0.0.1:5436`; change `POSTGRES_PORT` if that host port is occupied. The database container uses `POSTGRES_CONTAINER_PORT` internally.

   `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_PORT` configure the local database connection. `POSTGRES_BIND_HOST` controls where its port is published. `APP_BIND_HOST` and `PORT` control the Compose application's published address and port. Other defaults, including pool size and timeouts, are in `config/default.json`; see `src/common/config.schema.ts` for their environment override names.

3. Start PostgreSQL/PostGIS and apply migrations:

   ```bash
   docker compose up -d --wait db
   npm run db:migrate
   ```

4. Start the API:

   ```bash
   npm run dev
   ```

   It listens on `127.0.0.1:8080` by default. If that port is occupied, start it with `PORT=18080 npm run dev` and use port 18080 in the examples below.

5. Check the service and run the tests:

   ```bash
   curl -i http://127.0.0.1:8080/health/live
   curl -i http://127.0.0.1:8080/health/ready
   npm run typecheck
   npm run build
   npm test
   ```

   Tests include unit and database-backed integration cases. Run migrations before the integration tests. For a clean database, use a separate test database and apply the same migrations there.

To stop the local database while retaining its data, run `docker compose down`. Changing the database initialization credentials in `.env` does not update credentials already stored in an existing Docker volume.

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
