/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  moduleNameMapper: {
    '^@virtualcoach/shared-config$': '<rootDir>/../../packages/shared-config/dist',
    '^@virtualcoach/shared-types$': '<rootDir>/../../packages/shared-types/dist'
  },
};
