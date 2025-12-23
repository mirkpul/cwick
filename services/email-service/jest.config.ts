import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts', '**/*.test.js'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  setupFiles: ['<rootDir>/jest.setup.ts'],
  collectCoverage: false,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  coveragePathIgnorePatterns: ['/node_modules/', '/dist/'],
  maxWorkers: 1,
  workerIdleMemoryLimit: '512MB',
  testTimeout: 15000,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache',
};

export default config;
