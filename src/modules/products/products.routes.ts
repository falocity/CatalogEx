import Type from "typebox";
import {
  TypeBoxValidatorCompiler,
  type FastifyPluginAsyncTypebox,
} from "@fastify/type-provider-typebox";
import {
  CreateProductSchemaInput,
  ProductSchema,
} from "./schemas/product.schema.js";
import { createProduct } from "./products.repository.js";
import { validateProductInput } from "./product.validation.js";
const createBodySchema = Type.Object(CreateProductSchemaInput.properties, {
  additionalProperties: false,
});
export const productsRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.setValidatorCompiler(TypeBoxValidatorCompiler);

  app.post(
    "/products",
    {
      schema: {
        body: createBodySchema,
        response: {
          201: ProductSchema,
        },
      },
    },
    async (request, reply) => {
      validateProductInput(request.body);

      const product = await createProduct(request.body);

      return reply
        .code(201)
        .header("Location", `/products/${product.id}`)
        .send(product);
    },
  );
};
