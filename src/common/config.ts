import { createRequire } from 'node:module';
import { config, type ConfigInstance } from '@map-colonies/config';
import type * as schemas from '@map-colonies/schemas';

const { vectorCatalogexV1 } = createRequire(import.meta.url)('@map-colonies/schemas') as typeof schemas;

type ConfigType = ConfigInstance<schemas.vectorCatalogexV1Type>;
let configInstance: ConfigType | undefined;

async function initConfig(offlineMode = true): Promise<void> {
  configInstance = await config({
    schema: vectorCatalogexV1,
    offlineMode,
  });
}

function getConfig(): ConfigType {
  if (!configInstance) {
    throw new Error('Configuration has not been initialized');
  }

  return configInstance;
}

export { initConfig, getConfig };
export type { ConfigType };
