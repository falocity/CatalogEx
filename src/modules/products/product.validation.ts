import { ProductValidationError } from './products.errors.js';
import type { BoundingPolygon } from './schemas/fields.schema.js';
import type { CreateProduct } from './schemas/product.schema.js';

export function validateBoundingPolygon(geometry: BoundingPolygon): void {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;

  let dimensions: number | undefined;

  polygons.forEach((polygon) => {
    polygon.forEach((ring) => {
      const first = ring[0];
      const last = ring[ring.length - 1];

      if (last === undefined || first?.length !== last.length || first.some((coordinate, index) => coordinate !== last[index])) {
        throw new ProductValidationError('boundingPolygon', 'Each ring must end with the same position it starts with.');
      }

      ring.forEach((position) => {
        dimensions ??= position.length;

        if (position.length !== dimensions) {
          throw new ProductValidationError('boundingPolygon', 'All positions must consistently use two or three coordinates.');
        }
      });
    });
  });
}

export function validateProductFields(input: Partial<CreateProduct>): void {
  if (input.boundingPolygon !== undefined) {
    validateBoundingPolygon(input.boundingPolygon);
  }
}
