// Jest setup file
// This file runs after the test environment is set up but before tests run

// Increase timeout for async operations
jest.setTimeout(10000);

// Suppress console output during tests (optional - comment out if you want to see logs)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
//   error: jest.fn(),
// };

// Reset all mocks after each test
afterEach(() => {
  jest.clearAllMocks();
});
