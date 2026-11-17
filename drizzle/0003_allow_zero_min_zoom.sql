ALTER TABLE "products" DROP CONSTRAINT "products_min_zoom_positive";--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_min_zoom_nonnegative" CHECK ("products"."min_zoom" >= 0);