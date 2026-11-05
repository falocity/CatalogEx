CREATE TYPE "public"."consumption_protocol" AS ENUM('WMS', 'WMTS', 'XYZ', '3D Tiles');--> statement-breakpoint
CREATE TYPE "public"."product_type" AS ENUM('raster', 'rasterized vector', '3d tiles', 'QMesh');--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(48) NOT NULL,
	"description" text,
	"bounding_polygon" geometry NOT NULL,
	"consumption_link" text NOT NULL,
	"product_type" "product_type" NOT NULL,
	"consumption_protocol" "consumption_protocol" NOT NULL,
	"resolution_best" double precision NOT NULL,
	"min_zoom" integer NOT NULL,
	"max_zoom" integer NOT NULL,
	CONSTRAINT "products_name_nonempty" CHECK (char_length("products"."name") >= 1),
	CONSTRAINT "products_description_nonempty" CHECK (char_length("products"."description") >= 1),
	CONSTRAINT "products_resolution_valid" CHECK (
        "products"."resolution_best" >= 0
        AND "products"."resolution_best" < 'Infinity'::double precision
      ),
	CONSTRAINT "products_min_zoom_positive" CHECK ("products"."min_zoom" > 0),
	CONSTRAINT "products_max_zoom_positive" CHECK ("products"."max_zoom" > 0),
	CONSTRAINT "products_bounding_polygon_type" CHECK (
        GeometryType("products"."bounding_polygon")
        IN ('POLYGON', 'MULTIPOLYGON')
      ),
	CONSTRAINT "products_bounding_polygon_srid" CHECK (ST_SRID("products"."bounding_polygon") = 4326),
	CONSTRAINT "products_bounding_polygon_dimensions_by_code(xy,xyz)" CHECK (ST_Zmflag("products"."bounding_polygon") IN (0, 2)),
	CONSTRAINT "products_bounding_polygon_valid" CHECK (
        NOT ST_IsEmpty("products"."bounding_polygon")
        AND ST_IsValid("products"."bounding_polygon")
      )
);
--> statement-breakpoint
CREATE INDEX "products_bounding_polygon_gist" ON "products" USING gist ("bounding_polygon");