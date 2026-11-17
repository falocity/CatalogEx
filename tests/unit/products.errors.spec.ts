import { DatabaseError } from 'pg';
import { describe, expect, it } from 'vitest';
import { ProductValidationError, rethrowProductDatabaseError } from '../../src/modules/products/products.errors.js';

describe('database error translation', () => {
  it('should convert zoom-order violations to a product validation error.', () => {
    const error = new DatabaseError('check failed', 0, 'error');
    error.code = '23514';
    error.constraint = 'products_zoom_range_valid';

    let caught: unknown;

    try {
      rethrowProductDatabaseError(error);
    } catch (thrown) {
      caught = thrown;
    }

    expect(caught).toBeInstanceOf(ProductValidationError);
    expect(caught).toMatchObject({
      statusCode: 400,
      field: 'minZoom',
    });
  });

  it('should rethrow unexpected errors unchanged.', () => {
    const error = new Error('unexpected');
    let caught: unknown;

    try {
      rethrowProductDatabaseError(error);
    } catch (thrown) {
      caught = thrown;
    }

    expect(caught).toBe(error);
  });
});
