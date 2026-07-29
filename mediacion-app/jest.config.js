/** @type {import('jest').Config} */
const config = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^lucide-react-native$': '<rootDir>/test-helpers/mocks/lucide-react-native.ts',
    '^react-native-svg$': '<rootDir>/test-helpers/mocks/svg-mock.ts',
  },
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/.expo/',
    '<rootDir>/web-build/',
  ],
};

module.exports = config;
