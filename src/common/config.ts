import { config, type ConfigInstance } from '@map-colonies/config';
import { appConfigSchema, type AppConfig } from './config.schema.js';

type ConfigType = ConfigInstance<AppConfig>;

let configInstance: ConfigType | undefined;

async function initConfig(offlineMode = true): Promise<void> {
  configInstance = await config({
    schema: appConfigSchema,
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
