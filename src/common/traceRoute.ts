import { context } from '@opentelemetry/api';
import { getRPCMetadata, RPCType } from '@opentelemetry/core';
import type { FastifyInstance } from 'fastify';

/**
 * Records the matched Fastify route for the HTTP server span.
 *
 * The OpenTelemetry HTTP instrumentation reads this route when the response finishes.
 * It then sets `http.route` and names the span `<method> <route>`, as Express instrumentation does.
 * Register this hook before any hook that can reply early, so those responses keep their route.
 */
export function registerTraceRoute(app: FastifyInstance): void {
  app.addHook('onRequest', (request, _reply, done) => {
    const route = request.routeOptions.url;
    const rpcMetadata = getRPCMetadata(context.active());

    if (route !== undefined && rpcMetadata?.type === RPCType.HTTP) {
      rpcMetadata.route = route;
    }

    done();
  });
}
