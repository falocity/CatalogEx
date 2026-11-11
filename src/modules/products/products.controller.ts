import { StatusCodes } from 'http-status-codes';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { inject, injectable } from 'tsyringe';

import { ProductsService } from './products.service.js';
import { DEFAULT_PAGE_LIMIT, DEFAULT_PAGE_OFFSET, type PaginationQuery, type ProductsPage } from './schemas/pagination.schema.js';
import type { CreateProduct, Product, ProductIdParams } from './schemas/product.schema.js';
import type { SearchProductsInput } from './schemas/search-products.schema.js';
import type { UpdateProduct } from './schemas/update-product.schema.js';

/* eslint-disable @typescript-eslint/naming-convention -- Fastify route generics use Body, Params, and Querystring. */
@injectable()
export class ProductsController {
  public constructor(@inject(ProductsService) private readonly service: ProductsService) {}

  public createProductHandler = async (request: FastifyRequest<{ Body: CreateProduct }>, reply: FastifyReply): Promise<void> => {
    const product = await this.service.createProduct(request.body);

    return reply.code(StatusCodes.CREATED).header('Location', `/products/${product.id}`).send({ id: product.id });
  };

  public getProductByIdHandler = async ({ params: { id } }: FastifyRequest<{ Params: ProductIdParams }>): Promise<Product> => {
    return this.service.getProductById(id);
  };

  public listProductsHandler = async ({
    query: { limit = DEFAULT_PAGE_LIMIT, offset = DEFAULT_PAGE_OFFSET },
  }: FastifyRequest<{ Querystring: PaginationQuery }>): Promise<ProductsPage> => {
    return this.service.listProducts(limit, offset);
  };

  public updateProductHandler = async ({
    params: { id },
    body,
  }: FastifyRequest<{ Params: ProductIdParams; Body: UpdateProduct }>): Promise<Product> => {
    return this.service.updateProduct(id, body);
  };

  public deleteProductHandler = async ({ params: { id } }: FastifyRequest<{ Params: ProductIdParams }>, reply: FastifyReply): Promise<void> => {
    await this.service.deleteProduct(id);
    return reply.code(StatusCodes.NO_CONTENT).send();
  };

  public searchProductsHandler = async ({
    body,
    query: { limit = DEFAULT_PAGE_LIMIT, offset = DEFAULT_PAGE_OFFSET },
  }: FastifyRequest<{
    Body: SearchProductsInput;
    Querystring: PaginationQuery;
  }>): Promise<ProductsPage> => {
    return this.service.searchProducts(body, limit, offset);
  };
}
/* eslint-enable @typescript-eslint/naming-convention */
