import {
  TypeBoxValidatorCompiler,
  type FastifyPluginAsyncTypebox,
} from "@fastify/type-provider-typebox";
import type { ProductsController } from "./products.controller.js";
import { productRouteSchemas } from "./schemas/product-routes.schema.js";

interface ProductsRoutesOptions {
  controller: ProductsController;
}

export const productsRoutes: FastifyPluginAsyncTypebox<
  ProductsRoutesOptions
> = async (app, { controller }) => {
  app.setValidatorCompiler(TypeBoxValidatorCompiler);

  app.post(
    "/products",
    { schema: productRouteSchemas.create },
    controller.createProductHandler,
  );

  app.get(
    "/products/:id",
    { schema: productRouteSchemas.getById },
    controller.getProductByIdHandler,
  );

  app.get(
    "/products",
    { schema: productRouteSchemas.list },
    controller.listProductsHandler,
  );

  app.patch(
    "/products/:id",
    { schema: productRouteSchemas.update },
    controller.updateProductHandler,
  );

  app.delete(
    "/products/:id",
    { schema: productRouteSchemas.remove },
    controller.deleteProductHandler,
  );

  app.post(
    "/products/search",
    { schema: productRouteSchemas.search },
    controller.searchProductsHandler,
  );
};
