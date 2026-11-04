import { isMainThread } from 'node:worker_threads';
import { getConfig, initConfig } from './common/config.js';
import { tracingFactory } from './common/tracing.js';

if (isMainThread) {
  await initConfig();

  const config = getConfig();
  const { isEnabled, debug, url, traceRatio } = config.get('telemetry.tracing');
  const { serviceName, serviceVersion, hostname } = config.get('telemetry.shared');

  const tracing = tracingFactory({
    isEnabled,
    ...(debug === undefined ? {} : { debug }),
    ...(url === undefined ? {} : { url }),
    ...(traceRatio === undefined ? {} : { traceRatio }),
    ...(serviceName === undefined ? {} : { serviceName }),
    ...(serviceVersion === undefined ? {} : { serviceVersion }),
    ...(hostname === undefined ? {} : { hostname }),
  });

  tracing.start();
}
