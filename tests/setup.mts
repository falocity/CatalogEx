import 'reflect-metadata';
process.env.NODE_ENV = 'test';

const { initConfig } = await import('../src/common/config.js');
await initConfig();
