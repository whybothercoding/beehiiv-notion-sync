export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  clearMocks: true,
  collectCoverage: false,
  collectCoverageFrom: ['src/**/*.ts'],
  // src/index.ts is pure Commander wiring (flag parsing, process.exit calls)
  // — it's exercised by hand via the documented CLI commands, not unit
  // tests. Everything it delegates to (config, sync, scheduler) is covered.
  coveragePathIgnorePatterns: ['/node_modules/', 'src/index.ts'],
  coverageReporters: ['text', 'lcov', 'json-summary'],
  coverageThreshold: {
    global: {
      statements: 90,
      branches: 75,
      functions: 90,
      lines: 90,
    },
  },
};
