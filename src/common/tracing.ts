import { Tracing } from "@map-colonies/tracing";

let tracing: Tracing | undefined;

export function tracingFactory(
  options: ConstructorParameters<typeof Tracing>[0],
): Tracing {
  tracing = new Tracing({
    ...options,
    autoInstrumentationsConfigMap: {
      "@opentelemetry/instrumentation-fs": {
        requireParentSpan: true,
      },
    },
  });

  return tracing;
}

export function getTracing(): Tracing {
  if (!tracing) {
    throw new Error("Tracing has not been initialized");
  }

  return tracing;
}
