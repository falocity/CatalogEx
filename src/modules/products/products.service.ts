import type { Logger } from '@map-colonies/js-logger';
import { inject, injectable } from 'tsyringe';

import { SERVICES } from '../../common/constants.js';
import { GeometryValidator } from './geometry.utils.js';
import { ProductNotFoundError, ProductValidationError } from './products.errors.js';
import { ProductsRepository } from './products.repository.js';
import { validateBoundingPolygon, validateProductFields } from './product.validation.js';
import type { BoundingPolygon } from './schemas/fields.schema.js';
import type { CreateProduct } from './schemas/product.schema.js';
import type { SearchProductsInput } from './schemas/search-products.schema.js';
import type { UpdateProduct } from './schemas/update-product.schema.js';

@injectable()
export class ProductsService {
  public constructor(
    @inject(ProductsRepository)
    private readonly repository: ProductsRepository,
    @inject(SERVICES.LOGGER)
    private readonly logger: Logger,
    @inject(GeometryValidator)
    private readonly geometryValidator: GeometryValidator
  ) {}

  public async createProduct(input: CreateProduct) {
    validateProductFields(input);

    const product = await this.repository.createProduct(input);
    this.logger.info({ productId: product.id }, 'Product created');

    return product;
  }

  public async getProductById(id: string) {
    const product = await this.repository.getProductById(id);

    if (!product) {
      throw new ProductNotFoundError();
    }

    return product;
  }

  public async listProducts(limit: number, offset: number) {
    return this.repository.listProducts(limit, offset);
  }

  public async updateProduct(id: string, input: UpdateProduct) {
    validateProductFields(input);

    const product = await this.repository.updateProduct(id, input);

    if (!product) {
      throw new ProductNotFoundError();
    }

    this.logger.info({ productId: id }, 'Product updated');
    return product;
  }

  public async deleteProduct(id: string) {
    const deleted = await this.repository.deleteProduct(id);

    if (!deleted) {
      throw new ProductNotFoundError();
    }

    this.logger.info({ productId: id }, 'Product deleted');
  }

  public async searchProducts(input: SearchProductsInput, limit: number, offset: number) {
    const geometries: BoundingPolygon[] = [];

    for (const operands of [input.contains, input.within, input.intersects]) {
      const geometry = operands?.boundingPolygon;

      if (geometry !== undefined) {
        validateBoundingPolygon(geometry);
        geometries.push(geometry);
      }
    }

    const geometriesValid = await this.geometryValidator.areValid(geometries);

    if (!geometriesValid) {
      throw new ProductValidationError('boundingPolygon', 'Search polygons must be valid, nonempty geometries.');
    }

    this.logger.debug({ filters: input, limit, offset }, 'Searching products');
    return this.repository.searchProducts(input, limit, offset);
  }
}
