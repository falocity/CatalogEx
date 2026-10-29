import { config, type ConfigInstance } from "@map-colonies/config";
import { AppConfigSchema, type AppConfig } from "./config.schema.js";

export type ConfigType = ConfigInstance<AppConfig>;

let configInstance: ConfigType | undefined;

export async function initConfig(offlineMode = true): Promise<void> {
  configInstance = await config({
    schema: AppConfigSchema,
    offlineMode,
  });
}

export function getConfig(): ConfigType {
  if (!configInstance) {
    throw new Error("Configuration has not been initialized");
  }

  return configInstance;
}
