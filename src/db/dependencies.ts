import type { Pool } from 'pg';
import type { FactoryFunction } from 'tsyringe';
import type { ConfigType } from '../common/config.js';
import { SERVICES } from '../common/constants.js';
import { createDatabase, createDatabaseReadiness, createPool, type Database, type DatabaseReadiness } from './client.js';

export const databasePoolFactory: FactoryFunction<Pool> = (container) => createPool(container.resolve<ConfigType>(SERVICES.CONFIG));

export const databaseFactory: FactoryFunction<Database> = (container) => createDatabase(container.resolve<Pool>(SERVICES.POOL));

export const databaseReadinessFactory: FactoryFunction<DatabaseReadiness> = (container) =>
  createDatabaseReadiness(container.resolve<Pool>(SERVICES.POOL), container.resolve<ConfigType>(SERVICES.CONFIG));
