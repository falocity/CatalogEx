# CatalogEx

CatalogEx stores geospatial product metadata and searches product footprints. It provides product CRUD operations, paginated listing, and equality, numeric, and spatial search.

## Architecture

The HTTP API uses Fastify and TypeBox for routes and request validation. Product controllers handle HTTP responses, services apply product rules, and repositories use Drizzle to query PostgreSQL. PostGIS stores and searches Polygon and MultiPolygon footprints. `openapi.yaml` defines the API contract.

Configuration comes from `config/default.json` with environment overrides. The application container creates and shares dependencies within one application instance. `/liveness` checks that the HTTP service responds; `/readiness` checks the database.

## Requirements

- Node.js 24 and npm (`.nvmrc` specifies the Node version).
- PostgreSQL 17 with PostGIS 3.5. Docker is optional if you run the database locally.

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
       "user": "catalogAdmin",
       "password": "your-private-password"
     }
   }
   ```

   Adjust the values to match your database. This file is ignored by Git. Shared, non-secret settings live in `config/default.json`; `src/common/config.schema.ts` defines the configuration and supported environment overrides. Do not put passwords in `default.json`.

4. Apply migrations and start the API:

   ```bash
   npm run db:migrate
   npm run dev
   ```

   The API listens on `127.0.0.1:8080` by default. If that port is occupied, use `PORT=18080 npm run dev`.

5. Check the service and run the project checks:

   ```bash
   curl -i http://127.0.0.1:8080/liveness
   curl -i http://127.0.0.1:8080/readiness
   npm run typecheck
   npm run build
   npm test
   ```

   Integration tests need a migrated PostgreSQL/PostGIS database. A separate test database is recommended.

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
