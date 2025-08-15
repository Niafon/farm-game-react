export default {
  preset: 'ts-jest/presets/js-with-ts-esm',
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '\\.(css)$': 'identity-obj-proxy',
    '\\.html\\?raw$': '<rootDir>/__mocks__/htmlMock.ts'
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  testMatch: ['<rootDir>/src/__tests__/**/*.ts?(x)'],
  // Transform all modules so ESM packages work under Jest
  transformIgnorePatterns: [],
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.test.json',
        useESM: true,
        isolatedModules: true
      }
    ]
  }
};
