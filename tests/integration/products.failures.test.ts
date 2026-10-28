import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { StatusCodes } from "http-status-codes";
import { withProductTest } from "../helpers/products.js";

for (const method of ["PATCH", "DELETE"] as const) {
  test(`${method} returns 404 for a missing product`, async () => {
    await withProductTest(async ({ app }) => {
      const response = await app.inject({
        method,
        url: `/products/${randomUUID()}`,
        ...(method === "PATCH" ? { payload: { name: "Missing product" } } : {}),
      });

      assert.equal(response.statusCode, StatusCodes.NOT_FOUND, response.body);
      assert.deepEqual(response.json(), {
        code: "PRODUCT_NOT_FOUND",
        message: "Product not found.",
        field: "id",
      });
    });
  });
}
