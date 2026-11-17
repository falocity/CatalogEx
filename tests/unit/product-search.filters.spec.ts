import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { buildProductSearchConditions } from '../../src/modules/products/product-search.filters.js';
import type { BoundingPolygon } from '../../src/modules/products/schemas/fields.schema.js';
import type { SearchProductsInput } from '../../src/modules/products/schemas/search-products.schema.js';

const ringXY: [number, number][] = [
  [34, 31],
  [35, 31],
  [35, 32],
  [34, 31],
];

const polygon: BoundingPolygon = {
  type: 'Polygon',
  coordinates: [ringXY],
};

const dialect = new PgDialect();

function query(input: SearchProductsInput) {
  const conditions = buildProductSearchConditions(input);

  if (conditions === undefined) {
    throw new Error('Expected search conditions');
  }

  return dialect.sqlToQuery(conditions);
}

describe('product search filters', () => {
  it('should not add WHERE conditions for an empty search.', () => {
    expect(buildProductSearchConditions({})).toBeUndefined();
  });

  it('should parameterize text and join text and numeric conditions with AND.', () => {
    const name = "example' OR TRUE; --";

    const result = query({
      equal: { name },
      greater: { maxZoom: -1 },
    });

    expect(result.params).toEqual([name, -1]);
    expect(result.sql).not.toContain(name);
    expect(result.sql).toMatch(/\sand\s/i);
  });

  it.each(['equal', 'greater', 'greaterEqual', 'less', 'lessEqual'] as const)(
    'should parameterize numeric thresholds beyond the stored integer range for %s.',
    (operator) => {
      const input: SearchProductsInput = {};
      input[operator] = { minZoom: 2_147_483_648 };

      const result = query(input);

      expect(result.params).toEqual([2_147_483_648]);
      expect(result.sql).not.toContain('2147483648');
    }
  );

  it.each(['contains', 'within', 'intersects'] as const)('should parameterize GeoJSON for %s.', (operator) => {
    const input: SearchProductsInput = {};
    input[operator] = { boundingPolygon: polygon };

    const result = query(input);

    expect(result.params).toEqual([JSON.stringify(polygon)]);
    expect(result.sql).not.toContain(JSON.stringify(polygon));
  });
});
