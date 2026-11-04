import type { FastifyInstance } from 'fastify';

const productsPath = '/products';

function productPath(id: string): string {
  return `${productsPath}/${id}`;
}

export class ProductsRequestSender {
  public constructor(private readonly app: FastifyInstance) {}

  public async create(payload: object | string, headers?: Record<string, string>) {
    return this.app.inject({
      method: 'POST',
      url: productsPath,
      payload,
      ...(headers === undefined ? {} : { headers }),
    });
  }

  public async getById(id: string) {
    return this.app.inject({ method: 'GET', url: productPath(id) });
  }

  public async list(limit: number, offset: number) {
    return this.app.inject({
      method: 'GET',
      url: `${productsPath}?limit=${limit}&offset=${offset}`,
    });
  }

  public async update(id: string, payload: object | string, headers?: Record<string, string>) {
    return this.app.inject({
      method: 'PATCH',
      url: productPath(id),
      payload,
      ...(headers === undefined ? {} : { headers }),
    });
  }

  public async remove(id: string) {
    return this.app.inject({ method: 'DELETE', url: productPath(id) });
  }

  public async search(payload: object, limit: number, offset: number) {
    return this.app.inject({
      method: 'POST',
      url: `${productsPath}/search?limit=${limit}&offset=${offset}`,
      payload,
    });
  }
}
