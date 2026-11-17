import type { FastifyInstance } from 'fastify';
import { Histogram, type Registry } from 'prom-client';
import { MILLISECONDSPERSECOND } from '../common/constants.js';

export function registerMetrics(app: FastifyInstance, registry: Registry): void {
  const requestDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of completed HTTP requests in seconds',
    labelNames: ['method', 'route', 'statusCode'],
    registers: [registry],
  });

  app.addHook('onResponse', async (request, reply) => {
    const route = request.routeOptions.url ?? 'unmatched';

    if (route === '/metrics') {
      return;
    }

    requestDuration.observe(
      {
        method: request.method,
        route,
        statusCode: String(reply.statusCode),
      },
      reply.elapsedTime / MILLISECONDSPERSECOND
    );
  });

  app.get('/metrics', async (_request, reply) => {
    return reply.type(registry.contentType).send(await registry.metrics());
  });
}
