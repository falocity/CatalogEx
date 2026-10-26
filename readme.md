A TypeScript service for storing and searching geospatial product metadata.
It supports creating, listing, retrieving, updating, and deleting products, plus
numeric, equality, and spatial searches. PostgreSQL stores the metadata; PostGIS
stores and queries the product footprints.
Architecture
The service uses Fastify, TypeBox, Drizzle ORM, and the pg connection pool.
Routes validate request structure, operation handlers coordinate each request,
and the repository executes database queries.
Location Responsibility
src/server.ts Starts the HTTP server.
src/app.ts Builds the app, registers routes and shared hooks, and closes the pool on app shutdown.
src/modules/products/products.routes.ts Registers product endpoints and their schemas.
src/modules/products/operations/ Handles requests and sends HTTP responses.
src/modules/products/schemas/ Defines request, response, and filter schemas.
src/modules/products/product.validation.ts Checks zoom order, ring closure, and consistent coordinate dimensions.
src/modules/products/products.repository.ts Reads and writes products, converts geometry to/from GeoJSON, and checks search geometry validity.
src/modules/products/product-search.filters.ts Builds parameterized search conditions.
src/db/ and drizzle/ Define the database connection, table schema, and versioned migrations.
src/error-handler.ts Converts application and recognized database errors into API responses.
openapi.yaml Defines the API contract, schemas, and examples.

Prerequisites

- Node.js 22.x with npm.
- Docker Engine or Docker Desktop, with Docker Compose v2 (docker compose).
- PostgreSQL 17 with PostGIS 3.5. The supplied Compose file runs both using
  postgis/postgis:17-3.5; a separate host installation is unnecessary.
  Environment variables
  Copy .env.example to .env and fill in all four variables:
  Variable Used by Purpose
  POSTGRES_DB Compose database container Database name created on first initialization.
  POSTGRES_USER Compose database container Database user created on first initialization.
  POSTGRES_PASSWORD Compose database container Password for that user.
  DATABASE_URL Application, Drizzle CLI, and tests PostgreSQL connection string matching the database settings.

Example for local development; replace the password in both places:
POSTGRES_DB=catalog
POSTGRES_USER=catalog
POSTGRES_PASSWORD=replace_me
DATABASE_URL=postgresql://catalog:replace_me@127.0.0.1:5436/catalog
Keep .env private; it is ignored by Git. Percent-encode reserved characters in
the username or password when placing them in DATABASE_URL.

The database is exposed on 127.0.0.1:5436, mapped to port 5432 inside the
container. If you change that mapping in compose.yaml, update DATABASE_URL
too. The API currently listens on 127.0.0.1:3000, configured in src/server.ts.
Local setup
Run these steps from the repository root, on the branch you want to run.

1. Install dependencies
   npm ci
2. Configure the environment
   cp -n .env.example .env
   This keeps an existing .env unchanged. Edit .env using the example above
   before continuing.
3. Start PostgreSQL and PostGIS
   docker compose up -d --wait db
   Compose starts the database only; the Node.js application runs on your host.
   The named volume preserves database data between container restarts. The
   POSTGRES\_\* initialization settings apply when that volume is first created;
   editing .env later does not change an existing database user's password.
4. Apply the committed migrations
   npm run db:migrate
   The migrations enable PostGIS and create the product table, enums, checks, and
   spatial index. Run this command again after pulling new migrations. You do not
   need to generate migrations during normal setup.
5. Start the development server
   npm run dev
   The server reloads on source changes. Check it from another terminal:
   curl -i http://127.0.0.1:3000/health
   Expected: 200 OK and {"status":"ok"}. This endpoint checks that the HTTP
   application responds; it does not check database availability.
6. Run tests
   With the database running and migrations applied:
   npm test
   This runs both integration suites: database geometry round trips and Point
   rejection, plus the API CRUD lifecycle and numeric search test. The API
   test uses Fastify inject(), so a separately running HTTP server is unnecessary.

Both suites use DATABASE_URL; run them against a development or test database.
Database tests roll back their inserts. The API test creates a uniquely named
product and attempts to clean it up after success or failure.

To run a suite separately:
npm run test:db
npm run test:api
Build and database changes
npm run typecheck
npm run build
npm start
The compiled entry point is dist/src/server.js. npm start uses the same
environment variables as development.

After intentionally changing src/db/schema.ts, generate and review a migration:
npm run db:generate
npm run db:migrate
Commit the generated SQL and Drizzle metadata with the schema change.

To stop the local database while keeping its data:
docker compose down
API usage
Base URL: http://127.0.0.1:3000. Send POST and PATCH bodies as JSON with
Content-Type: application/json. See [openapi.yaml](./openapi.yaml) for the full
contract.
Method Path Result
POST /products Creates a product; returns 201, the product, and a Location header.
GET /products Returns a page of products.
GET /products/{id} Returns one product, or 404 if missing.
PATCH /products/{id} Updates supplied fields and returns the product.
DELETE /products/{id} Deletes a product; returns 204 with no body.
POST /products/search Returns a page matching all supplied conditions.

Footprints are GeoJSON Polygon or MultiPolygon geometries using WGS84
longitude/latitude (SRID 4326), with optional height. Rings must be closed and
positions must consistently use two or three coordinates. Product UUIDs are
generated by PostgreSQL.
Create
curl -i -X POST http://127.0.0.1:3000/products \
 -H 'Content-Type: application/json' \
 --data-binary @- <<'JSON'
{
"name": "Example raster",
"boundingPolygon": {
"type": "Polygon",
"coordinates": [[[34,31],[35,31],[35,32],[34,32],[34,31]]]
},
"consumptionLink": "https://example.com/wmts",
"productType": "raster",
"consumptionProtocol": "WMTS",
"resolutionBest": 0.5,
"minZoom": 1,
"maxZoom": 18
}
JSON
Copy the returned id into this shell variable for the examples below:
PRODUCT_ID='paste-the-returned-uuid-here'
List and retrieve
curl -i 'http://127.0.0.1:3000/products?limit=20&offset=0'
curl -i "http://127.0.0.1:3000/products/$PRODUCT_ID"
List and search return { "items": [...], "limit": 20, "offset": 0, "hasMore": false }.
The default limit is 20 (allowed 1–100); offset defaults to 0. Results are ordered
by UUID ascending, not creation time. If hasMore is true, request the next page
with offset + limit. No matches return an empty items array.
Search
curl -i -X POST 'http://127.0.0.1:3000/products/search?limit=20&offset=0' \
 -H 'Content-Type: application/json' \
 -d '{"equal":{"productType":"raster"},"less":{"resolutionBest":1}}'
The current numeric operators are greater, greaterEqual, less, and
lessEqual. equal supports non-geometry fields. Conditions are combined with
AND. Numeric search thresholds do not inherit the minimum bounds for stored
product values. An empty body {} returns an unfiltered page; a supplied
operator must contain at least one field.

Spatial search example:
curl -i -X POST http://127.0.0.1:3000/products/search \
 -H 'Content-Type: application/json' \
 -d '{"intersects":{"boundingPolygon":{"type":"Polygon","coordinates":[[[34.2,31.2],[34.8,31.2],[34.8,31.8],[34.2,31.8],[34.2,31.2]]]}}}'
contains means the product footprint contains the supplied geometry; within
means the product footprint is inside it. intersects includes touching
boundaries. These spatial comparisons use longitude/latitude and ignore height.
Update and delete
curl -i -X PATCH "http://127.0.0.1:3000/products/$PRODUCT_ID" \
 -H 'Content-Type: application/json' \
 -d '{"description":"Updated description"}'

curl -i -X DELETE "http://127.0.0.1:3000/products/$PRODUCT_ID"
PATCH preserves omitted fields and requires at least one editable field. A
supplied geometry replaces the entire footprint. The resulting product must
satisfy minZoom <= maxZoom.

Errors use { "code": "...", "message": "...", "field": "..." }; field is
optional. Invalid input returns 400, and a missing product returns 404.
