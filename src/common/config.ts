import { config, type ConfigInstance } from '@map-colonies/config';
import { vectorCatalogexV1, type vectorCatalogexV1Type } from '@map-colonies/schemas';

type ConfigType = ConfigInstance<vectorCatalogexV1Type>;

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
